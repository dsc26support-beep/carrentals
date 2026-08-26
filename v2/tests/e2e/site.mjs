import { chromium } from "playwright";
import { stubSupabase, VEHICLES } from "./fixture.mjs";

const BASE = "http://127.0.0.1:8741/public/index.html";
const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
let pass = 0, fail = 0;
const check = (label, got, want = true) => {
  const okay = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${okay ? "PASS" : "FAIL"}  ${label}${okay ? "" : `  (got ${JSON.stringify(got)})`}`);
  okay ? pass++ : fail++;
};

const browser = await chromium.launch({ executablePath: EXE });

async function page(opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 390, height: 844 } });
  await stubSupabase(ctx, opts);
  const p = await ctx.newPage();
  p.errors = [];
  p.on("pageerror", (e) => p.errors.push(String(e.message)));
  p.on("console", (m) => { if (m.type() === "error") p.errors.push("console: " + m.text()); });
  await p.goto(BASE, { waitUntil: "domcontentloaded" });
  await p.waitForSelector("#vehicle-list", { timeout: 8000 });
  p.ctx = ctx;
  return p;
}

for (const [w, h, tag] of [[390, 844, "mobile"], [1280, 900, "desktop"]]) {
  console.log(`\n--- ${tag} ---`);
  const p = await page({ viewport: { width: w, height: h } });

  check("five rows render", await p.locator(".vehicle").count(), 5);
  check("count line filled", await p.locator("#fleet-count").textContent(), "5");
  check("every row shows a price",
    await p.locator(".vehicle__price").evaluateAll((n) => n.every((e) => e.textContent === "$60/day")));
  check("four available, one out", await p.locator(".avail--yes").count(), 4);
  check("the out car is marked", await p.locator(".avail--no").first().textContent(), "Out");
  check("availability dot hidden from AT",
    await p.locator(".avail__dot").first().getAttribute("aria-hidden"), "true");
  check("name, price and availability are on three lines",
    await p.locator(".vehicle").first().evaluate((card) => {
      const top = (sel) => Math.round(card.querySelector(sel).getBoundingClientRect().top);
      const [n, pr, av] = [top(".vehicle__name"), top(".vehicle__price"), top(".vehicle__avail")];
      return n < pr && pr < av;
    }));
  check("rows start collapsed",
    await p.locator(".vehicle__toggle").evaluateAll((n) => n.every((e) => e.getAttribute("aria-expanded") === "false")));
  check("panels start hidden",
    await p.locator(".vehicle__panel").evaluateAll((n) => n.every((e) => e.hidden)));

  // expand
  await p.locator(".vehicle__toggle").first().click();
  await p.waitForTimeout(200);
  check("expands", await p.locator(".vehicle__toggle").first().getAttribute("aria-expanded"), "true");
  check("panel visible", await p.locator(".vehicle__panel").first().isVisible());
  check("gallery has both photos", await p.locator(".vehicle").first().locator(".gallery__slide").count(), 2);
  check("every image has alt text",
    await p.locator(".gallery__slide img").evaluateAll((n) => n.every((i) => i.alt.trim().length > 3)));
  check("photos render landscape, not full-height",
    await p.locator(".gallery__slide img").first()
      .evaluate((i) => { const r = i.getBoundingClientRect(); return r.height > 0 && r.height < r.width; }));
  check("images are lazy after the first",
    await p.locator(".gallery__slide img").evaluateAll((n) => n.slice(1).every((i) => i.loading === "lazy")));
  check("a borrowed photo says so",
    await p.locator(".vehicle").first().locator(".gallery__caption").textContent(),
    "Photo shows the model");
  check("specs listed", await p.locator(".vehicle").first().locator(".specs li").count(), 6);
  check("recommendations shown", await p.locator(".vehicle").first().locator(".also__card").count(), 3);
  check("recommendations exclude the open car",
    await p.locator(".vehicle").first().locator(".also__card b").allTextContents()
      .then((t) => !t.includes("Nissan March")));
  check("recommendations exclude the out car",
    await p.locator(".vehicle").first().locator(".also__card b").allTextContents()
      .then((t) => t.filter((x) => x === "Toyota Vitz — white").length <= 1));

  // the out car
  const out = p.locator(".vehicle--out").first();
  await out.locator(".vehicle__toggle").click();
  await p.waitForTimeout(150);
  check("out car has no request button", await out.locator("button:has-text('Request this vehicle')").count(), 0);
  check("out car offers a call instead", await out.locator("a:has-text('Call about this car')").count(), 1);

  check("no horizontal overflow",
    await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  check("no page errors", p.errors, []);
  await p.ctx.close();
}

console.log(`\n--- form ---`);
{
  const p = await page();
  await p.locator(".vehicle__toggle").first().click();
  await p.locator("button:has-text('Request this vehicle')").first().click();
  await p.waitForTimeout(400);
  check("chosen vehicle shown", await p.locator("#request-chosen b").textContent(), "Nissan March");
  check("consent is NOT pre-ticked", await p.locator("#f-consent").isChecked(), false);

  await p.locator("#request-submit").click();
  await p.waitForTimeout(200);
  check("empty submit reports name", await p.locator("#error-name").textContent(), "Enter your name.");
  check("empty submit reports email", (await p.locator("#error-email").textContent()).length > 5);
  check("empty submit reports phone", (await p.locator("#error-phone").textContent()).length > 5);
  check("focus lands on the first bad field", await p.evaluate(() => document.activeElement.id), "f-name");
  check("bad field marked invalid", await p.locator("#f-name").getAttribute("aria-invalid"), "true");

  await p.fill("#f-name", "Tabweaka");
  await p.fill("#f-email", "not-an-email");
  await p.fill("#f-phone", "123");
  await p.locator("#request-submit").click();
  await p.waitForTimeout(200);
  check("name error cleared", await p.locator("#error-name").textContent(), "");
  check("email still rejected", (await p.locator("#error-email").textContent()).includes("email"));
  check("phone still rejected", (await p.locator("#error-phone").textContent()).includes("eight digits"));

  await p.fill("#f-email", "tabweaka@example.com");
  await p.fill("#f-phone", "(686) 7301 2345");
  const sent = p.waitForRequest((r) => r.url().includes("submit-request"));
  await p.locator("#request-submit").click();
  const body = JSON.parse((await sent).postData());
  check("phone normalised before sending", body.phone, "+68673012345");
  check("consent sent as false", body.marketing_consent, false);
  check("no price sent from the browser", body.quoted_price === undefined);

  await p.waitForTimeout(400);
  check("form replaced by the confirmation", await p.locator("#request-form").isHidden());
  check("heading is exact", await p.locator("#request-done h3").textContent(), "Request received");
  check("wording is exact",
    await p.locator("#request-done p").first().textContent(),
    "We will contact you by phone to confirm your rental.");
  check("never says confirmed/booked/reserved",
    await p.locator("#request-done").textContent().then((t) => !/\b(confirmed|booked|reserved|held)\b/i.test(t)));
  check("reference shown", (await p.locator(".request__ref").textContent()).includes("A3F91C24"));
  check("no page errors", p.errors, []);
  await p.ctx.close();
}

console.log(`\n--- offline fallback ---`);
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await stubSupabase(ctx);
  const p = await ctx.newPage();
  await p.goto(BASE, { waitUntil: "domcontentloaded" });
  await p.waitForSelector("#vehicle-list");
  // now make Supabase unreachable and reload: the saved list must still show
  await ctx.unroute(/__SUPABASE_URL__|supabase\.co/);
  await ctx.route(/__SUPABASE_URL__|supabase\.co/, (r) => r.abort());
  await p.evaluate(() => localStorage.setItem("tenana.vehicles.v1",
    JSON.stringify({ ...JSON.parse(localStorage.getItem("tenana.vehicles.v1")), at: 0 })));
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForSelector("#vehicle-list", { timeout: 8000 });
  check("still lists the cars", await p.locator(".vehicle").count(), 5);
  check("says the information is saved", await p.locator("#stale-notice").isVisible());
  await ctx.close();
}

console.log(`\n--- structured data ---`);
{
  const p = await page();
  const ld = JSON.parse(await p.locator('script[type="application/ld+json"]').textContent());
  check("type is AutoRental", ld["@type"], "AutoRental");
  check("both numbers listed", ld.telephone.length, 2);
  check("one offer per car", ld.makesOffer.length, 5);
  check("out car marked OutOfStock",
    ld.makesOffer.filter((o) => o.availability.endsWith("OutOfStock")).length, 1);
  check("no invented rating", ld.aggregateRating === undefined);
  await p.ctx.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
