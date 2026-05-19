# 🚀 STOCK SYNC SETUP - 3 SIMPLE STEPS

## ⚠️ IMPORTANT: Run these in ORDER

You're getting the "function not unique" error because old functions exist. Follow these 3 steps to fix it:

---

## STEP 1: Drop Old Functions (30 seconds)

1. Open Supabase SQL Editor
2. Open file: `sql/STEP1_DROP_OLD_FUNCTIONS.sql`
3. Copy entire contents
4. Paste into SQL Editor
5. Click **RUN**

**Expected Output:**
```
Functions remaining: 0
```

If you see `0`, proceed to Step 2. ✅

---

## STEP 2: Enable Realtime (30 seconds)

1. Still in Supabase SQL Editor
2. Open file: `sql/STEP2_ENABLE_REALTIME.sql`
3. Copy entire contents
4. Paste into SQL Editor
5. Click **RUN**

**Expected Output:**
```
realtime_status: ✅ Realtime enabled
index_count: 4
```

If you see this, proceed to Step 3. ✅

---

## STEP 3: Create New Functions (30 seconds)

1. Still in Supabase SQL Editor
2. Open file: `sql/STEP3_CREATE_FUNCTIONS.sql`
3. Copy entire contents
4. Paste into SQL Editor
5. Click **RUN**

**Expected Output:**
```
Functions created: 6/6
```

If you see `6/6`, setup is complete! ✅

---

## ✅ Verification

Run this query to verify everything:

```sql
-- Check realtime
SELECT EXISTS (
  SELECT 1 FROM pg_publication_tables 
  WHERE pubname = 'supabase_realtime' AND tablename = 'hostel_stock'
) as realtime_enabled;

-- Check functions
SELECT COUNT(*) as function_count
FROM pg_proc
WHERE proname IN (
  'check_product_stock',
  'get_product_hostel_stock',
  'reserve_stock',
  'release_stock',
  'validate_cart_stock',
  'get_low_stock_products'
);
```

**Expected:**
- `realtime_enabled`: `true`
- `function_count`: `6`

---

## 🎉 Done!

Now restart your frontend:

```bash
npm run dev
```

Test by:
1. Admin changes stock to 0
2. Customer sees "OUT OF STOCK" within 2 seconds
3. No refresh needed!

---

## ❌ If You Still Get Errors

If Step 1 doesn't remove all functions, run this manually:

```sql
-- Nuclear option - removes ALL stock functions
DO $$
DECLARE
  func RECORD;
BEGIN
  FOR func IN 
    SELECT oid::regprocedure as func_signature
    FROM pg_proc
    WHERE proname IN (
      'reserve_stock',
      'release_stock',
      'check_product_stock',
      'get_product_hostel_stock',
      'validate_cart_stock',
      'get_low_stock_products'
    )
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || func.func_signature || ' CASCADE';
  END LOOP;
END $$;
```

Then go back to Step 1 and continue.

---

**Total Time: 2 minutes**
