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
