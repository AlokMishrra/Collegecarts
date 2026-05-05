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
        try { resolve(JSON.parse(data)); } catch { resolve([]); }
      });
    });
    req.on('error', reject);
  });
}

const users = await get('/users?select=email,full_name,role,selected_hostel&limit=1000');
console.log(`\n👥 Total users in DB: ${users.length}`);

if (!Array.isArray(users)) {
  console.log('API response:', JSON.stringify(users));
} else {
  const admins = users.filter(u => u.role === 'admin');
  console.log(`\n🔑 Admins (${admins.length}):`);
  admins.forEach(u => console.log(`  - ${u.full_name} (${u.email})`));

  console.log(`\n📋 Sample users:`);
  users.slice(0, 5).forEach(u => console.log(`  - ${u.full_name} | ${u.email} | ${u.selected_hostel}`));
}
