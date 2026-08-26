/**
 * Back office shell: sign in, the six sections, and sign out.
 *
 * Two gates, not one. Supabase Auth says who you are; the database says
 * whether you are an administrator. A valid login that is not in admin_users
 * gets nothing — which is what makes an accidentally-created account harmless.
 */
import { $, el, focusTo } from "../dom.js";
import { signIn, signOut, isSignedIn, signedInAs } from "./auth.js";
import { whoAmI, SignedOut } from "./api.js";

import { dashboard } from "./dashboard.js";
import { vehicles } from "./vehicles.js";
import { requests } from "./requests.js";
import { customers } from "./customers.js";
import { marketing } from "./marketing.js";
import { settings } from "./settings.js";

const SECTIONS = [
  { id: "dashboard", label: "Dashboard", render: dashboard },
  { id: "vehicles",  label: "Vehicles",  render: vehicles },
  { id: "requests",  label: "Requests",  render: requests },
  { id: "customers", label: "Customers", render: customers },
  { id: "marketing", label: "Marketing", render: marketing },
  { id: "settings",  label: "Settings",  render: settings }
];

let me = null;

/* ---------- sign in ---------- */

function showSignIn(message) {
  $("#shell").hidden = true;
  $("#signin").hidden = false;
  $("#signin-error").textContent = message || "";
  focusTo($("#s-email"));
}

$("#signin-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("#signin-submit");
  const error = $("#signin-error");
  error.textContent = "";
  button.disabled = true;
  button.textContent = "Signing in…";

  try {
    await signIn($("#s-email").value.trim(), $("#s-password").value);
    await start();
  } catch (err) {
    // Never hint at which half was wrong — that tells an attacker which
    // addresses exist.
    error.textContent = /invalid/i.test(err.message)
      ? "That email and password do not match."
      : err.message;
    focusTo($("#s-email"));
  } finally {
    button.disabled = false;
    button.textContent = "Sign in";
  }
});

$("#signout").addEventListener("click", async () => {
  await signOut();
  location.hash = "";
  showSignIn("");
});

/* ---------- the shell ---------- */

function paintNav(active) {
  $("#nav").replaceChildren(...SECTIONS.map((s) =>
    el("a", {
      href: `#${s.id}`,
      text: s.label,
      "aria-current": s.id === active ? "page" : null
    })
  ));
}

const sectionFor = (hash) =>
  SECTIONS.find((s) => s.id === hash.replace("#", "")) || SECTIONS[0];

async function route() {
  if (!me) { return; }
  const section = sectionFor(location.hash);
  paintNav(section.id);

  const view = $("#view");
  view.replaceChildren(el("p", { class: "empty", text: "Loading…" }));

  try {
    await section.render(view, { me });
  } catch (err) {
    if (err instanceof SignedOut) { showSignIn(err.message); return; }
    view.replaceChildren(
      el("div", { class: "msg msg--bad", text: err.message }),
      el("button", { class: "btn", type: "button", text: "Try again", onclick: route })
    );
  }
}

window.addEventListener("hashchange", route);

/* ---------- boot ---------- */

async function start() {
  if (!isSignedIn()) { showSignIn(""); return; }

  try {
    me = await whoAmI();
  } catch (err) {
    if (err instanceof SignedOut) { showSignIn(""); return; }
    showSignIn(err.message);
    return;
  }

  // Signed in, but the database does not list this account as an
  // administrator — and nothing in this page can change that.
  if (!me || !me.is_active) {
    await signOut();
    showSignIn("That account is not an administrator.");
    return;
  }

  $("#signin").hidden = true;
  $("#shell").hidden = false;
  $("#who").textContent = signedInAs() || "";
  await route();
}

start();
