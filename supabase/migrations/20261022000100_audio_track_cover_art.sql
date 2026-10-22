-- Forward-only migration: audio cover images are stored separately from audio files.
begin;

alter table public.audio_tracks
  add column if not exists cover_storage_key text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sourcewav-track-covers',
  'sourcewav-track-covers',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy sourcewav_track_covers_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'sourcewav-track-covers');

create policy sourcewav_track_covers_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'sourcewav-track-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy sourcewav_track_covers_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'sourcewav-track-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;
