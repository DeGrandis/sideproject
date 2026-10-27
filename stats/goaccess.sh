#!/bin/sh
# Detailed GoAccess reports, one per site, linked at the bottom of stats.degrand.is.
#
# Every 5 minutes this takes the visit log's new page loads (/logs/visits.log, written by nginx; the stats service
# empties it once a day), adds each site's to that site's file in /data/<site>, and lets GoAccess add them to the
# site's running totals and rewrite /page/goaccess/<site>.html. It keeps its own read position, so each line is
# counted once. Lines written in the last few minutes before the daily emptying can miss these reports (not the main
# page). Each site's file keeps its lines (shortened addresses) until it reaches 20 MB; GoAccess keeps 400 days.
#
# Countries come from DB-IP's free country database (CC BY 4.0), downloaded once a month and looked up here.
set -u

LOG=/logs/visits.log DATA=/data OUT=/page/goaccess
FORMAT='%h\t%dT%t+%^\t%v\t%m\t%U\t%s\t%^\t%R\t%u'
IGNORE=" ${STATS_IGNORE_SITES:-} "

# This month's country database, or the newest one already here if the download fails.
geo() {
  month=$(date -u +%Y-%m)
  file="$DATA/dbip-country-$month.mmdb"
  if [ ! -s "$file" ]; then
    if wget -qO- "https://download.db-ip.com/free/dbip-country-lite-$month.mmdb.gz" | gunzip > "$file.tmp" && [ -s "$file.tmp" ]; then
      mv "$file.tmp" "$file"
      find "$DATA" -maxdepth 1 -name 'dbip-country-*.mmdb' ! -name "dbip-country-$month.mmdb" -delete
    else
      rm -f "$file.tmp"
    fi
  fi
  ls -t "$DATA"/dbip-country-*.mmdb 2>/dev/null | head -1
}

mkdir -p "$OUT" "$DATA"
while :; do
  if [ -f "$LOG" ]; then
    size=$(stat -c %s "$LOG")
    off=$(cat "$DATA/offset" 2>/dev/null || echo 0)
    [ "$size" -lt "$off" ] && off=0  # emptied since
    if [ "$size" -gt "$off" ]; then
      tail -c +"$((off + 1))" "$LOG" | head -c "$((size - off))" > /tmp/new
      db=$(geo)
      # Only page loads (not the demo's questions or Start over), and only real sites (not the catch-all).
      for site in $(awk -F'\t' '$7 == "page" { print $3 }' /tmp/new | sort -u); do
        case "$site" in "~"*|"") continue ;; esac
        case "$IGNORE" in *" $site "*) continue ;; esac
        # Each site's lines go to its own growing file, which GoAccess reads from where it stopped (it tracks the
        # file by inode and size). Past 20 MB, once counted, the file is dropped and a new one starts.
        mkdir -p "$DATA/$site"
        awk -F'\t' -v s="$site" '$3 == s && $7 == "page"' /tmp/new >> "$DATA/$site/visits.log"
        goaccess "$DATA/$site/visits.log" --log-format="$FORMAT" --date-format=%Y-%m-%d --time-format=%H:%M:%S \
          --ignore-crawlers --persist --restore --keep-last=400 --db-path="$DATA/$site" \
          --html-report-title="$site" ${db:+--geoip-database="$db"} -o "$OUT/$site.html" >/dev/null 2>&1 \
          || echo "report $site failed"
        [ "$(stat -c %s "$DATA/$site/visits.log")" -gt 20000000 ] && rm "$DATA/$site/visits.log"
      done
      echo "$size" > "$DATA/offset"
    fi
  fi
  sleep "${STATS_EVERY:-300}"
done
