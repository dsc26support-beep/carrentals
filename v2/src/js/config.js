/**
 * Public configuration. Shipped to the browser on purpose.
 *
 * The anon key belongs here: it is designed to be public and is protected by
 * row-level security, not by secrecy. No secret ever appears in this file —
 * the service-role key, the Resend key and the unsubscribe secret live only in
 * the Supabase and Netlify dashboards, and scripts/check.mjs fails the build if
 * anything secret-shaped reaches src/ or public/.
 *
 * The build replaces these two values from the environment.
 */
export const SUPABASE_URL = "__SUPABASE_URL__";
export const SUPABASE_ANON_KEY = "__SUPABASE_ANON_KEY__";

/** How long a cached vehicle list is served before revalidating. */
export const CACHE_TTL_MS = 60_000;

/** Where the last good payload is kept for when Supabase cannot be reached. */
export const CACHE_KEY = "tenana.vehicles.v1";

/** Fallbacks used only until site_settings loads, so the page is never mute. */
export const FALLBACK_CONTACT = Object.freeze({
  "business.name": "Tenana Rentals",
  "business.phone_primary": "+68673053005",
  "business.phone_secondary": "+68673039089",
  "business.whatsapp": "68673039089",
  "business.address": "Bikenibeu, South Tarawa, Kiribati"
});
