// ---------------------------------------------------------------------------
// GENERATED FILE — do not edit. Run `npm run bundle` instead.
//
// This is supabase/functions/unsubscribe/index.ts with these modules inlined:
//
// Paste THIS file into the Supabase dashboard: Edge Functions → the function
// → the editor. The dashboard takes one file, which is the whole reason this
// exists. `npm run check` fails if it has fallen behind its sources.
// ---------------------------------------------------------------------------

/* ===== the handler ===================================================== */

/**
 * Stop emailing somebody.
 *
 * No authentication, deliberately. A person who wants out cannot be asked to
 * remember a password first, and the token in the link is the only thing that
 * identifies the row — it grants nothing except the ability to leave.
 *
 * The row is kept, with unsubscribed_at set, rather than deleted. Deleting it
 * would let the same address be re-added by the next form submission, which is
 * exactly what somebody who just unsubscribed did not ask for.
 *
 * DEPLOYMENT: paste bundle.ts, not this file. See submit-request/index.ts.
 */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function page(title: string, body: string, status = 200) {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="robots" content="noindex,nofollow"><title>${title}</title>` +
    `<style>body{font:16px/1.6 system-ui,sans-serif;margin:0;min-height:100vh;display:grid;` +
    `place-items:center;padding:24px;background:#fff;color:#1a1a1a}` +
    `main{max-width:32rem;text-align:center}h1{font-size:1.5rem;margin:0 0 .5rem}` +
    `@media(prefers-color-scheme:dark){body{background:#131313;color:#f2f2f2}}</style>` +
    `</head><body><main><h1>${title}</h1>${body}</main></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

Deno.serve(async (req: Request) => {
  const token = new URL(req.url).searchParams.get("token") || "";

  // Checked before it reaches the database, so a malformed token is a bad link
  // rather than a query.
  if (!UUID_RE.test(token)) {
    return page("That link did not work",
      "<p>Please forward the email to us and we will take you off the list by hand.</p>", 400);
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/marketing_subscribers?unsubscribe_token=eq.${token}`, {
        method: "PATCH",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation"
        },
        body: JSON.stringify({ unsubscribed_at: new Date().toISOString(), consented: false })
      });

    if (!res.ok) { throw new Error(`${res.status} ${await res.text()}`); }
    const rows = await res.json();

    // An unknown token and an already-unsubscribed address get the same answer.
    // Both are true — the address is not on the list — and distinguishing them
    // would let somebody test whether an address is subscribed.
    return page("You are unsubscribed",
      rows.length
        ? "<p>You will not get marketing email from Tenana Rentals again.</p>"
        : "<p>That address is not on our list.</p>");
  } catch (err) {
    console.error("unsubscribe failed:", err);
    return page("Something went wrong",
      "<p>Please email us and we will take you off the list by hand.</p>", 500);
  }
});
