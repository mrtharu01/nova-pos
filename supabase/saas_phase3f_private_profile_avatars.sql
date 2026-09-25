-- ============================================================
-- NOVA POS
-- SaaS Phase 3F — Private profile avatars
-- ============================================================

update storage.buckets
set public = false
where id = 'profile-avatars';


drop policy if exists
nova_profile_avatar_select
on storage.objects;


create policy
nova_profile_avatar_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'profile-avatars'
  and
  (storage.foldername(name))[1] = auth.uid()::text
);


comment on policy
nova_profile_avatar_select
on storage.objects
is
  'A NOVA user may read only avatar objects stored inside their own auth-user folder.';


notify pgrst,
'reload schema';
