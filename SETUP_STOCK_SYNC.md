# 🚀 QUICK SETUP GUIDE - REALTIME STOCK SYNC

## ⏱️ Setup Time: 5 minutes

Follow these steps to enable realtime stock synchronization:

---

## Step 1: Run Database Migrations (2 minutes)

### 1.1 Open Supabase Dashboard
1. Go to https://supabase.com
2. Select your project
3. Click "SQL Editor" in left sidebar

### 1.2 Run First Migration
1. Open file: `sql/enable-realtime-stock-sync.sql`
2. Copy entire contents
3. Paste into Supabase SQL Editor
4. Click "RUN" button
5. Wait for success message

**Expected Output**:
```
✅ Added hostel_stock to realtime publication
✅ Created updated_at trigger for hostel_stock
✅ Created performance indexes
✅ ALL CHECKS PASSED - Realtime stock sync is ready!
```

### 1.3 Run Second Migration
1. Open file: `sql/stock-validation-functions.sql`
2. Copy entire contents
3. Paste into Supabase SQL Editor
4. Click "RUN" button
5. Wait for success message

**Expected Output**:
```
✅ ALL FUNCTIONS CREATED SUCCESSFULLY!
Functions created: 6/6
```

---

## Step 2: Verify Database Setup (1 minute)

Run this query in Supabase SQL Editor to verify:

```sql
-- Check realtime is enabled
SELECT EXISTS (
  SELECT 1 FROM pg_publication_tables 
  WHERE pubname = 'supabase_realtime' AND tablename = 'hostel_stock'
) as realtime_enabled;

-- Check functions exist
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

**Expected Result**:
- `realtime_enabled`: `true`
- `function_count`: `6`

---

## Step 3: Restart Frontend (1 minute)

### 3.1 Stop Development Server
Press `Ctrl+C` in your terminal

### 3.2 Start Development Server
```bash
npm run dev
```

### 3.3 Verify Server Started
Look for:
```
  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

---

## Step 4: Test Realtime Sync (1 minute)

### 4.1 Open Two Browser Windows

**Window 1 (Customer)**:
1. Open http://localhost:5173
2. Login as customer
3. Navigate to Shop page
4. Keep this window visible

**Window 2 (Admin)**:
1. Open http://localhost:5173 in new window
2. Login as admin
3. Navigate to inventory/stock management

### 4.2 Test Stock Update

**In Window 2 (Admin)**:
1. Find any product
2. Change stock to 0
3. Save changes

**In Window 1 (Customer)**:
1. DO NOT REFRESH
2. Watch the product (should update within 2 seconds)
3. Product should show "OUT OF STOCK" badge

### 4.3 Check Console Logs

**In Window 1**, open browser console (F12):

You should see:
```
[Shop] ⚡ REALTIME: Hostel stock changed!
[Shop] Reloading data after stock change...
[Shop] ✅ Enrichment complete:
```

---

## ✅ Success Criteria

Your setup is successful if:

- [x] Database migrations ran without errors
- [x] 6 functions created successfully
- [x] Realtime enabled for hostel_stock table
- [x] Frontend server running
- [x] Stock changes sync within 2 seconds
- [x] Console shows realtime messages
- [x] No JavaScript errors

---

## ❌ Troubleshooting

### Problem: Migrations fail with "permission denied"

**Solution**: Ensure you're logged in as database owner or have sufficient permissions

### Problem: Functions not created

**Solution**: 
1. Check for syntax errors in SQL
2. Ensure PostgreSQL version is 12+
3. Try running functions one at a time

### Problem: Realtime not working

**Solution**:
1. Check Supabase project settings → API → Realtime is enabled
2. Verify websocket connection in browser Network tab
3. Check for CORS errors in console
4. Ensure Supabase client is initialized correctly

### Problem: Stock not updating in UI

**Solution**:
1. Check browser console for errors
2. Verify realtime subscription is active (look for console logs)
3. Clear browser cache and reload
4. Check network tab for failed API calls

### Problem: "OUT OF STOCK" not showing

**Solution**:
1. Verify product actually has 0 stock in database
2. Check hostel_stock table has correct data
3. Ensure user has selected correct hostel
4. Check console for enrichment logs

---

## 🔍 Verification Commands

### Check Hostel Stock Data
```sql
SELECT 
  h.name as hostel,
  p.name as product,
  hs.stock_quantity,
  hs.updated_at
FROM hostel_stock hs
JOIN hostels h ON hs.hostel_id = h.id
JOIN products p ON hs.product_id = p.id
ORDER BY hs.updated_at DESC
LIMIT 10;
```

### Check Realtime Publication
```sql
SELECT * FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';
```

### Test Stock Function
```sql
-- Replace UUIDs with actual values from your database
SELECT check_product_stock(
  'product-uuid-here'::UUID,
  'Mithali',
  1
);
```

---

## 📚 Next Steps

After successful setup:

1. **Read Documentation**: `STOCK_SYNC_IMPLEMENTATION.md`
2. **Run Tests**: Follow `STOCK_SYNC_TESTING_GUIDE.md`
3. **Monitor Logs**: Watch console for any errors
4. **Test Edge Cases**: Try concurrent updates, network issues, etc.

---

## 🆘 Need Help?

If you encounter issues:

1. Check console logs for errors
2. Review database migration output
3. Verify Supabase connection
4. Check network tab for failed requests
5. Review this guide's troubleshooting section

---

## 📝 Configuration

### Realtime Debounce Time

Default: 2 seconds

To change, edit `src/pages/Shop.jsx`:

```javascript
reloadTimeout = setTimeout(() => {
  // ...
}, 2000); // Change this value (in milliseconds)
```

### Cache Timeout

Default: 5 seconds

To change, edit `src/services/stockService.js`:

```javascript
this.cacheTimeout = 5000; // Change this value (in milliseconds)
```

### Low Stock Threshold

Default: 5 units

To change, edit `src/components/stock/StockBadge.jsx`:

```javascript
lowStockThreshold = 5 // Change this value
```

---

## ✨ Features Enabled

After setup, you'll have:

- ✅ Realtime stock updates (no refresh needed)
- ✅ Automatic cache invalidation
- ✅ Server-side stock validation
- ✅ Cart validation before checkout
- ✅ Atomic stock reservation
- ✅ Out-of-stock badges
- ✅ Low stock warnings
- ✅ Race condition prevention
- ✅ Stock release on payment failure

---

**Setup Complete!** 🎉

Your realtime stock sync system is now active. Products will update instantly when stock changes, preventing orders for unavailable items.
