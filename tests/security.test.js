/* Security posture of the three shipped pages.
   Static hosting cannot send headers, so the policy lives in a meta tag and
   these checks are what stop it drifting away from the scripts it allows. */
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PAGES = ["index.html", "files.html", "404.html"];

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const cspOf = (html) => {
  const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/i);
  return m ? m[1] : "";
};

const directive = (policy, name) => {
  const part = policy.split(";").map((s) => s.trim()).find((s) => s.split(/\s+/)[0] === name);
  return part ? part.split(/\s+/).slice(1) : [];
};

/* The text of every inline <script>, the same slice a browser hashes. */
const inlineScripts = (html) => {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    if (/\bsrc\s*=/i.test(m[1])) continue;
    out.push(m[2]);
  }
  return out;
};

const hashOf = (text) => "sha256-" + crypto.createHash("sha256").update(text, "utf8").digest("base64");

function securityChecks(check) {
  console.log("\nSECURITY — policy, framing, links\n");

  PAGES.forEach((page) => {
    const html = read(page);
    const policy = cspOf(html);

    check(page + " carries a content security policy", policy.length > 0);

    if (!policy) return;

    const scriptSrc = directive(policy, "script-src");
    const hashes = scriptSrc.filter((s) => s.startsWith("'sha256-"));
    const inline = inlineScripts(html);

    check(
      page + " allows only the inline scripts it actually has",
      hashes.length === inline.length &&
        inline.every((text) => hashes.indexOf("'" + hashOf(text) + "'") !== -1),
      hashes.join(" ")
    );
    check(
      page + " does not need 'unsafe-inline' for scripts",
      scriptSrc.indexOf("'unsafe-inline'") === -1 && scriptSrc.indexOf("'unsafe-eval'") === -1
    );
    check(
      page + " loads no script from anywhere but itself and Clarity",
      scriptSrc.every((s) => s === "'self'" || s.startsWith("'sha256-") || s === "https://*.clarity.ms"),
      scriptSrc.join(" ")
    );
    check(
      page + " frames nothing but this site",
      directive(policy, "frame-src").join(" ") === "'self'" &&
        policy.indexOf("frame-src https:") === -1
    );
    check(page + " forbids plugins and base rewriting",
      directive(policy, "object-src").join(" ") === "'none'" &&
        directive(policy, "base-uri").join(" ") === "'none'");
    check(page + " sends no referrer", /<meta name="referrer" content="no-referrer">/.test(html));

    /* Arrows in the markup: every link that opens a new tab must drop the
       opener and the referrer, and no tag may point at a third-party script. */
    const anchors = html.match(/<a\b[^>]*>/gi) || [];
    const blank = anchors.filter((a) => /target="_blank"/i.test(a));
    check(
      page + " opens new tabs without an opener or a referrer",
      blank.every((a) => /rel="[^"]*noopener[^"]*noreferrer/.test(a)),
      blank.filter((a) => !/rel="[^"]*noopener[^"]*noreferrer/.test(a)).length + " bare"
    );
    check(
      page + " has no off-site script tag",
      (html.match(/<script[^>]+src="[^"]*"/gi) || []).every((t) => !/src="(https?:)?\/\//i.test(t))
    );
    check(
      page + " has no inline event handlers",
      !/\son[a-z]+\s*=/i.test(html.replace(/<script[\s\S]*?<\/script>/gi, ""))
    );
  });

  /* The player is the one place a document is framed: it must be same-origin
     only, and that is enforced in code, not just in the policy. */
  const app = read("assets/js/app.js");
  check(
    "the player only frames this site's own files",
    /function embeddable\(item\) \{[\s\S]{0,200}sameOrigin\(source\.url\)/.test(app)
  );
  check(
    "a title with no local file is handed to its publisher",
    /if \(!playable\(item\)\) \{\s*openOnPublisher\(item\);\s*return;/.test(app)
  );
  check("nothing writes markup straight into a document", !/document\.write\(/.test(app));
}

module.exports = { securityChecks, cspOf, directive, inlineScripts, hashOf };
