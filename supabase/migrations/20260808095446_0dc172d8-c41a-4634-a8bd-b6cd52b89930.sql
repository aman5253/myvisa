
CREATE POLICY "own case files read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'case-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own case files insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'case-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own case files update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'case-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own case files delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'case-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
