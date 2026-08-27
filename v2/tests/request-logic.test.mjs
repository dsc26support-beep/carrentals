import test from "node:test";
import assert from "node:assert/strict";
import {
  THROTTLE, isHoneypotTrapped, throttleDecision, buildNotification, shapeResponse
} from "../shared/request-logic.js";

/* --- the honeypot --------------------------------------------------------- */

test("honeypot: an empty field is a person", () => {
  assert.equal(isHoneypotTrapped({ website: "" }), false);
  assert.equal(isHoneypotTrapped({ website: "   " }), false);
  assert.equal(isHoneypotTrapped({}), false);
  assert.equal(isHoneypotTrapped({ website: undefined }), false);
  assert.equal(isHoneypotTrapped(null), false);
});

test("honeypot: anything typed into it is not a person", () => {
  assert.equal(isHoneypotTrapped({ website: "http://spam.example" }), true);
  assert.equal(isHoneypotTrapped({ website: "x" }), true);
});

test("honeypot: a non-string value still counts as filled", () => {
  // A crafted body can send a number or an object; neither is a human typing.
  assert.equal(isHoneypotTrapped({ website: 1 }), true);
  assert.equal(isHoneypotTrapped({ website: {} }), true);
});

/* --- the throttle --------------------------------------------------------- */

const NOW = Date.parse("2026-08-27T10:00:00Z");
const at = (msAgo) => new Date(NOW - msAgo).toISOString();

test("throttle: a caller nobody has seen is allowed, and starts at one", () => {
  const d = throttleDecision(null, THROTTLE.perIp, NOW);
  assert.equal(d.allowed, true);
  assert.equal(d.count, 1);
  assert.equal(d.window_start, new Date(NOW).toISOString());
});

test("throttle: inside the window the count climbs", () => {
  const d = throttleDecision({ window_start: at(10 * 60 * 1000), count: 2 }, THROTTLE.perIp, NOW);
  assert.equal(d.allowed, true);
  assert.equal(d.count, 3);
  // the window keeps its original start: this is a fixed window, not a sliding one
  assert.equal(d.window_start, at(10 * 60 * 1000));
});

test("throttle: the sixth request in an hour is refused", () => {
  const row = { window_start: at(5 * 60 * 1000), count: THROTTLE.perIp };
  const d = throttleDecision(row, THROTTLE.perIp, NOW);
  assert.equal(d.allowed, false);
  assert.equal(d.count, THROTTLE.perIp, "a refused request must not increment the count");
});

test("throttle: a refusal says how long to wait, and never says zero", () => {
  const d = throttleDecision({ window_start: at(59 * 60 * 1000), count: 9 }, THROTTLE.perIp, NOW);
  assert.equal(d.allowed, false);
  assert.equal(d.retryAfterSeconds, 60);

  // A window one millisecond from expiring must still round up to a real wait.
  const edge = throttleDecision(
    { window_start: at(THROTTLE.windowMs - 1), count: 9 }, THROTTLE.perIp, NOW);
  assert.equal(edge.retryAfterSeconds, 1);
});

test("throttle: once the hour is up the window is replaced, not decremented", () => {
  const d = throttleDecision({ window_start: at(THROTTLE.windowMs), count: 99 }, THROTTLE.perIp, NOW);
  assert.equal(d.allowed, true);
  assert.equal(d.count, 1);
  assert.equal(d.window_start, new Date(NOW).toISOString());
});

test("throttle: the email limit is tighter than the IP limit", () => {
  // Two people behind one office connection must not lock each other out, but
  // one address sending four times in an hour is not a person filling a form.
  assert.ok(THROTTLE.perEmail < THROTTLE.perIp);
  const row = { window_start: at(60 * 1000), count: THROTTLE.perEmail };
  assert.equal(throttleDecision(row, THROTTLE.perEmail, NOW).allowed, false);
  assert.equal(throttleDecision(row, THROTTLE.perIp, NOW).allowed, true);
});

