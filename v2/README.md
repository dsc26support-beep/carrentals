# Tenana Rentals V2

A clean rebuild. **V1 is untouched** — it still lives at the repository root and
still serves customers at
https://dsc26support-beep.github.io/carrentals/ until cutover.

Rentals are confirmed **by phone only**. The website never confirms a booking.

## Built so far

| Path | Status |
|---|---|
| `supabase/migrations/` | ✅ eight migrations, applied and tested |
| `supabase/seed.sql` | ✅ five vehicles, business settings, **no customer data** |
| `shared/validate.js` | ✅ one validator, used by browser and server |
| `public/` + `src/` | ✅ customer page |
| `public/fonts/` | ✅ Barlow, self-hosted, Latin subset |
| `tests/` | ✅ 15 unit + 61 database + 72 browser assertions |
| `supabase/functions/` | ⬜ Edge Functions — not built |
| `src/js/admin/` | ⬜ back office — not built |
| `scripts/` | ⬜ build, image pipeline, guards — not built |

Because there is no bundler yet, the page loads native ES modules and
`public/index.html` refers to `../src/`. The build step will collapse that into
hashed bundles in `dist/`.

## Running the tests

```sh
npm run check               # 6 guards (see below)
npm test                    # 46 unit assertions: the validator, the guards, the bundler
npm run test:db             # 80 database assertions (see below)
npm run test:e2e            # 74 browser assertions against the customer page
npm run test:e2e:admin      # 47 browser assertions against the back office
npm run test:all            # guards + unit + both browser suites

npm run bundle              # regenerate the pasteable Edge Function files
```

`.github/workflows/v2-ci.yml` runs all of these on every push that touches
`v2/`. It is scoped by path so it never runs against V1.

### The six guards

`npm run check` fails the build on any of these, because a rule enforced by the
build survives and a rule kept in someone's head does not:

| # | Rule |
|---|---|
| 1 | No privileged key is committed anywhere — the browser code and the Edge Functions alike — in **either** Supabase key format: legacy JWTs are decoded and their role checked; the newer opaque `sb_secret_…` keys are matched by prefix, since they are not JWTs and no amount of decoding will see them |
| 2 | No date, calendar or booking-dates identifier creeps back into customer-facing code |
| 3 | No customer-facing string claims a rental is confirmed, booked or reserved |
| 4 | The marketing consent box is never pre-ticked |
| 5 | No `<img>` without alt text |
| 6 | Each Edge Function's committed `bundle.ts` still matches the source it was generated from |

`tests/check.test.mjs` runs the guards against fixture trees and asserts each
one both **fires on a violation** and **stays quiet on the legitimate near-miss**
it must not confuse with one — the publishable key beside the secret key, honest
wording beside a false confirmation. A guard verified once by hand is a guard
that quietly stops working later.

The browser tests stub Supabase with `tests/e2e/fixture.mjs`, so the page
exercises its real network path rather than a pretend mode. Serve the directory
first: `python3 -m http.server 8741` from `v2/`.

## Running the database tests

No Supabase account needed. The tests run the real migrations against a local
PostgreSQL 16 and check that the constraints bite and the policies grant and
deny what they should.

```sh
initdb -D /tmp/tenana-pg -U postgres --auth=trust
pg_ctl -D /tmp/tenana-pg -o '-p 5433 -k /tmp' start
./tests/db/run.sh
```

`tests/db/shim.sql` recreates just enough of Supabase's `auth` and `storage`
schemas and its `anon` / `authenticated` / `service_role` roles for the real
migrations to apply unmodified. It is a test fixture and is never deployed.

**What the tests prove:** the SQL is valid, the constraints reject bad data, and
the policies grant and deny correctly for all four roles.
**What they do not prove:** Supabase's own Auth and Storage services. Those are
verified against a real project.

## The schema in one paragraph

Nine tables. `vehicles` and `vehicle_images` are the only definition of a
vehicle and are the only things an anonymous visitor can read, and only when
published. `customers`, `rental_requests`, `marketing_subscribers`,
`email_campaigns`, `admin_users` and `admin_audit_log` have no anonymous policy
at all, so they are unreachable with the public key — the Edge Functions reach
them with the service role, which never leaves the server. `site_settings` is
readable only where `is_public`.

`admin_users` has a SELECT policy and nothing else. No browser session can
create an administrator, including its own. That is deliberate.

## Vehicle facts

Five cars, all $60 a day, all automatic — confirmed by the owner. The sixth car
is **not seeded**: its make, model and year are still unknown, and V1 shipped a
card reading "Sixth car" with no photograph for weeks. Colour and year live in
`specifications` as free text; whether KLTA 6247 is the gray 2017 has never been
confirmed.

## Environment variables

See `.env.example`. Names only — no value belongs in this repository.
