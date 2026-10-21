-- Live data access for Booking, Drops, Event Command Center, and Artist Store.
-- Forward-only production migration. Apply once migrations 00000-00500 are present.
begin;

alter table public.booking_offers
  add column if not exists client_name text not null default '',
  add column if not exists client_contact text not null default '',
  add column if not exists role_needed text not null default '';

alter table public.artist_store_orders
  add column if not exists buyer_contact text not null default '';
alter table public.artist_store_orders alter column status set default 'pending';
alter table public.event_expenses alter column is_paid set default false;

create table if not exists public.user_drop_reads (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  drop_id uuid not null references public.drop_alerts(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, drop_id)
);
alter table public.user_drop_reads enable row level security;

-- The current public map uses stable external venue slugs. Keep those follows
-- account scoped until a venue record is linked to a UUID in public.venues.
create table if not exists public.user_venue_follows (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  venue_key text not null check (char_length(venue_key) between 1 and 120),
  created_at timestamptz not null default now(),
  primary key (user_id, venue_key)
);
alter table public.user_venue_follows enable row level security;

revoke all on public.booking_cards, public.booking_offers, public.venue_follows,
  public.user_venue_follows, public.drop_alerts, public.user_drop_reads, public.event_expenses, public.event_crew,
  public.event_summaries, public.artist_products, public.artist_store_orders
  from anon, authenticated;

-- Publicly readable data. User specific inserts and mutations are constrained below.
grant select on public.booking_cards, public.drop_alerts, public.artist_products to anon, authenticated;
grant select on public.venue_follows, public.user_drop_reads to authenticated;
grant select, insert, delete on public.user_venue_follows to authenticated;
grant select on public.booking_offers, public.event_expenses, public.event_crew,
  public.event_summaries, public.artist_store_orders to authenticated;
grant select on public.events, public.ticket_types to authenticated;

grant insert (artist_id, stage_name, role, role_label, rate_minor, rate_unit, city,
  availability_note, is_immediate, bio, portfolio_sample)
  on public.booking_cards to authenticated;
grant update (stage_name, role, role_label, rate_minor, rate_unit, city,
  availability_note, is_immediate, bio, portfolio_sample)
  on public.booking_cards to authenticated;
grant delete on public.booking_cards to authenticated;

grant insert (creator_id, drop_type, title, detail_text, action_label, action_url)
  on public.drop_alerts to authenticated;
grant insert, delete on public.venue_follows to authenticated;
grant insert, delete on public.user_drop_reads to authenticated;

grant insert (event_id, created_by, category, title, amount_minor, receipt_url)
  on public.event_expenses to authenticated;
grant update (is_paid) on public.event_expenses to authenticated;
grant insert (event_id, name, role, phone, duty_status), delete on public.event_crew to authenticated;
grant update (name, role, phone, duty_status) on public.event_crew to authenticated;
grant insert (event_id, peak_hour_note, retrospective_notes, updated_at),
  update (peak_hour_note, retrospective_notes, updated_at)
  on public.event_summaries to authenticated;

grant insert (artist_id, title, category, product_type, price_minor, stock,
  image_url, preview_audio_url, digital_asset_key, description, is_active)
  on public.artist_products to authenticated;
grant update (title, category, product_type, price_minor, stock, image_url,
  preview_audio_url, digital_asset_key, description, is_active)
  on public.artist_products to authenticated;
grant delete on public.artist_products to authenticated;

-- Booking cards are public, but only their artist may change them. Pro status and
-- completed job counts are server controlled and are intentionally not writable.
create policy booking_cards_insert_owner on public.booking_cards
  for insert to authenticated with check (artist_id = auth.uid() and not is_pro and gigs_completed = 0);
create policy booking_cards_update_owner on public.booking_cards
  for update to authenticated using (artist_id = auth.uid())
  with check (artist_id = auth.uid() and not is_pro);
create policy booking_cards_delete_owner on public.booking_cards
  for delete to authenticated using (artist_id = auth.uid());

create policy booking_offers_read_participant on public.booking_offers
  for select to authenticated using (
    client_id = auth.uid() or exists (
      select 1 from public.booking_cards c where c.id = card_id and c.artist_id = auth.uid()
    )
  );
create policy booking_offers_insert_client on public.booking_offers
  for insert to authenticated with check (
    client_id = auth.uid() and exists (
      select 1 from public.booking_cards c where c.id = card_id and c.artist_id <> auth.uid()
    )
  );
