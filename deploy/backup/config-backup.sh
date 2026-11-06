#!/bin/sh
# Nightly snapshot of everything needed to rebuild this vhost by hand:
# the nginx configuration, the certbot renewal settings (not the keys, those
# live in /etc/letsencrypt/archive and a renewal re-issues if needed), the
# stats units and the ops runbook. Site content is not backed up - it is git.

set -eu

DEST=/home/deploy/backups
STAMP=$(date +%Y%m%d)
ARCHIVE="$DEST/lesem-config-$STAMP.tar.gz"

mkdir -p "$DEST"

tar -czf "$ARCHIVE" \
    -C / \
    etc/nginx/nginx.conf \
    etc/nginx/conf.d/50-lesem-map.conf \
    etc/nginx/sites-available/lesem \
    etc/nginx/snippets/lesem-headers.conf \
    etc/nginx/snippets/lesem-ssl.conf \
    etc/letsencrypt/renewal/lesem.info.conf \
    etc/systemd/system/lesem-stats.service \
    etc/systemd/system/lesem-stats.timer \
    usr/local/bin/lesem-stats \
    home/deploy/lesem-DEPLOY.md

chown deploy:deploy "$ARCHIVE"
chmod 600 "$ARCHIVE"

# Keep two weeks, same as the nginx logs.
find "$DEST" -name 'lesem-config-*.tar.gz' -type f -mtime +14 -delete
