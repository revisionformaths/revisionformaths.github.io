# Classroom

**129 G@M£$ that keep playing when the network does not.** Every one is a plain
HTML file served from this repository — no embed, no player to load, no
publisher to wait for, and nothing a filter can block, because there is no
third-party address for it to match. With the wi-fi off they still open.

That is the whole site. There is no second, streamed catalogue: every tile on
every page is a file in `assets/games/`.

The tab reads **Classroom** with a chalkboard icon, and the page is a plain
grid of playable titles.

**Live:** https://socks275.github.io/ClassroomGames/

## The wall and the file list

`index.html` is the wall: every file, searchable, sortable, with saves and
history kept in the browser. `files.html` is the same library with the
offline extras — **Save offline**, install as an app, and a card per file.

Both pages read `assets/js/local-games.js`, which is **generated** from
`data/local-files.json`. To add a G@M£$: drop the file under `assets/games/`,
its screenshot under `assets/img/pack/`, add one entry to the JSON, then run
`python3 scripts/build-local-list.py`. Nothing else needs touching.

**Minecraft is not bundled.** It was a 76 MB single file — more than every
other title put together — so it was removed and it is not on the site at all.

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

**What the titles store themselves** — each file is served from this origin, so
its own save files (levels, coins, unlocked cars) live in
this browser's storage for this site. They survive a reload, a closed
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
- G@M£$-type filters for action, puzzle, racing, sports, strategy and arcade
- Display options for dark mode, larger text and high contrast; reduced-motion follows the operating system setting
- "More like what you played" — suggestions derived on the device from titles
  you already opened, with nothing sent anywhere
- Save straight from the player, not just the tile
- 120 tiles to a page, with a **Show more** button, so 129 cards paint in one
  frame
- Save titles, and a row of the last eight you opened
- `#p=<slug>` deep links, `Esc` to close, `/` to search, `` ` `` for a panic exit
- Tab cloaks (Classroom, Google, Docs), a blank-tab launcher and a quick exit
- **100% Unblocked** in the header: the files page — the same 129 titles, the
  same list, with filter and Surprise me
- The player header sizes to its own text (title, stats, source, description, report link) instead of a fixed bar that clipped the title off the top of the screen; the description wraps to three lines and disappears on a window under 520px tall, so the G@M£$ keeps the height
- Fullscreen
- If a file fails to load, the player says so and offers it in a new tab
- Loading stays on screen until the frame answers, so a slow file is never a
  silent black page
- A short help section explains keyboard shortcuts and local storage; report
  links create GitHub issues with the selected title
- **Send feedback** in the footer of both pages opens one small dialog: say
  something is broken or request a G@M£$, and it becomes a GitHub issue with
  the page, browser and your words already in it. Nothing is sent from the
  site, and no address is published — a free GitHub account is all it needs
- A static GitHub Pages PWA caches the site shell; on the local-files page,
  **Save offline** downloads only the selected HTML G@M£$ — plus the shared
  runtime, if that page uses one — to this browser. They can be removed
  separately.

No frameworks, no build step, no server-side backend. The site is static on
GitHub Pages, with a same-origin service worker for optional offline caching.
`localStorage` and Cache Storage remain in this browser; the only site-level
analytics integration is the Microsoft Clarity tag in the head of the site
pages. Nothing in `assets/games/` carries a tag of its own. The optional Hanger 2
debug editor no longer injects its remote dat.GUI CDN script; normal G@M£$ play
is unaffected.

## Security

The site is static, so there is no server to attack and nothing to log in to.
What is left is the browser: what the page is allowed to load, and what it is
allowed to frame.

**Nothing from a third party is loaded in this page.** Every tile is a file
from `assets/games/`, and `embeddable()` in `assets/js/app.js` still filters on
`sameOrigin(source.url)` rather than trusting the list — so even a mistake in
`data/local-files.json` cannot put an off-site document, with its scripts, ads
and trackers, inside this site.

**A content security policy rides in a `<meta http-equiv>` tag** on `index.html`,
`files.html` and `404.html`, because GitHub Pages cannot send headers. It
allows:

| directive | allowed | why |
| --- | --- | --- |
| `default-src` | `'self'` | everything else is denied unless a rule below widens it |
| `script-src` | `'self'`, `https://*.clarity.ms`, plus a `sha256` hash per inline script | Clarity is a deliberate exception; the hashes replace `'unsafe-inline'` |
| `frame-src` | `'self'` | the bundled files, and nothing that is not this site |
| `object-src`, `base-uri`, `form-action` | `'none'` | no plugins, no `<base>` rewriting, no forms leaving the page |
| `img-src` | `'self'`, `data:`, `https:`, `https://c.bing.com` | card art is served from this site; `https:` is only room for a future remote thumb |
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
sends `<meta name="referrer" content="no-referrer">`, so no off-site host learns
which page sent a click or gets a handle on the opener window.

**What this does not do.** It cannot sandbox the library's G@M£$ files: they
are served from this origin, so they share its storage and its service worker,
and they are third-party code. That is the price of them working offline, and
why they are picked one at a time rather than mirrored wholesale.

