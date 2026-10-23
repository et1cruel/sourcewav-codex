begin;

-- Authentication/setup failures never reached slip verification, so restore the
-- affected buyer's attempt and prevent a bad organizer key from using the limit.
update public.orders o
set slipok_verification_attempts = greatest(0, o.slipok_verification_attempts - failures.failure_count)
from (
  select order_id, count(*)::smallint as failure_count
  from public.slip_verification_attempts
  where provider_response_code in (1001, 1002)
    and status = 'error'
  group by order_id
) failures
where o.id = failures.order_id
  and o.status = 'awaiting_payment';

create or replace function public.finish_slipok_ticket_verification(
  p_attempt uuid,p_status text,p_provider_code integer,p_failure_reason text,
  p_amount_minor bigint,p_receiver_verified boolean,p_trans_ref text
) returns void language plpgsql security definer set search_path = '' as $$
declare v_order uuid;
begin
  if p_status not in ('verified','rejected','error','timeout','quota_exhausted') then raise exception 'Invalid verification status'; end if;
  update public.slip_verification_attempts set status=p_status,
    provider_response_code=p_provider_code,failure_reason=left(coalesce(p_failure_reason,''),300),
    amount_minor=p_amount_minor,receiver_verified=p_receiver_verified,
    trans_ref=case when p_status='verified' then left(p_trans_ref,100) else null end,completed_at=now()
  where id=p_attempt and status='processing'
  returning order_id into v_order;
  if not found then raise exception 'Verification attempt is missing or already completed'; end if;
  if p_status='error' and p_provider_code in (1001,1002) then
    update public.orders set slipok_verification_attempts = greatest(0, slipok_verification_attempts - 1)
    where id=v_order and status='awaiting_payment';
  end if;
end; $$;

revoke all on function public.finish_slipok_ticket_verification(uuid,text,integer,text,bigint,boolean,text) from public,anon,authenticated;
grant execute on function public.finish_slipok_ticket_verification(uuid,text,integer,text,bigint,boolean,text) to service_role;

commit;
