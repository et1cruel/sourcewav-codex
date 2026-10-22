-- Store optional wide banner artwork separately from square cover artwork.
begin;

alter table public.audio_tracks
  add column if not exists banner_storage_key text;

commit;
