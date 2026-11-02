/* Catalogue + repository integrity. */
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");

let pass = 0;
let fail = 0;
const failures = [];

function check(name, condition, extra) {
  if (condition) {
    pass += 1;
    console.log("  \x1b[32mPASS\x1b[0m  " + name);
  } else {
    fail += 1;
    failures.push(name + (extra ? " -> " + extra : ""));
    console.log("  \x1b[31mFAIL\x1b[0m  " + name + (extra ? "  -> " + extra : ""));
  }
}

console.log("\nDATA — catalogue and repository\n");

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, "assets/js/catalog.js"), "utf8"), sandbox);

const CATALOG = sandbox.window.CATALOG;
const slugs = CATALOG.map((g) => g.id);
const titles = CATALOG.map((g) => g.title);

check("catalogue is not empty", CATALOG.length > 100, String(CATALOG.length));
check("the old 506-title wall survived", CATALOG.length >= 506, String(CATALOG.length));
check("slugs are unique", new Set(slugs).size === slugs.length);
check("titles are unique", new Set(titles).size === titles.length);
check(
  "slugs are url-safe",
  slugs.every((s) => /^[a-z0-9-]+$/.test(s)),
  slugs.filter((s) => !/^[a-z0-9-]+$/.test(s)).join(", ")
);
check("every title is named", titles.every((t) => t.trim().length > 0));
check(
  "ratings sit between zero and five",
  CATALOG.every((g) => typeof g.rating === "number" && g.rating >= 0 && g.rating <= 5)
);
check(
  "play counts are whole numbers",
  CATALOG.every((g) => Number.isInteger(g.plays) && g.plays >= 0)
);
check(
  "routes never repeat a domain",
  CATALOG.every((g) => {
    const domains = new Set(g.sources.map((s) => new URL(s.url).hostname.split(".").slice(-2).join(".")));
    return domains.size === g.sources.length;
  })
);
check(
  "at most three routes per title",
  CATALOG.every((g) => g.sources.length <= 3)
);
check(
  "several independent embed hosts are in use",
  new Set(CATALOG.flatMap((g) => g.sources.map((s) => new URL(s.url).hostname))).size >= 3
);
check(
  "all 508 MadKid games are available as in-page sources",
  (() => {
    const mad = CATALOG.flatMap((g) => g.sources).filter((s) => s.portal === "madkidgames.com");
    return new Set(mad.map((s) => s.url)).size >= 508 && mad.every((s) =>
      s.embed === true && /^https:\/\/www\.madkidgames\.com\/full\/[a-z0-9-]+$/.test(s.url));
  })(),
  CATALOG.flatMap((g) => g.sources).filter((s) => s.portal === "madkidgames.com" && !s.embed).length + " not enabled"
);
check(
  "only MadKid routes are marked unembeddable",
  CATALOG.flatMap((g) => g.sources).every((s) => s.embed || s.portal === "madkidgames.com")
);
check(
  "every tile has at least one source",
  CATALOG.every((g) => Array.isArray(g.sources) && g.sources.length > 0)
);
check(
  "every source has a portal and an https url",
  CATALOG.every((g) =>
    g.sources.every((s) => typeof s.portal === "string" && /^https:\/\//.test(s.url))
  )
);
check(
  "sources say whether they can be framed",
  CATALOG.every((g) => g.sources.every((s) => typeof s.embed === "boolean"))
);
check(
  "frameable sources come before walled ones",
  CATALOG.every((g) => {
    const first = g.sources.findIndex((s) => s.embed === false);
    return first === -1 || g.sources.slice(first).every((s) => s.embed === false);
  })
);
check(
  "the wall starts with games that play in the page",
  (() => {
    const firstWalled = CATALOG.findIndex((g) => g.sources.every((s) => !s.embed));
    if (firstWalled === -1) return true;
    return CATALOG.slice(firstWalled).every((g) => g.sources.every((s) => !s.embed));
  })()
);
check(
  "no tile repeats a source url",
  CATALOG.every((g) => new Set(g.sources.map((s) => s.url)).size === g.sources.length)
);
check(
  "titles are not duplicated on the wall",
  new Set(CATALOG.map((g) => g.title.toLowerCase())).size === CATALOG.length
);
check(
  "every tile has a thumbnail",
  CATALOG.every((g) => /^https:\/\//.test(g.thumb) || /^assets\/img\/(?:catalog\/)?[a-z0-9-]+\.(png|jpe?g|webp)$/.test(g.thumb))
);
check(
  "Minecraft has two routes whose hosts allow framing, and local art",
  (() => {
    const tile = CATALOG.filter((g) => g.id === "minecraft");
    if (tile.length !== 1) return false;
    const sources = tile[0].sources;
    return tile[0].pinned === false &&
      tile[0].thumb === "assets/img/catalog/minecraft.jpg" &&
      fs.existsSync(path.join(ROOT, "assets/img/catalog/minecraft.jpg")) &&
      sources.length === 2 &&
      sources[0].portal === "johntherriiiippper.github.io" &&
      sources[0].url === "https://johntherriiiippper.github.io/eaglercraftx.html" &&
      sources[0].embed === true &&
      sources[1].portal === "eaglercraft.q13x.com" &&
      sources[1].url === "https://eaglercraft.q13x.com/1.8.8_2/js/?retina=true" &&
      sources[1].embed === true;
  })()
);
check(
  "no tile points at the host that refuses to be framed",
  CATALOG.every((g) => g.sources.every((s) => !/^eaglercraft\.com$/.test(s.portal)))
);
check(
  "the old Minecraft host is gone for good",
  CATALOG.every((g) => g.sources.every((s) => !/eymenwsmc|workers\.dev/.test(s.url)))
);
check(
  "nothing is pinned, so every sort is the sort that was asked for",
  CATALOG.every((g) => !g.pinned)
);
check(
  "the 76 MB Minecraft bundle is out of the folder and the list",
  !fs.existsSync(path.join(ROOT, "assets/games/minecraft.html")) &&
    !fs.existsSync(path.join(ROOT, "assets/img/pack/minecraft.jpg")) &&
    !/file: "assets\/games\/minecraft\.html"/.test(fs.readFileSync(path.join(ROOT, "assets/js/local-games.js"), "utf8"))
);
check(
  "the builder puts Minecraft back, in the same order, on the next rebuild",
  (() => {
    const src = fs.readFileSync(path.join(ROOT, "scripts/extras.py"), "utf8");
    return /"id":\s*"minecraft"/.test(src) &&
      /johntherriiiippper\.github\.io\/eaglercraftx\.html/.test(src) &&
      /eaglercraft\.q13x\.com\/1\.8\.8_2\/js\/\?retina=true/.test(src) &&
      !/"url":\s*"https:\/\/eaglercraft\.com/.test(src) &&
      !/"pin":\s*True/.test(src);
  })()
);
check(
  "nothing local is featured now that Minecraft streams",
  (fs.readFileSync(path.join(ROOT, "assets/js/local-games.js"), "utf8").match(/featured: true/g) || []).length === 0
);

/* ---------- files ---------- */
const index = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const app = fs.readFileSync(path.join(ROOT, "assets/js/app.js"), "utf8");
const notFound = fs.readFileSync(path.join(ROOT, "404.html"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");

check("index loads the catalogue", /assets\/js\/catalog\.js/.test(index));
check(
  "the wall links to the local files",
  /<a[^>]+class="btn btn-local"[^>]+href="files\.html"/.test(index) &&
    fs.existsSync(path.join(ROOT, "files.html"))
);

/* ---------- the local games ---------- */
const filesPage = fs.readFileSync(path.join(ROOT, "files.html"), "utf8");
const localGames = fs.readFileSync(path.join(ROOT, "assets/js/local-games.js"), "utf8");
const listed = Array.from(localGames.matchAll(/(assets\/games\/[A-Za-z0-9._-]+\.html?)/g)).map((m) => m[1]);
const unique = Array.from(new Set(listed));

check("the local page lists more than a dozen files", unique.length >= 12, String(unique.length));
check("every listed file is in the folder", unique.every((rel) => fs.existsSync(path.join(ROOT, rel))));
check(
  "the folder holds nothing the page hides",
  fs.readdirSync(path.join(ROOT, "assets/games")).filter((n) => /\.html?$/.test(n)).length === unique.length
);
check(
  "every local game has a card title",
  (localGames.match(/title: "/g) || []).length === unique.length
);
check(
  "every local game says what it is in one line",
  (() => {
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(localGames, sandbox);
    return sandbox.window.LOCAL_GAMES.every(
      (game) => typeof game.line === "string" && game.line.length > 20 && /[.!?]$/.test(game.line.trim())
    );
  })()
);
check(
  "the local games do not need this site to be online",
  unique.every((rel) => {
    const file = fs.readFileSync(path.join(ROOT, rel), "utf8");
    return !/<script[^>]+src=["']https?:/i.test(file) && !/<link[^>]+href=["']https?:[^"']*\.css/i.test(file);
  })
);
check(
  "every local game has a screenshot and nothing extra",
  (() => {
    const shots = fs.readdirSync(path.join(ROOT, "assets/img/pack")).filter((n) => n.endsWith(".jpg")).sort();
    const want = unique.map((rel) => path.basename(rel).replace(/\.html?$/, "") + ".jpg").sort();
    return shots.join(",") === want.join(",");
  })()
);
check(
  "each local game is a complete page",
  unique.every((rel) => {
    const file = fs.readFileSync(path.join(ROOT, rel), "utf8");
    return /<html|<head|<body/i.test(file) && /<canvas|<div|<body/i.test(file) && file.length > 20000;
  })
);
check(
  "the Wordle page's scripts parse",
  (() => {
    const rel = unique.find((file) => /wordle-unlimited\.html$/.test(file));
    if (!rel) return false;
    const file = fs.readFileSync(path.join(ROOT, rel), "utf8");
    const scripts = Array.from(file.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))
      .filter((m) => !/\bsrc\s*=/i.test(m[1] || ""))
      .map((m) => m[2]);
    return (
      scripts.length === 2 &&
      scripts.some((body) => body.includes('customElements.define("game-app"')) &&
      scripts.every((body) => {
        try {
          new vm.Script(body);
          return true;
        } catch (err) {
          return false;
        }
      })
    );
  })(),
  "a literal </script> in the bundle ends the script early and leaves a blank page"
);
check(
  "the local page credits where the files came from",
  /github\.com\/CoolDude2349\/Offline-HTML-Games-Pack/.test(filesPage)
);
// The whole site is served as a plain GitHub Pages source tree, and a
// published site may be no larger than 1 GB. The bundled games take most of
// that budget, so the folder is held to 900 MiB. That leaves roughly 48 MB
// under the published-site limit for the rest of the current site and a
// modest safety margin.
// The pack ships each title as a self-contained page, so a runtime shared by
// many titles used to be pasted into every one of them. It is kept once under
// assets/vendor now; this is the guard that stops it creeping back.
// A regex with a repetition count over a 10 MB string blows the V8 stack, so
// the payloads are read with plain string searches instead.
const embeddedPayloads = (text) => {
  const found = [];
  let at = text.indexOf("data:application/");
  while (at !== -1) {
    const comma = text.indexOf(";base64,", at);
    if (comma === -1) break;
    const start = comma + ";base64,".length;
    const end = text.indexOf('"', start);
    if (end === -1) break;
    const kind = text.slice(at + "data:application/".length, comma);
    if (/^(x-zip-compressed|zip)\b/.test(kind)) found.push(text.slice(start, end));
    at = text.indexOf("data:application/", end);
  }
  return found;
};

check(
  "no two game pages carry the same embedded payload",
  (() => {
    const seen = new Set();
    for (const name of fs.readdirSync(path.join(ROOT, "assets/games"))) {
      if (!/\.html?$/.test(name)) continue;
      const text = fs.readFileSync(path.join(ROOT, "assets/games", name), "utf8");
      for (const payload of embeddedPayloads(text)) {
        const digest = crypto.createHash("sha1").update(payload).digest("hex").slice(0, 12);
        if (seen.has(digest)) return false;
        seen.add(digest);
      }
    }
    return true;
  })()
);
check(
  "a shared runtime is on disk once, small enough to ship, and really a zip",
  (() => {
    const refs = new Map();
    for (const name of fs.readdirSync(path.join(ROOT, "assets/games"))) {
      if (!/\.html?$/.test(name)) continue;
      const text = fs.readFileSync(path.join(ROOT, "assets/games", name), "utf8");
      for (const match of text.matchAll(/\.\.\/vendor\/ruffle\/([A-Za-z0-9._-]+\.zip)/g)) {
        refs.set(match[1], (refs.get(match[1]) || 0) + 1);
      }
    }
    if (!refs.size) return false;
    return Array.from(refs).every(([file, uses]) => {
      const full = path.join(ROOT, "assets", "vendor", "ruffle", file);
      if (!fs.existsSync(full) || uses < 2) return false;
      const head = fs.readFileSync(full).subarray(0, 2).toString("latin1");
      return head === "PK" && fs.statSync(full).size < 25 * 1024 * 1024;
    });
  })()
);
check(
  "sharing the runtime did not take a game's own art with it",
  fs.readdirSync(path.join(ROOT, "assets/games"))
    .filter((name) => /\.html?$/.test(name) && fs.readFileSync(path.join(ROOT, "assets/games", name), "utf8").includes("../vendor/ruffle/"))
    // "Q1dT", "RldT" and "WldT" are base64 for CWS, FWS and ZWS: the Flash
    // file itself is still in the page, whatever compression it uses.
    .every((name) => /;base64,(?:Q1dT|RldT|WldT)/.test(fs.readFileSync(path.join(ROOT, "assets/games", name), "utf8")))
);
check(
  "saving one of those games offline brings the runtime with it",
  (() => {
    const worker = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
    return /assets\/vendor\//.test(worker) && /cache\.add\(/.test(worker);
  })()
);
check(
  "the pages no longer promise that every game is one file",
  ![index, filesPage].some((html) => /single HTML file|is a single file/i.test(html))
);

check(
  "the local files stay small enough to ship",
  unique.reduce((sum, rel) => sum + fs.statSync(path.join(ROOT, rel)).size, 0) < 900 * 1024 * 1024
);

check(
  "the Cloudflare upload leaves node_modules and .git behind",
  (() => {
    const file = path.join(ROOT, ".assetsignore");
    if (!fs.existsSync(file)) return false;
    const lines = fs
      .readFileSync(file, "utf8")
      .split("\n")
      .map((line) => line.trim().replace(/^\*\*\//, "").replace(/\/$/, ""))
      .filter((line) => line && line.charAt(0) !== "#");
    return lines.includes("node_modules") && lines.includes(".git");
  })()
);
check(
  "no deployable file breaks the 25 MiB Cloudflare asset limit",
  (() => {
    const skip = new Set(["node_modules", ".git", ".github", ".wrangler", "tests", "scripts", "data"]);
    const limit = 25 * 1024 * 1024;
    const walk = (dir) =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return skip.has(entry.name) ? [] : walk(full);
        return [full];
      });
    const files = walk(ROOT);
    const tooBig = files.filter((file) => fs.statSync(file).size > limit);
    if (tooBig.length) console.log("over the limit:", tooBig.map((f) => path.relative(ROOT, f)));
    return tooBig.length === 0;
  })()
);

check("index loads the app", /assets\/js\/app\.js/.test(index));
check("index loads the one stylesheet", /assets\/css\/app\.css/.test(index));
check("index has no old dual-skin leftovers", !/gamekit|data-mode|mode-classroom/i.test(index));
check("index has no hero wordmark", !/class="hero"|class="wordmark"/.test(index));
check(
  "every local asset referenced exists",
  Array.from(index.matchAll(/(?:src|href)="((?!https?:|data:|#)[^"]+)"/g))
    .map((m) => m[1].split("?")[0])
    .every((rel) => fs.existsSync(path.join(ROOT, rel)))
);
check(
  "AI titles are no longer filtered out",
  !/ai-token|AI_TOKENS|is_ai/.test(fs.readFileSync(path.join(ROOT, "scripts/build-catalog.py"), "utf8"))
);
check(
  "no loose photographs sit beside the pack screenshots",
  fs.readdirSync(path.join(ROOT, "assets/img")).filter((f) => /\.(png|jpe?g|webp)$/.test(f)).length === 0
);
check(
  "saved state never leaves the device",
  !/sendBeacon|XMLHttpRequest|navigator\.send/.test(app) &&
    !/fetch\([\s\S]{0,200}body:/.test(app) &&
    !/fetch\([\s\S]{0,200}JSON\.stringify/.test(app)
);
check(
  "saved state is never sent through app requests",
  (app.match(/window\.fetch\(/g) || []).length === 0 &&
    !/sendBeacon|XMLHttpRequest|navigator\.send/.test(app) &&
    !/fetch\([\s\S]{0,200}JSON\.stringify/.test(app)
);
check("all persistence uses one namespaced key", (app.match(/localStorage/g) || []).length > 0 && app.includes("classroom.state.v1"));
check("the page offers a way to wipe its own data", /data-reset/.test(index));
check(
  "no page or bundled game carries Cloudflare code",
  [ "index.html", "files.html", "404.html", "sw.js", "manifest.webmanifest" ]
    .concat(fs.readdirSync(path.join(ROOT, "assets/games")).map((name) => "assets/games/" + name))
    .every((rel) => !/cloudflareinsights|cloudflare\.com|Cloudflare Web Analytics/i.test(fs.readFileSync(path.join(ROOT, rel), "utf8")))
);
check("Hanger 2 has no remote Cloudflare CDN dependency", !/cdnjs\.cloudflare\.com/.test(fs.readFileSync(path.join(ROOT, "assets/games/hanger-2.html"), "utf8")));
// Microsoft Clarity is the one analytics tag the site carries. It belongs in
// the head of the three pages and nowhere else, so the checks prove it is there
// and prove no bundled game picks up a tag of its own.
const clarityPages = ["index.html", "files.html", "404.html"].map((rel) => {
  const html = fs.readFileSync(path.join(ROOT, rel), "utf8");
  const head = (html.match(/<head>[\s\S]*?<\/head>/i) || [""])[0];
  return head;
});
check(
  "Microsoft Clarity is in the head of every page",
  clarityPages.every((head) => /<!-- Microsoft Clarity -->/.test(head) &&
    /https:\/\/www\.clarity\.ms\/tag\/"\+i/.test(head) &&
    /\(window, document, "clarity", "script", "z0ayxg09fq"\);/.test(head))
);
check(
  "all three Clarity copies are identical, so they cannot drift",
  (() => {
    const blocks = clarityPages.map((head) => {
      const start = head.indexOf("<!-- Microsoft Clarity -->");
      const end = head.indexOf("</script>", start);
      return start === -1 ? "" : head.slice(start, end + 9);
    });
    return blocks[0] !== "" && blocks.every((block) => block === blocks[0]);
  })()
);
check(
  "Clarity is the published snippet, not a hand-rolled one",
  /c\[a\]=c\[a\]\|\|function\(\)\{\(c\[a\]\.q=c\[a\]\.q\|\|\[\]\)\.push\(arguments\)\}/.test(clarityPages[0]) &&
    /t\.async=1;t\.src="https:\/\/www\.clarity\.ms\/tag\/"\+i/.test(clarityPages[0]) &&
    /y\.parentNode\.insertBefore\(t,y\)/.test(clarityPages[0])
);
check(
  "the PostHog wizard is one command away",
  (() => {
    const scripts = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).scripts || {};
    return /@posthog\/wizard@latest/.test(scripts.posthog || "") &&
      /npm run posthog/.test(fs.readFileSync(path.join(ROOT, "README.md"), "utf8"));
  })()
);
check(
  "the bundled game files never carry an analytics tag",
  fs.readdirSync(path.join(ROOT, "assets/games")).every((name) =>
    !/clarity\.ms|z0ayxg09fq|posthog/i.test(fs.readFileSync(path.join(ROOT, "assets/games", name), "utf8"))
  )
);
// A pasted link is how most people arrive, so the preview tags are part of the
// product, not decoration.
check(
  "both shareable pages carry a large link preview",
  [index, filesPage].every((html) => {
    const head = (html.match(/<head>[\s\S]*?<\/head>/i) || [""])[0];
    return /property="og:title"/.test(head) && /property="og:description"/.test(head) &&
      /property="og:image" content="https?:\/\/[^"]+\.png"/.test(head) &&
      /property="og:image:width" content="1200"/.test(head) &&
      /property="og:image:height" content="630"/.test(head) &&
      /name="twitter:card" content="summary_large_image"/.test(head);
  })
);
check(
  "the share image exists and is 1200x630",
  (() => {
    const file = path.join(ROOT, "assets/img/share/og-cover.png");
    if (!fs.existsSync(file)) return false;
    const buf = fs.readFileSync(file);
    return buf.slice(1, 4).toString() === "PNG" && buf.readUInt32BE(16) === 1200 && buf.readUInt32BE(20) === 630;
  })()
);
// Being findable. The pages opt in, the error page stays out, and the two
// files a crawler reads first point at each other.
check(
  "the wall and the files page ask to be indexed",
  [index, filesPage].every((html) => {
    const head = (html.match(/<head>[\s\S]*?<\/head>/i) || [""])[0];
    return /<meta name="robots" content="index,follow">/.test(head) && !/noindex/i.test(head);
  })
);
check(
  "the error page stays out of the index",
  /<meta name="robots" content="noindex,nofollow">/.test(fs.readFileSync(path.join(ROOT, "404.html"), "utf8"))
);
check(
  "each shareable page names itself as the canonical address",
  (() => {
    const pairs = [[index, "https://funclassroom.github.io/"], [filesPage, "https://funclassroom.github.io/files.html"]];
    return pairs.every(([html, url]) =>
      new RegExp('<link rel="canonical" href="' + url.replace(/[.]/g, "\\.") + '">').test(html) &&
      new RegExp('<meta property="og:url" content="' + url.replace(/[.]/g, "\\.") + '">').test(html));
  })()
);
check(
  "robots.txt invites crawlers and names the sitemap",
  (() => {
    const file = path.join(ROOT, "robots.txt");
    if (!fs.existsSync(file)) return false;
    const text = fs.readFileSync(file, "utf8");
    return /^User-agent: \*$/m.test(text) && /^Allow: \/$/m.test(text) &&
      /^Sitemap: https:\/\/funclassroom\.github\.io\/sitemap\.xml$/m.test(text) &&
      !/BingSiteAuth\.xml|robots\.txt|sitemap\.xml/.test(fs.readFileSync(path.join(ROOT, ".assetsignore"), "utf8"));
  })()
);
check(
  "the sitemap lists exactly the pages that can be indexed",
  (() => {
    const file = path.join(ROOT, "sitemap.xml");
    if (!fs.existsSync(file)) return false;
    const xml = fs.readFileSync(file, "utf8");
    const listed = (xml.match(/<loc>([^<]+)<\/loc>/g) || []).map((tag) => tag.slice(5, -6));
    const expected = ["https://funclassroom.github.io/", "https://funclassroom.github.io/files.html"];
    for (const name of fs.readdirSync(path.join(ROOT, "assets/games")).sort()) {
      if (!/\.html?$/i.test(name)) continue;
      const body = fs.readFileSync(path.join(ROOT, "assets/games", name), "utf8");
      if (/noindex/i.test(body)) continue;
      expected.push("https://funclassroom.github.io/assets/games/" + name);
    }
    return listed.length === expected.length && listed.every((url, i) => url === expected[i]) &&
      listed.every((url) => /^https:\/\/funclassroom\.github\.io\//.test(url)) &&
      /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/.test(xml);
  })()
);
check(
  "the sitemap can be regenerated from the files",
  /noindex/.test(fs.readFileSync(path.join(ROOT, "scripts/build-sitemap.py"), "utf8"))
);
check(
  "the offline pitch leads both pages",
  /data-local-count/.test(index) && /works with the wi-fi off|network off/i.test(index) &&
    /wi-fi off/i.test(filesPage)
);
check(
  "the removed heavy titles are gone for good",
  !["assets/games/slope.html", "assets/games/plants-vs-zombies.html", "assets/img/pack/slope.jpg", "assets/img/pack/plants-vs-zombies.jpg"]
    .some((rel) => fs.existsSync(path.join(ROOT, rel))) && !/file: "assets\/games\/(slope|plants-vs-zombies)\.html"/.test(localGames)
);
check(
  "both pages read the ?ref= channel tag",
  /assets\/js\/attribution\.js/.test(index) && /assets\/js\/attribution\.js/.test(filesPage) &&
    /assets\/js\/attribution\.js/.test(fs.readFileSync(path.join(ROOT, "sw.js"), "utf8"))
);
check(
  "the attribution helper hands the channel to Clarity and nothing else",
  (() => {
    const src = fs.readFileSync(path.join(ROOT, "assets/js/attribution.js"), "utf8");
    return /window\.clarity\("set", "channel", source\)/.test(src) &&
      /typeof window\.clarity !== "function"/.test(src) &&
      !/fetch\(|XMLHttpRequest|sendBeacon|navigator\.send/.test(src) &&
      !/posthog/i.test(src) &&
      !/localStorage/.test(src);
  })()
);
// The product is called G@M£$ in its own words. Paths, CSS hooks, JS
// identifiers and other people's project names still say "game" — those are
// facts, not branding, and changing them would break the site or misname a
// source. This strips exactly those, then insists nothing is left.
const BRAND = "G@M£$";
const brandStrip = (text) => text
  .replace(/<script[\s\S]*?<\/script>/gi, "")
  .replace(/<style[\s\S]*?<\/style>/gi, "")
  .replace(/data-[a-z-]*game[a-z-]*/gi, "")
  .replace(/Offline HTML Games Pack/g, "")
  .replace(/[\w./-]*game-request[\w-]*/gi, "")
  .replace(/[\w./-]*games?[\w./-]*/gi, (token) => (/[/.:]/.test(token) ? "" : token))
  .replace(/`[^`\n]*`|https?:\/\/\S+/g, "");
check(
  "the pages never say \"game\" in their own copy",
  ["index.html", "files.html", "404.html", "manifest.webmanifest"].every((rel) => {
    const copy = brandStrip(fs.readFileSync(path.join(ROOT, rel), "utf8"));
    return !/\bgames?\b/i.test(copy);
  })
);
check(
  "the README never says \"game\" in its own prose",
  (() => {
    const keep = ["KBH Games", "Offline HTML Games Pack", "Offline-HTML-Games-Pack", "game-request", "ClassroomGames", "World's Hardest Game"];
    const escaped = keep.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const protectedSpan = new RegExp("`[^`\\n]*`|https?:\\/\\/\\S+|[\\w./-]*\\/[\\w./-]+|\\b(?:" + escaped.join("|") + ")\\b", "g");
    let prose = "";
    let last = 0;
    for (const match of readme.matchAll(protectedSpan)) {
      prose += readme.slice(last, match.index);
      last = match.index + match[0].length;
    }
    prose += readme.slice(last);
    return !/\bgames?\b/i.test(prose);
  })()
);
check(
  "the brand is what the copy actually uses",
  /129 G@M£\$ that still work when the network is blocked/.test(index) &&
    /These G@M£\$ play with the wi-fi off/.test(filesPage) &&
    /129 G@M£\$ that keep playing when the network does not/.test(readme)
);
check(
  "the README lists a tagged link per channel",
  /https:\/\/funclassroom\.github\.io\/\?ref=discord/.test(readme) &&
    /https:\/\/funclassroom\.github\.io\/\?ref=tiktok/.test(readme) &&
    /https:\/\/funclassroom\.github\.io\/files\.html\?ref=/.test(readme)
);
// Bing Webmaster Tools proves ownership by fetching this exact file from the
// site root. It is committed, not generated, and it has to survive the Cloudflare
// asset filter as well as Pages, or verification works on one deploy target and
// fails on the other.
check(
  "Bing can verify the site from a file at the root",
  (() => {
    const file = path.join(ROOT, "BingSiteAuth.xml");
    if (!fs.existsSync(file)) return false;
    const xml = fs.readFileSync(file, "utf8");
    return /^<\?xml version="1\.0"\?>/.test(xml) &&
      /<users>\s*<user>[A-F0-9]{32}<\/user>\s*<\/users>/.test(xml) &&
      !/BingSiteAuth\.xml/.test(fs.readFileSync(path.join(ROOT, ".assetsignore"), "utf8"));
  })()
);
// The player header used to be a fixed 52px bar holding five stacked lines.
// Centred content overflowed it in both directions, so the title was pushed off
// the top of the screen and the description sat over the game. These checks
// keep the bar sized to its content, and keep the description readable, so the
// same clipping cannot come back.
const css = fs.readFileSync(path.join(ROOT, "assets/css/app.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const cssRules = (() => {
  const rules = [];
  const walk = (text, media) => {
    let i = 0;
    while (i < text.length) {
      const brace = text.indexOf("{", i);
      if (brace === -1) break;
      const semi = text.indexOf(";", i);
      if (semi !== -1 && semi < brace) { i = semi + 1; continue; }
      const prelude = text.slice(i, brace).trim();
      let depth = 1;
      let j = brace + 1;
      while (j < text.length && depth > 0) {
        if (text[j] === "{") depth += 1;
        else if (text[j] === "}") depth -= 1;
        j += 1;
      }
      const body = text.slice(brace + 1, j - 1);
      if (prelude.startsWith("@")) walk(body, media.concat(prelude));
      else rules.push({ selectors: prelude.split(",").map((part) => part.trim()), body, media });
      i = j;
    }
  };
  walk(css, []);
  return rules;
})();
const styleOf = (selector, { topLevel = true } = {}) =>
  cssRules.filter((rule) => rule.selectors.includes(selector) && (!topLevel || rule.media.length === 0));

check(
  "the player header grows with its text instead of clipping it",
  (() => {
    const bars = styleOf(".player-top");
    return bars.length > 0 &&
      bars.every((rule) => !/(?<![\w-])height\s*:/.test(rule.body)) &&
      bars.some((rule) => /min-height\s*:/.test(rule.body)) &&
      bars.some((rule) => /max-height\s*:/.test(rule.body));
  })()
);
check(
  "the player fills the visible screen, not the layout one",
  (() => {
    const players = styleOf(".player");
    return players.some((rule) => /height\s*:\s*100dvh/.test(rule.body)) &&
      players.some((rule) => /height\s*:\s*100vh/.test(rule.body));
  })()
);
check(
  "the game description wraps and is bounded, never one clipped line",
  (() => {
    const rules = styleOf(".player-description");
    return rules.length > 0 &&
      rules.every((rule) => !/white-space\s*:\s*nowrap/.test(rule.body)) &&
      rules.some((rule) => /-webkit-line-clamp\s*:\s*[23]/.test(rule.body)) &&
      rules.every((rule) => /max-width\s*:/.test(rule.body));
  })()
);
check(
  "a short window drops the prose so the game keeps the screen",
  cssRules.some((rule) => rule.selectors.includes(".player-description") &&
    rule.media.some((query) => /max-height/.test(query)) &&
    /display\s*:\s*none/.test(rule.body))
);
check("the offline web app manifest exists", fs.existsSync(path.join(ROOT, "manifest.webmanifest")) && /"display"\s*:\s*"standalone"/.test(fs.readFileSync(path.join(ROOT, "manifest.webmanifest"), "utf8")));
// The site blocks ad networks itself, in the service worker, so every visitor
// gets it without an extension and no other site is affected. The blocklist
// must never grow to cover Clarity, the games' own runtime, or a publisher.
check(
  "the service worker blocks ad networks for this site only",
  (() => {
    const src = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
    const list = (src.match(/const BLOCKED_HOSTS = \[([\s\S]*?)\];/) || [])[1] || "";
    const hosts = (list.match(/"[^"]+"/g) || []).map((h) => h.slice(1, -1));
    const mustBlock = ["doubleclick.net", "googlesyndication.com", "adnxs.com", "adinplay.com", "gamepix.com", "googletagservices.com"];
    const mustNot = ["clarity.ms", "jsdelivr.net", "madkidgames.com", "github.io"];
    const blockedAt = src.indexOf("if (isBlocked(url.hostname))");
    const sameOrigin = src.indexOf("if (url.origin !== self.location.origin) return;");
    return hosts.length >= 15 &&
      mustBlock.every((h) => hosts.includes(h)) &&
      mustNot.every((h) => !hosts.includes(h) && !hosts.some((x) => x.endsWith("." + h))) &&
      blockedAt !== -1 && sameOrigin !== -1 && blockedAt < sameOrigin;
  })()
);
check(
  "the blocked hosts really only answer to this site's rules",
  (() => {
    const src = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
    // A suffix match must not swallow a lookalike domain.
    const list = src.match(/const BLOCKED_HOSTS = \[[\s\S]*?\];/)[0];
    const rule = src.match(/const isBlocked = .*/)[0];
    const fn = new Function(list + rule + " return isBlocked;")();
    return fn("doubleclick.net") && fn("pubads.g.doubleclick.net") &&
      fn("api.adinplay.com") && fn("cdn.gamepix.com") && fn("securepubads.g.doubleclick.net") &&
      !fn("notdoubleclick.net") && !fn("clarity.ms") && !fn("t.clarity.ms") &&
      !fn("googleadservices.com.evil.example") && !fn("jsdelivr.net") &&
      !fn("gamemonetize.com") && !fn("htmlgames.com") && !fn("madkidgames.com");
  })()
);
check("offline support is implemented as a static service worker", fs.existsSync(path.join(ROOT, "sw.js")) && /addEventListener\("fetch"/.test(fs.readFileSync(path.join(ROOT, "sw.js"), "utf8")));
check("offline copies are user-selected, not bulk downloaded", /CACHE_GAME/.test(fs.readFileSync(path.join(ROOT, "sw.js"), "utf8")) && /Save offline/.test(filesPage));
check("problem reports go to GitHub issues", /github\.com\/funclassroom\/funclassroom\.github\.io\/issues/.test(index) && fs.existsSync(path.join(ROOT, ".github/ISSUE_TEMPLATE/bug_report.md")));
check("the main page offers local-data export and import", /data-export/.test(index) && /data-import/.test(index));
check("the old game files are gone", !fs.existsSync(path.join(ROOT, "assets/js/games")));
check("portal adapters exist", fs.existsSync(path.join(ROOT, "scripts/portals.py")));
check(
  "the builder groups by title so duplicates collapse",
  /groups\[key\]/.test(fs.readFileSync(path.join(ROOT, "scripts/build-catalog.py"), "utf8"))
);
check(
  "the builder refuses to shrink the wall",
  /refusing to write/.test(fs.readFileSync(path.join(ROOT, "scripts/build-catalog.py"), "utf8"))
);
check("the old toolkit is gone", !fs.existsSync(path.join(ROOT, "assets/js/gamekit.js")));
check("the 404 page links home", /href="\.\/"/.test(notFound));
check("the 404 page wears the same skin", /assets\/css\/app\.css/.test(notFound));
check("the 404 page keeps the wordmark", notFound.includes("G@M£$"));
check("package version is 4.x", /^4\./.test(pkg.version), pkg.version);
check("npm test runs both suites", /ui\.test\.js/.test(pkg.scripts.test) && /catalog\.test\.js/.test(pkg.scripts.test));
check("no build step is required", !pkg.scripts.build);
check("README explains the disguise", /tab reads \*\*Classroom\*\*/i.test(readme));
check("README states the MadKid count", readme.includes("508"));

check(
  "both pages load the feedback dialog",
  [index, filesPage].every((html) => /assets\/js\/feedback\.js/.test(html))
);
check(
  "the feedback dialog never sends anything itself",
  (() => {
    const src = fs.readFileSync(path.join(ROOT, "assets/js/feedback.js"), "utf8");
    return !/fetch\(|sendBeacon|XMLHttpRequest/.test(src) && /issues\/new/.test(src);
  })()
);
check(
  "a game can be requested without leaving the page",
  /labels:\s*game-request/.test(fs.readFileSync(path.join(ROOT, ".github/ISSUE_TEMPLATE/game_request.md"), "utf8")) &&
    /game-request/.test(fs.readFileSync(path.join(ROOT, "assets/js/feedback.js"), "utf8"))
);
check(
  "the feedback dialog publishes no address of its own",
  !/mailto:|@[a-z0-9-]+\.[a-z]{2,}/i.test(fs.readFileSync(path.join(ROOT, "assets/js/feedback.js"), "utf8"))
);
check(
  "the page points at the repository that owns the issues",
  /funclassroom\/funclassroom\.github\.io/.test(fs.readFileSync(path.join(ROOT, "assets/js/feedback.js"), "utf8"))
);

console.log("\n  DATA: " + pass + " passed, " + fail + " failed\n");
if (fail) {
  failures.forEach((f) => console.log("   - " + f));
  process.exitCode = 1;
}
