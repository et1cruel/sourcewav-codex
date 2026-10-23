-- A scanner may check in tickets only for their own event. Admins retain support access.
create or replace function public.validate_ticket_once(p_ticket_id uuid,p_qr_hash text,p_scanner uuid)
returns table(result text,event_title text,ticket_id uuid)
language plpgsql security definer set search_path = '' as $$
declare v_ticket public.tickets%rowtype; v_event public.events%rowtype;
begin
  select t.* into v_ticket from public.tickets t
    where t.id=p_ticket_id and t.qr_code_hash=p_qr_hash for update;
  if not found then return query select 'invalid'::text,null::text,p_ticket_id; return; end if;
  select e.* into v_event from public.events e where e.id=v_ticket.event_id;
  if not (
    v_event.organizer_id=p_scanner
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id=p_scanner and ur.role='admin'
    )
  ) then raise exception 'Not authorized to check in this event'; end if;
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