create policy booking_offers_update_artist on public.booking_offers
  for update to authenticated using (
    status = 'pending' and exists (
      select 1 from public.booking_cards c where c.id = card_id and c.artist_id = auth.uid()
    )
  ) with check (
    status in ('accepted','declined') and exists (
      select 1 from public.booking_cards c where c.id = card_id and c.artist_id = auth.uid()
    )
  );
revoke insert, update, delete on public.booking_offers from authenticated;
grant insert (card_id, client_id, event_title, event_date, venue_location,
  offered_budget_minor, details) on public.booking_offers to authenticated;
grant update (status) on public.booking_offers to authenticated;

create policy venue_follows_insert_self on public.venue_follows
  for insert to authenticated with check (user_id = auth.uid());
create policy venue_follows_delete_self on public.venue_follows
  for delete to authenticated using (user_id = auth.uid());
create policy user_drop_reads_self on public.user_drop_reads
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy user_venue_follows_self on public.user_venue_follows
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy drop_alerts_insert_owner on public.drop_alerts
  for insert to authenticated with check (
    creator_id = auth.uid() and is_promoted = false and promo_tier is null
  );

create policy event_expenses_read_organizer on public.event_expenses
  for select to authenticated using (exists (
    select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid()
  ));
create policy event_expenses_insert_organizer on public.event_expenses
  for insert to authenticated with check (created_by = auth.uid() and exists (
    select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid()
  ));
create policy event_expenses_update_organizer on public.event_expenses
  for update to authenticated using (exists (
    select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid()
  )) with check (exists (
    select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid()
  ));
create policy event_crew_read_organizer on public.event_crew
  for select to authenticated using (exists (
    select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid()
  ));
create policy event_crew_insert_organizer on public.event_crew
  for insert to authenticated with check (exists (
    select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid()
  ));
create policy event_crew_update_organizer on public.event_crew
  for update to authenticated using (exists (
    select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid()
  )) with check (exists (
    select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid()
  ));
create policy event_crew_delete_organizer on public.event_crew
  for delete to authenticated using (exists (
    select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid()
  ));
create policy event_summaries_read_organizer on public.event_summaries
  for select to authenticated using (exists (
    select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid()
  ));
create policy event_summaries_insert_organizer on public.event_summaries
  for insert to authenticated with check (exists (
    select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid()
  ));
create policy event_summaries_update_organizer on public.event_summaries
  for update to authenticated using (exists (
    select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid()
  )) with check (exists (
    select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid()
  ));
create policy ticket_types_read_organizer on public.ticket_types
  for select to authenticated using (exists (
    select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid()
  ));

create policy artist_products_read_owner on public.artist_products
  for select to authenticated using (artist_id = auth.uid());
create policy artist_products_insert_owner on public.artist_products
  for insert to authenticated with check (
    artist_id = auth.uid() and sales_count = 0 and platform_fee_percent = 5.00
  );
create policy artist_products_update_owner on public.artist_products
  for update to authenticated using (artist_id = auth.uid())
  with check (artist_id = auth.uid() and platform_fee_percent = 5.00);
create policy artist_products_delete_owner on public.artist_products
  for delete to authenticated using (artist_id = auth.uid());

create policy artist_store_orders_read_participant on public.artist_store_orders
  for select to authenticated using (
    buyer_id = auth.uid() or exists (
      select 1 from public.artist_products p where p.id = product_id and p.artist_id = auth.uid()
    )
  );

