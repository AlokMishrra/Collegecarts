import https from 'https';
import dotenv from 'dotenv';

dotenv.config();

const BASE = `${process.env.VITE_SUPABASE_URL}/rest/v1`;
const KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!BASE || !KEY) {
  console.error('❌ Missing environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

function get(path) {
  return new Promise((resolve, reject) => {
    const req = https.get(`${BASE}${path}`, {
      headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` }
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
  });
}

const products = await get('/products?select=id,name,category_id,is_available&limit=5');
console.log('\n📦 Sample products in DB:');
products.forEach(p => console.log(`  - ${p.name} | category_id: ${p.category_id} | available: ${p.is_available}`));

const categories = await get('/categories?select=id,name&limit=20');
console.log('\n📂 Categories in DB:');
if (categories.length === 0) {
  console.log('  ⚠️  NO CATEGORIES FOUND — this is why products are not showing!');
} else {
  categories.forEach(c => console.log(`  - ${c.name} | id: ${c.id}`));
}

// Check if any product category_ids match categories
const catIds = new Set(categories.map(c => c.id));
const matched = products.filter(p => catIds.has(p.category_id));
console.log(`\n✅ Products with matching category: ${matched.length}/${products.length}`);
if (matched.length === 0) {
  console.log('  ⚠️  No products match any category — products will NOT show on shop page');
}