test("throttle: a corrupt stored row does not lock a customer out", () => {
  // Failing open is the right way round here. A broken counter costing the
  // owner a booking is worse than a broken counter letting one bot through.
  for (const row of [{ window_start: "not a date", count: 99 }, { count: 99 }]) {
    assert.equal(throttleDecision(row, THROTTLE.perIp, NOW).allowed, true);
  }
});

/* --- the owner's email ---------------------------------------------------- */

const NOTE = {
  reference: "A1B2C3D4",
  customer: { name: "Teaube", phone: "+68673012345", email: "teaube@example.com" },
  vehicle: { name: "Nissan March", price: "60.00", currency: "AUD" },
  message: "Need it Friday morning.",
  wasUnavailable: false,
  siteUrl: "https://example.invalid/admin/"
};

test("email: the phone number is in it, because that is what the owner needs", () => {
  const { text } = buildNotification(NOTE);
  assert.match(text, /\+68673012345/);
  assert.match(text, /Nissan March/);
  assert.match(text, /A1B2C3D4/);
  assert.match(text, /Need it Friday morning\./);
});

test("email: the subject names the car and the person", () => {
  const { subject } = buildNotification(NOTE);
  assert.match(subject, /Nissan March/);
  assert.match(subject, /Teaube/);
});

test("email: nothing in it claims the rental is confirmed", () => {
  const { subject, text } = buildNotification(NOTE);
  const whole = `${subject}\n${text}`;

  // The word "confirmed" does appear, in the sentence that denies it. So the
  // test removes that sentence and then insists nothing is left — which also
  // means the denial cannot be quietly dropped without this failing.
  assert.match(text, /Nothing is confirmed until you call them\./);
  const claims = whole.replace("Nothing is confirmed until you call them.", "");

  assert.doesNotMatch(claims, /\b(confirmed|guaranteed|reserved)\b/i);
  assert.doesNotMatch(claims, /\bbooked\b/i);
});

test("email: an unavailable car is called out, not buried", () => {
  const { text } = buildNotification({ ...NOTE, wasUnavailable: true });
  assert.match(text, /marked unavailable/);
});

test("email: no note about availability when the car was free", () => {
  assert.doesNotMatch(buildNotification(NOTE).text, /unavailable/);
});

test("email: a request with no message still reads properly", () => {
  const { text } = buildNotification({ ...NOTE, message: "" });
  assert.doesNotMatch(text, /What they wrote/);
  assert.match(text, /\+68673012345/);
});

/* --- the wire contract ---------------------------------------------------- */

test("responses: the shapes are the ones the browser already reads", () => {
  // src/js/api.js reads data.reference on success, data.errors for field
  // errors, data.error otherwise, and treats 429 as its own case.
  assert.deepEqual(shapeResponse.ok("A1B2C3D4"), { status: 200, body: { reference: "A1B2C3D4" } });

  const invalid = shapeResponse.invalid({ email: "Enter an email address." });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.errors.email, "Enter an email address.");

  const throttled = shapeResponse.throttled(120);
  assert.equal(throttled.status, 429);
  assert.equal(throttled.headers["Retry-After"], "120");
});

test("responses: an unknown vehicle does not reveal which ones exist", () => {
  const r = shapeResponse.unknownVehicle();
  assert.equal(r.status, 400);
  assert.doesNotMatch(JSON.stringify(r.body), /[0-9a-f]{8}-[0-9a-f]{4}/, "no ids in the message");
});

test("responses: no failure message ever promises a booking", () => {
  const all = [shapeResponse.ok("X"), shapeResponse.invalid({}), shapeResponse.throttled(),
               shapeResponse.unknownVehicle(), shapeResponse.failed()];
  for (const r of all) {
    assert.doesNotMatch(JSON.stringify(r.body), /\b(confirmed|booked|reserved)\b/i);
  }
});
