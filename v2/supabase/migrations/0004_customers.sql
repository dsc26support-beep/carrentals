-- Customer records and rental requests.
--
-- Everything in this file is private. No anon policy is written for either
-- table in 0007, so they are unreachable with the public key. This is the
-- direct answer to V1, which published customer names in bookings.json.

create table public.customers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) between 1 and 120),

  -- Same expression the browser and the Edge Function use. Three layers, and
  -- this is the one a compromised client cannot talk its way past.
  email      citext not null unique
               check (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),

  -- Normalized to +686 and exactly eight digits before it ever arrives here.
  phone      text not null check (phone ~ '^\+686[0-9]{8}$'),

  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger customers_touch
  before update on public.customers
  for each row execute function public.touch_updated_at();

create table public.rental_requests (
  id           uuid primary key default gen_random_uuid(),
  reference    text not null unique default upper(encode(gen_random_bytes(4), 'hex')),

  -- restrict, not cascade: deleting a customer must not silently erase the
  -- record of what they asked for.
  customer_id  uuid not null references public.customers(id) on delete restrict,
  vehicle_id   uuid references public.vehicles(id) on delete set null,

  -- Snapshots. Renaming or repricing a vehicle cannot rewrite history, and the
  -- Edge Function reads both from the database rather than trusting the body.
  vehicle_name text not null check (length(btrim(vehicle_name)) between 1 and 80),
  quoted_price numeric(10,2) not null check (quoted_price >= 0),
  currency     char(3) not null default 'AUD' check (currency ~ '^[A-Z]{3}$'),

  status       public.request_status not null default 'pending',
  message      text check (message is null or length(message) <= 1000),
  source       text not null default 'website',

  handled_by   uuid references public.admin_users(user_id),
  handled_at   timestamptz,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint handled_together check ((handled_by is null) = (handled_at is null))
);

create index rental_requests_pipeline_idx
  on public.rental_requests (status, created_at desc);

create index rental_requests_customer_idx
  on public.rental_requests (customer_id);

create trigger rental_requests_touch
  before update on public.rental_requests
  for each row execute function public.touch_updated_at();
