#!/usr/bin/env python3
"""Pull single-file browser games into assets/games/ without anyone asking.

Source: the official js13kGames organisation on GitHub. Every entry is a repo
under https://github.com/js13kGames, one per submitted game, and every entry is
built to a 13 kB zip - so the average game is tens of kilobytes, and thousands
of them fit inside this repo's budget.

For each repo it:

  1. downloads the tarball from codeload (no API quota, no rate limit),
  2. finds the entry page (the shallowest index.html),
  3. inlines every script, stylesheet, image, font and sound it references,
  4. refuses the result unless nothing outside the file is still loaded,
  5. writes assets/games/js13k/<slug>.html plus a cover thumbnail,
  6. records title, year, author and repo in data/local-files.json.

Nothing is ever overwritten: a slug already in the list is skipped, so re-runs
only pick up what is new (a new jam year, or more of a backlog). Every run stops
at a file budget, so the site cannot grow past what GitHub Pages will serve.

    python3 scripts/import-js13k.py --limit 200
    python3 scripts/import-js13k.py --limit 4000 --max-minutes 50
    python3 scripts/import-js13k.py --dry-run
"""
import argparse
import base64
import hashlib
import io
import json
import mimetypes
import os
import re
import shutil
import sys
import tarfile
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "local-files.json"
GAMES = ROOT / "assets" / "games"
IMPORTED = GAMES / "js13k"
THUMBS = ROOT / "assets" / "img" / "pack"

ORG = "js13kGames"
DESC = re.compile(
    r"^(?P<title>.+?)\s+[\u2014\u2013-]\s+a js13kGames (?P<year>\d{4}) game by (?P<author>.+?)\.?$"
)

# Sizes. A game over this is not a 13 kB jam entry and is not wanted here.
MIN_FILE = 1024
MAX_FILE = 2 * 1024 * 1024
MAX_TARBALL = 20 * 1024 * 1024

# Anything a page can pull in. After inlining there must be none of these left
# pointing off-origin, or the file is not offline-safe and is dropped.
RESOURCE_ATTR = re.compile(
    r"""(?:src|href|poster|data)\s*=\s*["']([^"']+)["']""", re.IGNORECASE
)
CSS_URL = re.compile(r"""url\(\s*["']?([^"')]+)["']?\s*\)""", re.IGNORECASE)
IMPORT_CSS = re.compile(r"""@import\s+(?:url\(\s*)?["']([^"']+)["']""", re.IGNORECASE)


def log(message):
    print(message, flush=True)


# --------------------------------------------------------------------------- #
# GitHub                                                                       #
# --------------------------------------------------------------------------- #

def token():
    value = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if value:
        return value.strip()
    try:
        import subprocess

        return subprocess.run(
            ["gh", "auth", "token"], capture_output=True, text=True, timeout=20
        ).stdout.strip()
    except Exception:
        return ""


def api(url, bearer):
    request = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json"})
    if bearer:
        request.add_header("Authorization", "Bearer " + bearer)
    request.add_header("User-Agent", "classroom-importer")
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def list_repos(bearer):
    """Every public repo in the org, oldest listing order first."""
    repos, page = [], 1
    while True:
        batch = api(f"https://api.github.com/orgs/{ORG}/repos?per_page=100&page={page}", bearer)
        if not batch:
            return repos
        repos.extend(batch)
        page += 1


def tarball(repo):
    url = f"https://codeload.github.com/{ORG}/{repo}/tar.gz/HEAD"
    request = urllib.request.Request(url, headers={"User-Agent": "classroom-importer"})
    with urllib.request.urlopen(request, timeout=120) as response:
        raw = response.read(MAX_TARBALL + 1)
    if len(raw) > MAX_TARBALL:
        raise ValueError("tarball over %d bytes" % MAX_TARBALL)
    return raw


# --------------------------------------------------------------------------- #
# Inlining                                                                     #
# --------------------------------------------------------------------------- #

SKIP_DIRS = {"node_modules", "test", "tests", ".git", ".github", ".website"}
DOC_NAMES = {"readme.html", "404.html", "licence.html", "license.html", "index_old.html"}


