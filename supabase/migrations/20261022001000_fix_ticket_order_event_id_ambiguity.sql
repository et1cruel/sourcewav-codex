begin;

create or replace function public.reserve_manual_ticket_order(p_buyer uuid, p_type uuid, p_quantity smallint, p_idempotency_key text)
returns table(order_id uuid,event_id uuid,ticket_type_id uuid,quantity integer,unit_price_minor bigint,total_minor bigint,expires_at timestamptz,event_title text,tier_name text,qr_storage_key text,bank_name text,beneficiary_name text,account_last4 text)
language plpgsql security definer set search_path = '' as $$
declare
  v_type public.ticket_types%rowtype;
  v_order uuid;
  v_existing uuid;
  v_event public.events%rowtype;
  v_method public.event_payment_methods%rowtype;
  v_expiry timestamptz := now()+interval '15 minutes';
begin
  if p_quantity<1 or p_quantity>10 then raise exception 'Ticket quantity must be between 1 and 10'; end if;
  if p_idempotency_key !~ '^[0-9a-fA-F-]{36}$' then raise exception 'Invalid checkout key'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key,0));
  select o.id into v_existing from public.orders o where o.idempotency_key=p_idempotency_key;
  if v_existing is not null then
    return query select o.id,o.event_id,oi.ticket_type_id,oi.quantity::integer,oi.unit_price_minor,o.total_minor,o.expires_at,e.title,tt.name,m.qr_storage_key,m.bank_name,m.beneficiary_name,m.account_last4
      from public.orders o
      join public.order_items oi on oi.order_id=o.id
      join public.events e on e.id=o.event_id
      join public.ticket_types tt on tt.id=oi.ticket_type_id
      join public.event_payment_methods m on m.event_id=o.event_id
      join public.payments p on p.order_id=o.id and p.provider='manual_slipok'
      where o.id=v_existing and o.buyer_id=p_buyer and o.status='awaiting_payment';
    return;
  end if;

  select tt.* into v_type from public.ticket_types tt where tt.id=p_type for update;
  if not found then raise exception 'Ticket tier not found'; end if;
  select e.* into v_event from public.events e where e.id=v_type.event_id and e.status='published' and e.deleted_at is null;
  if not found or v_event.starts_at<=now() then raise exception 'Event is not available for sale'; end if;
  if v_type.sales_start is not null and v_type.sales_start>now() then raise exception 'Sales have not started'; end if;
  if v_type.sales_end is not null and v_type.sales_end<now() then raise exception 'Sales have ended'; end if;
  select m.* into v_method from public.event_payment_methods m where m.event_id=v_type.event_id;
  if not found then raise exception 'Event does not have seller payment details'; end if;
  if v_type.quantity_sold+v_type.quantity_reserved+p_quantity>v_type.quantity_total then raise exception 'Not enough tickets remaining'; end if;

  update public.ticket_types tt set quantity_reserved=tt.quantity_reserved+p_quantity where tt.id=p_type;
  insert into public.orders(buyer_id,event_id,status,currency,subtotal_minor,fee_minor,total_minor,idempotency_key,expires_at)
    values(p_buyer,v_type.event_id,'awaiting_payment',v_type.currency,v_type.price_minor*p_quantity,0,v_type.price_minor*p_quantity,p_idempotency_key,v_expiry) returning id into v_order;
  insert into public.order_items(order_id,ticket_type_id,quantity,unit_price_minor) values(v_order,p_type,p_quantity,v_type.price_minor);
  insert into public.payments(order_id,provider,status,amount_minor,currency) values(v_order,'manual_slipok','pending',v_type.price_minor*p_quantity,v_type.currency);
  return query select v_order,v_type.event_id,p_type,p_quantity::integer,v_type.price_minor,v_type.price_minor*p_quantity,v_expiry,v_event.title,v_type.name,v_method.qr_storage_key,v_method.bank_name,v_method.beneficiary_name,v_method.account_last4;
end;
$$;

revoke all on function public.reserve_manual_ticket_order(uuid,uuid,smallint,text) from public,anon,authenticated;
grant execute on function public.reserve_manual_ticket_order(uuid,uuid,smallint,text) to service_role;

commit;
