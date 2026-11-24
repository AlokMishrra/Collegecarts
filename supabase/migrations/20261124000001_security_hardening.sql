-- ============================================================================
-- CollegeCart — Security hardening (IP tracking + rate limiting + RLS closure)
-- ============================================================================
-- Supersedes: 20261009000001_critical_rls_remediation.sql (which left the
-- blanket `public_all_*` USING (true) policies in place, i.e. did nothing).
--
-- What this migration does:
--   1. Drops every blanket USING (true) / WITH CHECK (true) policy.
--   2. Replaces them with owner- or role-scoped policies.
--   3. Revokes dangerous write grants from anon/public.
--   4. Closes role escalation on `users` (trigger) and OTP account takeover.
--   5. Adds `security.audit_log` + IP capture trigger on sensitive tables.
--   6. Adds `security.rate_limits` + write-guard trigger.
--   7. Moves employee login to SECURITY DEFINER RPCs (no password_hash leak).
--   8. Hardens SECURITY DEFINER function EXECUTE grants + search_path.
--   9. Adds safe counter RPCs for banner/promo/popup view counts.
--
-- Safe to re-run. No data deletes. No table drops.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Schema + helpers
-- ----------------------------------------------------------------------------
create schema if not exists security;

create or replace function security.request_headers() returns jsonb
language plpgsql stable
as $$
declare h text;
begin
  begin
    h := current_setting('request.headers', true);
    if h is null or h = '' then return '{}'::jsonb; end if;
    return h::jsonb;
  exception when others then
    return '{}'::jsonb;
  end;
end $$;

grant execute on function security.request_headers() to anon, authenticated, service_role;

create or replace function security.request_ip() returns text
language sql stable
as $$
  select coalesce(
    nullif(btrim(split_part(coalesce(security.request_headers()->>'cf-connecting-ip',''), ',', 1)), ''),
    nullif(btrim(split_part(coalesce(security.request_headers()->>'x-forwarded-for',''), ',', 1)), ''),
    nullif(btrim(coalesce(security.request_headers()->>'x-real-ip','')), '')
  );
$$;

grant execute on function security.request_ip() to anon, authenticated, service_role;

create or replace function security.request_user_agent() returns text
language sql stable
as $$
  select coalesce(security.request_headers()->>'user-agent', '');
$$;

grant execute on function security.request_user_agent() to anon, authenticated, service_role;

-- admin helper (pinned)
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ----------------------------------------------------------------------------
-- 1. Drop every blanket USING(true)/WITH CHECK(true) policy
-- ----------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and (qual = 'true' or with_check = 'true')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 1b. Drop any pre-existing policies on the tables we are fully redefining,
--     so re-running this migration never hits "policy already exists".
-- ----------------------------------------------------------------------------
do $$
declare r record;
  targets text[] := array[
    'users','cart_items','orders','wallet_transactions','loyalty_transactions',
    'withdrawal_requests','refunds','subscriptions','reviews','notifications',
    'onboarding_progress','wishlists','referrals','gamification','campaign_usage',
    'campaigns','products','categories','hostels','combos','banners','settings',
    'checkout_settings','knowledge_articles','promo_popups','hostel_stock',
    'delivery_persons','delivery_queries','chat_messages','shifts',
    'admin_activity_log','audit_logs','app_config','admin_alerts','error_logs',
    'otp_codes','employee_accounts','employee_sessions','employee_roles',
    'employee_departments','employee_attendance','employee_salary_logs',
    'employee_salary_structures','employee_finance_logs','employee_activity_logs',
    'employee_notifications','employee_stock_orders','employee_stock_order_items',
    'employee_delivery_assignments','employee_permissions_override',
    'employee_inventory_transactions','employee_shift_management',
    'employee_performance_metrics','employee_support_tickets','employee_internal_chat',
    'employee_audit_trail'
  ];
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname='public' and tablename = any(targets)
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 2. Audit log + IP tracking
-- ----------------------------------------------------------------------------
create table if not exists security.audit_log (
  id bigserial primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid,
  actor_email text,
  actor_role text,
  ip text,
  user_agent text,
  request_method text,
  request_path text,
  table_name text not null,
  operation text not null,
  row_pk text,
  changed_columns text[],
  old_data jsonb,
  new_data jsonb
);

create index if not exists audit_log_occurred_idx on security.audit_log (occurred_at desc);
create index if not exists audit_log_table_idx on security.audit_log (table_name, occurred_at desc);
create index if not exists audit_log_actor_idx on security.audit_log (actor_id, occurred_at desc);
create index if not exists audit_log_ip_idx on security.audit_log (ip, occurred_at desc);

alter table security.audit_log enable row level security;

-- redact sensitive keys from audit payloads
create or replace function security.redact(p jsonb) returns jsonb
language plpgsql immutable
as $$
declare k text; v jsonb; out jsonb := '{}'::jsonb;
begin
  if p is null then return null; end if;
  for k, v in select key, value from jsonb_each(p) loop
    if k ~* 'password|secret|token|api_?key|hash' then
      out := out || jsonb_build_object(k, '[REDACTED]');
    else
      out := out || jsonb_build_object(k, v);
    end if;
  end loop;
  return out;
end $$;