def entry_page(root):
    """The page a jam entry is played from.

    Usually index.html at the top of the repo, but plenty of entries keep it in
    demo/, dist/, build/ or public/, and a few use index.htm. Take the
    shallowest one that is not documentation.
    """
    candidates = []
    for path in root.rglob("*"):
        if path.suffix.lower() not in (".html", ".htm") or not path.is_file():
            continue
        if set(path.relative_to(root).parts) & SKIP_DIRS:
            continue
        if path.name.lower() in DOC_NAMES:
            continue
        score = (
            0 if path.name.lower().startswith("index") else 1,
            len(path.relative_to(root).parts),
            len(str(path)),
        )
        candidates.append((score, path))
    if not candidates:
        return None
    candidates.sort(key=lambda item: item[0])
    return candidates[0][1]


def sniff(path, raw):
    kind = mimetypes.guess_type(path)[0] or "application/octet-stream"
    if kind == "text/javascript" or kind == "application/javascript":
        return "text/javascript"
    return kind


def data_uri(path, raw):
    return "data:%s;base64,%s" % (sniff(path, raw), base64.b64encode(raw).decode("ascii"))


class Bundle:
    """One game directory, turned into one self-contained HTML document."""

    def __init__(self, base):
        self.base = base
        self.used = set()

    def read(self, ref):
        clean = ref.split("?")[0].split("#")[0].strip()
        if not clean or clean.startswith(("data:", "http:", "https:", "//", "#", "mailto:")):
            return None
        path = (self.base / clean.lstrip("/")).resolve()
        try:
            path.relative_to(self.base.resolve())
        except ValueError:
            return None  # escapes the game folder
        if not path.is_file():
            # Entries often reference an asset from the wrong depth, or from a
            # path that only existed on the author's disk. Look for the same
            # filename elsewhere in the folder before dropping the game.
            wanted = Path(clean).name
            if not wanted:
                return None
            matches = sorted(
                (p for p in self.base.rglob(wanted) if p.is_file()),
                key=lambda p: (len(p.parts), len(str(p))),
            )
            if not matches:
                return None
            path = matches[0]
        self.used.add(path)
        relative = path.relative_to(self.base)
        return str(relative), path.read_bytes()

    # -- pieces ------------------------------------------------------------- #

    def script(self, match):
        attrs, ref = match.group(1), match.group(2)
        got = self.read(ref)
        if got is None:
            return match.group(0)
        _, raw = got
        body = raw.decode("utf-8", "replace").replace("</script", "<\\/script")
        return "<script%s>%s</script>" % (attrs, body)

    def stylesheet(self, match):
        got = self.read(match.group(1))
        if got is None:
            return ""
        name, raw = got
        css = self.css_text(name, raw)
        return "<style>%s</style>" % css

    def css_text(self, name, raw):
        text = raw.decode("utf-8", "replace")

        def rewrite(match):
            ref = match.group(1)
            got = self.read(os.path.join(os.path.dirname(name), ref)) or self.read(ref)
            if got is None:
                return match.group(0)
            return "url(%s)" % data_uri(*got)

        return CSS_URL.sub(rewrite, text)

    def asset(self, match):
        name, value = match.group(1), match.group(2)
        got = self.read(value)
        if got is None:
            return match.group(0)
        return '%s="%s"' % (name, data_uri(*got))

    # -- whole document ----------------------------------------------------- #

    def build(self, entry):
        html = entry.read_text(encoding="utf-8", errors="replace")

        # A <base> would re-root every relative URL we are about to remove.
        html = re.sub(r"<base\b[^>]*>", "", html, flags=re.IGNORECASE)

        html = re.sub(
            r"""<script([^>]*?)\ssrc\s*=\s*["']([^"']+)["']([^>]*)>\s*</script>""",
            self.script,
            html,
            flags=re.IGNORECASE,
        )
        html = re.sub(
            r"""<link([^>]*?)href\s*=\s*["']([^"']+)["']([^>]*)>""",
            lambda m: self.stylesheet_dispatch(m),
            html,
            flags=re.IGNORECASE,
        )
        html = re.sub(r"""(src|href|poster)\s*=\s*["']([^"']+)["']""", self.asset, html, flags=re.IGNORECASE)
        html = re.sub(r"""url\(\s*["']?([^"')]+)["']?\s*\)""", lambda m: self.css_url_inline(m), html)
        return html

    def stylesheet_dispatch(self, match):
        tag = match.group(0)
        kind = tag.lower()
        if "stylesheet" not in kind:
            # A per-game favicon or preload hint adds nothing here and a
            # missing one must not cost a working game.
            if any(word in kind for word in ("icon", "preload", "prefetch", "manifest", "apple-touch")):
                return ""
            return tag
        href = match.group(2)
        got = self.read(href)
        if got is None:
            return "" if href.startswith("http") is False else tag
        name, raw = got
        return "<style>%s</style>" % self.css_text(name, raw)

    def css_url_inline(self, match):
        got = self.read(match.group(1))
        if got is None:
            return match.group(0)
        return "url(%s)" % data_uri(*got)


