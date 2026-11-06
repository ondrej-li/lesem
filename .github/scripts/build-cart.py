#!/usr/bin/env python3
"""Wire the client-side basket into every page of the static export.

Adds, once per HTML file:
  * wp-content/cart/cart.css?v=<hash>  (in <head>)
  * wp-content/cart/cart.js?v=<hash>   (before </body>)

Links are document-relative, so the site works both at a domain root and
under a GitHub Pages sub-path. The query is a content hash: the deployment
caches CSS/JS for a week, so without it a cart update would not reach
returning visitors.

The script is idempotent and rewrites existing tags when the hash changes.

Usage: build-cart.py [root]        (root defaults to the repository)
"""
import hashlib
import os
import re
import sys

CSS_TAG = re.compile(r'<link[^>]*href="[^"]*wp-content/cart/cart\.css(?:\?[^"]*)?"[^>]*>')
JS_TAG = re.compile(r'<script[^>]*src="[^"]*wp-content/cart/cart\.js(?:\?[^"]*)?"[^>]*></script>')


def asset_version(root):
    digest = hashlib.sha1()
    for name in ("cart.css", "cart.js"):
        with open(os.path.join(root, "wp-content", "cart", name), "rb") as fh:
            digest.update(fh.read())
    return digest.hexdigest()[:10]


def rel_prefix(rel_path):
    return "../" * rel_path.count("/")


def wire(path, root, version):
    rel = os.path.relpath(path, root).replace(os.sep, "/")
    prefix = rel_prefix(rel)
    with open(path, encoding="utf-8", errors="surrogateescape") as fh:
        html = fh.read()
    original = html

    css = '<link rel="stylesheet" href="%swp-content/cart/cart.css?v=%s" />' % (prefix, version)
    js = '<script src="%swp-content/cart/cart.js?v=%s" defer></script>' % (prefix, version)

    if CSS_TAG.search(html):
        html = CSS_TAG.sub(lambda m: css, html, count=1)
    elif "</head>" in html:
        html = html.replace("</head>", css + "\n</head>", 1)

    if JS_TAG.search(html):
        html = JS_TAG.sub(lambda m: js, html, count=1)
    elif "</body>" in html:
        html = html.replace("</body>", js + "\n</body>", 1)

    if html != original:
        with open(path, "w", encoding="utf-8", errors="surrogateescape") as fh:
            fh.write(html)
        return True
    return False


def main():
    root = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else ".")
    version = asset_version(root)
    changed = total = 0
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in (".git", ".github", "_site")]
        for name in filenames:
            if name.lower().endswith((".html", ".htm")):
                total += 1
                if wire(os.path.join(dirpath, name), root, version):
                    changed += 1
    print(f"cart wired into {changed} of {total} pages (v={version})")


if __name__ == "__main__":
    main()
