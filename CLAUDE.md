# CLAUDE.md — lesem

A static export of an old WordPress/WooCommerce site, served at **lesem.info**.
No PHP, no database, no backend: nginx serves files. The
[`deploy/README.md`](deploy/README.md) is the deployment map and the authority on
what is generated, what is retired and how TLS/statistics work.

## Layout

| Path | What |
|---|---|
| `index.html`, `blog/`, `produkt/`, `obchod/`, `o-mne/`, `kontakt/` | the exported pages |
| `wp-content/`, `wp-includes/` | WordPress leftovers the pages still reference — CSS, JS, fonts, images. They are served, so paths matter |
| `deploy/deploy.sh` | rsync to `/var/www/lesem` (+ nginx config unless `SKIP_NGINX=1`) |
| `deploy/nginx/` | vhost, headers, redirect map, stats vhost |
| `deploy/backup/` | the config backup unit/timer |
| `.github/scripts/build-cart.py` | injects `cart.css`/`cart.js` with a `?v=<hash>` buster |
| `.github/scripts/gen-sitemap.py` | regenerates `sitemap.xml` and `robots.txt` |
| `.github/scripts/strip-analytics.py` | removes the retired Universal Analytics snippet |

## Building

There is no build. The generated files are edited by the three scripts:

```sh
python3 .github/scripts/build-cart.py     # after editing wp-content/cart/
python3 .github/scripts/gen-sitemap.py    # after adding or renaming a page
```

Whenever you add or rename a page, run `gen-sitemap.py`; whenever you touch the
cart assets, run `build-cart.py`. Both write into the tree and the results are
committed.

## Deploy

```sh
./deploy/deploy.sh                # content + nginx config
SKIP_NGINX=1 ./deploy/deploy.sh   # content only
```

It rsyncs with `--delete`, so anything that must survive a deploy lives outside
`/var/www/lesem` — that is why the visit report is in `/var/www/lesem-stats`.
There is no autodeploy timer for this site: the deploy is a deliberate act from a
machine that can reach the box, and `deploy/README.md` documents the follow-up
commands for TLS and the stats unit.

## Conventions

- Never break a URL without adding a redirect to the `map $uri $lesem_redirect`
  block in `deploy/nginx/lesem.conf`; the shop's retired cart/checkout pages are
  already listed there, and keys are full paths.
- Leave `wp-content/`/`wp-includes/` paths alone. They look like cruft and are
  load-bearing: the exported HTML references them directly.
- No client-side tracking and no cookies; the visitor report is server-side
  GoAccess behind basic auth. Do not add an analytics snippet back.
- `deploy/README.md` is the source of truth for hosts, TLS, the stats password and
  the generated files — update it in the same commit as the change.

## Before this site goes live

This repository is served publicly at https://lesem.info. A change that adds or alters a
page, a form, a script, a header or a vhost passes the launch gate before it
ships:

```sh
web-launch-check https://lesem.info
```

- `FAIL` blocks the publish; `WARN` is a decision to state in the reply, not
  something to leave unmentioned.
- The `web-launch-checklist` skill has the 25 items the checker cannot judge:
  privacy and terms content, colour contrast, real-device speed, spam
  protection, analytics and error monitoring, one clear call to action, and the
  signup/login/reset flows.
- Run it again after publishing: it checks the live vhost, headers and
  certificate, not the working tree.
- A preview vhost passes the same gate before DNS moves.

## Deploying this site

https://lesem.info is published by the **deploy** account from this repository's
`main` branch — the `site-deploy` timer, every five minutes. Merge is
deploy: there is no publish command, and `sudo vps-site publish` refuses this
web root (one writer per root, and it is not this account).

Verify after merging, and give it up to ten minutes:

```sh
site-status --site lesem
curl -fsS https://lesem.info/deployed.json           # {"commit": "...", "deployed_at": "..."}
git -C ~/repos/lesem rev-parse origin/main
```

The three commits must match. If it has not moved after two timer cycles, read
`journalctl -u site-deploy -n 50`, report the commit that should be live and the
one that is, and do not rsync into `/var/www` or edit a live file to compensate.
The `static-site-deploy` skill has the full procedure.
