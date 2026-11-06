#!/usr/bin/env python3
"""Strip the retired Universal Analytics snippet from every mirrored page.

The UA property in the WordPress export (UA-141698760-1) has not collected
data since Universal Analytics shut down, so keeping the tag only costs a
third-party request on every page view. Idempotent: pages that no longer
carry the snippet are left untouched.
"""

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SKIP_DIRS = {".git", ".github", "_site"}

SNIPPET = (
    "<!-- Global site tag (gtag.js) - Google Analytics -->\n"
    '<script async src="https://www.googletagmanager.com/gtag/js?id=UA-141698760-1"></script>\n'
    "<script>\n"
    "  window.dataLayer = window.dataLayer || [];\n"
    "  function gtag(){dataLayer.push(arguments);}\n"
    "  gtag('js', new Date());\n"
    "\n"
    "  gtag('config', 'UA-141698760-1');\n"
    "</script>"
)


def html_files():
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            if name.endswith(".html"):
                yield os.path.join(dirpath, name)


def main():
    changed = 0
    for path in html_files():
        with open(path, encoding="utf-8") as f:
            html = f.read()
        if SNIPPET not in html:
            continue
        html = html.replace(SNIPPET, "", 1)
        assert "googletagmanager" not in html, path
        assert "UA-141698760" not in html, path
        with open(path, "w", encoding="utf-8") as f:
            f.write(html)
        changed += 1
    print(f"stripped the UA snippet from {changed} page(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
