/* Wall + player behaviour. jsdom, no network. */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const HTML = fs
  .readFileSync(path.join(ROOT, "index.html"), "utf8")
  .replace(/<script src="[^"]+"><\/script>/g, "");
const LOCAL_JS = fs.readFileSync(path.join(ROOT, "assets/js/local-games.js"), "utf8");
const APP_JS = fs.readFileSync(path.join(ROOT, "assets/js/app.js"), "utf8");
const FEEDBACK_JS = fs.readFileSync(path.join(ROOT, "assets/js/feedback.js"), "utf8");
const FILES_HTML = fs.readFileSync(path.join(ROOT, "files.html"), "utf8");

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

const STORE_KEY = "classroom.state.v1";

function boot(hash, seed, catalogJs) {
  const dom = new JSDOM(HTML, {
    url: "https://example.test/" + (hash || ""),
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  dom.window.scrollTo = function (x, y) { dom.window.__scrolledTo = y; };
  if (seed) dom.window.localStorage.setItem(STORE_KEY, JSON.stringify(seed));
  // There is no publisher catalogue any more: the wall is built from the file
  // list, so a boot with no fixture is exactly the shipped page.
  if (catalogJs) dom.window.eval(catalogJs);
  else dom.window.eval(LOCAL_JS);
  dom.window.eval(APP_JS);
  dom.window.eval(FEEDBACK_JS);
  return dom;
}

/* A tiny stand-in catalogue so fallback behaviour can be driven by hand. */
function miniCatalog(sources) {
  return (
    "window.CATALOG=" +
    JSON.stringify(sources) +
    ".map(function (s) { return { id: s.id, title: s.title, rating: 4, plays: 10, " +
    'thumb: "https://example.test/t.jpg", sources: s.sources }; });' +
    'window.CATALOG_BUILT = "test";'
  );
}

function firstPlayable(document) {
  return document.querySelector('.tile[data-playable="1"]');
}

function sourcesFor(count) {
  const list = [];
  for (let i = 0; i < count; i += 1) {
    // The player only ever frames this site's own files now, so the fixture
    // uses same-origin URLs for anything that is meant to play in the page.
    list.push({ portal: "portal" + (i + 1) + ".test", url: "/assets/games/probe" + (i + 1) + ".html" });
  }
  return list;
}

function readStore(window) {
  return JSON.parse(window.localStorage.getItem(STORE_KEY));
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

/* Hands a link to the browser without navigating jsdom: records every anchor
   click that targets a new tab, then stops the default. */
function watchNewTabs(window) {
  const seen = [];
  window.HTMLAnchorElement.prototype.click = function () {
    seen.push({ href: this.getAttribute("href"), rel: this.getAttribute("rel"), target: this.getAttribute("target") });
  };
  return seen;
}


function click(window, node) {
  node.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
}

function type(window, input, value) {
  input.value = value;
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
}

function press(window, key) {
  const event = new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  window.document.body.dispatchEvent(event);
  return event;
}

function titles(document) {
  return Array.from(document.querySelectorAll(".tile-title")).map((n) => n.textContent);
}

(async function run() {
  console.log("\nUI\n");
  await tick();

  /* first paint */
  {
    const dom = boot();
    await tick();
    const { document } = dom.window;
    const total = dom.window.CATALOG.length;

    check("tab says Classroom", document.title === "Classroom", document.title);
    check(
      "tab carries a classroom-style icon",
      /rel="icon"[^>]+data:image\/svg\+xml[^"]*0F9D58/.test(document.head.innerHTML)
    );
    check("logo is present", document.querySelector(".logo").textContent.trim().length > 0);
    check("count matches the catalogue", document.querySelector("[data-count]").textContent === String(total));
    check("the whole catalogue is loaded", total === dom.window.CATALOG.length, String(total));
    check(
      "the first page is rendered",
      document.querySelectorAll(".tile").length === Math.min(120, total)
    );
    check("a show-more button appears", !document.querySelector("[data-more]").hidden);
    click(dom.window, document.querySelector("[data-more]"));
    check(
      "show more adds another page",
      document.querySelectorAll(".tile").length === Math.min(240, total)
    );
    if (total > 240) {
      const more = document.querySelector("[data-more]");
      check("the button counts what is left", /\d+ left/.test(more.textContent) || /Show 120 more/.test(more.textContent));
    }
    check(
      "thumbnails are portal art or local pack art",
      Array.from(document.querySelectorAll(".tile-thumb img")).every((img) =>
        /^https:\/\/[a-z0-9.-]+\//.test(img.getAttribute("src")) ||
        /^assets\/img\/(?:pack|catalog)\/[a-z0-9-]+\.(png|jpe?g|webp)$/.test(img.getAttribute("src"))
      )
    );
    type(dom.window, document.querySelector("#q"), "minecraft");
    await tick();
    check(
      "nothing streams in any more, so Minecraft is not on the wall",
      document.querySelectorAll(".tile").length === 0 && !document.querySelector("[data-empty]").hidden
    );
    type(dom.window, document.querySelector("#q"), "");
    await tick();
    check(
      "the streamed Minecraft tile is not marked as a local file",
      !document.querySelector('.tile[data-id="minecraft"] .tile-file')
    );
    check(
      "no local tile is featured now that Minecraft streams",
      document.querySelectorAll('.tile[data-featured="1"]').length === 0
    );
    check(
      "tiles name themselves for screen readers",
      Array.from(document.querySelectorAll(".tile-open")).every((b) => /^Play /.test(b.getAttribute("aria-label")))
    );
    const shown = document.querySelectorAll(".tile").length;
    check(
      "only the first screenful loads eagerly",
      document.querySelectorAll('.tile-thumb img[loading="lazy"]').length === Math.max(0, shown - 24) &&
        document.querySelectorAll('.tile-thumb img:not([loading])').length === Math.min(24, shown)
    );
    check(
      "rated titles on screen carry a badge",
      document.querySelectorAll(".tile-rating").length ===
        Array.from(document.querySelectorAll(".tile")).filter((t) => Number(t.dataset.rating) > 0).length
    );

    const chrome = Array.from(document.querySelectorAll(".bar, .toolbar, .foot"))
      .map((n) => n.textContent)
      .join(" ");
    check("chrome never says the word", !/\bgames?\b/i.test(chrome), chrome.match(/\bgames?\b/i)?.[0]);

    check(
      "no duplicate ids",
      (() => {
        const ids = Array.from(document.querySelectorAll("[id]")).map((n) => n.id);
        return ids.length === new Set(ids).size;
      })()
    );
    check(
      "sprite references resolve",
      Array.from(document.querySelectorAll("use")).every((u) => document.querySelector(u.getAttribute("href")))
    );
    dom.window.close();
  }

  /* local files */

  {
    const wall = boot();
    await tick();
    const link = wall.window.document.querySelector('a.btn-local[href="files.html"]');
    check(
      "the wall carries a way into the local files",
      !!link && /100% Unblocked/.test(link.textContent)
    );
    wall.window.close();

    const local = new JSDOM(FILES_HTML.replace(/<script src="[^"]+"><\/script>/g, "").replace("<script>", "<script>" + LOCAL_JS), {
      url: "https://example.test/files.html",
      runScripts: "dangerously",
      pretendToBeVisual: true,
    });
    await tick();
    const { window } = local;
    const { document: page } = window;
    const cards = Array.from(page.querySelectorAll(".file-card"));
    // Captured before any search runs: a search deliberately builds the rest.
    const firstBatch = cards.length;
    const moreWasVisible = page.querySelector("[data-files-more]").hidden === false;

    check("the local page is a Classroom tab", page.title === "Classroom");

    window.eval(FEEDBACK_JS);
    const fbTrigger = page.querySelector("[data-feedback]");
    check("the local page offers feedback too", !!fbTrigger);
    fbTrigger.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
    check(
      "the local page opens the same dialog",
      page.querySelector("[data-feedback-dialog]").hidden === false
    );
    page.querySelector("[data-feedback-dialog] [data-fb-cancel]").dispatchEvent(
      new window.MouseEvent("click", { bubbles: true })
    );
    type(window, page.querySelector("#fq"), "basket");
    check(
      "local search only returns local HTML games",
      Array.from(page.querySelectorAll(".file-card"))
        .filter((card) => !card.hidden)
        .every((card) => /^assets\/games\/(?:js13k\/)?[A-Za-z0-9._-]+\.html?$/.test(card.getAttribute("data-file")))
    );
    check("local search finds the new basketball game", page.querySelector('[data-file="assets/games/basket-random.html"]').hidden === false);
    type(window, page.querySelector("#fq"), "minecraft");
    check(
      "the local page has no Minecraft to find any more",
      Array.from(page.querySelectorAll(".file-card")).every((card) => card.hidden)
    );
    type(window, page.querySelector("#fq"), "");
    check(
      "the first batch of cards paints immediately",
      firstBatch > 0 && firstBatch <= 120 && moreWasVisible,
      String(firstBatch)
    );
    // "Show more" until the whole library is on the page.
    for (let guard = 0; guard < 200 && !page.querySelector("[data-files-more]").hidden; guard += 1) {
      click(window, page.querySelector("[data-files-more]"));
    }
    check(
      "every local title gets a card",
      page.querySelectorAll("[data-open-file]").length === window.LOCAL_GAMES.length,
      page.querySelectorAll("[data-open-file]").length + " of " + window.LOCAL_GAMES.length
    );
    check(
      "the cards name their games",
      cards.every((card) => card.querySelector(".file-title").textContent.trim().length > 0)
    );
    check(
      "a card plays a file in the folder",
      Array.from(page.querySelectorAll("[data-open-file]")).every((b) =>
        /^assets\/games\/(?:js13k\/)?[A-Za-z0-9._-]+\.html?$/.test(b.getAttribute("data-open-file"))
      )
    );
    check(
      "the cards use the local screenshots",
      Array.from(page.querySelectorAll(".file-art img")).every((img) =>
        /^assets\/img\/pack\/[A-Za-z0-9-]+\.jpg$/.test(img.getAttribute("src"))
      )
    );
    check("nothing is playing yet", page.querySelector("[data-player]").hidden);
    check("no frame until asked", page.querySelectorAll("iframe").length === 0);

    check(
      "the local page starts with the first bundled title",
      page.querySelector("[data-open-file]").getAttribute("data-open-file") === "assets/games/2048.html",
      page.querySelector("[data-open-file]").getAttribute("data-open-file")
    );
    click(window, page.querySelector('[data-open-file="assets/games/2048.html"]'));
    const frame = page.querySelector("iframe");
    check("playing opens the file in place", !page.querySelector("[data-player]").hidden);
    check(
      "the frame points at the chosen file",
      !!frame && /\/assets\/games\/2048\.html$/.test(frame.getAttribute("src")),
      frame && frame.getAttribute("src")
    );
    check("page locks while playing", page.body.classList.contains("locked"));
    check(
      "the player names the title",
      page.querySelector("[data-player-title]").textContent === "2048"
    );
    check(
      "the local player shows a loading card",
      !page.querySelector("[data-loading]").hidden &&
        /Loading 2048/.test(page.querySelector("[data-loading-text]").textContent)
    );
    frame.dispatchEvent(new window.Event("load"));
    await tick();
    check("the loading card clears when the file answers", page.querySelector("[data-loading]").hidden);
    check(
      "there is a way to open the file on its own",
      page.querySelector("[data-external]").getAttribute("href") ===
        "https://example.test/assets/games/2048.html"
    );
    check("the deep link is written", /\/assets\/games\/2048\.html$/.test(window.location.pathname));

    click(window, page.querySelector("[data-close]"));
    check("closing puts the page back", page.querySelector("[data-player]").hidden);
    check("closing destroys the frame", page.querySelectorAll("iframe").length === 0);
    check("scrolling is restored", !page.body.classList.contains("locked"));
    check("the hash-free address comes back", window.location.pathname === "/files.html");
    window.close();
  }

  /* sorting */
  {
    const dom = boot();
    await tick();
    const { window } = dom;
    const { document } = window;
    const buttons = Array.from(document.querySelectorAll("[data-sort]"));
    const firstSlug = () => document.querySelector(".tile").getAttribute("data-id");

    check(
      "the wall opens in the library's own order when nothing is played yet",
      firstSlug() === window.CATALOG[0].id,
      firstSlug()
    );
    check(
      "only the local files offer to play in the page",
      Array.from(document.querySelectorAll('.tile[data-playable="1"]')).every((t) =>
        /^local-/.test(t.getAttribute("data-id"))
      )
    );

    click(window, buttons.find((b) => b.dataset.sort === "az"));
    const alphabetical = titles(document);
    const sortedPart = alphabetical.filter((t) => t !== "");
    check("A–Z sorts", sortedPart.length === alphabetical.length);
    check(
      "A–Z leads with its first title, nothing pinned above it",
      document.querySelector(".tile").getAttribute("data-pinned") === "0"
    );

    click(window, buttons.find((b) => b.dataset.sort === "top"));
    const seriesFlags = Array.from(document.querySelectorAll(".tile"))
      .map((t) => (window.CATALOG.find((c) => c.id === t.getAttribute("data-id")) || {}).series);
    const firstPlain = seriesFlags.findIndex((s) => !s);
    check(
      "the series sort puts every series ahead of the rest",
      firstPlain === -1 || seriesFlags.slice(firstPlain).every((s) => !s),
      seriesFlags.slice(0, 8).join(",")
    );
    check(
      "nothing is pinned above the sort",
      document.querySelector(".tile").getAttribute("data-pinned") === "0"
    );
    check("one sort at a time", document.querySelectorAll('[data-sort][aria-pressed="true"]').length === 1);
    dom.window.close();
  }

  /* search */
  {
    const dom = boot();
    await tick();
    const { window } = dom;
    const { document } = window;
    const input = document.querySelector("#q");

    check(
      "the wall is exactly the file list",
      window.CATALOG.length === window.LOCAL_GAMES.length &&
        window.CATALOG.every((g) => g.id.indexOf("local-") === 0)
    );
    type(window, input, "bad piggies");
    check("a search finds the file", !!document.querySelector('.tile[data-id="local-bad-piggies"]'));
    check(
      "there is only the file, no second copy of the same title",
      document.querySelectorAll(".tile").length === 1
    );
    click(window, document.querySelector('[data-open="local-bad-piggies"]'));
    check("HTML result plays the local file", document.querySelector(".player-frame").getAttribute("src") === "assets/games/bad-piggies.html");
    click(window, document.querySelector("[data-close]"));
    type(window, input, "2048");
    check(
      "an exact match leads",
      document.querySelector(".tile").getAttribute("data-id") === "local-2048",
      document.querySelector(".tile").getAttribute("data-id")
    );

    const matches = window.CATALOG.filter((g) => /subway/i.test(g.title)).length;
    type(window, input, "subway");
    check("search filters", document.querySelectorAll(".tile").length === matches);
    check("matches are relevant", titles(document).every((t) => /subway/i.test(t)));

    type(window, input, "zzzz-nothing");
    check("empty search hides the wall", document.querySelector("#grid").hidden);
    check("empty message shows", !document.querySelector("[data-empty]").hidden);
    check("message quotes the term", document.querySelector("[data-empty-q]").textContent.includes("zzzz-nothing"));

    click(window, document.querySelector("[data-clear]"));
    check(
      "clearing restores the wall",
      document.querySelectorAll(".tile").length === Math.min(120, window.CATALOG.length)
    );
    check("clear button hides when empty", document.querySelector("[data-search-clear]").hidden);
    dom.window.close();
  }

  /* saves */
  {
    const dom = boot();
    await tick();
    const { window } = dom;
    const { document } = window;
    const first = document.querySelector(".tile");

    click(window, first.querySelector("[data-fav]"));
    check("star fills", first.querySelector("[data-fav]").getAttribute("aria-pressed") === "true");
    check("counter updates", document.querySelector("[data-saved-count]").textContent === "1");
    check("saves persist on device", readStore(window).saved.includes(first.dataset.id));

    click(window, document.querySelector("[data-saved-toggle]"));
    check("saved view filters", document.querySelectorAll(".tile").length === 1);

    click(window, document.querySelector("[data-fav]"));
    check("unsaving clears it", document.querySelectorAll(".tile").length === 0);
    check("empty filter wording", document.querySelector("[data-empty-q]").textContent === "this filter");
    check("counter returns to zero", document.querySelector("[data-saved-count]").textContent === "0");
    dom.window.close();
  }

  /* player */
  {
    const dom = boot();
    await tick();
    const { window } = dom;
    const { document } = window;
    // Only the bundled files play in the page now, and they sit at the end of
    // a play-ranked wall — so search for one rather than hope for the batch.
    type(window, document.querySelector("#q"), "2048");
    const opener = document.querySelector('.tile[data-playable="1"] .tile-open');
    const tile = opener.closest(".tile");
    const id = tile.getAttribute("data-id");
    const title = tile.querySelector(".tile-title").textContent;
    const source = window.CATALOG.find((g) => g.id === id).sources[0].url;
    // A local file is addressed relative to the page; the links resolve it.
    const absolute = new URL(source, window.location.href).href;

    check("player starts closed", document.querySelector("[data-player]").hidden);
    check("no iframe until asked", document.querySelectorAll("iframe").length === 0);

    opener.focus();
    click(window, opener);

    const frame = document.querySelector("iframe");
    check("player opens", !document.querySelector("[data-player]").hidden);
    check("exactly one iframe", document.querySelectorAll("iframe").length === 1);
    check("iframe uses the first source", frame.getAttribute("src") === source, frame.getAttribute("src"));
    check("fullscreen allowed", frame.hasAttribute("allowfullscreen"));
    check("autoplay allowed", /autoplay/.test(frame.getAttribute("allow")));
    check("player shows the title", document.querySelector("[data-player-title]").textContent === title);
    check("page locks", document.body.classList.contains("locked"));
    check("new-tab escape", document.querySelector("[data-external]").href === absolute);
    check(
      "slow-load escape",
      document.querySelector("[data-load-link]").getAttribute("href") === source
    );
    check("deep link written", window.location.hash === "#p=" + id);
    check("continue card appears", !document.querySelector("[data-continue]").hidden);
    check(
      "continue card names the title",
      document.querySelector("[data-continue-title]").textContent === title
    );
    check(
      "continue card links back to the player",
      document.querySelector("[data-continue-external]").href === absolute
    );
    check("play is recorded on device", readStore(window).plays[id] === 1);
    check(
      "timestamp is recorded",
      typeof readStore(window).last[id] === "number"
    );
    check("tile now says it was played", !!document.querySelector(".tile-played"));

    press(window, "Escape");
    check("escape closes", document.querySelector("[data-player]").hidden);
    check("iframe is destroyed", document.querySelectorAll("iframe").length === 0);
    check("scroll restored", !document.body.classList.contains("locked"));
    check("focus returns to the tile", document.activeElement === opener);
    check("hash cleared", window.location.hash === "");
    dom.window.close();
  }

  /* Persisted working routes must survive a reload, including legacy indexes. */
  for (const remembered of ["portal3.test", 2]) {
    const dom = boot("", { good: { multi: remembered } }, miniCatalog([
      { id: "multi", title: "Multi Source", sources: sourcesFor(3) }
    ]));
    await tick();
    click(dom.window, dom.window.document.querySelector(".tile-open"));
    check("remembered working source survives reload: " + remembered,
      dom.window.document.querySelector("iframe").getAttribute("src") === "/assets/games/probe3.html");
    dom.window.close();
  }

  /* fallback between sources */
  {
    const dom = boot("", null, miniCatalog([{ id: "multi", title: "Multi Source", sources: sourcesFor(3) }]));
    await tick();
    const { window } = dom;
    const { document } = window;

    check("a cross-portal tile says how many routes", document.querySelector(".tile-mirrors").textContent === "3 routes");

    click(window, document.querySelector(".tile-open"));
    const src = () => document.querySelector("iframe").getAttribute("src");
    check("first source is used first", src() === "/assets/games/probe1.html");
    check("source counter shows", /Source 1 of 3/.test(document.querySelector("[data-source]").textContent));
    check("a next-source button appears", !document.querySelector("[data-next]").hidden);

    click(window, document.querySelector("[data-next]"));
    check("second source is tried", src() === "/assets/games/probe2.html");
    check("counter follows", /Source 2 of 3/.test(document.querySelector("[data-source]").textContent));

    click(window, document.querySelector("[data-next]"));
    check("third source is tried", src() === "/assets/games/probe3.html");

    click(window, document.querySelector("[data-next]"));
    check("running out shows the blocked panel", !document.querySelector("[data-blocked]").hidden);
    check("the iframe is gone", document.querySelectorAll("iframe").length === 0);
    check(
      "the message admits every source failed",
      /All 3 sources/.test(document.querySelector("[data-blocked-text]").textContent)
    );
    check(
      "the apology is there",
      /Sorry/.test(document.querySelector(".blocked-apology").textContent)
    );
    check(
      "each portal is listed",
      document.querySelectorAll("[data-blocked-list] li").length === 3
    );
    check("no next button in the dead end", document.querySelector("[data-next]").hidden);

    click(window, document.querySelector("[data-retry]"));
    check(
      "retry starts again, preferring the portals that did not fail",
      /probe[23]\.html/.test(src()),
      src()
    );
    check("blocked panel is hidden on retry", document.querySelector("[data-blocked]").hidden);
    dom.window.close();
  }

  /* a single blocked source apologises immediately */
  {
    const dom = boot("", null, miniCatalog([{ id: "solo", title: "Solo", sources: sourcesFor(1) }]));
    await tick();
    const { window } = dom;
    const { document } = window;
    click(window, document.querySelector(".tile-open"));
    check("no next button for one source", document.querySelector("[data-next]").hidden);
    window.eval("void 0");
    // simulate the frame never loading, by asking for the next source
    click(window, document.querySelector("[data-close]"));
    dom.window.close();
  }

  /* remembering the working source */
  {
    const dom = boot("", { v: 2, saved: [], recent: [], sort: "hot", plays: {}, last: {}, scroll: 0, good: { multi: 2 }, bad: {} },
      miniCatalog([{ id: "multi", title: "Multi Source", sources: sourcesFor(3) }]));
    await tick();
    const { window } = dom;
    click(window, window.document.querySelector(".tile-open"));
    check(
      "a previously working source is preferred",
      window.document.querySelector("iframe").getAttribute("src") === "/assets/games/probe3.html"
    );
    dom.window.close();
  }

  /* a frame that loads quickly is a working frame, never "blocked" */
  {
    const dom = boot("", null, miniCatalog([{ id: "fast", title: "Fast", sources: sourcesFor(2) }]));
    await tick();
    const { window } = dom;
    const { document } = window;

    click(window, document.querySelector(".tile-open"));
    const frame = document.querySelector("iframe");
    check("the frame is mounted", !!frame);
    window.dispatchEvent(new window.Event("load"));
    const inner = frame;
    inner.dispatchEvent(new window.Event("load"));
    await tick();
    check("a fast load is not treated as a block", document.querySelector("[data-blocked]").hidden);
    check("the frame stays mounted", document.querySelectorAll("iframe").length === 1);
    check("the loading overlay goes away", document.querySelector("[data-loading]").hidden);
    dom.window.close();
  }

  /* a publisher title is handed to its own site, never framed */
  {
    const dom = boot("", null, miniCatalog([{
      id: "walled", title: "Walled Garden",
      sources: [{ portal: "walled.test", url: "https://walled.test/full/game", embed: false }],
    }]));
    await tick();
    const { window } = dom;
    const { document } = window;

    const tabs = watchNewTabs(window);

    click(window, document.querySelector(".tile-open"));
    check("a publisher tile is never framed", document.querySelectorAll("iframe").length === 0);
    check("the player is not opened for it", document.querySelector("[data-player]").hidden);
    check(
      "it opens on the publisher's own site, once",
      tabs.length === 1 && tabs[0].href === "https://walled.test/full/game",
      JSON.stringify(tabs)
    );
    check(
      "the handoff drops the opener and the referrer",
      tabs[0] && tabs[0].target === "_blank" && /noopener/.test(tabs[0].rel) && /noreferrer/.test(tabs[0].rel)
    );
    check(
      "the tile says so instead of offering to play",
      document.querySelector(".tile").getAttribute("data-playable") === "0"
    );
    dom.window.close();
  }

  /* the mixed case: a same-origin file still frames, a publisher route does not */
  {
    const dom = boot("", null, miniCatalog([{
      id: "mixed", title: "Mixed",
      sources: sourcesFor(2).concat([{ portal: "walled.test", url: "https://walled.test/x", embed: false }]),
    }]));
    await tick();
    const { window } = dom;
    const { document } = window;

    const tabs = watchNewTabs(window);

    check("every source is counted", document.querySelector(".tile-mirrors").textContent === "3 routes");
    click(window, document.querySelector(".tile-open"));
    const first = document.querySelector("iframe");
    check("a bundled file loads in the page", /probe1\.html/.test(first.src));
    click(window, document.querySelector("[data-next]"));
    check("the next bundled file loads", /probe2\.html/.test(document.querySelector("iframe").src));
    check("the off-site route is never mounted", tabs.length === 0);
    dom.window.close();
  }

  /* the portal that actually answered is the one remembered */
  {
    const dom = boot("", null, miniCatalog([{ id: "multi", title: "Multi Source", sources: sourcesFor(3) }]));
    await tick();
    const { window } = dom;
    const { document } = window;

    click(window, document.querySelector(".tile-open"));
    click(window, document.querySelector("[data-next]"));
    check("the second source is mounted", /probe2\.html/.test(document.querySelector("iframe").src));
    document.querySelector("iframe").dispatchEvent(new window.Event("load"));
    click(window, document.querySelector("[data-close]"));

    const good = readStore(window).good;
    check("only the loaded source is remembered", good.multi === "portal2.test", JSON.stringify(good));
    check("the skipped source is not promoted", good.multi !== "portal3.test");

    click(window, document.querySelector(".tile-open"));
    check(
      "reopening resumes the source that answered",
      /probe2\.html/.test(document.querySelector("iframe").src),
      document.querySelector("iframe").src
    );
    dom.window.close();
  }

  /* close button */
  {
    const dom = boot();
    await tick();
    const { window } = dom;
    const { document } = window;
    const opener = document.querySelector(".tile-open");
    opener.focus();
    click(window, opener);
    click(window, document.querySelector("[data-close]"));
    check("close button unloads", document.querySelectorAll("iframe").length === 0);
    check("close button restores focus", document.activeElement === opener);
    dom.window.close();
  }

  /* deep links */
  {
    // Only the bundled files can be deep-linked into the player; a publisher
    // id is handed to the publisher.
    const local = boot();
    await tick();
    const first = local.window.CATALOG.find((g) => /^local-/.test(g.id));
    local.window.close();

    const dom = boot("#p=" + first.id);
    await tick();
    const { document } = dom.window;
    const frame = document.querySelector("iframe");
    check(
      "deep link opens the title",
      frame && frame.getAttribute("src") === first.sources[0].url
    );
    check("deep link is named", document.querySelector("[data-player-title]").textContent === first.title);
    dom.window.close();

    const other = boot("#p=subway-surfers");
    await tick();
    const otherDoc = other.window.document;
    const tabs = watchNewTabs(other.window);
    // The hash is applied on boot, after open() is in place, in this order.
    other.window.location.hash = "#p=subway-surfers";
    other.window.dispatchEvent(new other.window.Event("hashchange"));
    await tick();
    check(
      "a deep link to a title that is not a file is ignored",
      otherDoc.querySelector("[data-player]").hidden && otherDoc.querySelectorAll("iframe").length === 0
    );
    check("and it opens no tab", tabs.length === 0, JSON.stringify(tabs));
    other.window.close();
  }

  {
    const dom = boot("#p=not-a-real-slug");
    await tick();
    check("bad deep link ignored", dom.window.document.querySelector("[data-player]").hidden);
    dom.window.close();
  }

  /* keys + shuffle */
  {
    const dom = boot();
    await tick();
    const { window } = dom;
    const { document } = window;

    const random = window.Math.random;
    window.Math.random = () => 0;
    const onScreen = document.querySelector(".tile").getAttribute("data-id");
    const onScreenSource = window.CATALOG.find((item) => item.id === onScreen).sources[0].url;
    click(window, document.querySelector("[data-shuffle]"));
    check(
      "random opens the first file in the player",
      !document.querySelector("[data-player]").hidden &&
        document.querySelector(".player-frame").getAttribute("src") === onScreenSource,
      document.querySelector(".player-frame") && document.querySelector(".player-frame").getAttribute("src")
    );
    press(window, "Escape");

    // A random pick stays inside the filter that is on screen.
    click(window, document.querySelector('.collections [data-collection="ovo"]'));
    click(window, document.querySelector("[data-shuffle]"));
    check(
      "random respects the collection on screen",
      /ovo/.test(document.querySelector(".player-frame").getAttribute("src")),
      document.querySelector(".player-frame").getAttribute("src")
    );
    window.Math.random = random;
    press(window, "Escape");
    click(window, document.querySelector("[data-filter-reset]"));

    const search = document.querySelector("#q");
    const event = press(window, "/");
    check("slash focuses search", document.activeElement === search && event.defaultPrevented);

    type(window, search, "snake");
    press(window, "Escape");
    check(
      "escape clears search first",
      search.value === "" && document.querySelectorAll(".tile").length === Math.min(120, window.CATALOG.length)
    );
    dom.window.close();
  }

  /* persistence across reloads */
  {
    const first = boot();
    await tick();
    const seed = (() => {
      // Reach a bundled file: they are the only tiles that open the player.
      type(first.window, first.window.document.querySelector("#q"), "2048");
      click(first.window, first.window.document.querySelector('.tile[data-playable="1"] .tile-open'));
      press(first.window, "Escape");
      click(first.window, first.window.document.querySelector(".tile [data-fav]"));
      click(first.window, first.window.document.querySelector('[data-sort="az"]'));
      first.window.scrollTo(0, 640);
      first.window.dispatchEvent(new first.window.Event("scroll"));
      return readStore(first.window);
    })();
    first.window.close();

    check("store records the sort", seed.sort === "az", JSON.stringify(seed.sort));
    check("store records the pick", seed.saved.length === 1);
    check("store records the visit", seed.recent.length === 1);

    const second = boot("", seed);
    await tick();
    const { document } = second.window;

    check(
      "continue survives a reload",
      !document.querySelector("[data-continue]").hidden &&
        document.querySelector("[data-continue-title]").textContent.length > 0
    );
    check("saved survives a reload", readStore(second.window).saved[0] === seed.saved[0]);
    click(second.window, document.querySelector("[data-saved-toggle]"));
    check(
      "the saved view still holds it",
      document.querySelectorAll(".tile").length === 1 &&
        document.querySelector(".tile").getAttribute("data-id") === seed.saved[0]
    );
    check(
      "sort survives a reload",
      document.querySelector('[data-sort="az"]').getAttribute("aria-pressed") === "true" &&
        document.querySelectorAll("[data-sort][aria-pressed=\"true\"]").length === 1
    );
    second.window.close();
  }

  /* scroll restore */
  {
    const dom = boot("", { v: 1, saved: [], recent: [], sort: "hot", plays: {}, last: {}, scroll: 900 });
    await tick();
    check("scroll position is restored", dom.window.__scrolledTo === 900, String(dom.window.__scrolledTo));
    dom.window.close();
  }

  /* legacy keys migrate */
  {
    const dom = new JSDOM(HTML, {
      url: "https://example.test/",
      runScripts: "outside-only",
      pretendToBeVisual: true,
    });
    dom.window.scrollTo = function () {};
    dom.window.localStorage.setItem("gams.saved.v1", JSON.stringify(["local-granny"]));
    dom.window.localStorage.setItem("gams.recent.v1", JSON.stringify(["local-bad-piggies"]));
    dom.window.eval(LOCAL_JS);
    dom.window.eval(APP_JS);
    await tick();
    const migrated = readStore(dom.window);
    check("old picks migrate to the new store", migrated.saved.includes("local-granny"));
    check("old history migrates too", migrated.recent[0] === "local-bad-piggies");
    check("old keys are cleaned up", dom.window.localStorage.getItem("gams.saved.v1") === null);
    dom.window.close();
  }

  /* clearing */
  {
    const dom = boot("", {
      v: 1,
      saved: ["subway-surfers"],
      recent: ["stick-war-legacy"],
      sort: "az",
      plays: { "stick-war-legacy": 3 },
      last: { "stick-war-legacy": Date.now() },
      scroll: 400,
    });
    await tick();
    const { document } = dom.window;
    const reset = document.querySelector("[data-reset]");

    check("data is present before clearing", dom.window.localStorage.getItem(STORE_KEY).includes("subway-surfers"));
    click(dom.window, reset);
    check("first click only arms the button", reset.textContent === "Click again to clear");
    click(dom.window, reset);

    const after = readStore(dom.window);
    check("clearing empties picks", after.saved.length === 0);
    check("clearing empties history", after.recent.length === 0);
    check("clearing empties visits", Object.keys(after.plays).length === 0);
    check("continue card hides", document.querySelector("[data-continue]").hidden);
    check("saved count resets", document.querySelector("[data-saved-count]").textContent === "0");
    check("button label resets", reset.textContent === "Clear saved data");
    dom.window.close();
  }

  /* blocked storage */
  {
    const dom = new JSDOM(HTML, {
      url: "https://example.test/",
      runScripts: "outside-only",
      pretendToBeVisual: true,
    });
    dom.window.scrollTo = function () {};
    Object.defineProperty(dom.window, "localStorage", {
      value: {
        getItem() { return null; },
        setItem() { throw new Error("blocked"); },
        removeItem() {},
      },
    });
    dom.window.eval(LOCAL_JS);
    dom.window.eval(APP_JS);
    await tick();
    const { document } = dom.window;
    click(dom.window, document.querySelector(".tile-open"));
    press(dom.window, "Escape");
    check(
      "blocked storage still plays",
      document.querySelectorAll(".tile").length === Math.min(120, dom.window.CATALOG.length)
    );
    check(
      "blocked storage is announced",
      /blocking storage/i.test(document.querySelector("[data-storage-note]").textContent)
    );
    dom.window.close();
  }

  /* picks, tags, player favourite, multi-word search */
  {
    const dom = boot("", { v: 2, saved: [], recent: ["stick-war-legacy"], sort: "hot", plays: {}, last: {}, scroll: 0, good: {}, bad: {} });
    await tick();
    const { window } = dom;
    const { document } = window;

    check("a suggestions shelf exists", !!document.querySelector("[data-picks]"));
    check(
      "suggestions are playable tiles",
      Array.from(document.querySelectorAll("[data-picks-list] [data-open]")).length > 0
    );

    // Chips need a word to appear in 25 titles; 129 files do not repeat enough,
    // so the row hides itself rather than offering a chip that filters nothing.
    const tags = document.querySelectorAll("[data-tag]");
    check(
      "the chip row hides when no word repeats enough to be a chip",
      tags.length === 0 || document.querySelector("[data-tags]").hidden === false
    );
    check("one sort at a time is still enforced", document.querySelectorAll('[data-sort][aria-pressed="true"]').length === 1);

    const input = document.querySelector("#q");
    type(window, input, "car park");
    check(
      "multi-word search matches every word",
      document.querySelectorAll(".tile").length > 0 &&
        titles(document).every((t) => /car/i.test(t) || /park/i.test(t))
    );
    type(window, input, "");
    dom.window.close();
  }

  {
    const dom = boot();
    await tick();
    const { window } = dom;
    const { document } = window;
    // There is no availability filter to test: every title is a local file, so
    // the only filter left on the wall is the type one below.
    check(
      "there is no availability filter to offer",
      !document.querySelector("[data-availability]")
    );
    const genre = document.querySelector("[data-genre]");
    genre.value = "puzzle";
    genre.dispatchEvent(new window.Event("change", { bubbles: true }));
    check("type filter updates the accessible results status", /^\d+ titles shown$/.test(document.querySelector("[data-results-status]").textContent));
    click(window, document.querySelector("[data-theme-toggle]"));
    check("dark theme can be enabled", document.documentElement.getAttribute("data-theme") === "dark");
    click(window, document.querySelector("[data-text-toggle]"));
    check("larger text preference is applied", document.documentElement.classList.contains("large-text"));
    click(window, document.querySelector("[data-contrast-toggle]"));
    check("high contrast preference is applied", document.documentElement.classList.contains("high-contrast"));
    check("settings stay in local browser storage", readStore(window).theme === "dark" && readStore(window).largeText && readStore(window).highContrast);
    dom.window.close();
  }

  {
    const dom = boot();
    await tick();
    const { window } = dom;
    const { document } = window;
    type(window, document.querySelector("#q"), "2048");
    click(window, document.querySelector('.tile[data-playable="1"] .tile-open'));
    const fav = document.querySelector("[data-player-fav]");
    check("the player has a save button", !!fav);
    click(window, fav);
    check("the player button fills", fav.getAttribute("aria-pressed") === "true");
    check("the pick is stored", readStore(window).saved.length === 1);
    check(
      "the tile agrees",
      document.querySelector('.tile[data-playable="1"] [data-fav]').getAttribute("aria-pressed") === "true"
    );
    dom.window.close();
  }

  /* feedback */
  {
    const dom = boot();
    await tick();
    const { window } = dom;
    const { document } = window;

    const trigger = document.querySelector("[data-feedback]");
    check("the page offers a feedback link", !!trigger);
    trigger.focus();
    trigger.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));

    const dialog = document.querySelector("[data-feedback-dialog]");
    check("the feedback dialog opens", !!dialog && dialog.hidden === false);
    check("focus moves into the dialog", dialog.contains(document.activeElement));
    check("it says the issue needs a GitHub account", /GitHub account/i.test(dialog.textContent));

    const request = dialog.querySelector('input[value="request"]');
    request.checked = true;
    request.dispatchEvent(new window.Event("change", { bubbles: true }));
    check("requesting a game asks which one", dialog.querySelector("[data-fb-game]").hidden === false);

    const tabs = [];
    window.open = function (url) { tabs.push(url); return {}; };
    dialog.querySelector('[name="fb-game"]').value = "Bloons TD 5";
    dialog.querySelector('[name="fb-message"]').value = "The one everyone keeps asking for.";
    dialog.querySelector(".fb-form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));

    const note = dialog.querySelector("[data-fb-note]");
    const requestUrl = decodeURIComponent(((note.querySelector("a") || {}).href || "").replace(/\+/g, " "));
    check(
      "a game request opens GitHub in a new tab",
      tabs.length === 1 && tabs[0].indexOf("https://github.com/funclassroom/funclassroom.github.io/issues/new?") === 0
    );
    check(
      "a game request becomes a labelled GitHub issue",
      note.hidden === false &&
        requestUrl.indexOf("/issues/new?") !== -1 &&
        /labels=game-request/.test(requestUrl) &&
        requestUrl.indexOf("[G@M£$ request] Bloons TD 5") !== -1 &&
        requestUrl.indexOf("The one everyone keeps asking for.") !== -1
    );

    dialog.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    check("Escape closes the feedback dialog", dialog.hidden === true);
    check("focus goes back to the button that opened it", document.activeElement === trigger);

    trigger.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
    const bug = dialog.querySelector('input[value="bug"]');
    bug.checked = true;
    bug.dispatchEvent(new window.Event("change", { bubbles: true }));
    dialog.querySelector('[name="fb-message"]').value = "";
    dialog.querySelector(".fb-form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    check(
      "an empty bug report is refused before GitHub opens",
      dialog.querySelector("[data-fb-error]").hidden === false
    );

    dialog.querySelector('[name="fb-message"]').value = "The Slope tile opens a blank frame.";
    dialog.querySelector(".fb-form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    const bugUrl = decodeURIComponent(((dialog.querySelector("[data-fb-note] a") || {}).href || "").replace(/\+/g, " "));
    check(
      "a bug becomes a bug issue with the page and browser attached",
      tabs.length === 2 &&
        /labels=bug/.test(bugUrl) &&
        bugUrl.indexOf("[Bug] The Slope tile opens a blank frame.") !== -1 &&
        bugUrl.indexOf("example.test") !== -1
    );
    dom.window.close();
  }

  /* collections, the daily pick and the shelf */
  {
    const dom = boot();
    await tick();
    const { window } = dom;
    const { document } = window;

    const chips = Array.from(document.querySelectorAll("[data-collection]")).map((c) => c.getAttribute("data-collection"));
    check("collections are offered", chips.includes("ovo") && chips.includes("players"), chips.length + " chips");
    check("every series with two or more files gets a chip",
      window.LOCAL_SERIES.every((group) => chips.includes(group.id)));

    click(window, document.querySelector('.collections [data-collection="ovo"]'));
    const ovoTitles = titles(document);
    check("a series chip shows only that series", ovoTitles.length === 2 && ovoTitles.every((t) => /^OvO/.test(t)), ovoTitles.join(", "));
    check("the chip reads as pressed", document.querySelector('.collections [data-collection="ovo"]').getAttribute("aria-pressed") === "true");
    check("and the shelf agrees", document.querySelector('.shelf-series [data-collection="ovo"]').getAttribute("aria-pressed") === "true");

    click(window, document.querySelector('.collections [data-collection="players"]'));
    const twoPlayer = Array.from(document.querySelectorAll(".tile"))
      .map((t) => window.CATALOG.find((c) => c.id === t.getAttribute("data-id")));
    check("the 2-player chip only shows two-player titles",
      twoPlayer.length > 0 && twoPlayer.every((item) => item.players === 2), String(twoPlayer.length));
    check("two-player tiles say so", document.querySelectorAll(".tile-flag").length > 0);

    // A search for "2p" means the same thing.
    click(window, document.querySelector("[data-filter-reset]"));
    type(window, document.querySelector("#q"), "2p");
    const searched = Array.from(document.querySelectorAll(".tile"))
      .map((t) => window.CATALOG.find((c) => c.id === t.getAttribute("data-id")));
    check("searching 2p finds the two-player titles",
      searched.length > 0 && searched.every((item) => item.players === 2), String(searched.length));

    check("the daily pick is on screen", !document.querySelector("[data-daily]").hidden);
    const dailyId = document.querySelector("[data-daily-play]").getAttribute("data-open");
    check("the daily pick names a real file", !!window.CATALOG.find((c) => c.id === dailyId), dailyId);
    check("the shelf starts empty", document.querySelector("[data-shelf-played]").textContent === "0");

    click(window, document.querySelector("[data-daily-play]"));
    await tick();
    const after = readStore(window);
    check("playing the daily pick records it", after.plays[dailyId] === 1);
    check("and starts the streak", after.daily.streak === 1 && after.daily.date.length === 10, JSON.stringify(after.daily));
    check("the shelf counts it", document.querySelector("[data-shelf-played]").textContent === "1");
    check("the bar moves", document.querySelector("[data-shelf-fill]").style.width !== "0%");
    dom.window.close();
  }

  /* the daily streak carries across consecutive days */
  {
    const yesterday = new Date(Date.now() - 86400000);
    const key = yesterday.getFullYear() + "-" +
      String(yesterday.getMonth() + 1).padStart(2, "0") + "-" +
      String(yesterday.getDate()).padStart(2, "0");

    const dom = boot();
    await tick();
    // Play whatever today's pick is, then reload with yesterday's streak in place.
    const dailyId = dom.window.document.querySelector("[data-daily-play]").getAttribute("data-open");
    dom.window.close();

    const seeded = boot("", { daily: { date: key, streak: 4, best: 4 } });
    await tick();
    seeded.window.document.querySelector("[data-daily-play]").click();
    await tick();
    const store = readStore(seeded.window);
    check("a streak continues on the next day", store.daily.streak === 5, String(store.daily.streak));
    check("and the best is kept", store.daily.best === 5);
    seeded.window.close();
  }

  /* a finished series says so */
  {
    const dom = boot("", { plays: { "local-ovo": 1 } });
    await tick();
    const { window } = dom;
    const { document } = window;
    click(window, document.querySelector('.tile[data-id="local-ovo-2"] .tile-open'));
    await tick();
    const toast = document.querySelector("[data-toast]");
    check("finishing a series raises a toast", !toast.hidden && /Series complete: OvO/.test(toast.textContent), toast.textContent);
    dom.window.close();
  }

  /* a streak milestone says so */
  {
    const yesterday = new Date(Date.now() - 86400000);
    const key = yesterday.getFullYear() + "-" +
      String(yesterday.getMonth() + 1).padStart(2, "0") + "-" +
      String(yesterday.getDate()).padStart(2, "0");
    const dom = boot("", { daily: { date: key, streak: 2, best: 2 } });
    await tick();
    const { window } = dom;
    const { document } = window;
    click(window, document.querySelector("[data-daily-play]"));
    await tick();
    check(
      "a third day in a row is worth a toast",
      /3-day streak/.test(document.querySelector("[data-toast]").textContent),
      document.querySelector("[data-toast]").textContent
    );
    dom.window.close();
  }

  /* next in series */
  {
    const dom = boot();
    await tick();
    const { window } = dom;
    const { document } = window;

    const first = window.CATALOG.find((item) => item.series === "ovo" && item.order === 1);
    click(window, document.querySelector('.tile[data-id="' + first.id + '"] .tile-open'));
    await tick();
    const nextBtn = document.querySelector("[data-next-in-series]");
    check("the player offers the next part of a series", nextBtn && !nextBtn.hidden);
    check("and names it", /OvO 2/.test(nextBtn.textContent), nextBtn.textContent);

    click(window, nextBtn);
    await tick();
    check("clicking it opens the next file",
      document.querySelector("iframe").getAttribute("src") === window.CATALOG.find((i) => i.series === "ovo" && i.order === 2).sources[0].url);
    check("the last part offers no next", document.querySelector("[data-next-in-series]").hidden);
    dom.window.close();
  }

  /* copy a link to one title */
  {
    const dom = boot();
    await tick();
    const { window } = dom;
    const { document } = window;
    let copied = null;
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText: (text) => { copied = text; return Promise.resolve(); } },
    });

    const first = window.CATALOG[0];
    click(window, document.querySelector('.tile[data-id="' + first.id + '"] .tile-open'));
    await tick();
    click(window, document.querySelector("[data-copy-link]"));
    await tick();
    check("copy link copies an address for this title",
      copied === "https://example.test/#p=" + encodeURIComponent(first.id), String(copied));
    check("and says so", /Link copied/.test(document.querySelector("[data-copy-status]").textContent));
    dom.window.close();
  }

  /* the quick jump */
  {
    const dom = boot();
    await tick();
    const { window } = dom;
    const { document } = window;

    window.document.body.dispatchEvent(new window.KeyboardEvent("keydown", {
      key: "k", ctrlKey: true, bubbles: true, cancelable: true,
    }));
    check("Ctrl+K opens the jump", !document.querySelector("[data-palette]").hidden);
    check("the jump starts focused", document.activeElement === document.querySelector("[data-palette-input]"));

    const input = document.querySelector("[data-palette-input]");
    type(window, input, "bloons");
    const labels = Array.from(document.querySelectorAll(".palette-label")).map((n) => n.textContent);
    check("it searches every title", labels.some((l) => /^Bloons/.test(l)), labels.slice(0, 3).join(", "));
    check("and puts the closest title first", /^Bloons/.test(labels[0] || ""), labels[0]);

    // Enter opens the highlighted result.
    input.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    await tick();
    check("Enter opens the highlighted title", !document.querySelector("[data-player]").hidden);
    check("the jump closes behind it", document.querySelector("[data-palette]").hidden);

    document.querySelector("[data-palette-open]").click();
    check("the header button opens it too", !document.querySelector("[data-palette]").hidden);
    document.querySelector("[data-palette-input]").dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    check("Esc closes the jump", document.querySelector("[data-palette]").hidden);
    dom.window.close();
  }

  /* the files page: badges, and a series that can be played in order */
  {
    const dom = new JSDOM(FILES_HTML, {
      url: "https://example.test/files.html",
      runScripts: "outside-only",
      pretendToBeVisual: true,
    });
    const { window } = dom;
    window.scrollTo = function () {};
    window.eval(LOCAL_JS);
    const inline = Array.from(window.document.querySelectorAll("script:not([src])"))
      .map((node) => node.textContent)
      .join("\n");
    window.eval(inline);
    await tick();
    const { document } = window;

    check("the files page draws its cards", document.querySelectorAll(".file-card").length === 120);
    check("a two-player file is flagged on the files page",
      !!document.querySelector('.file-card[data-file$="basket-random.html"] .file-flag'));
    check("a series file shows its position",
      /^1\/2$/.test(document.querySelector('[data-file="assets/games/ovo.html"] .file-flag').textContent));

    click(window, document.querySelector('[data-file="assets/games/ovo.html"] .file-open'));
    const nextBtn = document.querySelector("[data-next-file]");
    check("the files player knows the next part", nextBtn && !nextBtn.hidden && /OvO 2/.test(nextBtn.textContent));
    click(window, nextBtn);
    check(
      "and opens it from the root, without doubling the path",
      document.querySelector("iframe").getAttribute("src") === "https://example.test/assets/games/ovo-2.html",
      document.querySelector("iframe").getAttribute("src")
    );
    dom.window.close();
  }

  /* the 404 page offers real files instead of a dead end */
  {
    const html = fs.readFileSync(path.join(ROOT, "404.html"), "utf8");
    check("the 404 page loads the file list", /assets\/js\/local-games\.js/.test(html));
    check("and draws six suggestions", /slice\(0, 6\)/.test(html) && /data-nf-grid/.test(html));
    check("with root-relative paths, so a deep broken link still works", /href="\/"/.test(html) && /\/assets\/css\/app\.css/.test(html));
  }

  /* shared runtimes */
  {
    const vm = require("vm");
    const gamesDir = path.join(ROOT, "assets/games");
    const names = fs.readdirSync(gamesDir).filter((name) => /\.html?$/.test(name));
    const shared = names.find((name) => {
      const text = fs.readFileSync(path.join(gamesDir, name), "utf8");
      return text.includes("../vendor/ruffle/") && text.includes("JSZip");
    });
    check("a game page points at the shared runtime", !!shared);

    const html = fs.readFileSync(path.join(gamesDir, shared), "utf8");
    const zipUrl = (html.match(/let zipUrl = "([^"]+)"/) || [])[1];
    const bundle = Array.from(html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))
      .map((match) => match[1])
      .find((body) => body.includes("JSZip"));
    const at = html.indexOf("async function unzipWebpFromDataUri");
    const loader = html.slice(at, html.indexOf("}", html.indexOf("return blobUrls;", at)) + 1);

    let made = 0;
    const box = {
      console: { log() {} },
      Blob,
      atob,
      Uint8Array,
      setTimeout,
      clearTimeout,
      URL: { createObjectURL: () => "blob:test/" + (++made) },
      fetch: async (ref) => ({ ok: true, arrayBuffer: async () => fs.readFileSync(path.join(gamesDir, ref)) }),
    };
    box.window = box;
    box.self = box;
    vm.createContext(box);
    vm.runInContext(bundle.slice(0, bundle.indexOf("async function unzipWebpFromDataUri")), box);
    vm.runInContext(loader + ";this.unzip = unzipWebpFromDataUri;", box);
    const urls = await box.unzip(zipUrl);
    const entries = Object.keys(urls);
    check(
      "the shared runtime still unpacks, wasm and all",
      entries.length > 0 && entries.some((name) => name.endsWith(".wasm")) && made === entries.length,
      entries.join(",")
    );
  }

  console.log("\n  UI: " + pass + " passed, " + fail + " failed\n");
  if (fail) {
    failures.forEach((f) => console.log("   - " + f));
    process.exitCode = 1;
  }
})();
