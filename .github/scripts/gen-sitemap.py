#!/usr/bin/env python3
"""Regenerate robots.txt and sitemap.xml from the mirrored pages.

The original site had Yoast generating both; the static copy has to ship them
as files. Run after adding or renaming pages.
"""

import datetime
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SKIP_DIRS = {".git", ".github", "_site"}
SKIP_FILES = {"404.html"}
BASE = "https://www.lesem.info"

ROBOTS = """User-agent: *
Allow: /
Disallow: /_stats/

Sitemap: {base}/sitemap.xml
""".format(base=BASE)


def page_url(rel_path):
    rel = rel_path.replace(os.sep, "/")
    if rel == "index.html":
        return BASE + "/"
    if rel.endswith("/index.html"):
        return f"{BASE}/{rel[:-len('index.html')]}"
    return f"{BASE}/{rel}"


def main():
    pages = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            if not name.endswith(".html") or name in SKIP_FILES:
                continue
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, ROOT)
            stamp = datetime.datetime.fromtimestamp(
                os.path.getmtime(full), datetime.timezone.utc
            ).strftime("%Y-%m-%dT%H:%M:%S+00:00")
            pages.append((page_url(rel), stamp))

    pages.sort()
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for url, stamp in pages:
        lines.append(f"  <url><loc>{url}</loc><lastmod>{stamp}</lastmod></url>")
    lines.append("</urlset>")

    with open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    with open(os.path.join(ROOT, "robots.txt"), "w", encoding="utf-8") as f:
        f.write(ROBOTS.format(base=BASE))
    print(f"sitemap.xml: {len(pages)} URLs; robots.txt written")
    return 0


if __name__ == "__main__":
    sys.exit(main())
