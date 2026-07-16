
CREATE POLICY "auth reads product images" ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);
CREATE POLICY "admin uploads product images" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin updates product images" ON storage.objects FOR UPDATE
  USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin deletes product images" ON storage.objects FOR DELETE
  USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));
