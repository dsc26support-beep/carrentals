-- Vehicle photo storage.
--
-- The bucket is public to read: these are pictures of cars on a public website.
-- Writing is administrators only. Served from the Supabase origin, not the
-- site's, so even a hostile upload cannot reach the page's DOM or session.

insert into storage.buckets (id, name, public)
values ('vehicle-images', 'vehicle-images', true)
on conflict (id) do nothing;

create policy vehicle_images_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'vehicle-images');

create policy vehicle_images_admin_write on storage.objects
  for all to authenticated
  using      (bucket_id = 'vehicle-images' and public.is_admin())
  with check (bucket_id = 'vehicle-images' and public.is_admin());

-- File type and size are enforced above this layer: the admin checks extension
-- and magic bytes, and config.toml caps uploads at 8 MiB. SVG is rejected —
-- an SVG is a script container, and this bucket is world-readable.