OFFSITE = re.compile(r"""^(?:[a-z][a-z0-9+.-]*:)?//""", re.IGNORECASE)
STYLE_BLOCK = re.compile(r"<style[^>]*>(.*?)</style>", re.IGNORECASE | re.DOTALL)
STYLE_ATTR = re.compile(r"""style\s*=\s*["']([^"']*)["']""", re.IGNORECASE)


def style_fetches(html):
    """Every url() the browser would fetch from CSS, and nothing from JS.

    Reading the whole document for `url(` caught template strings such as
    `${atlasUrl(COLORS[0])}`, which rejected good games. Only <style> blocks
    and style attributes are CSS; the rest is code.
    """
    chunks = STYLE_BLOCK.findall(html) + STYLE_ATTR.findall(html)
    found = []
    for chunk in chunks:
        for pattern in (CSS_URL, IMPORT_CSS):
            for match in pattern.finditer(chunk):
                value = match.group(1).strip()
                if value and not value.startswith("data:"):
                    found.append(value)
    return found


def leftovers(html):
    """Anything the finished file would still fetch from disk or off-origin."""
    bad = []
    for match in RESOURCE_ATTR.finditer(html):
        value = match.group(1).strip()
        if not value or value.startswith(("data:", "#", "mailto:", "javascript:")):
            continue
        bad.append(value)
    bad.extend(value for value in style_fetches(html) if not OFFSITE.match(value))
    return sorted(set(bad))


def remote_loads(html):
    """Hosts still loaded by the document, ignoring plain links and text."""
    hosts = set()
    for match in RESOURCE_ATTR.finditer(html):
        value = match.group(1).strip()
        if OFFSITE.match(value):
            hosts.add(value.split("/")[2] if "//" in value else value)
    for value in style_fetches(html):
        if OFFSITE.match(value):
            hosts.add(value.split("/")[2] if "//" in value else value)
    return sorted(hosts)


META_REFRESH = re.compile(
    r"""<meta[^>]+http-equiv\s*=\s*["']?refresh["']?[^>]*content\s*=\s*["'][^"']*https?://""",
    re.IGNORECASE,
)


# An ES module that imports "./level.js" cannot be flattened into one file:
# the specifier is static and the sibling is not there. Such an entry is
# dropped rather than shipped as a card that loads nothing.
RELATIVE_MODULE = re.compile(
    r"""(?:^|[\s;])(?:import|export)\s[^;\n]*?from\s*["']([^"']+)["']"""
    r"""|import\s*\(\s*["']([^"']+)["']""",
    re.MULTILINE,
)


def stray_modules(html):
    refs = []
    for match in RELATIVE_MODULE.finditer(html):
        spec = (match.group(1) or match.group(2) or "").strip()
        if spec.startswith(("./", "../", "/")):
            refs.append(spec)
    return refs


def looks_like_a_game(html):
    """A redirect stub is not a game: it has to draw, or run its own code."""
    if META_REFRESH.search(html):
        return False
    body = html.lower()
    if "<canvas" in body or "<svg" in body:
        return True
    return "<script" in body and len(html) > 2000


# --------------------------------------------------------------------------- #
# Import                                                                       #
# --------------------------------------------------------------------------- #

def slug_of(repo):
    return re.sub(r"[^a-z0-9-]+", "-", repo.lower()).strip("-")


def pretty(name):
    return " ".join(word.capitalize() if word.islower() else word for word in name.split("-"))


def parse(description, repo):
    match = DESC.match(description or "")
    if not match:
        return None
    return {
        "title": match.group("title").strip(),
        "year": int(match.group("year")),
        "author": match.group("author").strip(),
    }


