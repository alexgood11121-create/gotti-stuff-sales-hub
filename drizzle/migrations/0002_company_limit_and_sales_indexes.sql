ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS employee_limit numeric NOT NULL DEFAULT 30000;
CREATE INDEX IF NOT EXISTS sales_created_at_idx ON public.sales (created_at);
CREATE INDEX IF NOT EXISTS sales_cashier_created_idx ON public.sales (cashier_id, created_at);
CREATE INDEX IF NOT EXISTS sales_company_created_idx ON public.sales (company_id, created_at);
CREATE INDEX IF NOT EXISTS sale_items_sale_id_idx ON public.sale_items (sale_id);