alter table public.audio_tracks
  add column lyrics jsonb not null default '[]'::jsonb;

alter table public.audio_tracks
  add constraint audio_tracks_lyrics_array_check
  check (jsonb_typeof(lyrics) = 'array');
