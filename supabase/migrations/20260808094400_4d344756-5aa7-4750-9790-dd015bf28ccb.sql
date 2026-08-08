CREATE TABLE public.cup_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  cashier_id uuid NOT NULL,
  for_date date NOT NULL DEFAULT CURRENT_DATE,
  cup_type_id uuid NOT NULL REFERENCES public.cup_types(id) ON DELETE CASCADE,
  qty numeric NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cashier_id, for_date, cup_type_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cup_allocations TO authenticated;
GRANT ALL ON public.cup_allocations TO service_role;

ALTER TABLE public.cup_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manages cup allocations" ON public.cup_allocations
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "cashier reads own allocations" ON public.cup_allocations
  FOR SELECT TO authenticated
  USING (cashier_id = auth.uid());

CREATE TRIGGER cup_allocations_updated_at
  BEFORE UPDATE ON public.cup_allocations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();