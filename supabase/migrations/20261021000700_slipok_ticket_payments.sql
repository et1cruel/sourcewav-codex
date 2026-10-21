-- Forward-only migration: seller-specific SlipOK credentials, automatic ticket issuance,
-- and private buyer slip storage. Recovery must use a follow-up migration.
begin;

create table if not exists public.event_payment_methods (
  event_id uuid primary key references public.events(id) on delete cascade,
  organizer_id uuid not null references public.profiles(user_id) on delete cascade,
  qr_storage_key text not null,
  bank_name text not null check (char_length(bank_name) between 1 and 80),
  beneficiary_name text not null check (char_length(beneficiary_name) between 1 and 120),
  account_last4 text not null default '' check (account_last4 = '' or account_last4 ~ '^[0-9]{4}$'),
  slipok_branch_id text not null check (slipok_branch_id ~ '^[0-9]{1,20}$'),
  slipok_api_key_ciphertext text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (qr_storage_key like organizer_id::text || '/%')
);

create table if not exists public.ticket_payment_submissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  buyer_id uuid not null references public.profiles(user_id) on delete restrict,
  organizer_id uuid not null references public.profiles(user_id) on delete restrict,
  slip_storage_key text not null unique,
  slipok_status text not null check (slipok_status in ('verified','rejected','error')),
  slipok_code integer,
  slipok_message text not null default '',
  slipok_amount_minor bigint check (slipok_amount_minor is null or slipok_amount_minor >= 0),
  trans_ref text unique,
  slipok_result jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  check (slip_storage_key like buyer_id::text || '/%')
);

create index if not exists ticket_payment_submissions_buyer_idx
  on public.ticket_payment_submissions (buyer_id, submitted_at desc);

alter table public.event_payment_methods enable row level security;
alter table public.ticket_payment_submissions enable row level security;
revoke all on public.event_payment_methods, public.ticket_payment_submissions from anon, authenticated;
grant select (event_id, organizer_id, qr_storage_key, bank_name, beneficiary_name, account_last4)
  on public.event_payment_methods to anon, authenticated;
grant select on public.ticket_payment_submissions to authenticated;

create policy event_payment_methods_public_read on public.event_payment_methods
  for select to anon, authenticated using (
    exists (select 1 from public.events e where e.id = event_id and (e.status = 'published' or e.organizer_id = auth.uid()))
  );
create policy ticket_payment_submissions_participant_read on public.ticket_payment_submissions
  for select to authenticated using (buyer_id = auth.uid() or organizer_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sourcewav-avatars', 'sourcewav-avatars', true, 5242880, array['image/jpeg','image/png','image/webp']),
       ('sourcewav-event-payment-qr', 'sourcewav-event-payment-qr', true, 5242880, array['image/jpeg','image/png','image/webp']),
       ('sourcewav-ticket-slips', 'sourcewav-ticket-slips', false, 5242880, array['image/jpeg','image/png','image/webp','image/jfif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy sourcewav_avatar_public_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'sourcewav-avatars');
create policy sourcewav_avatar_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'sourcewav-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy sourcewav_avatar_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'sourcewav-avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'sourcewav-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy sourcewav_avatar_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'sourcewav-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy sourcewav_event_qr_public_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'sourcewav-event-payment-qr');
create policy sourcewav_event_qr_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'sourcewav-event-payment-qr' and (storage.foldername(name))[1] = auth.uid()::text);
create policy sourcewav_event_qr_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'sourcewav-event-payment-qr' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'sourcewav-event-payment-qr' and (storage.foldername(name))[1] = auth.uid()::text);
create policy sourcewav_event_qr_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'sourcewav-event-payment-qr' and (storage.foldername(name))[1] = auth.uid()::text);

create policy sourcewav_ticket_slip_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'sourcewav-ticket-slips' and (storage.foldername(name))[1] = auth.uid()::text);
create policy sourcewav_ticket_slip_participant_read on storage.objects for select to authenticated
  using (bucket_id = 'sourcewav-ticket-slips' and exists (
    select 1 from public.ticket_payment_submissions s
    where s.slip_storage_key = name and (s.buyer_id = auth.uid() or s.organizer_id = auth.uid())
  ));
create policy sourcewav_ticket_slip_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'sourcewav-ticket-slips' and (storage.foldername(name))[1] = auth.uid()::text);

