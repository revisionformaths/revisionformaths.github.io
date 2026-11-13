/* Classroom — one tile per game, several sources behind each tile.
   A source marked non-embeddable opens in a new tab and never enters the
   iframe; if every route refuses to load, the player says so and apologises.
   The loading card stays up until the frame answers, so a slow or blocked
   game is never a silent black screen. */
(function () {
  "use strict";

  var ALL = (window.CATALOG || []).slice();
  // The wall is the file list: there is no second, streamed copy of a title
  // for a local version to be marked off against any more.
  (window.LOCAL_GAMES || []).forEach(function (game) {
    var slug = game.file.split("/").pop().replace(/\.html?$/, "");
    ALL.push({
      id: "local-" + slug,
      title: game.title,
      description: game.line || "A self-contained HTML G@M£$ stored with this site.",
      local: true,
      rating: 0,
      plays: 0,
      // The hand-picked local file. It is the one title the wall leads
      // with; the words are what a search for it looks like.
      featured: game.featured === true,
      keywords: game.featured === true
        ? game.title.toLowerCase().split(/[^a-z0-9]+/).filter(function (word) {
            return word.length > 2;
          })
        : [],
      thumb: "assets/img/pack/" + slug + ".jpg",
      series: game.series || null,
      order: game.order || 0,
      players: game.players || 1,
      sources: [{ portal: "Local HTML", url: game.file, embed: true }]
    });
  });
  window.CATALOG = ALL;
  var BY_ID = {};
  ALL.forEach(function (item) { BY_ID[item.id] = item; });
  var FEATURED = ALL.filter(function (item) { return item.featured; });

  /* Curated series, and the two-player flags, come from data/local-files.json
     through the generated list. A series is only offered when at least two of
     its files are actually here, so a half-mirrored series cannot promise a
     "next" that does not exist. */
  var SERIES = (window.LOCAL_SERIES || []).slice();
  var SERIES_BY_ID = {};
  var SERIES_MEMBERS = {};
  SERIES.forEach(function (group) { SERIES_BY_ID[group.id] = group; });
  ALL.forEach(function (item) {
    if (!item.series || !SERIES_BY_ID[item.series]) { item.series = null; return; }
    (SERIES_MEMBERS[item.series] = SERIES_MEMBERS[item.series] || []).push(item);
  });
  SERIES = SERIES.filter(function (group) {
    var members = SERIES_MEMBERS[group.id] || [];
    members.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    return members.length > 1;
  });
  var SERIES_LIST = SERIES;
  var TWO_PLAYER = ALL.filter(function (item) { return item.players === 2; });

  var KEY = "classroom.state.v1";
  var LEGACY_SAVED = "gams.saved.v1";
  var LEGACY_RECENT = "gams.recent.v1";
  var MAX_RECENT = 8;
  var SLOW_LOAD_MS = 12000;
  var EAGER_IMAGES = 24;
  var BATCH = 120;
  var SCROLL_SAVE_MS = 350;
  var EXIT_URL = "https://classroom.google.com/";

  /* Tab cloaks: the tab can look like Classroom, Google or Docs.
     Classroom is the default, so a fresh visit always opens disguised. */
  var CLOAKS = {
    classroom: {
      title: "Classroom",
      icon: "data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20viewBox%3D%270%200%2064%2064%27%3E%3Crect%20width%3D%2764%27%20height%3D%2764%27%20rx%3D%2713%27%20fill%3D%27%230F9D58%27%2F%3E%3Crect%20x%3D%2711.5%27%20y%3D%2715.5%27%20width%3D%2741%27%20height%3D%2733%27%20rx%3D%273.5%27%20fill%3D%27none%27%20stroke%3D%27%23fff%27%20stroke-width%3D%273%27%2F%3E%3Ccircle%20cx%3D%2725%27%20cy%3D%2727%27%20r%3D%274.3%27%20fill%3D%27%23F4B400%27%2F%3E%3Cpath%20d%3D%27M17.2%2041.5c0-4.5%203.5-7.2%207.8-7.2s7.8%202.7%207.8%207.2z%27%20fill%3D%27%23F4B400%27%2F%3E%3Crect%20x%3D%2737.6%27%20y%3D%2723%27%20width%3D%274.2%27%20height%3D%2718.5%27%20rx%3D%272.1%27%20fill%3D%27%234285F4%27%2F%3E%3Crect%20x%3D%2745%27%20y%3D%2723%27%20width%3D%274.2%27%20height%3D%2718.5%27%20rx%3D%272.1%27%20fill%3D%27%23DB4437%27%2F%3E%3C%2Fsvg%3E"
    },
    google: {
      title: "Google",
      icon: "data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20viewBox%3D%270%200%2064%2064%27%3E%3Ccircle%20cx%3D%2732%27%20cy%3D%2732%27%20r%3D%2730%27%20fill%3D%27%23ffffff%27%2F%3E%3Ctext%20x%3D%2732%27%20y%3D%2745%27%20font-family%3D%27Arial%27%20font-size%3D%2736%27%20font-weight%3D%27bold%27%20text-anchor%3D%27middle%27%20fill%3D%27%234285F4%27%3EG%3C%2Ftext%3E%3C%2Fsvg%3E"
    },
    docs: {
      title: "Google Docs",
      icon: "data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20viewBox%3D%270%200%2064%2064%27%3E%3Crect%20width%3D%2764%27%20height%3D%2764%27%20rx%3D%2713%27%20fill%3D%27%234285F4%27%2F%3E%3Crect%20x%3D%2718%27%20y%3D%2712%27%20width%3D%2728%27%20height%3D%2740%27%20rx%3D%273%27%20fill%3D%27%23ffffff%27%2F%3E%3Crect%20x%3D%2723%27%20y%3D%2719%27%20width%3D%2718%27%20height%3D%274%27%20rx%3D%272%27%20fill%3D%27%234285F4%27%2F%3E%3Crect%20x%3D%2723%27%20y%3D%2727%27%20width%3D%2718%27%20height%3D%274%27%20rx%3D%272%27%20fill%3D%27%239ec1ff%27%2F%3E%3Crect%20x%3D%2723%27%20y%3D%2735%27%20width%3D%2718%27%20height%3D%274%27%20rx%3D%272%27%20fill%3D%27%239ec1ff%27%2F%3E%3Crect%20x%3D%2723%27%20y%3D%2743%27%20width%3D%2712%27%20height%3D%274%27%20rx%3D%272%27%20fill%3D%27%239ec1ff%27%2F%3E%3C%2Fsvg%3E"
    }
  };

  var state = {
    q: "",
    sort: "hot",
    savedOnly: false,
    tag: "",
    collection: "",
    availability: "all",
    paletteIndex: 0,
    paletteItems: [],
    genre: "all",
    active: null,
    sourceIndex: 0,
    lastFocus: null,
    lastFocusId: null,
    persist: true,
    loaded: false
  };

  var dom = {};
  var store = loadStore();

  /* ---------- storage ---------- */

  function isId(value) {
    return typeof value === "string" && value.length > 0 && value.length < 120;
  }

  function emptyStore() {
    return {
      v: 2, saved: [], recent: [], sort: "hot", cloak: "classroom", theme: "light", largeText: false, highContrast: false,
      plays: {}, last: {}, scroll: 0, good: {}, bad: {},
      daily: { date: "", streak: 0, best: 0 }
    };
  }

  function loadStore() {
    var fresh = emptyStore();
    var raw = null;

    try { raw = JSON.parse(window.localStorage.getItem(KEY)); } catch (err) { raw = null; }

    if (!raw || typeof raw !== "object") return migrate();

    if (Array.isArray(raw.saved)) fresh.saved = raw.saved.filter(isId);
    if (Array.isArray(raw.recent)) fresh.recent = raw.recent.filter(isId).slice(0, MAX_RECENT);
    if (/^(hot|top|az|low)$/.test(raw.sort)) fresh.sort = raw.sort;
    if (typeof raw.cloak === "string" && CLOAKS[raw.cloak]) fresh.cloak = raw.cloak;
    if (raw.theme === "dark") fresh.theme = "dark";
    fresh.largeText = raw.largeText === true;
    fresh.highContrast = raw.highContrast === true;
    if (typeof raw.scroll === "number" && raw.scroll >= 0) fresh.scroll = Math.round(raw.scroll);
    if (raw.daily && typeof raw.daily === "object") {
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw.daily.date || "")) fresh.daily.date = raw.daily.date;
      ["streak", "best"].forEach(function (field) {
        var value = raw.daily[field];
        if (typeof value === "number" && isFinite(value) && value >= 0) fresh.daily[field] = Math.round(value);
      });
    }

    ["plays", "last", "good", "bad"].forEach(function (field) {
      if (!raw[field] || typeof raw[field] !== "object") return;
      Object.keys(raw[field]).forEach(function (key) {
        var value = raw[field][key];
        if (!isId(key)) return;
        // Successful sources are stored as portal names, not just legacy indexes.
        if (field === "good" && typeof value === "string" && value.length > 0 && value.length < 256) {
          fresh.good[key] = value;
          return;
        }
        if (typeof value !== "number" || !isFinite(value)) return;
        fresh[field][key] = field === "good" || field === "bad" ? value : Math.max(0, Math.round(value));
      });
    });

    return fresh;
  }

  function migrate() {
    var fresh = emptyStore();
    try {
      var saved = JSON.parse(window.localStorage.getItem(LEGACY_SAVED));
      var recent = JSON.parse(window.localStorage.getItem(LEGACY_RECENT));
      if (Array.isArray(saved)) fresh.saved = saved.filter(isId);
      if (Array.isArray(recent)) fresh.recent = recent.filter(isId).slice(0, MAX_RECENT);
      if (fresh.saved.length || fresh.recent.length) {
        window.localStorage.setItem(KEY, JSON.stringify(fresh));
        window.localStorage.removeItem(LEGACY_SAVED);
        window.localStorage.removeItem(LEGACY_RECENT);
      }
    } catch (err) { /* nothing to migrate */ }
    return fresh;
  }

  function storageWorks() {
    try {
      window.localStorage.setItem("classroom.probe", "1");
      window.localStorage.removeItem("classroom.probe");
      return true;
    } catch (err) {
      return false;
    }
  }

  function save() {
    if (!state.persist) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(store));
    } catch (err) {
      state.persist = false;
      paintFooter();
    }
  }

  /* ---------- small helpers ---------- */

  function $(sel, root) { return (root || document).querySelector(sel); }

  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function shortNum(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(n >= 10000000 ? 0 : 1).replace(/\.0$/, "") + "m";
    if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k";
    return String(n);
  }

  function ago(when) {
    if (!when) return "";
    var seconds = Math.max(0, Math.round((Date.now() - when) / 1000));
    if (seconds < 60) return "just now";
    var minutes = Math.round(seconds / 60);
    if (minutes < 60) return minutes + (minutes === 1 ? " minute ago" : " minutes ago");
    var hours = Math.round(minutes / 60);
    if (hours < 24) return hours + (hours === 1 ? " hour ago" : " hours ago");
    var days = Math.round(hours / 24);
    if (days < 7) return days + (days === 1 ? " day ago" : " days ago");
    try {
      return new Date(when).toLocaleDateString(undefined, { day: "numeric", month: "short" });
    } catch (err) {
      return "a while ago";
    }
  }

  /* Local date, not UTC: a pick should turn over at midnight where the
     classroom is, not at midnight in London. */
  function dayKey(date) {
    var d = date || new Date();
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  /* FNV-1a, on the date string. The pick is the same for everyone on a given
     day and changes by itself tomorrow, with no server and no request. */
  function hash32(text) {
    var h = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function dailyItem() {
    if (!ALL.length) return null;
    var stable = ALL.slice().sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
    return stable[hash32(dayKey()) % stable.length];
  }

  function seriesMembers(id) { return (SERIES_MEMBERS[id] || []).slice(); }

  function seriesNext(item) {
    if (!item || !item.series) return null;
    var members = seriesMembers(item.series);
    var index = members.indexOf(item);
    return index >= 0 ? members[index + 1] || null : null;
  }

  function seriesPosition(item) {
    if (!item || !item.series) return null;
    var members = seriesMembers(item.series);
    var index = members.indexOf(item);
    if (index < 0) return null;
    return { index: index + 1, total: members.length, group: SERIES_BY_ID[item.series] };
  }

  function collectionCounts() {
    var counts = {};
    ALL.forEach(function (item) {
      if (item.series) counts[item.series] = (counts[item.series] || 0) + 1;
    });
    return counts;
  }

  function playable(item) {
    return embeddable(item).length > 0;
  }

  /* A featured file leads the wall: it leads in its own order, and it leads
     any search that names it — even when the wall is sorted another way. No
     entry sets the flag now, but the behaviour still works. */
  function featuredLeads() {
    if (!FEATURED.length) return false;
    // The wall opens in Popular order, and that is where it leads.
    if (state.sort === "hot") return true;
    var q = state.q.trim().toLowerCase();
    if (!q) return false;
    var words = q.split(/[^a-z0-9]+/).filter(Boolean);
    if (!words.length) return false;
    return FEATURED.some(function (item) {
      return words.some(function (word) { return item.keywords.indexOf(word) !== -1; });
    });
  }

  /* How well a title answers the search box: 0 for the title itself, then a
     title that starts with it, then one that only mentions it. Without this a
     search for "minecraft" put "MineClicker Idle Minecraft Clicker" (5,441
     plays) above Minecraft (no play count). */
  function matchScore(item, q) {
    var title = item.title.toLowerCase();
    if (title === q) return 0;
    if (title.indexOf(q) === 0) return 1;
    if (title.indexOf(q) !== -1) return 2;
    return 3;
  }

  function sorted(list) {
    var copy = list.slice();
    var lead = featuredLeads();
    var query = state.q.trim().toLowerCase();
    copy.sort(function (a, b) {
      // A pinned title is the one thing the wall leads with, on every sort:
      // it is hand-added and has no play count to rank by.
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      // The featured local file leads the rest of the wall.
      if (lead && !!a.featured !== !!b.featured) return a.featured ? -1 : 1;
      // A search ranks by how well the title answers it, before anything else.
      if (query) {
        var ea = matchScore(a, query);
        var eb = matchScore(b, query);
        if (ea !== eb) return ea - eb;
      }
      // There is no global play count any more: the only plays that exist are
      // the ones this browser remembers, so that is what the sorts rank.
      var pa = store.plays[a.id] || 0;
      var pb = store.plays[b.id] || 0;
      if (state.sort === "az") return a.title.localeCompare(b.title);
      if (state.sort === "top") {
        // Series first, each in its own order, then everything else A-Z.
        var ga = a.series ? SERIES_BY_ID[a.series].name : "";
        var gb = b.series ? SERIES_BY_ID[b.series].name : "";
        if (!!ga !== !!gb) return ga ? -1 : 1;
        if (ga !== gb) return ga.localeCompare(gb);
        if (ga) return (a.order || 0) - (b.order || 0);
        return a.title.localeCompare(b.title);
      }
      // Ties keep the order the library is written in: the curated list, not
      // an alphabetical accident. A–Z is a sort you choose, not the default.
      if (state.sort === "low") {
        if (!!pa !== !!pb) return pa ? 1 : -1;
        if (pa !== pb) return pa - pb;
        return 0;
      }
      if (pa !== pb) return pb - pa;
      return 0;
    });
    return copy;
  }

  var STOP = { the: 1, a: 1, an: 1, game: 1, games: 1, free: 1, online: 1, play: 1 };

  function tagOf(item) {
    var words = item.title.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/);
    for (var i = 0; i < words.length; i += 1) {
      if (words[i].length > 2 && !STOP[words[i]]) return words[i];
    }
    return "other";
  }

  function renderTags() {
    if (!dom.tags) return;
    var counts = {};
    ALL.forEach(function (item) {
      var tag = tagOf(item);
      counts[tag] = (counts[tag] || 0) + 1;
    });

    var top = Object.keys(counts)
      .filter(function (tag) { return counts[tag] >= 25; })
      .sort(function (a, b) { return counts[b] - counts[a]; })
      .slice(0, 12);

    dom.tags.innerHTML = "";
    top.forEach(function (tag) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "tag";
      button.setAttribute("data-tag", tag);
      button.setAttribute("aria-pressed", state.tag === tag ? "true" : "false");
      button.textContent = tag.charAt(0).toUpperCase() + tag.slice(1);
      dom.tags.appendChild(button);
    });
    dom.tags.hidden = top.length === 0;
  }

  /* ---------- collections ---------- */

  function renderCollections() {
    if (!dom.collections) return;
    var counts = collectionCounts();
    var groups = SERIES_LIST.filter(function (group) { return (counts[group.id] || 0) > 1; });
    var twoPlayer = TWO_PLAYER.length;

    dom.collections.innerHTML = "";
    if (!groups.length && twoPlayer < 2) { dom.collections.hidden = true; return; }

    function chip(value, label, count, title) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "collection";
      button.setAttribute("data-collection", value);
      button.setAttribute("aria-pressed", state.collection === value ? "true" : "false");
      if (title) button.title = title;
      var name = document.createElement("span");
      name.textContent = label;
      var num = document.createElement("b");
      num.textContent = String(count);
      button.appendChild(name);
      button.appendChild(num);
      dom.collections.appendChild(button);
    }

    chip("", "All titles", ALL.length, "Every file here");
    groups.forEach(function (group) {
      chip(group.id, group.name, counts[group.id] || 0, group.line || ("All the " + group.name + " files"));
    });
    if (twoPlayer >= 2) chip("players", "2 players", twoPlayer, "Titles two people can play on one keyboard");

    dom.collections.hidden = false;
  }

  function setCollection(value) {
    state.collection = state.collection === value ? "" : value;
    renderCollections();
    renderShelf();
    renderGrid();
  }

  /* ---------- the daily pick ---------- */

  function renderDaily() {
    if (!dom.daily) return;
    var item = dailyItem();
    if (!item) { dom.daily.hidden = true; return; }

    var today = dayKey();
    var playedToday = store.daily.date === today;

    dom.daily.hidden = false;
    dom.dailyTitle.textContent = item.title;
    dom.dailyLine.textContent = item.description || "A file from this folder, picked for today.";
    dom.dailyThumb.src = item.thumb;
    dom.dailyThumb.alt = "";

    var streak = store.daily.streak || 0;
    dom.dailyStreak.textContent = streak > 1 ? streak + "-day streak" : playedToday ? "played today" : "";

    var label = dom.dailyPlay.querySelector("span");
    if (label) label.textContent = playedToday ? "Play it again" : "Play today's pick";
    dom.dailyPlay.setAttribute("data-open", item.id);
    dom.dailyState.textContent = playedToday
      ? "Done for today. Come back tomorrow for the next one."
      : "One pick a day, the same for everyone.";
  }

  /* ---------- your shelf ---------- */

  function renderShelf() {
    if (!dom.shelfPlayed) return;

    var ids = Object.keys(store.plays).filter(function (id) { return BY_ID[id]; });
    var total = ALL.length;
    var played = ids.length;
    var plays = ids.reduce(function (sum, id) { return sum + (store.plays[id] || 0); }, 0);
    var saved = store.saved.filter(function (id) { return BY_ID[id]; }).length;
    var best = store.daily.best || 0;

    dom.shelfPlayed.textContent = String(played);
    dom.shelfTotal.textContent = String(total);
    dom.shelfFill.style.width = (total ? Math.round((played / total) * 100) : 0) + "%";
    dom.shelfBar.setAttribute("aria-valuenow", String(played));
    dom.shelfBar.setAttribute("aria-valuemax", String(total));

    if (!played) {
      dom.shelfMeta.textContent = "Nothing played yet — the first tile is a good start.";
    } else if (played === total) {
      dom.shelfMeta.textContent = "Every single file, played. " + plays + " plays and counting.";
    } else {
      var bits = [plays + (plays === 1 ? " play" : " plays"), saved + " saved"];
      if (best > 0) bits.push(best + "-day best streak");
      dom.shelfMeta.textContent = bits.join(" · ");
    }

    if (!dom.shelfSeries) return;
    dom.shelfSeries.innerHTML = "";
    SERIES_LIST.forEach(function (group) {
      var members = seriesMembers(group.id);
      if (members.length < 2) return;
      var done = members.filter(function (item) { return store.plays[item.id]; }).length;

      var row = document.createElement("button");
      row.type = "button";
      row.className = "shelf-series-row";
      row.setAttribute("data-collection", group.id);
      row.setAttribute("aria-pressed", state.collection === group.id ? "true" : "false");

      var name = document.createElement("span");
      name.className = "shelf-series-name";
      name.textContent = group.name;

      var dots = document.createElement("span");
      dots.className = "series-dots";
      dots.setAttribute("aria-hidden", "true");
      members.forEach(function (item, index) {
        var dot = document.createElement("i");
        dot.className = store.plays[item.id] ? "on" : "";
        dot.title = item.title + (store.plays[item.id] ? " — played" : "");
        dot.style.setProperty("--i", String(index));
        dots.appendChild(dot);
      });

      var count = document.createElement("b");
      count.textContent = done + "/" + members.length;

      row.appendChild(name);
      row.appendChild(dots);
      row.appendChild(count);
      dom.shelfSeries.appendChild(row);
    });
  }

  function genreOf(item) {
    var text = (item.title + " " + (item.description || "") + " " + (item.keywords || []).join(" ")).toLowerCase();
    if (/puzzle|riddle|blox|2048|chess|sudoku|brain|logic|escape|room|mine/.test(text)) return "puzzle";
    if (/racing|race|drift|driving|car|bike|moto|parking|rider|truck|kart/.test(text)) return "racing";
    if (/basket|football|soccer|tennis|golf|baseball|cricket|sports|pool|bowling|hockey/.test(text)) return "sports";
    if (/tower defense|bloons|strategy|war|kingdom|battle|idle|tycoon|empire/.test(text)) return "strategy";
    if (/action|shooter|shoot|combat|fight|fighting|sword|zombie|vex|platform|run|stick|sniper|ninja/.test(text)) return "action";
    return "arcade";
  }

  function visible() {
    var q = state.q.trim().toLowerCase();
    return sorted(ALL.filter(function (item) {
      if (state.savedOnly && store.saved.indexOf(item.id) === -1) return false;
      if (state.tag && tagOf(item) !== state.tag) return false;
      if (state.collection === "players" && item.players !== 2) return false;
      if (state.collection && state.collection !== "players" && item.series !== state.collection) return false;
      if (state.genre !== "all" && genreOf(item) !== state.genre) return false;
      // "2p", "2 player" and "two player" are the words people actually type.
      if (/^(2p|2 ?players?|two ?players?|multiplayer)$/.test(q)) return item.players === 2;
      if (!q) return true;
      var titleHay = (item.title + " " + item.id.replace(/-/g, " ")).toLowerCase();
      var hay = (titleHay + " " + (item.description || "") + " " + item.sources.map(function (source) { return source.portal; }).join(" ")).toLowerCase();
      if (hay.indexOf(q) !== -1) return true;

      // For multi-word searches keep every word tied to the title, so broad
      // descriptive copy cannot make unrelated games crowd the results.
      var words = q.split(/\s+/).filter(Boolean);
      return words.length > 1 && words.every(function (word) {
        return titleHay.indexOf(word) !== -1;
      });
    }));
  }

  /* ---------- tiles ---------- */

  function buildTile(item, index) {
    var tile = document.createElement("article");
    tile.className = "tile";
    tile.setAttribute("data-id", item.id);
    tile.setAttribute("data-playable", playable(item) ? "1" : "0");
    tile.setAttribute("data-pinned", item.pinned ? "1" : "0");
    tile.setAttribute("data-featured", item.featured ? "1" : "0");
    tile.setAttribute("data-rating", item.rating.toFixed(1));

    var open = document.createElement("button");
    open.type = "button";
    open.className = "tile-open";
    open.setAttribute("data-open", item.id);
    open.setAttribute("aria-label", "Play " + item.title);

    var thumb = document.createElement("span");
    thumb.className = "tile-thumb";
    thumb.setAttribute("data-initial", item.title.charAt(0));

    var img = document.createElement("img");
    img.src = item.thumb;
    img.alt = "";
    img.width = 512;
    img.height = 384;
    img.decoding = "async";
    if (index >= EAGER_IMAGES) img.setAttribute("loading", "lazy");
    img.addEventListener("error", function () {
      // Keep the wall readable when a thumbnail host is unreachable.
      thumb.classList.add("is-broken");
      img.remove();
      if (!thumb.querySelector(".tile-fallback")) {
        var fallback = document.createElement("span");
        fallback.className = "tile-fallback";
        fallback.textContent = item.title.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase();
        thumb.appendChild(fallback);
      }
    });
    thumb.appendChild(img);

    if (item.rating > 0) {
      var rating = document.createElement("span");
      rating.className = "tile-rating";
      rating.textContent = item.rating.toFixed(1);
      thumb.appendChild(rating);
    }

    if (item.featured) {
      // The one title the wall puts first: it is a plain file, so it plays
      // with the wi-fi off.
      var badge = document.createElement("span");
      badge.className = "tile-file";
      badge.textContent = "OFFLINE";
      thumb.appendChild(badge);
    }

    /* Two-player and series marks. They are the two facts worth knowing
       before opening a tile: can a friend join, and is this part of
       something longer. */
    var flags = [];
    if (item.players === 2) flags.push({ text: "2P", title: "Two players on one keyboard" });
    var position = seriesPosition(item);
    if (position) {
      flags.push({
        text: position.index + "/" + position.total,
        title: position.group.name + " — " + position.index + " of " + position.total
      });
    }
    if (flags.length) {
      var flagBox = document.createElement("span");
      flagBox.className = "tile-flags";
      flags.forEach(function (flag) {
        var node = document.createElement("span");
        node.className = "tile-flag";
        node.textContent = flag.text;
        node.title = flag.title;
        flagBox.appendChild(node);
      });
      thumb.appendChild(flagBox);
    }

    var portals = {};
    item.sources.forEach(function (source) { portals[source.portal] = true; });
    var portalsUsed = Object.keys(portals).length;
    if (portalsUsed > 1) {
      var mirrors = document.createElement("span");
      mirrors.className = "tile-mirrors";
      mirrors.textContent = item.sources.length + " routes";
      mirrors.title = item.sources.map(function (s) { return s.portal; }).join(", ");
      thumb.appendChild(mirrors);
    }

    if (store.last[item.id]) {
      var played = document.createElement("span");
      played.className = "tile-played";
      played.textContent = "Played";
      thumb.appendChild(played);
    }

    var play = document.createElement("span");
    play.className = "tile-play";
    play.innerHTML = '<svg class="ico" aria-hidden="true"><use href="#i-play"/></svg>Play';
    thumb.appendChild(play);

    var title = document.createElement("span");
    title.className = "tile-title";
    title.textContent = item.title;

    var meta = document.createElement("span");
    meta.className = "tile-meta";
    var visits = store.plays[item.id] || 0;
    if (visits > 1) meta.textContent = "Played " + visits + " times";
    else if (item.plays > 0) meta.textContent = shortNum(item.plays) + " plays";
    else meta.textContent = "New";

    open.appendChild(thumb);
    open.appendChild(title);
    open.appendChild(meta);

    var fav = document.createElement("button");
    fav.type = "button";
    fav.className = "tile-fav";
    fav.setAttribute("data-fav", item.id);
    var isSaved = store.saved.indexOf(item.id) !== -1;
    if (isSaved) fav.classList.add("is-on");
    fav.setAttribute("aria-pressed", isSaved ? "true" : "false");
    fav.setAttribute("aria-label", (isSaved ? "Remove " : "Save ") + item.title);
    fav.innerHTML = '<svg class="ico" aria-hidden="true"><use href="#i-star"/></svg>';

    tile.appendChild(open);
    tile.appendChild(fav);
    return tile;
  }

  function renderGrid() {
    state.list = visible();
    state.rendered = 0;
    dom.grid.innerHTML = "";
    appendBatch();

    dom.shown.textContent = state.list.length === ALL.length ? "" : state.list.length + " of " + ALL.length;
    if (dom.resultsStatus) dom.resultsStatus.textContent = state.list.length + " titles shown";
    dom.empty.hidden = state.list.length !== 0;
    dom.grid.hidden = state.list.length === 0;

    if (!state.list.length) {
      var term = state.q.trim();
      dom.emptyQ.textContent = term ? '"' + term + '"' : "this filter";
    }
  }

  function appendBatch() {
    var list = state.list || [];
    var start = state.rendered;
    var end = Math.min(start + BATCH, list.length);
    var frag = document.createDocumentFragment();
    for (var i = start; i < end; i += 1) frag.appendChild(buildTile(list[i], i));
    dom.grid.appendChild(frag);
    state.rendered = end;

    var left = list.length - end;
    dom.more.hidden = left <= 0;
    if (left > 0) {
      dom.more.textContent = "Show " + Math.min(BATCH, left) + " more" +
        (left > BATCH ? " (" + left + " left)" : "");
    }
  }

  function renderSaved() {
    dom.savedCount.textContent = String(store.saved.length);
    dom.savedToggle.setAttribute("aria-pressed", state.savedOnly ? "true" : "false");
  }

  function renderPicks() {
    if (!dom.picks) return;

    // Suggestions come from what this device already played: the same first
    // word, or the same genre-ish keyword. Nothing is sent anywhere.
    var seeds = store.recent.slice(0, 4);
    var picks = [];
    var used = {};

    seeds.forEach(function (seed) {
      var item = BY_ID[seed];
      if (!item) return;
      var head = item.title.toLowerCase().split(" ")[0];
      if (head.length < 3) return;

      ALL.some(function (other) {
        if (picks.length >= 8) return true;
        if (other.id === item.id || used[other.id]) return false;
        if (other.title.toLowerCase().indexOf(head) !== 0) return false;
        if (!playable(other)) return false;
        used[other.id] = true;
        picks.push(other);
        return picks.length >= 8;
      });
    });

    if (!picks.length) {
      // First visit: show a spread rather than an empty shelf.
      picks = ALL.filter(playable).slice(0, 8);
    }

    dom.picks.hidden = picks.length < 4;
    dom.picksList.innerHTML = "";
    picks.slice(0, 8).forEach(function (item) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "recent-chip";
      chip.setAttribute("data-open", item.id);

      var img = document.createElement("img");
      img.src = item.thumb;
      img.alt = "";
      img.loading = "lazy";
      img.width = 88;
      img.height = 66;

      var text = document.createElement("span");
      text.textContent = item.title;

      chip.appendChild(img);
      chip.appendChild(text);
      dom.picksList.appendChild(chip);
    });
  }

  function renderContinue() {
    var id = store.recent[0];
    var item = id ? BY_ID[id] : null;

    dom.continue.hidden = !item;
    if (!item) return;

    var plays = store.plays[id] || 1;
    dom.continueTitle.textContent = item.title;
    dom.continueThumb.src = item.thumb;
    dom.continueThumb.alt = "";

    var bits = [store.last[id] ? "Last played " + ago(store.last[id]) : "Ready to play"];
    if (plays > 1) bits.push(plays + " visits");
    if (item.sources.length > 1) bits.push(item.sources.length + " sources");
    dom.continueMeta.textContent = bits.join(" · ");

    dom.continuePlay.setAttribute("data-open", id);
    dom.continueExternal.href = item.sources[0].url;
  }

  function renderRecent() {
    var items = store.recent.slice(1)
      .map(function (id) { return BY_ID[id]; })
      .filter(Boolean);

    dom.recent.hidden = items.length === 0;
    dom.recentList.innerHTML = "";
    items.forEach(function (item) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "recent-chip";
      chip.setAttribute("data-open", item.id);

      var img = document.createElement("img");
      img.src = item.thumb;
      img.alt = "";
      img.loading = "lazy";
      img.width = 88;
      img.height = 66;

      var text = document.createElement("span");
      text.textContent = item.title;

      chip.appendChild(img);
      chip.appendChild(text);
      dom.recentList.appendChild(chip);
    });
  }

  function applyCloak(name, persist) {
    if (!CLOAKS[name]) name = "classroom";
    store.cloak = name;
    document.title = CLOAKS[name].title;
    var icon = document.querySelector('link[rel="icon"]');
    if (icon) icon.href = CLOAKS[name].icon;
    if (dom.cloaks) dom.cloaks.forEach(function (button) {
      button.setAttribute("aria-pressed", button.getAttribute("data-cloak") === name ? "true" : "false");
    });
    if (persist) save();
  }

  function openBlank() {
    // Reopen this page inside an about:blank tab so the address bar
    // shows nothing at all. No network, just an iframe of this page.
    var win = window.open("about:blank", "_blank");
    if (!win) return;
    var doc = win.document;
    doc.title = "Classroom";
    var body = doc.body || doc.appendChild(doc.createElement("body"));
    body.style.margin = "0";
    // The URL goes in as a property, never as markup: nothing in it can
    // break out of an attribute and become a tag.
    var frame = doc.createElement("iframe");
    frame.setAttribute("src", window.location.href);
    frame.setAttribute("allowfullscreen", "");
    frame.style.border = "0";
    frame.style.width = "100vw";
    frame.style.height = "100vh";
    body.appendChild(frame);
  }

  function applyDisplaySettings() {
    document.documentElement.setAttribute("data-theme", store.theme === "dark" ? "dark" : "light");
    document.documentElement.classList.toggle("large-text", store.largeText === true);
    document.documentElement.classList.toggle("high-contrast", store.highContrast === true);
    if (dom.contrastToggle) {
      dom.contrastToggle.textContent = store.highContrast ? "Standard contrast" : "High contrast";
      dom.contrastToggle.setAttribute("aria-pressed", store.highContrast ? "true" : "false");
    }
    if (dom.themeToggle) {
      dom.themeToggle.textContent = store.theme === "dark" ? "Use light theme" : "Use dark theme";
      dom.themeToggle.setAttribute("aria-pressed", store.theme === "dark" ? "true" : "false");
    }
    if (dom.textToggle) {
      dom.textToggle.textContent = store.largeText ? "Standard text" : "Larger text";
      dom.textToggle.setAttribute("aria-pressed", store.largeText ? "true" : "false");
    }
  }

  function paintFooter() {
    var picks = store.saved.length;
    var visits = Object.keys(store.plays).length;
    if (!state.persist) {
      dom.storageNote.textContent = "This browser is blocking storage, so nothing can be kept here.";
      dom.storageNote.classList.add("is-warn");
    } else {
      dom.storageNote.textContent = picks || visits
        ? "On this device: " + picks + (picks === 1 ? " pick, " : " picks, ") +
          visits + (visits === 1 ? " title played." : " titles played.")
        : "Picks and play history are kept in this browser.";
      dom.storageNote.classList.remove("is-warn");
    }
    dom.build.textContent = "build " + (window.CATALOG_BUILT || "local");
  }

  function render() {
    renderGrid();
    renderCollections();
    renderDaily();
    renderShelf();
    renderSaved();
    renderContinue();
    renderRecent();
    renderPicks();
    paintFooter();
  }

  /* ---------- sources ---------- */

  /* Only this site's own files are ever framed. Anything else opens in a tab
     of its own, so no third-party document - and with it no third-party
     script, ad, tracker or redirect - ever runs inside this page. That is
     also what lets the policy name 'self' as the only frame source. */
  function sameOrigin(url) {
    try {
      return new URL(url, window.location.href).origin === window.location.origin;
    } catch (err) {
      return false;
    }
  }

  // Keep explicitly non-embeddable routes out, and anything off-origin.
  function embeddable(item) {
    return item.sources.filter(function (source) {
      return source.embed !== false && sameOrigin(source.url);
    });
  }

  function sourcesFor(item) {
    var list = embeddable(item);

    // Portals this device cannot reach go to the back of the queue, so a
    // blocked host does not cost a wait on every single tile.
    list.sort(function (a, b) {
      return (store.bad[a.portal] ? 1 : 0) - (store.bad[b.portal] ? 1 : 0);
    });

    // A portal that played last time comes first for the same title.
    var good = store.good[item.id];
    if (typeof good === "string") {
      for (var i = 0; i < list.length; i += 1) {
        if (list[i].portal === good) {
          list.unshift(list.splice(i, 1)[0]);
          break;
        }
      }
    } else if (typeof good === "number" && good > 0 && good < list.length) {
      list.unshift(list.splice(good, 1)[0]);
    }
    return list;
  }

  function noteBad(portal) {
    store.bad[portal] = (store.bad[portal] || 0) + 1;
    save();
  }

  function noteGood(id, portal) {
    delete store.bad[portal];
    store.good[id] = portal;
    save();
  }

  /* ---------- player ---------- */

  function openPlayer(id, options) {
    var item = BY_ID[id];
    if (!item || state.active === id) return;
    var opts = options || {};

    // Nothing off-site is loaded here: a title without a local file is handed
    // straight to its own site, in its own tab. No entry needs this now.
    if (!playable(item)) {
      openOnPublisher(item);
      return;
    }

    if (!state.active) {
      state.lastFocus = document.activeElement;
      state.lastFocusId = state.lastFocus && state.lastFocus.getAttribute
        ? state.lastFocus.getAttribute("data-open")
        : null;
    }

    state.active = id;
    state.sourceIndex = -1;
    state.loaded = false;
    state.loadedPortal = null;

    dom.playerTitle.textContent = item.title;
    var position = seriesPosition(item);
    dom.playerSub.textContent = (position ? position.group.name + " · " + position.index + " of " + position.total + " · " : "") +
      (item.players === 2 ? "2 players · " : "") +
      "local file · works offline";

    if (dom.nextSeries) {
      var following = seriesNext(item);
      dom.nextSeries.hidden = !following;
      dom.nextSeries.textContent = following ? "Next: " + following.title : "";
      dom.nextSeries.title = following ? "Next in " + position.group.name : "";
    }
    if (dom.copyStatus) dom.copyStatus.textContent = "";
    if (dom.playerDescription) dom.playerDescription.textContent = item.description ||
      "A self-contained HTML G@M£$ stored with this site. It keeps working with the wi-fi off.";
    if (dom.reportGame) {
      var reportTitle = encodeURIComponent("Broken or incorrect title: " + item.title);
      var reportBody = encodeURIComponent("Title: " + item.title + "\nID: " + item.id + "\nPage: " + window.location.href + "\n\nWhat happened?\n");
      dom.reportGame.href = "https://github.com/funclassroom/funclassroom.github.io/issues/new?title=" + reportTitle + "&body=" + reportBody;
    }

    dom.blocked.hidden = true;
    dom.player.hidden = false;
    dom.player.setAttribute("aria-hidden", "false");
    document.body.classList.add("locked");

    rememberPlay(id);

    // Freeze the order for this session: a portal failing mid-way must not
    // shuffle the queue under the user's feet.
    state.queue = sourcesFor(item);

    // A title whose every route refuses framing gets
    // the explanation panel instead of a black iframe.
    if (!state.queue.length) showBlocked(item, []);
    else attemptSource(0);

    dom.close.focus({ preventScroll: true });

    if (opts.push !== false) {
      try { window.history.pushState({ p: id }, "", "#p=" + id); } catch (err) { /* file:// */ }
    }
  }

  /* Hand a source that is not a local file to its own site, in a tab of its
     own. One synthetic click on a real anchor: a link click inside a gesture
     is never popup-blocked, and rel=noopener noreferrer means that site gets
     no handle on this page and no referrer either. window.open is not
     used here because passing "noopener" to it returns null by design, and
     a null return would look like a blocked popup and open a second tab. */
  function openOnPublisher(item) {
    var source = item.sources && item.sources[0];
    if (!source) return;
    rememberPlay(item.id);
    var link = document.createElement("a");
    link.href = source.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function syncPlayerFav(item) {
    if (!dom.playerFav) return;
    var on = store.saved.indexOf(item.id) !== -1;
    dom.playerFav.classList.toggle("is-on", on);
    dom.playerFav.setAttribute("aria-pressed", on ? "true" : "false");
    dom.playerFav.setAttribute("aria-label", (on ? "Remove " : "Save ") + item.title);
  }

  function attemptSource(index) {
    var item = BY_ID[state.active];
    if (!item) return;

    var sources = state.queue && state.queue.length ? state.queue : sourcesFor(item);
    clearStage();

    if (index >= sources.length) {
      showBlocked(item, sources);
      return;
    }

    state.sourceIndex = index;
    state.loaded = false;
    state.loadedPortal = null;

    var source = sources[index];
    state.currentId = state.active;
    dom.blocked.hidden = true;
    dom.loading.hidden = false;
    dom.loadingText.textContent = "Loading";
    dom.loadLink.hidden = true;
    dom.loadLink.href = source.url;
    dom.external.href = source.url;

    dom.source.textContent = sources.length > 1
      ? "Source " + (index + 1) + " of " + sources.length + " · " + source.portal
      : source.portal;
    dom.next.hidden = sources.length < 2;
    syncPlayerFav(item);
    dom.next.disabled = false;

    mountFrame(item, source, sources, index);
  }

  function mountFrame(item, source, sources, index) {
    var frame = document.createElement("iframe");
    frame.className = "player-frame";
    frame.src = source.url;
    frame.title = item.title;
    // pointer-lock is what lets a game capture the mouse inside the frame;
    // Minecraft's look controls are dead without it.
    frame.setAttribute(
      "allow",
      "autoplay; fullscreen; gamepad; pointer-lock; accelerometer; gyroscope"
    );
    frame.setAttribute("allowfullscreen", "");
    frame.setAttribute("frameborder", "0");

    // A frame that is torn down must not report its load into the next one.
    var token = (state.frameToken = (state.frameToken || 0) + 1);

    frame.addEventListener("load", function () {
      if (token !== state.frameToken) return;
      // The document answered. Whether it then draws anything is that
      // document's business, and there is no honest way for this page to see
      // inside a cross-origin frame — so never call it broken here.
      state.loaded = true;
      state.loadedPortal = source.portal;
      state.loadingFrame = false;
      dom.loading.hidden = true;
      window.clearTimeout(dom.loadTimer);
      window.clearTimeout(dom.slowTimer);
    });

    dom.stage.appendChild(frame);

    // Keep the spinner up while the document is actually loading. Hiding it
    // on a fixed timer is what left a silent black stage behind slow games.
    window.clearTimeout(dom.loadTimer);
    window.clearTimeout(dom.slowTimer);
    dom.slowTimer = window.setTimeout(function () {
      if (state.loaded || token !== state.frameToken) return;
      dom.loadLink.hidden = false;
      dom.loadingText.textContent = "This one is taking a while";
      dom.source.textContent = "still loading — open it in a new tab if it stays blank";
    }, SLOW_LOAD_MS);
  }

  function nextSource(automatic) {
    var item = BY_ID[state.active];
    if (!item) return;
    var sources = state.queue && state.queue.length ? state.queue : sourcesFor(item);
    var index = state.sourceIndex;

    if (index + 1 >= sources.length) {
      dom.next.disabled = true;
      showBlocked(item, sources);
      return;
    }

    if (!automatic && index >= 0) noteBad(sources[index].portal);
    attemptSource(index + 1);
  }

  function showBlocked(item, sources) {
    clearStage();
    dom.loading.hidden = true;
    dom.next.hidden = true;
    dom.next.disabled = true;

    var title = dom.blocked.querySelector("h2");
    var walled = item.sources.filter(function (source) { return source.embed === false; });
    var attempt = sources.length;
    // Every shipped title is a file here. A source that is not same-origin can
    // only arrive through bad data, so the copy below only softens to "site"
    // language for that case.
    var allLocal = item.sources.every(function (source) { return sameOrigin(source.url); });

    if (attempt === 0) {
      // Nothing was even attempted: every route is known to refuse framing.
      dom.source.textContent = "not embeddable";
      title.textContent = "This one will not be framed";
      dom.blockedText.textContent = item.sources.length
        ? item.sources[0].portal + " does not allow its G@M£$ inside another page, " +
          "so it cannot play here. It still works in its own tab — sorry for the extra click."
        : "This title has no working route at the moment. Sorry about that.";
    } else {
      dom.source.textContent = attempt + (attempt === 1 ? " source" : " sources") + " tried";
      title.textContent = "This one would not load";
      dom.blockedText.textContent = (attempt === 1
        ? "The only source for this title gave us nothing back. "
        : "All " + attempt + " sources for this title gave us nothing back. ") +
        (allLocal
          ? "The file did not open, which usually means it is missing or damaged " +
            "in this repository. It still opens on its own page."
          : "That usually means the site is refusing frames or is down — not that the file is broken. " +
            "It opens fine in its own tab.");
    }

    dom.blockedList.innerHTML = "";
    item.sources.forEach(function (source) {
      var li = document.createElement("li");
      var link = document.createElement("a");
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = (allLocal ? "This file" : source.portal) + (source.embed === false
        ? " — opens in a new tab"
        : " — " + source.url.replace(/^https:\/\//, ""));
      li.appendChild(link);
      dom.blockedList.appendChild(li);
    });

    var first = (walled.length ? walled : sources.length ? sources : item.sources)[0];
    if (first) {
      dom.blockedOpen.hidden = false;
      dom.blockedOpen.href = first.url;
      dom.blockedOpen.textContent = allLocal
        ? "Open the file"
        : (attempt === 0 ? "Play on " : "Open on ") + first.portal;
    } else {
      dom.blockedOpen.hidden = true;
      dom.blockedOpen.removeAttribute("href");
    }

    dom.blocked.hidden = false;
  }

  function retrySources() {
    var id = state.active;
    var item = id ? BY_ID[id] : null;
    if (!item) return;
    dom.blocked.hidden = true;
    // Rebuild the queue: portals that failed are now last, so a retry starts
    // with one that has not been given a chance yet.
    state.queue = sourcesFor(item);
    if (!state.queue.length) { showBlocked(item, []); return; }
    attemptSource(0);
  }

  function clearStage() {
    window.clearTimeout(dom.loadTimer);
    window.clearTimeout(dom.slowTimer);
    // Bump the token so a frame being removed cannot claim it loaded.
    state.frameToken = (state.frameToken || 0) + 1;
    var frame = $(".player-frame", dom.stage);
    if (frame) frame.remove();
  }

  function closePlayer(options) {
    var opts = options || {};
    if (!state.active) return;

    // Remember the portal that actually answered, not whatever happens to
    // sit at the old index after the queue is re-sorted for failures.
    if (state.loadedPortal) noteGood(state.active, state.loadedPortal);

    state.active = null;
    state.sourceIndex = -1;
    state.queue = null;
    state.loaded = false;
    state.loadedPortal = null;
    state.loadingFrame = false;
    clearStage();
    dom.loading.hidden = false;
    dom.loadingText.textContent = "Loading";
    dom.loadLink.hidden = true;
    dom.blocked.hidden = true;
    dom.player.hidden = true;
    dom.player.setAttribute("aria-hidden", "true");
    document.body.classList.remove("locked");

    if (document.fullscreenElement) {
      try { document.exitFullscreen(); } catch (err) { /* ignore */ }
    }

    if (opts.push !== false) {
      try {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      } catch (err) { /* ignore */ }
    }

    var back = state.lastFocus;
    if (!back || !document.contains(back)) {
      back = state.lastFocusId
        ? document.querySelector('[data-open="' + state.lastFocusId + '"]')
        : null;
    }
    if (back && document.contains(back)) back.focus({ preventScroll: true });

    renderContinue();
    renderRecent();
    renderPicks();
    paintFooter();
  }

  function rememberPlay(id) {
    var firstPlay = !store.plays[id];
    var newStreak = 0;

    store.recent = [id].concat(store.recent.filter(function (s) { return s !== id; })).slice(0, MAX_RECENT);
    store.last[id] = Date.now();
    store.plays[id] = (store.plays[id] || 0) + 1;

    // Today's pick carries a streak: one point for the first time it is opened
    // on a given day, kept only while the days stay next to each other.
    var daily = dailyItem();
    if (daily && daily.id === id) {
      var today = dayKey();
      if (store.daily.date !== today) {
        var yesterday = dayKey(new Date(Date.now() - 86400000));
        store.daily.streak = store.daily.date === yesterday ? (store.daily.streak || 0) + 1 : 1;
        store.daily.date = today;
        if (store.daily.streak > (store.daily.best || 0)) store.daily.best = store.daily.streak;
        newStreak = store.daily.streak;
      }
    }

    milestones(BY_ID[id], firstPlay, newStreak);
    save();
    markTilePlayed(id);
    renderContinue();
    renderRecent();
    renderPicks();
    renderDaily();
    renderShelf();
    paintFooter();
  }

  function markTilePlayed(id) {
    var tile = document.querySelector('.tile[data-id="' + id + '"]');
    if (!tile) return;

    var thumb = tile.querySelector(".tile-thumb");
    if (thumb && !thumb.querySelector(".tile-played")) {
      var badge = document.createElement("span");
      badge.className = "tile-played";
      badge.textContent = "Played";
      thumb.appendChild(badge);
    }

    var meta = tile.querySelector(".tile-meta");
    var visits = store.plays[id] || 0;
    if (meta && visits > 1) meta.textContent = "Played " + visits + " times";
  }

  function toggleSaved(id) {
    var i = store.saved.indexOf(id);
    var on = i === -1;
    if (on) store.saved.unshift(id);
    else store.saved.splice(i, 1);
    save();

    var fav = document.querySelector('[data-fav="' + id + '"]');
    if (fav) {
      var item = BY_ID[id];
      fav.classList.toggle("is-on", on);
      fav.setAttribute("aria-pressed", on ? "true" : "false");
      fav.setAttribute("aria-label", (on ? "Remove " : "Save ") + (item ? item.title : id));
    }

    renderSaved();
    paintFooter();
    if (state.savedOnly) renderGrid();
  }

  function shuffle() {
    // Random means random within what is on screen: a collection or a search
    // should not hand back a title it just filtered out.
    var pool = visible();
    if (!pool.length) pool = ALL;
    if (!pool.length) return;
    var pick = pool[Math.floor(Math.random() * pool.length)];
    if (pool.length > 1 && pick.id === state.active) {
      pick = pool[(pool.indexOf(pick) + 1) % pool.length];
    }
    openPlayer(pick.id);
  }

  /* ---------- one small toast, for the moments worth noticing ---------- */

  function showToast(text) {
    if (!dom.toast) return;
    dom.toast.textContent = text;
    dom.toast.hidden = false;
    window.clearTimeout(dom.toastTimer);
    dom.toastTimer = window.setTimeout(function () {
      if (dom.toast) dom.toast.hidden = true;
    }, 4200);
  }

  function milestones(item, firstPlay, streak) {
    var notes = [];
    if (firstPlay) {
      if (item.series && seriesMembers(item.series).every(function (member) { return store.plays[member.id]; })) {
        notes.push("Series complete: " + SERIES_BY_ID[item.series].name);
      }
      var played = Object.keys(store.plays).filter(function (id) { return BY_ID[id]; }).length;
      if (played === ALL.length) notes.push("That is every file in the folder. All 129.");
    }
    if (streak && [3, 7, 14, 30].indexOf(streak) !== -1) {
      notes.push(streak + "-day streak. Same time tomorrow.");
    }
    if (notes.length) showToast(notes.join(" "));
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(function () {});
    } else if (dom.player && dom.player.requestFullscreen) {
      dom.player.requestFullscreen().catch(function () {});
    }
  }

  function openSeriesNext() {
    var item = BY_ID[state.active];
    var next = seriesNext(item);
    if (next) openPlayer(next.id);
  }

  /* A link to one title, using the hash the page already understands. */
  function playerLink(item) {
    var base = window.location.origin + window.location.pathname;
    return base + "#p=" + encodeURIComponent(item.id);
  }

  function copyPlayerLink() {
    var item = BY_ID[state.active];
    if (!item) return;
    var url = playerLink(item);
    var report = function (ok) {
      if (!dom.copyStatus) return;
      dom.copyStatus.textContent = ok ? "Link copied. Paste it anywhere." : "Copy failed. The link is " + url;
      window.clearTimeout(dom.copyTimer);
      dom.copyTimer = window.setTimeout(function () {
        if (dom.copyStatus) dom.copyStatus.textContent = "";
      }, 4000);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { report(true); }, function () { legacyCopy(url, report); });
    } else {
      legacyCopy(url, report);
    }
  }

  function legacyCopy(url, report) {
    var area = document.createElement("textarea");
    area.value = url;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    var ok = false;
    try {
      area.select();
      ok = document.execCommand("copy") === true;
    } catch (err) { ok = false; }
    area.remove();
    report(ok);
  }

  /* ---------- command palette ---------- */

  function paletteActions() {
    var daily = dailyItem();
    var actions = [
      { kind: "action", label: "Random G@M£$", hint: "Shuffle the whole wall", run: shuffle },
      { kind: "action", label: "2 players", hint: "Titles for two on one keyboard", run: function () {
        state.collection = "players"; renderCollections(); renderGrid();
      } },
      { kind: "action", label: "Your shelf", hint: "What you have played so far", run: function () {
        if (dom.shelfMore) dom.shelfMore.open = true;
        if (dom.shelfPlayed && dom.shelfPlayed.scrollIntoView) {
          dom.shelfPlayed.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      } },
      { kind: "action", label: "All files page", hint: "Offline copies, install, save all", run: function () {
        window.location.href = "files.html";
      } },
      { kind: "action", label: "Toggle dark theme", hint: "Light or dark, remembered here", run: function () {
        store.theme = store.theme === "dark" ? "light" : "dark"; applyDisplaySettings(); save();
      } },
      { kind: "action", label: "Back to the top", hint: "Every title, no filter", run: function () {
        state.q = ""; state.collection = ""; state.tag = ""; state.genre = "all"; state.savedOnly = false;
        if (dom.q) dom.q.value = "";
        if (dom.genre) dom.genre.value = "all";
        render();
        window.scrollTo(0, 0);
      } }
    ];
    if (daily) {
      actions.splice(1, 0, {
        kind: "action",
        label: "G@M£$ of the day: " + daily.title,
        hint: "Today's pick, the same for everyone",
        run: function () { openPlayer(daily.id); }
      });
    }
    return actions;
  }

  function paletteMatches(query) {
    var q = query.trim().toLowerCase();
    var actions = paletteActions().filter(function (action) {
      return !q || action.label.toLowerCase().indexOf(q) !== -1;
    });
    var titles = ALL.filter(function (item) {
      if (!q) return true;
      var hay = (item.title + " " + item.id.replace(/-/g, " ") + " " + (item.description || "")).toLowerCase();
      return hay.indexOf(q) !== -1;
    }).sort(function (a, b) {
      if (!q) return a.title.localeCompare(b.title);
      // A title that starts with the query beats one that merely mentions it
      // in its description, which is what made "fire" offer Rocket first.
      function rank(item) {
        var title = item.title.toLowerCase();
        var at = title.indexOf(q);
        if (at === 0) return 0;
        if (at > 0) return 1;
        if (title.split(/[^a-z0-9]+/).some(function (word) { return word.indexOf(q) === 0; })) return 2;
        return 3;
      }
      var ra = rank(a);
      var rb = rank(b);
      if (ra !== rb) return ra - rb;
      return a.title.localeCompare(b.title);
    });

    return actions.map(function (action) {
      return { kind: "action", action: action, label: action.label, hint: action.hint };
    }).concat(titles.map(function (item) {
      var position = seriesPosition(item);
      var hint = position ? position.group.name + " · " + position.index + " of " + position.total : item.description || "";
      if (item.players === 2 && position) hint += " · 2 players";
      else if (item.players === 2) hint = "2 players · " + hint;
      return { kind: "title", item: item, label: item.title, hint: hint };
    }));
  }

  function updatePaletteActive() {
    if (!dom.paletteList) return;
    Array.prototype.forEach.call(dom.paletteList.children, function (node, index) {
      var on = index === state.paletteIndex;
      node.classList.toggle("is-active", on);
      node.setAttribute("aria-selected", on ? "true" : "false");
      if (on && node.scrollIntoView) node.scrollIntoView({ block: "nearest" });
    });
    var active = dom.paletteList.children[state.paletteIndex];
    if (active && dom.paletteInput) dom.paletteInput.setAttribute("aria-activedescendant", active.id);
  }

  function renderPalette(query) {
    if (!dom.paletteList) return;
    var matches = paletteMatches(query);
    state.paletteItems = matches;
    state.paletteIndex = 0;
    dom.paletteList.innerHTML = "";

    if (!matches.length) {
      var empty = document.createElement("li");
      empty.className = "palette-empty";
      empty.textContent = "Nothing matches \"" + query.trim() + "\".";
      dom.paletteList.appendChild(empty);
      return;
    }

    matches.slice(0, 40).forEach(function (match, index) {
      var row = document.createElement("li");
      row.id = "palette-opt-" + index;
      row.className = "palette-item";
      row.setAttribute("role", "option");
      row.setAttribute("aria-selected", "false");
      row.setAttribute("data-palette-run", String(index));

      var label = document.createElement("span");
      label.className = "palette-label";
      label.textContent = match.label;
      row.appendChild(label);

      if (match.hint) {
        var hint = document.createElement("span");
        hint.className = "palette-hint-line";
        hint.textContent = match.hint;
        row.appendChild(hint);
      }
      if (match.kind === "title") {
        var kind = document.createElement("span");
        kind.className = "palette-kind";
        kind.textContent = "FILE";
        row.appendChild(kind);
      }
      dom.paletteList.appendChild(row);
    });
    updatePaletteActive();
  }

  function paletteRun(index) {
    var match = state.paletteItems[index];
    if (!match) return;
    closePalette();
    if (match.kind === "action") match.action.run();
    else openPlayer(match.item.id);
  }

  function openPalette() {
    if (!dom.palette) return;
    state.paletteReturnFocus = document.activeElement;
    dom.palette.hidden = false;
    document.body.classList.add("palette-open");
    if (dom.paletteInput) {
      dom.paletteInput.value = "";
      dom.paletteInput.focus();
    }
    renderPalette("");
  }

  function closePalette() {
    if (!dom.palette || dom.palette.hidden) return;
    dom.palette.hidden = true;
    document.body.classList.remove("palette-open");
    if (dom.paletteInput) dom.paletteInput.value = "";
    var back = state.paletteReturnFocus;
    if (back && back.focus) { try { back.focus({ preventScroll: true }); } catch (err) { /* ignore */ } }
  }

  function paletteOpen() {
    return !!(dom.palette && !dom.palette.hidden);
  }

  /* ---------- url ---------- */

  function idFromHash() {
    var hash = window.location.hash || "";
    if (hash.indexOf("#p=") !== 0) return null;
    var id = decodeURIComponent(hash.slice(3));
    return BY_ID[id] ? id : null;
  }

  function applyHash() {
    var id = idFromHash();
    if (id) openPlayer(id, { push: false });
    else closePlayer({ push: false });
  }

  /* ---------- start ---------- */

  function init() {
    // The pitch line counts the files instead of hard-coding a number that
    // drifts every time a title is added or removed.
    Array.prototype.forEach.call(document.querySelectorAll("[data-local-count]"), function (node) {
      node.textContent = String((window.LOCAL_GAMES || []).length);
    });
    dom.grid = $("#grid");
    dom.empty = $("[data-empty]");
    dom.emptyQ = $("[data-empty-q]");
    dom.shown = $("[data-shown]");
    dom.tags = $("[data-tags]");
    dom.collections = $("[data-collections]");
    dom.daily = $("[data-daily]");
    dom.dailyTitle = $("[data-daily-title]");
    dom.dailyLine = $("[data-daily-line]");
    dom.dailyThumb = $("[data-daily-thumb]");
    dom.dailyPlay = $("[data-daily-play]");
    dom.dailyState = $("[data-daily-state]");
    dom.dailyStreak = $("[data-daily-streak]");
    dom.shelfPlayed = $("[data-shelf-played]");
    dom.shelfTotal = $("[data-shelf-total]");
    dom.shelfFill = $("[data-shelf-fill]");
    dom.shelfBar = $("[data-shelf-bar]");
    dom.shelfMeta = $("[data-shelf-meta]");
    dom.shelfMore = $("[data-shelf-more]");
    dom.shelfSeries = $("[data-shelf-series]");
    dom.nextSeries = $("[data-next-in-series]");
    dom.copyLink = $("[data-copy-link]");
    dom.copyStatus = $("[data-copy-status]");
    dom.toast = $("[data-toast]");
    dom.palette = $("[data-palette]");
    dom.paletteInput = $("[data-palette-input]");
    dom.paletteList = $("[data-palette-list]");
    dom.paletteOpen = $("[data-palette-open]");
    dom.more = $("[data-more]");
    dom.count = $("[data-count]");
    dom.savedToggle = $("[data-saved-toggle]");
    dom.savedCount = $("[data-saved-count]");
    dom.continue = $("[data-continue]");
    dom.continueTitle = $("[data-continue-title]");
    dom.continueThumb = $("[data-continue-thumb]");
    dom.continueMeta = $("[data-continue-meta]");
    dom.continuePlay = $("[data-continue-play]");
    dom.continueExternal = $("[data-continue-external]");
    dom.recent = $("[data-recent]");
    dom.picks = $("[data-picks]");
    dom.picksList = $("[data-picks-list]");
    dom.recentList = $("[data-recent-list]");
    dom.player = $("[data-player]");
    dom.playerTitle = $("[data-player-title]");
    dom.playerSub = $("[data-player-sub]");
    dom.playerDescription = $("[data-player-description]");
    dom.reportGame = $("[data-report-game]");
    dom.stage = $("[data-stage]");
    dom.loading = $("[data-loading]");
    dom.loadingText = $("[data-loading-text]");
    dom.loadLink = $("[data-load-link]");
    dom.blocked = $("[data-blocked]");
    dom.blockedText = $("[data-blocked-text]");
    dom.blockedList = $("[data-blocked-list]");
    dom.blockedOpen = $("[data-blocked-open]");
    dom.source = $("[data-source]");
    dom.next = $("[data-next]");
    dom.close = $("[data-close]");
    dom.external = $("[data-external]");
    dom.playerFav = $("[data-player-fav]");
    dom.fs = $("[data-fs]");
    dom.q = $("#q");
    dom.searchClear = $("[data-search-clear]");
    dom.clear = $("[data-clear]");
    dom.sorts = $$("[data-sort]");
    dom.storageNote = $("[data-storage-note]");
    dom.build = $("[data-build]");
    dom.reset = $("[data-reset]");
    dom.cloaks = $$("[data-cloak]");
    dom.blank = $("[data-blank]");
    dom.availability = $("[data-availability]");
    dom.genre = $("[data-genre]");
    dom.filterReset = $("[data-filter-reset]");
    dom.resultsStatus = $("[data-results-status]");
    dom.export = $("[data-export]");
    dom.importTrigger = $("[data-import-trigger]");
    dom.importFile = $("[data-import]");
    dom.themeToggle = $("[data-theme-toggle]");
    dom.textToggle = $("[data-text-toggle]");
    dom.contrastToggle = $("[data-contrast-toggle]");

    if (!dom.grid) return;

    state.persist = storageWorks();
    state.sort = store.sort;
    applyCloak(store.cloak, false);
    applyDisplaySettings();

    dom.count.textContent = String(ALL.length);
    var footCount = $("[data-foot-count]");
    if (footCount) footCount.textContent = ALL.length.toLocaleString("en-GB");
    dom.sorts.forEach(function (button) {
      button.setAttribute("aria-pressed", button.getAttribute("data-sort") === state.sort ? "true" : "false");
    });

    renderTags();
    render();

    function onSearch() {
      state.q = dom.q.value;
      dom.searchClear.hidden = state.q.length === 0;
      renderGrid();
    }

    function onFilter() { renderGrid(); }
    if (dom.availability) dom.availability.addEventListener("change", function () { state.availability = dom.availability.value; onFilter(); });
    dom.genre.addEventListener("change", function () { state.genre = dom.genre.value; onFilter(); });
    dom.filterReset.addEventListener("click", function () {
      state.availability = "all"; state.genre = "all"; state.tag = ""; state.savedOnly = false; state.collection = "";
      if (dom.availability) dom.availability.value = "all"; dom.genre.value = "all";
      if (dom.tags) Array.prototype.forEach.call(dom.tags.children, function (chip) { chip.setAttribute("aria-pressed", "false"); });
      render();
    });

    dom.q.addEventListener("input", onSearch);

    dom.searchClear.addEventListener("click", function () {
      dom.q.value = "";
      onSearch();
      dom.q.focus();
    });

    function openFrom(event) {
      var open = event.target.closest("[data-open]");
      if (open) { openPlayer(open.getAttribute("data-open")); return true; }
      return false;
    }

    dom.tags.addEventListener("click", function (event) {
      var button = event.target.closest("[data-tag]");
      if (!button) return;
      var tag = button.getAttribute("data-tag");
      state.tag = state.tag === tag ? "" : tag;
      Array.prototype.forEach.call(dom.tags.children, function (child) {
        child.setAttribute("aria-pressed", child.getAttribute("data-tag") === state.tag ? "true" : "false");
      });
      renderGrid();
    });

    dom.grid.addEventListener("click", function (event) {
      if (openFrom(event)) return;
      var fav = event.target.closest("[data-fav]");
      if (fav) toggleSaved(fav.getAttribute("data-fav"));
    });

    dom.recentList.addEventListener("click", openFrom);
    dom.picksList.addEventListener("click", openFrom);
    dom.continuePlay.addEventListener("click", openFrom);

    dom.savedToggle.addEventListener("click", function () {
      state.savedOnly = !state.savedOnly;
      render();
    });

    if (dom.cloaks) dom.cloaks.forEach(function (button) {
      button.addEventListener("click", function () {
        applyCloak(button.getAttribute("data-cloak"), true);
      });
    });

    if (dom.blank) dom.blank.addEventListener("click", openBlank);

    dom.sorts.forEach(function (button) {
      button.addEventListener("click", function () {
        state.sort = button.getAttribute("data-sort");
        store.sort = state.sort;
        save();
        dom.sorts.forEach(function (other) {
          other.setAttribute("aria-pressed", other === button ? "true" : "false");
        });
        renderGrid();
      });
    });

    dom.clear.addEventListener("click", function () {
      dom.q.value = "";
      onSearch();
      dom.q.focus();
    });

    dom.more.addEventListener("click", appendBatch);
    dom.playerFav.addEventListener("click", function () {
      if (!state.active) return;
      toggleSaved(state.active);
      syncPlayerFav(BY_ID[state.active]);
    });

    $("[data-shuffle]").addEventListener("click", shuffle);
    dom.close.addEventListener("click", function () { closePlayer(); });
    dom.next.addEventListener("click", function () { nextSource(false); });
    $("[data-retry]").addEventListener("click", retrySources);

    dom.fs.addEventListener("click", toggleFullscreen);

    document.addEventListener("fullscreenchange", function () {
      dom.fs.setAttribute("aria-pressed", document.fullscreenElement ? "true" : "false");
    });

    var scrollTimer = 0;
    window.addEventListener("scroll", function () {
      if (scrollTimer) return;
      scrollTimer = window.setTimeout(function () {
        scrollTimer = 0;
        var top = window.pageYOffset || 0;
        if (Math.abs(top - store.scroll) < 24) return;
        store.scroll = Math.round(top);
        save();
      }, SCROLL_SAVE_MS);
    }, { passive: true });

    if (dom.export) dom.export.addEventListener("click", function () {
      var blob = new Blob([JSON.stringify({ app: "G@M£$", exported: new Date().toISOString(), data: store }, null, 2)], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a"); link.href = url; link.download = "classroom-saved-data.json";
      document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });
    if (dom.importTrigger && dom.importFile) {
      dom.importTrigger.addEventListener("click", function () { dom.importFile.click(); });
      dom.importFile.addEventListener("change", function () {
        var file = dom.importFile.files && dom.importFile.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          try {
            var parsed = JSON.parse(reader.result);
            var incoming = parsed && parsed.data ? parsed.data : parsed;
            if (!incoming || !Array.isArray(incoming.saved) || !Array.isArray(incoming.recent)) throw new Error("Invalid file");
            var next = emptyStore();
            next.saved = incoming.saved.filter(function (id) { return BY_ID[id]; });
            next.recent = incoming.recent.filter(function (id) { return BY_ID[id]; }).slice(0, MAX_RECENT);
            ["plays", "last", "good", "bad"].forEach(function (key) { if (incoming[key] && typeof incoming[key] === "object") next[key] = incoming[key]; });
            if (incoming.daily && typeof incoming.daily === "object") {
              if (/^\d{4}-\d{2}-\d{2}$/.test(incoming.daily.date || "")) next.daily.date = incoming.daily.date;
              ["streak", "best"].forEach(function (field) {
                var value = incoming.daily[field];
                if (typeof value === "number" && isFinite(value) && value >= 0) next.daily[field] = Math.round(value);
              });
            }
            if (/^(hot|top|az|low)$/.test(incoming.sort)) next.sort = incoming.sort;
            if (CLOAKS[incoming.cloak]) next.cloak = incoming.cloak;
            next.theme = incoming.theme === "dark" ? "dark" : "light";
            next.largeText = incoming.largeText === true;
            next.highContrast = incoming.highContrast === true;
            store = next; state.sort = next.sort; state.savedOnly = false;
            applyCloak(next.cloak, false); applyDisplaySettings(); save();
            dom.sorts.forEach(function (button) { button.setAttribute("aria-pressed", button.dataset.sort === state.sort ? "true" : "false"); });
            render();
            window.alert("Saved data imported on this device.");
          } catch (err) { window.alert("That file is not a valid saved-data export."); }
          dom.importFile.value = "";
        };
        reader.readAsText(file);
      });
    }

    if (dom.themeToggle) dom.themeToggle.addEventListener("click", function () {
      store.theme = store.theme === "dark" ? "light" : "dark"; applyDisplaySettings(); save();
    });
    if (dom.textToggle) dom.textToggle.addEventListener("click", function () {
      store.largeText = !store.largeText; applyDisplaySettings(); save();
    });
    if (dom.contrastToggle) dom.contrastToggle.addEventListener("click", function () {
      store.highContrast = !store.highContrast; applyDisplaySettings(); save();
    });

    var resetArmed = false;
    var resetTimer = 0;
    dom.reset.addEventListener("click", function () {
      if (!resetArmed) {
        resetArmed = true;
        dom.reset.textContent = "Click again to clear";
        resetTimer = window.setTimeout(function () {
          resetArmed = false;
          dom.reset.textContent = "Clear saved data";
        }, 4000);
        return;
      }
      window.clearTimeout(resetTimer);
      resetArmed = false;
      dom.reset.textContent = "Clear saved data";
      store = emptyStore();
      state.sort = store.sort;
      state.savedOnly = false;
      state.genre = "all"; state.tag = "";
      dom.sorts.forEach(function (button) { button.setAttribute("aria-pressed", button.dataset.sort === state.sort ? "true" : "false"); });
      applyCloak(store.cloak, false); applyDisplaySettings();
      save();
      render();
    });

    if (dom.collections) dom.collections.addEventListener("click", function (event) {
      var chip = event.target.closest("[data-collection]");
      if (chip) setCollection(chip.getAttribute("data-collection"));
    });

    if (dom.shelfSeries) dom.shelfSeries.addEventListener("click", function (event) {
      var row = event.target.closest("[data-collection]");
      if (!row) return;
      setCollection(row.getAttribute("data-collection"));
      var heading = $(".toolbar");
      if (heading && heading.scrollIntoView) heading.scrollIntoView({ block: "start", behavior: "smooth" });
    });

    if (dom.dailyPlay) dom.dailyPlay.addEventListener("click", function () {
      var item = dailyItem();
      if (item) openPlayer(item.id);
    });

    if (dom.nextSeries) dom.nextSeries.addEventListener("click", openSeriesNext);
    if (dom.copyLink) dom.copyLink.addEventListener("click", copyPlayerLink);

    if (dom.paletteOpen) dom.paletteOpen.addEventListener("click", openPalette);
    if (dom.palette) {
      var backdrop = $("[data-palette-close]", dom.palette);
      if (backdrop) backdrop.addEventListener("click", closePalette);
      if (dom.paletteList) dom.paletteList.addEventListener("click", function (event) {
        var row = event.target.closest("[data-palette-run]");
        if (row) paletteRun(Number(row.getAttribute("data-palette-run")));
      });
      if (dom.paletteInput) {
        dom.paletteInput.addEventListener("input", function () { renderPalette(dom.paletteInput.value); });
        dom.paletteInput.addEventListener("keydown", function (event) {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            var delta = event.key === "ArrowDown" ? 1 : -1;
            var count = Math.min(state.paletteItems.length, 40);
            if (!count) return;
            event.preventDefault();
            state.paletteIndex = (state.paletteIndex + delta + count) % count;
            updatePaletteActive();
          } else if (event.key === "Enter") {
            event.preventDefault();
            paletteRun(state.paletteIndex);
          } else if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            closePalette();
          }
        });
      }
    }

    document.addEventListener("keydown", function (event) {
      var typing = /^(input|textarea|select)$/i.test(event.target.tagName);

      // Ctrl/Cmd+K opens the quick jump from anywhere, including a text box.
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (paletteOpen()) closePalette(); else openPalette();
        return;
      }
      if (paletteOpen()) {
        if (event.key === "Escape") { event.preventDefault(); closePalette(); }
        if (event.key === "Tab") {
          event.preventDefault();
          if (dom.paletteInput) dom.paletteInput.focus();
        }
        return;
      }

      // Inside the player, two letters do the common jobs.
      if (state.active && !typing && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (event.key === "f") { event.preventDefault(); toggleFullscreen(); return; }
        if (event.key === "s") { event.preventDefault(); toggleSaved(state.active); syncPlayerFav(BY_ID[state.active]); return; }
        if (event.key === "c") { event.preventDefault(); copyPlayerLink(); return; }
      }
      if (event.key === "Tab" && state.active) {
        var focusable = $$("button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])", dom.player)
          .filter(function (node) { return !node.hidden && node.offsetParent !== null; });
        if (focusable.length) {
          var firstFocus = focusable[0], lastFocus = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === firstFocus) { event.preventDefault(); lastFocus.focus(); }
          else if (!event.shiftKey && document.activeElement === lastFocus) { event.preventDefault(); firstFocus.focus(); }
        }
      }
      if (event.key === "Escape") {
        if (state.active) { event.preventDefault(); closePlayer(); return; }
        if (state.q) { dom.q.value = ""; onSearch(); return; }
        if (state.savedOnly) { state.savedOnly = false; render(); }
        return;
      }
      if (event.key === "/" && !typing) {
        event.preventDefault();
        dom.q.focus();
      }
      if (event.key === "r" && !typing && !state.active && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        shuffle();
      }
      // Panic key: one tap and the tab looks like homework again.
      if (event.key === "`" && !typing) {
        window.location.href = EXIT_URL;
      }
    });

    window.addEventListener("popstate", applyHash);
    window.addEventListener("hashchange", applyHash);

    var start = idFromHash();
    if (start) {
      openPlayer(start, { push: false });
    } else if (store.scroll > 0) {
      try { window.scrollTo(0, store.scroll); } catch (err) { /* ignore */ }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}());
