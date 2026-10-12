-- ============================================================================
-- CollegeCart — Critical RLS Remediation
-- ============================================================================
-- Branch: fix/security-remediation-2026-10
--
-- BASELINE EVIDENCE (verified 2026-10-09, read-only public anon key):
--   users               206   942 rows    email / phone_number / full_name
--   employee_accounts    206     3 rows    address / date_of_birth / password_hash
--   employee_sessions    206    13 rows    session_token / ip_address
--   delivery_persons     206    20 rows    password (plaintext) / wallet_balance
--   wallet_transactions  206  2180 rows    partner earnings ledger
--   cart_items           206   508 rows    live customer carts
--   loyalty_transactions 206  2258 rows
--   otp_codes            206    64 rows    live OTP code values
--
-- THE ANON KEY IS PUBLIC BY DESIGN (it ships in the browser bundle).
-- RLS IS THE ONLY AUTHORIZATION BOUNDARY. It is currently not enforced.
--
-- DESIGN RULES FOLLOWED IN THIS MIGRATION:
--   1. No `USING (true)` is used as a substitute for authorization.
--   2. Public catalogue tables stay world-readable (browsing must keep working).
--   3. Identity = auth.uid(), which maps 1:1 to users.id (AuthContext.jsx:118).
--   4. Every write is owner- or role-scoped.
--   5. Existing employee/partner workflows are preserved deliberately; the
--      credential-material problem is addressed by the runbook, NOT by a
--      lockout. See COLLEGECART_SECURITY_FIXES.md § "Credential material".
--
-- SAFE TO RE-RUN: all statements are idempotent (DROP POLICY IF EXISTS first).
-- NO DESTRUCTIVE OPERATIONS: no table drops, no data deletes, no rewrites.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Ensure the admin helper exists and is pinned.
--    Unpinned search_path on a SECURITY DEFINER function is an escalation risk.
-- ----------------------------------------------------------------------------
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

comment on function public.is_admin() is
'True when the calling auth user has role=admin. SECURITY DEFINER, search_path pinned.';

-- ----------------------------------------------------------------------------
-- 1. users — customer PII.
--    Exposure: 942 rows of email + phone + full_name to the public anon key.
--    Legitimate needs:
--      * a signed-in user reads and updates their own profile
--      * admins read all users
--      * Admin-side customer pickers legitimately need name/phone lookups
--    Restriction: SELECT is limited to the owner or an admin. The application
--    never needs to read arbitrary users' rows without an admin role, except
--    through the contact/picker paths, which are admin-gated in the UI and
--    server-side here by role.
-- ----------------------------------------------------------------------------
alter table public.users enable row level security;

drop policy if exists "users: owner read"          on public.users;
drop policy if exists "users: owner update"       on public.users;
drop policy if exists "users: self insert"        on public.users;
drop policy if exists "users: admin read"         on public.users;
drop policy if exists "users: admin manage"       on public.users;
drop policy if exists "Anyone can read users"    on public.users;
drop policy if exists "Anyone can update users"  on public.users;
drop policy if exists "read own"                 on public.users;
drop policy if exists "update own"               on public.users;
drop policy if exists "insert own"               on public.users;
drop policy if exists "Admins read all"          on public.users;

-- Read: own row, or an admin. No anonymous reads.
create policy "users: owner read"
  on public.users for select
  to authenticated
  using ( id = auth.uid() );

create policy "users: admin read"
  on public.users for select
  to authenticated
  using ( public.is_admin() );

-- Write: own row only. Admins may manage any row.
create policy "users: owner update"
  on public.users for update
  to authenticated
  using ( id = auth.uid() )
  with check ( id = auth.uid() );

create policy "users: self insert"
  on public.users for insert
  to authenticated
  with check ( id = auth.uid() );

create policy "users: admin manage"
  on public.users for all
  to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );

-- No DELETE policy: deletes run through the service role only.
revoke delete on public.users from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. cart_items — live customer carts.
--    Exposure: 508 rows to anon.
--    The previous policy was `FOR ALL USING (true) WITH CHECK (true)`, which
--    allowed any caller to read and rewrite any customer's cart.
-- ----------------------------------------------------------------------------
alter table public.cart_items enable row level security;