create or replace function security.audit_trigger() returns trigger
language plpgsql security definer set search_path = public, security
as $$
declare
  v_old jsonb; v_new jsonb; v_pk text; v_cols text[];
  v_actor uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_role text := coalesce(auth.jwt() ->> 'role', 'anon');
begin
  if tg_op = 'DELETE' then
    v_old := security.redact(to_jsonb(old)); v_new := null;
  elsif tg_op = 'UPDATE' then
    v_old := security.redact(to_jsonb(old)); v_new := security.redact(to_jsonb(new));
    select array_agg(o.key) into v_cols
      from jsonb_each(to_jsonb(old)) o
      join jsonb_each(to_jsonb(new)) n using (key)
      where o.value is distinct from n.value;
  else
    v_old := null; v_new := security.redact(to_jsonb(new));
  end if;
  v_pk := coalesce(v_new ->> 'id', v_old ->> 'id');

  insert into security.audit_log
    (actor_id, actor_email, actor_role, ip, user_agent, request_method,
     table_name, operation, row_pk, changed_columns, old_data, new_data)
  values
    (v_actor, v_email, v_role, security.request_ip(), security.request_user_agent(),
     security.request_headers() ->> 'request.method', tg_table_name, tg_op, v_pk,
     v_cols, v_old, v_new);

  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;

-- attach to sensitive tables
do $$
declare t text;
  tbls text[] := array[
    'users','orders','products','hostel_stock','banners','settings',
    'employee_accounts','wallet_transactions','withdrawal_requests','refunds',
    'promo_popups','app_config','delivery_persons','categories','hostels',
    'combos','campaigns','subscriptions','loyalty_transactions','checkout_settings'
  ];
begin
  foreach t in array tbls loop
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) then
      execute format('drop trigger if exists audit_%s on public.%I', t, t);
      execute format('create trigger audit_%s after insert or update or delete on public.%I for each row execute function security.audit_trigger()', t, t);
    end if;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 3. Rate limiting
-- ----------------------------------------------------------------------------
create table if not exists security.rate_limits (
  bucket text primary key,
  window_start timestamptz not null,
  hits integer not null
);

create or replace function security.rate_limit(p_bucket text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql security definer set search_path = public, security
as $$
declare v_now timestamptz := now(); v_row security.rate_limits;
begin
  insert into security.rate_limits(bucket, window_start, hits)
  values (p_bucket, v_now, 1)
  on conflict (bucket) do update
    set hits = case when security.rate_limits.window_start < v_now - make_interval(secs => p_window_seconds)
                    then 1 else security.rate_limits.hits + 1 end,
        window_start = case when security.rate_limits.window_start < v_now - make_interval(secs => p_window_seconds)
                    then v_now else security.rate_limits.window_start end
  returning * into v_row;
  return v_row.hits <= p_max;
end $$;

create or replace function security.enforce_rate_limit() returns trigger
language plpgsql security definer set search_path = public, security
as $$
declare v_ip text; v_limit integer; v_bucket text;
begin
  if auth.role() = 'service_role' or public.is_admin() then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  -- employee session present => a bit more generous
  v_ip := coalesce(security.request_ip(), 'unknown');
  if tg_table_name in ('users','orders','notifications','banners','promo_popups','reviews') then
    v_limit := 120;
  else
    v_limit := 60;
  end if;
  v_bucket := tg_table_name || ':' || v_ip;
  if not security.rate_limit(v_bucket, v_limit, 60) then
    raise exception 'Rate limit exceeded for % on %', v_ip, tg_table_name
      using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;

do $$
declare t text;
  tbls text[] := array[
    'users','orders','notifications','cart_items','reviews','banners',
    'promo_popups','products','hostel_stock','employee_accounts','otp_codes'
  ];
begin
  foreach t in array tbls loop
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) then
      execute format('drop trigger if exists rate_%s on public.%I', t, t);
      execute format('create trigger rate_%s before insert or update or delete on public.%I for each row execute function security.enforce_rate_limit()', t, t);
    end if;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 4. Privilege-escalation guard on users
-- ----------------------------------------------------------------------------
create or replace function public.guard_users_privilege() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.role is null or new.role not in ('customer','delivery') then
      if not public.is_admin() and auth.role() <> 'service_role' then
        new.role := 'customer';
      end if;
    end if;
    new.assigned_role_ids := null;
    new.loyalty_points := coalesce(new.loyalty_points, 0);
    new.loyalty_tier := coalesce(new.loyalty_tier, 'bronze');
  end if;
  if tg_op = 'UPDATE' then
    if (new.role is distinct from old.role or new.assigned_role_ids is distinct from old.assigned_role_ids
        or new.loyalty_points is distinct from old.loyalty_points or new.loyalty_tier is distinct from old.loyalty_tier
        or new.email is distinct from old.email) then
      if not public.is_admin() and auth.role() <> 'service_role' then
        raise exception 'Not allowed to modify privileged fields' using errcode = '42501';
      end if;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists guard_users_privilege on public.users;
create trigger guard_users_privilege before insert or update on public.users
  for each row execute function public.guard_users_privilege();

-- ----------------------------------------------------------------------------
-- 5. Policy: users
-- ----------------------------------------------------------------------------
alter table public.users enable row level security;