def safe_extract_zip(archive, into):
    import zipfile

    with zipfile.ZipFile(archive) as bundle:
        for member in bundle.infolist():
            target = (into / member.filename).resolve()
            if not str(target).startswith(str(into.resolve())):
                raise ValueError("unsafe path in game.zip")
        bundle.extractall(into)  # noqa: S202 - members checked above


def game_roots(base, tmp):
    """The places a finished game might be, best first.

    `.website/game.zip` is the entry as it was submitted to the jam: 13 kB of
    already-built, usually single-file game. Plenty of repos keep a one-line
    redirect in index.html and the real thing in that zip, so it is tried
    before the working tree.
    """
    archive = base / ".website" / "game.zip"
    if archive.is_file():
        into = tmp / "zip"
        into.mkdir(exist_ok=True)
        try:
            safe_extract_zip(archive, into)
            yield "game.zip", into
        except Exception:  # noqa: BLE001
            pass
    yield "tree", base


def build_from(where):
    entry = entry_page(where)
    if entry is None:
        raise ValueError("no page to open")
    return Bundle(entry.parent).build(entry)


def check(html):
    """Raise with the reason a candidate is no good; return bytes if it is."""
    left = leftovers(html)
    if left:
        raise ValueError("still loads %d file(s): %s" % (len(left), ", ".join(left[:3])))
    modules = stray_modules(html)
    if modules:
        raise ValueError("imports a sibling module: %s" % ", ".join(modules[:2]))
    remote = remote_loads(html)
    if remote:
        raise ValueError("loads off-site: %s" % ", ".join(remote[:3]))
    blob = html.encode("utf-8")
    if len(blob) < MIN_FILE:
        raise ValueError("only %d bytes - a stub" % len(blob))
    if len(blob) > MAX_FILE:
        raise ValueError("%d bytes after inlining" % len(blob))
    if not looks_like_a_game(html):
        raise ValueError("nothing that draws")
    return blob


