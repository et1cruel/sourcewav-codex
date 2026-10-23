-- Preserve the payee and payment credentials that were shown when a buyer reserved stock.
-- Also serialize SlipOK attempts per order so parallel browser submissions cannot spend quota.
begin;

alter table public.events
  add column if not exists refund_policy text not null default 'ยังไม่ได้ระบุเงื่อนไขโดยละเอียด กรุณาติดต่อผู้จัดงานก่อนชำระเงิน';

alter table public.orders
  add column if not exists organizer_id_snapshot uuid references public.profiles(user_id) on delete restrict,
  add column if not exists event_title_snapshot text,
  add column if not exists event_starts_at_snapshot timestamptz,
  add column if not exists event_ends_at_snapshot timestamptz,
  add column if not exists event_venue_name_snapshot text,
  add column if not exists event_venue_address_snapshot text,
  add column if not exists organizer_name_snapshot text,
  add column if not exists payment_qr_storage_key_snapshot text,
  add column if not exists payment_bank_name_snapshot text,
  add column if not exists payment_beneficiary_name_snapshot text,
  add column if not exists payment_account_last4_snapshot text,
  add column if not exists slipok_branch_id_snapshot text,
  add column if not exists slipok_api_key_ciphertext_snapshot text,
  add column if not exists refund_policy_snapshot text,
  add column if not exists payment_snapshot_at timestamptz;

-- Orders now contain encrypted seller credentials for the exact payment QR shown.
-- Keep buyer access behind the authenticated my-orders Edge Function so ciphertext
-- and internal payment fields are never exposed by a direct table query.
revoke all on public.orders from anon, authenticated;

-- Existing orders can only be backfilled from the seller's current settings. New orders
-- always capture these values atomically with the stock reservation below.
update public.orders o
set organizer_id_snapshot = m.organizer_id,
    organizer_name_snapshot = (select p.display_name from public.profiles p where p.user_id=m.organizer_id),
    payment_qr_storage_key_snapshot = m.qr_storage_key,
    payment_bank_name_snapshot = m.bank_name,
    payment_beneficiary_name_snapshot = m.beneficiary_name,
    payment_account_last4_snapshot = m.account_last4,
    slipok_branch_id_snapshot = m.slipok_branch_id,
    slipok_api_key_ciphertext_snapshot = m.slipok_api_key_ciphertext,
    payment_snapshot_at = coalesce(o.payment_snapshot_at, o.created_at)
from public.event_payment_methods m
where m.event_id = o.event_id and o.payment_snapshot_at is null;

update public.orders o
set refund_policy_snapshot = e.refund_policy
from public.events e
where e.id = o.event_id and o.refund_policy_snapshot is null;

update public.orders o
set event_title_snapshot = coalesce(o.event_title_snapshot,e.title),
    event_starts_at_snapshot = coalesce(o.event_starts_at_snapshot,e.starts_at),
    event_ends_at_snapshot = coalesce(o.event_ends_at_snapshot,e.ends_at),
    event_venue_name_snapshot = coalesce(o.event_venue_name_snapshot,e.venue_name),
    event_venue_address_snapshot = coalesce(o.event_venue_address_snapshot,e.venue_address)
from public.events e
where e.id = o.event_id and o.event_title_snapshot is null;

drop function if exists public.reserve_manual_ticket_order(uuid,uuid,smallint,text);
create function public.reserve_manual_ticket_order(
  p_buyer uuid, p_type uuid, p_quantity smallint, p_idempotency_key text
)
returns table(
  order_id uuid,event_id uuid,ticket_type_id uuid,quantity integer,
  unit_price_minor bigint,total_minor bigint,expires_at timestamptz,
  event_title text,tier_name text,qr_storage_key text,bank_name text,
  beneficiary_name text,account_last4 text,organizer_name text,refund_policy text,
  event_starts_at timestamptz,event_ends_at timestamptz,venue_name text,venue_address text
)
language plpgsql security definer set search_path = '' as $$
declare
  v_type public.ticket_types%rowtype;
  v_order uuid;
  v_existing uuid;
  v_event public.events%rowtype;
  v_method public.event_payment_methods%rowtype;
  v_organizer_name text;
  v_expiry timestamptz := now() + interval '15 minutes';