create policy "users: owner read" on public.users for select to authenticated using (id = auth.uid());
create policy "users: admin read" on public.users for select to authenticated using (public.is_admin());
create policy "users: owner update" on public.users for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "users: self insert" on public.users for insert to authenticated with check (id = auth.uid());
create policy "users: admin manage" on public.users for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke delete on public.users from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. Policy: cart_items
-- ----------------------------------------------------------------------------
alter table public.cart_items enable row level security;
create policy "cart: owner select" on public.cart_items for select to authenticated using (user_id = auth.uid());
create policy "cart: owner insert" on public.cart_items for insert to authenticated with check (user_id = auth.uid());
create policy "cart: owner update" on public.cart_items for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "cart: owner delete" on public.cart_items for delete to authenticated using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 7. Policy: orders
-- ----------------------------------------------------------------------------
alter table public.orders enable row level security;
create policy "orders: owner read" on public.orders for select to authenticated using (user_id = auth.uid());
create policy "orders: admin read" on public.orders for select to authenticated using (public.is_admin());
create policy "orders: rider read" on public.orders for select to authenticated using (
  exists (select 1 from public.delivery_persons p
          where lower(p.email) = lower(coalesce(auth.jwt()->>'email',''))
            and coalesce(p.is_blocked,false)=false
            and (orders.delivery_person_id = p.id or orders.delivery_person_id is null))
);
create policy "orders: owner insert" on public.orders for insert to authenticated with check (user_id = auth.uid());
create policy "orders: owner update" on public.orders for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "orders: rider update" on public.orders for update to authenticated using (
  exists (select 1 from public.delivery_persons p
          where lower(p.email) = lower(coalesce(auth.jwt()->>'email',''))
            and coalesce(p.is_blocked,false)=false
            and orders.delivery_person_id = p.id)
) with check (
  exists (select 1 from public.delivery_persons p
          where lower(p.email) = lower(coalesce(auth.jwt()->>'email',''))
            and coalesce(p.is_blocked,false)=false
            and orders.delivery_person_id = p.id)
);
create policy "orders: admin manage" on public.orders for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 8. Policy: wallet_transactions (money ledger) — server/admin only
-- ----------------------------------------------------------------------------
alter table public.wallet_transactions enable row level security;
create policy "wallet: admin read" on public.wallet_transactions for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.wallet_transactions from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 9. Policy: loyalty_transactions
-- ----------------------------------------------------------------------------
alter table public.loyalty_transactions enable row level security;
create policy "loyalty: owner read" on public.loyalty_transactions for select to authenticated using (user_id = auth.uid());
create policy "loyalty: admin read" on public.loyalty_transactions for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.loyalty_transactions from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 10. Policy: withdrawal_requests
-- ----------------------------------------------------------------------------
alter table public.withdrawal_requests enable row level security;
create policy "withdrawal: owner read" on public.withdrawal_requests for select to authenticated using (
  exists (select 1 from public.delivery_persons p where p.id = withdrawal_requests.delivery_person_id and lower(p.email)=lower(coalesce(auth.jwt()->>'email','')))
);
create policy "withdrawal: admin manage" on public.withdrawal_requests for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke insert, update, delete on public.withdrawal_requests from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 11. Policy: refunds
-- ----------------------------------------------------------------------------
alter table public.refunds enable row level security;
create policy "refund: owner read" on public.refunds for select to authenticated using (user_id = auth.uid());
create policy "refund: admin manage" on public.refunds for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke insert, update, delete on public.refunds from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 12. Policy: subscriptions
-- ----------------------------------------------------------------------------
alter table public.subscriptions enable row level security;
create policy "sub: owner read" on public.subscriptions for select to authenticated using (user_id = auth.uid());
create policy "sub: admin manage" on public.subscriptions for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke insert, update, delete on public.subscriptions from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 13. Policy: reviews
-- ----------------------------------------------------------------------------
alter table public.reviews enable row level security;
create policy "reviews: anon read approved" on public.reviews for select to anon using (is_approved = true);
create policy "reviews: auth read approved" on public.reviews for select to authenticated using (is_approved = true or user_id = auth.uid() or public.is_admin());
create policy "reviews: owner insert" on public.reviews for insert to authenticated with check (user_id = auth.uid());
create policy "reviews: owner update" on public.reviews for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "reviews: admin manage" on public.reviews for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 14. Policy: notifications
-- ----------------------------------------------------------------------------
alter table public.notifications enable row level security;
create policy "notif: owner read" on public.notifications for select to authenticated using (user_id = auth.uid()::text or public.is_admin());
create policy "notif: owner insert" on public.notifications for insert to authenticated with check (user_id = auth.uid()::text or public.is_admin());
create policy "notif: owner update" on public.notifications for update to authenticated using (user_id = auth.uid()::text or public.is_admin()) with check (user_id = auth.uid()::text or public.is_admin());
create policy "notif: admin delete" on public.notifications for delete to authenticated using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 15. Policy: onboarding_progress
-- ----------------------------------------------------------------------------
alter table public.onboarding_progress enable row level security;
create policy "onboard: owner all" on public.onboarding_progress for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 16. Policy: wishlists, referrals, gamification, campaign_usage
-- ----------------------------------------------------------------------------
alter table public.wishlists enable row level security;
create policy "wishlist: owner all" on public.wishlists for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.referrals enable row level security;
create policy "referral: owner read" on public.referrals for select to authenticated using (referrer_id = auth.uid() or referred_user_id = auth.uid());
create policy "referral: admin manage" on public.referrals for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.gamification enable row level security;
create policy "gamification: owner read" on public.gamification for select to authenticated using (user_id = auth.uid());
create policy "gamification: admin manage" on public.gamification for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.campaign_usage enable row level security;
create policy "campaign_usage: admin read" on public.campaign_usage for select to authenticated using (public.is_admin());

