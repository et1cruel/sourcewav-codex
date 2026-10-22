begin;

-- Authorization roles are separate from user-editable profile labels.
create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('organizer', 'admin')),
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

alter table public.user_roles enable row level security;
revoke all on public.user_roles from public, anon, authenticated;
grant select, insert, update, delete on public.user_roles to service_role;

-- Remove authorization labels that may have been copied from user-controlled
-- signup metadata. Verified organizers must be granted through user_roles.
update public.profiles p
set roles = coalesce(
  (select array_agg(role_label)
   from unnest(p.roles) as role_labels(role_label)
   where lower(btrim(role_label)) not in ('organizer', 'admin')),
  '{}'::text[]
)
where exists (
  select 1 from unnest(p.roles) as role_labels(role_label)
  where lower(btrim(role_label)) in ('organizer', 'admin')
);

create or replace function public.strip_profile_authorization_labels()
returns trigger
language plpgsql
set search_path = '' as $$
begin
  new.roles := coalesce(
    (select array_agg(role_label)
     from unnest(coalesce(new.roles, '{}'::text[])) as role_labels(role_label)
     where lower(btrim(role_label)) not in ('organizer', 'admin')),
    '{}'::text[]
  );
  return new;
end;
$$;

revoke all on function public.strip_profile_authorization_labels() from public, anon, authenticated;
drop trigger if exists profiles_strip_authorization_labels on public.profiles;
create trigger profiles_strip_authorization_labels
  before insert or update on public.profiles
  for each row execute function public.strip_profile_authorization_labels();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_roles jsonb;
begin
  v_roles := case
    when jsonb_typeof(new.raw_user_meta_data -> 'roles') = 'array'
      then new.raw_user_meta_data -> 'roles'
    else '[]'::jsonb
  end;

  insert into public.profiles (user_id, username, display_name, province, roles)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), 'user_' || substr(replace(new.id::text, '-', ''), 1, 24)),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'New artist'),
    nullif(trim(new.raw_user_meta_data ->> 'province'), ''),
    array(select jsonb_array_elements_text(v_roles))
  );
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public;

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
      where ur.user_id=p_scanner and ur.role in ('organizer','admin')
    )
  ) then
    raise exception 'Not authorized to check in this event';
  end if;
  if v_ticket.status<>'valid' then return query select 'already_used'::text,v_event.title,v_ticket.id; return; end if;
  update public.tickets set status='checked_in',checked_in_at=now()
    where id=v_ticket.id and status='valid';
  insert into public.check_ins(ticket_id,checked_by)
    values(v_ticket.id,p_scanner) on conflict(ticket_id) do nothing;
  return query select 'accepted'::text,v_event.title,v_ticket.id;
end;
$$;
revoke all on function public.validate_ticket_once(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.validate_ticket_once(uuid,text,uuid) to service_role;

commit;
