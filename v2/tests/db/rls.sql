\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

create or replace function pg_temp.check(label text, got boolean, want boolean default true)
returns void language plpgsql as $$
begin
  raise notice '%  %', case when got is not distinct from want then 'PASS' else 'FAIL' end, label;
end $$;

create or replace function pg_temp.rejects(sql text)
returns boolean language plpgsql as $$
begin execute sql; return false;
exception when others then return true; end $$;

-- Rows a statement actually changed. 0 means a policy filtered everything
-- (the denial signature for UPDATE/DELETE); -1 means the statement raised
-- (the denial signature for INSERT, and for a table with no policy at all).
create or replace function pg_temp.affected(sql text)
returns bigint language plpgsql as $$
declare n bigint;
begin execute sql; get diagnostics n = row_count; return n;
exception when others then return -1; end $$;

create or replace function pg_temp.rows(sql text)
returns bigint language plpgsql as $$
declare n bigint;
begin execute 'select count(*) from (' || sql || ') t' into n; return n;
exception when others then return -1; end $$;

-- Fixtures: one administrator, one ordinary signed-in user, one hidden vehicle.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'owner@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'nobody@example.com');
insert into public.admin_users (user_id, email, role)
  values ('11111111-1111-1111-1111-111111111111', 'owner@example.com', 'owner');
update public.vehicles set is_published = false where slug = 'toyota-vitz-6247';

\echo ''
\echo '--- anon: the public key ---'
set role anon;
select pg_temp.check('sees 4 published vehicles',   pg_temp.rows('select 1 from vehicles') = 4);
select pg_temp.check('cannot see the unpublished',  pg_temp.rows($$select 1 from vehicles where slug='toyota-vitz-6247'$$) = 0);
select pg_temp.check('customers invisible',         pg_temp.rows('select 1 from customers') = 0);
select pg_temp.check('rental_requests invisible',   pg_temp.rows('select 1 from rental_requests') = 0);
select pg_temp.check('subscribers invisible',       pg_temp.rows('select 1 from marketing_subscribers') = 0);
select pg_temp.check('campaigns invisible',         pg_temp.rows('select 1 from email_campaigns') = 0);
select pg_temp.check('admin_users invisible',       pg_temp.rows('select 1 from admin_users') = 0);
select pg_temp.check('audit log invisible',         pg_temp.rows('select 1 from admin_audit_log') = 0);
select pg_temp.check('sees only public settings',   pg_temp.rows('select 1 from site_settings') = 8);
select pg_temp.check('cannot insert a customer',    pg_temp.rejects($$insert into customers(name,email,phone) values('X','x@y.co','+68673011111')$$));
select pg_temp.check('cannot insert a request',     pg_temp.rejects($$insert into rental_requests(customer_id,vehicle_name,quoted_price) values(gen_random_uuid(),'X',60)$$));
-- -1, not 0: anon holds no UPDATE or DELETE grant on any table, so it is
-- refused at the grant layer before RLS is consulted at all. Two layers, and
-- the outer one stops it first.
select pg_temp.check('cannot change a vehicle',     pg_temp.affected($$update vehicles set price_per_day=1$$) = -1);
select pg_temp.check('cannot delete a vehicle',     pg_temp.affected($$delete from vehicles$$) = -1);
select pg_temp.check('vehicles unchanged',          (select bool_and(price_per_day = 60) from vehicles));
reset role;
reset request.jwt.claim.sub;

\echo ''
\echo '--- signed in, but not an administrator ---'
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
set role authenticated;
select pg_temp.check('claim is actually set',       auth.uid() = '22222222-2222-2222-2222-222222222222');
select pg_temp.check('is_admin() false',            public.is_admin() = false);
select pg_temp.check('customers still invisible',   pg_temp.rows('select 1 from customers') = 0);
select pg_temp.check('requests still invisible',    pg_temp.rows('select 1 from rental_requests') = 0);
select pg_temp.check('admin_users invisible',       pg_temp.rows('select 1 from admin_users') = 0);
-- 0, not -1: an authenticated user does hold the grant, so this reaches RLS
-- and the policy filters every row away.
select pg_temp.check('cannot change a vehicle',     pg_temp.affected($$update vehicles set price_per_day=1$$) = 0);
select pg_temp.check('cannot promote itself',       pg_temp.rejects($$insert into admin_users(user_id,email) values('22222222-2222-2222-2222-222222222222','nobody@example.com')$$));
reset role;
reset request.jwt.claim.sub;

\echo ''
\echo '--- administrator ---'
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
set role authenticated;
select pg_temp.check('claim is actually set',       auth.uid() = '11111111-1111-1111-1111-111111111111');
select pg_temp.check('is_admin() true',             public.is_admin());
select pg_temp.check('sees all 5 vehicles',         pg_temp.rows('select 1 from vehicles') = 5);
select pg_temp.check('sees customers',              pg_temp.rows('select 1 from customers') >= 1);
select pg_temp.check('sees requests',               pg_temp.rows('select 1 from rental_requests') >= 1);
select pg_temp.check('sees all settings',           pg_temp.rows('select 1 from site_settings') = 8);
select pg_temp.check('can change availability',     pg_temp.affected($$update vehicles set is_available=false where slug='honda-fit'$$) = 1);
select pg_temp.check('can advance a request',       pg_temp.affected($$update rental_requests set status='contacted'$$) >= 1);
select pg_temp.check('CANNOT create an admin',      pg_temp.rejects($$insert into admin_users(user_id,email) values('22222222-2222-2222-2222-222222222222','nobody@example.com')$$));
select pg_temp.check('CANNOT edit the audit log',   pg_temp.rejects($$insert into admin_audit_log(action,entity) values('x','y')$$));
select pg_temp.check('CANNOT erase the audit log',  pg_temp.affected($$delete from admin_audit_log$$) = 0);
reset role;
reset request.jwt.claim.sub;

\echo ''
\echo '--- service role, as the Edge Functions run ---'
set role service_role;
select pg_temp.check('can insert a customer',       not pg_temp.rejects($$insert into customers(name,email,phone) values('Edge','edge@example.com','+68673022222')$$));
select pg_temp.check('can write the audit log',     not pg_temp.rejects($$insert into admin_audit_log(action,entity) values('vehicle.update','vehicles')$$));
select pg_temp.check('can create an administrator', not pg_temp.rejects($$insert into admin_users(user_id,email) values('22222222-2222-2222-2222-222222222222','nobody@example.com')$$));
reset role;
reset request.jwt.claim.sub;
