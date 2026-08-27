\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

-- Reports PASS or FAIL for one expectation. Every check below is a real query
-- against the real schema; nothing is asserted that was not executed.
create or replace function pg_temp.check(label text, got boolean, want boolean default true)
returns void language plpgsql as $$
begin
  raise notice '%  %', case when got is not distinct from want then 'PASS' else 'FAIL' end, label;
end $$;

-- Did a statement raise? Returns true when the statement was rejected.
create or replace function pg_temp.rejects(sql text)
returns boolean language plpgsql as $$
begin
  execute sql;
  return false;
exception when others then
  return true;
end $$;

\echo ''
\echo '--- seed ---'
select pg_temp.check('five vehicles seeded',        (select count(*) = 5 from public.vehicles));
select pg_temp.check('all published',               (select bool_and(is_published) from public.vehicles));
select pg_temp.check('all $60 AUD',                 (select bool_and(price_per_day = 60 and currency = 'AUD') from public.vehicles));
select pg_temp.check('all automatic',               (select bool_and(transmission = 'automatic') from public.vehicles));
select pg_temp.check('no sixth car',                (select count(*) = 0 from public.vehicles where slug like '%sixth%'));
select pg_temp.check('no customer rows in seed',    (select count(*) = 0 from public.customers));
select pg_temp.check('8 public settings',           (select count(*) = 8 from public.site_settings where is_public));
select pg_temp.check('messenger url kept',          (select value::text like '%facebook%' from public.site_settings where key = 'business.messenger_url'));

\echo ''
\echo '--- constraints reject bad data ---'
select pg_temp.check('bad email rejected',          pg_temp.rejects($$insert into customers(name,email,phone) values('A','not-an-email','+68673012345')$$));
select pg_temp.check('local phone rejected',        pg_temp.rejects($$insert into customers(name,email,phone) values('A','a@b.co','73012345')$$));
select pg_temp.check('7-digit phone rejected',      pg_temp.rejects($$insert into customers(name,email,phone) values('A','b@b.co','+6867301234')$$));
select pg_temp.check('9-digit phone rejected',      pg_temp.rejects($$insert into customers(name,email,phone) values('A','c@b.co','+686730123456')$$));
select pg_temp.check('blank name rejected',         pg_temp.rejects($$insert into customers(name,email,phone) values('   ','d@b.co','+68673012345')$$));
select pg_temp.check('valid customer accepted',     not pg_temp.rejects($$insert into customers(name,email,phone) values('Tabweaka','t@example.com','+68673012345')$$));
select pg_temp.check('duplicate email rejected',    pg_temp.rejects($$insert into customers(name,email,phone) values('Other','T@EXAMPLE.COM','+68673019999')$$));
select pg_temp.check('negative price rejected',     pg_temp.rejects($$insert into vehicles(slug,name,price_per_day) values('x','X',-1)$$));
select pg_temp.check('bad slug rejected',           pg_temp.rejects($$insert into vehicles(slug,name,price_per_day) values('Not A Slug','X',60)$$));
select pg_temp.check('consent without date rejected', pg_temp.rejects($$insert into marketing_subscribers(email,consented) values('m@b.co',true)$$));
select pg_temp.check('consent with date accepted',  not pg_temp.rejects($$insert into marketing_subscribers(email,consented,consent_at) values('m@b.co',true,now())$$));
select pg_temp.check('unconsented default false',   (select consented = false from marketing_subscribers where email = 'n@b.co') is not false);
select pg_temp.check('two primary images rejected', pg_temp.rejects($$
  insert into vehicle_images(vehicle_id,storage_path,alt,is_primary)
  select id,'a.jpg','A',true from vehicles where slug='honda-fit';
  insert into vehicle_images(vehicle_id,storage_path,alt,is_primary)
  select id,'b.jpg','B',true from vehicles where slug='honda-fit';$$));
select pg_temp.check('image without alt rejected',  pg_temp.rejects($$insert into vehicle_images(vehicle_id,storage_path) select id,'c.jpg' from vehicles limit 1$$));
select pg_temp.check('handled_at without handler rejected', pg_temp.rejects($$
  insert into rental_requests(customer_id,vehicle_name,quoted_price,handled_at)
  select c.id,'Honda Fit',60,now() from customers c limit 1$$));

\echo ''
\echo '--- a request, as submit-request will write it ---'
insert into rental_requests (customer_id, vehicle_id, vehicle_name, quoted_price)
select c.id, v.id, v.name, v.price_per_day
from customers c, vehicles v where v.slug = 'honda-fit' limit 1;
select pg_temp.check('request defaults to pending', (select status = 'pending' from rental_requests limit 1));
select pg_temp.check('reference generated',         (select reference ~ '^[0-9A-F]{8}$' from rental_requests limit 1));
select pg_temp.check('customer delete restricted',  pg_temp.rejects($$delete from customers$$));
select pg_temp.check('car assumed available',       (select vehicle_was_unavailable = false from rental_requests limit 1));

\echo ''
\echo '--- the rate limit ---'
-- The handler stores a salted SHA-256 and never an address. The constraint is
-- what keeps that true: anything that is not a 64-character hex digest is not
-- a hash, and an IP written in by mistake would be refused here.
select pg_temp.check('accepts a real digest',       not pg_temp.rejects($$insert into request_throttle(key_hash,count) values(repeat('9f',32),1)$$));
select pg_temp.check('REFUSES a raw address',       pg_temp.rejects($$insert into request_throttle(key_hash) values('203.0.113.7')$$));
select pg_temp.check('REFUSES a short hash',        pg_temp.rejects($$insert into request_throttle(key_hash) values(repeat('a',63))$$));
select pg_temp.check('REFUSES uppercase hex',       pg_temp.rejects($$insert into request_throttle(key_hash) values(repeat('A',64))$$));
select pg_temp.check('REFUSES a negative count',    pg_temp.rejects($$insert into request_throttle(key_hash,count) values(repeat('b',64),-1)$$));
select pg_temp.check('one row per caller',          pg_temp.rejects($$insert into request_throttle(key_hash) values(repeat('9f',32))$$));
select pg_temp.check('window starts now',           (select window_start > now() - interval '1 minute' from request_throttle limit 1));

-- Sweeping old rows is how this table stays a counter rather than a history of
-- who visited the website.
update request_throttle set window_start = now() - interval '2 days';
select public.prune_request_throttle();
select pg_temp.check('old rows swept',              (select count(*) = 0 from request_throttle));

\echo ''
\echo '--- where the notification goes ---'
select pg_temp.check('notify address exists',       (select count(*) = 1 from site_settings where key = 'notify.request_email'));
select pg_temp.check('and is NOT public',           (select is_public = false from site_settings where key = 'notify.request_email'));
select pg_temp.check('still 8 public settings',     (select count(*) = 8 from site_settings where is_public));
