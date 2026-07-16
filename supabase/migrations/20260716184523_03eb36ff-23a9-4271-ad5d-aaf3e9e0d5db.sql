
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin reads notifications" ON public.notifications FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin updates notifications" ON public.notifications FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
