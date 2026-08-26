/**
 * Display formatting.
 *
 * The date helper here formats record timestamps — when a request arrived. It
 * is not a rental date: V2 has no rental dates, no calendar and no duration.
 */

export function money(amount, currency = "AUD") {
  const n = Number(amount);
  if (!Number.isFinite(n)) { return ""; }
  const shown = Number.isInteger(n) ? n.toFixed(0) : n.toFixed(2);
  return currency === "AUD" ? `$${shown}` : `${shown} ${currency}`;
}

export function perDay(amount, currency = "AUD") {
  return `${money(amount, currency)}/day`;
}

/** +68673053005 → +686 7305 3005, which is how a person reads it back. */
export function phoneForDisplay(e164) {
  const m = /^\+686(\d{4})(\d{4})$/.exec(String(e164 || ""));
  return m ? `+686 ${m[1]} ${m[2]}` : String(e164 || "");
}

/** A tel: href keeps every digit and the country code. */
export const phoneHref = (e164) => `tel:${String(e164 || "").replace(/[^\d+]/g, "")}`;

export const whatsappHref = (digits) =>
  `https://wa.me/${String(digits || "").replace(/\D/g, "")}`;
