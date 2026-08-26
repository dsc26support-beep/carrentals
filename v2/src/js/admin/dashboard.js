/**
 * Dashboard: the numbers that decide what to do next, and nothing else.
 */
import { el } from "../dom.js";
import { listVehicles, listRequests } from "./api.js";

const tile = (label, value, attention) =>
  el("div", { class: `tile${attention ? " tile--attention" : ""}` }, [
    el("dt", { text: label }),
    el("dd", { text: String(value) })
  ]);

export async function dashboard(view) {
  const [cars, pending, recent] = await Promise.all([
    listVehicles(),
    listRequests({ status: "pending", limit: 100 }),
    listRequests({ limit: 5 })
  ]);

  const out = cars.filter((c) => !c.is_available);
  const unpublished = cars.filter((c) => !c.is_published);

  view.replaceChildren(
    el("h2", { text: "Today" }),
    el("p", { class: "lede", text: "What needs you." }),

    el("dl", { class: "tiles" }, [
      tile("Requests waiting", pending.length, pending.length > 0),
      tile("Cars available", cars.length - out.length),
      tile("Cars out", out.length),
      tile("Not on the website", unpublished.length, unpublished.length > 0)
    ]),

    pending.length
      ? el("div", { class: "msg msg--info", text:
          `${pending.length} request${pending.length === 1 ? "" : "s"} waiting for a phone call. Open Requests.` })
      : null,

    el("section", { class: "card" }, [
      el("h3", { text: "Latest requests" }),
      recent.length
        ? el("div", { class: "rows" }, recent.map((r) =>
            el("div", { class: "row__top" }, [
              el("div", {}, [
                el("strong", { text: r.customers?.name || "—" }),
                el("div", { class: "row__meta", text: `${r.vehicle_name} · ${r.reference}` })
              ]),
              el("span", { class: `status-tag status-${r.status}`, text: r.status })
            ])
          ))
        : el("p", { class: "row__meta", text: "No requests yet." })
    ])
  );
}
