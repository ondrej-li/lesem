#!/bin/sh
# Rebuild the private visit report for lesem.info from the nginx access logs.
#
# Installed as /usr/local/bin/lesem-stats and run daily by lesem-stats.timer.
# Output is a single self-contained HTML file served at /_stats/ behind HTTP
# basic auth. Cookieless by design: nothing is counted client-side.

set -eu

OUT_DIR=/var/www/lesem-stats
LOG=/var/log/nginx/lesem.access.log
WORK=$(mktemp)

trap 'rm -f "$WORK"' EXIT

# Current log plus the rotated daily files (logrotate keeps 14 days).
if [ -r "$LOG" ]; then
    cat "$LOG" >> "$WORK"
fi
if [ -r "$LOG.1" ]; then
    cat "$LOG.1" >> "$WORK"
fi
for rotated in "$LOG".*.gz; do
    if [ -r "$rotated" ]; then
        zcat "$rotated" >> "$WORK" || true
    fi
done

mkdir -p "$OUT_DIR"

goaccess "$WORK" \
    --log-format=COMBINED \
    --ignore-crawlers \
    --anonymize-ip \
    --html-report-title="lesem.info - navstevnost" \
    --output="$OUT_DIR/index.html"

chown -R www-data:www-data "$OUT_DIR"
chmod 755 "$OUT_DIR"
chmod 644 "$OUT_DIR/index.html"
