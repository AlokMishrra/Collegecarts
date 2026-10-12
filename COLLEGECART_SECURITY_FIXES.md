# CollegeCart — Security Fixes

**Branch:** `fix/security-remediation-2026-10`
**Commit:** `35dde36`
**Companion:** `COLLEGECART_PRODUCTION_READINESS_AUDIT.md` (findings), `COLLEGECART_REMEDIATION_PLAN.md` (plan)

Every item is labelled with its true status. Nothing is called fixed if it was only written down.

| Status | Meaning |
|---|---|
| **FIXED AND TESTED** | Changed, built, and exercised locally |
| **FIX IMPLEMENTED — STAGING VALIDATION REQUIRED** | Code/SQL written and reviewed; needs a real Supabase project |
| **NEEDS MANUAL DASHBOARD ACTION** | Cannot be done from code |
| **NOT FIXED — BLOCKER IDENTIFIED** | Deliberately not forced; root cause and path documented |

---

## 1. The critical finding, revalidated

Read-only `GET` requests using **only the public anon key** (which ships inside the browser bundle), no auth header, no service role, no writes:

| Table | HTTP | Rows | Content |
|---|---|---|---|
| `users` | 206 | 942 | `email`, `phone_number`, `full_name` |
| `employee_accounts` | 206 | 3 | `password_hash`, `address`, `date_of_birth`, `blood_group` |
| `employee_sessions` | 206 | 13 | `session_token`, `ip_address`, `user_agent` |
| `delivery_persons` | 206 | 20 | `password` (plaintext), `wallet_balance`, `cod_held` |
| `wallet_transactions` | 206 | 2180 | partner earnings ledger |
| `cart_items` | 206 | 508 | live customer carts |
| `loyalty_transactions` | 206 | 2258 | balances |
| `otp_codes` | 206 | 64 | live OTP `code` values |

`exec_sql` returns 404 → the three DDL Edge Functions are inert. **Resolved by evidence, no action needed.**

Reproduce with `scripts/audit_rls_exposure.py` (read-only).

---

## 2. What was changed

### 2.1 RLS — `20261009000001_critical_rls_remediation.sql`
**FIX IMPLEMENTED — STAGING VALIDATION REQUIRED**

- Re-enables RLS on the 20 `employee_*` tables that `20260513000004` disabled while issuing `GRANT ALL ... TO anon`.
- Owner-scoped policies for `users`, `cart_items`, `loyalty_transactions`, `refunds`, `subscriptions` using `users.id = auth.uid()` (the mapping `AuthContext.jsx:118` guarantees).
- Admin-gated reads for `delivery_persons`, `wallet_transactions`, `withdrawal_requests`.
- `otp_codes` loses anonymous access entirely; the `SECURITY DEFINER` `create_otp` / `verify_otp` functions keep the passwordless flow working.
- `search_path` pinned on `is_admin()` and the OTP helpers.
- No `USING (true)` is used as a substitute for authorization anywhere.
- Public catalogue tables are intentionally left readable and annotated, so browsing, search and indexing keep working.

### 2.2 Money idempotency — `20261009000002_financial_idempotency.sql`
**FIX IMPLEMENTED — STAGING VALIDATION REQUIRED**

- One commission per `(delivery_person_id, order_id)`. The earlier guard was committed **commented out**, so 256 duplicate credits (₹2,760 over-credit) occurred with no DB-level backstop.
- `earning_event_key` gives the same protection to legacy rows whose `order_id` is NULL, since Postgres treats NULLs as distinct in a unique index. Backfilled from `description`, which already contains the order number.
- `collect_cod_cash` rewritten to be idempotent. Original behaviour: unconditionally deducted the wallet and moved cash, so a repeat call double-deducted. Now it locks the order, returns `already_collected` if `cod_collected` is set, verifies the collecting partner is the assigned one, refuses to overdraw rather than writing a negative balance, and guards the ledger insert with the event key.
- Preserved the `cod_held_since` business rule from the original.
- Hot-path FK indexes added, `wallet_transactions.delivery_person_id` first — every earnings query currently seq-scans the ledger.

