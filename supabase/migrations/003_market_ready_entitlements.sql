-- FrameFlow market-readiness migration
-- Adds trial/free/pro entitlements, metered processing frames, Creative Credits,
-- atomic reservations, usage telemetry, ownership columns, and production RLS.

create extension if not exists pgcrypto;

alter table public.billing_plans
  add column if not exists processing_frame_limit integer not null default 0,
  add column if not exists creative_credit_limit integer not null default 0,
  add column if not exists trial_days integer not null default 0,
  add column if not exists public_visible boolean not null default true,
  add column if not exists priority_queue boolean not null default false,
  add column if not exists high_quality_export boolean not null default false,
  add column if not exists version_history_days integer not null default 3;

alter table public.profiles
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists trial_consumed boolean not null default false;

update public.profiles
set trial_started_at = coalesce(trial_started_at, created_at, now()),
    trial_ends_at = coalesce(trial_ends_at, coalesce(created_at, now()) + interval '3 days')
where trial_started_at is null or trial_ends_at is null;

alter table public.profiles
  alter column trial_started_at set default now(),
  alter column trial_ends_at set default (now() + interval '3 days');

create or replace function public.ensure_frameflow_trial_dates()
returns trigger language plpgsql as $$
begin
  new.trial_started_at := coalesce(new.trial_started_at, new.created_at, now());
  new.trial_ends_at := coalesce(new.trial_ends_at, new.trial_started_at + interval '3 days');
  return new;
end;
$$;
drop trigger if exists profiles_frameflow_trial_dates on public.profiles;
create trigger profiles_frameflow_trial_dates
before insert on public.profiles
for each row execute function public.ensure_frameflow_trial_dates();

create or replace function public.handle_frameflow_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (
    id, email, full_name, role, credits, subscription_plan,
    trial_started_at, trial_ends_at, trial_consumed, created_at, updated_at
  ) values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    'user', 0, 'free', now(), now() + interval '3 days', false,
    coalesce(new.created_at, now()), now()
  ) on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_frameflow on auth.users;
create trigger on_auth_user_created_frameflow
after insert on auth.users
for each row execute function public.handle_frameflow_new_user();

alter table public.projects
  add column if not exists archived_at timestamptz;

alter table public.colorization_jobs
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists usage_reservation_id uuid;

alter table public.creative_jobs
  add column if not exists usage_reservation_id uuid,
  add column if not exists creative_credit_cost integer not null default 0;

create table if not exists public.account_usage_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_key text not null,
  plan_code text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  processing_frame_limit integer not null default 0 check (processing_frame_limit >= 0),
  processing_frames_used integer not null default 0 check (processing_frames_used >= 0),
  processing_frames_reserved integer not null default 0 check (processing_frames_reserved >= 0),
  creative_credit_limit integer not null default 0 check (creative_credit_limit >= 0),
  creative_credits_used integer not null default 0 check (creative_credits_used >= 0),
  creative_credits_reserved integer not null default 0 check (creative_credits_reserved >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, period_key)
);

create table if not exists public.usage_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_period_id uuid not null references public.account_usage_periods(id) on delete cascade,
  resource_type text not null check (resource_type in ('processing_frames', 'creative_credits')),
  amount integer not null check (amount > 0),
  consumed_amount integer not null default 0 check (consumed_amount >= 0),
  status text not null default 'reserved' check (status in ('reserved', 'partially_consumed', 'consumed', 'released')),
  source_type text not null,
  source_id text,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  unique (user_id, idempotency_key)
);

create table if not exists public.api_rate_limits (
  rate_key text not null,
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  expires_at timestamptz not null,
  primary key (rate_key, window_start)
);

