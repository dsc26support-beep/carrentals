/**
 * Public configuration. Shipped to the browser on purpose.
 *
 * The anon key belongs here: it is designed to be public and is protected by
 * row-level security, not by secrecy. No secret ever appears in this file —
 * the service-role key, the Resend key and the unsubscribe secret live only in
 * the Supabase and Netlify dashboards, and scripts/check.mjs fails the build if
 * anything secret-shaped reaches src/ or public/.
 *
 * Both values below are committed on purpose, and both are public. The key is
 * the `anon` role: it can read published vehicles and public settings and
 * nothing else, because that is all the row-level security policies allow it to
 * do. It cannot see a customer, a booking request or an administrator. If it
 * looks like a leaked key, read supabase/migrations/0007_rls.sql — that file,
 * not secrecy, is what protects the data.
 */
export const SUPABASE_URL = "https://cfttzzdyrupboarldvrf.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmdHR6emR5cnVwYm9hcmxkdnJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3MzY0MTksImV4cCI6MjEwMzMxMjQxOX0." +
  "3cF2Y0ktUhUUmXfVpllLbz53QKxu0X4e6QEUFkn-TZ4";

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
