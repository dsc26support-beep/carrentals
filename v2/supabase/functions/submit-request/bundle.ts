// ---------------------------------------------------------------------------
// GENERATED FILE — do not edit. Run `npm run bundle` instead.
//
// This is supabase/functions/submit-request/index.ts with these modules inlined:
//   shared/validate.js
//   shared/request-logic.js
//
// Paste THIS file into the Supabase dashboard: Edge Functions → the function
// → the editor. The dashboard takes one file, which is the whole reason this
// exists. `npm run check` fails if it has fallen behind its sources.
// ---------------------------------------------------------------------------

/* ===== shared/validate.js ============================================== */

/**
 * Validation shared by the browser and the server.
 *
 * ONE implementation, imported by both — not two files kept in step by hand.
 * The design called for mirrored copies; a single module is strictly better,
 * because two copies of a phone-number rule drift and nobody notices until a
 * customer's number is unreachable.
 *
 * The browser copy exists for fast feedback. The server copy is authoritative,
 * and the database CHECK constraints are the last line: a client that skips
 * both still cannot write a malformed row.
 *
 * Pure functions, no DOM, no imports.
 */

/** Deliberately the same expression as the customers.email CHECK constraint. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LIMITS = Object.freeze({
  name: 120,
  email: 320,      // the practical maximum for an address
  message: 1000
});

const ok = (value) => ({ ok: true, value });
const bad = (error) => ({ ok: false, error });

function validateName(raw) {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) { return bad("Enter your name."); }
  if (value.length > LIMITS.name) { return bad(`Name must be ${LIMITS.name} characters or fewer.`); }
  return ok(value);
}

function validateEmail(raw) {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) { return bad("Enter your email address."); }
  if (value.length > LIMITS.email) { return bad("That email address is too long."); }
  if (!EMAIL_RE.test(value)) { return bad("That does not look like an email address."); }
  return ok(value);
}

/**
 * Normalize a Kiribati number to +686 followed by eight digits.
 *
 * Accepts it written any way a person writes one: bare, with the country code,
 * with 00, with spaces, dashes or brackets.
 *
 * The order matters. "686" is treated as a country code ONLY when exactly eight
 * digits remain after it — otherwise a local number that happens to begin 686
 * (68612345) would be mangled into a five-digit fragment.
 *
 * Any eight digits are accepted. Kiribati prefix ranges are not whitelisted
 * here: rejecting a real customer's number to enforce a rule nobody verified is
 * the worse failure. Tighten this if the valid prefixes are ever confirmed.
 */
function normalizePhone(raw) {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) { return bad("Enter a phone number."); }

  const written_with_plus = text.startsWith("+");
  let digits = text.replace(/\D/g, "");
  if (!digits) { return bad("That does not look like a phone number."); }

  // 00 is the international prefix, and only means that without a leading +
  if (!written_with_plus && digits.startsWith("00")) { digits = digits.slice(2); }

  // country code, but only if a whole local number follows it
  if (digits.startsWith("686") && digits.length - 3 === 8) { digits = digits.slice(3); }

  if (digits.length !== 8) {
    return bad("Enter a Kiribati number — eight digits, like 73012345.");
  }
  return ok("+686" + digits);
}

function validateMessage(raw) {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) { return ok(""); }                       // optional
  if (value.length > LIMITS.message) {
    return bad(`Please keep your message under ${LIMITS.message} characters.`);
  }
  return ok(value);
}

/**
 * Validate a whole booking request.
 *
 * Returns every error at once, keyed by field, so the form can mark all the bad
 * fields in one pass instead of making someone fix them one submit at a time.
 *
 * Note what is NOT taken from the caller: the price and the vehicle name. The
 * server reads those from the database, so a crafted request cannot quote its
 * own price into your records.
 */
function validateRequest(input) {
  const fields = input && typeof input === "object" ? input : {};
  const errors = {};
  const values = {};

  const checks = {
    name: validateName(fields.name),
    email: validateEmail(fields.email),
    phone: normalizePhone(fields.phone),
    message: validateMessage(fields.message)
  };

  for (const [field, result] of Object.entries(checks)) {
    if (result.ok) { values[field] = result.value; }
    else { errors[field] = result.error; }
  }

  if (typeof fields.vehicle_id !== "string" || !fields.vehicle_id.trim()) {
    errors.vehicle_id = "Choose a vehicle.";
  } else {
    values.vehicle_id = fields.vehicle_id.trim();
  }

  // Consent is opt-in and defaults to refused. Anything but an explicit true
  // is a no — an absent or malformed value must never read as agreement.
  values.marketing_consent = fields.marketing_consent === true;

  return { ok: Object.keys(errors).length === 0, values, errors };
}

