-- ============================================================
-- CollegeCart - Supabase Schema
-- Run this entire file in Supabase SQL Editor (once)
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- HELPER: is_admin() — security definer to avoid RLS recursion
-- ============================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ============================================================
-- USERS (mirrors Base44 user + custom fields)
-- ============================================================
create table if not exists public.users (
  id uuid primary key default uuid_generate_v4(),
  email text unique,
  phone text unique,
  full_name text,
  phone_number text,
  role text default 'customer', -- 'customer' | 'admin' | 'delivery_person'
  selected_hostel text,
  loyalty_tier text default 'Bronze', -- Bronze | Silver | Gold | Platinum
  loyalty_points integer default 0,
  assigned_role_ids text[] default '{}',
  avatar_url text,
  profile_photo text,
  saved_addresses jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.users enable row level security;
create policy "Users can read own data" on public.users for select using (auth.uid() = id);
create policy "Users can update own data" on public.users for update using (auth.uid() = id);
-- NOTE: Uses is_admin() helper (defined below) to avoid infinite recursion
create policy "Admins can read all users" on public.users for select using (public.is_admin());

-- ============================================================
-- CATEGORIES
-- ============================================================
create table if not exists public.categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  image_url text,
  is_active boolean default true,
  display_order integer default 0,
  created_at timestamptz default now()
);
alter table public.categories enable row level security;
create policy "Anyone can read categories" on public.categories for select using (true);
create policy "Admins can manage categories" on public.categories for all using (public.is_admin());

-- ============================================================
-- PRODUCTS
-- ============================================================
create table if not exists public.products (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  price numeric not null,
  image_url text,
  category_id uuid references public.categories(id),
  is_available boolean default true,
  stock_quantity integer default 0,
  hostel_stock jsonb default '{}', -- { "Mithali": 10, "Gavaskar": 5, ... }
  average_rating numeric default 0,
  review_count integer default 0,
  available_from text, -- "08:00 AM"
  available_to text,   -- "11:00 PM"
  delivery_charge numeric default 0,
  dhaba_options jsonb default '[]', -- [{ dhaba_name, price }]
  display_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.products enable row level security;
create policy "Anyone can read available products" on public.products for select using (true);
create policy "Admins can manage products" on public.products for all using (public.is_admin());

-- ============================================================
-- COMBOS
-- ============================================================
create table if not exists public.combos (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  image_url text,
  product_ids text[] default '{}',
  product_names text[] default '{}',
  price numeric not null,
  original_price numeric,
  is_active boolean default true,
  display_order integer default 0,
  created_at timestamptz default now()
);
alter table public.combos enable row level security;
create policy "Anyone can read combos" on public.combos for select using (true);
create policy "Admins can manage combos" on public.combos for all using (public.is_admin());

-- ============================================================
-- CART ITEMS
-- ============================================================
create table if not exists public.cart_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  quantity integer not null default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, product_id)
);
alter table public.cart_items enable row level security;
create policy "Users can manage own cart" on public.cart_items for all using (auth.uid() = user_id);

-- ============================================================
-- ORDERS
-- ============================================================
create table if not exists public.orders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id),
  order_number text unique not null,
  customer_name text not null,
  items jsonb not null default '[]', -- [{ product_id, product_name, price, quantity, dhaba_name }]
  total_amount numeric not null,
  delivery_address text not null,
  phone_number text,
  delivery_notes text,
  status text default 'pending', -- pending|confirmed|preparing|out_for_delivery|delivered|cancelled|refunded
  payment_method text default 'cash', -- cash | online
  is_paid boolean default false,
  payment_id text,
  delivery_otp text,
  delivery_person_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.orders enable row level security;
create policy "Users can read own orders" on public.orders for select using (auth.uid() = user_id);
create policy "Users can create orders" on public.orders for insert with check (auth.uid() = user_id);
create policy "Users can update own orders" on public.orders for update using (auth.uid() = user_id);
create policy "Admins can manage all orders" on public.orders for all using (public.is_admin());

