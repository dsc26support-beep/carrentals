/**
 * Settings: the business details the website reads.
 *
 * One copy of each. V1 had the phone numbers in twenty places across two files,
 * so correcting one digit meant twenty edits and a rebuild.
 */
import { el } from "../dom.js";
import { listSettings, updateSetting, audit } from "./api.js";

/** Values are stored as JSON; show the plain string to a person. */
const plain = (value) => (typeof value === "string" ? value : JSON.stringify(value));

export async function settings(view) {
  const rows = (await listSettings()).filter((s) => s.is_public);
  const note = el("div", { class: "msg", role: "status" });
  const say = (text, kind) => { note.className = `msg msg--${kind}`; note.textContent = text; };

  const field = (setting) => {
    const input = el("input", { type: "text", value: plain(setting.value), id: `set-${setting.key}` });
    const save = el("button", {
      class: "btn", type: "button", text: "Save",
      onclick: async () => {
        const wanted = input.value.trim();
        if (wanted === plain(setting.value)) { say("Nothing changed.", "info"); return; }
        save.disabled = true;
        try {
          await updateSetting(setting.key, wanted);
          await audit("setting.update", "site_settings", setting.key, { key: setting.key });
          setting.value = wanted;
          say(`${setting.key} saved. The website updates within a minute.`, "ok");
        } catch (err) {
          say(err.message, "bad");
        } finally {
          save.disabled = false;
        }
      }
    });

    return el("section", { class: "card" }, [
      el("div", { class: "field" }, [
        el("label", { for: input.id, text: setting.key.replace("business.", "").replace(/_/g, " ") }),
        input,
        setting.description ? el("span", { class: "field__hint", text: setting.description }) : null
      ]),
      el("div", { class: "row__actions" }, [save])
    ]);
  };

  view.replaceChildren(
    el("h2", { text: "Settings" }),
    el("p", { class: "lede", text: "Your business details, as the website shows them. Each is stored once." }),
    note,
    ...rows.map(field)
  );
}
