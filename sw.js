/* GitHub Pages-only offline shell and explicitly saved local games. */
const VERSION = "classroom-shell-v19";
const GAME_CACHE = "classroom-offline-games-v1";
/* Ad and auction networks that came bundled inside some of the game files
   (doubleclick, googlesyndication and adnxs are all present today). Blocking
   happens here rather than in an extension, so it applies to every visitor,
   needs nothing installed, and only touches requests made by this site.

   Deliberately absent: clarity.ms and everything under it, because Clarity is
   the site's analytics and must keep working, and jsdelivr, which some game
   files load their runtime from — blocking it would stop games loading rather
   than stop ads. No other host is on the allow side, so nothing else off-site
   is requested by the pages this worker controls.

   The empty 204 is deliberate: a game that watches for a blocked request (ovo
   does, through adinplay) only raises its "adblock detected" flag when the
   status is 0. A 204 looks like a real answer, so the game carries on instead
   of putting up a disable-your-blocker wall. */
const BLOCKED_HOSTS = [
  "2mdn.net",
  "adinplay.com",
  "adnxs.com",
  "adsafeprotected.com",
  "adsrvr.org",
  "advertising.com",
  "amazon-adsystem.com",
  "criteo.com",
  "criteo.net",
  "doubleclick.net",
  "googleadservices.com",
  "googlesyndication.com",
  "googletagservices.com",
  "gamepix.com",
  "imasdk.googleapis.com",
  "moatads.com",
  "outbrain.com",
  "pubmatic.com",
  "quantserve.com",
  "rubiconproject.com",
  "scorecardresearch.com",
  "taboola.com",
  "zedo.com"
];
const isBlocked = (host) => BLOCKED_HOSTS.some((blocked) => host === blocked || host.slice(-blocked.length - 1) === "." + blocked);

/* Last resort: shown only if a page was never stored and the network answers
   with nothing usable. Same skin, same way back. */
const OFFLINE_PAGE = [
  "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">",
  "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">",
  "<title>Saved later - Classroom</title><style>",
  "body{margin:0;font:16px/1.5 system-ui,sans-serif;background:#fbfbfc;color:#16181d;",
  "display:grid;place-items:center;min-height:100vh;padding:24px}",
  "main{max-width:34rem}a{color:#1a6ee0}</style></head><body><main>",
  "<h1>This page is not on this device yet.</h1>",
  "<p>Open the site once with the network on, then use <b>Save all for offline</b> ",
  "on the files page and every G@M£$ comes with it.</p>",
  "<p><a href=\"./\">Back to the list</a></p>",
  "</main></body></html>",
].join("");

const SHELL = ["./", "index.html", "files.html", "manifest.webmanifest", "assets/css/app.css", "assets/js/local-games.js", "assets/js/app.js", "assets/js/feedback.js", "assets/js/pwa.js", "assets/js/attribution.js", "assets/img/app-icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.indexOf("classroom-") === 0 && key !== VERSION && key !== GAME_CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Cross-origin requests from a controlled page pass through here too, which
  // is what lets one file cover the wall, the files page and every bundled
  // game. A blocked host gets an empty answer, so the page carries on without
  // the ad instead of hanging on a failed request.
  if (isBlocked(url.hostname)) {
    event.respondWith(new Response(null, { status: 204, statusText: "Blocked" }));
    return;
  }
  if (url.origin !== self.location.origin) return;
  const scope = new URL(self.registration.scope);
  if (!url.pathname.startsWith(scope.pathname)) return;
  const isGame = url.pathname.indexOf(scope.pathname + "assets/games/") === 0;
  if (isGame) {
    event.respondWith(caches.open(GAME_CACHE).then((cache) => cache.match(request).then((cached) => cached || fetch(request))));
    return;
  }
  if (request.mode === "navigate") {
    // A page this browser has already opened is served from its own cache and
    // refreshed in the background. That is the promise the site makes: once it
    // has been loaded, it opens whether the network is slow, absent, or
    // answering with a page that is not this one. The address is unchanged and
    // nothing is disguised - the browser simply does not ask again.
    const fresh = fetch(request).then((response) => {
      if (response && response.ok) caches.open(VERSION).then((cache) => cache.put(request, response.clone()));
      return response;
    }).catch(() => null);
    event.waitUntil(fresh);
    event.respondWith(caches.open(VERSION).then((cache) =>
      cache.match(request, { ignoreSearch: true }).then((cached) =>
        cached || fresh.then((response) =>
          response ||
          cache.match(new URL("index.html", scope).href, { ignoreSearch: true }).then((shell) =>
            shell || new Response(OFFLINE_PAGE, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } })
          )
        )
      )
    ));
    return;
  }
  // Same rule for the page's own files: answer from the copy this browser
  // already has and refresh it behind the scenes, so a deploy reaches people
  // on their next visit instead of never.
  event.respondWith(caches.open(VERSION).then((cache) =>
    cache.match(request, { ignoreSearch: true }).then((cached) => {
      const fresh = fetch(request).then((response) => {
        if (response && response.ok) cache.put(request, response.clone());
        return response;
      }).catch(() => null);
      if (cached) { event.waitUntil(fresh); return cached; }
      return fresh.then((response) => response || Response.error());
    })
  ));
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  const port = event.ports && event.ports[0];
  const reply = (value) => { if (port) port.postMessage(value); };
  const scope = new URL(self.registration.scope);
  // A page may lean on a runtime kept once for the whole folder. Saving the
  // game offline has to bring that copy along, or the saved page starts blank
  // with the network off. The copy is left in place when a game is removed:
  // other saved games may be using the same file.
  const sharedDeps = (gameUrl, markup) =>
    Array.from(new Set(markup.match(/\.\.\/vendor\/[A-Za-z0-9._/-]+\.zip/g) || []))
      .map((ref) => new URL(ref, gameUrl))
      .filter((dep) => dep.origin === scope.origin && dep.pathname.startsWith(scope.pathname + "assets/vendor/"))
      .map((dep) => dep.href);
  const cacheGame = (path) => {
    if (typeof path !== "string" || !/^assets\/games\/[a-zA-Z0-9._-]+\.html?$/.test(path)) return Promise.reject(new Error("Invalid local game path"));
    const url = new URL(path, scope);
    if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname + "assets/games/")) return Promise.reject(new Error("Outside site scope"));
    return caches.open(GAME_CACHE).then((cache) => fetch(url.href).then((response) => {
      if (!response.ok) throw new Error("Download failed (" + response.status + ")");
      const copy = response.clone();
      return response.text().then((markup) => {
        const deps = sharedDeps(url, markup);
        return cache.put(url.href, copy)
          .then(() => Promise.all(deps.map((dep) => cache.add(dep))))
          .then(() => ({ ok: true, shared: deps.length }));
      });
    }));
  };
  if (data.type === "CACHE_GAME") {
    event.waitUntil(cacheGame(data.path).then(reply).catch((error) => reply({ ok: false, error: error.message || "Could not save this file" })));
  } else if (data.type === "REMOVE_GAME") {
    event.waitUntil(caches.open(GAME_CACHE).then((cache) => cache.delete(new URL(data.path, scope).href)).then((removed) => reply({ ok: true, removed })));
  } else if (data.type === "CHECK_GAME") {
    event.waitUntil(caches.open(GAME_CACHE).then((cache) => cache.match(new URL(data.path, scope).href)).then((match) => reply({ ok: true, cached: !!match })));
  } else if (data.type === "CLEAR_GAMES") {
    event.waitUntil(caches.delete(GAME_CACHE).then((removed) => reply({ ok: true, removed })));
  }
});
