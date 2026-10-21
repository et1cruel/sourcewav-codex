-- Live community primitives and transactional ticket inventory.
begin;

-- An order holds inventory while a PromptPay payment is pending.
alter table public.ticket_types add column if not exists quantity_reserved integer not null default 0;
alter table public.ticket_types add constraint ticket_types_reserved_range
  check (quantity_reserved >= 0 and quantity_sold + quantity_reserved <= quantity_total);
alter table public.tickets add column if not exists qr_code_hash text unique;
alter table public.tickets add column if not exists ticket_number smallint not null default 1;
alter table public.tickets add constraint tickets_order_number_unique unique (order_item_id, ticket_number);
alter table public.payments add column if not exists provider_payload jsonb not null default '{}'::jsonb;
alter table public.events add column if not exists venue_name text not null default '';
alter table public.events add column if not exists venue_address text not null default '';

create or replace function public.start_direct_conversation(p_other_user uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_id uuid; v_first uuid; v_second uuid;
begin
  if v_me is null or p_other_user is null or p_other_user = v_me then
    raise exception 'A signed-in user and another user are required';
  end if;
  if exists(select 1 from public.blocks where (blocker_id=v_me and blocked_id=p_other_user) or (blocker_id=p_other_user and blocked_id=v_me)) then
    raise exception 'Conversation is unavailable';
  end if;
  v_first := least(v_me, p_other_user); v_second := greatest(v_me, p_other_user);
  perform pg_advisory_xact_lock(hashtextextended(v_first::text || v_second::text, 0));
  select c.id into v_id from public.conversations c
  join public.conversation_members a on a.conversation_id=c.id and a.user_id=v_first
  join public.conversation_members b on b.conversation_id=c.id and b.user_id=v_second
  where c.kind='direct' and (select count(*) from public.conversation_members m where m.conversation_id=c.id)=2
  limit 1;
  if v_id is not null then return v_id; end if;
  insert into public.conversations(kind,created_by) values('direct',v_me) returning id into v_id;
  insert into public.conversation_members(conversation_id,user_id) values(v_id,v_first),(v_id,v_second);
  return v_id;
end; $$;
revoke all on function public.start_direct_conversation(uuid) from public,anon;
grant execute on function public.start_direct_conversation(uuid) to authenticated;

-- Only trusted Edge Functions may reserve, settle, or validate paid tickets.
create function public.reserve_ticket_order(p_buyer uuid,p_type uuid,p_quantity smallint,p_idempotency_key text)
returns table(order_id uuid,event_id uuid,ticket_type_id uuid,quantity integer,unit_price_minor bigint,total_minor bigint,expires_at timestamptz,event_title text,tier_name text)
language plpgsql security definer set search_path = '' as $$
declare v_type public.ticket_types%rowtype; v_order uuid; v_existing uuid; v_event public.events%rowtype; v_expiry timestamptz := now()+interval '24 hours';
begin
  if p_quantity < 1 or p_quantity > 10 then raise exception 'Ticket quantity must be between 1 and 10'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));
  select id into v_existing from public.orders where idempotency_key=p_idempotency_key;
  if v_existing is not null then
    return query select o.id,o.event_id,oi.ticket_type_id,oi.quantity::integer,oi.unit_price_minor,o.total_minor,o.expires_at,e.title,tt.name
      from public.orders o join public.order_items oi on oi.order_id=o.id join public.events e on e.id=o.event_id join public.ticket_types tt on tt.id=oi.ticket_type_id where o.id=v_existing;
    return;
  end if;
  select * into v_type from public.ticket_types where id=p_type for update;
  if not found then raise exception 'Ticket tier not found'; end if;
  select * into v_event from public.events where id=v_type.event_id and status='published' and deleted_at is null;
  if not found or v_event.starts_at <= now() then raise exception 'Event is not available for sale'; end if;
  if v_type.sales_start is not null and v_type.sales_start>now() then raise exception 'Sales have not started'; end if;
  if v_type.sales_end is not null and v_type.sales_end<now() then raise exception 'Sales have ended'; end if;
  if v_type.quantity_sold+v_type.quantity_reserved+p_quantity>v_type.quantity_total then raise exception 'Not enough tickets remaining'; end if;
  update public.ticket_types set quantity_reserved=quantity_reserved+p_quantity where id=p_type;
  insert into public.orders(buyer_id,event_id,status,currency,subtotal_minor,fee_minor,total_minor,idempotency_key,expires_at)
    values(p_buyer,v_type.event_id,'awaiting_payment',v_type.currency,v_type.price_minor*p_quantity,0,v_type.price_minor*p_quantity,p_idempotency_key,v_expiry) returning id into v_order;
  insert into public.order_items(order_id,ticket_type_id,quantity,unit_price_minor) values(v_order,p_type,p_quantity,v_type.price_minor);
  insert into public.payments(order_id,provider,status,amount_minor,currency) values(v_order,'omise','pending',v_type.price_minor*p_quantity,v_type.currency);
  return query select v_order,v_type.event_id,p_type,p_quantity::integer,v_type.price_minor,v_type.price_minor*p_quantity,v_expiry,v_event.title,v_type.name;
