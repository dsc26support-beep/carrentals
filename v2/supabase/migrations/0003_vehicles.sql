-- The one authoritative vehicle dataset.
-- Nothing else in this system defines what a vehicle is.

create table public.vehicles (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name             text not null check (length(btrim(name)) between 1 and 80),
  plate            text check (plate is null or length(btrim(plate)) <= 20),
  price_per_day    numeric(10,2) not null check (price_per_day >= 0),
  currency         char(3) not null default 'AUD' check (currency ~ '^[A-Z]{3}$'),

  -- Availability is a boolean, not a date calculation. There is no calendar.
  is_available     boolean not null default true,
  is_published     boolean not null default false,

  description      text check (description is null or length(description) <= 2000),

  -- Nullable on purpose. An unverified fact is stored as nothing, and the page
  -- omits the row, rather than printing a guess as though it were checked.
  seats            smallint check (seats is null or seats between 1 and 60),
  transmission     public.transmission_type,
  fuel             public.fuel_type,
  air_conditioning boolean,

  -- Free-text extras ("2016 model", "Hatchback boot"). Typed facts are columns.
  specifications   jsonb not null default '[]'::jsonb
                     check (jsonb_typeof(specifications) = 'array'),

  display_order    integer not null default 0,
  archived_at      timestamptz,                 -- archived, never deleted
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index vehicles_public_idx
  on public.vehicles (display_order, created_at)
  where is_published and archived_at is null;

create trigger vehicles_touch
  before update on public.vehicles
  for each row execute function public.touch_updated_at();

create table public.vehicle_images (
  id            uuid primary key default gen_random_uuid(),
  vehicle_id    uuid not null references public.vehicles(id) on delete cascade,
  storage_path  text not null,
  -- Required, not optional: a missing alt is an accessibility failure the
  -- database can simply prevent.
  alt           text not null check (length(btrim(alt)) between 1 and 200),
  caption       text,
  display_order integer not null default 0,
  is_primary    boolean not null default false,
  width         integer check (width  is null or width  > 0),
  height        integer check (height is null or height > 0),
  created_at    timestamptz not null default now()
);

create unique index vehicle_images_one_primary
  on public.vehicle_images (vehicle_id) where is_primary;

create index vehicle_images_order_idx
  on public.vehicle_images (vehicle_id, display_order);
