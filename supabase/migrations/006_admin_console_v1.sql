-- FrameFlow Admin Console V1
-- Adds read-optimized indexes and one exact aggregate RPC for the service-role
-- Admin API. No user-facing RLS permissions are widened.

create index if not exists payment_orders_status_created_idx
  on public.payment_orders(status, created_at desc);

create index if not exists payment_orders_paid_at_idx
  on public.payment_orders(paid_at desc)
  where status = 'paid';

create index if not exists subscriptions_status_period_end_idx
  on public.subscriptions(status, current_period_end desc);

create index if not exists usage_events_created_user_idx
  on public.usage_events(created_at desc, user_id);

create index if not exists profiles_role_plan_created_idx
  on public.profiles(role, subscription_plan, created_at desc);

create or replace function public.get_frameflow_admin_metrics(
  p_since timestamptz default (now() - interval '30 days')
) returns table (
  total_users bigint,
  new_users_30d bigint,
  active_users_30d bigint,
  active_subscriptions bigint,
  paid_orders_30d bigint,
  pending_payments bigint,
  revenue_30d_vnd numeric,
  revenue_all_time_vnd numeric,
  available_creative_credits numeric,
  processing_frames_30d numeric,
  creative_credits_used_30d numeric,
  estimated_cost_usd_30d numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.profiles),
    (select count(*) from public.profiles where created_at >= p_since),
    (select count(distinct user_id) from public.usage_events where created_at >= p_since),
    (
      select count(*)
      from public.subscriptions
      where status = 'active' and current_period_end > now()
    ),
    (
      select count(*)
      from public.payment_orders
      where status = 'paid' and paid_at >= p_since
    ),
    (
      select count(*)
      from public.payment_orders
      where status = 'pending' and expires_at > now()
    ),
    (
      select coalesce(sum(amount_vnd), 0)
      from public.payment_orders
      where status = 'paid' and paid_at >= p_since
    ),
    (
      select coalesce(sum(amount_vnd), 0)
      from public.payment_orders
      where status = 'paid'
    ),
    (
      select coalesce(sum(greatest(
        creative_credit_limit - creative_credits_used - creative_credits_reserved,
        0
      )), 0)
      from public.account_usage_periods
      where period_start <= now() and period_end > now()
    ),
    (
      select coalesce(sum(quantity), 0)
      from public.usage_events
      where created_at >= p_since
        and resource_type = 'processing_frames'
        and status <> 'released'
    ),
    (
      select coalesce(sum(quantity), 0)
      from public.usage_events
      where created_at >= p_since
        and resource_type = 'creative_credits'
        and status <> 'released'
    ),
    (
      select coalesce(sum(estimated_cost_usd), 0)
      from public.usage_events
      where created_at >= p_since
    );
$$;

revoke execute on function public.get_frameflow_admin_metrics(timestamptz)
  from public, anon, authenticated;
grant execute on function public.get_frameflow_admin_metrics(timestamptz)
  to service_role;
