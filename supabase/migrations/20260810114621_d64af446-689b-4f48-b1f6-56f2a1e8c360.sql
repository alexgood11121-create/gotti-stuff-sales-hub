DROP POLICY IF EXISTS "admin reads notifications" ON public.notifications;
CREATE POLICY "admin reads notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "admin updates notifications" ON public.notifications;
CREATE POLICY "admin updates notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "admin reads all roles" ON public.user_roles;
CREATE POLICY "admin reads all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "user reads own roles" ON public.user_roles;
CREATE POLICY "user reads own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON public.notifications FROM anon;
REVOKE ALL ON public.user_roles FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.notifications TO service_role;
GRANT ALL ON public.user_roles TO service_role;