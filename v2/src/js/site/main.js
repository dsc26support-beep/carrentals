/**
 * Customer page entry point.
 *
 * One data call feeds the list, the detail panels, the recommendations, the
 * contact links and the structured data — so what a search engine reads can
 * never drift from what a visitor sees.
 */
import { $, el, escapeHtml, focusTo } from "../dom.js";
import { perDay, phoneForDisplay, phoneHref, whatsappHref } from "../format.js";
import { loadSite } from "../api.js";
import { renderVehicles, openVehicle } from "./vehicles.js";
import { initRequestForm } from "./request-form.js";

const state = { vehicles: [], settings: {} };
const getVehicle = (id) => state.vehicles.find((v) => v.id === id) || null;

function loading(container) {
  container.replaceChildren(el("div", { class: "vehicles" },
    Array.from({ length: 3 }, () => el("div", { class: "skeleton", style: "height:92px" }))
  ));
}

function failed(container, retry) {
  const primary = state.settings["business.phone_primary"];
  container.replaceChildren(el("div", { class: "state state--error" }, [
    el("p", { text: "We could not load the cars just now." }),
    el("div", { class: "state__actions" }, [
      el("button", { type: "button", class: "btn", text: "Try again", onclick: retry }),
      el("a", { class: "btn btn--solid", href: phoneHref(primary), text: `Call ${phoneForDisplay(primary)}` })
    ])
  ]));
}

/** Contact links, phone numbers and WhatsApp, all from site_settings. */
function paintContact() {
  const s = state.settings;
  const primary = s["business.phone_primary"];
  const secondary = s["business.phone_secondary"];
  const whatsapp = s["business.whatsapp"];
  const messenger = s["business.messenger_url"];

  const mark = (cls, d) =>
    `<svg class="${cls}" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${d}</svg>`;
  const PHONE = mark("m-phone", '<path d="M7.6 10.8a13.5 13.5 0 0 0 5.6 5.6l1.9-1.9a1.1 1.1 0 0 1 1.1-.26c1.15.38 2.38.58 3.65.58a1.1 1.1 0 0 1 1.1 1.1v3a1.1 1.1 0 0 1-1.1 1.1A17.1 17.1 0 0 1 2.7 3a1.1 1.1 0 0 1 1.1-1.1h3A1.1 1.1 0 0 1 7.9 3c0 1.27.2 2.5.58 3.65a1.1 1.1 0 0 1-.27 1.12z"/>');
  const WA = mark("m-wa", '<path d="M12 2C6.48 2 2 6.48 2 12c0 1.77.46 3.43 1.27 4.87L2 22l5.25-1.38A9.95 9.95 0 0 0 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18.2a8.16 8.16 0 0 1-4.34-1.25l-.31-.19-3.12.82.83-3.04-.2-.32A8.16 8.16 0 0 1 3.8 12c0-4.52 3.68-8.2 8.2-8.2s8.2 3.68 8.2 8.2-3.68 8.2-8.2 8.2z"/>');
  const FB = mark("m-fb", '<path d="M12 2C6.5 2 2 6.2 2 11.4c0 2.9 1.4 5.5 3.6 7.2V22l3.3-1.8c.9.25 1.9.4 2.9.4 5.5 0 10-4.2 10-9.4S17.5 2 12 2zm1 12.4l-2.5-2.7-4.9 2.7 5.4-5.7 2.6 2.7 4.8-2.7-5.4 5.7z"/>');
  const MAIL = mark("m-mail", '<path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm9 8L4 7v1l8 6 8-6V7z"/>');

  const rows = [
    { href: phoneHref(primary), icon: PHONE, label: phoneForDisplay(primary) },
    { href: phoneHref(secondary), icon: PHONE, label: phoneForDisplay(secondary) }
  ];
  if (whatsapp) { rows.push({ href: whatsappHref(whatsapp), icon: WA, label: "WhatsApp", external: true }); }
  if (messenger) { rows.push({ href: messenger, icon: FB, label: "Messenger", external: true }); }
  if (s["business.email"]) { rows.push({ href: `mailto:${s["business.email"]}`, icon: MAIL, label: s["business.email"] }); }

  $("#contact-list").replaceChildren(...rows.map((row) =>
    el("li", {}, [el("a", {
      href: row.href,
      target: row.external ? "_blank" : null,
      rel: row.external ? "noopener noreferrer" : null
    }, [el("span", { html: row.icon }), el("span", { text: row.label })])])
  ));

  for (const node of document.querySelectorAll("[data-call]")) {
    node.href = phoneHref(primary);
    if (node.dataset.call === "labelled") { node.textContent = `Call ${phoneForDisplay(primary)}`; }
  }
  for (const node of document.querySelectorAll("[data-whatsapp]")) {
    if (whatsapp) { node.href = whatsappHref(whatsapp); } else { node.remove(); }
  }
  $("#foot-name").textContent = s["business.name"] || "Tenana Rentals";
  $("#foot-address").textContent = s["business.address"] || "";
}

/**
 * Structured data, generated from the payload the page just rendered.
 * No aggregateRating: there are no published reviews, and inventing one is both
 * a lie and a search penalty.
 */
function paintStructuredData() {
  const s = state.settings;
  const published = state.vehicles;
  const data = {
    "@context": "https://schema.org",
    "@type": "AutoRental",
    name: s["business.name"],
    address: {
      "@type": "PostalAddress",
      addressLocality: "Bikenibeu",
      addressRegion: "South Tarawa",
      addressCountry: "KI"
    },
    telephone: [s["business.phone_primary"], s["business.phone_secondary"]].filter(Boolean),
    areaServed: "South Tarawa, Kiribati",
    currenciesAccepted: s["business.currency"] || "AUD",
    priceRange: published.length ? `$${Math.min(...published.map((v) => v.price_per_day))}` : undefined,
    makesOffer: published.map((v) => ({
      "@type": "Offer",
      priceCurrency: v.currency,
      price: v.price_per_day,
      availability: v.is_available
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemOffered: { "@type": "Vehicle", name: v.name }
    }))
  };
  const tag = document.createElement("script");
  tag.type = "application/ld+json";
  // Escaped so a vehicle name can never break out of the script element.
  tag.textContent = JSON.stringify(data).replace(/</g, "\\u003c");
  document.head.append(tag);
}

async function start() {
  const list = $("#vehicles");
  loading(list);

  let payload;
  try {
    payload = await loadSite();
  } catch {
    failed(list, start);
    return;
  }

  state.vehicles = payload.vehicles;
  state.settings = payload.settings;

  paintContact();

  if (!state.vehicles.length) {
    list.replaceChildren(el("div", { class: "state" }, [
      el("p", { text: "No cars are listed just now. Please call us." })
    ]));
    return;
  }

  const requestForm = initRequestForm(document, {
    settings: state.settings,
    getVehicle
  });

  renderVehicles(list, state.vehicles, {
    callHref: phoneHref(state.settings["business.phone_primary"]),
    onChoose: openVehicle,
    onRequest: (id) => {
      requestForm.setVehicle(id);
      const section = $("#request");
      section.scrollIntoView({ behavior: "smooth", block: "start" });
      focusTo($("#request-form input"));
    }
  });

  $("#fleet-count").textContent = String(state.vehicles.length);

  // Last known list, shown because the connection is not there right now.
  $("#stale-notice").hidden = !payload.stale;

  paintStructuredData();
}

start();