begin
  if p_quantity < 1 or p_quantity > 10 then raise exception 'Ticket quantity must be between 1 and 10'; end if;
  if p_idempotency_key !~ '^[0-9a-fA-F-]{36}$' then raise exception 'Invalid checkout key'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));

  select o.id into v_existing from public.orders o where o.idempotency_key = p_idempotency_key;
  if v_existing is not null then
    return query
      select o.id,o.event_id,oi.ticket_type_id,oi.quantity::integer,oi.unit_price_minor,
        o.total_minor,o.expires_at,coalesce(o.event_title_snapshot,e.title),tt.name,o.payment_qr_storage_key_snapshot,
        o.payment_bank_name_snapshot,o.payment_beneficiary_name_snapshot,o.payment_account_last4_snapshot,o.organizer_name_snapshot,o.refund_policy_snapshot,
        o.event_starts_at_snapshot,o.event_ends_at_snapshot,o.event_venue_name_snapshot,o.event_venue_address_snapshot
      from public.orders o
      join public.order_items oi on oi.order_id = o.id
      join public.events e on e.id = o.event_id
      join public.ticket_types tt on tt.id = oi.ticket_type_id
      join public.payments p on p.order_id = o.id and p.provider = 'manual_slipok'
      where o.id = v_existing and o.buyer_id = p_buyer and o.status = 'awaiting_payment';
    return;
  end if;

  select * into v_type from public.ticket_types where id = p_type for update;
  if not found then raise exception 'Ticket tier not found'; end if;
  select * into v_event from public.events
    where id = v_type.event_id and status = 'published' and deleted_at is null;
  if not found or v_event.starts_at <= now() then raise exception 'Event is not available for sale'; end if;
  if v_type.sales_start is not null and v_type.sales_start > now() then raise exception 'Sales have not started'; end if;
  if v_type.sales_end is not null and v_type.sales_end < now() then raise exception 'Sales have ended'; end if;
  select * into v_method from public.event_payment_methods m where m.event_id = v_type.event_id;
  if not found then raise exception 'Event does not have seller payment details'; end if;
  select p.display_name into v_organizer_name from public.profiles p where p.user_id = v_method.organizer_id;
  if v_type.quantity_sold + v_type.quantity_reserved + p_quantity > v_type.quantity_total then
    raise exception 'Not enough tickets remaining';
  end if;

  update public.ticket_types set quantity_reserved = quantity_reserved + p_quantity where id = p_type;
  insert into public.orders(
    buyer_id,event_id,status,currency,subtotal_minor,fee_minor,total_minor,idempotency_key,expires_at,
    event_title_snapshot,event_starts_at_snapshot,event_ends_at_snapshot,event_venue_name_snapshot,event_venue_address_snapshot,
    organizer_id_snapshot,organizer_name_snapshot,payment_qr_storage_key_snapshot,payment_bank_name_snapshot,
    payment_beneficiary_name_snapshot,payment_account_last4_snapshot,refund_policy_snapshot,
    slipok_branch_id_snapshot,slipok_api_key_ciphertext_snapshot,payment_snapshot_at
  ) values (
    p_buyer,v_type.event_id,'awaiting_payment',v_type.currency,v_type.price_minor*p_quantity,0,
    v_type.price_minor*p_quantity,p_idempotency_key,v_expiry,v_event.title,v_event.starts_at,v_event.ends_at,v_event.venue_name,v_event.venue_address,
    v_method.organizer_id,v_organizer_name,
    v_method.qr_storage_key,v_method.bank_name,v_method.beneficiary_name,v_method.account_last4,
    v_event.refund_policy,v_method.slipok_branch_id,v_method.slipok_api_key_ciphertext,now()
  ) returning id into v_order;
  insert into public.order_items(order_id,ticket_type_id,quantity,unit_price_minor)
    values(v_order,p_type,p_quantity,v_type.price_minor);
  insert into public.payments(order_id,provider,status,amount_minor,currency)
    values(v_order,'manual_slipok','pending',v_type.price_minor*p_quantity,v_type.currency);

  return query select v_order,v_type.event_id,p_type,p_quantity::integer,v_type.price_minor,
    v_type.price_minor*p_quantity,v_expiry,v_event.title,v_type.name,v_method.qr_storage_key,
    v_method.bank_name,v_method.beneficiary_name,v_method.account_last4,v_organizer_name,v_event.refund_policy,
    v_event.starts_at,v_event.ends_at,v_event.venue_name,v_event.venue_address;
