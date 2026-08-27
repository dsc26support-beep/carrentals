import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8741/public/admin/index.html";
const EXE = process.env.CHROME_PATH || undefined;
let pass = 0, fail = 0;
const check = (label, got, want = true) => {
  const okay = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${okay ? "PASS" : "FAIL"}  ${label}${okay ? "" : `  (got ${JSON.stringify(got)})`}`);
  okay ? pass++ : fail++;
};

const ADMIN = { user_id: "admin-1", email: "owner@example.com", role: "owner", is_active: true };
const VEHICLES = [
  { id: "v1", slug: "nissan-march", name: "Nissan March", plate: "KLTA 6113", price_per_day: "60.00",
    currency: "AUD", is_available: true, is_published: true, seats: 5, specifications: [],
    display_order: 10, vehicle_images: [{ id: "i1" }, { id: "i2" }] },
  { id: "v2", slug: "honda-fit", name: "Honda Fit", plate: "KLTA 6991", price_per_day: "60.00",
    currency: "AUD", is_available: false, is_published: true, seats: 5, specifications: [],
    display_order: 20, vehicle_images: [] }
];
const REQUESTS = [
  { id: "r1", reference: "A3F91C24", status: "pending", vehicle_name: "Nissan March",
    quoted_price: "60.00", currency: "AUD", message: "Arriving Friday",
    created_at: new Date(Date.now() - 7200000).toISOString(),
    customers: { id: "c1", name: "Tabweaka", email: "t@example.com", phone: "+68673012345" },
    vehicle_was_unavailable: false },
  { id: "r2", reference: "B7D40E11", status: "pending", vehicle_name: "Honda Fit",
    quoted_price: "60.00", currency: "AUD", message: null,
    created_at: new Date(Date.now() - 600000).toISOString(),
    customers: { id: "c2", name: "Ioane", email: "i@example.com", phone: "+68673098765" },
    // asked for a car that was out with somebody else
    vehicle_was_unavailable: true }
];

async function open({ admin = ADMIN, badLogin = false } = {}) {
  const browser = await chromium.launch(EXE ? { executablePath: EXE } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const state = { patches: [], audits: [] };

  await ctx.route(/supabase\.co/, async (route) => {
    const req = route.request();
    const url = req.url();
    const json = (body, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (url.includes("/auth/v1/token")) {
      if (badLogin) { return json({ error: "invalid_grant", error_description: "Invalid login credentials" }, 400); }
      return json({ access_token: "jwt.test.token", refresh_token: "r", expires_in: 3600,
                    user: { email: "owner@example.com" } });
    }
    if (url.includes("/auth/v1/logout")) { return json({}, 204); }

    if (url.includes("admin_users")) { return json(admin ? [admin] : []); }
    if (url.includes("admin_audit_log")) { state.audits.push(JSON.parse(req.postData())); return json([], 201); }

    if (url.includes("vehicles")) {
      if (req.method() === "PATCH") {
        const patch = JSON.parse(req.postData());
        state.patches.push({ url, patch });
        return json([{ ...VEHICLES[0], ...patch }]);
      }
      return json(VEHICLES);
    }
    if (url.includes("rental_requests")) {
      if (req.method() === "PATCH") {
        state.patches.push({ url, patch: JSON.parse(req.postData()) });
        return json([{ ...REQUESTS[0], status: "contacted" }]);
      }
      if (url.includes("status=eq.pending")) { return json(REQUESTS); }
      if (/status=eq\.(contacted|confirmed|declined|cancelled)/.test(url)) { return json([]); }
      return json(REQUESTS);
    }
    if (url.includes("site_settings")) {
      return json([{ key: "business.phone_primary", value: "+68673053005",
                     description: "Main number.", is_public: true }]);
    }
    return json([]);
  });

  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(String(e.message)));
  page.on("console", (m) => { if (m.type() === "error") page.errors.push("console: " + m.text()); });
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  page.state = state;
  page.shut = () => browser.close();
  return page;
}

console.log("\n--- sign in ---");
{
  const p = await open();
  await p.waitForSelector("#signin:not([hidden])");
  check("sign-in shown first", await p.locator("#signin").isVisible());
  check("office hidden until signed in", await p.locator("#shell").isHidden());

  await p.fill("#s-email", "owner@example.com");
  await p.fill("#s-password", "correct-horse");
  await p.click("#signin-submit");
  await p.waitForSelector("#shell:not([hidden])", { timeout: 8000 });
  check("office opens after sign in", await p.locator("#shell").isVisible());
  check("six sections", await p.locator("#nav a").count(), 6);
  check("who is signed in shown", await p.locator("#who").textContent(), "owner@example.com");
  check("no errors", p.errors, []);
  await p.shut();
}

console.log("\n--- wrong password ---");
{
  const p = await open({ badLogin: true });
  await p.waitForSelector("#signin:not([hidden])");
  await p.fill("#s-email", "owner@example.com");
  await p.fill("#s-password", "wrong");
  await p.click("#signin-submit");
  await p.waitForTimeout(600);
  const msg = await p.locator("#signin-error").textContent();
  check("refused", await p.locator("#shell").isHidden());
  check("says so without hinting which half was wrong", msg, "That email and password do not match.");
  await p.shut();
}

console.log("\n--- signed in but not an administrator ---");
{
  const p = await open({ admin: null });
  await p.waitForSelector("#signin:not([hidden])");
  await p.fill("#s-email", "nobody@example.com");
  await p.fill("#s-password", "correct-horse");
  await p.click("#signin-submit");
  await p.waitForTimeout(800);
  check("office stays shut", await p.locator("#shell").isHidden());
  check("told plainly", await p.locator("#signin-error").textContent(), "That account is not an administrator.");
  await p.shut();
}

console.log("\n--- dashboard ---");
{
  const p = await open();
  await p.fill("#s-email", "owner@example.com"); await p.fill("#s-password", "x");
  await p.click("#signin-submit");
  await p.waitForSelector(".tiles", { timeout: 8000 });
  const tiles = await p.locator(".tile dd").allTextContents();
  check("four numbers", tiles.length, 4);
  check("both requests waiting", tiles[0], "2");
  check("one car available", tiles[1], "1");
  check("one car out", tiles[2], "1");
  check("no errors", p.errors, []);
  await p.shut();
}

console.log("\n--- vehicles: the availability toggle ---");
{
  const p = await open();
  await p.fill("#s-email", "o@e.com"); await p.fill("#s-password", "x");
  await p.click("#signin-submit");
  await p.waitForSelector("#shell:not([hidden])");
  await p.click('#nav a[href="#vehicles"]');
  await p.waitForSelector(".toggle", { timeout: 8000 });

  check("a switch per car", await p.locator(".toggle").count(), 2);
  check("March reads Available", await p.locator(".toggle__label").first().textContent(), "Available");
  check("Fit reads Out", await p.locator(".toggle__label").nth(1).textContent(), "Out");

  // Click the label, as a person does — the checkbox itself is visually hidden
  // behind the switch graphic, which is the standard pattern.
  await p.locator(".toggle").first().click();
  await p.waitForTimeout(500);
  check("saved immediately", p.state.patches.length, 1);
  check("sent is_available false", p.state.patches[0].patch, { is_available: false });
  check("label flipped", await p.locator(".toggle__label").first().textContent(), "Out");
  check("confirmed to the user", (await p.locator(".msg--ok").textContent()).includes("now out"));
  check("change was audited", p.state.audits.length, 1);
  check("audit carries no customer data",
    JSON.stringify(p.state.audits[0]).includes("phone"), false);
  check("no errors", p.errors, []);
  await p.shut();
}

console.log("\n--- requests ---");
{
  const p = await open();
  await p.fill("#s-email", "o@e.com"); await p.fill("#s-password", "x");
  await p.click("#signin-submit");
  await p.waitForSelector("#shell:not([hidden])");
  await p.click('#nav a[href="#requests"]');
  await p.waitForSelector(".pills", { timeout: 8000 });

  check("five statuses", await p.locator(".pill").count(), 5);
  check("pending selected first", await p.locator('.pill[aria-pressed="true"]').textContent(), "pending");
  check("the request shows", await p.locator(".row__name").first().textContent(), "Tabweaka");
  check("calling is the primary action",
    (await p.locator(".contact-actions .btn--solid").first().textContent()).includes("Call"));
  check("call link is a real tel:",
    await p.locator(".contact-actions a").first().getAttribute("href"), "tel:+68673012345");

  await p.locator('button:has-text("Mark contacted")').first().click();
  await p.waitForTimeout(600);
  check("status change sent", p.state.patches.some((x) => x.patch.status === "contacted"));
  check("handler and time set together",
    Object.keys(p.state.patches.find((x) => x.patch.status).patch).sort(),
    ["handled_at", "handled_by", "status"]);
  check("no errors", p.errors, []);
  await p.shut();
}

console.log("\n--- a request for a car that was out ---");
{
  const p = await open();
  await p.fill("#s-email", "o@e.com"); await p.fill("#s-password", "x");
  await p.click("#signin-submit");
  await p.waitForSelector("#shell:not([hidden])");
  await p.click('#nav a[href="#requests"]');
  await p.waitForSelector(".pills", { timeout: 8000 });

  check("both requests show", await p.locator(".row").count(), 2);

  // The flag belongs to the second request and must not bleed onto the first.
  check("exactly one is flagged", await p.locator(".row__flag").count(), 1);
  check("flagged row is the right one",
    await p.locator(".row", { has: p.locator(".row__flag") }).locator(".row__name").textContent(),
    "Ioane");
  check("the flag says the car was out",
    (await p.locator(".row__flag").textContent()).includes("was out when they asked"));

  // It is a caution, not a refusal: the request is still workable.
  check("still actionable", await p.locator(".row", { has: p.locator(".row__flag") })
    .locator('button:has-text("Mark contacted")').count(), 1);
  check("no errors", p.errors, []);
  await p.shut();
}

console.log("\n--- customers and marketing ---");
{
  const p = await open();
  await p.fill("#s-email", "o@e.com"); await p.fill("#s-password", "x");
  await p.click("#signin-submit");
  await p.waitForSelector("#shell:not([hidden])");

  await p.click('#nav a[href="#customers"]');
  await p.waitForSelector('input[type="search"]', { timeout: 8000 });
  check("the customer is listed", await p.locator(".row__name").first().textContent(), "Tabweaka");
  check("no export button anywhere",
    await p.locator("button, a").filter({ hasText: /export|download|csv/i }).count(), 0);
  await p.fill('input[type="search"]', "zzz");
  await p.waitForTimeout(200);
  check("search that matches nobody says so",
    (await p.locator(".empty strong").textContent()), "Nobody matches");

  await p.click('#nav a[href="#marketing"]');
  await p.waitForTimeout(500);
  check("marketing is honest about not being set up",
    (await p.locator(".msg--info").textContent()).includes("not set up yet"));
  check("no errors", p.errors, []);
  await p.shut();
}

console.log("\n--- sign out ---");
{
  const p = await open();
  await p.fill("#s-email", "o@e.com"); await p.fill("#s-password", "x");
  await p.click("#signin-submit");
  await p.waitForSelector("#shell:not([hidden])");
  await p.click("#signout");
  await p.waitForTimeout(500);
  check("back to sign in", await p.locator("#signin").isVisible());
  check("session cleared",
    await p.evaluate(() => localStorage.getItem("tenana.session.v1")), null);
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForTimeout(500);
  check("stays signed out after reload", await p.locator("#shell").isHidden());
  await p.shut();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
