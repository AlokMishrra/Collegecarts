/**
 * Seeds categories from the Base44 CSV category IDs
 * Run: node scripts/seed-categories.js
 */
import https from 'https';
import dotenv from 'dotenv';

dotenv.config();

const BASE = `${process.env.VITE_SUPABASE_URL}/rest/v1`;
const KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!BASE || !KEY) {
  console.error('❌ Missing environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

// These are the exact Base44 category IDs from the CSV
// Mapped to human-readable names based on the products in each category
const CATEGORIES = [
  { id: '6885bbf34725104adf64ac85', name: 'Snacks & Chips',      display_order: 1 },
  { id: '69ecf8631f9e8c5717d4eb2c', name: 'Biscuits & Cookies',  display_order: 2 },
  { id: '69c616f922ef4048088e9aeb', name: 'Noodles & Instant',   display_order: 3 },
  { id: '693d680fa08e8413d81fc186', name: 'Cold Drinks',         display_order: 4 },
  { id: '693aa927980f2ac97f054e74', name: 'Hot Beverages',       display_order: 5 },
  { id: '693d52ffe5ceabf40fd93861', name: 'Roti & Paratha',      display_order: 6 },
  { id: '6943d0d63ec530b4b953ca51', name: 'Paneer Dishes',       display_order: 7 },
  { id: '693d1437268386acee4a3997', name: 'Veg Curries',         display_order: 8 },
  { id: '6942424bf8d5002de71353ea', name: 'Rice & Biryani',      display_order: 9 },
  { id: '693d91828cc8803c4762153a', name: 'Pizza',               display_order: 10 },
  { id: '693aaf17c3da1ef8fa5024a1', name: 'Chinese & Fast Food', display_order: 11 },
  { id: '693c066fe0adb39df74bf7ac', name: 'Shakes & Juices',     display_order: 12 },
  { id: '693d6d83aa86e9de5743eb04', name: 'Burgers',             display_order: 13 },
  { id: '694530e2454833b1bee327da', name: 'Pasta',               display_order: 14 },
  { id: '69452e94975c681520ea7484', name: 'French Fries',        display_order: 15 },
  { id: '6945278f5e36dc769c62e13f', name: 'Raita & Dahi',        display_order: 16 },
  { id: '694534a76d0e57387afad1fa', name: 'Sandwiches',          display_order: 17 },
  { id: '694537aac2def1eeaf0b4224', name: 'Chaat & Snacks',      display_order: 18 },
  { id: '69467ac215fedb333ee523e6', name: 'Biryani',             display_order: 19 },
  { id: '693a77ef1a391d19b5f53055', name: 'South Indian',        display_order: 20 },
  { id: '6988b753b6208c1c525237ff', name: 'Gifts & Combos',      display_order: 21 },
  { id: '698b776f5315bfa282461aec', name: 'Special Combos',      display_order: 22 },
  { id: '69a59870af23a62108fba2b9', name: 'Holi Special',        display_order: 23 },
  { id: '693d3c4f44571be2c9ec51d4', name: 'Dhaba Specials',      display_order: 24 },
  { id: '693ff3d9360832e72f82b90f', name: 'Cooked Meals',        display_order: 25 },
  { id: '6885bbf34725104adf64ac84', name: 'Dairy & Eggs',        display_order: 26 },
  { id: '693d13a99b7111df5ada61f02', name: 'Household',          display_order: 27 },
  { id: '69b99894b88096cd0df2e20d', name: 'Personal Care',       display_order: 28 },
  { id: '693cdfbeec4ef67798648ccbb', name: 'Sweets',             display_order: 29 },
];

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const url = new URL(`${BASE}${path}`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'apikey': KEY,
        'Authorization': `Bearer ${KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    const req = https.request(options, (res) => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

console.log(`Seeding ${CATEGORIES.length} categories...`);

const result = await post('/categories?on_conflict=id', CATEGORIES.map(c => ({
  ...c,
  is_active: true,
  description: c.name,
})));

if (result.status >= 200 && result.status < 300) {
  console.log(`✅ Successfully seeded ${CATEGORIES.length} categories`);
} else {
  console.error('❌ Error:', result.status, result.body);
}