end;
$$;
revoke all on function public.reserve_manual_ticket_order(uuid,uuid,smallint,text) from public,anon,authenticated;
grant execute on function public.reserve_manual_ticket_order(uuid,uuid,smallint,text) to service_role;

drop function if exists public.claim_slipok_ticket_verification(uuid,uuid);
create function public.claim_slipok_ticket_verification(p_order uuid,p_buyer uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype; v_attempt uuid;
begin
  select * into v_order from public.orders where id = p_order for update;
  if not found or v_order.buyer_id is distinct from p_buyer then raise exception 'Order details do not match'; end if;
  if v_order.status not in ('awaiting_payment','expired') or v_order.expires_at is null then return ''; end if;
  if v_order.status='awaiting_payment' and v_order.expires_at <= now() then return ''; end if;
  if v_order.slipok_verification_attempts >= 5 then return ''; end if;
  if exists (
    select 1 from public.slip_verification_attempts a
    where a.order_id = p_order and a.status = 'processing'
      and a.created_at > now() - interval '2 minutes'
  ) then return 'processing'; end if;
  update public.orders set slipok_verification_attempts = slipok_verification_attempts + 1 where id = p_order;
  insert into public.slip_verification_attempts(order_id,buyer_id,status)
    values(p_order,p_buyer,'processing') returning id into v_attempt;
  return v_attempt::text;
end;
$$;
revoke all on function public.claim_slipok_ticket_verification(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_slipok_ticket_verification(uuid,uuid) to service_role;

alter table public.slip_verification_attempts add column if not exists slip_storage_key text;
alter table public.slip_verification_attempts add column if not exists transfer_timestamp timestamptz;
alter table public.ticket_payment_submissions add column if not exists transfer_timestamp timestamptz;

drop function if exists public.finish_slipok_ticket_verification_with_slip(uuid,text,integer,text,bigint,boolean,text,text);
create function public.finish_slipok_ticket_verification_with_slip(
  p_attempt uuid,p_status text,p_provider_code integer,p_failure_reason text,
  p_amount_minor bigint,p_receiver_verified boolean,p_trans_ref text,p_transfer_at timestamptz,p_slip_key text
) returns void language plpgsql security definer set search_path = '' as $$
declare v_order uuid;
  v_buyer uuid;
begin
  if p_status not in ('verified','rejected','error','timeout','quota_exhausted') then raise exception 'Invalid verification status'; end if;
  select order_id,buyer_id into v_order,v_buyer from public.slip_verification_attempts
    where id=p_attempt and status='processing';
  if not found then raise exception 'Verification attempt is missing or already completed'; end if;
  if p_slip_key is null or p_slip_key not like v_buyer::text||'/'||v_order::text||'/%' then
    raise exception 'Slip storage key does not match buyer and order';
  end if;
  update public.slip_verification_attempts set status=p_status,
    provider_response_code=p_provider_code,failure_reason=left(coalesce(p_failure_reason,''),300),
    amount_minor=p_amount_minor,receiver_verified=p_receiver_verified,
    trans_ref=case when p_status='verified' then left(p_trans_ref,100) else null end,
    transfer_timestamp=case when p_status='verified' then p_transfer_at else null end,
    slip_storage_key=p_slip_key,completed_at=now()
  where id=p_attempt and status='processing'
  returning order_id into v_order;
  if not found then raise exception 'Verification attempt is missing or already completed'; end if;
  if p_status='error' and (p_provider_code in (1001,1002) or p_failure_reason='invalid_slipok_credentials') then
    update public.orders set slipok_verification_attempts=greatest(0,slipok_verification_attempts-1)
      where id=v_order and status in ('awaiting_payment','expired');
  end if;
end;
$$;
revoke all on function public.finish_slipok_ticket_verification_with_slip(uuid,text,integer,text,bigint,boolean,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.finish_slipok_ticket_verification_with_slip(uuid,text,integer,text,bigint,boolean,text,timestamptz,text) to service_role;

create or replace function public.recover_slipok_ticket_submission(p_attempt uuid,p_buyer uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_attempt public.slip_verification_attempts%rowtype;
  v_order public.orders%rowtype;
  v_existing public.ticket_payment_submissions%rowtype;
  v_item public.order_items%rowtype;
  v_late boolean;
  v_submission uuid;
begin
  select * into v_attempt from public.slip_verification_attempts where id=p_attempt for update;
  if not found or v_attempt.buyer_id<>p_buyer then raise exception 'Verification attempt does not match buyer'; end if;
  if v_attempt.status<>'verified' or v_attempt.trans_ref is null or v_attempt.slip_storage_key is null
    or v_attempt.receiver_verified is distinct from true then raise exception 'Verified payment facts are missing'; end if;
  select * into v_order from public.orders where id=v_attempt.order_id for update;
  if not found or v_order.buyer_id<>p_buyer then raise exception 'Order details do not match'; end if;
  if v_order.status='paid' then return 'already_paid'; end if;
  if v_attempt.amount_minor is distinct from v_order.total_minor
    or v_attempt.slip_storage_key not like p_buyer::text||'/'||v_order.id::text||'/%' then raise exception 'Verified payment does not match order'; end if;
  select * into v_existing from public.ticket_payment_submissions
    where trans_ref=v_attempt.trans_ref or slip_storage_key=v_attempt.slip_storage_key limit 1;
  if found then
    if v_existing.order_id=v_order.id and v_existing.slipok_status='verified' then return v_existing.id::text; end if;
    if v_order.status='awaiting_payment' then
      for v_item in select * from public.order_items where order_id=v_order.id loop
        update public.ticket_types set quantity_reserved=greatest(0,quantity_reserved-v_item.quantity) where id=v_item.ticket_type_id;
      end loop;
    end if;
    update public.orders set status='disputed' where id=v_order.id and status in ('awaiting_payment','expired','cancelled');
    update public.payments set status='disputed' where order_id=v_order.id and provider='manual_slipok' and status in ('pending','expired','failed');
    update public.slip_verification_attempts set status='error',failure_reason='duplicate_transaction_reference' where id=p_attempt;
    if v_order.organizer_id_snapshot is null then raise exception 'Order payment recipient snapshot is missing'; end if;
    insert into public.ticket_payment_submissions(
      order_id,event_id,buyer_id,organizer_id,slip_storage_key,slipok_status,slipok_code,
      slipok_message,slipok_amount_minor,trans_ref,transfer_timestamp,slipok_result
    ) values (
      v_order.id,v_order.event_id,p_buyer,v_order.organizer_id_snapshot,v_attempt.slip_storage_key,
      'error',v_attempt.provider_response_code,'เลขอ้างอิงธุรกรรมนี้ถูกใช้กับคำสั่งซื้ออื่นแล้ว',
      v_attempt.amount_minor,null,v_attempt.transfer_timestamp,jsonb_build_object('success',false,'failureReason','duplicate_transaction_reference',
        'duplicateTransRef',v_attempt.trans_ref,'amount',v_attempt.amount_minor,'receiverVerified',v_attempt.receiver_verified)
    );
    return 'duplicate_transaction';
  end if;
  if p_buyer is distinct from v_order.buyer_id then raise exception 'Order details do not match'; end if;
  if v_order.organizer_id_snapshot is null then raise exception 'Order payment recipient snapshot is missing'; end if;

  insert into public.ticket_payment_submissions(
    order_id,event_id,buyer_id,organizer_id,slip_storage_key,slipok_status,slipok_code,
    slipok_message,slipok_amount_minor,trans_ref,transfer_timestamp,slipok_result
  ) values (
    v_order.id,v_order.event_id,p_buyer,v_order.organizer_id_snapshot,v_attempt.slip_storage_key,
    'verified',v_attempt.provider_response_code,'SlipOK verified; order recovery',v_attempt.amount_minor,
    v_attempt.trans_ref,v_attempt.transfer_timestamp,jsonb_build_object('success',true,'slipSuccess',true,'transRef',v_attempt.trans_ref,
      'amount',v_attempt.amount_minor,'receiverVerified',v_attempt.receiver_verified)
  ) returning id into v_submission;

  v_late := v_order.status in ('expired','cancelled','disputed') or v_order.expires_at is null or v_order.expires_at<=now()
    or v_attempt.transfer_timestamp is null or v_attempt.transfer_timestamp<v_order.created_at
    or v_attempt.transfer_timestamp>v_order.expires_at;
  if v_late then
    if v_order.status='awaiting_payment' then
      for v_item in select * from public.order_items where order_id=v_order.id loop
        update public.ticket_types set quantity_reserved=greatest(0,quantity_reserved-v_item.quantity) where id=v_item.ticket_type_id;
      end loop;
    end if;
    update public.orders set status='disputed' where id=v_order.id and status in ('awaiting_payment','expired','cancelled');
    update public.payments set status='disputed' where order_id=v_order.id and provider='manual_slipok' and status in ('pending','expired','failed');
    return 'review_required';
  end if;
  return v_submission::text;
end;
$$;
revoke all on function public.recover_slipok_ticket_submission(uuid,uuid) from public,anon,authenticated;
grant execute on function public.recover_slipok_ticket_submission(uuid,uuid) to service_role;

-- A late verified slip can arrive before the cron expiry worker. Release its held
-- inventory in the same transaction when converting the order to disputed.
drop function if exists public.record_slipok_ticket_submission(uuid,uuid,uuid,text,text,integer,text,bigint,text,jsonb);
create function public.record_slipok_ticket_submission(
  p_order uuid,p_buyer uuid,p_organizer uuid,p_slip_key text,p_slip_status text,
  p_slip_code integer,p_message text,p_amount_minor bigint,p_trans_ref text,
  p_transfer_at timestamptz,p_result jsonb
) returns text language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_submission uuid;
  v_item public.order_items%rowtype;
  v_late_payment boolean;
begin
  select * into v_order from public.orders where id=p_order for update;
  if not found or v_order.buyer_id<>p_buyer then raise exception 'Order details do not match'; end if;
  if v_order.status='paid' then return 'already_paid'; end if;
  if p_slip_status not in ('verified','rejected','error') then raise exception 'Invalid verification state'; end if;
  if p_slip_key not like p_buyer::text||'/'||p_order::text||'/%' then raise exception 'Slip storage key does not match buyer and order'; end if;
  if p_organizer is distinct from coalesce(v_order.organizer_id_snapshot,(select e.organizer_id from public.events e where e.id=v_order.event_id)) then raise exception 'Organizer does not match order'; end if;
  if p_slip_status='verified' and (p_trans_ref is null or length(p_trans_ref)=0 or length(p_trans_ref)>100 or p_amount_minor is distinct from v_order.total_minor or p_transfer_at is null) then raise exception 'SlipOK verification data does not match order'; end if;

  v_late_payment := p_slip_status='verified' and (
    v_order.status in ('expired','cancelled','disputed') or v_order.expires_at is null or v_order.expires_at<=now()
    or p_transfer_at<v_order.created_at or p_transfer_at>v_order.expires_at
  );
  insert into public.ticket_payment_submissions(
    order_id,event_id,buyer_id,organizer_id,slip_storage_key,slipok_status,slipok_code,
    slipok_message,slipok_amount_minor,trans_ref,transfer_timestamp,slipok_result
  ) values (
    v_order.id,v_order.event_id,p_buyer,p_organizer,p_slip_key,p_slip_status,p_slip_code,
    left(coalesce(p_message,''),500),p_amount_minor,
    case when p_slip_status='verified' then p_trans_ref else null end,
    case when p_slip_status='verified' then p_transfer_at else null end,coalesce(p_result,'{}'::jsonb)
  ) returning id into v_submission;

  if v_late_payment then
    if v_order.status='awaiting_payment' then
      for v_item in select * from public.order_items where order_id=v_order.id loop
        update public.ticket_types set quantity_reserved=greatest(0,quantity_reserved-v_item.quantity)
          where id=v_item.ticket_type_id;
      end loop;
    end if;
    update public.orders set status='disputed' where id=v_order.id and status in ('awaiting_payment','expired','cancelled');
    update public.payments set status='disputed' where order_id=v_order.id and provider='manual_slipok' and status in ('pending','expired','failed');
    return 'review_required';
  end if;
  if v_order.status<>'awaiting_payment' then return 'expired'; end if;
  return v_submission::text;
end;
$$;
revoke all on function public.record_slipok_ticket_submission(uuid,uuid,uuid,text,text,integer,text,bigint,text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.record_slipok_ticket_submission(uuid,uuid,uuid,text,text,integer,text,bigint,text,timestamptz,jsonb) to service_role;

-- A verified QR without an in-window provider timestamp cannot be auto-issued.
create or replace function public.issue_slipok_ticket_order(p_submission uuid,p_buyer uuid,p_ticket_rows jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_submission public.ticket_payment_submissions%rowtype;
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
  v_item public.order_items%rowtype;
  v_row jsonb;
  v_expected integer;
begin
  select * into v_submission from public.ticket_payment_submissions where id=p_submission for update;
  if not found or v_submission.buyer_id<>p_buyer then raise exception 'Slip submission does not match buyer'; end if;
  if v_submission.slipok_status<>'verified' or v_submission.trans_ref is null then raise exception 'SlipOK has not verified this slip'; end if;
  select * into v_order from public.orders where id=v_submission.order_id for update;
  if not found or v_order.buyer_id<>p_buyer or v_order.event_id<>v_submission.event_id then raise exception 'Order details do not match'; end if;
  if v_order.status='paid' then return 'already_paid'; end if;

  if v_submission.transfer_timestamp is null or v_order.expires_at is null
    or v_submission.transfer_timestamp<v_order.created_at or v_submission.transfer_timestamp>v_order.expires_at then
    if v_order.status='awaiting_payment' then
      for v_item in select * from public.order_items where order_id=v_order.id loop
        update public.ticket_types set quantity_reserved=greatest(0,quantity_reserved-v_item.quantity) where id=v_item.ticket_type_id;
      end loop;
    end if;
    update public.orders set status='disputed' where id=v_order.id and status in ('awaiting_payment','expired','cancelled');
    update public.payments set status='disputed' where order_id=v_order.id and provider='manual_slipok' and status in ('pending','expired','failed');
    return 'review_required';
  end if;
  if v_order.status='awaiting_payment' and v_order.expires_at<=now() then
    for v_item in select * from public.order_items where order_id=v_order.id loop
      update public.ticket_types set quantity_reserved=greatest(0,quantity_reserved-v_item.quantity) where id=v_item.ticket_type_id;
    end loop;
    update public.orders set status='disputed' where id=v_order.id;
    update public.payments set status='disputed' where order_id=v_order.id and provider='manual_slipok' and status in ('pending','expired','failed');
    return 'review_required';
  end if;
  if v_order.status='expired' then
    update public.orders set status='disputed' where id=v_order.id;
    update public.payments set status='disputed' where order_id=v_order.id and provider='manual_slipok' and status in ('pending','expired','failed');
    return 'review_required';
  end if;
  if v_order.status='disputed' then return 'review_required'; end if;
  if v_order.status<>'awaiting_payment' then return 'expired'; end if;
  if v_submission.slipok_amount_minor is distinct from v_order.total_minor then raise exception 'Verified amount does not match order'; end if;
  select * into v_payment from public.payments where order_id=v_order.id and provider='manual_slipok' for update;
  if not found or v_payment.status<>'pending' or v_payment.amount_minor<>v_order.total_minor then raise exception 'Payment record does not match order'; end if;
  select coalesce(sum(quantity),0)::integer into v_expected from public.order_items where order_id=v_order.id;
  if jsonb_typeof(p_ticket_rows)<>'array' or jsonb_array_length(p_ticket_rows)<>v_expected then raise exception 'Ticket rows do not match order quantity'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_ticket_rows) as r
    where not exists(select 1 from public.order_items oi where oi.id=(r->>'order_item_id')::uuid and oi.order_id=v_order.id and (r->>'ticket_number')::integer between 1 and oi.quantity)
  ) or exists (
    select 1 from jsonb_array_elements(p_ticket_rows) as r group by (r->>'order_item_id')::uuid,(r->>'ticket_number')::integer having count(*)>1
  ) then raise exception 'Ticket rows are invalid'; end if;
  update public.payments set provider_reference=v_submission.trans_ref,status='succeeded',confirmed_at=now() where id=v_payment.id;
  for v_item in select * from public.order_items where order_id=v_order.id loop
    update public.ticket_types set quantity_reserved=greatest(0,quantity_reserved-v_item.quantity),quantity_sold=quantity_sold+v_item.quantity where id=v_item.ticket_type_id;
  end loop;
  for v_row in select * from jsonb_array_elements(p_ticket_rows) loop
    insert into public.tickets(id,order_item_id,event_id,owner_id,token_hash,qr_code_hash,ticket_number)
      values((v_row->>'id')::uuid,(v_row->>'order_item_id')::uuid,v_order.event_id,v_order.buyer_id,v_row->>'qr_code_hash',v_row->>'qr_code_hash',(v_row->>'ticket_number')::smallint);
  end loop;
  update public.orders set status='paid' where id=v_order.id;
  return 'paid';
end;
$$;
revoke all on function public.issue_slipok_ticket_order(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.issue_slipok_ticket_order(uuid,uuid,jsonb) to service_role;

-- Organizers may scan tickets for events they own. Only admins may scan any event.
create or replace function public.validate_ticket_once(p_ticket_id uuid,p_qr_hash text,p_scanner uuid)
returns table(result text,event_title text,ticket_id uuid)
language plpgsql security definer set search_path = '' as $$
declare v_ticket public.tickets%rowtype; v_event public.events%rowtype;
begin
  select t.* into v_ticket from public.tickets t
    where t.id=p_ticket_id and t.qr_code_hash=p_qr_hash for update;
  if not found then return query select 'invalid'::text,null::text,p_ticket_id; return; end if;
  select e.* into v_event from public.events e where e.id=v_ticket.event_id;
  if not (v_event.organizer_id=p_scanner or exists (
    select 1 from public.user_roles ur where ur.user_id=p_scanner and ur.role='admin'
  )) then raise exception 'Not authorized to check in this event'; end if;
  if v_ticket.status<>'valid' then return query select 'already_used'::text,v_event.title,v_ticket.id; return; end if;
  update public.tickets set status='checked_in',checked_in_at=now()
    where id=v_ticket.id and status='valid';
  insert into public.check_ins(ticket_id,checked_by) values(v_ticket.id,p_scanner)
    on conflict on constraint check_ins_ticket_id_key do nothing;
  return query select 'accepted'::text,v_event.title,v_ticket.id;
end;
$$;
revoke all on function public.validate_ticket_once(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.validate_ticket_once(uuid,text,uuid) to service_role;

-- Human review queue: event owners may resolve verified payments after reservation
-- expiry. A rejection records the decision but never claims a refund was executed.
create table if not exists public.ticket_payment_reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.ticket_payment_submissions(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(user_id) on delete restrict,
  reviewer_role text not null check (reviewer_role in ('organizer','admin')),
  decision text not null check (decision in ('approved','rejected')),
  note text not null default '' check (char_length(note)<=1000),
  created_at timestamptz not null default now()
);
create index if not exists ticket_payment_reviews_submission_idx
  on public.ticket_payment_reviews(submission_id,created_at desc);
alter table public.ticket_payment_reviews enable row level security;
revoke all on public.ticket_payment_reviews from public,anon,authenticated;
grant select,insert,update,delete on public.ticket_payment_reviews to service_role;

insert into public.ticket_payment_reviews(submission_id,reviewer_id,reviewer_role,decision,note,created_at)
select r.submission_id,r.admin_id,'admin',r.decision,r.note,r.created_at
from public.admin_ticket_payment_reviews r
where not exists (select 1 from public.ticket_payment_reviews n where n.submission_id=r.submission_id and n.reviewer_id=r.admin_id and n.created_at=r.created_at);

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
  v_role text;
begin
  if p_decision not in ('approved','rejected') then raise exception 'Invalid decision'; end if;
  select * into v_submission from public.ticket_payment_submissions where id=p_submission for update;
  if not found then raise exception 'Submission not found'; end if;
  select * into v_order from public.orders where id=v_submission.order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if exists(select 1 from public.user_roles ur where ur.user_id=p_admin and ur.role='admin') then
    v_role:='admin';
  elsif exists(select 1 from public.user_roles ur where ur.user_id=p_admin and ur.role='organizer')
    and exists(select 1 from public.events e where e.id=v_order.event_id and e.organizer_id=p_admin) then
    v_role:='organizer';
  else
    raise exception 'Not authorized';
  end if;
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
      where not exists(select 1 from public.order_items oi where oi.id=(r->>'order_item_id')::uuid and oi.order_id=v_order.id and (r->>'ticket_number')::integer between 1 and oi.quantity)
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
  insert into public.ticket_payment_reviews(submission_id,reviewer_id,reviewer_role,decision,note)
    values(p_submission,p_admin,v_role,p_decision,left(coalesce(p_note,''),1000));
  if v_role='admin' then
    insert into public.admin_ticket_payment_reviews(submission_id,admin_id,decision,note)
      values(p_submission,p_admin,p_decision,left(coalesce(p_note,''),1000));
  end if;
  return p_decision;
end;
$$;
revoke all on function public.review_slipok_ticket_payment(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.review_slipok_ticket_payment(uuid,uuid,text,text,jsonb) to service_role;

commit;
