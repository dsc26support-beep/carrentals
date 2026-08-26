/**
 * Signing in to the back office.
 *
 * Supabase Auth over plain fetch — the same choice as the customer page, for
 * the same reason: @supabase/supabase-js is ~30 KB and this is the only thing
 * we need from it. The token endpoints are three POSTs.
 *
 * The session is a JWT that expires in an hour and is scoped by row-level
 * security to what an administrator may do. That is the whole difference from
 * V1, which kept a GitHub token with write access to the entire repository in
 * the same browser storage, valid until somebody remembered to revoke it.
 */
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config.js";

const KEY = "tenana.session.v1";
const AUTH = `${SUPABASE_URL}/auth/v1`;

let session = null;

function store(value) {
  session = value;
  try {
    if (value) { localStorage.setItem(KEY, JSON.stringify(value)); }
    else { localStorage.removeItem(KEY); }
  } catch { /* private browsing: the session lives in memory for this tab */ }
}

function load() {
  if (session) { return session; }
  try { session = JSON.parse(localStorage.getItem(KEY) || "null"); }
  catch { session = null; }
  return session;
}

async function post(path, body) {
  const res = await fetch(`${AUTH}/${path}`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { throw new Error(data.error_description || data.msg || data.error || "Sign in failed"); }
  return data;
}

export async function signIn(email, password) {
  const data = await post("token?grant_type=password", { email, password });
  store({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
    email: data.user?.email || email
  });
  return session;
}

export async function signOut() {
  const current = load();
  if (current) {
    // Best effort: revoke server-side, but clear locally whatever happens.
    await fetch(`${AUTH}/logout`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${current.access_token}` }
    }).catch(() => {});
  }
  store(null);
}

/** A valid token, refreshing it first if it is close to expiring. */
export async function token() {
  const current = load();
  if (!current) { return null; }
  if (Date.now() < current.expires_at - 60_000) { return current.access_token; }

  try {
    const data = await post("token?grant_type=refresh_token", { refresh_token: current.refresh_token });
    store({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in || 3600) * 1000,
      email: current.email
    });
    return session.access_token;
  } catch {
    store(null);                    // refresh rejected: the session is over
    return null;
  }
}

export const signedInAs = () => load()?.email || null;
export const isSignedIn = () => Boolean(load());
