/**
 * The vehicle list: a collapsed row per car, expanding to the detail.
 *
 * Six rows fit one phone screen, so a customer sees the whole fleet and every
 * price without scrolling. V1 showed one car at a time in a carousel.
 *
 * Rows are <button aria-expanded>, not <details>: V1's breakpoint-syncing
 * dropdowns fought the browser, and aria-expanded is what assistive technology
 * actually reads.
 */
import { el, $, escapeHtml } from "../dom.js";
import { perDay } from "../format.js";
import { iconFor } from "../icons.js";
import { silhouette } from "../silhouettes.js";
import { initGallery } from "./gallery.js";
import { recommend, headingFor } from "./recommend.js";

const CHEV = `<svg class="vehicle__chev" viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>`;

/**
 * Availability. The dot is decoration and is hidden from assistive technology;
 * the word carries the meaning. Colour is never the only signal.
 */
function availability(vehicle) {
  const free = vehicle.is_available;
  return el("span", { class: `avail ${free ? "avail--yes" : "avail--no"}` }, [
    el("span", { class: "avail__dot", "aria-hidden": "true" }),
    el("span", { text: free ? "Available" : "Out" })
  ]);
}

/** Typed facts first, then the free-text extras. Unknown fields are omitted. */
function specRows(vehicle) {
  const rows = [];
  if (vehicle.seats != null) { rows.push(`${vehicle.seats} passengers`); }
  if (vehicle.transmission) { rows.push(`${vehicle.transmission} transmission`); }
  if (vehicle.fuel) { rows.push(vehicle.fuel); }
  if (vehicle.air_conditioning === true) { rows.push("Air-conditioning"); }
  rows.push(...vehicle.specifications);

  // Capitalised for display only; the stored value is untouched.
  return rows.map((r) => r.charAt(0).toUpperCase() + r.slice(1));
}

function gallery(vehicle) {
  if (!vehicle.images.length) {
    return el("div", { class: "gallery" }, [
      el("div", { class: "gallery__track" }, [
        el("div", { class: "gallery__slide" }, [
          el("div", { class: "gallery__art", html: silhouette("micro") })
        ])
      ]),
      el("p", { class: "gallery__count", text: "Photograph coming" })
    ]);
  }

  const slides = vehicle.images.map((img, i) =>
    el("div", { class: "gallery__slide" }, [
      el("img", {
        src: img.url,
        alt: img.alt,                          // required by the database, so always present
        width: img.width || 1200,
        height: img.height || 800,
        loading: i === 0 ? "eager" : "lazy",
        decoding: "async"
      })
    ])
  );

  // A caption is how a photo says "this is the model, not this exact car".
  // V1 showed that as a visible tag; without it, a borrowed photo reads as a
  // photo of the car you are about to hire.
  const caption = vehicle.images.find((img) => img.caption);

  const bar = vehicle.images.length > 1
    ? el("div", { class: "gallery__bar" }, [
        el("button", { type: "button", class: "gallery__nav gallery__prev", "aria-label": "Previous photo", html: "&#8249;" }),
        el("div", { class: "gallery__dots" }, vehicle.images.map((_, i) =>
          el("button", { type: "button", class: "gallery__dot", "aria-label": `Photo ${i + 1}`, "aria-current": String(i === 0) })
        )),
        el("button", { type: "button", class: "gallery__nav gallery__next", "aria-label": "Next photo", html: "&#8250;" }),
        el("span", { class: "gallery__count", text: `1 / ${vehicle.images.length}` })
      ])
    : null;

  return el("div", { class: "gallery" }, [
    el("div", { class: "gallery__track" }, slides),
    bar,
    caption ? el("p", { class: "gallery__caption", text: caption.caption }) : null
  ]);
}

function alsoLike(vehicle, all, onChoose) {
  const others = recommend(all, vehicle);
  if (!others.length) { return null; }

  return el("section", { class: "also" }, [
    el("h3", { text: headingFor(vehicle) }),
    el("div", { class: "also__grid" }, others.map((other) =>
      el("button", {
        type: "button",
        class: "also__card",
        onclick: () => onChoose(other.id)
      }, [
        el("b", { text: other.name }),
        el("span", { text: perDay(other.price_per_day, other.currency) })
      ])
    ))
  ]);
}

function panel(vehicle, all, handlers) {
  const kids = [gallery(vehicle)];

  if (vehicle.description) { kids.push(el("p", { class: "vehicle__note", text: vehicle.description })); }

  const specs = specRows(vehicle);
  if (specs.length) {
    kids.push(el("ul", { class: "specs" }, specs.map((row) =>
      el("li", {}, [el("span", { html: iconFor(row) }), el("span", { text: row })])
    )));
  }

  const actions = el("div", { class: "vehicle__actions" });
  if (vehicle.is_available) {
    actions.append(el("button", {
      type: "button", class: "btn btn--solid",
      text: "Request this vehicle",
      onclick: () => handlers.onRequest(vehicle.id)
    }));
  } else {
    // An unavailable car is still a lead. Never a dead end.
    kids.push(el("p", { class: "vehicle__note",
      text: "This car is out at the moment. Call us — we may have it back sooner than you think, or another car free." }));
    actions.append(el("a", { class: "btn", href: handlers.callHref, text: "Call about this car" }));
  }
  kids.push(actions);

  const also = alsoLike(vehicle, all, handlers.onChoose);
  if (also) { kids.push(also); }

  return el("div", { class: "vehicle__panel", hidden: true, id: `panel-${vehicle.id}` }, kids);
}

export function renderVehicles(container, vehicles, handlers) {
  const list = el("div", { class: "vehicles", id: "vehicle-list" });

  for (const vehicle of vehicles) {
    const body = panel(vehicle, vehicles, handlers);

    const toggle = el("button", {
      type: "button",
      class: "vehicle__toggle",
      "aria-expanded": "false",
      "aria-controls": body.id
    }, [
      el("span", {}, [
        el("span", { class: "vehicle__name", text: vehicle.name }),
        el("span", { class: "vehicle__price", text: perDay(vehicle.price_per_day, vehicle.currency) }),
        el("span", { class: "vehicle__avail" }, [availability(vehicle)])
      ]),
      el("span", { html: CHEV })
    ]);

    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      body.hidden = open;
      if (!open) { initGallery(body); }
    });

    list.append(el("article", {
      class: `vehicle${vehicle.is_available ? "" : " vehicle--out"}`,
      "data-vehicle": vehicle.id
    }, [toggle, body]));
  }

  container.replaceChildren(list);
}

/** Open one vehicle and bring it into view — used by the "also like" cards. */
export function openVehicle(id) {
  const card = document.querySelector(`[data-vehicle="${CSS.escape(id)}"]`);
  if (!card) { return; }
  const toggle = $(".vehicle__toggle", card);
  if (toggle.getAttribute("aria-expanded") !== "true") { toggle.click(); }
  card.scrollIntoView({ block: "start", behavior: "smooth" });
  toggle.focus();
}
