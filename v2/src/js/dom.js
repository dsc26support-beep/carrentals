/** Small DOM helpers. Deliberately tiny — this is not a framework. */

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) { continue; }
    if (k === "class") { node.className = v; }
    else if (k === "text") { node.textContent = v; }
    else if (k === "html") { node.innerHTML = v; }        // callers pass only our own markup
    else if (k.startsWith("on") && typeof v === "function") { node.addEventListener(k.slice(2), v); }
    else { node.setAttribute(k, v === true ? "" : String(v)); }
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined) { continue; }
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

/**
 * Escape text for interpolation into markup.
 *
 * Used where building a string is genuinely simpler than building nodes. Every
 * other path uses textContent, which cannot inject anything by construction.
 * V1 concatenated unescaped values into innerHTML; a vehicle named
 * `<script>…` would have executed.
 */
export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

/** Replace a container's contents with one node. */
export function render(container, node) {
  container.replaceChildren(node);
  return container;
}

/** Move focus somewhere and announce it, without leaving a stray tabstop. */
export function focusTo(node) {
  if (!node) { return; }
  if (!node.hasAttribute("tabindex")) { node.setAttribute("tabindex", "-1"); }
  node.focus({ preventScroll: false });
}
