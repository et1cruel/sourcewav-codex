-- Add Organizer as a Booking Board service category.
-- Rollback note: remove or reclassify organizer booking cards before restoring the prior constraint.
begin;

alter table public.booking_cards
  drop constraint if exists booking_cards_role_check;

alter table public.booking_cards
  add constraint booking_cards_role_check
  check (role in ('dj','rapper','producer','photographer','editor','tattooist','vj','crew','organizer','other'))
  not valid;

alter table public.booking_cards
  validate constraint booking_cards_role_check;

commit;
