-- Sourcewav initial PostgreSQL schema (Supabase-compatible).
-- Apply once to a new database through a migration tool. Never expose service-role credentials in the browser.
create extension if not exists pgcrypto;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-zA-Z0-9_]{3,30}$'),
  display_name text not null check (char_length(display_name) between 1 and 80),
  avatar_url text,
  bio text not null default '' check (char_length(bio) <= 500),
  city text,
  province text,
  roles text[] not null default '{}',
  portfolio_url text,
  is_open_to_work boolean not null default false,
  visibility text not null default 'public' check (visibility in ('public','members','private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Authorization roles are granted by trusted server/admin workflows, never profile metadata.
create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('organizer', 'admin')),
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create function public.strip_profile_authorization_labels()
returns trigger language plpgsql set search_path = '' as $$
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
create trigger profiles_strip_authorization_labels
  before insert or update on public.profiles
  for each row execute function public.strip_profile_authorization_labels();

-- Create the user's profile from Supabase Auth metadata at signup. The function runs
-- as its owner so the profiles RLS policy can remain closed to anonymous inserts.
create function public.handle_new_user() returns trigger
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke all on function public.handle_new_user() from public;

create table public.follows (
  follower_id uuid not null references public.profiles(user_id) on delete cascade,
  followed_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);

create table public.blocks (
  blocker_id uuid not null references public.profiles(user_id) on delete cascade,
  blocked_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(user_id) on delete cascade,
  kind text not null check (kind in ('music','art','talk','collab','announcement')),
  title text check (title is null or char_length(title) <= 140),
  body text not null check (char_length(body) between 1 and 5000),
  visibility text not null default 'public' check (visibility in ('public','members','private')),
  status text not null default 'published' check (status in ('draft','published','hidden','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  storage_key text not null,
  media_type text not null check (media_type in ('image','audio','video','document')),
  alt_text text,
  position smallint not null default 0 check (position between 0 and 20),
  created_at timestamptz not null default now(),
  unique (post_id, position)
);

create table public.audio_tracks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(user_id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  artist_name text not null check (char_length(artist_name) between 1 and 80),
  genre text not null default 'อื่นๆ' check (char_length(genre) <= 40),
  storage_key text not null unique,
  cover_storage_key text,
  mime_type text not null check (mime_type in ('audio/mpeg','audio/wav','audio/flac','audio/ogg','audio/mp4','audio/aac','audio/webm')),
  byte_size bigint not null check (byte_size between 1 and 52428800),
  play_count bigint not null default 0 check (play_count >= 0),
  duration_ms bigint check (duration_ms is null or duration_ms between 1 and 86400000),
  visibility text not null default 'public' check (visibility in ('public','members','private')),
  status text not null default 'published' check (status in ('processing','published','hidden','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.audio_track_likes (
  track_id uuid not null references public.audio_tracks(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (track_id, user_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete cascade,
  track_id uuid references public.audio_tracks(id) on delete cascade,
  author_id uuid not null references public.profiles(user_id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint comments_one_subject check (num_nonnulls(post_id, track_id) = 1)
);

create table public.reactions (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  reaction text not null default 'like' check (reaction in ('like','love','fire')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.saved_items (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  item_type text not null check (item_type in ('post','event','listing')),
  item_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, item_type, item_id)
);

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles(user_id) on delete set null,
  name text not null check (char_length(name) between 1 and 160),
  description text not null default '',
  country_code char(2) not null default 'TH',
  province text not null,
  district text,
  address text not null,
  latitude numeric(9,6) not null check (latitude between -90 and 90),
  longitude numeric(9,6) not null check (longitude between -180 and 180),
  categories text[] not null default '{}',
  website_url text,
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles(user_id) on delete restrict,
  venue_id uuid references public.venues(id) on delete set null,
  title text not null check (char_length(title) between 1 and 180),
  description text not null default '',
  category text not null check (category in ('music','art','community','market','other')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  event_timezone text not null default 'Asia/Bangkok',
  status text not null default 'draft' check (status in ('draft','published','cancelled','postponed','completed')),
  cover_url text,
  age_limit smallint check (age_limit is null or age_limit between 0 and 100),
  currency char(3) not null default 'THB',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (ends_at > starts_at)
);

create table public.ticket_types (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  price_minor bigint not null check (price_minor >= 0),
  currency char(3) not null default 'THB',
  quantity_total integer not null check (quantity_total >= 0),
  quantity_sold integer not null default 0 check (quantity_sold >= 0 and quantity_sold <= quantity_total),
  sales_start timestamptz,
  sales_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(user_id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','awaiting_payment','paid','cancelled','expired','refunded','disputed')),
  currency char(3) not null default 'THB',
  subtotal_minor bigint not null check (subtotal_minor >= 0),
  fee_minor bigint not null default 0 check (fee_minor >= 0),
  total_minor bigint not null check (total_minor >= 0),
  idempotency_key text not null unique,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_minor = subtotal_minor + fee_minor)
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  ticket_type_id uuid not null references public.ticket_types(id) on delete restrict,
  quantity smallint not null check (quantity between 1 and 10),
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null,
  provider_reference text unique,
  status text not null default 'pending' check (status in ('pending','succeeded','failed','expired','refunded','disputed')),
  amount_minor bigint not null check (amount_minor >= 0),
  currency char(3) not null default 'THB',
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payment_webhook_events (
  provider text not null,
  provider_event_id text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  payload_digest text not null,
  primary key (provider, provider_event_id)
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  owner_id uuid not null references public.profiles(user_id) on delete restrict,
  token_hash text not null unique,
  status text not null default 'valid' check (status in ('valid','checked_in','cancelled','refunded')),
  issued_at timestamptz not null default now(),
  checked_in_at timestamptz
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete restrict,
  requested_by uuid references public.profiles(user_id) on delete set null,
  amount_minor bigint not null check (amount_minor > 0),
  status text not null default 'requested' check (status in ('requested','approved','rejected','processing','succeeded','failed')),
  reason text not null default '',
  provider_reference text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null unique references public.tickets(id) on delete restrict,
  checked_by uuid not null references public.profiles(user_id) on delete restrict,
  checked_in_at timestamptz not null default now(),
  device_reference text
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(user_id) on delete cascade,
  title text not null check (char_length(title) between 1 and 180),
  description text not null default '',
  category text not null check (category in ('artwork','print','digital','commission','service','trade')),
  price_minor bigint check (price_minor is null or price_minor >= 0),
  currency char(3) not null default 'THB',
  stock integer check (stock is null or stock >= 0),
  delivery_type text not null default 'digital' check (delivery_type in ('digital','shipping','commission','exchange')),
  license_terms text not null default '',
  status text not null default 'draft' check (status in ('draft','published','reserved','sold','hidden','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.listing_media (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  storage_key text not null,
  alt_text text not null default '',
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (listing_id, position)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'direct' check (kind in ('direct','group')),
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  muted_until timestamptz,
  primary key (conversation_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(user_id) on delete restrict,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(user_id) on delete restrict,
  target_type text not null check (target_type in ('profile','post','comment','event','listing','message','venue')),
  target_id uuid not null,
  reason text not null,
  details text not null default '' check (char_length(details) <= 3000),
  status text not null default 'open' check (status in ('open','reviewing','actioned','dismissed','appealed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.reports(id) on delete set null,
  moderator_id uuid not null references public.profiles(user_id) on delete restrict,
  action text not null check (action in ('warn','hide','remove','suspend','restore','dismiss')),
  target_type text not null,
  target_id uuid not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(user_id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text not null,
  request_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create function public.set_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger posts_set_updated_at before update on public.posts for each row execute function public.set_updated_at();
create trigger audio_tracks_set_updated_at before update on public.audio_tracks for each row execute function public.set_updated_at();
create trigger comments_set_updated_at before update on public.comments for each row execute function public.set_updated_at();
create trigger venues_set_updated_at before update on public.venues for each row execute function public.set_updated_at();
create trigger events_set_updated_at before update on public.events for each row execute function public.set_updated_at();
create trigger ticket_types_set_updated_at before update on public.ticket_types for each row execute function public.set_updated_at();
create trigger orders_set_updated_at before update on public.orders for each row execute function public.set_updated_at();
create trigger payments_set_updated_at before update on public.payments for each row execute function public.set_updated_at();
create trigger refunds_set_updated_at before update on public.refunds for each row execute function public.set_updated_at();
create trigger listings_set_updated_at before update on public.listings for each row execute function public.set_updated_at();
create trigger conversations_set_updated_at before update on public.conversations for each row execute function public.set_updated_at();
create trigger messages_set_updated_at before update on public.messages for each row execute function public.set_updated_at();

create index posts_feed_idx on public.posts (created_at desc) where status = 'published' and deleted_at is null;
create index posts_author_idx on public.posts (author_id, created_at desc);
create index audio_tracks_public_idx on public.audio_tracks (created_at desc) where status = 'published' and visibility = 'public' and deleted_at is null;
create index audio_tracks_owner_idx on public.audio_tracks (owner_id, created_at desc);
create index comments_post_idx on public.comments (post_id, created_at);
create index comments_track_idx on public.comments (track_id, created_at) where track_id is not null;
create index follows_followed_idx on public.follows (followed_id, created_at desc);
create index venues_city_category_idx on public.venues (country_code, province, is_active);
create index events_public_schedule_idx on public.events (starts_at, category) where status = 'published' and deleted_at is null;
create index ticket_types_event_idx on public.ticket_types (event_id);
create index orders_buyer_idx on public.orders (buyer_id, created_at desc);
create index payments_order_idx on public.payments (order_id, created_at desc);
create index tickets_event_idx on public.tickets (event_id, status);
create index listings_public_created_idx on public.listings (created_at desc) where status = 'published' and deleted_at is null;
create index messages_conversation_idx on public.messages (conversation_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id, created_at desc) where read_at is null;
create index reports_queue_idx on public.reports (status, created_at);
create index audit_logs_target_idx on public.audit_logs (target_type, target_id, created_at desc);

-- RLS is enabled everywhere. Policies are intentionally conservative; payment/order writes belong to a trusted server.
create function public.is_conversation_member(target_conversation_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversation_members m
    where m.conversation_id = target_conversation_id and m.user_id = auth.uid()
  );
$$;
revoke all on function public.is_conversation_member(uuid) from public;
grant execute on function public.is_conversation_member(uuid) to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.follows enable row level security;
alter table public.blocks enable row level security;
alter table public.posts enable row level security;
alter table public.audio_tracks enable row level security;
alter table public.audio_track_likes enable row level security;
alter table public.post_media enable row level security;
alter table public.comments enable row level security;
alter table public.reactions enable row level security;
alter table public.saved_items enable row level security;
alter table public.venues enable row level security;
alter table public.events enable row level security;
alter table public.ticket_types enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.tickets enable row level security;
alter table public.refunds enable row level security;
alter table public.check_ins enable row level security;
alter table public.listings enable row level security;
alter table public.listing_media enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.audit_logs enable row level security;

revoke all on public.user_roles from public, anon, authenticated;
grant select, insert, update, delete on public.user_roles to service_role;

create policy profiles_read_visible on public.profiles for select using (visibility = 'public' and deleted_at is null or user_id = auth.uid());
create policy profiles_update_self on public.profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy follows_read on public.follows for select using (true);
create policy follows_insert_self on public.follows for insert with check (follower_id = auth.uid());
create policy follows_delete_self on public.follows for delete using (follower_id = auth.uid());
create policy blocks_read_self on public.blocks for select using (blocker_id = auth.uid());
create policy blocks_insert_self on public.blocks for insert with check (blocker_id = auth.uid());
create policy blocks_delete_self on public.blocks for delete using (blocker_id = auth.uid());
create policy posts_read_public on public.posts for select using (status = 'published' and visibility = 'public' and deleted_at is null or author_id = auth.uid());
create policy posts_insert_self on public.posts for insert with check (author_id = auth.uid());
create policy posts_update_self on public.posts for update using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy posts_delete_self on public.posts for delete using (author_id = auth.uid());
create policy audio_tracks_read_visible on public.audio_tracks for select using (status = 'published' and visibility = 'public' and deleted_at is null or owner_id = auth.uid());
create policy audio_tracks_insert_self on public.audio_tracks for insert with check (owner_id = auth.uid());
create policy audio_tracks_update_self on public.audio_tracks for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy audio_tracks_delete_self on public.audio_tracks for delete using (owner_id = auth.uid());
create policy audio_track_likes_read on public.audio_track_likes for select using (true);
create policy audio_track_likes_insert_self on public.audio_track_likes for insert with check (user_id = auth.uid());
create policy audio_track_likes_delete_self on public.audio_track_likes for delete using (user_id = auth.uid());
create policy post_media_read_public on public.post_media for select using (exists (select 1 from public.posts p where p.id = post_id and (p.status = 'published' and p.visibility = 'public' or p.author_id = auth.uid())));
create policy post_media_insert_author on public.post_media for insert with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));
create policy comments_read_public on public.comments for select using (deleted_at is null and (
  (post_id is not null and exists (select 1 from public.posts p where p.id = post_id and p.status = 'published' and p.visibility = 'public' and p.deleted_at is null))
  or (track_id is not null and exists (select 1 from public.audio_tracks t where t.id = track_id and t.status = 'published' and t.visibility = 'public' and t.deleted_at is null))
));
create policy comments_insert_self on public.comments for insert with check (
  author_id = auth.uid() and (
    (post_id is not null and exists (select 1 from public.posts p where p.id = post_id and p.status = 'published' and p.visibility = 'public' and p.deleted_at is null))
    or (track_id is not null and exists (select 1 from public.audio_tracks t where t.id = track_id and t.status = 'published' and t.visibility = 'public' and t.deleted_at is null))
  )
);
create policy comments_update_self on public.comments for update using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy reactions_read on public.reactions for select using (true);
create policy reactions_insert_self on public.reactions for insert with check (user_id = auth.uid());
create policy reactions_update_self on public.reactions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reactions_delete_self on public.reactions for delete using (user_id = auth.uid());
create policy saved_items_self on public.saved_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy venues_read_active on public.venues for select using (is_active and verification_status = 'verified');
create policy venues_insert_self on public.venues for insert with check (created_by = auth.uid());
create policy events_read_published on public.events for select using (status = 'published' and deleted_at is null or organizer_id = auth.uid());
create policy events_insert_organizer on public.events for insert with check (organizer_id = auth.uid());
create policy events_update_organizer on public.events for update using (organizer_id = auth.uid()) with check (organizer_id = auth.uid());
create policy ticket_types_read_public on public.ticket_types for select using (exists (select 1 from public.events e where e.id = event_id and e.status = 'published'));
create policy orders_read_buyer on public.orders for select using (buyer_id = auth.uid());
create policy order_items_read_buyer on public.order_items for select using (exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = auth.uid()));
create policy payments_read_buyer on public.payments for select using (exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = auth.uid()));
create policy tickets_read_owner on public.tickets for select using (owner_id = auth.uid());
create policy refunds_read_buyer on public.refunds for select using (exists (select 1 from public.payments p join public.orders o on o.id = p.order_id where p.id = payment_id and o.buyer_id = auth.uid()));
create policy listings_read_public on public.listings for select using (status = 'published' and deleted_at is null or seller_id = auth.uid());
create policy listings_insert_self on public.listings for insert with check (seller_id = auth.uid());
create policy listings_update_self on public.listings for update using (seller_id = auth.uid()) with check (seller_id = auth.uid());
create policy listing_media_read_public on public.listing_media for select using (exists (select 1 from public.listings l where l.id = listing_id and (l.status = 'published' or l.seller_id = auth.uid())));
create policy listing_media_insert_seller on public.listing_media for insert with check (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()));
create policy conversations_member_read on public.conversations for select using (public.is_conversation_member(id));
create policy members_read_conversation on public.conversation_members for select using (public.is_conversation_member(conversation_id));
create policy messages_member_read on public.messages for select using (public.is_conversation_member(conversation_id));
create policy messages_member_send on public.messages for insert with check (sender_id = auth.uid() and public.is_conversation_member(conversation_id));
create policy notifications_self on public.notifications for select using (user_id = auth.uid());
create policy notifications_update_self on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reports_insert_self on public.reports for insert with check (reporter_id = auth.uid());
create policy reports_read_self on public.reports for select using (reporter_id = auth.uid());

-- Transitional per-account persistence for the current client store. Move data to
-- the normalized domain tables as each feature gains its Supabase service layer.
create table public.user_states (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  state jsonb not null default '{}'::jsonb check (jsonb_typeof(state) = 'object'),
  updated_at timestamptz not null default now()
);
alter table public.user_states enable row level security;
create policy user_states_read_self on public.user_states for select using ((select auth.uid()) = user_id);
create policy user_states_insert_self on public.user_states for insert with check ((select auth.uid()) = user_id);
create policy user_states_update_self on public.user_states for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Order/payment/ticket/refund rows are read-only to their owners. No browser write policy exists for
-- orders, order items, payments, webhook events, tickets, refunds, check-ins, moderation, or audit logs.
-- Expose mutations and staff workflows through a trusted server with verified permissions.

create or replace function public.record_audio_track_play(p_track_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_count bigint;
begin
  update public.audio_tracks
  set play_count = play_count + 1
  where id = p_track_id
    and status = 'published'
    and visibility = 'public'
    and deleted_at is null
  returning play_count into updated_count;
  return updated_count;
end;
$$;
revoke all on function public.record_audio_track_play(uuid) from public;
grant execute on function public.record_audio_track_play(uuid) to anon, authenticated;
grant select on public.audio_track_likes to anon, authenticated;
grant delete on public.audio_tracks to authenticated;

create or replace function public.notify_audio_track_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  track_owner uuid;
  track_title text;
begin
  if tg_op = 'DELETE' then
    delete from public.notifications
    where kind = 'audio_track_like'
      and payload->>'track_id' = old.track_id::text
      and payload->>'actor_id' = old.user_id::text;
    return old;
  end if;

  select owner_id, title into track_owner, track_title
  from public.audio_tracks where id = new.track_id;
  if track_owner is not null and track_owner <> new.user_id then
    insert into public.notifications (user_id, kind, payload)
    values (track_owner, 'audio_track_like', jsonb_build_object(
      'actor_id', new.user_id, 'track_id', new.track_id, 'track_title', track_title
    ));
  end if;
  return new;
end;
$$;
revoke all on function public.notify_audio_track_like() from public;
create trigger audio_track_like_notification
after insert or delete on public.audio_track_likes
for each row execute function public.notify_audio_track_like();
grant select on public.notifications to authenticated;
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

create table public.audio_track_play_events (
  track_id uuid not null references public.audio_tracks(id) on delete cascade,
  listener_key text not null,
  period_start timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (track_id, listener_key, period_start)
);
create index audio_track_play_events_created_idx on public.audio_track_play_events (created_at);
alter table public.audio_track_play_events enable row level security;
revoke all on public.audio_track_play_events from anon, authenticated;

create or replace function public.record_audio_track_listen(p_track_id uuid, p_session_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  track_owner uuid;
  current_count bigint;
  listener_key text;
  inserted_track uuid;
begin
  if p_track_id is null or p_session_id is null then return null; end if;
  select owner_id, play_count into track_owner, current_count
  from public.audio_tracks
  where id = p_track_id and status = 'published'
    and visibility = 'public' and deleted_at is null;
  if track_owner is null then return null; end if;
  if track_owner = auth.uid() then return current_count; end if;
  listener_key := case when auth.uid() is null
    then 'guest:' || p_session_id::text
    else 'user:' || auth.uid()::text end;
  insert into public.audio_track_play_events (track_id, listener_key, period_start)
  values (p_track_id, listener_key,
    to_timestamp(floor(extract(epoch from now()) / 1800) * 1800))
  on conflict do nothing
  returning track_id into inserted_track;
  if inserted_track is not null then
    update public.audio_tracks set play_count = play_count + 1
    where id = p_track_id returning play_count into current_count;
  else
    select play_count into current_count from public.audio_tracks where id = p_track_id;
  end if;
  return current_count;
end;
$$;
revoke all on function public.record_audio_track_play(uuid) from anon, authenticated;
revoke all on function public.record_audio_track_listen(uuid, uuid) from public;
grant execute on function public.record_audio_track_listen(uuid, uuid) to anon, authenticated;
