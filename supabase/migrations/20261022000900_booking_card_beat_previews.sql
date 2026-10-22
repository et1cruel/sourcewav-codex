begin;

alter table public.booking_cards
  add column if not exists portfolio_audio_url text not null default '';

-- Booking cards are owner-managed; grant only the portfolio fields needed by
-- the existing image upload and the new producer beat preview upload.
grant insert (
  artist_id, stage_name, role, role_label, rate_minor, rate_unit, city,
  availability_note, is_immediate, bio, portfolio_sample,
  portfolio_image_url, portfolio_audio_url
) on public.booking_cards to authenticated;

grant update (
  stage_name, role, role_label, rate_minor, rate_unit, city,
  availability_note, is_immediate, bio, portfolio_sample,
  portfolio_image_url, portfolio_audio_url
) on public.booking_cards to authenticated;

commit;
