-- Extensions, shared helpers and enums.
-- Everything later in this sequence depends on this file.

create extension if not exists pgcrypto;   -- gen_random_uuid, gen_random_bytes
create extension if not exists citext;     -- case-insensitive email

-- Request lifecycle. A request is never anything but 'pending' until a person
-- moves it: the website has no path to any other value.
create type public.request_status as enum
  ('pending', 'contacted', 'confirmed', 'declined', 'cancelled');

create type public.transmission_type as enum ('automatic', 'manual');
create type public.fuel_type         as enum ('petrol', 'diesel', 'hybrid', 'electric');
create type public.campaign_status   as enum ('draft', 'scheduled', 'sending', 'sent', 'failed');

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
