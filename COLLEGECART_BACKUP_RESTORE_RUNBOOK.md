# CollegeCart — Backup & Restore Runbook

**Status:** plan only. **No backup is claimed to be active** — that must be verified in the Supabase dashboard (see §2).
This runbook changes nothing on its own. Nothing here was executed.

---

## 1. Current state — what is and isn't verified

| Item | Status |
|---|---|
| Supabase automated daily backups | **UNKNOWN** — dashboard only |
| Point-in-time recovery (PITR) | **UNKNOWN** — plan-tier dependent |
| Retention window | **UNKNOWN** |
| Storage object backups (`employee-assets`, product images, profile photos) | **UNKNOWN** — almost certainly *not* covered by a database dump |
| Off-platform / third-party copy | **None exists.** Verified: no backup tooling in the repo |
| Restore ever tested | **UNKNOWN — and this is the real risk** |
| Schema reproducible from migrations | **NO** — see §1.1 |

The only artifacts present are ad-hoc JSON exports in `supabase/backups/` (gitignored). They contain real partner names and earnings. They are **not** a disaster-recovery capability and must not be treated as one.

### 1.1 Why migrations are not a reliable restore path

Three conflicting schema definitions coexist in the repo (`initial_schema`, `COMPLETE_DATABASE_SETUP.sql`, the loose fix scripts) and they disagree on `products.id` (uuid vs text). Several migrations are not re-runnable (`CREATE POLICY` has no `IF NOT EXISTS`; `20260513000003` creates indexes without it), one is empty (`20260813095303_create_otp.sql`), and `20260513000001_performance_indexes.sql` references columns that do not exist and requires `pg_trgm`, which no migration installs.

**Therefore: take a schema-only dump on every release and treat it as authoritative.**

---

## 2. Dashboard checks (human, read-only)

1. **Database → Backups** — are automated backups on? What is the retention window? When was the last successful one?
2. **Database → Backups → PITR** — is point-in-time recovery available on this plan?
3. **Database → Usage** — current database size against plan limits; connection limits.
4. **Storage** — list every bucket. Which are public? Do any have independent backup?
5. **Edge Functions → Secrets** — confirm `RAZORPAY_WEBHOOK_SECRET` is actually set. The webhook now fails closed, so if it is unset, payment webhooks will be **rejected** until it is configured. **Check this before deploying.**
6. **Project Settings → API** — confirm which keys exist and rotate anything previously committed (`.env` was in git history at `77dfe89`).

---

## 3. Proposed backup strategy

Targets below are **proposals for discussion, not agreed commitments**.

| Layer | Mechanism | Retention | Notes |
|---|---|---|---|
| Platform backups | Supabase automated | whatever is set | Confirm in dashboard |
| Fast recovery | PITR | 7–15 days if available | Depends on plan |
| Independent copy | nightly `pg_dump` (custom format), encrypted, off-platform | daily 14 / weekly 8 / monthly 12 | Protects against a platform-level incident or a bad migration |
| Schema snapshot | `pg_dump --schema-only` per release | indefinitely, in git | Authoritative — see §1.1 |
| Storage objects | separate export | match database | A database restore alone does **not** bring back uploaded files |

**Proposed RPO/RTO** (for discussion): RPO ≤ 24 h for the independent copy, ≤ 15 min via PITR if available. RTO ≤ 4 h full restore, ≤ 30 min via PITR.

Encryption at rest, access restricted to two named operators. **No production dump and no secret goes into git.**

---

## 4. Restore drill (quarterly, non-destructive)

Never drill against production. Always into a separate `collegecart-drill` project.

1. Record current production row counts for every table.
2. Provision a fresh Supabase project.
3. Restore the most recent `pg_dump`.
4. Restore Storage objects.
5. Compare row counts (tolerate <1% drift from writes during the window).
6. Spot-check 10 rows each from `orders`, `users`, `wallet_transactions`, `cart_items` — field for field.
7. Deploy a preview build against the drill project. Verify login, browse, cart, and a **sandbox** payment only.
8. **Never** capture a real payment, send a real notification, or assign a real delivery partner.
9. Record achieved RTO and any gap.
10. Destroy the drill project.

---

## 5. Post-restore consistency checks

Restoring an old database means the app may be ahead of it. Before reopening traffic:

- **Payment reconciliation is mandatory.** `orders.is_paid` is currently written by the client and is therefore not trustworthy. Reconcile against the Razorpay and Cashfree dashboards: any order marked paid in the provider but absent or unpaid in the restored database needs manual resolution.
- Re-check `wallet_transactions` and `delivery_persons` balances — the commission ledger has a known history of duplicates.
- Confirm `products.stock_quantity` / `hostel_stock` against physical stock before accepting orders.
- Verify Realtime is enabled for the tables the app subscribes to (`hostel_stock`, `orders`, `checkout_settings`, `meal_orders`).
- Confirm Edge Function secrets are present in the restored project.

---

## 6. ⚠️ Review the scheduled retention SQL before it runs

`supabase/migrations/20260516000001_db_size_optimization.sql` contains **destructive statements that run on every invocation if scheduled as cron**:

| Statement | Risk |
|---|---|
| `DELETE FROM error_logs WHERE created_at < NOW() - INTERVAL '14 days'` | Loses diagnostic history |
| `DELETE FROM admin_alerts ...` | Loses operational history |
| `DELETE FROM notifications ... > 30 days` | Loses user-facing history |
| `DELETE FROM chat_messages ... > 30 days` | Loses support conversations |
| `UPDATE users SET profile_photo = NULL, avatar_url = NULL` | **Destroys real user content** |
| `UPDATE categories SET image_url = NULL` | **Destroys real catalogue content** |

The `chat_messages` delete has an `EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='chat_messages')` "guard" that is a tautology — it is always true and protects nothing.

**Actions required:**
1. Confirm whether these jobs are actually scheduled (`pg_cron`).
2. If scheduled, **unschedule before applying any further migration.**
3. The `wallet_transactions` and `loyalty_transactions` retention lines are correctly commented out. **Leave them that way** — they are the financial record.
4. Never re-enable without an explicit, reviewed retention policy and a rollback.

---

## 7. Secrets and configuration recovery

- Vercel env vars and Supabase project settings are **not** recoverable from git — correctly, since `.env` is gitignored now. Document them in a password manager.
- `.env` **is** in git history at `77dfe89` with five real key names. Anyone with repo access can read it. Rotation is mandatory and is a human action in each provider's dashboard.
- Keep a per-release note of which schema changes shipped, so a restore can be matched to its code.

---

## 8. Rollback guidance for the migrations in this branch

| Migration | Rollback |
|---|---|
| `20261009000001_critical_rls_remediation.sql` | Contains **no drops or deletes**. To undo, re-grant anon access — but that reopens the breach. Only for emergency recovery. |
| `20261009000002_financial_idempotency.sql` | Drop the added indexes and the `earning_event_key` column. The DDL mutates no existing ledger row; the backfill only fills a new column. |

Both are idempotent and can be re-applied safely.
