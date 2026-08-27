/**
 * The decisions the request handler makes, separated from the plumbing.
 *
 * The handler runs on Deno inside Supabase, which cannot be run or reached from
 * the workspace this was written in. Anything expressed only in the handler is
 * therefore untested code. So the parts worth being sure about — the throttle
 * window, what the honeypot does, what the owner's email says — live here in
 * plain JavaScript, are covered by tests/request-logic.test.mjs, and the handler
 * is left as glue around functions that have already been proven.
 *
 * Pure functions. No fetch, no database, no imports.
 */

/**
 * How many requests one caller may send before we stop listening.
 *
 * Per IP is the blunt limit that stops a script. Per email is the narrower one,
 * because a person filling the form in twice is normal and five times is not.
 * Both are generous by design: a rate limit that catches a real customer is a
 * lost booking, and this business has few enough of them to notice.
 */
export const THROTTLE = Object.freeze({
  windowMs: 60 * 60 * 1000,   // one hour
  perIp: 5,
  perEmail: 3
});

/**
 * The honeypot.
 *
 * A field no human sees and no human fills. If it has anything in it, the
 * sender is automated.
 *
 * Returning "trapped" does not mean returning an error. The handler answers a
 * trapped submission exactly as it answers a real one, and writes nothing: a
 * bot told that it failed simply tries again differently, while a bot told it
 * succeeded goes away. The cost of being wrong is one lost request from someone
 * whose browser autofilled a hidden field, which is why the check is an exact
 * "is there anything here" and never a guess about the contents.
 */
export function isHoneypotTrapped(body) {
  const value = body && typeof body === "object" ? body.website : "";
  return typeof value === "string" ? value.trim() !== "" : value != null;
}

/**
 * Whether this caller may send, and what the counter should say afterwards.
 *
 * `row` is the stored { window_start, count } for this key, or null the first
 * time. `now` is passed in rather than read, so the tests can stand at any
 * point in the hour instead of sleeping through one.
 *
 * A window that has expired is not decremented, it is replaced — a fixed window
 * rather than a sliding one. Sliding is fairer and needs a row per request;
 * fixed needs one row per caller per hour, which on this traffic is the right
 * trade.
 */
export function throttleDecision(row, limit, now = Date.now()) {
  const startedAt = row && row.window_start ? new Date(row.window_start).getTime() : 0;
  const expired = !row || !Number.isFinite(startedAt) || now - startedAt >= THROTTLE.windowMs;

  if (expired) {
    return { allowed: true, count: 1, window_start: new Date(now).toISOString(), reset: false };
  }

  const count = Number(row.count) || 0;
  if (count >= limit) {
    const retryAfterMs = startedAt + THROTTLE.windowMs - now;
    return {
      allowed: false,
      count,
      window_start: new Date(startedAt).toISOString(),
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000))
    };
  }

  return { allowed: true, count: count + 1, window_start: new Date(startedAt).toISOString(), reset: false };
}

/**
 * The email the owner gets.
 *
 * Written to be readable on a phone at a glance, because that is where it will
 * be read. The customer's number comes first and is the only thing that matters
 * in the first two seconds — everything else is context for after they have
 * decided to call.
 *
 * Note the language: "requested", never "booked" or "confirmed". Nothing is
 * confirmed until the owner says so on the phone, and an email that says
 * otherwise trains them to believe a machine over their own diary.
 */
export function buildNotification({ reference, customer, vehicle, message, wasUnavailable, siteUrl }) {
  const lines = [
    `${customer.name} asked about the ${vehicle.name}.`,
    "",
    `Phone:     ${customer.phone}`,
    `Email:     ${customer.email}`,
    `Vehicle:   ${vehicle.name} — ${vehicle.currency} ${vehicle.price} per day`,
    `Reference: ${reference}`
  ];

  if (wasUnavailable) {
    lines.push("", "NOTE: that car was marked unavailable when they asked.",
                   "They sent the request anyway. Worth mentioning when you call.");
  }

  if (message) {
    lines.push("", "What they wrote:", message);
  }

  lines.push("", "Nothing is confirmed until you call them.");
  if (siteUrl) { lines.push("", `Open the back office: ${siteUrl}`); }

  return {
    subject: `Booking request — ${vehicle.name} — ${customer.name}`,
    text: lines.join("\n")
  };
}

/**
 * What comes back over the wire.
 *
 * The shapes here are the ones src/js/api.js already reads: `errors` keyed by
 * field for a 400, `error` for anything else, `reference` on success. That
 * contract was written down on the browser side first and this matches it
 * rather than inventing a second one.
 */
export const shapeResponse = Object.freeze({
  ok: (reference) => ({ status: 200, body: { reference } }),

  invalid: (errors) => ({ status: 400, body: { error: "Some details need fixing.", errors } }),

  throttled: (retryAfterSeconds) => ({
    status: 429,
    body: { error: "You have already sent a request. Please call us." },
    headers: { "Retry-After": String(retryAfterSeconds || 3600) }
  }),

  // Deliberately vague. Which vehicle ids exist is not something an anonymous
  // caller needs enumerated for them.
  unknownVehicle: () => ({ status: 400, body: { error: "That vehicle is not available.",
                                                errors: { vehicle_id: "Choose a vehicle." } } }),

  failed: () => ({ status: 500, body: { error: "We could not send that." } })
});
