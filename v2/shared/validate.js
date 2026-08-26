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
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const LIMITS = Object.freeze({
  name: 120,
  email: 320,      // the practical maximum for an address
  message: 1000
});

const ok = (value) => ({ ok: true, value });
const bad = (error) => ({ ok: false, error });

export function validateName(raw) {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) { return bad("Enter your name."); }
  if (value.length > LIMITS.name) { return bad(`Name must be ${LIMITS.name} characters or fewer.`); }
  return ok(value);
}

export function validateEmail(raw) {
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
export function normalizePhone(raw) {
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

export function validateMessage(raw) {
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
export function validateRequest(input) {
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
