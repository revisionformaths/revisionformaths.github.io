/* Build the Content-Security-Policy for the static pages.
   GitHub Pages cannot send response headers, so the policy rides in a
   <meta http-equiv> tag. Every inline <script> is allowed by its sha256
   hash instead of 'unsafe-inline', which means an injected <script> - the
   thing CSP exists to stop - has nothing to match.
   Run this after editing any inline script:  node scripts/csp-hashes.mjs */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
export const PAGES = ["index.html", "files.html", "404.html"];

/* Everything the pages legitimately load, and nothing else:
   - 'self'                      our own files, including the bundled games
                                 (the only frame source there is)
   - https://*.clarity.ms        Microsoft Clarity: tag loader, scripts,
                                 collect endpoint and the c.gif pixel
   - https:// only for images    tile thumbnails come from the publisher
                                 feeds, so they need the scheme, not a list
   - c.bing.com                  Clarity's own pixel host                       */
export const POLICY = (hashes) =>
  [
    "default-src 'self'",
    `script-src 'self' https://*.clarity.ms ${hashes.join(" ")}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: https://c.bing.com",
    "font-src 'self' data:",
    "connect-src 'self' https://*.clarity.ms",
    "media-src 'self' https:",
    "frame-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");

/* The text between <script> and </script>, src-tags excluded. */
export function inlineScripts(html) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    if (/\bsrc\s*=/i.test(m[1])) continue;
    out.push(m[2]);
  }
  return out;
}

export const hashOf = (text) =>
  "'sha256-" + crypto.createHash("sha256").update(text, "utf8").digest("base64") + "'";

const META = /<meta http-equiv="Content-Security-Policy"[^>]*>\n?/i;

function policyFor(html) {
  return POLICY(inlineScripts(html).map(hashOf));
}

function tagFor(policy) {
  return `<meta http-equiv="Content-Security-Policy" content="${policy}">\n`;
}

/* Rewrite (or add) the CSP meta tag in one page's HTML, returning the new text. */
export function withPolicy(html) {
  const tag = tagFor(policyFor(html));
  if (META.test(html)) return html.replace(META, tag);
  return html.replace(/(<meta charset="utf-8">\n)/i, "$1" + tag);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const page of PAGES) {
    const file = path.join(ROOT, page);
    const before = fs.readFileSync(file, "utf8");
    const after = withPolicy(before);
    if (after !== before) fs.writeFileSync(file, after);
    console.log(page, "->", policyFor(after).length, "chars of policy");
  }
}
