/**
 * Pre-deploy guards.
 *
 * Each of these encodes a promise made during the design that a person would
 * otherwise have to remember. A rule enforced by the build survives; a rule
 * kept in someone's head does not — V1's README described a $15 airport fee
 * for weeks after it became $20.
 *
 * Run: npm run check
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const failures = [];
const fail = (rule, where, detail) => failures.push({ rule, where, detail });

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) { return out; }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) { continue; }
    const full = path.join(dir, entry.name);
    entry.isDirectory() ? walk(full, out) : out.push(full);
  }
  return out;
}

const rel = (f) => path.relative(ROOT, f);
const shipped = [...walk(path.join(ROOT, "src")), ...walk(path.join(ROOT, "public"))]
  .filter((f) => /\.(js|mjs|css|html|json)$/.test(f));
const read = (f) => fs.readFileSync(f, "utf8");

/* 1 ── No privileged key ever reaches the browser --------------------------
   The anon key is public by design and belongs in config.js. The service-role
   key ignores every security policy in the database. Rather than pattern-match
   on names, decode every JWT found and check the role it actually carries. */
for (const file of shipped) {
  const text = read(file);
  for (const token of text.match(/eyJ[A-Za-z0-9_-]{10,}/g) || []) {
    let role = null;
    try { role = JSON.parse(Buffer.from(token, "base64url").toString()).role; }
    catch { continue; }                       // not a JWT payload segment
    if (role && role !== "anon") {
      fail("privileged key shipped to the browser", rel(file), `a key with role "${role}"`);
    }
  }
  if (/service_role/.test(text)) {
    fail("service_role referenced in shipped code", rel(file), "it belongs only in Edge Functions");
  }
}

/* 2 ── The date system stays gone -----------------------------------------
   V2 has no rental dates, no calendar, no duration and no holds. This is what
   stops that architecture creeping back one helper at a time. */
const DATE_GHOSTS = [
  "datepicker", "collection_date", "return_date", "date_from", "date_to",
  "rental_days", "booking_dates", "bookings.json", 'type="date"'
];
for (const file of shipped.filter((f) => /\/(site|public)\//.test(f) || f.endsWith("site.css"))) {
  const text = read(file);
  for (const ghost of DATE_GHOSTS) {
    if (text.includes(ghost)) { fail("date system reintroduced", rel(file), ghost); }
  }
}

/* 3 ── The website never confirms a rental --------------------------------
   Confirmation is a phone call. No customer-facing string may claim otherwise. */
const CLAIMS = /\b(confirmed|booked|reserved|is held)\b/i;
for (const file of shipped.filter((f) => f.endsWith(".html") || /\/site\//.test(f))) {
  for (const [i, line] of read(file).split("\n").entries()) {
    // only lines that are shown to a customer, not comments about them
    if (/^\s*(\*|\/\/|<!--)/.test(line)) { continue; }
    const shown = line.match(/text:\s*"([^"]+)"|>([^<>{]{12,})</);
    if (shown && CLAIMS.test(shown[1] || shown[2] || "")) {
      fail("page claims a rental is confirmed", `${rel(file)}:${i + 1}`, (shown[1] || shown[2]).trim());
    }
  }
}

/* 4 ── Marketing consent is never pre-selected ---------------------------- */
for (const file of shipped.filter((f) => f.endsWith(".html"))) {
  const consent = read(file).match(/<input[^>]*name="marketing_consent"[^>]*>/g) || [];
  for (const tag of consent) {
    if (/\bchecked\b/.test(tag)) {
      fail("consent pre-selected", rel(file), tag.trim());
    }
  }
}

/* 5 ── Every image carries alt text --------------------------------------
   The database requires it; this catches one written by hand in markup. */
for (const file of shipped.filter((f) => f.endsWith(".html"))) {
  for (const tag of read(file).match(/<img\b[^>]*>/g) || []) {
    if (!/\balt\s*=\s*"[^"]+"/.test(tag)) { fail("image without alt text", rel(file), tag.trim()); }
  }
}

/* ── report ─────────────────────────────────────────────────────────────── */
const RULES = 5;
if (failures.length === 0) {
  console.log(`check: ${RULES} rules, ${shipped.length} files, all clear`);
  process.exit(0);
}
console.error(`check: ${failures.length} problem${failures.length > 1 ? "s" : ""}\n`);
for (const f of failures) {
  console.error(`  ${f.rule}\n    ${f.where}\n    ${f.detail}\n`);
}
process.exit(1);
