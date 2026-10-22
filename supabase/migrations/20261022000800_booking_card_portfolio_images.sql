begin;
alter table public.booking_cards
  add column if not exists portfolio_image_url text not null default '';
commit;
