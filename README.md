# Classroom

**Hundreds of G@M£$ that keep playing when the network does not.** They are
plain HTML files served from this repository, so there is no embed, no player
to load and no third party that can refuse a frame — with the wi-fi off, they
still open. Behind that is a wall of 17,572 publisher titles, each of which
opens on the publisher's own site.

The tab reads **Classroom** with a chalkboard icon, and the page is a plain
grid of playable titles.

**Live:** https://socks275.github.io/ClassroomGames/

## Local HTML G@M£$ and search

The main search includes publisher titles, the **129 pack files** and every
imported file.
Local versions have an **(HTML)** suffix and open the bundled file rather than
an external publisher. **100% Unblocked** links to `files.html`, whose search
only filters local G@M£$. Both pages use `assets/js/local-games.js` as their
shared list; add a G@M£$ there, its file under `assets/games/`, and its card
screenshot under `assets/img/pack/`.

**Minecraft is no longer bundled.** It was a 76 MB single file — more than
every other local title put together — so it plays from a browser build of the
G@M£$ online again, through two routes in `scripts/extras.py`: a self-contained
EaglercraftX file on
[johntherriiiippper.github.io](https://johntherriiiippper.github.io/eaglercraftx.html)
and a maintained build at
[eaglercraft.q13x.com](https://eaglercraft.q13x.com/1.8.8_2/js/?retina=true).
It needs the network, unlike anything under `assets/games/`. Nothing is marked `featured` in the local list now; the flag
still works (it makes a title lead the local page and its own search) but no
title uses it.

The heaviest titles have been removed to buy back hosting headroom: **Slope**
(25 MB), **Plants vs Zombies** (21 MB), Minecraft (76 MB), and the latest cuts —
**Vex 4, 5, 6 and X3M** (47.5 MB), **Angry Birds**, **Happy Wheels**, **Snail
Bob**, **Basketball Stars** and **Time Shooter 3**. The folder is **129 local
G@M£$** and Minecraft streams instead. The G@M£$ pages total **541,796,666
bytes**, the three runtimes they share add **14,281,181**, and the 900 MiB test
budget leaves **387,640,553 bytes** — about **370 MiB** for another title. The
analytics beacons that shipped with some pack pages have been stripped;
gameplay and assets remain intact.

### One runtime, not twenty-six

The pack exports every Flash title as a self-contained page, so 26 of them each
carried a copy of the same Ruffle distribution: **157 MB of base64 standing in
for 13.6 MB of files**. `scripts/share-runtime.py` finds a payload that appears
in more than one page, writes it once to `assets/vendor/ruffle/`, and repoints
those pages at the shared copy. Each page still carries its own `.swf` and its
own loader; only the bytes that were identical now come from one URL. Saving
one of those G@M£$ for offline play brings the shared file with it (see
`sw.js`), and the checks in `tests/catalog.test.js` stop the duplication coming
back. Net effect: the folder went from 674 MB to 530 MB.

The latest batch is **6 more titles** from the same pack, at revision
`5dbfcd7a6e788101a8acab50a6cf1af209938641`: **Parking Fury 2**
and **3**, **Dadish 2**, **3D Free Kick**, **Idle Dice** and **Agar.io Lite**.
Two that were copied and then removed for the size ceiling are **Awesome
Tanks** and **Moto X3M 2**, and one for the ad rule: **12 Mini Battles** loads
an SDK from `ixl.com.net`, a look-alike domain, even though its page paints.

The latest large batch was **46 more titles** from the same pack, at revision
`5dbfcd7a6e788101a8acab50a6cf1af209938641`. The sequels and
series the folder was missing: **Fireboy & Watergirl 2, 3 and 4**, **Bloons TD
2, 3 and 4**, **World's Hardest Game** with **2** and **3**, **Riddle School**
and **2**, **Vex 4, 5, 6** and **Vex X3M**, **Duck Life**, **Snail Bob**, **Moto
X3M Winter**, **Run 2**, **Bob the Robber 2**, **Earn to Die**, **Flood Runner
2**, **Free Rider 3**, **Dadish 3**, **Learn to Fly** and **Papa's Pizzeria**.
The heavy names bundled at the time: **Angry Birds** and **Happy Wheels**
(both since removed), **Among Us**, **Age of War**, **Super Mario 64** and
**Retro Bowl College**. **Plants vs Zombies** and **Slope** were bundled too and
then removed again for size. The rest are the small classics that fit what the size
budget leaves: **Bloxorz**, **Tag**, **Bad Ice Cream**, **Space is Key**, **This
is The Only Level**, **8 Ball Classic**, **1 on 1 Tennis**, **Helix Jump**,
**Hill Climb Racing Lite**, **Pou** and **Breaking the Bank**.

Earlier additions were **Basket Random** (one-button basketball), **Jumping
Shell** (puzzle platforming) and **Fireblob** (ice-melting platforming), all
three loaded in Chromium with external HTTP requests blocked and no JavaScript
page errors. The 46 new files were screened the way described under *Picking
which of the 352 to ship* — every one carries its own assets and none of them
asks a server for its engine — and the browser check runs in CI. Neither kind
of check guarantees that every level is bug-free or that a school's filter
permits this site's domain.

## The catalogue

Three feeds plus a short hand-written list, merged into one wall by title:

| source | titles | embed host |
| --- | --- | --- |
| GameMonetize's public feed | ~15,800 | `html5.gamemonetize.co` (+ `gamemonetize.com` wrapper) |
| HTMLGames' public embed index | 1,244 | `cdn.htmlgames.com` |
| MadKidGames sitemap | 508 | `www.madkidgames.com` |
| `scripts/extras.py`, by hand | 0 | — (currently empty) |

Routes are chosen **one per domain**, so a block on one host never takes the
backup with it. That is why `html5.gamemonetize.co` and `gamemonetize.com` are
not both listed for the same title unless a second domain exists.

The player only ever frames a file from **this** repository. A publisher title
is handed to the publisher: one click on a real anchor, `target="_blank"` with
`rel="noopener noreferrer"`, so it opens in its own tab, gets no handle on this
page and no referrer. Nothing of a publisher's — page, script, ad or tracker —
is ever loaded inside this site, which is also what lets the security policy
name `'self'` as the only frame source.

That replaced a per-portal fallback queue: several routes per tile, tried in
order, a route that failed in the frame moved to the back for that device, and
a panel explaining the publisher that refused. The queue still exists for
bundled files, but every one of those has a single, local source, so in
practice the frame either loads in a blink or it is a broken file on disk.

Every title appears once. A tile only carries more than one source when the
same G@M£$ exists on more than one portal, and the extra sources are never shown
as separate tiles — the player offers the next one when the route above refuses
to load.

### MadKidGames embeds

All **508 MadKidGames sources** are enabled for in-page play using
`https://www.madkidgames.com/full/<slug>`, matching the count advertised on
[their HTML5 catalogue](https://www.madkidgames.com/html5-games). Existing G@M£$,
local files, metadata and alternate sources are preserved. The scheduled
catalogue builder continues importing the full MadKidGames sitemap and marks
these sources embeddable on future refreshes.

**Publisher setup required:** MadKidGames' G@M£$-page “Ads.txt Requirement” says
website owners must copy the supplied ads.txt entries to their site's root
`ads.txt`, then email their domain to **admin@madkidgames.com** for approval.
Use their current entries; do not invent publisher IDs or copy unrelated
entries from the portal's own ads.txt. This repository does not yet contain
those entries or evidence of domain approval. Their player may show
“Embedding unavailable” until setup is complete. Preview domains may need
separate approval. The existing new-tab fallback remains available.

The catalogue and player are tested locally; live playback of all 508 G@M£$
has not been verified from an approved deployment.

### Titles no feed carries

`scripts/extras.py` is a list of G@M£$ added by hand. They go through the same
grouping and sorting as a feed, so an extra can never appear twice and a portal
that later starts carrying the same title just becomes a second route on the
same tile. Four keys are special: `id` names the tile slug, `pin` keeps it
above the most-played on every sort, `priority` decides which of several
routes for one title is tried first, and `exclusive` refuses a feed copy — a
different G@M£$ that happens to own the same title is not a fallback.

There is one hand-added title: **Minecraft**, with two routes. The obvious
host, `eaglercraft.com/play`, answers `X-Frame-Options: DENY` (checked 20
October 2026). The first route is a single-file EaglercraftX build on GitHub
Pages, the second a maintained 1.8.8 u53 distribution in case the personal page
disappears. Both are publisher routes now: the tile opens the build in its own
tab rather than asking it to be framed. (The player's iframe still asks for
`pointer-lock` for the bundled files — Flashtorio and the rest — where
mouse-look would be dead without it.)

### Why not hundreds of portals

Most portals do not publish a keyless embed feed, and the ones that do guard it
hard:

- **GameMonetize** — public JSON feed, embeddable. Used.
- **MadKidGames** — full sitemap; the pages sit behind a bot wall, so they are
  offered as routes but cannot be verified from CI.
- **KBH Games** — sitemap readable, pages behind Cloudflare's bot challenge.
- **HTMLGames** — public JSON index, free embedding, own CDN. Used.
- **GamePix** — `/embed/` answers 403 to a foreign referrer. Needs a key.
- **GameDistribution** — 19,000 G@M£$ and a clean player, but it serves
  `blocked.html?unregistered=true` to any domain that has not registered with
  them. One free dashboard signup would unlock it.
- **GamePix, Gameflare, CrazyGames, Poki, Y8** — no keyless feed, or a 404
  sitemap; they need a partner key or an approved domain.

So the catalogue grows through the one portal that actually allows embedding,
not through a list of names that would each need an integration agreement.

### Keeping it current

`.github/workflows/catalog.yml` runs `scripts/build-catalog.py` on GitHub's
runners, which have real network access. It pages through the GameMonetize
feed (paced, because Cloudflare rate-limits at a thousand requests or so),
re-reads the MadKidGames sitemap, merges duplicates by a normalised title
(stop-words and punctuation stripped, `&` read as "and"), and rewrites
`assets/js/catalog.js`.

The builder refuses to write a catalogue that is smaller than the one already
in place, so a bad feed day cannot wipe the wall. It also drops generative-AI
titles and a short blocklist of gambling titles (casino, slots, poker). AI-titled
G@M£$ are no longer excluded — an earlier rule did that, and it has been removed.

## Getting the link out

Most visits start with a link somebody pasted, which means two things: the
link needs a preview worth clicking, and it needs to say where it came from.
`index.html` and `files.html` are indexable (`index,follow`) and named in
`sitemap.xml`, so a search can also send people here; the error page keeps
`noindex,nofollow`, because a 404 has nothing worth ranking.

### Link previews

Both `index.html` and `files.html` carry `og:title`, `og:description`,
`og:image`, `og:url` and a `twitter:card`, so a pasted link renders as a card
with the 1200×630 `assets/img/share/og-cover.png` instead of a bare URL. Each page
also carries a `rel="canonical"` matching its `og:url`, so the `?ref=` variants
below are folded into one address. The image URLs are absolute
and point at `https://funclassroom.github.io/`, so **if the site is served from
another domain, change those three `og:image` / `og:url` values** or the
preview will 404.

### Telling the channels apart

Clarity counts sessions; it does not say where they came from. Add `?ref=` to
any link you post and `assets/js/attribution.js` reads it, hands it to Clarity
as a custom tag called `channel`, and keeps it in `sessionStorage` so a visit
that starts on the wall and moves on to `files.html` stays credited to the same
channel. In the Clarity dashboard, break the recording list down by the
`channel` tag.

Post these, not the bare URL:

| Where | Link |
| --- | --- |
| Discord | `https://funclassroom.github.io/?ref=discord` |
| TikTok | `https://funclassroom.github.io/?ref=tiktok` |
| YouTube (description) | `https://funclassroom.github.io/?ref=youtube` |
| Reddit | `https://funclassroom.github.io/?ref=reddit` |
| GitHub repo | `https://funclassroom.github.io/?ref=github` |
| QR code in a classroom | `https://funclassroom.github.io/?ref=qr` |
| A friend, one to one | `https://funclassroom.github.io/?ref=wordofmouth` |

`?utm_source=` works the same way if a tag is forced on you, and the value is
lowercased and stripped to `[a-z0-9_-]` before it is used. The offline G@M£$
page takes the same parameters:
`https://funclassroom.github.io/files.html?ref=tiktok`.

## Progress and saves

Two different kinds of progress exist, and it is worth knowing which is which.

**What this site stores** — in this browser, under `classroom.state.v1`:

- titles you saved
- the last eight you opened, with timestamps and visit counts
- your sort choice, display preferences, and how far down the wall you had scrolled
- a "Pick up where you left off" card built from that history

Saved picks, history and preferences are not uploaded and there is no account.
The site pages load Microsoft Clarity for visit and session analytics; the
bundled HTML G@M£$ files carry no analytics tag. **Export my data** creates a
JSON file locally; **Import data** restores it in this browser. The footer has
a two-step **Clear saved data** button. The separate **Clear offline
downloads** action removes downloaded G@M£$ files from Cache Storage.

**The local files** save wherever their own code decides, which for most of
them is this browser's `localStorage` under the site's own origin. They are not
wrapped in anything that sends data anywhere.

**What the titles store themselves** — each frame loads from its publisher, so
its own save files (levels, coins, unlocked cars) live in
that publisher's storage, tied to this site. They survive a reload, a closed
tab and a new visit from the same browser. They do not follow you to another
device or another browser, and a private window throws them away when it closes.
If a title only keeps state in memory, nothing can save it — that is down to the
G@M£$.

### Installing PostHog

Microsoft Clarity is the site's analytics again. Adding PostHog alongside it is
a separate job: run the wizard from a real terminal — it draws a full-screen
interface, signs you in through the browser and cannot run inside CI, a
container or the agent sandbox:

```bash
npm run posthog          # npx -y @posthog/wizard@latest
```

It detects this as **JavaScript (Web)**, then asks about region — pick **EU** —
and installs its own snippet with a real project key. Let it edit the files but
read the diff before accepting the commit: it writes into `index.html`,
`files.html` and `404.html`, and the checks in `tests/catalog.test.js` pin the
loader, the masking settings and the identical copy in all three heads.

Two things to decide before it runs: whether to keep `respect_dnt` and the
masking (`mask_all_text`, `mask_all_element_attributes` — children search this
page, and their words should not turn up in a replay), and who owns the
`channel` tag. Clarity reads it today through `attribution.js`; if both tools
are in, decide whether `?ref=` should feed both or only one.

The wizard sends source files to an AI model to do the work, keeps `.env*` and
secrets on your machine, and reports its own run metadata unless you pass
`--no-telemetry`. If the result is not what you want, `git checkout -- .` puts
the files back.

## The page

- Search titles and descriptions (multi-word: "car park" finds "Car Parking"), plus Popular / Top rated / A–Z / Least played
- Availability filters for offline files, in-page titles, and new-tab-only titles; G@M£$-type filters for action, puzzle, racing, sports, strategy and arcade
- Display options for dark mode, larger text and high contrast; reduced-motion follows the operating system setting
- "More like what you played" — suggestions derived on the device from titles
  you already opened, with nothing sent anywhere
- Save straight from the player, not just the tile
- 120 tiles to a page, with a **Show more** button, so a 16,000-title wall
  still paints in one frame
- Save titles, and a row of the last eight you opened
- `#p=<slug>` deep links, `Esc` to close, `/` to search, `` ` `` for a panic exit
- Tab cloaks (Classroom, Google, Docs), a blank-tab launcher and a quick exit
- **100% Unblocked** in the header: every title that is a plain file,
  on their own page, with no embed to load — plus filter and Surprise me
- The player header sizes to its own text (title, stats, source, description, report link) instead of a fixed bar that clipped the title off the top of the screen; the description wraps to three lines and disappears on a window under 520px tall, so the G@M£$ keeps the height
- Fullscreen for bundled files; every publisher title opens in its own tab,
  never in a frame
- If a bundled file fails, **Try another source** walks to the next route; if
  every one fails, the player says so and offers the file in a new tab
- Loading stays on screen until the frame answers, so a slow file is never a
  silent black page
- A short help section explains keyboard shortcuts, publisher availability and
  local storage; report links create GitHub issues with the selected title
- **Send feedback** in the footer of both pages opens one small dialog: say
  something is broken or request a G@M£$, and it becomes a GitHub issue with
  the page, browser and your words already in it. Nothing is sent from the
  site, and no address is published — a free GitHub account is all it needs
- A static GitHub Pages PWA caches the site shell; on the local-files page,
  **Save offline** downloads only the selected HTML G@M£$ — plus the shared
  runtime, if that page uses one — to this browser. They can be removed
  separately. Publisher-hosted G@M£$ still need the internet.

No frameworks, no build step, no server-side backend. The site is static on
GitHub Pages, with a same-origin service worker for optional offline caching.
`localStorage` and Cache Storage remain in this browser; the only site-level
analytics integration is the Microsoft Clarity tag in the head of the site
pages. Nothing in `assets/games/` carries a tag of its own. The optional Hanger 2
debug editor no longer injects its remote dat.GUI CDN script; normal G@M£$ play
is unaffected.

## Growing the library

Nobody adds files by hand. `.github/workflows/import-files.yml` runs daily,
walks the [js13kGames organisation](https://github.com/js13kGames) and turns any
entry it has not seen into one self-contained file under
`assets/games/js13k/`. The jam caps every submission at a 13 kB zip, so one
entry lands at tens of kilobytes and thousands of them fit inside a repo a free
static host will serve.

**What it does to an entry.** Downloads the repo tarball, prefers
`.website/game.zip` (the submission exactly as it arrived — plenty of repos
keep a one-line redirect in `index.html` and the real build in that zip), then
inlines every script, stylesheet, image, font and sound it references, so the
result is one file with no siblings. The author's cover image becomes the card.

**What it refuses.** An entry is dropped, not repaired, when the finished file
would still fetch anything:

- any `src`/`href`/`poster` or CSS `url()` left pointing at a path, a CDN or
  another site — the file would not work with the wi-fi off;
- an ES module that imports a sibling, which cannot be flattened into one file;
- under 1 kB or over 2 MB, or nothing that draws (a redirect stub is not one);
- a slug already used by another file, or a file it has already imported.

**The budget.** `--budget-mb 750` stops the import when `assets/games/` reaches
that size, so the site cannot grow past what GitHub Pages will serve (about
1 GB): the files are about 600 MB today, and the folder is the only thing
that grows. `--limit` caps how many land in one run and `--max-minutes` caps the wall
clock, so a scheduled job is bounded even if the backlog is large. Sizes are
also checked in `npm test`, so a runaway import fails the build instead of the
deploy.

**Attribution.** Every imported entry records its title, year, author and the
repo it came from in `data/local-files.json`, and the card says so — `js13k
2016 · by @someone`. These are other people's work, published by the jam, and
they are here on that basis. If you are the author of an entry and want it gone,
open an issue on this repository and it will be removed; nothing else depends on
any single file.

**Running it yourself** (optional — the schedule does this):

```sh
python3 scripts/import-js13k.py --dry-run --limit 40   # see what it would add
python3 scripts/import-js13k.py --limit 400            # add up to 400
python3 scripts/build-local-list.py                    # rebuild the shared list
python3 scripts/build-sitemap.py                       # and the sitemap
```

`data/local-files.json` is the source of truth for the files page.
`assets/js/local-games.js` is **generated** from it — edit the JSON, or let the
workflow do it, never the JavaScript.

## Security

The site is static, so there is no server to attack and nothing to log in to.
What is left is the browser: what the page is allowed to load, and what it is
allowed to frame.

**Nothing from a publisher is loaded in this page.** Every publisher title is
an `<a target="_blank" rel="noopener noreferrer">` handed to the browser on a
real click. The player frames bundled files only, and `embeddable()` in
`assets/js/app.js` filters on `sameOrigin(source.url)` rather than trusting the
catalogue data. So a title added by a feed tomorrow still cannot put a
third-party document — with its scripts, ads, redirects and trackers — inside
this site.

**A content security policy rides in a `<meta http-equiv>` tag** on `index.html`,
`files.html` and `404.html`, because GitHub Pages cannot send headers. It
allows:

| directive | allowed | why |
| --- | --- | --- |
| `default-src` | `'self'` | everything else is denied unless a rule below widens it |
| `script-src` | `'self'`, `https://*.clarity.ms`, plus a `sha256` hash per inline script | Clarity is a deliberate exception; the hashes replace `'unsafe-inline'` |
| `frame-src` | `'self'` | the bundled files, and nothing that is not this site |
| `object-src`, `base-uri`, `form-action` | `'none'` | no plugins, no `<base>` rewriting, no forms leaving the page |
| `img-src` | `'self'`, `data:`, `https:`, `https://c.bing.com` | tile thumbnails come from the publisher feeds |
| `connect-src` | `'self'`, `https://*.clarity.ms` | the only place a request may go |
| `style-src` | `'self'`, `'unsafe-inline'` | inline style attributes are set by the UI code |

There is **no `'unsafe-inline'` and no `'unsafe-eval'` in `script-src`**: an
injected `<script>`, or an `onclick=` smuggled into a title, has nothing to
match. The hashes are checked against the pages' actual inline scripts by
`npm test`, so editing an inline script without regenerating the policy fails
the build. Regenerate with:

```sh
node scripts/csp-hashes.mjs
```

**Every off-site link** carries `rel="noopener noreferrer"`, and every page
sends `<meta name="referrer" content="no-referrer">`, so no publisher learns
which page sent a click or gets a handle on the opener window.

**What this does not do.** It cannot sandbox the library's G@M£$ files: they
are served from this origin, so they share its storage and its service worker,
and they are third-party code. That is the price of them working offline. The
129 pack files are hand-picked; everything else is imported automatically (see
*Growing the library* below), and an imported file has to prove it loads
nothing but itself before it is kept. It also cannot stop a visitor clicking
through to a publisher — that page is the publisher's, with the publisher's
trackers and its own policy.

**Reporting a problem.** Anything in the catalogue can be reported from the
player or the footer, which opens a GitHub issue with the title and the page
already in it.

### Blocking ads on the site itself

Some of the bundled G@M£$ files arrived with advertising code still inside them
— `dadish-3` carries a live Google Ad Manager tag and a Prebid auction,
`zombie-rush`, `ovo`, `wheelie-bike` and `8-ball-classic` carry related
fragments, and `ovo` calls adinplay. `sw.js` keeps a `BLOCKED_HOSTS` list —
doubleclick, googlesyndication, googletagservices, adinplay, gamepix, criteo,
taboola, pubmatic, rubicon, amazon-adsystem and peers — and answers those hosts
with an empty `204` before anything leaves the browser. Because it lives in the
service worker it applies to every visitor with nothing installed, and it only
ever runs on this origin.

The `204` is chosen, not incidental: `ovo` watches for a blocked ad request and
only raises its "adblock detected" flag when the status is `0`. A `204` looks
like a real answer, so the G@M£$ plays instead of showing a disable-your-blocker
wall.

What it can and cannot do:

- **It covers** the wall, the files page and every bundled G@M£$, because the
  service worker controls every page in its scope and sees their subresource
  requests, including the cross-origin ones.
- **There is nothing left to cover on this site.** 15,972 of the 17,763 titles
  come from `gamemonetize.com`, 1,297 from `htmlgames.com` and 1,018 from
  `madkidgames.com`; none of those pages is framed any more. A publisher title
  opens in its own tab, where its ads are the publisher's business and the
  visitor's extension can deal with them. This page now loads no
  third-party document at all, so there is no ad slot in it to fill.
- **Clarity is deliberately not on the list.** Neither is `jsdelivr.net` (26 G@M£$
  files load their runtime from it) nor any publisher domain. Tests fail if any
  of those creep in, and fail if a lookalike domain such as `notdoubleclick.net`
  matches the suffix rule.
- First page view of a new visitor is not controlled until the worker installs,
  so an ad request in that first instant can slip through; every later request
  is covered.

## The files that cannot be blocked

`files.html`, reached from **100% Unblocked** in the header, lists the whole library
that ship with the site as plain HTML under `assets/games/`. No embed, no
portal, no third party that can refuse a frame: the page opens a file from its
own folder, and a filter aimed at a G@M£$ site has nothing to act on.

140 of them come from [CoolDude2349's Offline HTML Games Pack](https://github.com/CoolDude2349/Offline-HTML-Games-Pack),
which collects 352 single-file G@M£$. All 352 would be 5.3 GB, so this site
carries a hand-picked set that fits inside the size budget: the small classics,
the heavy legends (Slope, Retro Bowl, OvO, Bad Piggies, Fireboy & Watergirl and
more) and the sequels of both.
**Minecraft is not one of them.** It was bundled here for a while — the
Eaglercraft 26.2 (zeus) download, a single 76 MB HTML file — but it plays
from a browser build online again, so the folder holds only titles that work
with the network off. That is also what took the folder from 895 MB down to 782 MB, and the
headroom from 46 MiB to 118 MiB.

### Picking which of the 352 to ship

Two limits decide the list. GitHub Pages stops building past a **1 GB source
tree**, so `tests/catalog.test.js` holds `assets/games/` to **900 MiB**. The
folder and its shared runtimes now sit about **370 MiB** under that
project-level ceiling; a new title still has to be worth the megabytes it
costs. The other limit is honesty: a
file that fetches its engine from a CDN is not an offline G@M£$, so it is not
shipped no matter how good the title is.

Every candidate is therefore screened before it is copied, and the checks are
the ones a school network would notice:

- no `<script src>` or `<link href>` pointing at a URL — the same rule the
  test suite enforces;
- no remote build. Unity, Defold and Godot ports keep their `.unityweb`,
  `.wasm` or `resources.zip` beside the HTML; when the pack copy still points
  at `cdn.jsdelivr.net` for that build (`Run 3`, `Sprunki`, `Ducklings.io`,
  `Cluster Rush`, `Crazy Cars`, `Rooftop Snipers 2`, `Space Waves`,
  `Ages of Conflict`, `Car King Arena`, `Tunnel Rush`, `Ragdoll Archers`,
  `Monkey Mart`) it is left out, because it needs the network;
- no payload it does not carry. A G@M£$ must have at least 90% of its own bytes
  inlined as base64 or in an embedded zip, measured per file;
- no boot step waiting on a missing script. Several pack copies start with
  `await load("poki.js")` and stop there when it 404s — that excluded
  `Bad Ice Cream 2` and `3`, `Stick Merge` and `Basketball Legends`;
- no ad or redirect injection. `12 Mini Battles` loads an ad SDK through a
  look-alike domain, and the Eaglercraft downloads (`Indev`, `Alpha 1.2.6`,
  `Beta 1.3`) ship a Cloudflare analytics beacon, so those four are out;
- no pure-multiplayer title that has nothing to do without a server
  (`Yohoho.io`, `Hole.io`, `Cleanup.io`, `Snowball.io`);
- and nothing that a school network should not be asked to explain
  (`Pico's School`).

The remaining gap is size, not judgement. 210 titles in the pack are still
not here and would add about 4.4 GB. `Slope` and `Plants vs Zombies` were
removed again to keep the folder well clear of the ceiling, which is the same
trade every future title makes. Every one was downloaded at that revision
and screened against the rules above; 147 carry no external script, stylesheet,
beacon, ad marker or CDN build. Of those, the six in this batch open in
Chromium with external requests blocked and never ask for the network, and
thirteen more were checked the same way and booted but did not fit the
remaining megabyte budget: `Slope 3`, `Vex 7`, `Vex 8`, `Awesome Tanks`,
`Awesome Tanks 2`, `Vex X3M 2`, `Ice Dodo`, `Moto X3M`,
`Moto X3M 2`, `Moto X3M 3`, `Polytrack`, `KittyToy` and `Funny Battle`. They
are first in line when room appears. Room has since appeared — 370 MiB of it —
but the newest cuts were made to keep the folder well clear of the ceiling
rather than to swap one set of heavy titles for another. Beyond them are most
of the Papa's restaurant series, the Snail Bob and Wheely sequels,
`Bloons TD 5` and `Angry Birds Space`, plus the few whose
pack copy is not really offline (`Geometry Dash` still pulls its sounds,
`Jetpack Joyride` still fetches its build from a CDN). Adding more means
removing something first, and the size check in the test suite is what makes
that argument happen out loud instead of at 1 GB.

A number of the pack's newer exports wrap the G@M£$ in a `player.load(...)`
bootstrap that did not initialise in the test browser (`Bloons TD 5`,
`Duck Life 2` to `5`, `Motherload`, `Wheely`, `Snail Bob 2`, `Run`,
`Space is Key 2`, `Flood Runner 3` and `4`, `Earn to Die 2`, `Papa's Burgeria`,
`This is The Only Level Too`). The same wrapper also failed on files this site
already ships, so those copies were set aside rather than declared broken.

Card art for a new title is a screenshot the probe takes, so a freshly added
G@M£$ shows a plain title card until `local-files.yml` has run once and
committed its real screenshot.

That is also why the folder is committed in the open rather than hidden behind
a download: 129 pages and the three runtimes they share come to 530 MB, and
cloning it once is the point. Because a `git clone` of the folder and a **Save linked file** produce
the same thing, the pack is also usable offline straight from the repository:
clone it, or copy `assets/` onto a memory stick, and every page in there opens
in a browser with the network off. (`assets/vendor/` is part of the folder for
that reason: 26 Flash pages look for their runtime there, a couple of levels up
from `assets/games/`.)

`scripts/probe-files.mjs` serves the repo and opens every one of them in
Chromium, checking each returns 200 and actually paints. It also takes the
512×384 card screenshots in `assets/img/pack/`.
`.github/workflows/local-files.yml` runs it when a G@M£$ changes and commits any
new screenshots.

## Files

```
index.html               the page
files.html               the whole offline library and its search
404.html                 not-found page
assets/games/*.html      the G@M£$ themselves, straight from the offline pack
assets/img/pack/*.jpg    one screenshot per G@M£$, taken by the probe
assets/img/share/og-cover.png  the 1200x630 card a shared link shows
assets/css/app.css       all styling
assets/js/catalog.js     generated catalogue (17,573 rows)
assets/js/app.js         search, sort, saves, recents, player
assets/js/feedback.js    the footer feedback dialog (GitHub issues, no email)
assets/vendor/ruffle/    the Flash runtime, kept once for the pages that share it
scripts/build-catalog.py catalogue generator
scripts/extras.py        titles added by hand (Minecraft and its spare route)
scripts/share-runtime.py writes a duplicated runtime out once, repoints the pages
scripts/csp-hashes.mjs   writes the content security policy and its script hashes
.github/ISSUE_TEMPLATE  the bug and game-request forms the dialog mirrors
tests/ui.test.js         DOM behaviour
tests/catalog.test.js    data and repository checks
tests/security.test.js   policy, framing and link hygiene (run from catalog.test)
```

## Running

```bash
npm start     # python3 -m http.server 8000 --bind 0.0.0.0
npm test      # jsdom, no network
npm run posthog   # the PostHog wizard; needs a real terminal, see above
```

## Deployment

The live site is static files on GitHub Pages, branch `arena/22c34602-classroom`,
folder `/`. Push, and Pages rebuilds.

### Bing ownership

`BingSiteAuth.xml` in the repo root is Bing Webmaster Tools' ownership proof for
`https://funclassroom.github.io/`. The name and the folder are the whole
contract — BWT fetches `https://funclassroom.github.io/BingSiteAuth.xml` — so the
file is committed as-is rather than generated, and it is deliberately left out of
`.assetsignore` so a Workers deploy serves it too. It changes nothing about how
the site behaves: verification only proves ownership, and listing is controlled
by `robots.txt` and the pages' own `index,follow` below.

### Being found

- `robots.txt` allows everything and names the sitemap.
- `sitemap.xml` lists the wall, the files page and every G@M£$ file that does not
  mention `noindex` — 110 addresses today. Regenerate it with
  `python3 scripts/build-sitemap.py` after adding or removing a G@M£$; the
  catalogue refresh workflow runs the same script, and `tests/catalog.test.js`
  fails if the committed file drifts from the folder.
- The 16 G@M£$ files that carry another author's `noindex` are left out on
  purpose, as are the five that only mention it inside a bundled payload. A page
  that refuses indexing in a sitemap is a warning in every webmaster tool.
- The 17,763 catalogue entries are not separate URLs; they live in
  `assets/js/catalog.js` and render into one page, so a sitemap cannot list them.
  Only the two pages that show them can rank.

Being listed cuts against the "keeps working when a filter blocks it" idea: the
same index that lets a search find the site lets a school's blocklist find it.
The pages stay public and the G@M£$ still play from the folder, but a site that
ranks is a site a filter can recognise.

### Cloudflare Workers

The same folder can be deployed as Workers static assets (`npx wrangler deploy`
with `assets.directory` set to the repo root). Two things make that fail if you
forget them:

- **`.assetsignore`** — Workers uploads the whole directory and, unlike Pages,
  does not skip `node_modules`, `.git` or `.DS_Store`. The build container's
  `node_modules/workerd/bin/workerd` is 134 MiB and trips the 25 MiB per-file
  limit, and this repo's `.git` is ~450 MB. The ignore list keeps the upload to
  the site itself (~310 files, 782 MB, biggest file 15.6 MB).
- **The address** — a Worker's free hostname is `*.workers.dev`, which the
  school blocks, the same way it blocks `*.pages.dev` and `*.r2.dev`. A Worker
  is useful here as storage or a mirror, not as the URL in front of a class,
  unless a custom domain is added.

## On images and AI

No image is generated here: every G@M£$ thumbnail is the publisher's own file.
The artwork the repo holds is the hand-written SVG tab icon, the 1200x630 share
card, and one 512x384 grass-block card for Minecraft under
`assets/img/catalog/` — a streamed tile needs art that still draws when every
G@M£$ host is unreachable.

AI-titled titles are no longer filtered — the old blocklist was removed when it
turned out to be hiding the one Veo title the feeds still carried.
