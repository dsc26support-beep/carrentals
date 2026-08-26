/**
 * "Other cars available".
 *
 * Not called a recommendation, because today it is not one: every car is a
 * 5-seat hatchback at the same price, so there is no signal to personalise on.
 * What is genuinely useful is showing which other cars are free — especially
 * when the one someone opened is out.
 *
 * The scoring below is real but currently ties for every pair, so the result
 * degrades cleanly to "the next available cars, in the owner's order". When the
 * fleet diversifies the same function starts producing signal, and the heading
 * can become "You may also like" once that is true.
 *
 * Pure: no DOM, no fetch, no state. Swap it without touching the call site.
 */

const WEIGHTS = { price: 40, seats: 30, specs: 20, order: 10 };

function score(candidate, selected, maxPrice) {
  let total = 0;

  if (maxPrice > 0) {
    const gap = Math.abs(candidate.price_per_day - selected.price_per_day) / maxPrice;
    total += WEIGHTS.price * (1 - Math.min(gap, 1));
  } else {
    total += WEIGHTS.price;
  }

  if (candidate.seats != null && candidate.seats === selected.seats) {
    total += WEIGHTS.seats;
  }

  const mine = new Set((selected.specifications || []).map(String));
  const theirs = new Set((candidate.specifications || []).map(String));
  if (mine.size || theirs.size) {
    let shared = 0;
    for (const s of theirs) { if (mine.has(s)) { shared += 1; } }
    total += WEIGHTS.specs * (shared / (mine.size + theirs.size - shared || 1));
  }

  return total;
}

export function recommend(vehicles, selected, limit = 3) {
  if (!Array.isArray(vehicles) || !selected) { return []; }

  const pool = vehicles.filter((v) => v.id !== selected.id && v.is_available);
  if (!pool.length) { return []; }

  const maxPrice = Math.max(...vehicles.map((v) => Number(v.price_per_day) || 0), 0);

  return pool
    .map((v) => ({ v, s: score(v, selected, maxPrice) }))
    // display_order breaks the tie, which today is every comparison
    .sort((a, b) => b.s - a.s || (a.v.display_order ?? 0) - (b.v.display_order ?? 0))
    .slice(0, limit)
    .map((x) => x.v);
}

/** Honest heading: the wording depends on why we are showing this. */
export const headingFor = (selected) =>
  selected && selected.is_available ? "Other cars available" : "Available instead";
