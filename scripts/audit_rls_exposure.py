#!/usr/bin/env python3
"""
CollegeCart — RLS exposure probe (READ-ONLY).

Uses ONLY the public anon key from .env — the same key that ships inside the
browser bundle. Makes no writes. Safe to run against production to confirm
exposure is closed, and against staging to confirm a migration worked.

Usage:
    python3 scripts/audit_rls_exposure.py            # uses .env
    python3 scripts/audit_rls_exposure.py --expect-locked

Exit code 0 = expected state, 1 = exposure still present.
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request

# Public catalogue: readable by design, the shop is indexed.
PUBLIC_OK = {
    "products", "categories", "banners", "combos", "hostels",
    "reviews", "settings", "checkout_settings", "campaigns",
}

# Must never be readable by an anonymous caller.
MUST_BE_LOCKED = [
    "users", "orders", "cart_items", "wallet_transactions",
    "withdrawal_requests", "loyalty_transactions", "refunds",
    "subscriptions", "otp_codes", "delivery_persons", "delivery_queries",
    "employee_accounts", "employee_sessions", "employee_roles",
    "employee_departments", "employee_attendance", "employee_salary_logs",
    "employee_salary_structures", "employee_finance_logs",
    "employee_activity_logs", "employee_notifications",
    "employee_stock_orders", "employee_stock_order_items",
    "notifications",
]


def load_env(path=".env"):
    env = {}
    if not os.path.exists(path):
        return env
    with open(path) as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def count_rows(url, key, table):
    """Head request: returns the exact row count the anon key can see."""
    req = urllib.request.Request(
        f"{url}/rest/v1/{table}?select=*&limit=1",
        headers={
            "apikey": key,
            "Authorization": "Bearer " + key,
            "Prefer": "count=exact",
            "Range": "0-0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            rng = resp.headers.get("Content-Range", "")
            return resp.status, (rng.split("/")[-1] if "/" in rng else "?")
    except urllib.error.HTTPError as exc:
        return exc.code, "0"
    except Exception:
        return None, "?"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--env", default=".env")
    ap.add_argument("--expect-locked", action="store_true",
                    help="exit non-zero if any locked table is still readable")
    args = ap.parse_args()

    env = load_env(args.env)
    url = env.get("VITE_SUPABASE_URL", "").rstrip("/")
    key = env.get("VITE_SUPABASE_ANON_KEY", "")
    if not url or not key:
        print("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not found", file=sys.stderr)
        return 2

    print(f"Target: {url}")
    print("Credential: PUBLIC ANON KEY (read-only probe)\n")

    exposed = []
    print("--- Tables that must NOT be anonymous-readable ---")
    for t in MUST_BE_LOCKED:
        status, n = count_rows(url, key, t)
        ok = status in (401, 403) or (status == 200 and n in ("0", "*")) or status == 404
        flag = "ok " if ok else "EXPOSED"
        if not ok:
            exposed.append((t, status, n))
        print(f"  {flag}  {t:32} HTTP {status}  rows={n}")

    print("\n--- Public catalogue (readable by design) ---")
    for t in sorted(PUBLIC_OK):
        status, n = count_rows(url, key, t)
        flag = "ok " if status in (200, 206) else "BROKEN"
        print(f"  {flag}  {t:32} HTTP {status}  rows={n}")

    print()
    if exposed:
        print(f"RESULT: {len(exposed)} table(s) still exposed: "
              + ", ".join(t for t, _, _ in exposed))
        return 1 if args.expect_locked else 0
    print("RESULT: no unauthorized anonymous reads detected.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