def import_one(repo, meta, tmp):
    """Return (html_bytes, thumb_bytes) or raise with the reason it was dropped."""
    raw = tarball(repo["name"])
    with tarfile.open(fileobj=io.BytesIO(raw), mode="r:gz") as tar:
        for member in tar.getmembers():
            if not member.isfile():
                continue
            target = (tmp / member.name).resolve()
            if not str(target).startswith(str(tmp.resolve())):
                raise ValueError("unsafe path in tarball")
        tar.extractall(tmp)  # noqa: S202 - members checked above

    roots = [p for p in tmp.iterdir() if p.is_dir()]
    if not roots:
        raise ValueError("empty tarball")
    base = roots[0]

    blob, reason = None, "nothing usable"
    for label, where in game_roots(base, tmp):
        try:
            blob = check(build_from(where))
            break
        except ValueError as error:
            reason = "%s: %s" % (label, error)
    if blob is None:
        raise ValueError(reason)

    thumb = b""
    for name in ("cover.jpg", "thumbnail.jpg", "cover.png", "thumbnail.png"):
        candidate = base / ".website" / name
        if candidate.is_file():
            thumb = candidate.read_bytes()
            break

    return blob, thumb


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=200, help="new files to add in this run")
    parser.add_argument("--workers", type=int, default=12, help="parallel downloads")
    parser.add_argument("--budget-mb", type=int, default=750, help="stop when assets/games reaches this")
    parser.add_argument("--max-minutes", type=float, default=50, help="wall clock guard")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--only", default="", help="comma separated repo names")
    args = parser.parse_args(argv)

    started = time.time()
    data = json.loads(DATA.read_text(encoding="utf-8"))
    known = {entry["file"] for entry in data["entries"]}
    basenames = {Path(entry["file"]).stem for entry in data["entries"]}
    hashes = {entry.get("sha") for entry in data["entries"] if entry.get("sha")}

    def spent():
        return sum(p.stat().st_size for p in GAMES.rglob("*") if p.is_file())

    budget = args.budget_mb * 1024 * 1024
    current = spent()
    log("assets/games is %.0f MB of a %d MB budget" % (current / 1048576, args.budget_mb))

    bearer = token()
    try:
        repos = list_repos(bearer)
    except Exception as error:  # noqa: BLE001
        log("cannot list repos: %s" % error)
        return 1
    log("org has %d repos" % len(repos))

    if args.only:
        wanted = {s.strip() for s in args.only.split(",")}
        repos = [r for r in repos if r["name"] in wanted]

    added = skipped = failed = 0
    IMPORTED.mkdir(parents=True, exist_ok=True)
    THUMBS.mkdir(parents=True, exist_ok=True)

    # The work is almost all network wait, so fetch and inline in parallel and
    # keep every write on the main thread. Order is oldest-first so the backlog
    # drains predictably and a re-run resumes where the last one stopped.
    queue = []
    for repo in sorted(repos, key=lambda r: (r.get("pushed_at") or "", r["name"])):
        meta = parse(repo.get("description"), repo["name"])
        if not meta:
            skipped += 1
            continue
        slug = slug_of(repo["name"])
        if "assets/games/js13k/%s.html" % slug in known:
            skipped += 1
            continue
        # Screenshots live in one flat folder and recent-play keys are the
        # basename, so a slug already used by a pack file must not be reused.
        if slug in basenames:
            skipped += 1
            continue
        queue.append((repo, meta))
    log("%d repos are new games to consider" % len(queue))

    def work(job):
        repo, meta = job
        tmp = Path(tempfile.mkdtemp(prefix="js13k-"))
        try:
            blob, thumb = import_one(repo, meta, tmp)
            return repo, meta, blob, thumb, None
        except urllib.error.HTTPError as error:
            return repo, meta, None, b"", "http %s" % error.code
        except Exception as error:  # noqa: BLE001
            return repo, meta, None, b"", str(error)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    from concurrent.futures import ThreadPoolExecutor, as_completed

    stop = False
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        pending = {pool.submit(work, job): job for job in queue[: args.limit * 3]}
        for future in as_completed(pending):
            if stop:
                for other in pending:
                    other.cancel()
                break
            repo, meta, blob, thumb, error = future.result()
            if error:
                failed += 1
                log("- %-38s %s" % (repo["name"], error))
                continue
            digest = hashlib.sha256(blob).hexdigest()
            if digest in hashes:
                skipped += 1
                continue
            slug = slug_of(repo["name"])
            if slug in basenames and "assets/games/js13k/%s.html" % slug not in known:
                skipped += 1
                continue
            rel = "assets/games/js13k/%s.html" % slug
            if args.dry_run:
                log("would add %-38s %6d bytes  %s (%d)" % (slug, len(blob), meta["title"], meta["year"]))
            else:
                target = ROOT / rel
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(blob)
                if thumb:
                    (THUMBS / (slug + ".jpg")).write_bytes(thumb)
                data["entries"].append(
                    {
                        "file": rel,
                        "title": meta["title"],
                        "line": "js13k %d \u00b7 by %s" % (meta["year"], meta["author"]),
                        "sha": digest,
                        "source": {
                            "kind": "js13k",
                            "year": meta["year"],
                            "author": meta["author"],
                            "repo": "https://github.com/%s/%s" % (ORG, repo["name"]),
                        },
                    }
                )
                log("+ %-38s %6d bytes  %s (%d)" % (slug, len(blob), meta["title"], meta["year"]))
            hashes.add(digest)
            known.add(rel)
            basenames.add(slug)
            current += len(blob) + len(thumb)
            added += 1
            if added >= args.limit:
                log("hit the per-run limit of %d" % args.limit)
                stop = True
            elif current >= budget:
                log("hit the %d MB budget" % args.budget_mb)
                stop = True
            elif (time.time() - started) / 60 >= args.max_minutes:
                log("hit the %g minute guard" % args.max_minutes)
                stop = True

    if added and not args.dry_run:
        # Keep the hand-picked order the pack arrived in at the front of the
        # page; the imported ones follow, alphabetical.
        pack = [e for e in data["entries"] if not e["file"].startswith("assets/games/js13k/")]
        imported = sorted(
            (e for e in data["entries"] if e["file"].startswith("assets/games/js13k/")),
            key=lambda e: e["title"].lower(),
        )
        data["entries"] = pack + imported
        DATA.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        log("data/local-files.json now holds %d entries" % len(data["entries"]))

    log("added %d, skipped %d, failed %d, %.0f MB used" % (added, skipped, failed, current / 1048576))
    return 0


if __name__ == "__main__":
    sys.exit(main())
