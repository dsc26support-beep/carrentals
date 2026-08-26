/**
 * The booking request form.
 *
 * Three fields, because every extra field loses people. Validation is the
 * shared module — the same rules the server enforces, so the browser can give
 * fast feedback without being the thing that decides.
 *
 * What this form never does is tell anyone their rental is confirmed. Only a
 * phone call does that.
 */
import { $, el, focusTo } from "../dom.js";
import { perDay, phoneForDisplay, phoneHref, whatsappHref } from "../format.js";
import { validateRequest } from "../../../shared/validate.js";
import { submitRequest } from "../api.js";

const FIELDS = ["name", "email", "phone", "message"];

export function initRequestForm(root, { settings, getVehicle }) {
  const form = $("#request-form", root);
  const chosen = $("#request-chosen", root);
  const done = $("#request-done", root);
  const submit = $("#request-submit", root);
  let vehicleId = null;
  let sending = false;

  function showErrors(errors) {
    for (const field of FIELDS.concat("vehicle_id")) {
      const input = form.elements[field];
      const slot = $(`#error-${field}`, form);
      const message = errors[field] || "";
      if (slot) { slot.textContent = message; }
      if (input) { input.setAttribute("aria-invalid", message ? "true" : "false"); }
    }
    const first = FIELDS.find((f) => errors[f]);
    if (first) { focusTo(form.elements[first]); }
  }

  function setVehicle(id) {
    const vehicle = getVehicle(id);
    if (!vehicle) { return; }
    vehicleId = id;
    chosen.replaceChildren(
      el("b", { text: vehicle.name }),
      el("span", { text: perDay(vehicle.price_per_day, vehicle.currency) })
    );
    chosen.hidden = false;
  }

  function showDone(reference) {
    const primary = settings["business.phone_primary"];
    const secondary = settings["business.phone_secondary"];
    const whatsapp = settings["business.whatsapp"];

    done.replaceChildren(
      // The exact wording, in one place. Nothing here says confirmed, booked,
      // reserved or held — because none of those has happened.
      el("h3", { text: "Request received" }),
      el("p", { text: "We will contact you by phone to confirm your rental." }),
      reference ? el("span", { class: "request__ref", text: `Reference ${reference}` }) : null,
      el("div", { class: "request__ways" }, [
        el("a", { class: "btn btn--solid", href: phoneHref(primary), text: `Call ${phoneForDisplay(primary)}` }),
        el("a", { class: "btn", href: phoneHref(secondary), text: `Call ${phoneForDisplay(secondary)}` }),
        whatsapp ? el("a", {
          class: "btn", href: whatsappHref(whatsapp),
          target: "_blank", rel: "noopener noreferrer", text: "WhatsApp"
        }) : null
      ])
    );
    form.hidden = true;          // replaced, not cleared, so nobody double-sends
    done.hidden = false;
    focusTo(done);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (sending) { return; }

    const data = Object.fromEntries(new FormData(form).entries());
    const check = validateRequest({ ...data, vehicle_id: vehicleId,
                                    marketing_consent: form.elements.marketing_consent.checked });
    showErrors(check.errors);
    if (!check.ok) { return; }

    sending = true;
    submit.disabled = true;
    submit.textContent = "Sending…";

    const result = await submitRequest({
      vehicle_id: check.values.vehicle_id,
      name: check.values.name,
      email: check.values.email,
      phone: check.values.phone,
      message: check.values.message,
      marketing_consent: check.values.marketing_consent,
      website: data.website || ""            // the honeypot, passed through untouched
    });

    sending = false;
    submit.disabled = false;
    submit.textContent = "Send booking request";

    if (result.ok) { showDone(result.reference); return; }
    if (result.fieldErrors) { showErrors(result.fieldErrors); return; }

    // Every failure ends with a way to reach a person. The phone always works.
    const slot = $("#error-form", form);
    slot.textContent = result.rateLimited
      ? result.error
      : `${result.error} Please call ${phoneForDisplay(settings["business.phone_primary"])} ` +
        `or ${phoneForDisplay(settings["business.phone_secondary"])}.`;
    focusTo(slot);
  });

  return { setVehicle };
}
