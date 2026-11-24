# Security Incident Report — 2026-11-24

## Summary
A throwaway account was created, used to post a "you are hacked" banner, and an
existing teammate's account (`mahiisingh070@gmail.com`) was promoted to `admin`.
The live site was never defaced and no data was destroyed. The banner was removed
by the owner on 2026-11-24 05:05 UTC.

## How they got in
The public anon key (which ships in the JS bundle by design) could write to the
database because RLS was either disabled or set to `USING (true)` on:
`users`, `banners`, `settings`, `products`, `wallet_transactions`,
`employee_accounts`, `otp_codes`, `delivery_persons`, `orders` (insert),
`hostel_stock`, `reviews`, `promo_popups`, `refunds`, `subscriptions`,
`loyalty_transactions`, `withdrawal_requests`, … (53 blanket policies total).

The attack did **not** require a password:
- `PATCH /rest/v1/users?id=eq.<id>` with `{"role":"admin"}` returned 204 with the
  anon key (verified with a safe probe on a non-existent id).

## Timeline (UTC)
| Time | Event | IP | UA / device |
|---|---|---|---|
| Nov 23 20:05:02 | `bq0fytbz9u@bwmyga.com` created (disposable mail) | via Edge Function (Mumbai) | — |
| Nov 23 20:05:40 / 20:06:54 | OTP verify (403) | 47.15.114.129 | Mac, Chrome 156 |
| Nov 23 20:07:36 | OTP verify (200) + token issued | 47.15.114.129 | Mac, Chrome 156 |
| Nov 23 20:10:16 | token issued | 47.15.118.17 | curl/7.88.1 |
| Nov 23 20:12:59 | token issued | 47.15.112.19 | Android Chrome 157 |
| Nov 23 20:13:24 | **"you are hacked" banner created** (`POST /banners`) | 47.15.118.17 | Android Chrome 157 |
| Nov 23 20:13:25–20:35 | repeated anon PATCHes of that banner (view_count increments from many IPs) | various | — |
| Nov 23 20:15:51 / 20:16:00 | anon PATCH `users` (temp account + 2 others) | 47.15.118.17 | Android Chrome 157 |
| Nov 23 20:16:26 | anon PATCH `employee_accounts` (Mahi's employee row) | 47.15.118.17 | Android Chrome 157 |
| Nov 23 20:37:07 | temp account signed in | 27.123.249.211 | Android Chrome 157 |
| Nov 24 05:03:46 | anon PATCH banner (title changed) | 152.59.86.71 | Android Chrome 157 (owner's network — cleanup) |
| Nov 24 05:04:21–05:07:26 | owner (alok78332) edits banners + temp user + notifications | 152.59.86.71 | Linux Chrome 157 |
| Nov 24 05:05:25 | owner deletes the hacked banner | 152.59.86.71 | Linux Chrome 157 |
| **Nov 24 05:09:03** | **token refreshed for Mahi** (session `254fd01a…`, created Oct 26) | **47.15.115.130** | Linux Chrome 157, Dehradun/Jio |
| **Nov 24 05:09:15** | **Mahi's row promoted to admin** (`PATCH /users?id=eq.bb013b85…`) | **47.15.115.130** | Linux Chrome 157, Dehradun/Jio |
| Nov 24 05:10:47 | owner logs in | 152.59.89.138 | Mac Chrome 157 |

## Key clues about the attacker
- **Same city/network family**: all attack traffic came from Dehradun (Reliance Jio), IPs
  `47.15.112.19`, `47.15.114.129`, `47.15.115.130`, `47.15.118.17`.
- **Device**: Linux x86_64, Chrome 157 (desktop), not a phone. User-Agent:
  `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36`
- **Not Mahi's password**: the promotion used a **refresh token** from her Oct 26 session
  (`254fd01a-7636-41ce-930c-351bdee70417`), refreshed from a new IP. So her session
  token was stolen (XSS, shared device, malicious extension, or someone with access to
  her browser's `localStorage` key `sb-collegecart-auth`).
- **Not the owner**: owner's traffic came from Mathura (152.59.x.x) on Android/Mac — a
  different network and device.
- Mahi's employee record (`mahi@collegecarts.in`, `CCEMP7301`) is legitimate; the
  `users` row was edited (`full_name` → "satakshi") during the promotion.

## Recommended immediate actions
1. Force sign-out of session `254fd01a-7636-41ce-930c-351bdee70417` and all of Mahi's sessions.
2. Demote `mahiisingh070@gmail.com` to `customer`; ask her to scan her machine/browser
   for extensions and clear site data.
3. Delete `bq0fytbz9u@bwmyga.com`.
4. Rotate JWT secret + anon key + service role key + DB password.
5. Rotate `push_webhook_secret` in `app_config`.

## Can the anon key be removed from the frontend entirely?
**No — not while using `supabase-js` directly in the browser.** The anon key is
designed to be public; security comes from RLS, not secrecy. To truly hide it you
would have to proxy every DB call through a backend (Edge Functions / your own API),
which is a large refactor. The hardening in this repo makes RLS the real boundary:
anon can now only read the public catalogue and insert error logs.

## Alerting that is now live
- `security.audit_log` records every write on 19 sensitive tables with IP + actor.
- `security.notify_suspicious` trigger fires on role changes, money tables, settings,
  banners, employee accounts, and any DELETE, and POSTs to the `security-alert`
  Edge Function.
- To actually receive email: set secrets
  `supabase secrets set RESEND_API_KEY=... ALERT_EMAIL=you@example.com` (and
  optionally `ALERT_WEBHOOK_URL=https://hooks.slack.com/...` and `ALERT_SECRET=...`).
  Without `RESEND_API_KEY`, alerts are only logged to the function console.
- Query recent activity: `select * from security.audit_log order by occurred_at desc;`
- Suspicious-only: `select * from security.audit_log where table_name='users' and changed_columns && ARRAY['role'];`