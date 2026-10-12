# CollegeCart — Remediation Plan

**Branch:** `fix/security-remediation-2026-10` (rollback point; `main` untouched)
**Status:** In progress — Phase A implemented, Phases B–D implemented where safely possible
**Rule applied:** FIXED AND TESTED / FIX IMPLEMENTED, STAGING VALIDATION REQUIRED / NEEDS MANUAL DASHBOARD ACTION / NOT FIXED — BLOCKER IDENTIFIED

---

## Baseline re-validation (done before any change)

Verification method: read-only `GET` with the **public anon key only** (the key that ships in the browser bundle), no auth header, no service role, no writes. Reproduced the audit exposure live:

| Table | HTTP | Rows visible | Sensitive content confirmed |
|---|---|---|---|
| `users` | 206 | 942 | `email`, `phone_number`, `full_name` — customer PII |
| `employee_accounts` | 206 | 3 | `address`, `date_of_birth`, `blood_group` + `password_hash` column |
| `employee_sessions` | 206 | 13 | `session_token`, `ip_address`, `user_agent` |
| `delivery_persons` | 206 | 20 | `password` (plaintext), `email`, `wallet_balance`, `cod_held` |
| `wallet_transactions` | 206 | 2180 | full partner earnings ledger (`amount`, `delivery_person_id`, `order_id`) |
| `cart_items` | 206 | 508 | live customer carts |
| `loyalty_transactions` | 206 | 2258 | balances |
| `otp_codes` | 206 | 64 | live OTP `code` values |
| `orders` | 200 | 0 | empty; policy state indeterminate |

`exec_sql` **does not exist** in the live schema — the `create-stock-functions` / `setup-stock-functions` / `reload-schema` Edge Functions are inert DDL helpers. **FIXED by evidence; no action needed.**

---

## P0 — Security / Financial Integrity

| # | Finding | Status |
|---|---|---|
| P0-1 | `users` PII readable by anon | **FIX IMPLEMENTED — STAGING VALIDATION REQUIRED** |
| P0-2 | `employee_accounts` / `employee_sessions` readable by anon (RLS disabled + `GRANT ALL`) | **FIX IMPLEMENTED — STAGING VALIDATION REQUIRED** |
| P0-3 | `delivery_persons` incl. plaintext `password` + `wallet_balance` readable by anon | **FIX IMPLEMENTED — STAGING VALIDATION REQUIRED** |
| P0-4 | `wallet_transactions`, `loyalty_transactions`, `cart_items`, `otp_codes` readable by anon | **FIX IMPLEMENTED — STAGING VALIDATION REQUIRED** |
| P0-5 | `verify-cod-payment`, `create-razorpay-cod-order`, `verify-razorpay-cod-payment`, `create-razorpay-qr`, `create-wallet-topup-payment`, `verify-wallet-topup` — 18 service-role Edge Functions with **no auth check** | **FIX IMPLEMENTED — STAGING VALIDATION REQUIRED** (Edge Functions cannot be deployed without dashboard approval) |
| P0-6 | `razorpay-webhook` signature check is **conditional** (`if (SECRET && signature)`) — fails open | **FIXED AND TESTED (local build + signature unit test)** |
| P0-7 | `orders.total_amount` / `is_paid` client-supplied; payment never compared to computed total | **FIX IMPLEMENTED — STAGING VALIDATION REQUIRED** |
| P0-8 | `Subscription.jsx:205-233` shows Premium success before entitlement persists | **FIXED AND TESTED** (UI now reflects verified outcome) |
| P0-9 | Duplicate commission credit; unique index commented out | **FIX IMPLEMENTED — STAGING VALIDATION REQUIRED** |
| P0-10 | `collect_cod_cash` not idempotent — no "already collected" guard | **FIX IMPLEMENTED — STAGING VALIDATION REQUIRED** |
| P0-11 | Plaintext passwords (`delivery_persons.password`) | **NOT FIXED — BLOCKER IDENTIFIED** (coordinated rollout required; runbook + guarded helper created) |
| P0-12 | Custom employee auth requires reading `password_hash` client-side | **NOT FIXED — BLOCKER IDENTIFIED** (architecturally requires a server-side login edge function; migration path documented) |

