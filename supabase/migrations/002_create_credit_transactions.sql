create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  reason text not null,
  admin_id uuid references auth.users(id) on delete set null,
  payment_id uuid,
  transaction_type text not null default 'admin_adjustment',
  created_at timestamptz not null default now()
);
alter table public.credit_transactions add column if not exists payment_id uuid;
alter table public.credit_transactions add column if not exists transaction_type text not null default 'admin_adjustment';
alter table public.credit_transactions alter column admin_id drop not null;
create index if not exists idx_credit_transactions_user_id on public.credit_transactions(user_id);
create index if not exists idx_credit_transactions_admin_id on public.credit_transactions(admin_id);
create index if not exists idx_credit_transactions_created_at on public.credit_transactions(created_at desc);
alter table public.credit_transactions enable row level security;