**Reporting a problem.** Any file can be reported from the player or the
footer, which opens a GitHub issue with the title and the page already in it.

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
  requests.
- **There is nothing left to cover on this site.** Every tile is a file in this
  repository, so the page loads no third-party document at all and there is no
  ad slot in it to fill.
- **Clarity is deliberately not on the list.** Neither is `jsdelivr.net` (some
  bundled files load their runtime from it). Tests fail if either creeps in, and
  fail if a lookalike domain such as `notdoubleclick.net` matches the suffix
  rule.
- First page view of a new visitor is not controlled until the worker installs,
  so an ad request in that first instant can slip through; every later request
  is covered.

## The files that cannot be blocked

**This is the whole site.** Both `index.html` and `files.html` list the same
**129 files** that ship under `assets/games/` as plain HTML. No embed, no portal,
no third party that can refuse a frame: the page opens a file from its own
folder, and a filter aimed at a G@M£$ site has nothing to act on.

Every one comes from [CoolDude2349's Offline HTML Games Pack](https://github.com/CoolDude2349/Offline-HTML-Games-Pack),
which collects 352 single-file G@M£$. All 352 would be 5.3 GB, so this site
carries a hand-picked set that fits inside the size budget: the small classics,
the heavy legends (Slope, Retro Bowl, OvO, Bad Piggies, Fireboy & Watergirl and
more) and the sequels of both.
**Minecraft is not one of them.** It was bundled here for a while — the
Eaglercraft 26.2 (zeus) download, a single 76 MB HTML file — and is now gone
from the site entirely, so the folder holds only titles that work with the
network off.

### Picking which of the 352 to ship

Two limits decide the list. GitHub Pages stops building past a **1 GB source
tree**, so `tests/catalog.test.js` holds `assets/games/` to **900 MiB**. The
129 pages total **541,800,762 bytes** and the shared runtimes add
**14,281,369**, which leaves about **370 MiB** before the ceiling — room for
another title, if it is worth the megabytes it costs. The other limit is
honesty: a file that fetches its engine from a CDN is not an offline G@M£$, so
it is not shipped no matter how good the title is.

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

The remaining gap is size, not judgement. 223 titles in the pack are still not
here and would add about 4.4 GB. `Slope` and `Plants vs Zombies` were removed
again to keep the folder well clear of the ceiling, which is the same trade
every future title makes. Every one was downloaded and screened against the
rules above; 147 carry no external script, stylesheet, beacon, ad marker or CDN
build. Of those, the six in this batch opened in Chromium with external requests
blocked and never asked for the network, and thirteen more were checked the same
way and booted but did not fit the remaining megabyte budget: `Slope 3`,
`Vex 7`, `Vex 8`, `Awesome Tanks`, `Awesome Tanks 2`, `Vex X3M 2`, `Ice Dodo`,
`Moto X3M`, `Moto X3M 2`, `Moto X3M 3`, `Polytrack`, `KittyToy` and
`Funny Battle`. They are first in line when room appears. Room has since
appeared — 370 MiB of it — but the newest cuts were made to keep the folder
well clear of the ceiling rather than to swap one set of heavy titles for
another. Beyond them are most of the Papa's restaurant series, the Snail Bob
and Wheely sequels, `Bloons TD 5` and `Angry Birds Space`, plus the few whose
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
a download: 129 pages and the three runtimes they share come to about 530 MiB, and
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
assets/js/app.js         search, sort, saves, recents, player
assets/js/feedback.js    the footer feedback dialog (GitHub issues, no email)
assets/vendor/ruffle/    the Flash runtime, kept once for the pages that share it
data/local-files.json    the file list both pages are generated from
scripts/build-local-list.py renders assets/js/local-games.js from that JSON
scripts/build-sitemap.py writes sitemap.xml from the folder
scripts/share-runtime.py writes a duplicated runtime out once, repoints the pages
scripts/probe-files.mjs  serves the folder, opens every file, takes its card shot
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
  `python3 scripts/build-sitemap.py` after adding or removing a G@M£$;
  `tests/catalog.test.js` fails if the committed file drifts from the folder.
- The 16 G@M£$ files that carry another author's `noindex` are left out on
  purpose, as are the five that only mention it inside a bundled payload. A page
  that refuses indexing in a sitemap is a warning in every webmaster tool.
- Every G@M£$ is its own URL, so every one of them can rank.

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
  the site itself (~300 files, 560 MB, biggest file 12.6 MB).
- **The address** — a Worker's free hostname is `*.workers.dev`, which the
  school blocks, the same way it blocks `*.pages.dev` and `*.r2.dev`. A Worker
  is useful here as storage or a mirror, not as the URL in front of a class,
  unless a custom domain is added.

## On images and AI

No image is generated here: every card is a 512x384 screenshot that
`scripts/probe-files.mjs` takes of the file itself, so a card always shows the
G@M£$ it opens. The only drawn artwork is the hand-written SVG tab icon and the
1200x630 share card.

Nothing here is filtered by title any more: the library is a folder of files,
one entry per file, and no feed decides what is on it.
