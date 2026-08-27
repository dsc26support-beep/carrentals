-- What the request handler needs at runtime.
--
-- Additive only. Migrations 0001–0008 are already applied to the live project,
-- and an applied migration is not editable — so this file adds rather than
-- amends, and carries its own policies.
--
-- That last part breaks the rule 0007 set for itself: every policy in one
-- auditable file. The rule yields here to the harder one. If you are auditing
-- access control, 0007 is still the place to start and this file is the only
-- other place to look.

-- ---------------------------------------------------------------------------
-- Rate limiting
-- ---------------------------------------------------------------------------
-- Edge Functions are stateless and run in more than one instance, so a counter
-- in memory would reset under exactly the load it exists to survive. It has to
-- live in the database.
--
-- key_hash is a salted SHA-256 of the caller's IP, computed in the function
-- with a secret salt. The IP itself is never written down. Without the salt the
-- hashes cannot be walked back to addresses, and a table of visitors is not a
-- thing this business needs to own.

create table public.request_throttle (
  key_hash     text primary key check (key_hash ~ '^[a-f0-9]{64}$'),
  window_start timestamptz not null default now(),
  count        integer not null default 0 check (count >= 0),
  updated_at   timestamptz not null default now()
);

create index request_throttle_sweep_idx on public.request_throttle (window_start);

create trigger request_throttle_touch
  before update on public.request_throttle
  for each row execute function public.touch_updated_at();

comment on table public.request_throttle is
  'Salted IP hashes and counts. Rows older than a day are swept; see prune_request_throttle().';

-- Old rows are noise, and noise you keep is noise you have to explain. The
-- handler calls this occasionally rather than running a scheduled job for it.
create or replace function public.prune_request_throttle()
  returns void
  language sql
  security definer
  set search_path = public, pg_temp
as $$
  delete from public.request_throttle where window_start < now() - interval '1 day';
$$;

-- Revoke from everyone, then grant back to the one caller that needs it. The
-- handler swallows failures here, so a missing grant would not have shown up as
-- a broken request — it would have shown up as a table that quietly grew for
-- months.
revoke all on function public.prune_request_throttle() from public, anon, authenticated;
grant execute on function public.prune_request_throttle() to service_role;

alter table public.request_throttle enable row level security;

-- No policy for anon, and none for administrators either. Nobody needs to read
-- this but the function that writes it, and the service role bypasses RLS.
-- The absence below is the access control.

-- ---------------------------------------------------------------------------
-- "The car was out when they asked"
-- ---------------------------------------------------------------------------
-- A customer browsing while a car is out with somebody else still gets their
-- request through — with five cars, a phone call sorts out the rest. The flag
-- is so the owner knows to have that conversation before calling back.

alter table public.rental_requests
  add column vehicle_was_unavailable boolean not null default false;

comment on column public.rental_requests.vehicle_was_unavailable is
  'The vehicle was marked unavailable when the request arrived. Accepted anyway; call the customer.';

-- ---------------------------------------------------------------------------
-- Where the notification goes
-- ---------------------------------------------------------------------------
-- Private, so the address is not published to every visitor the way
-- business.email deliberately is. Editable from the Settings screen, so
-- changing it never means redeploying a function.

insert into public.site_settings (key, value, description, is_public) values
  ('notify.request_email',
   coalesce((select value from public.site_settings where key = 'business.email'),
            '"ruuka4climatechange@gmail.com"'::jsonb),
   'Where a new booking request is emailed. Not shown on the website.', false)
on conflict (key) do nothing;
