-- ============================================================
-- NOVA POS
-- PROFILE AVATARS
-- ============================================================

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)

values (
  'profile-avatars',
  'profile-avatars',
  true,
  5242880,
  array[
    'image/webp',
    'image/jpeg',
    'image/png'
  ]
)

on conflict (id)

do update set

  public =
    excluded.public,

  file_size_limit =
    excluded.file_size_limit,

  allowed_mime_types =
    excluded.allowed_mime_types;


-- ============================================================
-- INSERT
-- Each user may write only inside:
--
-- profile-avatars/<auth-user-id>/...
-- ============================================================

drop policy if exists
nova_profile_avatar_insert
on storage.objects;


create policy
nova_profile_avatar_insert

on storage.objects

for insert

to authenticated

with check (

  bucket_id =
    'profile-avatars'

  and

  (
    storage.foldername(
      name
    )
  )[1] =
    auth.uid()::text

);


-- ============================================================
-- UPDATE
-- ============================================================

drop policy if exists
nova_profile_avatar_update
on storage.objects;


create policy
nova_profile_avatar_update

on storage.objects

for update

to authenticated

using (

  bucket_id =
    'profile-avatars'

  and

  (
    storage.foldername(
      name
    )
  )[1] =
    auth.uid()::text

)

with check (

  bucket_id =
    'profile-avatars'

  and

  (
    storage.foldername(
      name
    )
  )[1] =
    auth.uid()::text

);


-- ============================================================
-- DELETE
-- ============================================================

drop policy if exists
nova_profile_avatar_delete
on storage.objects;


create policy
nova_profile_avatar_delete

on storage.objects

for delete

to authenticated

using (

  bucket_id =
    'profile-avatars'

  and

  (
    storage.foldername(
      name
    )
  )[1] =
    auth.uid()::text

);