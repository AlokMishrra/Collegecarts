/**
 * Import products from Base44 CSV export into Supabase
 *
 * Usage:
 *   node scripts/import-products-from-csv.js path/to/products.csv
 *
 * Requirements:
 *   npm install @supabase/supabase-js csv-parse dotenv
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // needs service role to bypass RLS

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── helpers ──────────────────────────────────────────────────────────────────

function parseBoolean(val) {
  if (val === undefined || val === null || val === '') return false;
  return val.toString().toLowerCase() === 'true';
}

function parseNumber(val, fallback = 0) {
  const n = parseFloat(val);
  return isNaN(n) ? fallback : n;
}

function parseInteger(val, fallback = 0) {
  const n = parseInt(val, 10);
  return isNaN(n) ? fallback : n;
}

function parseJson(val, fallback) {
  if (!val || val.trim() === '') return fallback;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

function parseText(val) {
  if (!val || val.trim() === '') return null;
  return val.trim();
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Usage: node scripts/import-products-from-csv.js <path-to-csv>');
    process.exit(1);
  }

  const raw = fs.readFileSync(path.resolve(csvPath), 'utf8');

  // CSV columns (order from Base44 export):
  // source_dhaba, original_price, has_variations, image_url, available_to,
  // scheduled_unavailable_date, description, delivery_time, stock_quantity,
  // available_from, is_available, tags, low_stock_threshold, unit,
  // delivery_charge, category_id, hostel_stock, price, variations, name,
  // profit_margin, dhaba_options, scheduled_available_date, id,
  // created_date, updated_date, created_by_id, created_by, is_sample

  const records = parse(raw, {
    columns: [
      'source_dhaba',
      'original_price',
      'has_variations',
      'image_url',
      'available_to',
      'scheduled_unavailable_date',
      'description',
      'delivery_time',
      'stock_quantity',
      'available_from',
      'is_available',
      'tags',
      'low_stock_threshold',
      'unit',
      'delivery_charge',
      'category_id',
      'hostel_stock',
      'price',
      'variations',
      'name',
      'profit_margin',
      'dhaba_options',
      'scheduled_available_date',
      'id',
      'created_date',
      'updated_date',
      'created_by_id',
      'created_by',
      'is_sample',
    ],
    skip_empty_lines: true,
    from_line: 2, // skip header row if present; set to 1 if no header
    relax_column_count: true,
    trim: true,
  });

  console.log(`Parsed ${records.length} products from CSV`);

  const products = records.map((r) => ({
    // Use the original Base44 id so re-imports are idempotent
    id: parseText(r.id) || undefined,

    name: r.name?.trim() || 'Unnamed Product',
    description: parseText(r.description),
    price: parseNumber(r.price),
    original_price: r.original_price ? parseNumber(r.original_price) : null,
    image_url: parseText(r.image_url),

    // category_id: keep as-is (uuid string from Base44)
    // If your Supabase categories have different UUIDs, set this to null
    // and map manually after import.
    category_id: parseText(r.category_id) || null,

    is_available: parseBoolean(r.is_available),
    stock_quantity: parseInteger(r.stock_quantity),
    hostel_stock: parseJson(r.hostel_stock, {}),

    available_from: parseText(r.available_from),
    available_to: parseText(r.available_to),
    delivery_time: parseText(r.delivery_time),
    delivery_charge: parseNumber(r.delivery_charge),

    source_dhaba: parseText(r.source_dhaba),
    has_variations: parseBoolean(r.has_variations),
    variations: parseJson(r.variations, []),
    dhaba_options: parseJson(r.dhaba_options, []),
    tags: parseJson(r.tags, []),

    unit: parseText(r.unit) || 'piece',
    low_stock_threshold: parseInteger(r.low_stock_threshold, 10),
    profit_margin: parseNumber(r.profit_margin),

    scheduled_available_date: parseText(r.scheduled_available_date),
    scheduled_unavailable_date: parseText(r.scheduled_unavailable_date),

    is_sample: parseBoolean(r.is_sample),
    created_by_id: parseText(r.created_by_id),
    created_by: parseText(r.created_by),

    created_at: parseText(r.created_date) || new Date().toISOString(),
    updated_at: parseText(r.updated_date) || new Date().toISOString(),
  }));

  // Upsert in batches of 50
  const BATCH = 50;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < products.length; i += BATCH) {
    const batch = products.slice(i, i + BATCH);
    const { error } = await supabase
      .from('products')
      .upsert(batch, { onConflict: 'id' });

    if (error) {
      console.error(`Batch ${i / BATCH + 1} error:`, error.message);
      errors += batch.length;
    } else {
      inserted += batch.length;
      console.log(`Imported ${inserted}/${products.length} products...`);
    }
  }

  console.log(`\nDone. Imported: ${inserted}, Errors: ${errors}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