-- ============================================================
-- DELIVERY PERSONS
-- ============================================================
create table if not exists public.delivery_persons (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text unique not null,
  password text not null,
  phone_number text,
  vehicle_type text, -- bike | scooter | car
  assigned_hostel text default 'All',
  is_available boolean default true,
  is_blocked boolean default false,
  current_orders text[] default '{}',
  total_deliveries integer default 0,
  total_earnings numeric default 0,
  lifetime_earnings numeric default 0,
  current_shift text,
  wallet_balance numeric default 0,
  today_earnings numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.delivery_persons enable row level security;
create policy "Anyone can read delivery persons" on public.delivery_persons for select using (true);
create policy "Admins can manage delivery persons" on public.delivery_persons for all using (public.is_admin());

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id text not null, -- can be user uuid or delivery person email
  title text not null,
  message text,
  type text default 'info', -- info | success | warning | error
  is_read boolean default false,
  created_at timestamptz default now()
);
alter table public.notifications enable row level security;
create policy "Users can read own notifications" on public.notifications for select using (
  auth.uid()::text = user_id
);
create policy "Anyone can create notifications" on public.notifications for insert with check (true);
create policy "Users can update own notifications" on public.notifications for update using (
  auth.uid()::text = user_id
);

-- ============================================================
-- LOYALTY TRANSACTIONS
-- ============================================================
create table if not exists public.loyalty_transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id),
  points integer not null,
  transaction_type text, -- earned | redeemed
  order_id uuid references public.orders(id),
  description text,
  balance_after integer,
  created_at timestamptz default now()
);
alter table public.loyalty_transactions enable row level security;
create policy "Users can read own loyalty" on public.loyalty_transactions for select using (auth.uid() = user_id);
create policy "Anyone can create loyalty transactions" on public.loyalty_transactions for insert with check (true);

-- ============================================================
-- CAMPAIGNS (discount codes)
-- ============================================================
create table if not exists public.campaigns (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  code text unique not null,
  discount_type text, -- percentage | fixed | free_shipping
  discount_value numeric default 0,
  min_order_amount numeric default 0,
  usage_limit integer,
  usage_per_user integer default 1,
  usage_count integer default 0,
  total_revenue numeric default 0,
  total_discount_given numeric default 0,
  is_active boolean default true,
  start_date timestamptz,
  end_date timestamptz,
  created_at timestamptz default now()
);
alter table public.campaigns enable row level security;
create policy "Anyone can read active campaigns" on public.campaigns for select using (true);
create policy "Admins can manage campaigns" on public.campaigns for all using (public.is_admin());

-- ============================================================
-- CAMPAIGN USAGE
-- ============================================================
create table if not exists public.campaign_usage (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references public.campaigns(id),
  user_id uuid references public.users(id),
  order_id uuid references public.orders(id),
  discount_amount numeric,
  order_amount numeric,
  created_at timestamptz default now()
);
alter table public.campaign_usage enable row level security;
create policy "Users can read own usage" on public.campaign_usage for select using (auth.uid() = user_id);
create policy "Anyone can create usage" on public.campaign_usage for insert with check (true);

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
create table if not exists public.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id),
  plan_name text,
  status text default 'active', -- active | expired | cancelled
  start_date timestamptz default now(),
  end_date timestamptz,
  amount_paid numeric,
  payment_id text,
  created_at timestamptz default now()
);
alter table public.subscriptions enable row level security;
create policy "Users can read own subscriptions" on public.subscriptions for select using (auth.uid() = user_id);
create policy "Anyone can create subscriptions" on public.subscriptions for insert with check (true);
create policy "Admins can manage subscriptions" on public.subscriptions for all using (public.is_admin());

