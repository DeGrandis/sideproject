# Passkey sign-in for private pages

`id.degrand.is` runs [Pocket ID](https://pocket-id.org), a sign-in service that uses passkeys only (no passwords).
It has one account, Rob's, and sign-ups are off. Private pages sit behind it: `stats.degrand.is` first, through
oauth2-proxy, which nginx asks before serving the page.

The secrets live only on the server, in this folder (`~/docker/auth/`), never in git. The deploy copies
`docker-compose.yaml` and rewrites `.env`, but leaves these files alone:

| File | Holds | Made by |
|---|---|---|
| `pocket-id.env` | `ENCRYPTION_KEY`, which encrypts Pocket ID's stored keys | `openssl rand` on the server |
| `oauth2-proxy.env` | `OAUTH2_PROXY_COOKIE_SECRET` (random), plus `OAUTH2_PROXY_CLIENT_ID` and `OAUTH2_PROXY_CLIENT_SECRET` from Pocket ID's "stats" client | `openssl rand`, then Rob from Pocket ID's admin page |

Keep `pocket-id.env`: without its key, Pocket ID can't read its own data. Pocket ID's data (accounts, passkeys,
clients, audit log) is the `pocket_id_data` Docker volume.

## Lost passkey

With SSH access to the server, make a one-time sign-in link, open it, and add a new passkey:

```sh
docker exec docker-pocket_id-1 /app/pocket-id one-time-access-token rob
```

If everything is lost, delete the `pocket_id_data` volume and set Pocket ID up again (`/setup`). Only sign-ins live
there.

## Adding another private page

In Pocket ID, add a client for it with callback `https://<page>/oauth2/callback`, then give that page its own
oauth2-proxy settings and the same nginx `auth_request` lines as `stats.degrand.is`.
