-- FrameFlow market plan sync: make Processing Frames the primary quota.
-- Safe to run after 003_market_ready_entitlements.sql.

update public.billing_plans
set
  name = 'Pro Beta',
  description = 'For individual artists and frequent animation work',
  price_vnd = 499000,
  duration_days = 30,
  credits_grant = 500,
  processing_frame_limit = 2000,
  creative_credit_limit = 500,
  creative_daily_limit = 40,
  creative_concurrent_limit = 2,
  features = '["2,000 Processing Frames/month", "500 Creative Credits/month", "2 concurrent Creative Studio jobs", "Priority processing", "High-quality export", "30-day version history"]'::jsonb,
  active = true,
  public_visible = true,
  updated_at = now()
where code = 'pro';


update public.billing_plans
set features = '["100 Processing Frames total", "50 Creative Credits", "Full Pro workflow for 3 days", "High-quality export"]'::jsonb,
    updated_at = now()
where code = 'trial';

update public.billing_plans
set features = '["50 Processing Frames/month", "5 Creative Credits/month", "Auto Color and manual correction", "PNG and ZIP export"]'::jsonb,
    updated_at = now()
where code = 'free';

-- Existing paid periods keep consumed/reserved counters but immediately receive
-- the upgraded allowance. GREATEST prevents accidental quota reductions.
update public.account_usage_periods
set
  processing_frame_limit = greatest(processing_frame_limit, 2000),
  creative_credit_limit = greatest(creative_credit_limit, 500),
  updated_at = now()
where plan_code = 'pro'
  and period_end > now();

-- Studio remains unavailable until the product team explicitly launches it.
update public.billing_plans
set active = false, public_visible = false, updated_at = now()
where code = 'studio';