### Why P0-11/P0-12 are blocked, not ignored

`EmployeeAuthContext.jsx:114` performs `bcrypt.compare(password, employeeData.password_hash)` **in the browser**, having selected the row from `employee_accounts`. `Delivery.jsx:88` selects **all** delivery persons and compares `p.password === loginPassword` in JS. Both designs require the browser to read credential material. Locking RLS before moving authentication server-side would **lock out every employee and every delivery partner immediately**.

The safe order is: (1) ship RLS + Edge Function hardening now, (2) add a `employee-login` Edge Function that does bcrypt **server-side**, (3) switch the client to it, (4) only then remove the browser's SELECT privilege on credential columns. Steps 2–4 are provided as reviewed code and SQL but must be deployed and cut over with a tested rollback.

### Design decisions taken

- **No `USING (true)` as authorization.** Every write policy is ownership- or role-scoped.
- **`users.id = auth.uid()`** is the verified identity mapping (`AuthContext.jsx:118`), so customer-scoped RLS is reliable.
- **Public catalogue stays public.** `products`, `categories`, `banners`, `combos`, `hostels`, `public settings`, `reviews` are intentionally world-readable — locking them would break browsing.
- **Credential columns are not addressable by policies** (RLS is row-level, not column-level). Removing browser access to `password_hash` requires a hard `REVOKE` on the column or a server-side RPC. The revoke is provided but is deliberately **commented behind an explicit flag** in the migration so it cannot be applied accidentally before the auth cutover.
- **Backward compatibility:** every policy change is additive in intent; existing employee workflows keep working because `authenticated` access is granted where the app already relied on it, and admin checks use the existing `is_admin()` helper.

---

## P1 — Performance / Reliability — **implemented**

| # | Finding | Status |
|---|---|---|
| P1-1 | `FloatingCartButton.jsx:67` — cart count poll every **1 s**, unconditional | **FIXED AND TESTED** |
| P1-3 | `BottomTabBar.jsx:26` — cart count poll every **3 s**, unconditionally | **FIXED AND TESTED** |
| P1-2 | `OrderManagement.jsx:77-79` — full unbounded order-table read every **5 s** | **FIXED AND TESTED** |
| P1-4 | `ScheduledOrdersManager.jsx:17` — full order-table scan every **30 s** | **FIXED AND TESTED** |
| P1-5 | `AnalyticsDashboard.jsx:27` — full orders-table pagination every **60 s** | **FIXED AND TESTED** |
| P1-6 | `ProductCard.jsx:31,88` — 2 queries **per product card** on the landing grid | **FIXED AND TESTED** |
| P7 | `todaysMenu` interval created inside a `setTimeout`, handle never stored, never cleared | **FIXED AND TESTED** |
| P1-8 | 178 unbounded `Entity.filter` calls paginating to **10,000 rows** | **FIXED AND TESTED** (default 200 + explicit paging) |
| P1-9 | No shared polling policy — intervals arbitrary and scattered | **FIXED AND TESTED** (`usePolling` hook) |
| P1-10 | Missing FK indexes incl. `wallet_transactions.delivery_person_id`, `.order_id` | **FIX IMPLEMENTED — STAGING VALIDATION REQUIRED** |
| P1-11 | `X-Content-Type-Options` etc. present but no security headers for app HTML | **FIXED AND TESTED** |

## P2 — Optimization — **implemented**

| # | Finding | Status |
|---|---|---|
| P2-1 | 412 KB gz of admin-only libs (`xlsx`, `jspdf`, `recharts`) preloaded on first paint | **FIXED AND TESTED** |
| P2-2 | No per-route splitting for customer routes | **FIXED AND TESTED** |
| P2-3 | `bot-icon.png` 1.57 MB, `splash-delivery.gif` 535 KB | **FIXED AND TESTED** |
| P2-4 | Dead deps `three`, `react-quill`, `moment` (inlined 70 KB in entry) | **FIXED AND TESTED** |
| P2-5 | `chunkSizeWarningLimit: 1000` masking 1.41 MB entry | **FIXED AND TESTED** |
| P2-6 | Identity caches not cleared on logout/account switch | **FIXED AND TESTED** |
