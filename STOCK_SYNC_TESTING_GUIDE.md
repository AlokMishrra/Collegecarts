# 🧪 STOCK SYNC TESTING GUIDE

## Prerequisites

Before testing, ensure:
1. ✅ Database migrations have been run:
   - `sql/enable-realtime-stock-sync.sql`
   - `sql/stock-validation-functions.sql`
2. ✅ Frontend development server is running
3. ✅ You have admin and customer accounts
4. ✅ Products exist in database with hostel stock

## Test Scenarios

### 🔴 Test 1: Out of Stock Display

**Objective**: Verify products with 0 stock show "OUT OF STOCK"

**Steps**:
1. Login as admin
2. Navigate to inventory/stock management
3. Set a product's stock to 0 for a specific hostel
4. Open Shop page in another browser/tab (logged in as customer)
5. Select the same hostel
6. Find the product

**Expected Result**:
- ✅ Product shows red "OUT OF STOCK" badge
- ✅ "Add to Cart" button is disabled
- ✅ Product has reduced opacity
- ✅ No way to add item to cart

**Pass/Fail**: ___________

---

### ⚡ Test 2: Realtime Stock Update

**Objective**: Verify stock changes sync instantly without refresh

**Steps**:
1. Open Shop page in Browser Window 1 (customer)
2. Open Admin panel in Browser Window 2 (admin)
3. In Window 2: Change a product's stock from 10 to 0
4. Watch Window 1 (DO NOT REFRESH)

**Expected Result**:
- ✅ Within 2 seconds, product in Window 1 shows "OUT OF STOCK"
- ✅ No manual refresh needed
- ✅ Console shows: `[Shop] ⚡ REALTIME: Hostel stock changed!`
- ✅ Console shows: `[Shop] Reloading data after stock change...`

**Pass/Fail**: ___________

---

### 🛒 Test 3: Add to Cart Validation

**Objective**: Verify cannot add out-of-stock items to cart

**Steps**:
1. Find a product with 0 stock
2. Try to click "Add to Cart"

**Expected Result**:
- ✅ Button is disabled (cannot click)
- ✅ No item added to cart
- ✅ No error toast (button is simply disabled)

**Pass/Fail**: ___________

---

### ⚠️ Test 4: Low Stock Warning

**Objective**: Verify low stock products show warning

**Steps**:
1. Set a product's stock to 3 units
2. View product on Shop page

**Expected Result**:
- ✅ Orange badge shows "Only 3 left"
- ✅ Badge has pulse animation
- ✅ "Add to Cart" button is still enabled

**Pass/Fail**: ___________

---

### 🔄 Test 5: Hostel Change Updates Stock

**Objective**: Verify changing hostel updates stock instantly

**Steps**:
1. Login as customer
2. Select "Mithali" hostel
3. Note stock levels of products
4. Click "Change" hostel button
5. Select "Gavaskar" hostel

**Expected Result**:
- ✅ Products re-enrich with new hostel stock
- ✅ Stock quantities update (may be different per hostel)
- ✅ Out-of-stock products may become available (or vice versa)
- ✅ Console shows: `[Shop] Hostel changed from Mithali to Gavaskar`

**Pass/Fail**: ___________

---

### 🛍️ Test 6: Cart Validation Before Checkout

**Objective**: Verify cart validates stock before checkout

**Steps**:
1. Add 5 units of Product A to cart (stock: 10)
2. In admin panel, change Product A stock to 2
3. Go to Cart page
4. Click "Place Order"

**Expected Result**:
- ✅ Toast shows: "Some items have limited stock"
- ✅ Cart quantity automatically reduced to 2
- ✅ Checkout does not proceed
- ✅ User must review updated cart

**Pass/Fail**: ___________

---

### ❌ Test 7: Remove Out-of-Stock from Cart

**Objective**: Verify out-of-stock items removed from cart at checkout

**Steps**:
1. Add Product A to cart (stock: 5)
2. In admin panel, change Product A stock to 0
3. Go to Cart page
4. Click "Place Order"

**Expected Result**:
- ✅ Toast shows: "Some items are out of stock"
- ✅ Product A automatically removed from cart
- ✅ Cart updates to show remaining items
- ✅ Checkout does not proceed

**Pass/Fail**: ___________

---

### 🔒 Test 8: Race Condition Prevention

**Objective**: Verify two customers cannot buy last item simultaneously

**Steps**:
1. Set Product A stock to 1
2. Open Shop in Browser 1 (Customer 1)
3. Open Shop in Browser 2 (Customer 2)
4. Both customers add Product A to cart
5. Customer 1 completes checkout first
6. Customer 2 tries to checkout

**Expected Result**:
- ✅ Customer 1 checkout succeeds
- ✅ Customer 2 sees "Out of stock" error
- ✅ Product A removed from Customer 2's cart
- ✅ No overselling occurs

**Pass/Fail**: ___________

---

### 📱 Test 9: Mobile Stock Display

**Objective**: Verify stock badges display correctly on mobile

**Steps**:
1. Open Shop page on mobile device (or use browser dev tools)
2. View products with various stock levels

**Expected Result**:
- ✅ "OUT OF STOCK" badge visible and readable
- ✅ "Only X left" badge visible
- ✅ Badges don't overlap with other elements
- ✅ Touch targets are appropriate size

**Pass/Fail**: ___________

---

### 🔄 Test 10: Cache Invalidation

**Objective**: Verify cache clears when stock changes

**Steps**:
1. Load Shop page (products cached)
2. Admin changes stock
3. Observe Shop page (no manual refresh)

