/**
 * Spec-row icons, chosen from the wording of the row.
 *
 * Ported from V1 unchanged in behaviour, including the matches added there
 * after real fall-throughs: "Petrol" once drew a suitcase, and so did
 * "2016 model" and "White".
 */
const P = (d, extra = "") =>
  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
  `stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}${extra}</svg>`;

export const ICONS = {
  gear:   P('<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/>'),
  people: P('<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 6a3 3 0 0 1 0 6M17 20a6 6 0 0 0-2-4"/>'),
  door:   P('<rect x="5" y="3" width="14" height="18" rx="1.5"/><circle cx="15.5" cy="12" r="1"/>'),
  snow:   P('<path d="M12 2v20M4 7l16 10M20 7L4 17M9 4l3 2 3-2M9 20l3-2 3 2"/>'),
  fuel:   P('<path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M6 8h6"/><path d="M17 9l3 2v7a1.5 1.5 0 0 1-3 0V9z"/>'),
  boot:   P('<rect x="3" y="7" width="18" height="12" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>'),
  cal:    P('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  paint:  P('<path d="M12 3s5 5.5 5 9a5 5 0 0 1-10 0c0-3.5 5-9 5-9z"/>'),
  tag:    P('<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9z"/><circle cx="7.5" cy="7.5" r="1.3"/>')
};

export function iconFor(text) {
  const t = String(text).toLowerCase();
  if (t.includes("automatic") || t.includes("manual") || t.includes("transmission")) { return ICONS.gear; }
  if (t.includes("passenger") || t.includes("seat")) { return ICONS.people; }
  if (t.includes("door")) { return ICONS.door; }
  if (t.includes("air") || t.includes("conditioning")) { return ICONS.snow; }
  if (t.includes("petrol") || t.includes("gasoline") || t.includes("diesel") ||
      t.includes("hybrid") || t.includes("electric") || t.includes("fuel")) { return ICONS.fuel; }
  if (t.includes("model") || /\b(19|20)\d{2}\b/.test(t)) { return ICONS.cal; }
  if (/\b(white|black|red|blue|silver|gray|grey|green|gold|brown)\b/.test(t)) { return ICONS.paint; }
  if (t.includes("$") || t.includes("day") || t.includes("rate")) { return ICONS.tag; }
  return ICONS.boot;
}
