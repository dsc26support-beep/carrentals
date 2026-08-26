/**
 * Every network call the customer page makes, in one place.
 *
 * One place so it can be audited, cached and stubbed as a unit. V1 scattered
 * fetches through the page and refetched bookings.json with a cache-buster on
 * every load, defeating every cache in the path.
 */
import { SUPABASE_URL, SUPABASE_ANON_KEY, CACHE_KEY, CACHE_TTL_MS, FALLBACK_CONTACT } from "./config.js";

const VEHICLE_FIELDS = [
  "id", "slug", "name", "price_per_day", "currency", "is_available", "description",
  "seats", "transmission", "fuel", "air_conditioning", "specifications", "display_order",
  "vehicle_images(storage_path,alt,is_primary,display_order,width,height)"
].join(",");

const rest = (path) => `${SUPABASE_URL}/rest/v1/${path}`;
const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };

async function getJson(url, signal) {
  const res = await fetch(url, { headers, signal });
  if (!res.ok) { throw new Error(`Request failed (${res.status})`); }
  return res.json();
}

/* --- the last good payload, for when the connection is not there ---------- */

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) { return null; }
    const cached = JSON.parse(raw);
    if (!cached || !Array.isArray(cached.vehicles)) { return null; }
    return cached;
  } catch { return null; }          // private browsing, quota, corrupt entry
}

function writeCache(payload) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...payload, at: Date.now() }));
  } catch { /* nothing to remember it with; the page still works */ }
}

/**
 * Vehicles and public settings.
 *
 * Returns { vehicles, settings, stale }. `stale: true` means Supabase could not
 * be reached and this is the last list the device saw — the page says so rather
 * than showing an empty screen. Connectivity on South Tarawa makes that worth
 * the few lines it costs.
 */
export async function loadSite({ signal } = {}) {
  const cached = readCache();
  const fresh = cached && Date.now() - cached.at < CACHE_TTL_MS;
  if (fresh) { return { ...cached, stale: false }; }

  try {
    const [vehicles, settingRows] = await Promise.all([
      getJson(rest(`vehicles?select=${VEHICLE_FIELDS}&order=display_order.asc`), signal),
      getJson(rest("site_settings?select=key,value"), signal)
    ]);

    const settings = { ...FALLBACK_CONTACT };
    for (const row of settingRows) { settings[row.key] = row.value; }

    const payload = { vehicles: vehicles.map(normalize), settings };
    writeCache(payload);
    return { ...payload, stale: false };
  } catch (err) {
    if (cached) { return { ...cached, stale: true }; }
    throw err;
  }
}

/**
 * Vehicle rows as the page wants them: images sorted, primary first, and the
 * unverified fields left absent rather than guessed at.
 */
function normalize(row) {
  const images = (row.vehicle_images || [])
    .slice()
    .sort((a, b) => (b.is_primary === true) - (a.is_primary === true) ||
                    (a.display_order ?? 0) - (b.display_order ?? 0))
    .map((img) => ({
      ...img,
      url: `${SUPABASE_URL}/storage/v1/object/public/vehicle-images/${img.storage_path}`
    }));

  return {
    ...row,
    price_per_day: Number(row.price_per_day),
    specifications: Array.isArray(row.specifications) ? row.specifications : [],
    images
  };
}

/**
 * Submit a booking request.
 *
 * Posts to the Edge Function, never straight to a table. The function is where
 * validation is authoritative, where the rate limit lives, and where the price
 * and vehicle name are read from the database rather than believed from here.
 */
export async function submitRequest(body, { signal } = {}) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-request`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal
  });

  let data = null;
  try { data = await res.json(); } catch { /* a non-JSON body is handled below */ }

  if (res.status === 429) {
    return { ok: false, rateLimited: true, error: "You have already sent a request. Please call us." };
  }
  if (!res.ok) {
    return { ok: false, fieldErrors: data?.errors || null, error: data?.error || "We could not send that." };
  }
  return { ok: true, reference: data?.reference || "" };
}
