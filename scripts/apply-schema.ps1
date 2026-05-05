# apply-schema.ps1
# Applies the CollegeCart schema to Supabase
# Run from project root: powershell -ExecutionPolicy Bypass -File scripts/apply-schema.ps1

$SUPABASE_URL = "https://vbbdzhuzwgiipsnssmxq.supabase.co"
$SERVICE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiYmR6aHV6d2dpaXBzbnNzbXhxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM1MDE5MSwiZXhwIjoyMDkyOTI2MTkxfQ.JLU7gEOPhPQxqzs0B-tZ1uwmnwmQkPtY7XSEL6gcLDc"

$headers = @{
    "apikey"        = $SERVICE_KEY
    "Authorization" = "Bearer $SERVICE_KEY"
    "Content-Type"  = "application/json"
}

function Run-SQL($sql) {
    $body = [System.Text.Encoding]::UTF8.GetBytes(
        (ConvertTo-Json @{ query = $sql } -Compress)
    )
    try {
        $r = Invoke-WebRequest `
            -Uri "$SUPABASE_URL/rest/v1/rpc/run_sql" `
            -Method POST -Headers $headers -Body $body `
            -UseBasicParsing -TimeoutSec 15
        return @{ ok = $true; status = $r.StatusCode }
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        $msg  = $_.ErrorDetails.Message
        return @{ ok = $false; status = $code; msg = $msg }
    }
}

# ---- All SQL statements ----
$statements = @(
    "create extension if not exists `"uuid-ossp`"",

    "create table if not exists public.users (id uuid primary key default uuid_generate_v4(), email text unique not null, full_name text, phone_number text, role text default 'customer', selected_hostel text, loyalty_tier text default 'Bronze', assigned_role_ids text[] default '{}', avatar_url text, created_at timestamptz default now(), updated_at timestamptz default now())",

    "alter table public.users enable row level security",
    "do `$`$ begin if not exists (select 1 from pg_policies where tablename='users' and policyname='Users can read own data') then create policy `"Users can read own data`" on public.users for select using (auth.uid() = id); end if; end `$`$",
    "do `$`$ begin if not exists (select 1 from pg_policies where tablename='users' and policyname='Users can update own data') then create policy `"Users can update own data`" on public.users for update using (auth.uid() = id); end if; end `$`$",

    "create table if not exists public.categories (id uuid primary key default uuid_generate_v4(), name text not null, description text, image_url text, is_active boolean default true, display_order integer default 0, created_at timestamptz default now())",
    "alter table public.categories enable row level security",
    "do `$`$ begin if not exists (select 1 from pg_policies where tablename='categories' and policyname='Anyone can read categories') then create policy `"Anyone can read categories`" on public.categories for select using (true); end if; end `$`$",

    "create table if not exists public.products (id uuid primary key default uuid_generate_v4(), name text not null, description text, price numeric not null, image_url text, category_id uuid references public.categories(id), is_available boolean default true, stock_quantity integer default 0, hostel_stock jsonb default '{}', average_rating numeric default 0, review_count integer default 0, available_from text, available_to text, delivery_charge numeric default 0, dhaba_options jsonb default '[]', display_order integer default 0, created_at timestamptz default now(), updated_at timestamptz default now())",
    "alter table public.products enable row level security",
    "do `$`$ begin if not exists (select 1 from pg_policies where tablename='products' and policyname='Anyone can read available products') then create policy `"Anyone can read available products`" on public.products for select using (true); end if; end `$`$",

    "create table if not exists public.combos (id uuid primary key default uuid_generate_v4(), name text not null, description text, image_url text, product_ids text[] default '{}', product_names text[] default '{}', price numeric not null, original_price numeric, is_active boolean default true, display_order integer default 0, created_at timestamptz default now())",
    "alter table public.combos enable row level security",
    "do `$`$ begin if not exists (select 1 from pg_policies where tablename='combos' and policyname='Anyone can read combos') then create policy `"Anyone can read combos`" on public.combos for select using (true); end if; end `$`$",

    "create table if not exists public.cart_items (id uuid primary key default uuid_generate_v4(), user_id uuid references public.users(id) on delete cascade, product_id uuid references public.products(id) on delete cascade, quantity integer not null default 1, created_at timestamptz default now(), updated_at timestamptz default now(), unique(user_id, product_id))",
    "alter table public.cart_items enable row level security",
    "do `$`$ begin if not exists (select 1 from pg_policies where tablename='cart_items' and policyname='Users can manage own cart') then create policy `"Users can manage own cart`" on public.cart_items for all using (auth.uid() = user_id); end if; end `$`$",

    "create table if not exists public.orders (id uuid primary key default uuid_generate_v4(), user_id uuid references public.users(id), order_number text unique not null, customer_name text not null, items jsonb not null default '[]', total_amount numeric not null, delivery_address text not null, phone_number text, delivery_notes text, status text default 'pending', payment_method text default 'cash', is_paid boolean default false, payment_id text, delivery_otp text, delivery_person_id uuid, created_at timestamptz default now(), updated_at timestamptz default now())",
    "alter table public.orders enable row level security",
    "do `$`$ begin if not exists (select 1 from pg_policies where tablename='orders' and policyname='Users can read own orders') then create policy `"Users can read own orders`" on public.orders for select using (auth.uid() = user_id); end if; end `$`$",
    "do `$`$ begin if not exists (select 1 from pg_policies where tablename='orders' and policyname='Users can create orders') then create policy `"Users can create orders`" on public.orders for insert with check (auth.uid() = user_id); end if; end `$`$",
    "do `$`$ begin if not exists (select 1 from pg_policies where tablename='orders' and policyname='Users can update own orders') then create policy `"Users can update own orders`" on public.orders for update using (auth.uid() = user_id); end if; end `$`$",

    "create table if not exists public.delivery_persons (id uuid primary key default uuid_generate_v4(), name text not null, email text unique not null, password text not null, phone_number text, vehicle_type text, assigned_hostel text default 'All', is_available boolean default true, is_blocked boolean default false, current_orders text[] default '{}', total_deliveries integer default 0, total_earnings numeric default 0, lifetime_earnings numeric default 0, current_shift text, wallet_balance numeric default 0, today_earnings numeric default 0, created_at timestamptz default now(), updated_at timestamptz default now())",
    "alter table public.delivery_persons enable row level security",
    "do `$`$ begin if not exists (select 1 from pg_policies where tablename='delivery_persons' and policyname='Anyone can read delivery persons') then create policy `"Anyone can read delivery persons`" on public.delivery_persons for select using (true); end if; end `$`$",

    "create table if not exists public.notifications (id uuid primary key default uuid_generate_v4(), user_id text not null, title text not null, message text, type text default 'info', is_read boolean default false, created_at timestamptz default now())",
    "alter table public.notifications enable row level security",
    "do `$`$ begin if not exists (select 1 from pg_policies where tablename='notifications' and policyname='Users can read own notifications') then create policy `"Users can read own notifications`" on public.notifications for select using (auth.uid()::text = user_id); end if; end `$`$",
    "do `$`$ begin if not exists (select 1 from pg_policies where tablename='notifications' and policyname='Anyone can create notifications') then create policy `"Anyone can create notifications`" on public.notifications for insert with check (true); end if; end `$`$",
    "do `$`$ begin if not exists (select 1 from pg_policies where tablename='notifications' and policyname='Users can update own notifications') then create policy `"Users can update own notifications`" on public.notifications for update using (auth.uid()::text = user_id); end if; end `$`$",

    "create table if not exists public.loyalty_transactions (id uuid primary key default uuid_generate_v4(), user_id uuid references public.users(id), points integer not null, transaction_type text, order_id uuid references public.orders(id), description text, balance_after integer, created_at timestamptz default now())",
    "alter table public.loyalty_transactions enable row level security",
    "do `$`$ begin if not exists (select 1 from pg_policies where tablename='loyalty_transactions' and policyname='Users can read own loyalty') then create policy `"Users can read own loyalty`" on public.loyalty_transactions for select using (auth.uid() = user_id); end if; end `$`$",
    "do `$`$ begin if not exists (select 1 from pg_policies where tablename='loyalty_transactions' and policyname='Anyone can create loyalty transactions') then create policy `"Anyone can create loyalty transactions`" on public.loyalty_transactions for insert with check (true); end if; end `$`$",

    "create table if not exists public.campaigns (id uuid primary key default uuid_generate_v4(), name text not null, code text unique not null, discount_type text, discount_value numeric default 0, min_order_amount numeric default 0, usage_limit integer, usage_per_user integer default 1, usage_count integer default 0, total_revenue numeric default 0, total_discount_given numeric default 0, is_active boolean default true, start_date timestamptz, end_date timestamptz, created_at timestamptz default now())",
    "alter table public.campaigns enable row level security",
    "do `$`$ begin if not exists (select 1 from pg_policies where tablename='campaigns' and policyname='Anyone can read active campaigns') then create policy `"Anyone can read active campaigns`" on public.campaigns for select using (true); end if; end `$`$",

    "create table if not exists public.campaign_usage (id uuid primary key default uuid_generate_v4(), campaign_id uuid references public.campaigns(id), user_id uuid references public.users(id), order_id uuid references public.orders(id), discount_amount numeric, order_amount numeric, created_at timestamptz default now())",
    "alter table public.campaign_usage enable row level security",
    "do `$`$ begin if not exists (select 1 from pg_policies where tablename='campaign_usage' and policyname='Users can read own usage') then create policy `"Users can read own usage`" on public.campaign_usage for select using (auth.uid() = user_id); end if; end `$`$",
    "do `$`$ begin if not exists (select 1 from pg_policies where tablename='campaign_usage' and policyname='Anyone can create usage') then create policy `"Anyone can create usage`" on public.campaign_usage for insert with check (true); end if; end `$`$",

    "create table if not exists public.subscriptions (id uuid primary key default uuid_generate_v4(), user_id uuid references public.users(id), plan_name text, status text default 'active', start_date timestamptz default now(), end_date timestamptz, amount_paid numeric, payment_id text, created_at timestamptz default now())",
    "alter table public.subscriptions enable row level security",
    "do `$`$ begin if not exists (select 1 from pg_policies where tablename='subscriptions' and policyname='Users can read own subscriptions') then create policy `"Users can read own subscriptions`" on public.subscriptions for select using (auth.uid() = user_id); end if; end `$`$",
    "do `$`$ begin if not exists (select 1 from pg_policies where tablename='subscriptions' and policyname='Anyone can create subscriptions') then create policy `"Anyone can create subscriptions`" on public.subscriptions for insert with check (true); end if; end `$`$",

    "create table if not exists public.refunds (id uuid primary key default uuid_generate_v4(), order_id uuid references public.orders(id), user_id uuid references public.users(id), reason text, amount numeric, status text default 'pending', admin_notes text, created_at timestamptz default now(), updated_at timestamptz default now())",
    "alter table public.refunds enable row level security",
    "do `$`$ begin if not exists (select 1 from pg_policies where tablename='refunds' and policyname='Users can read own refunds') then create policy `"Users can read own refunds`" on public.refunds for select using (auth.uid() = user_id); end if; end `$`$",
    "do `$`$ begin if not exists (select 1 from pg_policies where tablename='refunds' and policyname='Users can create refunds') then create policy `"Users can create refunds`" on public.refunds for insert with check (auth.uid() = user_id); end if; end `$`$",

    "create table if not exists public.roles (id uuid primary key default uuid_generate_v4(), name text not null, permissions text[] default '{}', description text, created_at timestamptz default now())",
    "alter table public.roles enable row level security",
    "do `$`$ begin if not exists (select 1 from pg_policies where tablename='roles' and policyname='Anyone can read roles') then create policy `"Anyone can read roles`" on public.roles for select using (true); end if; end `$`$",

    "create table if not exists public.banners (id uuid primary key default uuid_generate_v4(), title text, subtitle text, image_url text, link_url text, is_active boolean default true, display_order integer default 0, start_date timestamptz, end_date timestamptz, view_count integer default 0, click_count integer default 0, created_at timestamptz default now())",
    "alter table public.banners enable row level security",
    "do `$`$ begin if not exists (select 1 from pg_policies where tablename='banners' and policyname='Anyone can read banners') then create policy `"Anyone can read banners`" on public.banners for select using (true); end if; end `$`$",

    "create table if not exists public.reviews (id uuid primary key default uuid_generate_v4(), product_id uuid references public.products(id), user_id uuid references public.users(id), rating integer not null check (rating >= 1 and rating <= 5), comment text, is_approved boolean default false, created_at timestamptz default now())",
    "alter table public.reviews enable row level security",
    "do `$`$ begin if not exists (select 1 from pg_policies where tablename='reviews' and policyname='Anyone can read approved reviews') then create policy `"Anyone can read approved reviews`" on public.reviews for select using (is_approved = true); end if; end `$`$",
    "do `$`$ begin if not exists (select 1 from pg_policies where tablename='reviews' and policyname='Users can create reviews') then create policy `"Users can create reviews`" on public.reviews for insert with check (auth.uid() = user_id); end if; end `$`$",

    "create table if not exists public.settings (id uuid primary key default uuid_generate_v4(), shipping_charge numeric default 0, free_delivery_above numeric default 500, first_order_threshold numeric default 100, store_name text, store_description text, store_upi_id text, is_online boolean default true, created_at timestamptz default now(), updated_at timestamptz default now())",
    "alter table public.settings enable row level security",
    "do `$`$ begin if not exists (select 1 from pg_policies where tablename='settings' and policyname='Anyone can read settings') then create policy `"Anyone can read settings`" on public.settings for select using (true); end if; end `$`$",

    "create table if not exists public.referrals (id uuid primary key default uuid_generate_v4(), referrer_id uuid references public.users(id), referrer_email text, referred_email text, referred_user_id uuid references public.users(id), referral_code text unique not null, status text default 'pending', referrer_rewarded boolean default false, referred_rewarded boolean default false, created_at timestamptz default now())",
    "alter table public.referrals enable row level security",
    "do `$`$ begin if not exists (select 1 from pg_policies where tablename='referrals' and policyname='Anyone can create referrals') then create policy `"Anyone can create referrals`" on public.referrals for insert with check (true); end if; end `$`$",

    "create table if not exists public.wallet_transactions (id uuid primary key default uuid_generate_v4(), delivery_person_id uuid references public.delivery_persons(id), type text, amount numeric not null, order_id uuid references public.orders(id), description text, created_at timestamptz default now())",
    "alter table public.wallet_transactions enable row level security",
    "do `$`$ begin if not exists (select 1 from pg_policies where tablename='wallet_transactions' and policyname='Anyone can read wallet transactions') then create policy `"Anyone can read wallet transactions`" on public.wallet_transactions for select using (true); end if; end `$`$",
    "do `$`$ begin if not exists (select 1 from pg_policies where tablename='wallet_transactions' and policyname='Anyone can create wallet transactions') then create policy `"Anyone can create wallet transactions`" on public.wallet_transactions for insert with check (true); end if; end `$`$",

    "create table if not exists public.chat_messages (id uuid primary key default uuid_generate_v4(), sender_id uuid references public.users(id), receiver_id uuid references public.users(id), conversation_id text, message text not null, is_read boolean default false, created_at timestamptz default now())",
    "alter table public.chat_messages enable row level security",
    "do `$`$ begin if not exists (select 1 from pg_policies where tablename='chat_messages' and policyname='Users can read own messages') then create policy `"Users can read own messages`" on public.chat_messages for select using (auth.uid() = sender_id or auth.uid() = receiver_id); end if; end `$`$",
    "do `$`$ begin if not exists (select 1 from pg_policies where tablename='chat_messages' and policyname='Users can send messages') then create policy `"Users can send messages`" on public.chat_messages for insert with check (auth.uid() = sender_id); end if; end `$`$",

    "create table if not exists public.knowledge_articles (id uuid primary key default uuid_generate_v4(), title text not null, content text, category text, is_published boolean default true, helpful_count integer default 0, created_at timestamptz default now())",
    "alter table public.knowledge_articles enable row level security",
    "do `$`$ begin if not exists (select 1 from pg_policies where tablename='knowledge_articles' and policyname='Anyone can read published articles') then create policy `"Anyone can read published articles`" on public.knowledge_articles for select using (is_published = true); end if; end `$`$",

    "create table if not exists public.gamification (id uuid primary key default uuid_generate_v4(), user_id uuid references public.users(id) unique, total_points integer default 0, badges text[] default '{}', streak_days integer default 0, last_order_date timestamptz, created_at timestamptz default now(), updated_at timestamptz default now())",
    "alter table public.gamification enable row level security",
    "do `$`$ begin if not exists (select 1 from pg_policies where tablename='gamification' and policyname='Anyone can manage gamification') then create policy `"Anyone can manage gamification`" on public.gamification for all using (true); end if; end `$`$",

    "create table if not exists public.onboarding_progress (id uuid primary key default uuid_generate_v4(), user_id uuid references public.users(id) unique, role text, completed_steps text[] default '{}', current_step text, is_completed boolean default false, skip_onboarding boolean default false, created_at timestamptz default now())",
    "alter table public.onboarding_progress enable row level security",
    "do `$`$ begin if not exists (select 1 from pg_policies where tablename='onboarding_progress' and policyname='Users can manage own onboarding') then create policy `"Users can manage own onboarding`" on public.onboarding_progress for all using (auth.uid() = user_id); end if; end `$`$",

    "create table if not exists public.admin_activity_log (id uuid primary key default uuid_generate_v4(), admin_id uuid references public.users(id), action text not null, entity_type text, entity_id text, details jsonb, created_at timestamptz default now())",
    "alter table public.admin_activity_log enable row level security",
    "do `$`$ begin if not exists (select 1 from pg_policies where tablename='admin_activity_log' and policyname='Anyone can create activity log') then create policy `"Anyone can create activity log`" on public.admin_activity_log for insert with check (true); end if; end `$`$",

    "create table if not exists public.shifts (id uuid primary key default uuid_generate_v4(), name text not null, start_time text, end_time text, is_active boolean default true, created_at timestamptz default now())",
    "alter table public.shifts enable row level security",
    "do `$`$ begin if not exists (select 1 from pg_policies where tablename='shifts' and policyname='Anyone can read shifts') then create policy `"Anyone can read shifts`" on public.shifts for select using (true); end if; end `$`$",

    "insert into public.settings (shipping_charge, free_delivery_above, first_order_threshold, store_name, is_online) select 30, 500, 100, 'CollegeCart', true where not exists (select 1 from public.settings)",

    "do `$`$ begin if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='orders') then alter publication supabase_realtime add table public.orders; end if; end `$`$",
    "do `$`$ begin if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='notifications') then alter publication supabase_realtime add table public.notifications; end if; end `$`$",
    "do `$`$ begin if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='products') then alter publication supabase_realtime add table public.products; end if; end `$`$",
    "do `$`$ begin if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='cart_items') then alter publication supabase_realtime add table public.cart_items; end if; end `$`$"
)

Write-Host "Applying $($statements.Count) SQL statements to Supabase...`n"

$ok = 0; $skip = 0; $fail = 0

foreach ($stmt in $statements) {
    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes(
        (ConvertTo-Json @{ query = "$stmt;" } -Compress)
    )

    try {
        $r = Invoke-WebRequest `
            -Uri "$SUPABASE_URL/rest/v1/rpc/run_sql" `
            -Method POST -Headers $headers -Body $bodyBytes `
            -UseBasicParsing -TimeoutSec 20 -ErrorAction Stop
        $ok++
        Write-Host "  OK  : $($stmt.Substring(0, [Math]::Min(60,$stmt.Length)))..."
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        $msg  = $_.ErrorDetails.Message
        if ($msg -match "already exists|duplicate|does not exist") {
            $skip++
            Write-Host "  SKIP: $($stmt.Substring(0, [Math]::Min(60,$stmt.Length)))..."
        } else {
            $fail++
            Write-Host "  FAIL[$code]: $($stmt.Substring(0, [Math]::Min(60,$stmt.Length)))"
            Write-Host "       $($msg.Substring(0, [Math]::Min(120,$msg.Length)))"
        }
    }
}

Write-Host "`n============================="
Write-Host "Done: $ok OK, $skip skipped, $fail failed"
Write-Host "============================="