create function public.reserve_manual_ticket_order(p_buyer uuid, p_type uuid, p_quantity smallint, p_idempotency_key text)
returns table(order_id uuid,event_id uuid,ticket_type_id uuid,quantity integer,unit_price_minor bigint,total_minor bigint,expires_at timestamptz,event_title text,tier_name text,qr_storage_key text,bank_name text,beneficiary_name text,account_last4 text)
language plpgsql security definer set search_path = '' as $$
declare v_type public.ticket_types%rowtype; v_order uuid; v_existing uuid; v_event public.events%rowtype; v_method public.event_payment_methods%rowtype; v_expiry timestamptz := now()+interval '30 minutes';
begin
  if p_quantity < 1 or p_quantity > 10 then raise exception 'Ticket quantity must be between 1 and 10'; end if;
  if p_idempotency_key !~ '^[0-9a-fA-F-]{36}$' then raise exception 'Invalid checkout key'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));
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
  if not found or v_event.starts_at <= now() then raise exception 'Event is not available for sale'; end if;
  if v_type.sales_start is not null and v_type.sales_start>now() then raise exception 'Sales have not started'; end if;
  if v_type.sales_end is not null and v_type.sales_end<now() then raise exception 'Sales have ended'; end if;
  select * into v_method from public.event_payment_methods where event_payment_methods.event_id=v_type.event_id;
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

create function public.record_slipok_ticket_submission(
  p_order uuid, p_buyer uuid, p_organizer uuid, p_slip_key text,
  p_slip_status text, p_slip_code integer, p_message text,
  p_amount_minor bigint, p_trans_ref text, p_result jsonb
)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_submission uuid;
begin
  select * into v_order from public.orders where id=p_order for update;
  if not found or v_order.buyer_id<>p_buyer then raise exception 'Order details do not match'; end if;
  if v_order.status='paid' then return 'already_paid'; end if;
  if v_order.status<>'awaiting_payment' or v_order.expires_at is null or v_order.expires_at<now() then return 'expired'; end if;
  if p_slip_status not in ('verified','rejected','error') then raise exception 'Invalid verification state'; end if;
  if p_slip_key not like p_buyer::text || '/' || p_order::text || '/%' then raise exception 'Slip storage key does not match buyer and order'; end if;
  if p_organizer is distinct from (select e.organizer_id from public.events e where e.id=v_order.event_id) then raise exception 'Organizer does not match order'; end if;
  if p_slip_status='verified' and (p_trans_ref is null or length(p_trans_ref)=0 or length(p_trans_ref)>100 or p_amount_minor is distinct from v_order.total_minor) then
    raise exception 'SlipOK verification data does not match order';
  end if;

  insert into public.ticket_payment_submissions(
    order_id,event_id,buyer_id,organizer_id,slip_storage_key,slipok_status,slipok_code,
    slipok_message,slipok_amount_minor,trans_ref,slipok_result
  ) values (
    v_order.id,v_order.event_id,p_buyer,p_organizer,p_slip_key,p_slip_status,p_slip_code,
    left(coalesce(p_message,''),500),p_amount_minor,
    case when p_slip_status='verified' then p_trans_ref else null end,
    coalesce(p_result,'{}'::jsonb)
  ) returning id into v_submission;
  return v_submission::text;
end; $$;
revoke all on function public.record_slipok_ticket_submission(uuid,uuid,uuid,text,text,integer,text,bigint,text,jsonb) from public,anon,authenticated;
grant execute on function public.record_slipok_ticket_submission(uuid,uuid,uuid,text,text,integer,text,bigint,text,jsonb) to service_role;

create function public.issue_slipok_ticket_order(p_submission uuid,p_buyer uuid,p_ticket_rows jsonb)
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
  if v_order.status<>'awaiting_payment' or v_order.expires_at is null or v_order.expires_at<now() then return 'expired'; end if;
  if v_submission.slipok_amount_minor is distinct from v_order.total_minor then raise exception 'Verified amount does not match order'; end if;
  select * into v_payment from public.payments where order_id=v_order.id and provider='manual_slipok' for update;
  if not found or v_payment.status<>'pending' or v_payment.amount_minor<>v_order.total_minor then raise exception 'Payment record does not match order'; end if;

  select coalesce(sum(quantity),0)::integer into v_expected from public.order_items where order_id=v_order.id;
  if jsonb_typeof(p_ticket_rows)<>'array' or jsonb_array_length(p_ticket_rows)<>v_expected then raise exception 'Ticket rows do not match order quantity'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_ticket_rows) as r
    where not exists (
      select 1 from public.order_items oi where oi.id=(r->>'order_item_id')::uuid and oi.order_id=v_order.id
        and (r->>'ticket_number')::integer between 1 and oi.quantity
    )
  ) then raise exception 'Ticket row points to an invalid order item'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_ticket_rows) as r
    group by (r->>'order_item_id')::uuid,(r->>'ticket_number')::integer having count(*)>1
  ) then raise exception 'Ticket rows contain duplicate numbers'; end if;

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
end; $$;
revoke all on function public.issue_slipok_ticket_order(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.issue_slipok_ticket_order(uuid,uuid,jsonb) to service_role;

commit;
