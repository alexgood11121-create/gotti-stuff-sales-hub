
-- Shifts: opening/closing cash tracking
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS opening_cash numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS closing_cash_expected numeric,
  ADD COLUMN IF NOT EXISTS closing_cash_actual numeric,
  ADD COLUMN IF NOT EXISTS cash_diff numeric;

-- Parked sales
CREATE TABLE IF NOT EXISTS public.parked_sales (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  cashier_id uuid NOT NULL,
  label text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parked_sales TO authenticated;
GRANT ALL ON public.parked_sales TO service_role;

ALTER TABLE public.parked_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manages parked sales"
  ON public.parked_sales FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "cashier reads own branch parked"
  ON public.parked_sales FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'cashier')
    AND (branch_id = public.current_user_branch() OR cashier_id = auth.uid())
  );

CREATE POLICY "cashier inserts own parked"
  ON public.parked_sales FOR INSERT
  TO authenticated
  WITH CHECK (cashier_id = auth.uid());

CREATE POLICY "cashier updates own parked"
  ON public.parked_sales FOR UPDATE
  TO authenticated
  USING (cashier_id = auth.uid())
  WITH CHECK (cashier_id = auth.uid());

CREATE POLICY "cashier deletes own parked"
  ON public.parked_sales FOR DELETE
  TO authenticated
  USING (cashier_id = auth.uid());

CREATE TRIGGER parked_sales_updated_at
  BEFORE UPDATE ON public.parked_sales
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
