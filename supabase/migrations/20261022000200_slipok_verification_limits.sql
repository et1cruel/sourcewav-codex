-- Limit seller-funded SlipOK checks per order and retain only the minimum
-- verification facts needed to issue and audit a ticket.
begin;

alter table public.orders
  add column if not exists slipok_verification_attempts smallint not null default 0;

alter table public.orders
  drop constraint if exists orders_slipok_verification_attempts_check;
alter table public.orders
  add constraint orders_slipok_verification_attempts_check
  check (slipok_verification_attempts between 0 and 5);

create or replace function public.claim_slipok_ticket_verification(p_order uuid, p_buyer uuid)
returns smallint
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_attempts smallint;
begin
  select * into v_order from public.orders where id = p_order for update;
  if not found or v_order.buyer_id is distinct from p_buyer then
    raise exception 'Order details do not match';
  end if;
  if v_order.status <> 'awaiting_payment' or v_order.expires_at is null or v_order.expires_at <= now() then
    return 0;
  end if;
  if v_order.slipok_verification_attempts >= 5 then
    return 0;
  end if;
  update public.orders
    set slipok_verification_attempts = slipok_verification_attempts + 1
    where id = p_order
    returning slipok_verification_attempts into v_attempts;
  return v_attempts;
end;
$$;

revoke all on function public.claim_slipok_ticket_verification(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_slipok_ticket_verification(uuid, uuid) to service_role;

commit;
