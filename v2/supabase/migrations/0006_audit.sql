-- A record of what administrators changed.
--
-- summary holds what changed, never the customer's details. An audit trail must
-- not become a second, less-guarded copy of the data it exists to protect.

create table public.admin_audit_log (
  id         bigint generated always as identity primary key,
  actor      uuid references public.admin_users(user_id),
  action     text not null check (length(btrim(action)) between 1 and 80),
  entity     text not null check (length(btrim(entity)) between 1 and 80),
  entity_id  text,
  summary    jsonb,
  created_at timestamptz not null default now()
);

create index admin_audit_recent_idx on public.admin_audit_log (created_at desc);
create index admin_audit_entity_idx on public.admin_audit_log (entity, entity_id);
