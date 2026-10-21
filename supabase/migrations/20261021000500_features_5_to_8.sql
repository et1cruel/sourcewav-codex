-- Sourcewav Migration: Features 5 to 8
-- 5. Booking Board — ระบบหาคนร่วมงานและรับจ้าง
-- 6. Follow & Drop Alert — ติดตามศิลปินและแจ้งงานใหม่
-- 7. Event Command Center — หลังบ้านผู้จัดงาน
-- 8. Artist Store — ร้านขายของศิลปิน

begin;

-- ============================================================================
-- 5. BOOKING BOARD
-- ============================================================================
create table if not exists public.booking_cards (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.profiles(user_id) on delete cascade,
  stage_name text not null check (char_length(stage_name) between 1 and 80),
  role text not null check (role in ('dj','rapper','producer','photographer','vj','crew','other')),
  role_label text not null,
  rate_minor bigint not null check (rate_minor >= 0),
  rate_unit text not null check (char_length(rate_unit) <= 60),
  city text not null default 'กรุงเทพฯ',
  availability_note text not null default 'ว่างรับงาน',
  is_immediate boolean not null default true,
  bio text not null default '' check (char_length(bio) <= 2000),
  portfolio_sample text not null default '',
  is_pro boolean not null default false,
  gigs_completed integer not null default 0 check (gigs_completed >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (artist_id, role)
);

create table if not exists public.booking_offers (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.booking_cards(id) on delete cascade,
  client_id uuid not null references public.profiles(user_id) on delete restrict,
  event_title text not null check (char_length(event_title) between 1 and 180),
  event_date text not null,
  venue_location text not null,
  offered_budget_minor bigint not null check (offered_budget_minor > 0),
  commission_rate numeric(4,2) not null default 0.10 check (commission_rate between 0 and 1),
  commission_minor bigint not null default 0,
  artist_payout_minor bigint not null check (artist_payout_minor >= 0),
  details text not null default '',
  status text not null default 'pending' check (status in ('pending','accepted','closed','declined','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- 6. FOLLOW & DROP ALERT
-- ============================================================================
create table if not exists public.venue_follows (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, venue_id)
);

create table if not exists public.drop_alerts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(user_id) on delete cascade,
  drop_type text not null check (drop_type in ('music','event','ticket','venue','announcement')),
  title text not null check (char_length(title) between 1 and 200),
  detail_text text not null check (char_length(detail_text) <= 3000),
  is_promoted boolean not null default false,
  promo_tier text check (promo_tier is null or promo_tier in ('starter','rotation','headline')),
  action_label text not null default 'ดูรายละเอียด',
  action_url text not null default '',
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 7. EVENT COMMAND CENTER
-- ============================================================================
create table if not exists public.event_expenses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  category text not null check (category in ('venue','artist','sound_lights','crew','marketing','other')),
  title text not null check (char_length(title) between 1 and 200),
  amount_minor bigint not null check (amount_minor >= 0),
  is_paid boolean not null default true,
  receipt_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.event_crew (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid references public.profiles(user_id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  role text not null check (char_length(role) between 1 and 80),
  phone text not null default '',
  duty_status text not null default 'pending' check (duty_status in ('pending','on-duty','completed')),
  created_at timestamptz not null default now()
);

create table if not exists public.event_summaries (
  event_id uuid primary key references public.events(id) on delete cascade,
  gross_ticket_revenue_minor bigint not null default 0,
  total_expenses_minor bigint not null default 0,
  net_profit_minor bigint not null default 0,
  peak_hour_note text not null default '',
  total_checked_in integer not null default 0,
  retrospective_notes text not null default '',
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- 8. ARTIST STORE
-- ============================================================================
create table if not exists public.artist_products (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.profiles(user_id) on delete cascade,
  title text not null check (char_length(title) between 1 and 180),
  category text not null check (category in ('merch','tape_cd','beats','art','other')),
  product_type text not null check (product_type in ('physical','digital')),
  price_minor bigint not null check (price_minor >= 0),
  stock integer check (stock is null or stock >= 0),
  image_url text not null default '',
  preview_audio_url text,
  digital_asset_key text,
  description text not null default '',
  platform_fee_percent numeric(4,2) not null default 5.00,
  is_active boolean not null default true,
  sales_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.artist_store_orders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.artist_products(id) on delete restrict,
  buyer_id uuid not null references public.profiles(user_id) on delete restrict,
  price_minor bigint not null check (price_minor >= 0),
  platform_fee_minor bigint not null check (platform_fee_minor >= 0),
  artist_payout_minor bigint not null check (artist_payout_minor >= 0),
  product_type text not null check (product_type in ('physical','digital')),
  shipping_address text,
  download_token text,
  status text not null default 'paid' check (status in ('pending','paid','shipped','delivered','refunded')),
  created_at timestamptz not null default now()
);

-- Indexes for performance
create index if not exists booking_cards_role_idx on public.booking_cards (role, rate_minor);
create index if not exists booking_offers_card_idx on public.booking_offers (card_id, status);
create index if not exists drop_alerts_created_idx on public.drop_alerts (created_at desc);
create index if not exists event_expenses_event_idx on public.event_expenses (event_id);
create index if not exists event_crew_event_idx on public.event_crew (event_id);
create index if not exists artist_products_artist_idx on public.artist_products (artist_id, category);
create index if not exists artist_store_orders_buyer_idx on public.artist_store_orders (buyer_id, created_at desc);

-- Row Level Security
alter table public.booking_cards enable row level security;
alter table public.booking_offers enable row level security;
alter table public.venue_follows enable row level security;
alter table public.drop_alerts enable row level security;
alter table public.event_expenses enable row level security;
alter table public.event_crew enable row level security;
alter table public.event_summaries enable row level security;
alter table public.artist_products enable row level security;
alter table public.artist_store_orders enable row level security;

-- Read policies
create policy booking_cards_read on public.booking_cards for select using (true);
create policy drop_alerts_read on public.drop_alerts for select using (true);
create policy artist_products_read on public.artist_products for select using (is_active = true);
create policy venue_follows_read on public.venue_follows for select using (auth.uid() = user_id);

commit;
