-- Every row-level security policy in the system, in one file.
--
-- Kept together deliberately: access control you have to assemble from eight
-- files is access control nobody audits. Read this file to know who can see
-- and change what.
--
-- The rule underneath all of it: deny by default. A table with no policy for a
-- role is closed to that role. Most of the protection here is in the policies
-- that are absent.

alter table public.vehicles              enable row level security;
alter table public.vehicle_images        enable row level security;
alter table public.customers             enable row level security;
alter table public.rental_requests       enable row level security;
alter table public.marketing_subscribers enable row level security;
alter table public.email_campaigns       enable row level security;
alter table public.admin_users           enable row level security;
alter table public.site_settings         enable row level security;
alter table public.admin_audit_log       enable row level security;

-- ---------------------------------------------------------------------------
-- Public reads. The only three things an anonymous visitor may see.
-- ---------------------------------------------------------------------------

create policy vehicles_public_read on public.vehicles
  for select to anon, authenticated
  using (is_published and archived_at is null);

create policy vehicle_images_public_read on public.vehicle_images
  for select to anon, authenticated
  using (exists (
    select 1 from public.vehicles v
    where v.id = vehicle_id and v.is_published and v.archived_at is null
  ));

create policy site_settings_public_read on public.site_settings
  for select to anon, authenticated
  using (is_public);

-- ---------------------------------------------------------------------------
-- Administrators. Full control of the operational tables.
-- ---------------------------------------------------------------------------

create policy vehicles_admin on public.vehicles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy vehicle_images_admin on public.vehicle_images
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy customers_admin on public.customers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy rental_requests_admin on public.rental_requests
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy marketing_subscribers_admin on public.marketing_subscribers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy email_campaigns_admin on public.email_campaigns
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy site_settings_admin on public.site_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Read-only for administrators. Note what is missing.
-- ---------------------------------------------------------------------------

-- The audit log is append-only from the server. An administrator can read the
-- record of their own actions but cannot edit or erase it.
create policy admin_audit_read on public.admin_audit_log
  for select to authenticated using (public.is_admin());

-- admin_users has SELECT and nothing else. There is deliberately no INSERT,
-- UPDATE or DELETE policy, for any role, so no browser session can promote an
-- account — including its own. Administrators are created server-side with the
-- service role. Privilege escalation is not defended against here; it is absent.
create policy admin_users_read on public.admin_users
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Tables with no anon policy at all, and therefore closed to the public key:
--   customers, rental_requests, marketing_subscribers,
--   email_campaigns, admin_users, admin_audit_log
-- The submit-request and send-campaign Edge Functions reach them with the
-- service role, which bypasses RLS by design and never leaves the server.
-- ---------------------------------------------------------------------------
