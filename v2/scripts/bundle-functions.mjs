/**
 * Make one pasteable file per Edge Function.
 *
 * The Supabase dashboard editor takes a single file, and these functions import
 * from ../../../shared/ — outside the function directory, where no dashboard
 * deploy can follow them. So each function gets a bundle.ts: the shared modules
 * inlined, the imports removed, everything else untouched.
 *
 * The bundle is committed, because it is what the owner actually deploys and a
 * deployable artifact you cannot read in the diff is not reviewable. It is also
 * a copy, and copies drift — which is why check.mjs regenerates it and fails if
 * what is on disk differs. That is the same failure this project already
 * refused once, when _shared/validate.ts was made a re-export rather than a
 * second copy of the validation rules.
 *
 * Run: npm run bundle
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Which shared modules each function pulls in, in dependency order. */
const FUNCTIONS = {
  "submit-request": ["shared/validate.js", "shared/request-logic.js"],
  unsubscribe: []
};

const BANNER = (name, sources) => [
  "// ---------------------------------------------------------------------------",
  `// GENERATED FILE — do not edit. Run \`npm run bundle\` instead.`,
  "//",
  `// This is supabase/functions/${name}/index.ts with these modules inlined:`,
  ...sources.map((s) => `//   ${s}`),
  "//",
  "// Paste THIS file into the Supabase dashboard: Edge Functions → the function",
  "// → the editor. The dashboard takes one file, which is the whole reason this",
  "// exists. `npm run check` fails if it has fallen behind its sources.",
  "// ---------------------------------------------------------------------------",
  ""
].join("\n");

/** Strip a module's `export` keywords so its declarations can sit inline. */
function inline(source) {
  return source
    .replace(/^export\s+(const|function|class|let|async function)\b/gm, "$1")
    .replace(/^export\s*\{[^}]*\}\s*;?\s*$/gm, "")
    .trimEnd();
}

/** Drop the function's own imports of the modules now inlined above it. */
function stripImports(source) {
  return source.replace(/^import\s+(?:[\s\S]*?)\s+from\s+"\.\.\/\.\.\/\.\.\/shared\/[^"]+";\s*$/gm, "")
               .replace(/\n{3,}/g, "\n\n")
               .trimStart();
}

export function buildBundle(name) {
  const sources = FUNCTIONS[name];
  const parts = [BANNER(name, sources)];

  for (const rel of sources) {
    parts.push(`/* ===== ${rel} ${"=".repeat(Math.max(0, 64 - rel.length))} */\n`);
    parts.push(inline(fs.readFileSync(path.join(ROOT, rel), "utf8")), "\n");
  }

  const entry = path.join(ROOT, "supabase/functions", name, "index.ts");
  parts.push(`/* ===== the handler ${"=".repeat(53)} */\n`);
  parts.push(stripImports(fs.readFileSync(entry, "utf8")));

  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

export const bundlePath = (name) => path.join(ROOT, "supabase/functions", name, "bundle.ts");
export const functionNames = Object.keys(FUNCTIONS);

/* Written only when run directly; check.mjs imports the builder and compares. */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const name of functionNames) {
    const out = bundlePath(name);
    fs.writeFileSync(out, buildBundle(name));
    console.log(`bundled ${path.relative(ROOT, out)}`);
  }
}
