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
import { buildBundle, bundlePath, functionNames } from "./bundle-functions.mjs";

// Defaults to the project, but takes a root so the guards can be run against
// fixture trees — a guard nobody tests is a guard that quietly stops working.
const rootArg = process.argv.indexOf("--root");
const ROOT = rootArg > -1
  ? path.resolve(process.argv[rootArg + 1])
  : path.resolve(import.meta.dirname, "..");
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
   Supabase has two key formats and this has to cover both.

   Legacy: a JWT carrying a role. `anon` is public by design and belongs in
   config.js; `service_role` ignores every policy in the database. These are
   checked by decoding the token and reading the role it actually claims — a
   key is dangerous because of what it claims, not what the variable is called.

   Current: opaque strings, `sb_publishable_…` (safe, the anon equivalent) and
   `sb_secret_…` (privileged). These are not JWTs, so the decode above cannot
   see them at all — an earlier version of this guard let a pasted
   `sb_secret_…` key through untouched. Prefix matching is the only option for
   an opaque token. */
// The Edge Functions are scanned too. They are the only code that legitimately
// handles the service-role key, which makes them the only place a real one
// could get pasted in during a debugging session and committed. They read it
// from the environment; a literal here would be the mistake worth catching.
const keyScanned = [...shipped, ...walk(path.join(ROOT, "supabase/functions"))
  .filter((f) => /\.(ts|js|mjs)$/.test(f))];

for (const file of keyScanned) {
  const text = read(file);

  for (const token of text.match(/eyJ[A-Za-z0-9_-]{10,}/g) || []) {
    let role = null;
    try { role = JSON.parse(Buffer.from(token, "base64url").toString()).role; }
    catch { continue; }                       // not a JWT payload segment
    if (role && role !== "anon") {
      fail("privileged key committed", rel(file), `a JWT with role "${role}"`);
    }
  }

  for (const key of text.match(/\bsb_[a-z]+_[A-Za-z0-9_-]{8,}/g) || []) {
    if (!key.startsWith("sb_publishable_")) {
      fail("privileged key committed", rel(file), key.slice(0, 18) + "…");
    }
  }
}

// This one stays browser-only: an Edge Function naming the service role is
// doing its job, and a page mentioning it is not.
for (const file of shipped) {
  if (/service_role/.test(read(file))) {
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

/* 6 ── The deployable bundle matches the source it was made from ---------
   The Supabase dashboard takes one file, so each Edge Function is committed
   twice: as source with imports, and as a flattened bundle.ts that is what
   actually gets pasted. A copy that can drift is exactly the failure this
   project already refused once, when _shared/validate.ts was made a re-export
   rather than a second set of validation rules. So the bundle is rebuilt here
   and compared. If this fails, run `npm run bundle`. */
// Scoped to a real checkout. tests/check.test.mjs points --root at fixture
// trees that have no Edge Functions at all, and a bundle check against those
// would be reporting on this repository rather than on the tree under test.
const hasFunctions = fs.existsSync(path.join(ROOT, "supabase/functions"));
for (const name of hasFunctions ? functionNames : []) {
  const out = bundlePath(name);
  if (!fs.existsSync(out)) {
    fail("function bundle missing", `supabase/functions/${name}/bundle.ts`, "run npm run bundle");
    continue;
  }
  if (fs.readFileSync(out, "utf8") !== buildBundle(name)) {
    fail("function bundle is stale", rel(out),
         "its source changed since it was generated — run npm run bundle");
  }
}

/* ── report ─────────────────────────────────────────────────────────────── */
const RULES = 6;
if (failures.length === 0) {
  console.log(`check: ${RULES} rules, ${shipped.length} files, all clear`);
  process.exit(0);
}
console.error(`check: ${failures.length} problem${failures.length > 1 ? "s" : ""}\n`);
for (const f of failures) {
  console.error(`  ${f.rule}\n    ${f.where}\n    ${f.detail}\n`);
}
process.exit(1);
