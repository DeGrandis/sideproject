# stats.degrand.is

One page with everything on this box: visits and errors for every site, the containers and the host's health, game
lobbies and players, the Proof of Basis demo's assistant questions, and the Proof of Basis numbers on GitHub. It
updates every 5 minutes (GitHub's numbers hourly).

How it works:

- nginx writes one line per page load to `/var/log/nginx/visits/visits.log` (`nginx/nginx.conf`, `log_format
  visits`), for every site. A page load is what a browser sends when it opens a page (`Sec-Fetch-Dest: document`);
  images, scripts and API calls aren't logged. Server errors (5xx) are always logged, and so are the Proof of Basis
  demo's assistant questions and Start over. The address is shortened first (`1.2.3.4` becomes `1.2.3.0`), and the
  path is written without its query string.
- The `stats` service runs `stats.py` on Python's own image (standard library only). It adds the new lines to running
  totals in its `stats_data` volume and writes `index.html` to `stats_page`, which nginx serves. The raw log is
  emptied once a day.
- Visitors are counted from a hash of the shortened address and the browser, salted with a secret that changes every
  month. The hashes are kept 35 days (for the 30-day count); daily totals are kept, and the country, referrer and
  page lists for 90 days. Bots that say so in their user agent aren't counted.
- Containers come from `docker_status`, a read-only window onto Docker (it can list containers and read their logs;
  it can't start, stop or change anything), reachable only by the stats service. Load, memory and disk come from the host's `/proc` and filesystem, and the
  certificate's expiry from `certbot/conf`.
- Countries come from DB-IP's free country database, downloaded once a month and looked up on the server.
- The Proof of Basis demo's assistant questions are written with their text to `/var/log/nginx/visits/questions.log`
  (nginx logs the request body for that one endpoint). The page lists the last 50, with the page and language they
  were asked from; questions are kept 90 days.
- Trivia and tomatotomato lobbies and players come from the games' own `lobby_created` and `player_joined` events in
  their container logs, read through `docker_status`. Docker keeps a container's log only until it's recreated (every
  deploy), so they're collected as they happen; lobbies are kept 400 days. A lobby's players are its creator plus
  everyone who joined.
- GitHub: stars, forks, issues and release downloads from its public API, and the container images' "Total
  downloads" from their package pages (the API doesn't have it). No token needed.
- Nothing is added to the sites themselves: no cookies, no scripts, no third party.

Settings (in `docker-compose.yaml`): `STATS_IGNORE_SITES` (not shown: the stats page and the sign-in),
`STATS_PROJECT` (whose containers are listed), `STATS_GAMES` (site=service for the games),
`STATS_GITHUB_REPOS`, `STATS_GITHUB_PACKAGES`.

## Who can see it

`stats.degrand.is` is behind a passkey sign-in: Pocket ID at `id.degrand.is`, with oauth2-proxy as the gatekeeper
nginx asks first. See `auth/README.md`.

nginx's main logs (all sites, full addresses) also go to CloudWatch, group `/containers/nginx`. To keep them only for
30 days: CloudWatch → Log groups → `/containers/nginx` → Actions → Edit retention setting → 30 days.