create or replace function public.create_booking_offer(
  p_card_id uuid, p_event_title text, p_event_date text, p_venue_location text,
  p_client_name text, p_client_contact text, p_offered_budget_minor bigint, p_details text default ''
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_card public.booking_cards%rowtype;
  v_id uuid;
  v_rate numeric(4,2);
  v_fee bigint;
begin
  if v_user is null then raise exception 'Sign in is required'; end if;
  if p_offered_budget_minor <= 0 then raise exception 'Offer amount must be positive'; end if;
  select * into v_card from public.booking_cards where id = p_card_id for share;
  if not found or v_card.artist_id = v_user then raise exception 'Booking card is unavailable'; end if;
  if char_length(trim(coalesce(p_client_name, ''))) not between 1 and 80
    or char_length(trim(coalesce(p_client_contact, ''))) not between 3 and 254
    or char_length(trim(coalesce(p_event_title, ''))) not between 1 and 180
    or char_length(trim(coalesce(p_venue_location, ''))) not between 1 and 200
    or char_length(coalesce(p_details, '')) > 2000 then
    raise exception 'Booking offer details are invalid';
  end if;
  v_rate := case when v_card.is_pro then 0.00 else 0.10 end;
  v_fee := round(p_offered_budget_minor * v_rate)::bigint;
  insert into public.booking_offers (
    card_id, client_id, event_title, event_date, venue_location, client_name,
    client_contact, role_needed, offered_budget_minor, commission_rate,
    commission_minor, artist_payout_minor, details
  ) values (
    v_card.id, v_user, trim(p_event_title), trim(p_event_date), trim(p_venue_location),
    trim(p_client_name), trim(p_client_contact), v_card.role_label,
    p_offered_budget_minor, v_rate, v_fee, p_offered_budget_minor - v_fee, coalesce(p_details, '')
  ) returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.create_booking_offer(uuid,text,text,text,text,text,bigint,text) from public, anon;
grant execute on function public.create_booking_offer(uuid,text,text,text,text,text,bigint,text) to authenticated;

create or replace function public.respond_booking_offer(p_offer_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_status not in ('accepted','declined') then
    raise exception 'Invalid booking offer response';
  end if;
  update public.booking_offers o set status = p_status, updated_at = now()
  where o.id = p_offer_id and o.status = 'pending'
    and exists (select 1 from public.booking_cards c where c.id = o.card_id and c.artist_id = auth.uid());
  if not found then raise exception 'Offer is unavailable or already answered'; end if;
end; $$;
revoke all on function public.respond_booking_offer(uuid,text) from public, anon;
grant execute on function public.respond_booking_offer(uuid,text) to authenticated;

create or replace function public.create_artist_store_order(
  p_product_id uuid, p_buyer_contact text default '', p_shipping_address text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_product public.artist_products%rowtype;
  v_fee bigint;
  v_id uuid;
begin
  if v_user is null then raise exception 'Sign in is required'; end if;
  select * into v_product from public.artist_products where id = p_product_id and is_active for update;
  if not found or v_product.artist_id = v_user then raise exception 'Product is unavailable'; end if;
  if v_product.stock is not null and v_product.stock < 1 then raise exception 'Product is out of stock'; end if;
  if char_length(trim(coalesce(p_buyer_contact, ''))) not between 3 and 254 then
    raise exception 'Buyer contact is required';
  end if;
  if v_product.product_type = 'physical' and nullif(trim(coalesce(p_shipping_address, '')), '') is null then
    raise exception 'Shipping address is required';
  end if;
  if char_length(coalesce(p_shipping_address, '')) > 1000 then
    raise exception 'Shipping address is too long';
  end if;
  v_fee := round(v_product.price_minor * v_product.platform_fee_percent / 100.0)::bigint;
  insert into public.artist_store_orders (
    product_id, buyer_id, price_minor, platform_fee_minor, artist_payout_minor,
    product_type, shipping_address, buyer_contact, status
  ) values (
    v_product.id, v_user, v_product.price_minor, v_fee, v_product.price_minor - v_fee,
    v_product.product_type,
    case when v_product.product_type = 'physical' then trim(p_shipping_address) else null end,
    trim(coalesce(p_buyer_contact, '')), 'pending'
  ) returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.create_artist_store_order(uuid,text,text) from public, anon;
grant execute on function public.create_artist_store_order(uuid,text,text) to authenticated;

create or replace function public.get_organizer_event_metrics(p_event_id uuid)
returns table (
  ticket_capacity bigint, tickets_sold bigint, gross_ticket_revenue_minor bigint,
  average_ticket_price_minor bigint, checked_in_count bigint
) language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.events e where e.id = p_event_id and e.organizer_id = auth.uid()
  ) then raise exception 'Event is unavailable'; end if;
  return query
    select
      coalesce((select sum(t.quantity_total)::bigint from public.ticket_types t where t.event_id = p_event_id), 0),
      coalesce((select sum(t.quantity_sold)::bigint from public.ticket_types t where t.event_id = p_event_id), 0),
      coalesce((select sum(o.total_minor)::bigint from public.orders o where o.event_id = p_event_id and o.status = 'paid'), 0),
      coalesce((select round(sum(oi.unit_price_minor * oi.quantity)::numeric / nullif(sum(oi.quantity), 0))::bigint
        from public.orders o join public.order_items oi on oi.order_id = o.id
        where o.event_id = p_event_id and o.status = 'paid'), 0),
      coalesce((select count(*)::bigint from public.check_ins ci join public.tickets t on t.id = ci.ticket_id
        where t.event_id = p_event_id), 0);
end; $$;
revoke all on function public.get_organizer_event_metrics(uuid) from public, anon;
grant execute on function public.get_organizer_event_metrics(uuid) to authenticated;

commit;
