
CREATE TABLE public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cashier_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX shifts_cashier_open_idx ON public.shifts(cashier_id) WHERE ended_at IS NULL;
CREATE INDEX shifts_started_at_idx ON public.shifts(started_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shifts TO authenticated;
GRANT ALL ON public.shifts TO service_role;

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cashier sees own shifts"
  ON public.shifts FOR SELECT
  TO authenticated
  USING (cashier_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "cashier opens own shift"
  ON public.shifts FOR INSERT
  TO authenticated
  WITH CHECK (cashier_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "cashier closes own shift"
  ON public.shifts FOR UPDATE
  TO authenticated
  USING (cashier_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (cashier_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin deletes shifts"
  ON public.shifts FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
