/**
 * Every back-office call, in one place.
 *
 * All of it goes through PostgREST with the signed-in administrator's token,
 * so row-level security decides what is allowed — not this file. If a policy
 * says no, the request comes back empty or refused, whatever the UI believes.
 */
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config.js";
import { token, signOut } from "./auth.js";

const REST = `${SUPABASE_URL}/rest/v1`;

/** Thrown when the session has ended; the shell sends the user back to sign in. */
export class SignedOut extends Error {}

async function call(path, { method = "GET", body, prefer } = {}) {
  const jwt = await token();
  if (!jwt) { throw new SignedOut("Your session has ended. Please sign in again."); }

  const res = await fetch(`${REST}/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  if (res.status === 401) { await signOut(); throw new SignedOut("Your session has ended. Please sign in again."); }
  if (res.status === 403) { throw new Error("This account is not allowed to do that."); }
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.message || `The database refused that (${res.status}).`);
  }
  return res.status === 204 ? null : res.json();
}

/** Is this account actually an administrator? RLS answers, not the browser. */
export async function whoAmI() {
  const rows = await call("admin_users?select=user_id,email,role,is_active");
  return rows[0] || null;
}

const VEHICLE_FIELDS =
  "id,slug,name,plate,price_per_day,currency,is_available,is_published,description," +
  "seats,transmission,fuel,air_conditioning,specifications,display_order,archived_at," +
  "vehicle_images(id,storage_path,alt,caption,is_primary,display_order)";

export const listVehicles = () =>
  call(`vehicles?select=${VEHICLE_FIELDS}&archived_at=is.null&order=display_order.asc`);

export const updateVehicle = (id, patch) =>
  call(`vehicles?id=eq.${id}`, { method: "PATCH", body: patch, prefer: "return=representation" });

const REQUEST_FIELDS =
  "id,reference,status,vehicle_name,quoted_price,currency,message,created_at,handled_at," +
  "vehicle_was_unavailable," +
  "customers(id,name,email,phone)";

export function listRequests({ status = null, limit = 25, offset = 0 } = {}) {
  const filter = status ? `&status=eq.${status}` : "";
  return call(
    `rental_requests?select=${REQUEST_FIELDS}${filter}` +
    `&order=created_at.desc&limit=${limit}&offset=${offset}`
  );
}

export const countRequests = (status) =>
  call(`rental_requests?select=id&status=eq.${status}`, { prefer: "count=exact" })
    .then((rows) => rows.length);

export const setRequestStatus = (id, status, adminId) =>
  call(`rental_requests?id=eq.${id}`, {
    method: "PATCH",
    prefer: "return=representation",
    body: {
      status,
      // Both or neither — the database enforces it, so send them together.
      handled_by: adminId,
      handled_at: new Date().toISOString()
    }
  });

export const listSettings = () => call("site_settings?select=key,value,description,is_public&order=key");

export const updateSetting = (key, value) =>
  call(`site_settings?key=eq.${encodeURIComponent(key)}`, {
    method: "PATCH", body: { value }, prefer: "return=representation"
  });

/**
 * A record of what was changed. Never the customer's details — an audit trail
 * must not become a second, less-guarded copy of the data it protects.
 */
export const audit = (action, entity, entityId, summary) =>
  call("admin_audit_log", { method: "POST", body: { action, entity, entity_id: String(entityId), summary } })
    .catch(() => null);          // never block a real change on its own logging
