-- Administrators and site configuration.
--
-- This file comes before the data tables because every RLS policy in 0007
-- calls is_admin(), which reads admin_users.

create table public.admin_users (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  email        citext not null,
  display_name text,
  role         text not null default 'admin' check (role in ('admin', 'owner')),
  is_active    boolean not null default true,   -- the kill switch: flip to lock someone out
  last_seen_at timestamptz,
  created_at   timestamptz not null default now()
);

comment on table public.admin_users is
  'Administrators. No password column: Supabase Auth owns credentials. '
  'This table has no INSERT or UPDATE policy, so an administrator cannot be '
  'created from any browser session — only server-side with the service role.';

-- security definer so the policies can read admin_users while the caller cannot.
-- search_path is pinned: an unpinned search_path on a definer function is a
-- privilege-escalation vector.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid() and is_active
  );
$$;

create table public.site_settings (
  key         text primary key check (key ~ '^[a-z0-9_.]+$'),
  value       jsonb not null,
  description text,
  is_public   boolean not null default false,   -- only these reach the customer page
  updated_by  uuid references public.admin_users(user_id),
  updated_at  timestamptz not null default now()
);

create trigger site_settings_touch
  before update on public.site_settings
  for each row execute function public.touch_updated_at();
