/**
 * Booking requests.
 *
 * A request arrives as `pending` and only a person moves it on. The website
 * has no path to any other status — that is the whole point of confirming by
 * phone, and it is enforced in the database, not here.
 */
import { el } from "../dom.js";
import { money, phoneForDisplay, phoneHref, whatsappHref } from "../format.js";
import { listRequests, setRequestStatus, audit } from "./api.js";

const FLOW = ["pending", "contacted", "confirmed", "declined", "cancelled"];
const NEXT = {
  pending:   ["contacted", "declined"],
  contacted: ["confirmed", "declined"],
  confirmed: ["cancelled"],
  declined:  [],
  cancelled: []
};

/** "2 hours ago" — when it arrived, which is not a rental date. */
function ago(iso) {
  const mins = Math.round((Date.now() - new Date(iso)) / 60000);
  if (mins < 1) { return "just now"; }
  if (mins < 60) { return `${mins} minute${mins === 1 ? "" : "s"} ago`; }
  const hours = Math.round(mins / 60);
  if (hours < 24) { return `${hours} hour${hours === 1 ? "" : "s"} ago`; }
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function card(request, me, refresh, say) {
  const person = request.customers || {};

  const move = (status) => el("button", {
    type: "button",
    class: status === "confirmed" ? "btn btn--solid" : "btn",
    text: { contacted: "Mark contacted", confirmed: "Confirm", declined: "Decline", cancelled: "Cancel" }[status],
    onclick: async (event) => {
      event.target.disabled = true;
      try {
        await setRequestStatus(request.id, status, me.user_id);
        await audit("request.status", "rental_requests", request.id, { to: status });
        say(`${request.reference} is now ${status}.`, "ok");
        await refresh();
      } catch (err) {
        event.target.disabled = false;
        say(err.message, "bad");
      }
    }
  });

  return el("article", { class: "row" }, [
    el("div", { class: "row__top" }, [
      el("div", {}, [
        el("span", { class: "row__name", text: person.name || "—" }),
        el("div", { class: "row__meta",
          text: `${request.vehicle_name} · ${money(request.quoted_price, request.currency)} · ${ago(request.created_at)} · ${request.reference}` })
      ]),
      el("span", { class: `status-tag status-${request.status}`, text: request.status })
    ]),

    // Confirmation happens on the phone, so calling is the primary action.
    el("div", { class: "contact-actions" }, [
      person.phone ? el("a", {
        class: "btn btn--solid", href: phoneHref(person.phone),
        text: `Call ${phoneForDisplay(person.phone)}`
      }) : null,
      person.phone ? el("a", {
        class: "btn", href: whatsappHref(person.phone),
        target: "_blank", rel: "noopener noreferrer", text: "WhatsApp"
      }) : null,
      person.email ? el("a", { class: "btn", href: `mailto:${person.email}`, text: "Email" }) : null
    ]),

    request.message ? el("p", { class: "row__meta", text: `"${request.message}"` }) : null,

    NEXT[request.status].length
      ? el("div", { class: "row__actions" }, NEXT[request.status].map(move))
      : null
  ]);
}

export async function requests(view, { me }) {
  let filter = "pending";

  const note = el("div", { class: "msg", role: "status" });
  const list = el("div", { class: "rows" });
  const say = (text, kind) => { note.className = `msg msg--${kind}`; note.textContent = text; };

  async function load() {
    const rows = await listRequests({ status: filter });
    list.replaceChildren(
      rows.length
        ? el("div", { class: "rows" }, rows.map((r) => card(r, me, load, say)))
        : el("div", { class: "empty" }, [
            el("strong", { text: `Nothing ${filter}` }),
            el("span", { text: filter === "pending"
              ? "New requests from the website appear here."
              : "Try another status above." })
          ])
    );
  }

  const pills = el("div", { class: "pills" }, FLOW.map((status) =>
    el("button", {
      type: "button", class: "pill", text: status,
      "aria-pressed": String(status === filter),
      onclick: async (event) => {
        filter = status;
        for (const p of event.target.parentElement.children) {
          p.setAttribute("aria-pressed", String(p.textContent === status));
        }
        await load();
      }
    })
  ));

  view.replaceChildren(
    el("h2", { text: "Requests" }),
    el("p", { class: "lede", text: "Ring the customer, then move the request along. Nothing here is confirmed until you say so." }),
    pills, note, list
  );
  await load();
}