-- ============================================================
-- REFUNDS
-- ============================================================
create table if not exists public.refunds (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references public.orders(id),
  user_id uuid references public.users(id),
  reason text,
  amount numeric,
  status text default 'pending', -- pending | approved | rejected
  admin_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.refunds enable row level security;
create policy "Users can read own refunds" on public.refunds for select using (auth.uid() = user_id);
create policy "Users can create refunds" on public.refunds for insert with check (auth.uid() = user_id);
create policy "Admins can manage refunds" on public.refunds for all using (public.is_admin());

-- ============================================================
-- ROLES
-- ============================================================
create table if not exists public.roles (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  permissions text[] default '{}',
  description text,
  created_at timestamptz default now()
);
alter table public.roles enable row level security;
create policy "Anyone can read roles" on public.roles for select using (true);
create policy "Admins can manage roles" on public.roles for all using (public.is_admin());

-- ============================================================
-- BANNERS
-- ============================================================
create table if not exists public.banners (
  id uuid primary key default uuid_generate_v4(),
  title text,
  subtitle text,
  image_url text,
  link_url text,
  is_active boolean default true,
  display_order integer default 0,
  start_date timestamptz,
  end_date timestamptz,
  view_count integer default 0,
  click_count integer default 0,
  created_at timestamptz default now()
);
alter table public.banners enable row level security;
create policy "Anyone can read banners" on public.banners for select using (true);
create policy "Admins can manage banners" on public.banners for all using (public.is_admin());

-- ============================================================
-- REVIEWS
-- ============================================================
create table if not exists public.reviews (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid references public.products(id),
  user_id uuid references public.users(id),
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text,
  is_approved boolean default false,
  created_at timestamptz default now()
);
alter table public.reviews enable row level security;
create policy "Anyone can read approved reviews" on public.reviews for select using (is_approved = true);
create policy "Users can create reviews" on public.reviews for insert with check (auth.uid() = user_id);
create policy "Admins can manage reviews" on public.reviews for all using (public.is_admin());

-- ============================================================
-- SETTINGS
-- ============================================================
create table if not exists public.settings (
  id uuid primary key default uuid_generate_v4(),
  shipping_charge numeric default 0,
  free_delivery_above numeric default 500,
  first_order_threshold numeric default 100,
  store_name text,
  store_description text,
  store_upi_id text,
  is_online boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.settings enable row level security;
create policy "Anyone can read settings" on public.settings for select using (true);
create policy "Admins can manage settings" on public.settings for all using (public.is_admin());

-- ============================================================
-- REFERRALS
-- ============================================================
create table if not exists public.referrals (
  id uuid primary key default uuid_generate_v4(),
  referrer_id uuid references public.users(id),
  referrer_email text,
  referred_email text,
  referred_user_id uuid references public.users(id),
  referral_code text unique not null,
  status text default 'pending', -- pending | rewarded
  referrer_rewarded boolean default false,
  referred_rewarded boolean default false,
  created_at timestamptz default now()
);
alter table public.referrals enable row level security;
create policy "Users can read own referrals" on public.referrals for select using (auth.uid() = referrer_id);
create policy "Anyone can create referrals" on public.referrals for insert with check (true);
create policy "Anyone can update referrals" on public.referrals for update using (true);

-- ============================================================
-- WALLET TRANSACTIONS (delivery partner)
-- ============================================================
create table if not exists public.wallet_transactions (
  id uuid primary key default uuid_generate_v4(),
  delivery_person_id uuid references public.delivery_persons(id),
  type text, -- cod_collection | delivery_earning | withdrawal | top_up
  amount numeric not null,
  order_id uuid references public.orders(id),
  description text,
  created_at timestamptz default now()
);
alter table public.wallet_transactions enable row level security;
create policy "Anyone can read wallet transactions" on public.wallet_transactions for select using (true);
create policy "Anyone can create wallet transactions" on public.wallet_transactions for insert with check (true);

-- ============================================================
-- CHAT MESSAGES
-- ============================================================
create table if not exists public.chat_messages (
  id uuid primary key default uuid_generate_v4(),
  sender_id uuid references public.users(id),
  receiver_id uuid references public.users(id),
  conversation_id text,
  message text not null,
  is_read boolean default false,
  created_at timestamptz default now()
);
alter table public.chat_messages enable row level security;
create policy "Users can read own messages" on public.chat_messages for select using (
  auth.uid() = sender_id or auth.uid() = receiver_id
);
create policy "Users can send messages" on public.chat_messages for insert with check (auth.uid() = sender_id);
create policy "Users can update own messages" on public.chat_messages for update using (
  auth.uid() = receiver_id
);

-- ============================================================
-- KNOWLEDGE ARTICLES
-- ============================================================
create table if not exists public.knowledge_articles (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  content text,
  category text,
  is_published boolean default true,
  helpful_count integer default 0,
  created_at timestamptz default now()
);
alter table public.knowledge_articles enable row level security;
create policy "Anyone can read published articles" on public.knowledge_articles for select using (is_published = true);
create policy "Admins can manage articles" on public.knowledge_articles for all using (public.is_admin());

-- ============================================================
-- GAMIFICATION
-- ============================================================
create table if not exists public.gamification (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) unique,
  total_points integer default 0,
  badges text[] default '{}',
  streak_days integer default 0,
  last_order_date timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.gamification enable row level security;
create policy "Users can read own gamification" on public.gamification for select using (auth.uid() = user_id);
create policy "Anyone can manage gamification" on public.gamification for all using (true);

-- ============================================================
-- ONBOARDING PROGRESS
-- ============================================================
create table if not exists public.onboarding_progress (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) unique,
  role text,
  completed_steps text[] default '{}',
  current_step text,
  is_completed boolean default false,
  skip_onboarding boolean default false,
  created_at timestamptz default now()
);
alter table public.onboarding_progress enable row level security;
create policy "Users can manage own onboarding" on public.onboarding_progress for all using (auth.uid() = user_id);

-- ============================================================
-- ADMIN ACTIVITY LOG
-- ============================================================
create table if not exists public.admin_activity_log (
  id uuid primary key default uuid_generate_v4(),
  admin_id uuid references public.users(id),
  action text not null,
  entity_type text,
  entity_id text,
  details jsonb,
  created_at timestamptz default now()
);
alter table public.admin_activity_log enable row level security;
create policy "Admins can read activity log" on public.admin_activity_log for select using (public.is_admin());
create policy "Anyone can create activity log" on public.admin_activity_log for insert with check (true);

-- ============================================================
-- SHIFTS
-- ============================================================
create table if not exists public.shifts (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  start_time text,
  end_time text,
  is_active boolean default true,
  created_at timestamptz default now()
);
alter table public.shifts enable row level security;
create policy "Anyone can read shifts" on public.shifts for select using (true);
create policy "Admins can manage shifts" on public.shifts for all using (public.is_admin());

-- ============================================================
-- WISHLISTS
-- ============================================================
create table if not exists public.wishlists (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user_id, product_id)
);
alter table public.wishlists enable row level security;
create policy "Users can manage own wishlist" on public.wishlists for all using (auth.uid() = user_id);

