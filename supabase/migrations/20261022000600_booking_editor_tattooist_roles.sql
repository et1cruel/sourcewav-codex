-- Allow the new creative roles on Booking Board cards.
begin;

alter table public.booking_cards
  drop constraint if exists booking_cards_role_check;

alter table public.booking_cards
  add constraint booking_cards_role_check
  check (role in ('dj','rapper','producer','photographer','editor','tattooist','vj','crew','other'));

commit;