create table if not exists public.usage_events (
  id bigint generated by default as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  job_id text,
  event_type text not null,
  resource_type text,
  quantity numeric not null default 1,
  processing_seconds numeric,
  input_bytes bigint,
  output_bytes bigint,
  vision_call_count integer not null default 0,
  model_id text,
  provider text,
  status text not null default 'completed',
  estimated_cost_usd numeric(14, 8),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists account_usage_periods_user_end_idx
  on public.account_usage_periods(user_id, period_end desc);
create index if not exists usage_reservations_period_status_idx
  on public.usage_reservations(usage_period_id, status);
create index if not exists usage_events_user_created_idx
  on public.usage_events(user_id, created_at desc);
create index if not exists usage_events_job_idx
  on public.usage_events(job_id);
create index if not exists api_rate_limits_expires_idx
  on public.api_rate_limits(expires_at);

-- Keep one active sequence per project. Close any legacy duplicate active rows
-- before creating the partial unique index.
with ranked_active_jobs as (
  select id,
         row_number() over (partition by project_id order by created_at desc, id desc) as rn
  from public.colorization_jobs
  where status in ('created', 'running', 'waiting_review')
)
update public.colorization_jobs j
set status = 'failed',
    error_message = 'Closed during market-ready migration because another active job exists.',
    updated_at = now()
from ranked_active_jobs r
where j.id = r.id and r.rn > 1;

create unique index if not exists colorization_jobs_one_active_per_project_idx
  on public.colorization_jobs(project_id)
  where status in ('created', 'running', 'waiting_review');

alter table public.colorization_jobs
  drop constraint if exists colorization_jobs_usage_reservation_id_fkey;
alter table public.colorization_jobs
  add constraint colorization_jobs_usage_reservation_id_fkey
  foreign key (usage_reservation_id) references public.usage_reservations(id) on delete set null;

alter table public.creative_jobs
  drop constraint if exists creative_jobs_usage_reservation_id_fkey;
alter table public.creative_jobs
  add constraint creative_jobs_usage_reservation_id_fkey
  foreign key (usage_reservation_id) references public.usage_reservations(id) on delete set null;

-- Trial is resolved automatically for the first 72 hours and is not shown as a purchasable plan.
insert into public.billing_plans (
  code, name, description, price_vnd, duration_days, credits_grant,
  project_limit, creative_daily_limit, creative_concurrent_limit,
  sort_order, features, active, processing_frame_limit,
  creative_credit_limit, trial_days, public_visible, priority_queue,
  high_quality_export, version_history_days, created_at, updated_at
) values
  (
    'trial', 'Pro Trial', 'Three-day full-feature trial for new accounts', 0, 3, 50,
    2, 10, 1, 5,
    '["100 Processing Frames total", "50 Creative Credits", "Full Pro workflow for 3 days", "High-quality export"]'::jsonb,
    true, 100, 50, 3, false, false, true, 7, now(), now()
  ),
  (
    'free', 'Free', 'For learning the core FrameFlow workflow', 0, 0, 5,
    2, 5, 1, 10,
    '["50 Processing Frames/month", "5 Creative Credits/month", "Auto Color and manual correction", "PNG and ZIP export"]'::jsonb,
    true, 50, 5, 0, true, false, false, 3, now(), now()
  ),
  (
    'pro', 'Pro Beta', 'For individual artists and frequent animation work', 499000, 30, 500,
    50, 40, 2, 20,
    '["2,000 Processing Frames/month", "500 Creative Credits/month", "2 concurrent Creative Studio jobs", "Priority processing", "High-quality export", "30-day version history"]'::jsonb,
    true, 2000, 500, 0, true, true, true, 30, now(), now()
  )
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  price_vnd = excluded.price_vnd,
  duration_days = excluded.duration_days,
  credits_grant = excluded.credits_grant,
  project_limit = excluded.project_limit,
  creative_daily_limit = excluded.creative_daily_limit,
  creative_concurrent_limit = excluded.creative_concurrent_limit,
  sort_order = excluded.sort_order,
  features = excluded.features,
  active = excluded.active,
  processing_frame_limit = excluded.processing_frame_limit,
  creative_credit_limit = excluded.creative_credit_limit,
  trial_days = excluded.trial_days,
  public_visible = excluded.public_visible,
  priority_queue = excluded.priority_queue,
  high_quality_export = excluded.high_quality_export,
  version_history_days = excluded.version_history_days,
  updated_at = now();

update public.billing_plans set active = false, public_visible = false where code = 'studio';

create or replace function public.consume_frameflow_rate_limit(
  p_rate_key text,
  p_window_seconds integer,
  p_max_requests integer
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_count integer;
begin
  if p_window_seconds <= 0 or p_max_requests <= 0 then
    raise exception 'Invalid rate limit configuration';
  end if;
  v_window_start := to_timestamp(floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds);
  delete from public.api_rate_limits where rate_key = p_rate_key and expires_at < v_now;

  insert into public.api_rate_limits(rate_key, window_start, request_count, expires_at)
  values (p_rate_key, v_window_start, 1, v_window_start + make_interval(secs => p_window_seconds * 2))
  on conflict (rate_key, window_start) do update
    set request_count = public.api_rate_limits.request_count + 1
  returning request_count into v_count;

  if v_count > p_max_requests then
    raise exception 'RATE_LIMIT_EXCEEDED: retry after the current window' using errcode = 'P0001';
  end if;
  return v_count;
end;
$$;

-- Atomic project mutations prevent concurrent requests from bypassing the
-- active-project limit.
create or replace function public.create_frameflow_project(
  p_user_id uuid,
  p_name text,
  p_project_limit integer
) returns public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_project public.projects%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select count(*) into v_count
  from public.projects
  where user_id = p_user_id and archived_at is null;

  if p_project_limit is not null and v_count >= p_project_limit then
    raise exception 'PROJECT_LIMIT_REACHED: active project limit is %', p_project_limit using errcode = 'P0001';
  end if;

  insert into public.projects(user_id, name, status, created_at, updated_at)
  values (p_user_id, p_name, 'draft', now(), now())
  returning * into v_project;
  return v_project;
end;
$$;

create or replace function public.restore_frameflow_project(
  p_user_id uuid,
  p_project_id uuid,
  p_project_limit integer
) returns public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_project public.projects%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select count(*) into v_count
  from public.projects
  where user_id = p_user_id and archived_at is null;

  if p_project_limit is not null and v_count >= p_project_limit then
    raise exception 'PROJECT_LIMIT_REACHED: active project limit is %', p_project_limit using errcode = 'P0001';
  end if;

  update public.projects
  set archived_at = null, updated_at = now()
  where id = p_project_id and user_id = p_user_id and archived_at is not null
  returning * into v_project;

  if not found then raise exception 'Project not found or already active'; end if;
  return v_project;
end;
$$;

-- Claiming and cancellation lock the job row, preventing duplicate frame work
-- and preventing cancellation while a frame is already incurring compute cost.
create or replace function public.claim_frameflow_colorization_frame(
  p_job_id uuid,
  p_job_frame_id uuid
) returns public.colorization_job_frames
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.colorization_jobs%rowtype;
  v_frame public.colorization_job_frames%rowtype;
begin
  select * into v_job from public.colorization_jobs where id = p_job_id for update;
  if not found or v_job.status not in ('created', 'running') then return null; end if;

  update public.colorization_job_frames
  set pipeline_status = 'processing', updated_at = now()
  where id = p_job_frame_id and job_id = p_job_id and pipeline_status = 'pending'
  returning * into v_frame;
  return v_frame;
end;
$$;

create or replace function public.cancel_frameflow_colorization_job(
  p_job_id uuid,
  p_user_id uuid
) returns public.colorization_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.colorization_jobs%rowtype;
begin
  select * into v_job
  from public.colorization_jobs
  where id = p_job_id and (user_id is null or user_id = p_user_id)
  for update;
  if not found then raise exception 'Colorization job not found'; end if;
  if v_job.status not in ('created', 'running', 'waiting_review') then return v_job; end if;

  if exists (
    select 1 from public.colorization_job_frames
    where job_id = p_job_id and pipeline_status = 'processing'
  ) then
    raise exception 'FRAME_IN_PROGRESS: wait for the current frame to finish before cancelling' using errcode = 'P0001';
  end if;

  update public.colorization_jobs
  set status = 'cancelled', current_review_frame_id = null,
      error_message = 'Cancelled by user', updated_at = now()
  where id = p_job_id
  returning * into v_job;
  return v_job;
end;
$$;

create or replace function public.reserve_frameflow_usage(
  p_user_id uuid,
  p_usage_period_id uuid,
  p_resource_type text,
  p_amount integer,
  p_source_type text,
  p_source_id text,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
) returns public.usage_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period public.account_usage_periods%rowtype;
  v_existing public.usage_reservations%rowtype;
  v_created public.usage_reservations%rowtype;
  v_available integer;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Usage amount must be greater than zero';
  end if;
  if p_resource_type not in ('processing_frames', 'creative_credits') then
    raise exception 'Unsupported resource type: %', p_resource_type;
  end if;

  select * into v_period
  from public.account_usage_periods
  where id = p_usage_period_id and user_id = p_user_id
  for update;

  if not found then
    raise exception 'Usage period not found';
  end if;

  select * into v_existing
  from public.usage_reservations
  where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    return v_existing;
  end if;

  if p_resource_type = 'processing_frames' then
    v_available := v_period.processing_frame_limit - v_period.processing_frames_used - v_period.processing_frames_reserved;
  else
    v_available := v_period.creative_credit_limit - v_period.creative_credits_used - v_period.creative_credits_reserved;
  end if;

  if v_available < p_amount then
    raise exception 'Insufficient % quota. Required %, available %', p_resource_type, p_amount, greatest(v_available, 0)
      using errcode = 'P0001';
  end if;

  if p_resource_type = 'processing_frames' then
    update public.account_usage_periods
      set processing_frames_reserved = processing_frames_reserved + p_amount,
          updated_at = now()
      where id = v_period.id;
  else
    update public.account_usage_periods
      set creative_credits_reserved = creative_credits_reserved + p_amount,
          updated_at = now()
      where id = v_period.id;
  end if;

  insert into public.usage_reservations (
    user_id, usage_period_id, resource_type, amount, source_type,
    source_id, idempotency_key, metadata, expires_at
  ) values (
    p_user_id, p_usage_period_id, p_resource_type, p_amount, p_source_type,
    p_source_id, p_idempotency_key, coalesce(p_metadata, '{}'::jsonb), v_period.period_end
  ) returning * into v_created;

  return v_created;
end;
$$;

create or replace function public.consume_frameflow_usage(
  p_reservation_id uuid,
  p_amount integer default null
) returns public.usage_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res public.usage_reservations%rowtype;
  v_remaining integer;
  v_delta integer;
begin
  select * into v_res
  from public.usage_reservations
  where id = p_reservation_id
  for update;

  if not found then raise exception 'Usage reservation not found'; end if;
  if v_res.status in ('consumed', 'released') then return v_res; end if;

  v_remaining := greatest(v_res.amount - v_res.consumed_amount, 0);
  v_delta := least(coalesce(p_amount, v_remaining), v_remaining);
  if v_delta <= 0 then return v_res; end if;

  if v_res.resource_type = 'processing_frames' then
    update public.account_usage_periods
      set processing_frames_reserved = greatest(processing_frames_reserved - v_delta, 0),
          processing_frames_used = processing_frames_used + v_delta,
          updated_at = now()
      where id = v_res.usage_period_id;
  else
    update public.account_usage_periods
      set creative_credits_reserved = greatest(creative_credits_reserved - v_delta, 0),
          creative_credits_used = creative_credits_used + v_delta,
          updated_at = now()
      where id = v_res.usage_period_id;
  end if;

  update public.usage_reservations
    set consumed_amount = consumed_amount + v_delta,
        status = case when consumed_amount + v_delta >= amount then 'consumed' else 'partially_consumed' end,
        settled_at = case when consumed_amount + v_delta >= amount then now() else settled_at end
    where id = v_res.id
    returning * into v_res;

  return v_res;
end;
$$;

create or replace function public.release_frameflow_usage(
  p_reservation_id uuid
) returns public.usage_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res public.usage_reservations%rowtype;
  v_remaining integer;
begin
  select * into v_res
  from public.usage_reservations
  where id = p_reservation_id
  for update;

  if not found then raise exception 'Usage reservation not found'; end if;
  if v_res.status in ('consumed', 'released') then return v_res; end if;

  v_remaining := greatest(v_res.amount - v_res.consumed_amount, 0);
  if v_res.resource_type = 'processing_frames' then
    update public.account_usage_periods
      set processing_frames_reserved = greatest(processing_frames_reserved - v_remaining, 0),
          updated_at = now()
      where id = v_res.usage_period_id;
  else
    update public.account_usage_periods
      set creative_credits_reserved = greatest(creative_credits_reserved - v_remaining, 0),
          updated_at = now()
      where id = v_res.usage_period_id;
  end if;

  update public.usage_reservations
    set status = 'released', settled_at = now()
    where id = v_res.id
    returning * into v_res;
  return v_res;
end;
$$;

revoke execute on function public.consume_frameflow_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.create_frameflow_project(uuid, text, integer) from public, anon, authenticated;
revoke execute on function public.restore_frameflow_project(uuid, uuid, integer) from public, anon, authenticated;
revoke execute on function public.claim_frameflow_colorization_frame(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.cancel_frameflow_colorization_job(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.reserve_frameflow_usage(uuid, uuid, text, integer, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.consume_frameflow_usage(uuid, integer) from public, anon, authenticated;
revoke execute on function public.release_frameflow_usage(uuid) from public, anon, authenticated;
grant execute on function public.consume_frameflow_rate_limit(text, integer, integer) to service_role;
grant execute on function public.create_frameflow_project(uuid, text, integer) to service_role;
grant execute on function public.restore_frameflow_project(uuid, uuid, integer) to service_role;
grant execute on function public.claim_frameflow_colorization_frame(uuid, uuid) to service_role;
grant execute on function public.cancel_frameflow_colorization_job(uuid, uuid) to service_role;
grant execute on function public.reserve_frameflow_usage(uuid, uuid, text, integer, text, text, text, jsonb) to service_role;
grant execute on function public.consume_frameflow_usage(uuid, integer) to service_role;
grant execute on function public.release_frameflow_usage(uuid) to service_role;

-- Atomic admin adjustment for the current usage period.
create or replace function public.adjust_frameflow_creative_credits(
  p_user_id uuid,
  p_usage_period_id uuid,
  p_amount integer,
  p_admin_id uuid,
  p_reason text
) returns public.account_usage_periods
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period public.account_usage_periods%rowtype;
begin
  select * into v_period from public.account_usage_periods
  where id = p_usage_period_id and user_id = p_user_id for update;
  if not found then raise exception 'Usage period not found'; end if;

  update public.account_usage_periods
    set creative_credit_limit = greatest(creative_credit_limit + p_amount, creative_credits_used + creative_credits_reserved),
        updated_at = now()
    where id = v_period.id returning * into v_period;

  insert into public.credit_transactions(user_id, amount, reason, admin_id, transaction_type, created_at)
  values (p_user_id, p_amount, p_reason, p_admin_id, 'admin_adjustment', now());

  return v_period;
end;
$$;
revoke execute on function public.adjust_frameflow_creative_credits(uuid, uuid, integer, uuid, text) from public, anon, authenticated;
grant execute on function public.adjust_frameflow_creative_credits(uuid, uuid, integer, uuid, text) to service_role;

-- Payment activation remains idempotent and updates the paid subscription.
create or replace function public.apply_payos_payment(
  p_order_code bigint,
  p_amount integer,
  p_reference text,
  p_payment_link_id text,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.payment_orders%rowtype;
  v_existing_start timestamptz;
  v_existing_end timestamptz;
  v_existing_status text;
  v_start timestamptz;
  v_end timestamptz;
begin
  select * into v_order from public.payment_orders
  where order_code = p_order_code for update;
  if not found then raise exception 'Payment order not found'; end if;
  if v_order.status = 'paid' then
    return jsonb_build_object('ok', true, 'idempotent', true, 'orderCode', p_order_code);
  end if;
  if p_amount < v_order.amount_vnd then raise exception 'Payment amount is insufficient'; end if;

  select current_period_start, current_period_end, status
    into v_existing_start, v_existing_end, v_existing_status
  from public.subscriptions where user_id = v_order.user_id;

  if v_existing_status = 'active' and v_existing_end is not null and v_existing_end > now() then
    -- Extend access while preserving the original membership start. Usage quotas
    -- reset in fixed plan-length cycles computed by the entitlement service.
    v_start := coalesce(v_existing_start, now());
    v_end := v_existing_end + make_interval(days => v_order.duration_days);
  else
    v_start := now();
    v_end := v_start + make_interval(days => v_order.duration_days);
  end if;

  insert into public.subscriptions(user_id, plan_code, status, current_period_start, current_period_end, latest_payment_id, created_at, updated_at)
  values (v_order.user_id, v_order.plan_code, 'active', v_start, v_end, v_order.id, now(), now())
  on conflict (user_id) do update set
    plan_code = excluded.plan_code,
    status = 'active',
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end,
    latest_payment_id = excluded.latest_payment_id,
    updated_at = now();

  update public.payment_orders set
    status = 'paid', paid_at = now(), payos_reference = p_reference,
    payment_link_id = coalesce(nullif(p_payment_link_id, ''), payment_link_id),
    payos_payload = coalesce(p_payload, '{}'::jsonb), updated_at = now()
  where id = v_order.id;

  update public.profiles set
    subscription_plan = v_order.plan_code,
    updated_at = now()
  where id = v_order.user_id;

  insert into public.credit_transactions(user_id, amount, reason, payment_id, transaction_type, created_at)
  values (v_order.user_id, v_order.credits_grant, 'Subscription Creative Credits grant', v_order.id, 'subscription_grant', now());

  return jsonb_build_object('ok', true, 'idempotent', false, 'orderCode', p_order_code, 'periodEnd', v_end);
end;
$$;
revoke execute on function public.apply_payos_payment(bigint, integer, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.apply_payos_payment(bigint, integer, text, text, jsonb) to service_role;

-- Production ownership policies for data accessed directly from the browser.
alter table public.projects enable row level security;
alter table public.frames enable row level security;
alter table public.profiles enable row level security;

create or replace function public.is_frameflow_admin(p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = p_user_id and role = 'admin') $$;

drop policy if exists projects_owner_select on public.projects;
create policy projects_owner_select on public.projects for select
  using (user_id = auth.uid() or public.is_frameflow_admin());
drop policy if exists projects_owner_insert on public.projects;
create policy projects_owner_insert on public.projects for insert
  with check (user_id = auth.uid());
drop policy if exists projects_owner_update on public.projects;
create policy projects_owner_update on public.projects for update
  using (user_id = auth.uid() or public.is_frameflow_admin())
  with check (user_id = auth.uid() or public.is_frameflow_admin());
drop policy if exists projects_owner_delete on public.projects;
create policy projects_owner_delete on public.projects for delete
  using (user_id = auth.uid() or public.is_frameflow_admin());

drop policy if exists frames_project_owner_select on public.frames;
create policy frames_project_owner_select on public.frames for select using (
  exists(select 1 from public.projects p where p.id = frames.project_id and (p.user_id = auth.uid() or public.is_frameflow_admin()))
);
drop policy if exists frames_project_owner_insert on public.frames;
create policy frames_project_owner_insert on public.frames for insert with check (
  exists(select 1 from public.projects p where p.id = frames.project_id and p.user_id = auth.uid())
);
drop policy if exists frames_project_owner_update on public.frames;
create policy frames_project_owner_update on public.frames for update using (
  exists(select 1 from public.projects p where p.id = frames.project_id and (p.user_id = auth.uid() or public.is_frameflow_admin()))
) with check (
  exists(select 1 from public.projects p where p.id = frames.project_id and (p.user_id = auth.uid() or public.is_frameflow_admin()))
);
drop policy if exists frames_project_owner_delete on public.frames;
create policy frames_project_owner_delete on public.frames for delete using (
  exists(select 1 from public.projects p where p.id = frames.project_id and (p.user_id = auth.uid() or public.is_frameflow_admin()))
);

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles for select
  using (id = auth.uid() or public.is_frameflow_admin());
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update
  using (id = auth.uid() or public.is_frameflow_admin())
  with check (id = auth.uid() or public.is_frameflow_admin());

-- Browser users may only edit safe profile fields. Billing, credits and roles are server-managed.
revoke insert on table public.profiles from authenticated;
revoke update on table public.profiles from authenticated;
grant update (full_name, avatar_url, updated_at) on table public.profiles to authenticated;

alter table public.audit_logs enable row level security;
alter table public.credit_transactions enable row level security;
drop policy if exists audit_logs_admin_select on public.audit_logs;
create policy audit_logs_admin_select on public.audit_logs for select using (public.is_frameflow_admin());
drop policy if exists credit_transactions_self_select on public.credit_transactions;
create policy credit_transactions_self_select on public.credit_transactions for select
  using (user_id = auth.uid() or public.is_frameflow_admin());

alter table public.api_rate_limits enable row level security;
alter table public.account_usage_periods enable row level security;
alter table public.usage_reservations enable row level security;
alter table public.usage_events enable row level security;

drop policy if exists usage_periods_self_select on public.account_usage_periods;
create policy usage_periods_self_select on public.account_usage_periods for select
  using (user_id = auth.uid() or public.is_frameflow_admin());
drop policy if exists usage_reservations_self_select on public.usage_reservations;
create policy usage_reservations_self_select on public.usage_reservations for select
  using (user_id = auth.uid() or public.is_frameflow_admin());
drop policy if exists usage_events_self_select on public.usage_events;
create policy usage_events_self_select on public.usage_events for select
  using (user_id = auth.uid() or public.is_frameflow_admin());