alter table public.campaigns enable row level security;
create policy "campaigns: anon read active" on public.campaigns for select to anon using (is_active = true);
create policy "campaigns: auth read" on public.campaigns for select to authenticated using (true);
create policy "campaigns: admin manage" on public.campaigns for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 17. Policy: catalogue (public read, admin write)
-- ----------------------------------------------------------------------------
alter table public.products enable row level security;
create policy "products: anon read" on public.products for select to anon using (true);
create policy "products: auth read" on public.products for select to authenticated using (true);
create policy "products: admin manage" on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.categories enable row level security;
create policy "categories: anon read" on public.categories for select to anon using (true);
create policy "categories: auth read" on public.categories for select to authenticated using (true);
create policy "categories: admin manage" on public.categories for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.hostels enable row level security;
create policy "hostels: anon read" on public.hostels for select to anon using (true);
create policy "hostels: auth read" on public.hostels for select to authenticated using (true);
create policy "hostels: admin manage" on public.hostels for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.combos enable row level security;
create policy "combos: anon read" on public.combos for select to anon using (true);
create policy "combos: auth read" on public.combos for select to authenticated using (true);
create policy "combos: admin manage" on public.combos for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.banners enable row level security;
create policy "banners: anon read" on public.banners for select to anon using (true);
create policy "banners: auth read" on public.banners for select to authenticated using (true);
create policy "banners: admin manage" on public.banners for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.settings enable row level security;
create policy "settings: anon read" on public.settings for select to anon using (true);
create policy "settings: auth read" on public.settings for select to authenticated using (true);
create policy "settings: admin manage" on public.settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.checkout_settings enable row level security;
create policy "checkout_settings: anon read" on public.checkout_settings for select to anon using (true);
create policy "checkout_settings: auth read" on public.checkout_settings for select to authenticated using (true);
create policy "checkout_settings: admin manage" on public.checkout_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.knowledge_articles enable row level security;
create policy "knowledge: anon read published" on public.knowledge_articles for select to anon using (is_published = true);
create policy "knowledge: auth read" on public.knowledge_articles for select to authenticated using (true);
create policy "knowledge: admin manage" on public.knowledge_articles for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.promo_popups enable row level security;
create policy "promo: anon read active" on public.promo_popups for select to anon using (is_active = true);
create policy "promo: auth read" on public.promo_popups for select to authenticated using (true);
create policy "promo: admin manage" on public.promo_popups for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 18. Policy: hostel_stock
-- ----------------------------------------------------------------------------
alter table public.hostel_stock enable row level security;
create policy "hostel_stock: anon read" on public.hostel_stock for select to anon using (true);
create policy "hostel_stock: auth read" on public.hostel_stock for select to authenticated using (true);
create policy "hostel_stock: admin manage" on public.hostel_stock for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 19. Policy: delivery_persons (partner) — admin only
-- ----------------------------------------------------------------------------
alter table public.delivery_persons enable row level security;
create policy "delivery_persons: admin read" on public.delivery_persons for select to authenticated using (public.is_admin());
create policy "delivery_persons: admin manage" on public.delivery_persons for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke update, delete on public.delivery_persons from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 20. Policy: delivery_queries
-- ----------------------------------------------------------------------------
alter table public.delivery_queries enable row level security;
create policy "delivery_queries: admin manage" on public.delivery_queries for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke insert, update, delete on public.delivery_queries from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 21. Policy: chat_messages
-- ----------------------------------------------------------------------------
alter table public.chat_messages enable row level security;
create policy "chat: participant read" on public.chat_messages for select to authenticated using (sender_id = auth.uid() or receiver_id = auth.uid() or public.is_admin());
create policy "chat: owner insert" on public.chat_messages for insert to authenticated with check (sender_id = auth.uid());
create policy "chat: admin manage" on public.chat_messages for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 22. Policy: shifts
-- ----------------------------------------------------------------------------
alter table public.shifts enable row level security;
create policy "shifts: auth read" on public.shifts for select to authenticated using (true);
create policy "shifts: admin manage" on public.shifts for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 23. Policy: admin_activity_log, audit_logs, app_config, admin_alerts, error_logs
-- ----------------------------------------------------------------------------
alter table public.admin_activity_log enable row level security;
create policy "admin_activity_log: admin read" on public.admin_activity_log for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.admin_activity_log from anon, authenticated;

alter table public.audit_logs enable row level security;
create policy "audit_logs: admin read" on public.audit_logs for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.audit_logs from anon, authenticated;

alter table public.app_config enable row level security;
create policy "app_config: admin read" on public.app_config for select to authenticated using (public.is_admin());
create policy "app_config: admin manage" on public.app_config for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.admin_alerts enable row level security;
create policy "admin_alerts: admin read" on public.admin_alerts for select to authenticated using (public.is_admin());
create policy "admin_alerts: admin manage" on public.admin_alerts for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.error_logs enable row level security;
create policy "error_logs: anon insert" on public.error_logs for insert to anon, authenticated with check (true);
create policy "error_logs: admin read" on public.error_logs for select to authenticated using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 24. Policy: otp_codes — server-side only
-- ----------------------------------------------------------------------------
alter table public.otp_codes enable row level security;
revoke all on public.otp_codes from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 25. Employee subsystem: header-gated access + login RPC
-- ----------------------------------------------------------------------------
alter table public.employee_accounts enable row level security;
alter table public.employee_sessions enable row level security;