end; $$;
revoke all on function public.reserve_ticket_order(uuid,uuid,smallint,text) from public,anon,authenticated;
grant execute on function public.reserve_ticket_order(uuid,uuid,smallint,text) to service_role;

create function public.release_ticket_order(p_order uuid,p_status text default 'expired')
returns void language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype; v_item public.order_items%rowtype;
begin
  select * into v_order from public.orders where id=p_order for update;
  if not found or v_order.status not in ('awaiting_payment','pending') then return; end if;
  for v_item in select * from public.order_items where order_id=p_order loop
    update public.ticket_types set quantity_reserved=greatest(0,quantity_reserved-v_item.quantity) where id=v_item.ticket_type_id;
  end loop;
  update public.orders set status=p_status where id=p_order;
  update public.payments set status=case when p_status='expired' then 'expired' else 'failed' end where order_id=p_order and status='pending';
end; $$;
revoke all on function public.release_ticket_order(uuid,text) from public,anon,authenticated;
grant execute on function public.release_ticket_order(uuid,text) to service_role;

create function public.complete_ticket_order(p_order uuid,p_charge_id text,p_charge_amount bigint,p_ticket_rows jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype; v_item public.order_items%rowtype; v_row jsonb;
begin
  select * into v_order from public.orders where id=p_order for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status='paid' then return; end if;
  if v_order.status not in ('awaiting_payment','pending') or v_order.expires_at<now() then raise exception 'Order is not payable'; end if;
  if v_order.total_minor<>p_charge_amount then raise exception 'Charge amount does not match order'; end if;
  update public.payments set provider_reference=p_charge_id,status='succeeded',confirmed_at=now()
    where order_id=p_order and provider='omise';
  for v_item in select * from public.order_items where order_id=p_order loop
    update public.ticket_types set quantity_reserved=greatest(0,quantity_reserved-v_item.quantity),quantity_sold=quantity_sold+v_item.quantity where id=v_item.ticket_type_id;
  end loop;
  for v_row in select * from jsonb_array_elements(p_ticket_rows) loop
    insert into public.tickets(id,order_item_id,event_id,owner_id,token_hash,qr_code_hash,ticket_number)
      values((v_row->>'id')::uuid,(v_row->>'order_item_id')::uuid,v_order.event_id,v_order.buyer_id,v_row->>'qr_code_hash',v_row->>'qr_code_hash',(v_row->>'ticket_number')::smallint)
      on conflict (order_item_id,ticket_number) do nothing;
  end loop;
  update public.orders set status='paid' where id=p_order;
end; $$;
revoke all on function public.complete_ticket_order(uuid,text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.complete_ticket_order(uuid,text,bigint,jsonb) to service_role;

-- Atomic one-use gate validation, scoped to the event organizer.
create function public.validate_ticket_once(p_ticket_id uuid,p_qr_hash text,p_scanner uuid)
returns table(result text,event_title text,ticket_id uuid)
language plpgsql security definer set search_path = '' as $$
declare v_ticket public.tickets%rowtype; v_event public.events%rowtype;
begin
  select t.* into v_ticket from public.tickets t where t.id=p_ticket_id and t.qr_code_hash=p_qr_hash for update;
  if not found then return query select 'invalid'::text,null::text,p_ticket_id; return; end if;
  select e.* into v_event from public.events e where e.id=v_ticket.event_id;
  if not (v_event.organizer_id=p_scanner or exists(select 1 from public.profiles p where p.user_id=p_scanner and p.roles && array['organizer','admin'])) then
    raise exception 'Not authorized to check in this event';
  end if;
  if v_ticket.status<>'valid' then return query select 'already_used'::text,v_event.title,v_ticket.id; return; end if;
  update public.tickets set status='checked_in',checked_in_at=now() where id=v_ticket.id and status='valid';
  insert into public.check_ins(ticket_id,checked_by) values(v_ticket.id,p_scanner) on conflict(ticket_id) do nothing;
  return query select 'accepted'::text,v_event.title,v_ticket.id;
end; $$;
revoke all on function public.validate_ticket_once(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.validate_ticket_once(uuid,text,uuid) to service_role;

-- Ensure live data can be subscribed to by the client.
do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='posts') then alter publication supabase_realtime add table public.posts; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then alter publication supabase_realtime add table public.messages; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='listings') then alter publication supabase_realtime add table public.listings; end if;
end $$;

commit;
