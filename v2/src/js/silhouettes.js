/**
 * Car silhouettes, shown when a vehicle has no photograph.
 * Ported from V1. Better than a broken image, and better than blank space.
 */
const wheel = (cx, cy, r) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="currentColor" stroke-width="2"/>`;

const SHAPES = {
  sedan: `<path d="M8 40h84M14 40c0-8 6-12 14-13l10-9c2-2 5-3 8-3h20c3 0 6 1 8 3l10 9c8 1 14 5 14 13" />`,
  micro: `<path d="M12 40h76M18 40c0-9 5-13 12-14l8-10c2-2 4-3 7-3h18c3 0 5 1 7 3l8 10c7 1 12 5 12 14" />`,
  van:   `<path d="M8 40h84M14 40V18c0-2 2-4 4-4h56c3 0 5 2 6 4l10 12v10" />`
};

export function silhouette(kind = "sedan") {
  const body = SHAPES[kind] || SHAPES.sedan;
  return `<svg viewBox="0 0 100 50" width="180" height="90" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            role="img" aria-label="Photograph coming">${body}${wheel(30, 40, 6)}${wheel(72, 40, 6)}</svg>`;
}