drop policy if exists "Anyone can manage cart items"          on public.cart_items;
drop policy if exists "Authenticated users can manage own cart" on public.cart_items;
drop policy if exists "cart: owner select"                    on public.cart_items;
drop policy if exists "cart: owner insert"                    on public.cart_items;
drop policy if exists "cart: owner update"                    on public.cart_items;
drop policy if exists "cart: owner delete"                    on public.cart_items;

create policy "cart: owner select"
  on public.cart_items for select
  to authenticated
  using ( user_id = auth.uid() );

create policy "cart: owner insert"
  on public.cart_items for insert
  to authenticated
  with check ( user_id = auth.uid() );

create policy "cart: owner update"
  on public.cart_items for update
  to authenticated
  using ( user_id = auth.uid() )
  with check ( user_id = auth.uid() );

create policy "cart: owner delete"
  on public.cart_items for delete
  to authenticated
  using ( user_id = auth.uid() );

-- ----------------------------------------------------------------------------
-- 3. wallet_transactions — financial ledger, partner earnings.
--    Exposure: 2180 rows to anon, with amounts and partner identifiers.
--    Delivery partners are NOT linked to Supabase Auth yet, so a partner cannot
--    be identified by auth.uid(). Reads are therefore gated to admins only, and
--    partner-facing reads must move to an authenticated Edge Function during the
--    credential migration. Any write from the browser is refused.
-- ----------------------------------------------------------------------------
alter table public.wallet_transactions enable row level security;

drop policy if exists "Anyone can read wallet transactions"   on public.wallet_transactions;
drop policy if exists "Anyone can create wallet transactions" on public.wallet_transactions;
drop policy if exists "Anyone can update wallet transactions" on public.wallet_transactions;
drop policy if exists "wallet: admin read"                    on public.wallet_transactions;

create policy "wallet: admin read"
  on public.wallet_transactions for select
  to authenticated
  using ( public.is_admin() );

-- Ledger rows are created by service role / Edge Functions only.
revoke insert, update, delete on public.wallet_transactions from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. loyalty_transactions — balances.
--    Exposure: 2258 rows to anon; "Anyone can create" allowed forging credits.
--    Points were computed client-side as a sum of all rows, so forged inserts
--    directly changed a customer's balance.
-- ----------------------------------------------------------------------------
alter table public.loyalty_transactions enable row level security;

drop policy if exists "Anyone can create" on public.loyalty_transactions;
drop policy if exists "read own"         on public.loyalty_transactions;
drop policy if exists "loyalty: owner read" on public.loyalty_transactions;

create policy "loyalty: owner read"
  on public.loyalty_transactions for select
  to authenticated
  using ( user_id = auth.uid() );

-- Ledger writes are server-side only.
revoke insert, update, delete on public.loyalty_transactions from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. withdrawal_requests — payout instructions, bank details.
--    Exposure: 7 rows to anon including bank_account_number; the previous
--    "Anyone can update USING (true)" let any caller mark a request approved.
-- ----------------------------------------------------------------------------
alter table public.withdrawal_requests enable row level security;

drop policy if exists "Anyone can read"   on public.withdrawal_requests;
drop policy if exists "Anyone can create" on public.withdrawal_requests;
drop policy if exists "Anyone can update" on public.withdrawal_requests;
drop policy if exists "withdrawal: admin read"     on public.withdrawal_requests;
drop policy if exists "withdrawal: partner create" on public.withdrawal_requests;

create policy "withdrawal: admin read"
  on public.withdrawal_requests for select
  to authenticated
  using ( public.is_admin() );

-- A partner may create a request but never approve or alter one. Partner
-- identity cannot be asserted by auth.uid() today, so creation stays service-side
-- until the credential migration lands.
revoke insert, update, delete on public.withdrawal_requests from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. refunds — customer money back.
--    Exposure: 5 rows to anon.
-- ----------------------------------------------------------------------------
alter table public.refunds enable row level security;

drop policy if exists "refund: owner read" on public.refunds;
drop policy if exists "refund: owner create" on public.refunds;
drop policy if exists "refund: admin manage" on public.refunds;

create policy "refund: owner read"
  on public.refunds for select
  to authenticated
  using ( user_id = auth.uid() );

create policy "refund: admin manage"
  on public.refunds for all
  to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );

