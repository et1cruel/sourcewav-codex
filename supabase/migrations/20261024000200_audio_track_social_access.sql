begin;
grant select on public.audio_track_likes to anon, authenticated;
grant delete on public.audio_tracks to authenticated;
commit;
