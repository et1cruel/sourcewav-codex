-- Constrain trusted reservation cleanup to supported order/payment states.
begin;
create or replace function public.release_ticket_order(p_order uuid,p_status text default 'expired')
returns void language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype; v_item public.order_items%rowtype;
begin
  if p_status not in ('expired','cancelled') then raise exception 'Invalid order release status'; end if;
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
commit;
