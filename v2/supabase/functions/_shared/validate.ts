// The Edge Functions use the same validation module as the browser.
//
// Re-export rather than reimplement: two copies of a phone rule drift, and the
// drift is invisible until a customer's number will not dial.
//
// Deno resolves this relative import directly. Verify at first deploy that the
// Supabase CLI bundles a file from outside the functions directory; if it does
// not, the build copies shared/validate.js into this folder and check.mjs
// asserts the two are byte-identical.
export * from "../../../shared/validate.js";
