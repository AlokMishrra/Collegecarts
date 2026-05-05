/**
 * CollegeCart — Complete Database Migration Script
 * Connects directly to Supabase Postgres and runs all SQL files.
 * 
 * Usage: node scripts/migrate.mjs
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = resolve(__dirname, '..');

// Supabase Postgres connection
// Format: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
// Or: postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
const PROJECT_REF = 'vbbdzhuzwgiipsnssmxq';
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || 'YOUR_DB_PASSWORD';

// Direct connection (non-pooled) — best for migrations
const DATABASE_URL = process.env.DATABASE_URL || 
  `postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`;

// SQL files to run in order
const SQL_FILES = [
  { file: 'supabase/schema.sql', label: '🏗️  Base Schema (25+ tables + RLS)' },
  { file: 'supabase/migrations/complete-fix.sql', label: '🔧 Complete Fix (RLS + missing tables)' },
  { file: 'supabase/fix-rls-recursion.sql', label: '🛡️  RLS Recursion Fix' },
];

async function runMigrations() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║    CollegeCart — Supabase Database Migration     ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  if (DB_PASSWORD === 'YOUR_DB_PASSWORD' && !process.env.DATABASE_URL) {
    console.log('❌ Database password not set!\n');
    console.log('   Set it via environment variable:\n');
    console.log('   Windows (cmd):');
    console.log('     set SUPABASE_DB_PASSWORD=your_password_here');
    console.log('     node scripts/migrate.mjs\n');
    console.log('   Windows (PowerShell):');
    console.log('     $env:SUPABASE_DB_PASSWORD="your_password_here"');
    console.log('     node scripts/migrate.mjs\n');
    console.log('   OR set the full DATABASE_URL:');
    console.log('     set DATABASE_URL=postgresql://postgres.vbbdzhuzwgiipsnssmxq:PASSWORD@aws-0-ap-south-1.pooler.supabase.com:5432/postgres');
    console.log('     node scripts/migrate.mjs\n');
    console.log('   📍 Find your DB password in Supabase Dashboard → Settings → Database\n');
    process.exit(1);
  }

  // Connect to database
  console.log('🔌 Connecting to Supabase Postgres...');
  const client = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();
    console.log('   ✅ Connected!\n');
  } catch (err) {
    console.error(`   ❌ Connection failed: ${err.message}\n`);
    console.log('   Common causes:');
    console.log('   - Wrong database password');
    console.log('   - Wrong region in connection URL');
    console.log('   - IP not allowed (check Supabase → Settings → Database → Network restrictions)\n');
    process.exit(1);
  }

  // Verify connection
  try {
    const result = await client.query('SELECT current_database(), current_user, version()');
    const row = result.rows[0];
    console.log(`   Database: ${row.current_database}`);
    console.log(`   User:     ${row.current_user}`);
    console.log(`   Postgres: ${row.version.split(',')[0]}\n`);
  } catch (err) {
    console.error(`   ⚠️  Could not verify connection: ${err.message}\n`);
  }

  // Run each SQL file
  let totalSuccess = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const { file: sqlFile, label } of SQL_FILES) {
    const filePath = resolve(PROJECT_DIR, sqlFile);
    let sql;
    try {
      sql = readFileSync(filePath, 'utf8');
    } catch (err) {
      console.log(`   ⚠️  Skipping ${sqlFile} (file not found)\n`);
      continue;
    }

    console.log(`${'─'.repeat(50)}`);
    console.log(`${label}`);
    console.log(`   File: ${sqlFile} (${sql.length} bytes)`);

    // Run the entire file as a single transaction
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      console.log('   ✅ Applied successfully!\n');
      totalSuccess++;
    } catch (err) {
      await client.query('ROLLBACK');
      
      const errMsg = err.message || '';
      
      // Check if it's a benign error (already exists)
      if (errMsg.includes('already exists') || 
          errMsg.includes('duplicate') ||
          errMsg.includes('42710') ||
          errMsg.includes('42P07')) {
        console.log(`   ⏭️  Already applied (${errMsg.slice(0, 80)})\n`);
        totalSkipped++;
        
        // Try running statements individually to apply only what's missing
        console.log('   🔄 Retrying statements individually...');
        const individualResults = await runStatementsIndividually(client, sql);
        console.log(`      ✅ ${individualResults.success} ok | ⏭️ ${individualResults.skipped} skipped | ❌ ${individualResults.failed} failed\n`);
      } else {
        console.log(`   ❌ Error: ${errMsg.slice(0, 200)}\n`);
        
        // Still try individual statements
        console.log('   🔄 Retrying statements individually...');
        const individualResults = await runStatementsIndividually(client, sql);
        console.log(`      ✅ ${individualResults.success} ok | ⏭️ ${individualResults.skipped} skipped | ❌ ${individualResults.failed} failed\n`);
        totalFailed++;
      }
    }
  }

  // Close connection
  await client.end();

  // Summary
  console.log('═'.repeat(50));
  console.log('📊 Migration Summary:');
  console.log(`   ✅ Successful: ${totalSuccess}`);
  console.log(`   ⏭️  Skipped:    ${totalSkipped}`);
  console.log(`   ❌ Failed:     ${totalFailed}`);
  console.log('═'.repeat(50));

  if (totalFailed === 0) {
    console.log('\n🎉 All migrations completed! Your database is ready.');
    console.log('   Start the app:  npm run dev');
    console.log('   Open:           http://localhost:5173\n');
  } else {
    console.log('\n⚠️  Some migrations had issues. Check errors above.\n');
  }
}

/**
 * Run SQL statements individually — handles files where some statements already exist
 */
async function runStatementsIndividually(client, sql) {
  const statements = splitStatements(sql);
  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const stmt of statements) {
    // Skip pure comments
    const nonComment = stmt.split('\n').filter(l => !l.trim().startsWith('--')).join('\n').trim();
    if (!nonComment || nonComment.length < 3) continue;

    try {
      await client.query(stmt);
      success++;
    } catch (err) {
      const errMsg = err.message || '';
      if (errMsg.includes('already exists') || 
          errMsg.includes('duplicate') ||
          errMsg.includes('42710') ||
          errMsg.includes('42P07') ||
          errMsg.includes('cannot change')) {
        skipped++;
      } else {
        // Log non-trivial errors for debugging
        const preview = nonComment.split('\n')[0].slice(0, 60);
        console.log(`      ⚠️  "${preview}..." → ${errMsg.slice(0, 80)}`);
        failed++;
      }
    }
  }

  return { success, failed, skipped };
}

/**
 * Split SQL into individual statements (handles $$ blocks, DO blocks, etc.)
 */
function splitStatements(sql) {
  const statements = [];
  let current = '';
  let dollarQuoteDepth = 0;
  const lines = sql.split('\n');

  for (const line of lines) {
    current += line + '\n';

    // Track $$ dollar-quoted blocks
    const dollarMatches = line.match(/\$\$/g);
    if (dollarMatches) {
      dollarQuoteDepth += dollarMatches.length;
    }

    const isInsideDollarQuote = dollarQuoteDepth % 2 !== 0;

    // If we find a semicolon at the end and we're not inside a $$ block
    if (line.trim().endsWith(';') && !isInsideDollarQuote) {
      const stmt = current.trim();
      if (stmt.length > 3) {
        statements.push(stmt);
      }
      current = '';
    }
  }

  // Push remaining
  if (current.trim().length > 3) {
    statements.push(current.trim());
  }

  return statements;
}

runMigrations().catch(err => {
  console.error('💥 Unhandled error:', err.message);
  process.exit(1);
});
