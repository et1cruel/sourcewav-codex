-- Durable audit trail for each provider request and automatic reservation cleanup.
begin;

create table if not exists public.slip_verification_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  buyer_id uuid not null references public.profiles(user_id) on delete restrict,
  status text not null check (status in ('processing','verified','rejected','error','timeout','quota_exhausted')),
  provider_response_code integer,
  failure_reason text not null default '',
  amount_minor bigint check (amount_minor is null or amount_minor >= 0),
  receiver_verified boolean,
  trans_ref text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists slip_verification_attempts_order_idx
  on public.slip_verification_attempts(order_id, created_at desc);
alter table public.slip_verification_attempts enable row level security;
revoke all on public.slip_verification_attempts from public, anon, authenticated;
grant select, insert, update, delete on public.slip_verification_attempts to service_role;

drop function if exists public.claim_slipok_ticket_verification(uuid,uuid);
create function public.claim_slipok_ticket_verification(p_order uuid, p_buyer uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype; v_attempt uuid;
begin
  select * into v_order from public.orders where id=p_order for update;
  if not found or v_order.buyer_id is distinct from p_buyer then raise exception 'Order details do not match'; end if;
  if v_order.status<>'awaiting_payment' or v_order.expires_at is null or v_order.expires_at<=now() then return null; end if;
  if v_order.slipok_verification_attempts>=5 then return null; end if;
  update public.orders set slipok_verification_attempts=slipok_verification_attempts+1 where id=p_order;
  insert into public.slip_verification_attempts(order_id,buyer_id,status)
    values(p_order,p_buyer,'processing') returning id into v_attempt;
  return v_attempt;
end; $$;
revoke all on function public.claim_slipok_ticket_verification(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_slipok_ticket_verification(uuid,uuid) to service_role;

create or replace function public.finish_slipok_ticket_verification(
  p_attempt uuid,p_status text,p_provider_code integer,p_failure_reason text,
  p_amount_minor bigint,p_receiver_verified boolean,p_trans_ref text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('verified','rejected','error','timeout','quota_exhausted') then raise exception 'Invalid verification status'; end if;
  update public.slip_verification_attempts set status=p_status,
    provider_response_code=p_provider_code,failure_reason=left(coalesce(p_failure_reason,''),300),
    amount_minor=p_amount_minor,receiver_verified=p_receiver_verified,
    trans_ref=case when p_status='verified' then left(p_trans_ref,100) else null end,completed_at=now()
  where id=p_attempt and status='processing';
  if not found then raise exception 'Verification attempt is missing or already completed'; end if;
end; $$;
revoke all on function public.finish_slipok_ticket_verification(uuid,text,integer,text,bigint,boolean,text) from public,anon,authenticated;
grant execute on function public.finish_slipok_ticket_verification(uuid,text,integer,text,bigint,boolean,text) to service_role;

-- Seller reservation window is 15 minutes. This replacement preserves the existing
-- server-side price, inventory, idempotency and seller QR checks.
create or replace function public.reserve_manual_ticket_order(p_buyer uuid, p_type uuid, p_quantity smallint, p_idempotency_key text)
returns table(order_id uuid,event_id uuid,ticket_type_id uuid,quantity integer,unit_price_minor bigint,total_minor bigint,expires_at timestamptz,event_title text,tier_name text,qr_storage_key text,bank_name text,beneficiary_name text,account_last4 text)
language plpgsql security definer set search_path = '' as $$
declare v_type public.ticket_types%rowtype; v_order uuid; v_existing uuid; v_event public.events%rowtype; v_method public.event_payment_methods%rowtype; v_expiry timestamptz := now()+interval '15 minutes';
begin
  if p_quantity<1 or p_quantity>10 then raise exception 'Ticket quantity must be between 1 and 10'; end if;
  if p_idempotency_key !~ '^[0-9a-fA-F-]{36}$' then raise exception 'Invalid checkout key'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key,0));
  select id into v_existing from public.orders where idempotency_key=p_idempotency_key;
  if v_existing is not null then
    return query select o.id,o.event_id,oi.ticket_type_id,oi.quantity::integer,oi.unit_price_minor,o.total_minor,o.expires_at,e.title,tt.name,m.qr_storage_key,m.bank_name,m.beneficiary_name,m.account_last4
      from public.orders o join public.order_items oi on oi.order_id=o.id join public.events e on e.id=o.event_id
      join public.ticket_types tt on tt.id=oi.ticket_type_id join public.event_payment_methods m on m.event_id=o.event_id
      join public.payments p on p.order_id=o.id and p.provider='manual_slipok'
      where o.id=v_existing and o.buyer_id=p_buyer and o.status='awaiting_payment';
    return;
  end if;
  select * into v_type from public.ticket_types where id=p_type for update;
  if not found then raise exception 'Ticket tier not found'; end if;
  select * into v_event from public.events where id=v_type.event_id and status='published' and deleted_at is null;
  if not found or v_event.starts_at<=now() then raise exception 'Event is not available for sale'; end if;
  if v_type.sales_start is not null and v_type.sales_start>now() then raise exception 'Sales have not started'; end if;
  if v_type.sales_end is not null and v_type.sales_end<now() then raise exception 'Sales have ended'; end if;
  select * into v_method from public.event_payment_methods where event_id=v_type.event_id;
  if not found then raise exception 'Event does not have seller payment details'; end if;
  if v_type.quantity_sold+v_type.quantity_reserved+p_quantity>v_type.quantity_total then raise exception 'Not enough tickets remaining'; end if;
  update public.ticket_types set quantity_reserved=quantity_reserved+p_quantity where id=p_type;
  insert into public.orders(buyer_id,event_id,status,currency,subtotal_minor,fee_minor,total_minor,idempotency_key,expires_at)
    values(p_buyer,v_type.event_id,'awaiting_payment',v_type.currency,v_type.price_minor*p_quantity,0,v_type.price_minor*p_quantity,p_idempotency_key,v_expiry) returning id into v_order;
  insert into public.order_items(order_id,ticket_type_id,quantity,unit_price_minor) values(v_order,p_type,p_quantity,v_type.price_minor);
  insert into public.payments(order_id,provider,status,amount_minor,currency) values(v_order,'manual_slipok','pending',v_type.price_minor*p_quantity,v_type.currency);
  return query select v_order,v_type.event_id,p_type,p_quantity::integer,v_type.price_minor,v_type.price_minor*p_quantity,v_expiry,v_event.title,v_type.name,v_method.qr_storage_key,v_method.bank_name,v_method.beneficiary_name,v_method.account_last4;
end; $$;
revoke all on function public.reserve_manual_ticket_order(uuid,uuid,smallint,text) from public,anon,authenticated;
grant execute on function public.reserve_manual_ticket_order(uuid,uuid,smallint,text) to service_role;

-- If the transfer is verified after its reservation expired, retain the audit and
-- flag it for a human. No ticket is issued and no inventory is re-reserved here.
create or replace function public.record_slipok_ticket_submission(
  p_order uuid,p_buyer uuid,p_organizer uuid,p_slip_key text,p_slip_status text,
  p_slip_code integer,p_message text,p_amount_minor bigint,p_trans_ref text,p_result jsonb
) returns text language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype; v_submission uuid; v_expired boolean;
begin
  select * into v_order from public.orders where id=p_order for update;
  if not found or v_order.buyer_id<>p_buyer then raise exception 'Order details do not match'; end if;
  if v_order.status='paid' then return 'already_paid'; end if;
  v_expired:=v_order.status<>'awaiting_payment' or v_order.expires_at is null or v_order.expires_at<now();
  if p_slip_status not in ('verified','rejected','error') then raise exception 'Invalid verification state'; end if;
  if p_slip_key not like p_buyer::text||'/'||p_order::text||'/%' then raise exception 'Slip storage key does not match buyer and order'; end if;
  if p_organizer is distinct from (select e.organizer_id from public.events e where e.id=v_order.event_id) then raise exception 'Organizer does not match order'; end if;
  if p_slip_status='verified' and (p_trans_ref is null or length(p_trans_ref)=0 or length(p_trans_ref)>100 or p_amount_minor is distinct from v_order.total_minor) then raise exception 'SlipOK verification data does not match order'; end if;
  insert into public.ticket_payment_submissions(order_id,event_id,buyer_id,organizer_id,slip_storage_key,slipok_status,slipok_code,slipok_message,slipok_amount_minor,trans_ref,slipok_result)
    values(v_order.id,v_order.event_id,p_buyer,p_organizer,p_slip_key,p_slip_status,p_slip_code,left(coalesce(p_message,''),500),p_amount_minor,case when p_slip_status='verified' then p_trans_ref else null end,coalesce(p_result,'{}'::jsonb)) returning id into v_submission;
  if v_expired and p_slip_status='verified' then
    update public.orders set status='disputed' where id=v_order.id and status in ('awaiting_payment','expired','cancelled');
    update public.payments set status='disputed' where order_id=v_order.id and provider='manual_slipok' and status in ('pending','expired','failed');
    return 'review_required';
  end if;
  if v_expired then return 'expired'; end if;
  return v_submission::text;
end; $$;
revoke all on function public.record_slipok_ticket_submission(uuid,uuid,uuid,text,text,integer,text,bigint,text,jsonb) from public,anon,authenticated;
grant execute on function public.record_slipok_ticket_submission(uuid,uuid,uuid,text,text,integer,text,bigint,text,jsonb) to service_role;

create table if not exists public.admin_ticket_payment_reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.ticket_payment_submissions(id) on delete cascade,
  admin_id uuid not null references public.profiles(user_id) on delete restrict,
  decision text not null check (decision in ('approved','rejected')),
  note text not null default '' check (char_length(note)<=1000),
  created_at timestamptz not null default now()
);
create index if not exists admin_ticket_payment_reviews_submission_idx
  on public.admin_ticket_payment_reviews(submission_id,created_at desc);
