ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'debt';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS debt_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS debtor_name text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS debt_paid boolean NOT NULL DEFAULT false;