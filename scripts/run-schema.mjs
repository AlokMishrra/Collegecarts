/**
 * Runs schema.sql against Supabase using the REST API
 * Each statement is executed individually via the Supabase SQL endpoint
 */

import { readFileSync } from 'fs';

const SUPABASE_URL = 'https://vbbdzhuzwgiipsnssmxq.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiYmR6aHV6d2dpaXBzbnNzbXhxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM1MDE5MSwiZXhwIjoyMDkyOTI2MTkxfQ.JLU7gEOPhPQxqzs0B-tZ1uwmnwmQkPtY7XSEL6gcLDc';

const schema = readFileSync('supabase/schema.sql', 'utf8');

// Split into individual statements (split on semicolons, keep non-empty)
const statements = schema
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 5 && !s.startsWith('--'));

async function runSQL(sql) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql }),
  });
  return res;
}

// Use the Supabase SQL API via the pg endpoint
async function runSchemaViaAPI() {
  console.log('Running schema via Supabase SQL API...\n');

  // The correct endpoint for running SQL is the database REST endpoint
  const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    }
  });
  
  console.log('API reachable:', res.status === 200 ? 'YES' : `Status ${res.status}`);
  
  // Run each statement
  let success = 0;
  let failed = 0;
  
  for (const stmt of statements) {
    if (!stmt.trim()) continue;
    
    // Use the Supabase SQL function
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/query`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: stmt + ';' }),
    });
    
    if (response.ok) {
      success++;
    } else {
      const err = await response.text();
      // Ignore "already exists" errors
      if (err.includes('already exists') || err.includes('duplicate')) {
        success++;
      } else {
        console.log(`WARN: ${err.slice(0, 100)}`);
        failed++;
      }
    }
  }
  
  console.log(`\nDone: ${success} succeeded, ${failed} failed`);
}

runSchemaViaAPI().catch(console.error);
