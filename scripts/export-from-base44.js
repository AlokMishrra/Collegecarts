/**
 * ============================================================
 * Base44 → Supabase Data Export Script
 * ============================================================
 * 
 * HOW TO USE:
 * 1. Fill in BASE44_APP_ID and BASE44_ACCESS_TOKEN below
 *    (Get token from your browser localStorage: key = base44_access_token)
 * 2. Fill in SUPABASE_URL and SUPABASE_SERVICE_KEY
 *    (Get from Supabase Dashboard → Settings → API → service_role key)
 * 3. Run: node scripts/export-from-base44.js
 * 
 * This will export ALL your data from Base44 and import into Supabase.
 * Safe to run multiple times (uses upsert).
 * ============================================================
 */

// ---- FILL THESE IN ----
const BASE44_APP_ID = 'YOUR_BASE44_APP_ID';           // from VITE_BASE44_APP_ID in .env
const BASE44_ACCESS_TOKEN = 'YOUR_BASE44_ACCESS_TOKEN'; // from browser localStorage
const BASE44_SERVER_URL = 'https://api.base44.com';    // or your custom server URL

const SUPABASE_URL = 'YOUR_SUPABASE_URL';              // https://xxxx.supabase.co
const SUPABASE_SERVICE_KEY = 'YOUR_SUPABASE_SERVICE_ROLE_KEY'; // service_role key (not anon)
// -----------------------

const fetch = globalThis.fetch || require('node-fetch');

// ---- Base44 API helper ----
async function base44Fetch(entity, params = {}) {
  const url = new URL(`${BASE44_SERVER_URL}/api/apps/${BASE44_APP_ID}/entities/${entity}/`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  
  const res = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${BASE44_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!res.ok) {
    const text = await res.text();
    console.error(`Base44 error for ${entity}:`, res.status, text);
    return [];
  }
  
  const data = await res.json();
  return Array.isArray(data) ? data : (data.results || data.items || []);
}

// ---- Supabase API helper ----
async function supabaseUpsert(table, rows) {
  if (!rows || rows.length === 0) {
    console.log(`  ⏭  ${table}: no rows to insert`);
    return;
  }
  
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(rows)
  });
  
  if (!res.ok) {
    const text = await res.text();
    console.error(`  ❌ Supabase error for ${table}:`, res.status, text.slice(0, 300));
  } else {
    console.log(`  ✅ ${table}: ${rows.length} rows imported`);
  }
}

// ---- Transform helpers ----
function mapProduct(p) {
  return {
    id: p.id,
    name: p.name,
    description: p.description || null,
    price: p.price || 0,
    image_url: p.image_url || null,
    category_id: p.category_id || null,
    is_available: p.is_available !== false,
    stock_quantity: p.stock_quantity || 0,
    hostel_stock: p.hostel_stock || {},
    average_rating: p.average_rating || 0,
    review_count: p.review_count || 0,
    available_from: p.available_from || null,
    available_to: p.available_to || null,
    delivery_charge: p.delivery_charge || 0,
    dhaba_options: p.dhaba_options || [],
    display_order: p.display_order || 0,
    created_at: p.created_date || new Date().toISOString()
  };
}

function mapCategory(c) {
  return {
    id: c.id,
    name: c.name,
    description: c.description || null,
    image_url: c.image_url || null,
    is_active: c.is_active !== false,
    display_order: c.display_order || 0,
    created_at: c.created_date || new Date().toISOString()
  };
}

function mapOrder(o) {
  return {
    id: o.id,
    user_id: o.user_id,
    order_number: o.order_number,
    customer_name: o.customer_name,
    items: o.items || [],
    total_amount: o.total_amount || 0,
    delivery_address: o.delivery_address || '',
    phone_number: o.phone_number || null,
    delivery_notes: o.delivery_notes || null,
    status: o.status || 'pending',
    payment_method: o.payment_method || 'cash',
    is_paid: o.is_paid || false,
    payment_id: o.payment_id || null,
    delivery_otp: o.delivery_otp || null,
    delivery_person_id: o.delivery_person_id || null,
    created_at: o.created_date || new Date().toISOString()
  };
}

function mapDeliveryPerson(d) {
  return {
    id: d.id,
    name: d.name,
    email: d.email,
    password: d.password || 'changeme123',
    phone_number: d.phone_number || null,
    vehicle_type: d.vehicle_type || null,
    assigned_hostel: d.assigned_hostel || 'All',
    is_available: d.is_available !== false,
    is_blocked: d.is_blocked || false,
    current_orders: d.current_orders || [],
    total_deliveries: d.total_deliveries || 0,
    total_earnings: d.total_earnings || 0,
    lifetime_earnings: d.lifetime_earnings || 0,
    current_shift: d.current_shift || null,
    wallet_balance: d.wallet_balance || 0,
    today_earnings: d.today_earnings || 0,
    created_at: d.created_date || new Date().toISOString()
  };
}

function mapNotification(n) {
  return {
    id: n.id,
    user_id: n.user_id,
    title: n.title,
    message: n.message || null,
    type: n.type || 'info',
    is_read: n.is_read || false,
    created_at: n.created_date || new Date().toISOString()
  };
}

function mapLoyaltyTransaction(t) {
  return {
    id: t.id,
    user_id: t.user_id,
    points: t.points || 0,
    transaction_type: t.transaction_type || 'earned',
    order_id: t.order_id || null,
    description: t.description || null,
    balance_after: t.balance_after || 0,
    created_at: t.created_date || new Date().toISOString()
  };
}

