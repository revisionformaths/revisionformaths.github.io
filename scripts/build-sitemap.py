#!/usr/bin/env python3
"""Write sitemap.xml listing the pages that ask to be indexed.

The site is a wall of cards rendered from a catalogue file, so a crawler
that only follows links sees two pages and stops. This enumerates every
address that is genuinely indexable: the wall, the local-files page, and
each game file under assets/games/ that does not opt out.

A game is left out when the word "noindex" appears anywhere in it, not just
in a <meta> in the head. Some of the files carry another game's markup
inside a script or a bundled payload, so the tag can reach the document by
a route this script cannot see. Leaving a page out costs one URL; listing a
page that then refuses to be indexed costs a warning in every webmaster
tool, so the rule errs towards leaving it out.

Deterministic: same files in, same bytes out. `tests/catalog.test.js`
recomputes the list and fails if the committed sitemap drifts.
"""

import os
import sys

SITE = "https://revisionformaths.github.io"
PAGES = [("", "1.0"), ("files.html", "0.8")]
GAMES = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "games")
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sitemap.xml")


def indexable_games():
    """Game files that do not mention noindex, in path order.

    Walks the whole folder, so the imported js13k entries are listed too.
    """
    names = []
    for root, _dirs, files in os.walk(GAMES):
        for name in sorted(files):
            if not name.lower().endswith((".html", ".htm")):
                continue
            full = os.path.join(root, name)
            with open(full, "rb") as handle:
                if b"noindex" in handle.read().lower():
                    continue
            names.append(os.path.relpath(full, GAMES).replace(os.sep, "/"))
    return sorted(names)


def urls():
    for page, priority in PAGES:
        yield SITE + "/" + page, priority
    for name in indexable_games():
        yield SITE + "/assets/games/" + name, "0.4"


def main():
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    count = 0
    for loc, priority in urls():
        lines.append("  <url>")
        lines.append("    <loc>" + loc + "</loc>")
        lines.append("    <priority>" + priority + "</priority>")
        lines.append("  </url>")
        count += 1
    lines.append("</urlset>")
    with open(OUT, "w", encoding="utf-8", newline="\n") as handle:
        handle.write("\n".join(lines) + "\n")
    print("sitemap.xml: %d URLs (%d game files)" % (count, count - len(PAGES)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