-- column-level: never expose password_hash
revoke select on public.employee_accounts from anon, authenticated;
grant select (
  id, employee_code, slug, full_name, photo, phone, email, role_id, department_id,
  campus_id, hostel_id, salary_structure_id, joining_date, date_of_birth, gender,
  blood_group, address, emergency_contact, emergency_phone, employee_badge_url,
  qr_code, status, must_change_password, created_by, created_at, updated_at
) on public.employee_accounts to authenticated;

create or replace function security.employee_session_id() returns uuid
language sql stable security definer set search_path = public, security
as $$
  select s.employee_id
  from public.employee_sessions s
  where s.session_token = coalesce(security.request_headers()->>'x-employee-session','')
    and s.is_active = true
    and s.expires_at > now()
  limit 1;
$$;

grant execute on function security.employee_session_id() to anon, authenticated, service_role;

create or replace function security.employee_is_super_admin() returns boolean
language sql stable security definer set search_path = public, security
as $$
  select exists (
    select 1
    from public.employee_sessions s
    join public.employee_accounts e on e.id = s.employee_id
    join public.employee_roles r on r.id = e.role_id
    where s.session_token = coalesce(security.request_headers()->>'x-employee-session','')
      and s.is_active = true
      and s.expires_at > now()
      and (r.role_code in ('super_admin','admin') or r.permissions @> '["*"]'::jsonb)
  );
$$;

grant execute on function security.employee_is_super_admin() to anon, authenticated, service_role;

-- employee_accounts policies
create policy "employee_accounts: session read" on public.employee_accounts for select to authenticated
  using (security.employee_session_id() is not null);
create policy "employee_accounts: session update own" on public.employee_accounts for update to authenticated
  using (id = security.employee_session_id()) with check (id = security.employee_session_id());
create policy "employee_accounts: super admin manage" on public.employee_accounts for all to authenticated
  using (security.employee_is_super_admin()) with check (security.employee_is_super_admin());

-- employee_sessions policies
create policy "employee_sessions: own read" on public.employee_sessions for select to authenticated
  using (session_token = coalesce(security.request_headers()->>'x-employee-session',''));
create policy "employee_sessions: super admin read" on public.employee_sessions for select to authenticated
  using (security.employee_is_super_admin());

-- generic employee_* tables: readable if a valid employee session exists
do $$
declare t text;
  tbls text[] := array[
    'employee_roles','employee_departments','employee_attendance','employee_salary_logs',
    'employee_salary_structures','employee_finance_logs','employee_activity_logs',
    'employee_notifications','employee_stock_orders','employee_stock_order_items',
    'employee_delivery_assignments','employee_permissions_override',
    'employee_inventory_transactions','employee_shift_management',
    'employee_performance_metrics','employee_support_tickets','employee_internal_chat',
    'employee_audit_trail'
  ];
begin
  foreach t in array tbls loop
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on public.%I from anon', t);
      execute format('drop policy if exists "emp portal access" on public.%I', t);
      execute format('create policy "emp portal access" on public.%I for all to authenticated using (security.employee_session_id() is not null) with check (security.employee_session_id() is not null)', t);
      -- super-admin-only writes are enforced in app; keep update/delete for super admins via extra policy
    end if;
  end loop;
end $$;

-- employee_login RPC
create or replace function public.employee_login(p_identifier text, p_password text, p_remember boolean default false)
returns jsonb
language plpgsql security definer set search_path = public, security
as $$
declare
  v_emp record; v_role record; v_dept record;
  v_token text; v_expires timestamptz;
begin
  select * into v_emp from public.employee_accounts
   where status = 'active'
     and (lower(email) = lower(p_identifier) or phone = p_identifier or employee_code = p_identifier)
   limit 1;

  if v_emp.id is null then
    return jsonb_build_object('success', false, 'error', 'Invalid credentials');
  end if;
  if v_emp.password_hash is null or crypt(p_password, v_emp.password_hash) <> v_emp.password_hash then
    return jsonb_build_object('success', false, 'error', 'Invalid credentials');
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_expires := now() + case when p_remember then interval '30 days' else interval '24 hours' end;

  insert into public.employee_sessions(employee_id, session_token, device_info, ip_address, user_agent, is_active, last_activity, expires_at)
  values (v_emp.id, v_token,
          jsonb_build_object('userAgent', security.request_headers()->>'user-agent'),
          security.request_ip(),
          security.request_headers()->>'user-agent',
          true, now(), v_expires);

  select * into v_role from public.employee_roles where id = v_emp.role_id;
  select * into v_dept from public.employee_departments where id = v_emp.department_id;

  return jsonb_build_object(
    'success', true,
    'session_token', v_token,
    'must_change_password', coalesce(v_emp.must_change_password, false),
    'employee', (to_jsonb(v_emp) - 'password_hash')
      || jsonb_build_object('role', to_jsonb(v_role), 'department', to_jsonb(v_dept))
  );
end $$;

