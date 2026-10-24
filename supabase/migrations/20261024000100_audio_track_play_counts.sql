begin;

alter table public.audio_tracks
  add column play_count bigint not null default 0 check (play_count >= 0);

create or replace function public.record_audio_track_play(p_track_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_count bigint;
begin
  update public.audio_tracks
  set play_count = play_count + 1
  where id = p_track_id
    and status = 'published'
    and visibility = 'public'
    and deleted_at is null
  returning play_count into updated_count;

  return updated_count;
end;
$$;

revoke all on function public.record_audio_track_play(uuid) from public;
grant execute on function public.record_audio_track_play(uuid) to anon, authenticated;

commit;