/* ===== shared/request-logic.js ========================================= */

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
const THROTTLE = Object.freeze({
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
function isHoneypotTrapped(body) {
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
function throttleDecision(row, limit, now = Date.now()) {
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
function buildNotification({ reference, customer, vehicle, message, wasUnavailable, siteUrl }) {
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
const shapeResponse = Object.freeze({
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

/* ===== the handler ===================================================== */

/**
 * Catch a booking request from the website.
 *
 * This is the only way a customer's details enter the database. The anon key
 * cannot write to `customers` or `rental_requests` — there is no policy for it
 * in 0007 — so everything arrives through here, where the rules are enforced by
 * something the browser cannot edit.
 *
 * The order of the steps below is the security model, so it is worth reading as
 * an order and not just a list:
 *
 *   honeypot  → a bot is answered normally and nothing is written
 *   validate  → the same module the browser uses, this time authoritatively
 *   throttle  → by IP first, then by email
 *   vehicle   → name and price read from the database, never from the body
 *   write     → customer, then request, then consent
 *   notify    → and a failure here must not lose the request
 *
 * DEPLOYMENT: this file imports from ../../../shared/. The Supabase dashboard
 * editor takes a single file, so what you paste into the dashboard is
 * bundle.ts, generated from this file by `npm run bundle`. Edit this one; the
 * build guard fails if bundle.ts falls behind.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY   = Deno.env.get("RESEND_API_KEY") ?? "";
const SALT         = Deno.env.get("REQUEST_SALT") ?? "";
const ADMIN_URL    = Deno.env.get("ADMIN_URL") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

/* --- talking to the database --------------------------------------------- */

const rest = (path: string) => `${SUPABASE_URL}/rest/v1/${path}`;

const dbHeaders: Record<string, string> = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json"
};

async function db(path: string, init: RequestInit = {}) {
  const res = await fetch(rest(path), { ...init, headers: { ...dbHeaders, ...(init.headers || {}) } });
  if (!res.ok) { throw new Error(`${init.method || "GET"} ${path} → ${res.status} ${await res.text()}`); }
  return res.status === 204 ? null : res.json();
}

/* --- who is calling, without writing down who is calling ------------------ */

/**
 * A salted hash of the caller's address.
 *
 * The salt is a function secret. Without it these hashes cannot be walked back
 * to addresses, which is the point: the business needs to count requests per
 * caller, and does not need to own a log of who visited its website.
 */
async function callerKey(req: Request, scope: string) {
  const forwarded = req.headers.get("x-forwarded-for") || "";
  const ip = forwarded.split(",")[0].trim() || "unknown";
  const bytes = new TextEncoder().encode(`${scope}:${SALT}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function emailKey(email: string) {
  const bytes = new TextEncoder().encode(`email:${SALT}:${email.toLowerCase()}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Count one attempt against a key. Returns null to allow, or the seconds to
 * wait to refuse.
 *
 * If the throttle table itself misbehaves this lets the request through. That
 * is deliberate and it is the right way round for this business: a broken
 * counter that costs the owner a booking is worse than a broken counter that
 * lets one extra bot through, and the honeypot and validation are both still
 * standing behind it.
 */
async function countAttempt(key: string, limit: number): Promise<number | null> {
  try {
    const rows = await db(`request_throttle?key_hash=eq.${key}&select=window_start,count`);
    const decision = throttleDecision(rows?.[0] ?? null, limit);

    if (!decision.allowed) { return decision.retryAfterSeconds ?? 3600; }

    await db("request_throttle?on_conflict=key_hash", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        key_hash: key,
        window_start: decision.window_start,
        count: decision.count
      })
    });
    return null;
  } catch (err) {
    console.error("throttle unavailable, allowing request:", err);
    return null;
  }
}

/* --- the handler ---------------------------------------------------------- */

function reply({ status, body, headers }: { status: number; body: unknown; headers?: Record<string, string> }) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, ...(headers || {}), "Content-Type": "application/json" }
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") { return new Response("ok", { headers: CORS }); }
  if (req.method !== "POST") { return reply({ status: 405, body: { error: "Use POST." } }); }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return reply(shapeResponse.invalid({})); }

  // 1. The honeypot. A bot gets the same answer a person gets, and nothing is
  //    written. Telling it that it failed only teaches it to try differently.
  if (isHoneypotTrapped(body)) {
    return reply(shapeResponse.ok("PENDING"));
  }

  // 2. Validation, using the module the browser used — this time as the
  //    authority rather than as a convenience.
  const check = validateRequest(body);
  if (!check.ok) { return reply(shapeResponse.invalid(check.errors)); }
  const { name, email, phone, message, vehicle_id, marketing_consent } = check.values;

  // 3. Throttle. IP first, because that is what stops a script; then email,
  //    which is tighter, because one address sending four times in an hour is
  //    not somebody filling in a form.
  const ipWait = await countAttempt(await callerKey(req, "ip"), THROTTLE.perIp);
  if (ipWait !== null) { return reply(shapeResponse.throttled(ipWait)); }

  const mailWait = await countAttempt(await emailKey(email), THROTTLE.perEmail);
  if (mailWait !== null) { return reply(shapeResponse.throttled(mailWait)); }

  try {
    // 4. The vehicle, from the database. This is the step that makes a crafted
    //    body harmless: whatever price or name it carried, these are the values
    //    that get written down.
    const vehicles = await db(
      `vehicles?id=eq.${encodeURIComponent(vehicle_id)}` +
      `&select=id,name,price_per_day,currency,is_available,is_published,archived_at`);

    const vehicle = vehicles?.[0];
    if (!vehicle || !vehicle.is_published || vehicle.archived_at) {
      return reply(shapeResponse.unknownVehicle());
    }

    // An unavailable car does not refuse the request. The owner asked for it to
    // come through flagged so they can call and offer something else.
    const wasUnavailable = vehicle.is_available === false;

    // 5. The customer. Upsert on email so a returning customer stays one
    //    person, with the name and number they gave most recently.
    const customers = await db("customers?on_conflict=email", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ name, email, phone })
    });
    const customer = customers[0];

    const requests = await db("rental_requests", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        customer_id: customer.id,
        vehicle_id: vehicle.id,
        vehicle_name: vehicle.name,           // snapshots, from step 4
        quoted_price: vehicle.price_per_day,
        currency: vehicle.currency,
        message: message || null,
        vehicle_was_unavailable: wasUnavailable
        // status is left to its default of 'pending'. A body that sent
        // status: "confirmed" is simply not read here.
      })
    });
    const request = requests[0];

    // 6. Consent, and only on an explicit true. validateRequest already reduced
    //    anything else to false.
    if (marketing_consent === true) {
      try {
        await db("marketing_subscribers?on_conflict=email", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates" },
          body: JSON.stringify({
            email, customer_id: customer.id,
            consented: true, consent_at: new Date().toISOString(),
            consent_source: "request_form"
          })
        });
      } catch (err) {
        // Their request matters more than their newsletter.
        console.error("consent not recorded:", err);
      }
    }

    // 7. Tell the owner. After the write, never before, and never in a way that
    //    can undo it — the request is already safe by this line.
    notify({
      reference: request.reference,
      customer: { name, email, phone },
      vehicle: { name: vehicle.name, price: vehicle.price_per_day, currency: vehicle.currency },
      message, wasUnavailable
    }).catch((err) => console.error("notification failed:", err));

    // Housekeeping, occasionally, rather than a scheduled job for three rows.
    if (Math.random() < 0.02) {
      db("rpc/prune_request_throttle", { method: "POST", body: "{}" })
        .catch((err) => console.error("throttle prune failed:", err));
    }

    return reply(shapeResponse.ok(request.reference));
  } catch (err) {
    console.error("request failed:", err);
    return reply(shapeResponse.failed());
  }
});

/* --- the email ------------------------------------------------------------ */

/**
 * Email the owner that somebody asked about a car.
 *
 * Every failure in here is logged and swallowed. By the time this runs the
 * request is in the database and visible in the back office; losing a booking
 * because an email API had a bad minute would be absurd.
 *
 * With no custom domain, Resend will only deliver to the address that owns the
 * Resend account. That is why this notifies the owner and the customer gets a
 * reference number on screen instead of a confirmation email.
 */
async function notify(details: Parameters<typeof buildNotification>[0]) {
  if (!RESEND_KEY) { return; }                 // not set up yet; the request still landed

  const rows = await db("site_settings?key=eq.notify.request_email&select=value");
  const to = rows?.[0]?.value;
  if (!to || typeof to !== "string") { return; }

  const { subject, text } = buildNotification({ ...details, siteUrl: ADMIN_URL });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Tenana Rentals <onboarding@resend.dev>", to: [to], subject, text })
  });

  if (!res.ok) { throw new Error(`Resend ${res.status}: ${await res.text()}`); }
}
