#!/usr/bin/env bash
# Publish the static site and (optionally) the nginx configuration to the VPS.
#
#   ./deploy/deploy.sh              content + nginx config
#   SKIP_NGINX=1 ./deploy/deploy.sh content only
#
# The web root is replaced with --delete, so anything that must survive a
# deploy has to live outside /var/www/lesem (that is why the visit report is
# in /var/www/lesem-stats).

set -euo pipefail

HOST=${HOST:-deploy@ondralinek.cz}
ROOT=/var/www/lesem
REPO=$(cd "$(dirname "$0")/.." && pwd)

rsync -az --delete \
    --exclude .git/ \
    --exclude .github/ \
    --exclude deploy/ \
    "$REPO"/ "$HOST:$ROOT"/

ssh "$HOST" "sudo chown -R deploy:www-data $ROOT && \
    sudo find $ROOT -type d -exec chmod 755 {} + && \
    sudo find $ROOT -type f -exec chmod 644 {} +"

if [ "${SKIP_NGINX:-0}" != "1" ]; then
    rsync -az "$REPO"/deploy/nginx/ "$HOST:/home/deploy/nginx/"
    ssh "$HOST" 'set -e
        sudo install -m 644 /home/deploy/nginx/lesem.conf /etc/nginx/sites-available/lesem
        sudo install -m 644 /home/deploy/nginx/lesem-headers.conf /etc/nginx/snippets/lesem-headers.conf
        sudo install -m 644 /home/deploy/nginx/lesem-ssl.conf /etc/nginx/snippets/lesem-ssl.conf
        sudo install -m 644 /home/deploy/nginx/50-lesem-map.conf /etc/nginx/conf.d/50-lesem-map.conf
        sudo nginx -t
        sudo systemctl reload nginx'
fi

echo "deployed to $HOST:$ROOT"