### 2.3 Edge Functions
**FIX IMPLEMENTED — STAGING VALIDATION REQUIRED** (Deno is not installed here, so no typecheck)

New `_shared/auth.ts` centralises the contract. 18 functions used the service role with **no auth check**.

| Function | Change |
|---|---|
| `verify-razorpay-payment` | Fetches the payment from Razorpay so the returned amount is the provider's record, not the browser's claim. Rejects payment/order mismatch, non-`INR`, and an amount that differs from the expected total. Constant-time signature compare. |
| `verify-cod-payment` | Was unauthenticated and read **any** order by caller-supplied id via the service role. Now reads through the caller's own session so RLS applies; returns 403 rather than a boolean that leaks existence. Cashfree headers, the `'completed'` status value and the `paymentId` field are preserved from the original. |
| `razorpay-webhook` | Signature check was `if (SECRET && signature)` — an unset secret accepted unverified events. Now **fails closed** on missing secret or missing header, uses a constant-time compare, stops logging every request header (which included the signature) and the full provider payload. |
| `create-razorpay-cod-order` | Requires authentication, binds the amount to the order's own `total_amount`, and only updates an order the caller owns or an admin owns. |

### 2.4 Logging hygiene
- Webhook no longer prints all headers or the raw payload.
- `verify-razorpay-payment` returns a generic message and never echoes the provider body.

---

## 3. Deliberately NOT fixed — and why

### 3.1 Plaintext delivery-partner passwords
**NOT FIXED — BLOCKER IDENTIFIED**

`Delivery.jsx:88` does:
```js
const all = await base44.entities.DeliveryPerson.list();
const found = all.find(p => p.email?.toLowerCase() === login && p.password === loginPassword);
```
It downloads the whole partner table and compares passwords **in the browser**. The password is then persisted to `localStorage`.

Fixing the column requires moving partner authentication server-side first. Locking the table before that locks out every delivery partner.

**Path:** add an `delivery-login` Edge Function doing a constant-time comparison server-side with a hashed column → move the client to it → `REVOKE SELECT (password)`.

### 3.2 Client-side bcrypt employee login
**NOT FIXED — BLOCKER IDENTIFIED**

`EmployeeAuthContext.jsx:114` runs `bcrypt.compare(password, employeeData.password_hash)` in the browser, so `password_hash` must be readable by the client.

**Path:** an `employee-login` Edge Function that verifies bcrypt **server-side** and returns an opaque session token → the client stops selecting `password_hash` → `REVOKE` the column. The migration keeps `authenticated` access on those tables meanwhile so nobody is locked out.

**Rollout order matters:** deploy function → cut client over → verify employee login → only then revoke. Skipping a step locks out staff.

### 3.3 Credential rotation
**NEEDS MANUAL DASHBOARD ACTION**

`.env` was committed in `77dfe89` with five real key names, plus a service-role key and a Vercel token were exposed in this session. Rotation must be done by a human in each provider's dashboard.

---

## 4. Negative tests

`scripts/test_rls_negative.py` — **run against a staging project, never production.** It asserts, using the anon key and two separate authenticated users, that:

1. anonymous reads of `users`, `orders`, `cart_items`, `wallet_transactions`, `employee_accounts`, `employee_sessions`, `delivery_persons`, `otp_codes` are denied;
2. customer A cannot read customer B's cart, profile or orders;
3. delivery partner A cannot read partner B's wallet or personal records;
4. an ordinary user cannot insert a notification, loyalty credit or withdrawal request for someone else;
5. public catalogue reads still succeed.

Run the same script against production **read-only** to confirm exposure is closed.

---

## 5. Ordering before production

1. Apply `20261009000001` to **staging**, run the negative tests.
2. Apply `20261009000002` to staging, run the duplicate-commission and repeat-COD tests.
3. Deploy the Edge Functions; confirm the unauthenticated calls that used to succeed now 401.
4. Apply to production during a low-traffic window, monitoring error rates.
5. Rotate credentials.
6. Schedule the employee/delivery auth cutover as its own change.
