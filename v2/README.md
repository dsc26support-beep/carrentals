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
| `supabase/config.toml` | ✅ |
| `tests/db/` | ✅ 61 assertions, all passing |
| everything else | not built yet |

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
