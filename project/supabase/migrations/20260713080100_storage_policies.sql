/*
# Storage Policies — `attachments` bucket

## Why this migration exists
The original schema migration created RLS policies for the `attachments`
metadata TABLE (file_name, file_path, file_size, etc.) but never addressed
`storage.objects`, which is what actually governs whether a given file
upload/download/delete succeeds in Supabase Storage. Without these, the
bucket's access falls back to whatever the bucket's default (dashboard-
configured) policy is — which may be fully public or fully closed, and
either way isn't expressed anywhere in version control.

TaskModal.tsx uses:
  supabase.storage.from('attachments').upload(path, file)   -> needs INSERT
  supabase.storage.from('attachments').remove([path])       -> needs DELETE
File downloads happen via public/signed URLs generated client-side, which
need SELECT on storage.objects to resolve.

Path convention already in use: `${task.id}/${Date.now()}-${file.name}`.

## Notes
- Assumes the `attachments` bucket already exists (created via Supabase
  Studio/CLI: `supabase storage create attachments` or dashboard). This
  migration only adds RLS policies on storage.objects scoped to that
  bucket_id — it does not create the bucket itself.
- `owner` on storage.objects is populated automatically by Supabase Storage
  from the uploader's auth.uid() when using the authenticated client (as
  this app does), so "delete own" can be expressed directly against it.
*/

-- Read: any authenticated user can view/download any file in the
-- attachments bucket. Matches the `attachments` metadata table's
-- attachments_select_all policy (shared workspace).
DROP POLICY IF EXISTS "attachments_storage_select" ON storage.objects;
CREATE POLICY "attachments_storage_select" ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'attachments');

-- Insert: any authenticated user can upload. Matches the `upload`
-- permission in rbac.ts, which is granted to every role.
DROP POLICY IF EXISTS "attachments_storage_insert" ON storage.objects;
CREATE POLICY "attachments_storage_insert" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'attachments');

-- Delete: only the uploader may remove their own file. Matches
-- attachments_delete_own on the metadata table (TaskModal.tsx's
-- `remove` handler deletes the storage object and the metadata row
-- together — keeping these two policies in lockstep avoids a state where
-- one succeeds and the other is silently denied).
DROP POLICY IF EXISTS "attachments_storage_delete_own" ON storage.objects;
CREATE POLICY "attachments_storage_delete_own" ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'attachments' AND owner = auth.uid());
