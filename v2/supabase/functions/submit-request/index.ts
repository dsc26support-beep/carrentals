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
import { validateRequest } from "../../../shared/validate.js";
import {
  THROTTLE, isHoneypotTrapped, throttleDecision, buildNotification, shapeResponse
} from "../../../shared/request-logic.js";

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
