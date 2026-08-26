-- Table grants. Supabase applies these to new tables automatically; locally we
-- do it ourselves. Grants are the outer gate, RLS the inner one — a role needs
-- to pass both, which is why the RLS tests below are meaningful.

grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
grant select, insert, update, delete on storage.objects to anon, authenticated;
grant all on storage.buckets to service_role, authenticated;