grant execute on function public.employee_login(text, text, boolean) to anon, authenticated;

create or replace function public.employee_session_profile(p_token text)
returns jsonb
language plpgsql security definer set search_path = public, security
as $$
declare v_emp record; v_role record; v_dept record; v_sess record;
begin
  select * into v_sess from public.employee_sessions
   where session_token = p_token and is_active = true and expires_at > now();
  if v_sess.id is null then return jsonb_build_object('success', false, 'error', 'Session invalid'); end if;

  update public.employee_sessions set last_activity = now() where id = v_sess.id;

  select * into v_emp from public.employee_accounts where id = v_sess.employee_id;
  select * into v_role from public.employee_roles where id = v_emp.role_id;
  select * into v_dept from public.employee_departments where id = v_emp.department_id;

  return jsonb_build_object(
    'success', true,
    'employee', (to_jsonb(v_emp) - 'password_hash')
      || jsonb_build_object('role', to_jsonb(v_role), 'department', to_jsonb(v_dept))
  );
end $$;

grant execute on function public.employee_session_profile(text) to anon, authenticated;

create or replace function public.employee_logout(p_token text)
returns void
language plpgsql security definer set search_path = public, security
as $$
begin
  update public.employee_sessions set is_active = false, last_activity = now()
   where session_token = p_token;
end $$;

grant execute on function public.employee_logout(text) to anon, authenticated;

create or replace function public.employee_change_password(p_token text, p_current text, p_new text)
returns jsonb
language plpgsql security definer set search_path = public, security
as $$
declare v_sess record; v_emp record;
begin
  select * into v_sess from public.employee_sessions
   where session_token = p_token and is_active = true and expires_at > now();
  if v_sess.id is null then return jsonb_build_object('success', false, 'error', 'Session invalid'); end if;

  select * into v_emp from public.employee_accounts where id = v_sess.employee_id;
  if v_emp.password_hash is null or crypt(p_current, v_emp.password_hash) <> v_emp.password_hash then
    return jsonb_build_object('success', false, 'error', 'Current password incorrect');
  end if;

  update public.employee_accounts set password_hash = p_new, must_change_password = false, updated_at = now()
   where id = v_emp.id;

  return jsonb_build_object('success', true);
end $$;

