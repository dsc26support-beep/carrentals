import test from "node:test";
import assert from "node:assert/strict";
import {
  validateName, validateEmail, normalizePhone, validateMessage, validateRequest, LIMITS
} from "../shared/validate.js";

test("phone: accepts a number written any way a person writes one", () => {
  const same = [
    "73012345", "+68673012345", "+686 7301 2345", "686-73012345",
    "0068673012345", "(686) 7301 2345", "  73012345  ", "7301-2345",
    "686 7301 2345", "+686-7301-2345"
  ];
  for (const input of same) {
    const r = normalizePhone(input);
    assert.equal(r.ok, true, `expected ${input} to be accepted`);
    assert.equal(r.value, "+68673012345", `wrong result for ${input}`);
  }
});

test("phone: the owner's own two numbers survive", () => {
  assert.equal(normalizePhone("73053005").value, "+68673053005");
  assert.equal(normalizePhone("+686 73039089").value, "+68673039089");
});

test("phone: a local number beginning 686 is not mistaken for a country code", () => {
  // 8 digits, so it is a whole local number, not 686 + a 5-digit fragment
  assert.equal(normalizePhone("68612345").value, "+68668612345");
  // and it round-trips once written in full
  assert.equal(normalizePhone("+68668612345").value, "+68668612345");
});

test("phone: rejects what is not a Kiribati number", () => {
  for (const input of ["7301234", "730123456", "+61412345678", "+1 555 123 4567",
                       "abcdefgh", "", "   ", "++", "0", null, undefined, 73012345]) {
    assert.equal(normalizePhone(input).ok, false, `expected ${String(input)} to be rejected`);
  }
});

test("phone: every rejection explains itself", () => {
  for (const input of ["", "7301234", "abc"]) {
    const r = normalizePhone(input);
    assert.equal(r.ok, false);
    assert.match(r.error, /\w/);
    assert.ok(r.error.length > 10, "an error must say something useful");
  }
});

test("email: accepts ordinary addresses", () => {
  for (const e of ["a@b.co", "ruuka4climatechange@gmail.com", "first.last+tag@sub.example.org"]) {
    assert.equal(validateEmail(e).ok, true, e);
  }
});

test("email: rejects malformed addresses", () => {
  for (const e of ["", "   ", "no-at-sign", "a@b", "a@@b.co", "a b@c.co", "@b.co", "a@.co",
                   "a@b.co ".repeat(50), null, 42]) {
    assert.equal(validateEmail(e).ok, false, `expected ${String(e)} to be rejected`);
  }
});

test("email: trims, and enforces a length cap", () => {
  assert.equal(validateEmail("  a@b.co  ").value, "a@b.co");
  assert.equal(validateEmail("a".repeat(LIMITS.email) + "@b.co").ok, false);
});

test("name: required, trimmed, capped", () => {
  assert.equal(validateName("  Tabweaka  ").value, "Tabweaka");
  assert.equal(validateName("").ok, false);
  assert.equal(validateName("   ").ok, false);
  assert.equal(validateName("x".repeat(LIMITS.name)).ok, true);
  assert.equal(validateName("x".repeat(LIMITS.name + 1)).ok, false);
});

test("message: optional, but capped", () => {
  assert.equal(validateMessage(undefined).value, "");
  assert.equal(validateMessage("  hi  ").value, "hi");
  assert.equal(validateMessage("x".repeat(LIMITS.message + 1)).ok, false);
});

test("request: reports every bad field at once, not one at a time", () => {
  const r = validateRequest({ name: "", email: "nope", phone: "123", vehicle_id: "" });
  assert.equal(r.ok, false);
  assert.deepEqual(Object.keys(r.errors).sort(), ["email", "name", "phone", "vehicle_id"]);
});

test("request: a good one normalises the phone and keeps the rest", () => {
  const r = validateRequest({
    name: " Tabweaka ", email: " T@Example.com ", phone: "(686) 7301 2345",
    vehicle_id: " abc-123 ", message: " a note "
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.values, {
    name: "Tabweaka", email: "T@Example.com", phone: "+68673012345",
    message: "a note", vehicle_id: "abc-123", marketing_consent: false
  });
});

test("consent: only an explicit true counts as agreement", () => {
  const base = { name: "A", email: "a@b.co", phone: "73012345", vehicle_id: "v" };
  for (const value of [undefined, null, false, 0, "", "false", "true", 1, "on", {}]) {
    assert.equal(
      validateRequest({ ...base, marketing_consent: value }).values.marketing_consent,
      false,
      `${JSON.stringify(value)} must not read as consent`
    );
  }
  assert.equal(validateRequest({ ...base, marketing_consent: true }).values.marketing_consent, true);
});

test("request: price and vehicle name are never taken from the caller", () => {
  const r = validateRequest({
    name: "A", email: "a@b.co", phone: "73012345", vehicle_id: "v",
    quoted_price: 1, vehicle_name: "Free Car", status: "confirmed"
  });
  assert.equal(r.values.quoted_price, undefined);
  assert.equal(r.values.vehicle_name, undefined);
  assert.equal(r.values.status, undefined);
});

test("request: survives junk input without throwing", () => {
  for (const input of [null, undefined, "string", 42, [], { name: {} }]) {
    const r = validateRequest(input);
    assert.equal(r.ok, false);
    assert.equal(typeof r.errors, "object");
  }
});
