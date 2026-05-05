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
      res.on('end', () => {
        console.log(`  [${res.statusCode}] ${path.split('?')[0]}: ${data.slice(0,200)}`);
        try {
          const parsed = JSON.parse(data);
          if (!Array.isArray(parsed)) { resolve([]); } else { resolve(parsed); }
        } catch(e) { resolve([]); }
      });
    });
    req.on('error', reject);
  });
}

const products = await get('/products?select=id,name,category_id,is_available&limit=5');
console.log('\n📦 Products count check:');
const allProducts = await get('/products?select=id,category_id&limit=1000');
console.log(`  Total products: ${allProducts.length}`);
console.log('  Sample:');
products.forEach(p => console.log(`  - "${p.name}" | cat: ${p.category_id} | available: ${p.is_available}`));

const categories = await get('/categories?select=id,name&limit=50');
console.log(`\n📂 Categories: ${categories.length}`);
categories.slice(0,5).forEach(c => console.log(`  - ${c.name} (${c.id})`));

// Find unique category_ids in products
const productCatIds = [...new Set(allProducts.map(p => p.category_id).filter(Boolean))];
console.log(`\n🔍 Unique category_ids in products (${productCatIds.length}):`);
productCatIds.slice(0,10).forEach(id => console.log(`  - ${id}`));

const catIds = new Set(categories.map(c => c.id));
const matched = allProducts.filter(p => catIds.has(p.category_id));
console.log(`\n✅ Products matching a category: ${matched.length}/${allProducts.length}`);

// Find which product cat IDs are missing from categories
const missing = productCatIds.filter(id => !catIds.has(id));
if (missing.length > 0) {
  console.log(`\n❌ Missing category IDs (${missing.length}):`);
  missing.forEach(id => console.log(`  - ${id}`));
}
