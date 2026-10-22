begin;

alter table public.community_room_messages
  add column if not exists image_storage_key text;

alter table public.community_room_messages
  drop constraint if exists community_room_messages_body_check;

alter table public.community_room_messages
  add constraint community_room_messages_body_or_image_check
  check (
    char_length(body) <= 2000
    and (char_length(body) > 0 or image_storage_key is not null)
  );

grant select (id, body, image_storage_key, author_id, created_at, room_id)
  on public.community_room_messages to anon, authenticated;
grant insert (room_id, author_id, body, image_storage_key)
  on public.community_room_messages to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sourcewav-room-images',
  'sourcewav-room-images',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy sourcewav_room_images_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'sourcewav-room-images');

create policy sourcewav_room_images_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'sourcewav-room-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy sourcewav_room_images_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'sourcewav-room-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'community_rooms'
  ) then
    alter publication supabase_realtime add table public.community_rooms;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'community_room_messages'
  ) then
    alter publication supabase_realtime add table public.community_room_messages;
  end if;
end;
$$;

commit;