function mapCampaign(c) {
  return {
    id: c.id,
    name: c.name,
    code: c.code,
    discount_type: c.discount_type || 'fixed',
    discount_value: c.discount_value || 0,
    min_order_amount: c.min_order_amount || 0,
    usage_limit: c.usage_limit || null,
    usage_per_user: c.usage_per_user || 1,
    usage_count: c.usage_count || 0,
    total_revenue: c.total_revenue || 0,
    total_discount_given: c.total_discount_given || 0,
    is_active: c.is_active !== false,
    start_date: c.start_date || null,
    end_date: c.end_date || null,
    created_at: c.created_date || new Date().toISOString()
  };
}

function mapBanner(b) {
  return {
    id: b.id,
    title: b.title || null,
    subtitle: b.subtitle || null,
    image_url: b.image_url || null,
    link_url: b.link_url || null,
    is_active: b.is_active !== false,
    display_order: b.display_order || 0,
    start_date: b.start_date || null,
    end_date: b.end_date || null,
    view_count: b.view_count || 0,
    click_count: b.click_count || 0,
    created_at: b.created_date || new Date().toISOString()
  };
}

function mapCombo(c) {
  return {
    id: c.id,
    name: c.name,
    description: c.description || null,
    image_url: c.image_url || null,
    product_ids: c.product_ids || [],
    product_names: c.product_names || [],
    price: c.price || 0,
    original_price: c.original_price || null,
    is_active: c.is_active !== false,
    display_order: c.display_order || 0,
    created_at: c.created_date || new Date().toISOString()
  };
}

function mapSettings(s) {
  return {
    id: s.id,
    shipping_charge: s.shipping_charge || 0,
    free_delivery_above: s.free_delivery_above || 500,
    first_order_threshold: s.first_order_threshold || 100,
    store_name: s.store_name || 'CollegeCart',
    store_description: s.store_description || null,
    store_upi_id: s.store_upi_id || null,
    is_online: s.is_online !== false
  };
}

// ---- Main export function ----
async function exportAll() {
  console.log('\n🚀 Starting Base44 → Supabase export...\n');

  // 1. Categories (must be before products)
  console.log('📦 Exporting Categories...');
  const categories = await base44Fetch('Category');
  await supabaseUpsert('categories', categories.map(mapCategory));

  // 2. Products
  console.log('📦 Exporting Products...');
  const products = await base44Fetch('Product');
  await supabaseUpsert('products', products.map(mapProduct));

  // 3. Combos
  console.log('📦 Exporting Combos...');
  const combos = await base44Fetch('Combo');
  await supabaseUpsert('combos', combos.map(mapCombo));

  // 4. Banners
  console.log('📦 Exporting Banners...');
  const banners = await base44Fetch('Banner');
  await supabaseUpsert('banners', banners.map(mapBanner));

  // 5. Settings
  console.log('📦 Exporting Settings...');
  const settings = await base44Fetch('Settings');
  await supabaseUpsert('settings', settings.map(mapSettings));

  // 6. Delivery Persons
  console.log('📦 Exporting Delivery Persons...');
  const deliveryPersons = await base44Fetch('DeliveryPerson');
  await supabaseUpsert('delivery_persons', deliveryPersons.map(mapDeliveryPerson));

  // 7. Campaigns
  console.log('📦 Exporting Campaigns...');
  const campaigns = await base44Fetch('Campaign');
  await supabaseUpsert('campaigns', campaigns.map(mapCampaign));

  // 8. Orders (large - may take time)
  console.log('📦 Exporting Orders...');
  const orders = await base44Fetch('Order');
  await supabaseUpsert('orders', orders.map(mapOrder));

  // 9. Notifications
  console.log('📦 Exporting Notifications...');
  const notifications = await base44Fetch('Notification');
  await supabaseUpsert('notifications', notifications.map(mapNotification));

  // 10. Loyalty Transactions
  console.log('📦 Exporting Loyalty Transactions...');
  const loyaltyTxns = await base44Fetch('LoyaltyTransaction');
  await supabaseUpsert('loyalty_transactions', loyaltyTxns.map(mapLoyaltyTransaction));

  // 11. Roles
  console.log('📦 Exporting Roles...');
  const roles = await base44Fetch('Role');
  await supabaseUpsert('roles', roles.map(r => ({
    id: r.id,
    name: r.name,
    permissions: r.permissions || [],
    description: r.description || null,
    created_at: r.created_date || new Date().toISOString()
  })));

  // 12. Referrals
  console.log('📦 Exporting Referrals...');
  const referrals = await base44Fetch('Referral');
  await supabaseUpsert('referrals', referrals.map(r => ({
    id: r.id,
    referrer_id: r.referrer_id,
    referrer_email: r.referrer_email || null,
    referred_email: r.referred_email || null,
    referred_user_id: r.referred_user_id || null,
    referral_code: r.referral_code,
    status: r.status || 'pending',
    referrer_rewarded: r.referrer_rewarded || false,
    referred_rewarded: r.referred_rewarded || false,
    created_at: r.created_date || new Date().toISOString()
  })));

  console.log('\n✅ Export complete!\n');
  console.log('Next steps:');
  console.log('1. Check Supabase Table Editor to verify data');
  console.log('2. Add your .env variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)');
  console.log('3. Run: npm run dev\n');
}

exportAll().catch(console.error);
