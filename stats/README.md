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

## One-time setup on the server

The reports are behind a password, and the password file lives only on the server. Until it exists, every request
to `stats.degrand.is` is refused. To make it, SSH to the server and run (it asks for the password twice and doesn't
echo it or save it in your shell history):

```sh
mkdir -p ~/docker/nginx/stats-auth && echo "rob:$(openssl passwd -apr1)" > ~/docker/nginx/stats-auth/htpasswd
```

To change the password later, run the same command again. nginx reads the file on each request, so there's no
restart needed.

nginx's main logs (all sites, full addresses) also go to CloudWatch, group `/containers/nginx`. To keep them only for
30 days: CloudWatch → Log groups → `/containers/nginx` → Actions → Edit retention setting → 30 days.