**Expected Result**:
- ✅ Cache automatically invalidated
- ✅ Fresh data fetched from database
- ✅ Console shows: `[Shop] Cache invalidated - fetching fresh data`
- ✅ Updated stock displayed

**Pass/Fail**: ___________

---

### 🎯 Test 11: Product Details Page Stock

**Objective**: Verify stock updates on product details page

**Steps**:
1. Open product details page
2. In another tab, admin changes stock to 0
3. Return to product details page (no refresh)

**Expected Result**:
- ✅ Stock updates within 2 seconds
- ✅ "Add to Cart" button becomes disabled
- ✅ "OUT OF STOCK" badge appears
- ✅ Realtime subscription active

**Pass/Fail**: ___________

---

### 🔍 Test 12: Search Results Stock

**Objective**: Verify stock status in search results

**Steps**:
1. Search for a product
2. View search results

**Expected Result**:
- ✅ Out-of-stock products show badge
- ✅ Low stock products show warning
- ✅ Stock status consistent with Shop page

**Pass/Fail**: ___________

---

### 📦 Test 13: Category Page Stock

**Objective**: Verify stock status on category pages

**Steps**:
1. Navigate to a category
2. View products in category

**Expected Result**:
- ✅ Stock badges display correctly
- ✅ Out-of-stock products at end of list
- ✅ In-stock products prioritized

**Pass/Fail**: ___________

---

### 💳 Test 14: Payment Failure Stock Release

**Objective**: Verify stock released if payment fails

**Steps**:
1. Add product to cart (stock: 5)
2. Proceed to checkout (stock reserved)
3. Simulate payment failure
4. Check product stock

**Expected Result**:
- ✅ Stock released back to inventory
- ✅ Stock returns to 5
- ✅ Other customers can purchase
- ✅ No stock leakage

**Pass/Fail**: ___________

---

### 🔄 Test 15: Multiple Tab Sync

**Objective**: Verify stock syncs across multiple tabs

**Steps**:
1. Open Shop in Tab 1
2. Open Shop in Tab 2
3. Admin changes stock
4. Observe both tabs (no refresh)

**Expected Result**:
- ✅ Both tabs update within 2 seconds
- ✅ Stock status consistent across tabs
- ✅ No conflicts or race conditions

**Pass/Fail**: ___________

---

## Performance Tests

### ⚡ Test 16: Page Load Performance

**Objective**: Verify stock sync doesn't slow down page load

**Steps**:
1. Open Shop page
2. Measure load time (use browser dev tools)

**Expected Result**:
- ✅ Initial load < 1 second
- ✅ Products display quickly
- ✅ No blocking operations
- ✅ Realtime subscription doesn't delay render

**Pass/Fail**: ___________

---

### 🔄 Test 17: Realtime Update Performance

**Objective**: Verify realtime updates are efficient

**Steps**:
1. Open Shop page
2. Admin makes 10 rapid stock changes
3. Observe Shop page behavior

**Expected Result**:
- ✅ Updates debounced (not 10 separate reloads)
- ✅ Single reload after 2 second delay
- ✅ No UI flicker or jank
- ✅ Smooth user experience

**Pass/Fail**: ___________

---

## Edge Cases

### 🔀 Test 18: Concurrent Stock Updates

**Objective**: Verify system handles concurrent updates

**Steps**:
1. Multiple admins update same product stock simultaneously
2. Observe final stock value

**Expected Result**:
- ✅ No data corruption
- ✅ Last write wins (or proper conflict resolution)
- ✅ All clients eventually consistent

**Pass/Fail**: ___________

---

### 🌐 Test 19: Network Disconnection

**Objective**: Verify behavior when network disconnects

**Steps**:
1. Open Shop page
2. Disconnect network (browser dev tools)
3. Admin changes stock
4. Reconnect network

**Expected Result**:
- ✅ Graceful degradation during disconnect
- ✅ Automatic reconnection when network returns
- ✅ Stock updates after reconnection
- ✅ No errors or crashes

**Pass/Fail**: ___________

---

### 🔄 Test 20: Browser Refresh

**Objective**: Verify fresh stock after refresh

**Steps**:
1. Load Shop page
2. Admin changes stock
3. Manually refresh Shop page

**Expected Result**:
- ✅ Fresh stock loaded from database
- ✅ No stale cache served
- ✅ Correct stock displayed
- ✅ Realtime subscription re-established

**Pass/Fail**: ___________

---

## Debugging Checklist

If tests fail, check:

### Database
- [ ] Realtime enabled for `hostel_stock` table
- [ ] Stock validation functions exist
- [ ] Indexes created
- [ ] Triggers working

### Frontend
- [ ] Realtime subscription active (check console)
- [ ] Stock enrichment happening (check console logs)
- [ ] Cache invalidation working
- [ ] No JavaScript errors

### Network
- [ ] Supabase connection working
- [ ] Realtime websocket connected
- [ ] No CORS errors
- [ ] API calls succeeding

---

## Test Summary

**Total Tests**: 20
**Passed**: _____
**Failed**: _____
**Skipped**: _____

**Overall Status**: ⬜ PASS / ⬜ FAIL

**Tested By**: _______________
**Date**: _______________
**Environment**: ⬜ Development / ⬜ Staging / ⬜ Production

---

## Notes

Use this space to document any issues, observations, or recommendations:

```
[Your notes here]
```

---

## Next Steps

After all tests pass:
1. ✅ Deploy to staging environment
2. ✅ Run tests again in staging
3. ✅ Monitor for 24 hours
4. ✅ Deploy to production
5. ✅ Monitor production metrics

---

**Remember**: Stock sync is critical for business operations. All tests must pass before production deployment.
