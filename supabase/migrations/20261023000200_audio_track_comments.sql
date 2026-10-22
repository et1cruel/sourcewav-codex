begin;

alter table public.comments
  alter column post_id drop not null,
  add column track_id uuid references public.audio_tracks(id) on delete cascade,
  add constraint comments_one_subject check (num_nonnulls(post_id, track_id) = 1);

create index comments_track_idx on public.comments (track_id, created_at)
  where track_id is not null;

drop policy comments_read_public on public.comments;
create policy comments_read_public on public.comments for select using (
  deleted_at is null and (
    (post_id is not null and exists (
      select 1 from public.posts p
      where p.id = post_id and p.status = 'published' and p.visibility = 'public' and p.deleted_at is null
    ))
    or (track_id is not null and exists (
      select 1 from public.audio_tracks t
      where t.id = track_id and t.status = 'published' and t.visibility = 'public' and t.deleted_at is null
    ))
  )
);

drop policy comments_insert_self on public.comments;
create policy comments_insert_self on public.comments for insert with check (
  author_id = auth.uid() and (
    (post_id is not null and exists (
      select 1 from public.posts p
      where p.id = post_id and p.status = 'published' and p.visibility = 'public' and p.deleted_at is null
    ))
    or (track_id is not null and exists (
      select 1 from public.audio_tracks t
      where t.id = track_id and t.status = 'published' and t.visibility = 'public' and t.deleted_at is null
    ))
  )
);

commit;
