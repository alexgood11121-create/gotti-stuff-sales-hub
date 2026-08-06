CREATE TABLE public.cup_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  material text NOT NULL DEFAULT 'craft',
  volume_ml integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cup_types TO authenticated;
GRANT ALL ON public.cup_types TO service_role;
ALTER TABLE public.cup_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manages cup types" ON public.cup_types FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "auth reads cup types" ON public.cup_types FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

ALTER TABLE public.products ADD COLUMN cup_type_id uuid REFERENCES public.cup_types(id) ON DELETE SET NULL;

CREATE TABLE public.shift_cups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  cup_type_id uuid NOT NULL REFERENCES public.cup_types(id) ON DELETE CASCADE,
  issued_qty numeric NOT NULL DEFAULT 0,
  counted_qty numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shift_id, cup_type_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_cups TO authenticated;
GRANT ALL ON public.shift_cups TO service_role;
ALTER TABLE public.shift_cups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manages shift cups" ON public.shift_cups FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "cashier reads own shift cups" ON public.shift_cups FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shifts s WHERE s.id = shift_cups.shift_id AND s.cashier_id = auth.uid()));
CREATE POLICY "cashier updates own shift cups" ON public.shift_cups FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shifts s WHERE s.id = shift_cups.shift_id AND s.cashier_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shifts s WHERE s.id = shift_cups.shift_id AND s.cashier_id = auth.uid()));
CREATE POLICY "cashier inserts own shift cups" ON public.shift_cups FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.shifts s WHERE s.id = shift_cups.shift_id AND s.cashier_id = auth.uid()));

CREATE TRIGGER shift_cups_updated_at BEFORE UPDATE ON public.shift_cups
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.cup_types (name, material, volume_ml, sort_order) VALUES
  ('Крафт 350', 'craft', 350, 1),
  ('Крафт 450', 'craft', 450, 2),
  ('Пластик 500', 'plastic', 500, 3),
  ('Пластик 700', 'plastic', 700, 4);