-- Marketing, deliberately separate from rental requests.
--
-- send-campaign reads marketing_subscribers and nothing else. There is no join
-- from here to rental_requests, so asking about a car can never become consent
-- to be marketed to.

create table public.marketing_subscribers (
  id                uuid primary key default gen_random_uuid(),
  email             citext not null unique
                      check (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),

  -- Context for the admin only. Never used to build a recipient list.
  customer_id       uuid references public.customers(id) on delete set null,

  -- Never pre-selected. The default is the law here, not the markup.
  consented         boolean not null default false,
  consent_at        timestamptz,
  consent_source    text not null default 'request_form',

  unsubscribed_at   timestamptz,
  unsubscribe_token uuid not null unique default gen_random_uuid(),

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- Consent you cannot date is consent you cannot evidence.
  constraint consent_needs_timestamp
    check (consented = false or consent_at is not null)
);

create index marketing_sendable_idx
  on public.marketing_subscribers (email)
  where consented and unsubscribed_at is null;

create trigger marketing_subscribers_touch
  before update on public.marketing_subscribers
  for each row execute function public.touch_updated_at();

create table public.email_campaigns (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (length(btrim(name)) between 1 and 120),
  subject         text not null check (length(btrim(subject)) between 1 and 200),
  body_html       text not null,
  body_text       text,
  status          public.campaign_status not null default 'draft',
  scheduled_for   timestamptz,
  sent_at         timestamptz,

  -- Sends and bounces. Opens and clicks would need Resend event webhooks.
  recipient_count integer not null default 0 check (recipient_count >= 0),
  delivered_count integer not null default 0 check (delivered_count >= 0),
  failed_count    integer not null default 0 check (failed_count    >= 0),

  created_by      uuid references public.admin_users(user_id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger email_campaigns_touch
  before update on public.email_campaigns
  for each row execute function public.touch_updated_at();
