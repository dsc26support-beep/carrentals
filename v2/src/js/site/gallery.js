/**
 * Photo gallery — V1's scroll-snap carousel, moved to where swiping helps.
 *
 * The track is a native scroll-snap row, so a phone just swipes it and the
 * browser does the work. Dots and arrows drive the same scroll, and the active
 * index is read back off scrollLeft rather than tracked separately, so a swipe,
 * an arrow and a dot can never disagree.
 */
import { $, $$ } from "../dom.js";

export function initGallery(root) {
  const track = $(".gallery__track", root);
  if (!track) { return; }

  const slides = $$(".gallery__slide", track);
  const dots = $$(".gallery__dot", root);
  const count = $(".gallery__count", root);
  if (slides.length < 2) { return; }

  const indexNow = () => Math.round(track.scrollLeft / track.clientWidth);

  function paint() {
    const i = Math.min(Math.max(indexNow(), 0), slides.length - 1);
    dots.forEach((d, n) => d.setAttribute("aria-current", String(n === i)));
    if (count) { count.textContent = `${i + 1} / ${slides.length}`; }
    slides.forEach((s, n) => s.toggleAttribute("inert", n !== i));
  }

  function go(i) {
    const target = Math.min(Math.max(i, 0), slides.length - 1);
    track.scrollTo({ left: target * track.clientWidth, behavior: "smooth" });
  }

  track.addEventListener("scroll", () => {
    clearTimeout(track._settle);
    track._settle = setTimeout(paint, 90);      // wait for the scroll to settle
  });
  dots.forEach((d, n) => d.addEventListener("click", () => go(n)));
  $(".gallery__prev", root)?.addEventListener("click", () => go(indexNow() - 1));
  $(".gallery__next", root)?.addEventListener("click", () => go(indexNow() + 1));

  paint();
}
