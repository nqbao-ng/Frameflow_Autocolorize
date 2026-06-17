-- Create credit_transactions table for tracking credit changes
-- Run this migration in Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INT NOT NULL,
  reason TEXT NOT NULL,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes for common queries
  CONSTRAINT credit_transactions_user_id_idx ON (user_id),
  CONSTRAINT credit_transactions_created_at_idx ON (created_at DESC)
);

-- Create indexes
CREATE INDEX idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_admin_id ON public.credit_transactions(admin_id);
CREATE INDEX idx_credit_transactions_created_at ON public.credit_transactions(created_at DESC);

-- Enable RLS
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own transactions
CREATE POLICY "Users can view their own transactions"
  ON public.credit_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all transactions
CREATE POLICY "Admins can view all transactions"
  ON public.credit_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- System can insert transactions
CREATE POLICY "System can insert transactions"
  ON public.credit_transactions FOR INSERT
  WITH CHECK (true);

-- Add view for easier access to transaction history
CREATE OR REPLACE VIEW public.user_credit_summary AS
SELECT 
  user_id,
  SUM(amount) as total_credits_changed,
  COUNT(*) as transaction_count,
  MIN(created_at) as first_transaction,
  MAX(created_at) as last_transaction
FROM public.credit_transactions
GROUP BY user_id;