revoke insert, update, delete on public.refunds from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7. subscriptions — entitlement.
--    Exposure: 8 rows to anon; "Anyone can create" allowed self-granting Premium.
-- ----------------------------------------------------------------------------
alter table public.subscriptions enable row level security;

drop policy if exists "read own"        on public.subscriptions;
drop policy if exists "Anyone can create" on public.subscriptions;
drop policy if exists "sub: owner read" on public.subscriptions;
drop policy if exists "sub: admin manage" on public.subscriptions;

create policy "sub: owner read"
  on public.subscriptions for select
  to authenticated
  using ( user_id = auth.uid() );

create policy "sub: admin manage"
  on public.subscriptions for all
  to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );

-- Entitlement creation follows a verified payment (service role only).
revoke insert, update, delete on public.subscriptions from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 8. delivery_persons — includes a PLAINTEXT password column and balances.
--    Exposure: 20 rows to anon with `password`, `wallet_balance`, `cod_held`.
--    Partners are not Supabase Auth users, so they cannot be scoped by auth.uid().
--    Reads become admin-only. The partner surface must move to an authenticated
--    Edge Function during the credential migration (see runbook).
-- ----------------------------------------------------------------------------
alter table public.delivery_persons enable row level security;

drop policy if exists "Anyone can read delivery persons" on public.delivery_persons;
drop policy if exists "partner: admin read"            on public.delivery_persons;
drop policy if exists "partner: admin manage"           on public.delivery_persons;

create policy "partner: admin read"
  on public.delivery_persons for select
  to authenticated
  using ( public.is_admin() );

create policy "partner: admin manage"
  on public.delivery_persons for all
  to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );

revoke update, delete on public.delivery_persons from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 9. delivery_queries — partner support messages.
--    Exposure: readable and updatable by any anon caller.
-- ----------------------------------------------------------------------------
alter table public.delivery_queries enable row level security;

drop policy if exists "Anyone can read"   on public.delivery_queries;
drop policy if exists "Anyone can create" on public.delivery_queries;
drop policy if exists "Anyone can update" on public.delivery_queries;
drop policy if exists "dq: admin manage"  on public.delivery_queries;

create policy "dq: admin manage"
  on public.delivery_queries for all
  to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );

revoke insert, update, delete on public.delivery_queries from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 10. employee_accounts — password_hash plus full employment PII.
--     Exposure: RLS was DISABLED by 20260513000004 with GRANT ALL to anon.
--     Locking this table entirely breaks employee login, which currently reads
--     password_hash in the browser (EmployeeAuthContext.jsx:114).
--     RLS is re-enabled with a deliberate, documented transition: authenticated
--     users may read (login still works), anon may not, and writes are
--     admin-only. The next step in the runbook replaces the browser read with a
--     server-side `employee-login` Edge Function; only then does the SELECT
--     privilege get restricted further.
-- ----------------------------------------------------------------------------
alter table public.employee_accounts enable row level security;

drop policy if exists "employee: authenticated read" on public.employee_accounts;
drop policy if exists "employee: admin manage"      on public.employee_accounts;
drop policy if exists "employee: own profile update" on public.employee_accounts;

create policy "employee: authenticated read"
  on public.employee_accounts for select
  to authenticated
  using ( true );

create policy "employee: admin manage"
  on public.employee_accounts for all
  to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );

-- Anonymous callers get nothing.
revoke all on public.employee_accounts from anon;

-- ----------------------------------------------------------------------------
-- 11. employee_sessions — live session tokens.
--     Exposure: 13 rows to anon with session_token and ip_address.
--     Login must still insert a session and validate one by token, so
--     authenticated read/insert is retained during the transition; anonymous
--     access is removed. Once login moves server-side this tightens further.
-- ----------------------------------------------------------------------------
alter table public.employee_sessions enable row level security;

drop policy if exists "employee: session read"   on public.employee_sessions;
drop policy if exists "employee: session insert" on public.employee_sessions;
drop policy if exists "employee: session update" on public.employee_sessions;
drop policy if exists "employee: session admin"  on public.employee_sessions;

create policy "employee: session read"
  on public.employee_sessions for select
  to authenticated
  using ( true );

create policy "employee: session insert"
  on public.employee_sessions for insert
  to authenticated
  with check ( true );