-- ============================================================
-- WITHDRAWAL REQUESTS (delivery partner withdrawal/deposit)
-- ============================================================
create table if not exists public.withdrawal_requests (
  id uuid primary key default uuid_generate_v4(),
  delivery_person_id uuid references public.delivery_persons(id) on delete cascade,
  delivery_person_name text,
  amount numeric not null,
  upi_id text,
  transaction_id text,
  type text default 'withdrawal', -- 'withdrawal' | 'deposit'
  status text default 'pending',  -- 'pending' | 'approved' | 'rejected'
  notes text,
  admin_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.withdrawal_requests enable row level security;
create policy "Anyone can read withdrawal requests" on public.withdrawal_requests for select using (true);
create policy "Anyone can create withdrawal requests" on public.withdrawal_requests for insert with check (true);
create policy "Admins can manage withdrawal requests" on public.withdrawal_requests for all using (public.is_admin());
create policy "Anyone can update withdrawal requests" on public.withdrawal_requests for update using (true);

-- ============================================================
-- HOSTELS
-- ============================================================
create table if not exists public.hostels (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  code text,
  block text,
  address text,
  contact_person text,
  contact_phone text,
  total_rooms integer default 0,
  assigned_delivery_persons text[] default '{}',
  delivery_radius_km numeric default 2,
  coordinates jsonb default '{"latitude": 0, "longitude": 0}',
  is_active boolean default true,
  display_order integer default 0,
  created_at timestamptz default now()
);
alter table public.hostels enable row level security;
create policy "Anyone can read hostels" on public.hostels for select using (true);
create policy "Admins can manage hostels" on public.hostels for all using (public.is_admin());

-- ============================================================
-- DELIVERY QUERIES (support tickets from delivery partners)
-- ============================================================
create table if not exists public.delivery_queries (
  id uuid primary key default uuid_generate_v4(),
  delivery_person_id uuid references public.delivery_persons(id) on delete cascade,
  delivery_person_name text,
  subject text not null,
  message text not null,
  status text default 'open', -- 'open' | 'resolved'
  admin_reply text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.delivery_queries enable row level security;
create policy "Anyone can read delivery queries" on public.delivery_queries for select using (true);
create policy "Anyone can create delivery queries" on public.delivery_queries for insert with check (true);
create policy "Admins can manage delivery queries" on public.delivery_queries for all using (public.is_admin());
create policy "Anyone can update delivery queries" on public.delivery_queries for update using (true);

-- ============================================================
-- Insert default settings row
-- ============================================================
insert into public.settings (shipping_charge, free_delivery_above, first_order_threshold, store_name, is_online)
values (30, 500, 100, 'CollegeCart', true)
on conflict do nothing;

-- ============================================================
-- Realtime: enable for key tables
-- ============================================================
do $$
begin
  -- Add tables to realtime publication if not already added
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
  
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
  
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and tablename = 'products'
  ) then
    alter publication supabase_realtime add table public.products;
  end if;
  
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and tablename = 'cart_items'
  ) then
    alter publication supabase_realtime add table public.cart_items;
  end if;
  
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and tablename = 'withdrawal_requests'
  ) then
    alter publication supabase_realtime add table public.withdrawal_requests;
  end if;
end $$;