alter table public.admin_ticket_payment_reviews enable row level security;
revoke all on public.admin_ticket_payment_reviews from public,anon,authenticated;
grant select,insert,update,delete on public.admin_ticket_payment_reviews to service_role;

create or replace function public.review_slipok_ticket_payment(
  p_submission uuid,p_admin uuid,p_decision text,p_note text,p_ticket_rows jsonb
) returns text language plpgsql security definer set search_path = '' as $$
declare
  v_submission public.ticket_payment_submissions%rowtype;
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
  v_item public.order_items%rowtype;
  v_row jsonb;
  v_stock public.ticket_types%rowtype;
  v_expected integer;
begin
  if p_decision not in ('approved','rejected') then raise exception 'Invalid admin decision'; end if;
  if not exists(select 1 from public.user_roles ur where ur.user_id=p_admin and ur.role='admin') then raise exception 'Not authorized'; end if;
  select * into v_submission from public.ticket_payment_submissions where id=p_submission for update;
  if not found then raise exception 'Submission not found'; end if;
  select * into v_order from public.orders where id=v_submission.order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status='paid' then return 'already_paid'; end if;
  if v_submission.slipok_status<>'verified' or v_submission.trans_ref is null
    or v_submission.slipok_amount_minor is distinct from v_order.total_minor then
    raise exception 'Submission lacks verified payment facts';
  end if;
  if v_order.status<>'disputed' then raise exception 'Order is not awaiting review'; end if;
  select * into v_payment from public.payments where order_id=v_order.id and provider='manual_slipok' for update;
  if not found or v_payment.amount_minor<>v_order.total_minor or v_payment.status<>'disputed' then raise exception 'Payment is not awaiting review'; end if;
  if p_decision='approved' then
    select coalesce(sum(quantity),0)::integer into v_expected from public.order_items where order_id=v_order.id;
    if jsonb_typeof(p_ticket_rows)<>'array' or jsonb_array_length(p_ticket_rows)<>v_expected then raise exception 'Ticket rows do not match order quantity'; end if;
    if exists (
      select 1 from jsonb_array_elements(p_ticket_rows) as r
      where not exists (select 1 from public.order_items oi where oi.id=(r->>'order_item_id')::uuid and oi.order_id=v_order.id and (r->>'ticket_number')::integer between 1 and oi.quantity)
    ) or exists (
      select 1 from jsonb_array_elements(p_ticket_rows) as r group by (r->>'order_item_id')::uuid,(r->>'ticket_number')::integer having count(*)>1
    ) then raise exception 'Ticket rows are invalid'; end if;
    for v_item in select * from public.order_items where order_id=v_order.id order by ticket_type_id loop
      select * into v_stock from public.ticket_types where id=v_item.ticket_type_id for update;
      if not found or v_stock.quantity_sold+v_stock.quantity_reserved+v_item.quantity>v_stock.quantity_total then
        raise exception 'Inventory unavailable; keep payment in review';
      end if;
      update public.ticket_types set quantity_sold=quantity_sold+v_item.quantity where id=v_item.ticket_type_id;
    end loop;
    for v_row in select * from jsonb_array_elements(p_ticket_rows) loop
      insert into public.tickets(id,order_item_id,event_id,owner_id,token_hash,qr_code_hash,ticket_number)
        values((v_row->>'id')::uuid,(v_row->>'order_item_id')::uuid,v_order.event_id,v_order.buyer_id,v_row->>'qr_code_hash',v_row->>'qr_code_hash',(v_row->>'ticket_number')::smallint);
    end loop;
    update public.payments set provider_reference=v_submission.trans_ref,status='succeeded',confirmed_at=now() where id=v_payment.id;
    update public.orders set status='paid' where id=v_order.id;
  end if;
  insert into public.admin_ticket_payment_reviews(submission_id,admin_id,decision,note)
    values(p_submission,p_admin,p_decision,left(coalesce(p_note,''),1000));
  return p_decision;
end; $$;
revoke all on function public.review_slipok_ticket_payment(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.review_slipok_ticket_payment(uuid,uuid,text,text,jsonb) to service_role;

create or replace function public.expire_manual_slipok_orders(p_limit integer default 100)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_order uuid; v_count integer:=0;
begin
  if p_limit<1 or p_limit>1000 then raise exception 'Invalid batch limit'; end if;
  for v_order in
    select o.id from public.orders o join public.payments p on p.order_id=o.id and p.provider='manual_slipok' and p.status='pending'
    where o.status='awaiting_payment' and o.expires_at<=now()
    order by o.expires_at limit p_limit for update of o skip locked
  loop
    perform public.release_ticket_order(v_order,'expired');
    v_count:=v_count+1;
  end loop;
  return v_count;
end; $$;
revoke all on function public.expire_manual_slipok_orders(integer) from public,anon,authenticated;
grant execute on function public.expire_manual_slipok_orders(integer) to service_role;

create extension if not exists pg_cron with schema pg_catalog;
select cron.unschedule(jobid) from cron.job where jobname='expire-manual-slipok-orders';
select cron.schedule('expire-manual-slipok-orders','* * * * *','select public.expire_manual_slipok_orders(100)');

commit;
