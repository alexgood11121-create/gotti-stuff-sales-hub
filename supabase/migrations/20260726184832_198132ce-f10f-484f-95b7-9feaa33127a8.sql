
CREATE TABLE public.shift_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shift_schedule_valid_range CHECK (ends_at > starts_at)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_schedules TO authenticated;
GRANT ALL ON public.shift_schedules TO service_role;

ALTER TABLE public.shift_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manages schedules" ON public.shift_schedules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "worker views own schedule" ON public.shift_schedules
  FOR SELECT TO authenticated
  USING (worker_id = auth.uid());

CREATE INDEX shift_schedules_worker_idx ON public.shift_schedules(worker_id, starts_at);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER shift_schedules_updated
  BEFORE UPDATE ON public.shift_schedules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
