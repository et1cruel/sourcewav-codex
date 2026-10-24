begin;

create table public.audio_track_play_events (
  track_id uuid not null references public.audio_tracks(id) on delete cascade,
  listener_key text not null,
  period_start timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (track_id, listener_key, period_start)
);
create index audio_track_play_events_created_idx on public.audio_track_play_events (created_at);
alter table public.audio_track_play_events enable row level security;
revoke all on public.audio_track_play_events from anon, authenticated;

create or replace function public.record_audio_track_listen(p_track_id uuid, p_session_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  track_owner uuid;
  current_count bigint;
  listener_key text;
  inserted_track uuid;
begin
  if p_track_id is null or p_session_id is null then return null; end if;

  select owner_id, play_count into track_owner, current_count
  from public.audio_tracks
  where id = p_track_id and status = 'published'
    and visibility = 'public' and deleted_at is null;
  if track_owner is null then return null; end if;
  if track_owner = auth.uid() then return current_count; end if;

  listener_key := case when auth.uid() is null
    then 'guest:' || p_session_id::text
    else 'user:' || auth.uid()::text end;

  insert into public.audio_track_play_events (track_id, listener_key, period_start)
  values (p_track_id, listener_key,
    to_timestamp(floor(extract(epoch from now()) / 1800) * 1800))
  on conflict do nothing
  returning track_id into inserted_track;

  if inserted_track is not null then
    update public.audio_tracks set play_count = play_count + 1
    where id = p_track_id returning play_count into current_count;
  else
    select play_count into current_count from public.audio_tracks where id = p_track_id;
  end if;
  return current_count;
end;
$$;

revoke all on function public.record_audio_track_play(uuid) from anon, authenticated;
revoke all on function public.record_audio_track_listen(uuid, uuid) from public;
grant execute on function public.record_audio_track_listen(uuid, uuid) to anon, authenticated;

commit;
