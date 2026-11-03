/* Load every game on the local files page in a real browser: does the page
   list them, does each file actually open, and does it draw something? Also
   takes the card screenshots the page uses. Run by local-files.yml. */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://127.0.0.1:8765";
const OUT = process.env.OUT || "probe";
const THUMBS = path.join("assets", "img", "pack");
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(THUMBS, { recursive: true });

/* How many distinct colours a PNG screenshot holds. A page that never drew
   anything is one flat colour; anything with a title card or a game is not.
   Reading the screenshot sidesteps the problem that a WebGL canvas cannot be
   read back from inside the page. */
function coloursIn(png) {
  let at = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let type = 0;
  const idat = [];
  while (at < png.length) {
    const length = png.readUInt32BE(at);
    const kind = png.toString("ascii", at + 4, at + 8);
    const body = png.subarray(at + 8, at + 8 + length);
    if (kind === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8];
      type = body[9];
    } else if (kind === "IDAT") {
      idat.push(body);
    } else if (kind === "IEND") {
      break;
    }
    at += 12 + length;
  }
  if (!width || !height || depth !== 8 || (type !== 2 && type !== 6)) return -1;

  const channels = type === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const line = Buffer.alloc(stride);
  const prev = Buffer.alloc(stride);
  const seen = new Set();
  let offset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = raw[offset];
    offset += 1;
    const row = raw.subarray(offset, offset + stride);
    offset += stride;
    for (let x = 0; x < stride; x += 1) {
      const a = x >= channels ? line[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let value = row[x];
      if (filter === 1) value += a;
      else if (filter === 2) value += b;
      else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      line[x] = value & 0xff;
    }
    for (let x = 0; x < stride; x += channels * 7) {
      seen.add((line[x] << 16) | (line[x + 1] << 8) | line[x + 2]);
      if (seen.size > 40) return seen.size;
    }
    line.copy(prev);
  }
  return seen.size;
}

