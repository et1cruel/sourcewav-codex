begin;

-- Persist the current client state per authenticated account while the UI is
-- migrated from its local prototype store to normalized domain tables.
create table public.user_states (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  state jsonb not null default '{}'::jsonb check (jsonb_typeof(state) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.user_states enable row level security;
create policy user_states_read_self on public.user_states
  for select using ((select auth.uid()) = user_id);
create policy user_states_insert_self on public.user_states
  for insert with check ((select auth.uid()) = user_id);
create policy user_states_update_self on public.user_states
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

commit;
