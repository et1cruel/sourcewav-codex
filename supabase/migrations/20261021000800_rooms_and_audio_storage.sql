-- Public community rooms and cloud audio storage.
begin;

create table if not exists public.community_rooms (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(user_id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  description text not null default '' check (char_length(description) <= 500),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.community_room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.community_rooms(id) on delete cascade,
  author_id uuid not null references public.profiles(user_id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists community_room_messages_room_created_idx
  on public.community_room_messages (room_id, created_at desc);

alter table public.community_rooms enable row level security;
alter table public.community_room_messages enable row level security;
revoke all on public.community_rooms, public.community_room_messages from anon, authenticated;
grant select on public.community_rooms, public.community_room_messages to anon, authenticated;
grant insert (created_by, name, description) on public.community_rooms to authenticated;
grant insert (room_id, author_id, body) on public.community_room_messages to authenticated;

create policy community_rooms_read_active on public.community_rooms
  for select to anon, authenticated using (archived_at is null);
create policy community_rooms_create_self on public.community_rooms
  for insert to authenticated with check (created_by = auth.uid());
create policy community_room_messages_read_active on public.community_room_messages
  for select to anon, authenticated using (exists (
    select 1 from public.community_rooms r where r.id = room_id and r.archived_at is null
  ));
create policy community_room_messages_insert_self on public.community_room_messages
  for insert to authenticated with check (
    author_id = auth.uid() and exists (
      select 1 from public.community_rooms r where r.id = room_id and r.archived_at is null
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sourcewav-audio', 'sourcewav-audio', true, 52428800,
  array['audio/mpeg','audio/wav','audio/flac','audio/ogg','audio/mp4','audio/aac','audio/webm'])
on conflict (id) do update set public = true, file_size_limit = 52428800,
  allowed_mime_types = excluded.allowed_mime_types;

create policy sourcewav_audio_public_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'sourcewav-audio');
create policy sourcewav_audio_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'sourcewav-audio' and (storage.foldername(name))[1] = auth.uid()::text);
create policy sourcewav_audio_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'sourcewav-audio' and (storage.foldername(name))[1] = auth.uid()::text);

commit;