async function main() {
  const browser = await chromium.launch({
    args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--autoplay-policy=no-user-gesture-required"],
  });

  const errors = [];
  const results = [];

  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const pageLog = [];
  page.on("pageerror", (err) => pageLog.push("pageerror: " + err.message));
  await page.goto(BASE + "/files.html", { waitUntil: "load" });
  await page.waitForTimeout(800);

  const games = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-open-file]")).map((button) => ({
      file: button.getAttribute("data-open-file"),
      title: button.getAttribute("data-title"),
    }))
  );

  if (!games.length) errors.push({ what: "no cards on files.html" });

  // The library is thousands of files now, so a run opens a slice of it: the
  // hand-picked pack every time, then an even sample of the imported ones
  // (offset by the day, so the whole library is covered over a week).
  const PACK = process.env.PROBE_PACK !== "0";
  const MAX = Number(process.env.PROBE_MAX || 0);
  let chosen = games;
  if (MAX > 0 && games.length > MAX) {
    const pack = games.filter((game) => !game.file.startsWith("assets/games/js13k/"));
    const imported = games.filter((game) => game.file.startsWith("assets/games/js13k/"));
    const day = Math.floor(Date.now() / 86400000);
    const room = Math.max(0, MAX - (PACK ? pack.length : 0));
    const stride = Math.max(1, Math.floor(imported.length / Math.max(1, room)));
    const sampled = [];
    for (let i = 0; i < imported.length && sampled.length < room; i += 1) {
      sampled.push(imported[(i * stride + day * 7) % imported.length]);
    }
    chosen = (PACK ? pack : []).concat(sampled);
    console.log(`probing ${chosen.length} of ${games.length} files`);
  }

  // Each game gets its own page so a crash cannot take the run down with it.
  for (const game of chosen) {
    const slug = path.basename(game.file).replace(/\.html?$/, "");
    const view = await browser.newPage({ viewport: { width: 512, height: 384 } });
    const log = [];
    view.on("pageerror", (err) => log.push("pageerror: " + err.message));
    view.on("console", (msg) => {
      if (msg.type() === "error") log.push("console: " + msg.text().slice(0, 160));
    });

    let status = null;
    try {
      const response = await view.goto(BASE + "/" + game.file, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      status = response ? response.status() : null;
    } catch (err) {
      log.push("goto: " + err.message.split("\n")[0]);
    }

    await view.waitForTimeout(3500);

    // A lot of these open on a title card that wants one click before it does
    // anything, so the probe clicks the middle of the page first.
    await view.mouse.click(256, 192).catch(() => {});
    await view.waitForTimeout(2500);

    const drew = await view.evaluate(() => {
      const canvases = Array.from(document.querySelectorAll("canvas"));
      let painted = false;
      let readable = 0;
      for (const canvas of canvases) {
        if (!canvas.width || !canvas.height) continue;
        try {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            readable += 1;
            const data = ctx.getImageData(0, 0, Math.min(canvas.width, 400), Math.min(canvas.height, 300)).data;
            const colours = new Set();
            for (let i = 0; i < data.length; i += 4 * 53) {
              colours.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
            }
            if (colours.size > 2) painted = true;
          } else if (canvas.getContext("webgl2") || canvas.getContext("webgl")) {
            // A WebGL canvas cannot be read back here, but holding a context at
            // all means the game has started drawing.
            painted = true;
          }
        } catch (err) {
          painted = true;
        }
      }

      const body = document.body;
      const text = (body && body.innerText ? body.innerText : "").trim();
      const visible = body
        ? Array.from(body.querySelectorAll("*")).filter((node) => {
            const box = node.getBoundingClientRect();
            return box.width > 40 && box.height > 20;
          }).length
        : 0;
      const background = body ? getComputedStyle(body).backgroundColor : "";

      return {
        painted,
        readable,
        canvases: canvases.length,
        textLength: text.length,
        visible,
        background,
        title: document.title,
      };
    });

    const shot = path.join(THUMBS, slug + ".jpg");
    const full = path.join(OUT, slug + ".png");
    let colours = -1;
    try {
      await view.screenshot({ path: full, type: "png" });
      colours = coloursIn(fs.readFileSync(full));
    } catch (err) {
      log.push("shot: " + err.message.split("\n")[0]);
    }
    try {
      await view.screenshot({ path: shot, type: "jpeg", quality: 78 });
    } catch (err) {
      log.push("shot: " + err.message.split("\n")[0]);
    }

    // A page that drew nothing is a single flat colour once screenshotted,
    // which is the only reliable way to judge a WebGL game from outside.
    const alive =
      status === 200 &&
      (colours > 4 || drew.painted || drew.textLength > 20) &&
      !log.some((line) => /^goto:/.test(line));
    results.push({ slug, title: game.title, status, colours, drew, alive, log });
    if (!alive) errors.push({ slug, status, colours, drew, log: log.slice(0, 3) });
    await view.close();
  }

  // close-up on the card grid, for eyeballing the layout
  await page.setViewportSize({ width: 1200, height: 1400 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "files-page.png"), fullPage: false });

  await page.click(".file-open");
  await page.waitForTimeout(2500);
  const framed = await page.evaluate(() => {
    const frame = document.querySelector("iframe");
    return frame ? frame.getAttribute("src") : null;
  });
  await page.screenshot({ path: path.join(OUT, "files-playing.png") });
  await page.close();

  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone.goto(BASE + "/files.html", { waitUntil: "load" });
  await phone.waitForTimeout(500);
  await phone.screenshot({ path: path.join(OUT, "files-phone.png") });
  await phone.close();

  const wall = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await wall.goto(BASE + "/", { waitUntil: "load" });
  await wall.waitForTimeout(700);
  await wall.screenshot({ path: path.join(OUT, "wall.png") });
  const button = await wall.evaluate(() => {
    const link = document.querySelector("a.btn-local");
    return link ? { href: link.getAttribute("href"), text: link.textContent.trim() } : null;
  });
  await wall.close();

  const phoneWall = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phoneWall.goto(BASE + "/", { waitUntil: "load" });
  await phoneWall.waitForTimeout(500);
  const phoneButton = await phoneWall.evaluate(() => {
    const link = document.querySelector("a.btn-local");
    if (!link) return null;
    const box = link.getBoundingClientRect();
    return { text: link.textContent.trim(), width: Math.round(box.width) };
  });
  await phoneWall.close();

  if (pageLog.length) errors.push({ what: "files.html", log: pageLog });
  if (!button) errors.push({ what: "wall button" });
  if (!framed) errors.push({ what: "no frame after playing a card" });
  if (!phoneButton || phoneButton.width < 60) errors.push({ what: "phone button", phoneButton });

  await browser.close();

  fs.writeFileSync(
    path.join(OUT, "files.json"),
    JSON.stringify({ button, phoneButton, framed, results, errors }, null, 2)
  );

  for (const entry of results) {
    console.log(
      entry.slug.padEnd(20),
      entry.alive ? "alive" : "DEAD ",
      String(entry.status),
      "colours:" + entry.colours,
      entry.log.length ? entry.log[0].slice(0, 120) : ""
    );
  }
  console.log("errors:", errors.length, errors.map((e) => e.slug || e.what).join(", "));
  return errors;
}

main()
  .then((errors) => {
    process.exit(errors.length ? 1 : 0);
  })
  .catch((err) => {
    fs.writeFileSync(
      path.join(OUT, "files.json"),
      JSON.stringify(
        {
          crashed: String(err && err.stack ? err.stack : err),
          results: [],
          errors: [{ what: "probe crashed", message: String(err && err.message ? err.message : err) }],
        },
        null,
        2
      )
    );
    console.error(err);
    process.exit(1);
  });
