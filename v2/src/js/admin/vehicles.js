/**
 * Vehicles.
 *
 * The availability toggle comes first and is one tap, because it is the
 * control the owner uses daily — a car goes out, a car comes back. Everything
 * else on this screen is occasional.
 *
 * Each change saves on its own, immediately. V1 batched edits behind a "Save to
 * the website" button, which meant a phone going to sleep lost the lot.
 */
import { el, $ } from "../dom.js";
import { perDay } from "../format.js";
import { listVehicles, updateVehicle, audit } from "./api.js";

function toggle(vehicle, onChange) {
  const input = el("input", {
    type: "checkbox",
    checked: vehicle.is_available,
    "aria-label": `${vehicle.name} available`
  });
  const label = el("span", {
    class: "toggle__label",
    text: vehicle.is_available ? "Available" : "Out"
  });
  const wrap = el("label", {
    class: `toggle toggle--${vehicle.is_available ? "on" : "off"}`
  }, [input, el("span", { class: "toggle__track" }), label]);

  input.addEventListener("change", async () => {
    const wanted = input.checked;
    input.disabled = true;
    try {
      await updateVehicle(vehicle.id, { is_available: wanted });
      await audit("vehicle.availability", "vehicles", vehicle.id, { is_available: wanted });
      vehicle.is_available = wanted;
      label.textContent = wanted ? "Available" : "Out";
      wrap.className = `toggle toggle--${wanted ? "on" : "off"}`;
      onChange(`${vehicle.name} is now ${wanted ? "available" : "out"}.`, "ok");
    } catch (err) {
      input.checked = !wanted;                 // put the switch back where it was
      onChange(err.message, "bad");
    } finally {
      input.disabled = false;
    }
  });

  return wrap;
}

function row(vehicle, onChange) {
  const facts = [
    vehicle.plate || "no plate",
    perDay(vehicle.price_per_day, vehicle.currency),
    `${vehicle.vehicle_images?.length || 0} photo${vehicle.vehicle_images?.length === 1 ? "" : "s"}`,
    vehicle.is_published ? null : "not on the website yet"
  ].filter(Boolean);

  return el("article", { class: "row" }, [
    el("div", { class: "row__top" }, [
      el("div", {}, [
        el("span", { class: "row__name", text: vehicle.name }),
        el("div", { class: "row__meta", text: facts.join(" · ") })
      ]),
      toggle(vehicle, onChange)
    ])
  ]);
}

export async function vehicles(view) {
  const all = await listVehicles();
  const note = el("div", { class: "msg", role: "status" });

  const say = (text, kind) => {
    note.className = `msg msg--${kind}`;
    note.textContent = text;
  };

  view.replaceChildren(
    el("h2", { text: "Vehicles" }),
    el("p", { class: "lede", text: "Tap a switch to put a car out or bring it back. The website updates within a minute." }),
    note,
    all.length
      ? el("div", { class: "rows" }, all.map((v) => row(v, say)))
      : el("div", { class: "empty" }, [
          el("strong", { text: "No cars yet" }),
          el("span", { text: "Add one in Supabase, or ask for the add-a-car screen." })
        ])
  );
}