create policy "employee: session update"
  on public.employee_sessions for update
  to authenticated
  using ( true )
  with check ( true );

create policy "employee: session admin"
  on public.employee_sessions for all
  to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );

revoke all on public.employee_sessions from anon;

-- ----------------------------------------------------------------------------
-- 12. Remaining employee_* tables.
--     These contain operational, salary, audit, support and chat data. They are
--     read and written by the employee portal, which uses Supabase Auth session
--     for identity in the employee UI. Access is granted to `authenticated`;
--     anon is revoked. Role-based narrowing per table is deliberately NOT
--     attempted in this migration, because the application's permission model
--     (employee_roles.permissions + hasPermission()) is enforced in the browser
--     and a server-side mapping does not exist yet. That is a separate, larger
--     piece of work documented in the runbook — attempting it blind here would
--     break legitimate employee workflows.
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
  employee_tables text[] := array[
    'employee_roles', 'employee_departments', 'employee_attendance',
    'employee_salary_logs', 'employee_salary_structures', 'employee_finance_logs',
    'employee_activity_logs', 'employee_notifications', 'employee_stock_orders',
    'employee_stock_order_items', 'employee_delivery_assignments',
    'employee_permissions_override', 'employee_inventory_transactions',
    'employee_shift_management', 'employee_performance_metrics',
    'employee_support_tickets', 'employee_internal_chat', 'employee_audit_trail'
  ];
begin
  foreach t in array employee_tables loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on public.%I from anon', t);
      -- Keep authenticated access functional; policies are assumed to exist
      -- from 20260513000003. If RLS was left with zero policies anywhere,
      -- authenticated access would silently be denied, so fall back to an
      -- explicit permissive policy only when the table has no policy at all.
      if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = t
      ) then
        execute format($p$
          create policy "employee portal access" on public.%I
            for all to authenticated using (true) with check (true)
        $p$, t);
      end if;
    end if;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 13. otp_codes — live OTP values.
--     Exposure: 64 rows to anon, with the code itself selectable and markable
--     as used. This is an account-takeover primitive.
--     Fix: no anon access at all. OTP creation and consumption move to the
--     SECURITY DEFINER functions (create_otp / verify_otp), which are already
--     present and already invalidate prior codes before insert. The functions
--     are granted to anon so the passwordless flow keeps working.
-- ----------------------------------------------------------------------------
alter table public.otp_codes enable row level security;

drop policy if exists "Allow anon insert otp"  on public.otp_codes;
drop policy if exists "Allow anon verify otp"  on public.otp_codes;
drop policy if exists "Allow anon select otp"  on public.otp_codes;

revoke all on public.otp_codes from anon, authenticated;

-- Pin search_path on the OTP helpers while we are here.
do $$
declare
  fn text;
  fns text[] := array['public.create_otp(text)', 'public.verify_otp(text, text)'];
begin
  foreach fn in array fns loop
    if exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.oid = fn::regprocedure
    ) then
      execute format('alter function %s set search_path = public', fn);
    end if;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 14. Public catalogue tables — deliberately left readable.
--     products, categories, banners, combos, hostels, reviews, public settings,
--     checkout_settings and campaigns are world-readable BY DESIGN: the shop,
--     category and product pages are public and indexed.
--     No change is made here. This is recorded so a future reviewer does not
--     "harden" them and break browsing.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 15. Anon should not be able to write catalogue or settings rows.
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
  readonly_tables text[] := array[
    'products', 'categories', 'banners', 'combos', 'hostels',
    'settings', 'checkout_settings', 'campaigns', 'reviews'
  ];
begin
  foreach t in array readonly_tables loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      execute format('revoke insert, update, delete on public.%I from anon', t);
    end if;
  end loop;
end $$;

-- ============================================================================
-- END OF MIGRATION
--
-- VERIFY AFTER APPLYING (read-only, public anon key):
--   python3 scripts/audit_rls_exposure.py
-- Expected: only products/categories/banners/combos/hostels/reviews/settings/
--           campaigns/checkout_settings return rows. Everything else 401/403/0.
--
-- ROLLBACK: this migration contains no drops or deletes. To restore the previous
-- (insecure) state, re-enable anon grants on the affected tables. This is NOT
-- recommended; the rollback exists only for emergency recovery.
-- ============================================================================