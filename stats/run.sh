#!/bin/sh
# Proof of Basis visit reports, served (behind a password) at stats.degrand.is.
#
# nginx writes one line per page load to /logs/site.log (proofofbasis.degrand.is) and /logs/demo.log
# (demo.proofofbasis.degrand.is, plus each assistant question and Start over), with the visitor's address already
# shortened (1.2.3.4 is written as 1.2.3.0). Every hour GoAccess adds the new lines to its running totals in /data and
# rewrites the two reports in /report. Once a day, right after a run, the raw logs are emptied, so they never hold
# more than about a day; only the totals are kept.
#
# Countries come from DB-IP's free country database (CC BY 4.0), downloaded once a month and looked up here, so no
# address is sent anywhere.
set -u

LOGS=/logs DATA=/data OUT=/report
FORMAT='%h [%d:%t %^] "%r" %s %b "%R" "%u"'

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

# report <name> <title>: adds the new lines of /logs/<name>.log to the totals and writes /report/<name>.html.
report() {
  mkdir -p "$DATA/$1"
  touch "$LOGS/$1.log"
  db=$(geo)
  goaccess "$LOGS/$1.log" --log-format="$FORMAT" --date-format=%d/%b/%Y --time-format=%T \
    --ignore-crawlers --persist --restore --db-path="$DATA/$1" \
    --html-report-title="$2" ${db:+--geoip-database="$db"} -o "$OUT/$1.html" >/dev/null \
    || echo "report $1 failed"
}

index() {
  cat > "$OUT/index.html" <<EOF
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Proof of Basis stats</title>
<style>body{margin:0;padding:40px 20px;background:#0b0b0a;color:#f3f2ea;font:17px/1.5 system-ui,sans-serif}
main{max-width:640px;margin:0 auto}a{color:#b9f04a}li{margin:10px 0}.small{color:#9b998f;font-size:14px}</style>
</head><body><main>
<h1>Proof of Basis stats</h1>
<ul>
<li><a href="site.html">Landing page</a> (proofofbasis.degrand.is): page loads</li>
<li><a href="demo.html">Demo</a> (demo.proofofbasis.degrand.is): page loads, assistant questions (<code>/api/ai/chats/…/send</code>), Start over (<code>/api/demo/reset</code>)</li>
</ul>
<p class="small">"Hits" counts every load, refreshes included. "Visitors" counts each shortened address and browser once
per day. Updated hourly; last update $(date -u '+%Y-%m-%d %H:%M') UTC. No cookies or scripts on the sites; addresses
are shortened before they are written. Countries by <a href="https://db-ip.com">DB-IP</a> (CC BY 4.0).</p>
</main></body></html>
EOF
}

mkdir -p "$OUT"
day=$(date -u +%F)
while :; do
  report site "proofofbasis.degrand.is"
  report demo "demo.proofofbasis.degrand.is"
  index
  if [ "$(date -u +%F)" != "$day" ]; then
    : > "$LOGS/site.log"
    : > "$LOGS/demo.log"
    day=$(date -u +%F)
  fi
  sleep "${STATS_EVERY:-3600}"
done
