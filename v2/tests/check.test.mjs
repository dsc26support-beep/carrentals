/**
 * Tests for the guards themselves.
 *
 * Each guard is asserted to fire on a violation AND to stay quiet on the
 * legitimate near-miss it must not confuse with one. A guard verified once by
 * hand is a guard that silently stops working later — this one caught a real
 * hole, where Supabase's newer `sb_secret_…` keys are not JWTs and so slipped
 * straight past a check that only decoded tokens.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildBundle } from "../scripts/bundle-functions.mjs";

const CHECK = path.resolve(import.meta.dirname, "../scripts/check.mjs");

/** Build a throwaway tree of shipped files and run the guards over it. */
function guards(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "guards-"));
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  }
  try {
    execFileSync("node", [CHECK, "--root", root], { stdio: "pipe" });
    return { failed: false, output: "" };
  } catch (err) {
    return { failed: true, output: String(err.stdout) + String(err.stderr) };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const jwt = (role) =>
  "eyJhbGciOiJIUzI1NiJ9." +
  Buffer.from(JSON.stringify({ role })).toString("base64url") + ".sig";

test("an empty tree passes", () => {
  assert.equal(guards({ "src/js/x.js": "export const a = 1;\n" }).failed, false);
});

test("guard 1: rejects a service_role JWT", () => {
  assert.equal(guards({ "src/js/config.js": `export const K = "${jwt("service_role")}";` }).failed, true);
});

test("guard 1: rejects an sb_secret_ key, which is not a JWT", () => {
  const r = guards({ "src/js/config.js": 'export const K = "sb_secret_AbC123_xYz789_pQrStUv";' });
  assert.equal(r.failed, true);
  assert.match(r.output, /privileged key/);
});

test("guard 1: allows the anon JWT and the publishable key", () => {
  assert.equal(guards({
    "src/js/config.js":
      `export const A = "${jwt("anon")}";\n` +
      'export const B = "sb_publishable_ERuJc3Z48_bUa7s3yqVqug_GMfoll4D";'
  }).failed, false);
});

test("guard 2: rejects a date system creeping back", () => {
  assert.equal(guards({ "src/js/site/main.js": 'const f = "collection_date";' }).failed, true);
});

test("guard 3: rejects a page claiming a rental is confirmed", () => {
  assert.equal(guards({ "public/index.html": "<p>Your booking is confirmed for you.</p>" }).failed, true);
});

test("guard 3: allows honest wording", () => {
  assert.equal(guards({
    "public/index.html": "<p>We will contact you by phone to confirm your rental.</p>"
  }).failed, false);
});

test("guard 4: rejects a pre-ticked consent box", () => {
  assert.equal(guards({
    "public/index.html": '<input name="marketing_consent" type="checkbox" checked>'
  }).failed, true);
});

test("guard 4: allows an unticked one", () => {
  assert.equal(guards({
    "public/index.html": '<input name="marketing_consent" type="checkbox" value="yes">'
  }).failed, false);
});

test("guard 5: rejects an image with no alt text", () => {
  assert.equal(guards({ "public/index.html": '<img src="car.jpg">' }).failed, true);
  assert.equal(guards({ "public/index.html": '<img src="car.jpg" alt="A red car">' }).failed, false);
});

/* --- guard 6: the deployable bundle ---------------------------------------
   The bundle is a generated copy of code that also lives in shared/, which is
   exactly the arrangement that drifts. These test the generator; check.mjs
   compares its output against what is committed. */

test("bundle: inlines the shared modules and leaves no module syntax", () => {
  const out = buildBundle("submit-request");

  // Everything the handler calls must be declared in the file it is pasted as.
  for (const symbol of ["validateRequest", "throttleDecision", "isHoneypotTrapped",
                        "buildNotification", "shapeResponse", "THROTTLE"]) {
    assert.match(out, new RegExp(`^(const|function) ${symbol}\\b`, "m"), `${symbol} missing`);
  }

  // A dashboard deploy is one file: an import or export left behind would be a
  // runtime error the moment it is pasted.
  assert.doesNotMatch(out, /^import\s/m);
  assert.doesNotMatch(out, /^export\s/m);
  assert.match(out, /Deno\.serve\(/);
});

test("bundle: tracks its sources, so a drifted copy cannot look current", () => {
  const before = buildBundle("submit-request");
  const file = new URL("../shared/request-logic.js", import.meta.url);
  const original = fs.readFileSync(file, "utf8");

  try {
    fs.writeFileSync(file, original.replace("perIp: 5,", "perIp: 6,"));
    assert.notEqual(buildBundle("submit-request"), before,
      "a change in shared/ must change the bundle, or guard 6 proves nothing");
  } finally {
    fs.writeFileSync(file, original);
  }

  assert.equal(buildBundle("submit-request"), before, "restore failed");
});
