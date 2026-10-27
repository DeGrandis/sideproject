# Proof of Basis visit reports

`stats.degrand.is` shows how often the Proof of Basis landing page (`proofofbasis.degrand.is`) and the demo
(`demo.proofofbasis.degrand.is`) are loaded, from where, and how many assistant questions the demo gets.

How it works:

- nginx writes one line per page load to its own log (`nginx/nginx.conf`, `log_format pob`), with the visitor's
  address shortened first (`1.2.3.4` becomes `1.2.3.0`). Images, scripts and API calls aren't logged, except the
  demo's assistant questions and Start over.
- The `pob_stats` service (`docker-compose.yaml`, script `run.sh`) runs GoAccess every hour, adds the new lines to its
  running totals and rewrites the reports. The raw logs are emptied once a day; only the totals are kept.
- Countries come from DB-IP's free country database, downloaded once a month and looked up on the server.
- Nothing is added to the sites themselves: no cookies, no scripts, no third party.

"Hits" counts every load, refreshes included. "Visitors" counts each shortened address and browser once per day, so
someone refreshing fifty times is one visitor.

## Who can see it

`stats.degrand.is` is behind a passkey sign-in: Pocket ID at `id.degrand.is`, with oauth2-proxy as the gatekeeper
nginx asks first. See `auth/README.md`.

nginx's main logs (all sites, full addresses) also go to CloudWatch, group `/containers/nginx`. To keep them only for
30 days: CloudWatch → Log groups → `/containers/nginx` → Actions → Edit retention setting → 30 days.