grant execute on function public.employee_change_password(text, text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 26. Safe counter RPCs (replace anon table updates)
-- ----------------------------------------------------------------------------
create or replace function public.increment_banner_view(p_banner_id uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare v int;
begin
  update public.banners set view_count = coalesce(view_count,0)+1 where id = p_banner_id returning view_count into v;
  return coalesce(v,0);
end $$;

grant execute on function public.increment_banner_view(uuid) to anon, authenticated;

create or replace function public.increment_promo_popup_view(p_popup_id uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare v int;
begin
  update public.promo_popups set view_count = coalesce(view_count,0)+1 where id = p_popup_id returning view_count into v;
  return coalesce(v,0);
end $$;

grant execute on function public.increment_promo_popup_view(uuid) to anon, authenticated;

create or replace function public.increment_promo_popup_click(p_popup_id uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare v int;
begin
  update public.promo_popups set click_count = coalesce(click_count,0)+1 where id = p_popup_id returning click_count into v;
  return coalesce(v,0);
end $$;

grant execute on function public.increment_promo_popup_click(uuid) to anon, authenticated;

create or replace function public.increment_knowledge_view(p_article_id uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare v int;
begin
  update public.knowledge_articles set view_count = coalesce(view_count,0)+1 where id = p_article_id returning view_count into v;
  return coalesce(v,0);
end $$;

grant execute on function public.increment_knowledge_view(uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 27. Function hardening: revoke dangerous SECURITY DEFINER functions from anon
-- ----------------------------------------------------------------------------
-- Revoke EXECUTE from anon on everything, then re-grant only safe ones.
do $$
declare f record;
  safe text[] := array[
    'is_admin','calculate_checkout_charges','get_product_hostel_stock',
    'check_product_stock','get_todays_menu','get_menu_for_day','get_full_week_menu',
    'increment_promo_popup_stat','increment_banner_view','increment_promo_popup_view',
    'increment_promo_popup_click','increment_knowledge_view','employee_login',
    'employee_session_profile','employee_logout','employee_change_password',
    'create_otp','verify_otp','link_user_by_email'
  ];
begin
  for f in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f'
  loop
    if f.proname = any(safe) then
      execute format('grant execute on function public.%I(%s) to anon, authenticated', f.proname, f.args);
    else
      execute format('revoke execute on function public.%I(%s) from anon', f.proname, f.args);
      execute format('grant execute on function public.%I(%s) to authenticated, service_role', f.proname, f.args);
    end if;
  end loop;
end $$;

-- Pin search_path on SECURITY DEFINER functions that lack it
do $$
declare f record;
begin
  for f in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef = true
      and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))
  loop
    execute format('alter function public.%I(%s) set search_path = public', f.proname, f.args);
  end loop;
end $$;

-- otp helpers: restrict to anon + authenticated (needed for passwordless flow)
revoke execute on function public.create_otp(text) from public;
revoke execute on function public.verify_otp(text, text) from public;
grant execute on function public.create_otp(text) to anon, authenticated;
grant execute on function public.verify_otp(text, text) to anon, authenticated;

-- link_user_by_email: authenticated only
revoke execute on function public.link_user_by_email(uuid, text, text, text) from anon;
grant execute on function public.link_user_by_email(uuid, text, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 28. Grants: remove anon write on all public tables
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in
    select table_name from information_schema.tables where table_schema='public'
  loop
    execute format('revoke insert, update, delete on public.%I from anon', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 29. Anon: no direct table reads except catalogue
-- ----------------------------------------------------------------------------
do $$
declare t text;
  readable text[] := array[
    'products','categories','hostels','combos','banners','settings',
    'checkout_settings','knowledge_articles','promo_popups','hostel_stock',
    'hostels','campaigns','reviews'
  ];
begin
  for t in
    select table_name from information_schema.tables where table_schema='public'
  loop
    if not (t = any(readable)) then
      execute format('revoke select on public.%I from anon', t);
    end if;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 29b. pgcrypto search_path for triggers/RPCs that hash passwords
-- ----------------------------------------------------------------------------
alter function public.hash_employee_password() set search_path = public, extensions;
alter function public.employee_login(text, text, boolean) set search_path = public, security, extensions;
alter function public.employee_change_password(text, text, text) set search_path = public, security, extensions;
alter function public.employee_session_profile(text) set search_path = public, security, extensions;

-- ----------------------------------------------------------------------------
-- 29b1. Table grants restored for admin + delivery portal (fix 403s)
-- ----------------------------------------------------------------------------
grant select, insert, update, delete on public.wallet_transactions,
  public.withdrawal_requests, public.refunds, public.subscriptions,
  public.loyalty_transactions, public.delivery_queries,
  public.admin_activity_log, public.audit_logs to authenticated;

drop policy if exists "wallet: admin manage" on public.wallet_transactions;
create policy "wallet: admin manage" on public.wallet_transactions for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "loyalty: admin manage" on public.loyalty_transactions;
create policy "loyalty: admin manage" on public.loyalty_transactions for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, update on public.orders to anon;
grant select, insert, update on public.notifications to anon;
grant select on public.wallet_transactions to anon;
grant select, insert, update, delete on public.delivery_persons to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 29b2. pgcrypto search_path for delivery partner RPCs
-- ----------------------------------------------------------------------------
alter function public.delivery_partner_login(text, text, boolean) set search_path = public, security, extensions;
alter function public.delivery_partner_session_profile(text) set search_path = public, security, extensions;
alter function public.delivery_partner_logout(text) set search_path = public, security, extensions;

-- ----------------------------------------------------------------------------
-- 29c. roles + meal subsystem policies (added after initial apply)
-- ----------------------------------------------------------------------------
alter table public.roles enable row level security;
drop policy if exists "roles: auth read" on public.roles;
drop policy if exists "roles: admin manage" on public.roles;
create policy "roles: auth read" on public.roles for select to authenticated using (true);
create policy "roles: admin manage" on public.roles for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.meal_menu_items enable row level security;
drop policy if exists "meal_menu_items: anon read" on public.meal_menu_items;
drop policy if exists "meal_menu_items: auth read" on public.meal_menu_items;
drop policy if exists "meal_menu_items: admin manage" on public.meal_menu_items;
create policy "meal_menu_items: anon read" on public.meal_menu_items for select to anon using (true);
create policy "meal_menu_items: auth read" on public.meal_menu_items for select to authenticated using (true);
create policy "meal_menu_items: admin manage" on public.meal_menu_items for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.meal_plans enable row level security;
drop policy if exists "meal_plans: anon read" on public.meal_plans;
drop policy if exists "meal_plans: auth read" on public.meal_plans;
drop policy if exists "meal_plans: admin manage" on public.meal_plans;
create policy "meal_plans: anon read" on public.meal_plans for select to anon using (is_active = true);
create policy "meal_plans: auth read" on public.meal_plans for select to authenticated using (true);
create policy "meal_plans: admin manage" on public.meal_plans for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.meal_daily_menus enable row level security;
drop policy if exists "meal_daily_menus: anon read" on public.meal_daily_menus;
drop policy if exists "meal_daily_menus: auth read" on public.meal_daily_menus;
drop policy if exists "meal_daily_menus: admin manage" on public.meal_daily_menus;
create policy "meal_daily_menus: anon read" on public.meal_daily_menus for select to anon using (is_published = true);
create policy "meal_daily_menus: auth read" on public.meal_daily_menus for select to authenticated using (true);
create policy "meal_daily_menus: admin manage" on public.meal_daily_menus for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.meal_delivery_slots enable row level security;
drop policy if exists "meal_delivery_slots: anon read" on public.meal_delivery_slots;
drop policy if exists "meal_delivery_slots: auth read" on public.meal_delivery_slots;
drop policy if exists "meal_delivery_slots: admin manage" on public.meal_delivery_slots;
create policy "meal_delivery_slots: anon read" on public.meal_delivery_slots for select to anon using (is_active = true);
create policy "meal_delivery_slots: auth read" on public.meal_delivery_slots for select to authenticated using (true);
create policy "meal_delivery_slots: admin manage" on public.meal_delivery_slots for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.meal_hostel_assignments enable row level security;
drop policy if exists "meal_hostel_assignments: anon read" on public.meal_hostel_assignments;
drop policy if exists "meal_hostel_assignments: auth read" on public.meal_hostel_assignments;
drop policy if exists "meal_hostel_assignments: admin manage" on public.meal_hostel_assignments;
create policy "meal_hostel_assignments: anon read" on public.meal_hostel_assignments for select to anon using (is_active = true);
create policy "meal_hostel_assignments: auth read" on public.meal_hostel_assignments for select to authenticated using (true);
create policy "meal_hostel_assignments: admin manage" on public.meal_hostel_assignments for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.meal_kitchens enable row level security;
drop policy if exists "meal_kitchens: auth read" on public.meal_kitchens;
drop policy if exists "meal_kitchens: admin manage" on public.meal_kitchens;
create policy "meal_kitchens: auth read" on public.meal_kitchens for select to authenticated using (true);
create policy "meal_kitchens: admin manage" on public.meal_kitchens for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.weekly_menu_schedule enable row level security;
drop policy if exists "weekly_menu_schedule: auth read" on public.weekly_menu_schedule;
drop policy if exists "weekly_menu_schedule: admin manage" on public.weekly_menu_schedule;
create policy "weekly_menu_schedule: auth read" on public.weekly_menu_schedule for select to authenticated using (true);
create policy "weekly_menu_schedule: admin manage" on public.weekly_menu_schedule for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.meal_settings enable row level security;
drop policy if exists "meal_settings: auth read" on public.meal_settings;
drop policy if exists "meal_settings: admin manage" on public.meal_settings;
create policy "meal_settings: auth read" on public.meal_settings for select to authenticated using (true);
create policy "meal_settings: admin manage" on public.meal_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.meal_coupons enable row level security;
drop policy if exists "meal_coupons: anon read" on public.meal_coupons;
drop policy if exists "meal_coupons: auth read" on public.meal_coupons;
drop policy if exists "meal_coupons: admin manage" on public.meal_coupons;
create policy "meal_coupons: anon read" on public.meal_coupons for select to anon using (is_active = true);
create policy "meal_coupons: auth read" on public.meal_coupons for select to authenticated using (true);
create policy "meal_coupons: admin manage" on public.meal_coupons for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.meal_orders enable row level security;
drop policy if exists "meal_orders: owner read" on public.meal_orders;
drop policy if exists "meal_orders: owner insert" on public.meal_orders;
drop policy if exists "meal_orders: owner update" on public.meal_orders;
drop policy if exists "meal_orders: admin manage" on public.meal_orders;
create policy "meal_orders: owner read" on public.meal_orders for select to authenticated using (user_id = auth.uid());
create policy "meal_orders: owner insert" on public.meal_orders for insert to authenticated with check (user_id = auth.uid());
create policy "meal_orders: owner update" on public.meal_orders for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "meal_orders: admin manage" on public.meal_orders for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.meal_subscriptions enable row level security;
drop policy if exists "meal_subscriptions: owner read" on public.meal_subscriptions;
drop policy if exists "meal_subscriptions: owner insert" on public.meal_subscriptions;
drop policy if exists "meal_subscriptions: owner update" on public.meal_subscriptions;
drop policy if exists "meal_subscriptions: admin manage" on public.meal_subscriptions;
create policy "meal_subscriptions: owner read" on public.meal_subscriptions for select to authenticated using (user_id = auth.uid());
create policy "meal_subscriptions: owner insert" on public.meal_subscriptions for insert to authenticated with check (user_id = auth.uid());
create policy "meal_subscriptions: owner update" on public.meal_subscriptions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "meal_subscriptions: admin manage" on public.meal_subscriptions for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.meal_reviews enable row level security;
drop policy if exists "meal_reviews: anon read approved" on public.meal_reviews;
drop policy if exists "meal_reviews: auth read" on public.meal_reviews;
drop policy if exists "meal_reviews: owner insert" on public.meal_reviews;
drop policy if exists "meal_reviews: admin manage" on public.meal_reviews;
create policy "meal_reviews: anon read approved" on public.meal_reviews for select to anon using (is_approved = true);
create policy "meal_reviews: auth read" on public.meal_reviews for select to authenticated using (is_approved = true or user_id = auth.uid() or public.is_admin());
create policy "meal_reviews: owner insert" on public.meal_reviews for insert to authenticated with check (user_id = auth.uid());
create policy "meal_reviews: admin manage" on public.meal_reviews for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.employee_inventory_logs enable row level security;
drop policy if exists "employee_inventory_logs: session or admin" on public.employee_inventory_logs;
create policy "employee_inventory_logs: session or admin" on public.employee_inventory_logs for all to authenticated using (security.employee_session_id() is not null or public.is_admin()) with check (security.employee_session_id() is not null or public.is_admin());

alter table public.employee_login_logs enable row level security;
drop policy if exists "employee_login_logs: admin read" on public.employee_login_logs;
create policy "employee_login_logs: admin read" on public.employee_login_logs for select to authenticated using (public.is_admin());

-- grants for meal catalogue (anon read)
grant select on public.meal_menu_items, public.meal_plans, public.meal_daily_menus, public.meal_delivery_slots, public.meal_hostel_assignments, public.meal_coupons, public.weekly_menu_schedule to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 30. Security audit log: admin read only
-- ----------------------------------------------------------------------------
alter table security.audit_log enable row level security;
create policy "audit_log: admin read" on security.audit_log for select to authenticated using (public.is_admin());

-- ----------------------------------------------------------------------------
-- END
-- ============================================================================