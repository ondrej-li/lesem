# Deployment

The site is a static export of the old WordPress installation, served by nginx
on the VPS. There is no PHP, no database and no backend of any kind.

| | |
|---|---|
| Hosts | `www.lesem.info`, `lesem.info` (301 → www) |
| Server | `deploy@ondralinek.cz` (`2.31.33.21`, `2a01:4f8:c016:e828::1`) |
| Web root | `/var/www/lesem` (`deploy:www-data`, 755/644) |
| vhost | `/etc/nginx/sites-available/lesem` |
| Headers | `/etc/nginx/snippets/lesem-headers.conf` |
| TLS | `/etc/letsencrypt/live/lesem.info/` (SANs: `lesem.info`, `www.lesem.info`) |
| Visit report | `https://www.lesem.info/_stats/` (basic auth, user `lesem`) |

## Publishing

    ./deploy/deploy.sh                 # content + nginx config
    SKIP_NGINX=1 ./deploy/deploy.sh    # content only

The web root is replaced with `rsync --delete`; anything that must survive a
deploy lives outside `/var/www/lesem` (that is why the visit report is in
`/var/www/lesem-stats`).

## Generated files

Two scripts in `.github/scripts` keep the export in sync with the shop:

| Script | Purpose |
|---|---|
| `build-cart.py` | injects `cart.css`/`cart.js` into every page with a `?v=<hash>` cache buster |
| `gen-sitemap.py` | regenerates `sitemap.xml` and `robots.txt` from the page tree |
| `strip-analytics.py` | removes the retired Universal Analytics snippet |

Run `build-cart.py` after editing anything under `wp-content/cart/`, and
`gen-sitemap.py` after adding or renaming pages.

## Retired URLs

The `map $uri $lesem_redirect` block at the top of
[`nginx/lesem.conf`](./nginx/lesem.conf) 301s the WooCommerce cart/checkout/
account pages and the products that were deleted from the shop before the
migration. Keys are full paths, which is why
[`50-lesem-map.conf`](./nginx/50-lesem-map.conf) raises
`map_hash_bucket_size`.

## Visit report

`lesem-stats.sh` runs daily at 04:20 via `lesem-stats.timer`, renders the
nginx access log (14 days, bots filtered, IPs anonymised) with GoAccess into
`/var/www/lesem-stats/index.html` and is served at `/_stats/` behind HTTP
basic auth. No client-side tracking, no cookies, so no consent banner is
needed.

    sudo systemctl status lesem-stats.timer
    sudo systemctl start lesem-stats.service     # rebuild now
    sudo htpasswd /etc/nginx/lesem-stats.htpasswd lesem   # change password

## TLS

    sudo certbot certificates
    sudo certbot renew --dry-run --no-random-sleep-on-renew

To add or remove hostnames, keep the vhost and the certificate in sync:

    sudo certbot certonly --nginx --cert-name lesem.info \
         -d lesem.info -d www.lesem.info
