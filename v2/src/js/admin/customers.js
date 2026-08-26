/**
 * Customers.
 *
 * There is deliberately no export button. A spreadsheet of customer phone
 * numbers on a laptop is exactly how V1 leaked — it published names in a file
 * anyone could read. Look people up here; do not carry them around.
 */
import { el } from "../dom.js";
import { phoneForDisplay, phoneHref } from "../format.js";
import { listRequests } from "./api.js";

export async function customers(view) {
  // Everyone who has ever asked, newest first, one row each.
  const rows = await listRequests({ limit: 200 });
  const seen = new Map();
  for (const r of rows) {
    const person = r.customers;
    if (!person || seen.has(person.id)) { continue; }
    seen.set(person.id, { ...person, last: r.created_at, asked: r.vehicle_name });
  }
  const people = [...seen.values()];

  const search = el("input", { type: "search", placeholder: "Search by name, email or number", "aria-label": "Search customers" });
  const list = el("div", { class: "rows" });

  function paint(term = "") {
    const needle = term.trim().toLowerCase();
    const shown = needle
      ? people.filter((p) => `${p.name} ${p.email} ${p.phone}`.toLowerCase().includes(needle))
      : people;

    list.replaceChildren(
      shown.length
        ? el("div", { class: "rows" }, shown.map((p) =>
            el("article", { class: "row" }, [
              el("div", { class: "row__top" }, [
                el("div", {}, [
                  el("span", { class: "row__name", text: p.name }),
                  el("div", { class: "row__meta", text: `${p.email} · last asked about ${p.asked}` })
                ]),
                el("a", { class: "btn", href: phoneHref(p.phone), text: phoneForDisplay(p.phone) })
              ])
            ])
          ))
        : el("div", { class: "empty" }, [
            el("strong", { text: needle ? "Nobody matches" : "No customers yet" }),
            el("span", { text: needle ? "Try part of a name or number." : "They appear here once someone sends a request." })
          ])
    );
  }

  search.addEventListener("input", () => paint(search.value));

  view.replaceChildren(
    el("h2", { text: "Customers" }),
    el("p", { class: "lede", text: "Everyone who has sent a request. Their details stay here — this list is never published and cannot be exported." }),
    el("div", { class: "card" }, [search]),
    list
  );
  paint();
}
