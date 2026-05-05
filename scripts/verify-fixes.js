#!/usr/bin/env node

/**
 * Verification script for auth lock and database fixes
 * Run with: node scripts/verify-fixes.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Verifying Auth Lock & Database Fixes...\n');

const checks = [];

// Check 1: User.js has caching
const userJsPath = path.join(__dirname, '../src/entities/User.js');
if (fs.existsSync(userJsPath)) {
  const content = fs.readFileSync(userJsPath, 'utf8');
  const hasCaching = content.includes('_userCache') && content.includes('_cacheTime');
  const hasClearCache = content.includes('clearCache()');
  checks.push({
    name: 'User.js caching implementation',
    passed: hasCaching && hasClearCache,
    details: hasCaching && hasClearCache ? 'Cache mechanism found' : 'Missing cache implementation'
  });
} else {
  checks.push({
    name: 'User.js exists',
    passed: false,
    details: 'File not found'
  });
}

// Check 2: AuthContext has mounted flag
const authContextPath = path.join(__dirname, '../src/lib/AuthContext.jsx');
if (fs.existsSync(authContextPath)) {
  const content = fs.readFileSync(authContextPath, 'utf8');
  const hasMountedFlag = content.includes('let mounted = true');
  const hasCleanup = content.includes('mounted = false');
  checks.push({
    name: 'AuthContext cleanup implementation',
    passed: hasMountedFlag && hasCleanup,
    details: hasMountedFlag && hasCleanup ? 'Proper cleanup found' : 'Missing cleanup logic'
  });
} else {
  checks.push({
    name: 'AuthContext exists',
    passed: false,
    details: 'File not found'
  });
}

// Check 3: CategorySection has loading flag
const categorySectionPath = path.join(__dirname, '../src/components/shop/CategorySection.jsx');
if (fs.existsSync(categorySectionPath)) {
  const content = fs.readFileSync(categorySectionPath, 'utf8');
  const hasLoadingFlag = content.includes('isLoadingUser');
  const hasMountedFlag = content.includes('let mounted = true');
  checks.push({
    name: 'CategorySection race condition prevention',
    passed: hasLoadingFlag && hasMountedFlag,
    details: hasLoadingFlag && hasMountedFlag ? 'Loading flag and cleanup found' : 'Missing prevention logic'
  });
} else {
  checks.push({
    name: 'CategorySection exists',
    passed: false,
    details: 'File not found'
  });
}

// Check 4: AIKnowledgeBase has fallback
const knowledgeBasePath = path.join(__dirname, '../src/components/knowledge/AIKnowledgeBase.jsx');
if (fs.existsSync(knowledgeBasePath)) {
  const content = fs.readFileSync(knowledgeBasePath, 'utf8');
  const hasFallback = content.includes('viewCountError') || content.includes('view_count column not found');
  checks.push({
    name: 'AIKnowledgeBase fallback logic',
    passed: hasFallback,
    details: hasFallback ? 'Fallback for missing column found' : 'Missing fallback logic'
  });
} else {
  checks.push({
    name: 'AIKnowledgeBase exists',
    passed: false,
    details: 'File not found'
  });
}

// Check 5: OnboardingTour has error handling
const onboardingPath = path.join(__dirname, '../src/components/onboarding/OnboardingTour.jsx');
if (fs.existsSync(onboardingPath)) {
  const content = fs.readFileSync(onboardingPath, 'utf8');
  const hasErrorHandling = content.includes('createError') && content.includes('Silently fail');
  checks.push({
    name: 'OnboardingTour error handling',
    passed: hasErrorHandling,
    details: hasErrorHandling ? 'Graceful error handling found' : 'Missing error handling'
  });
} else {
  checks.push({
    name: 'OnboardingTour exists',
    passed: false,
    details: 'File not found'
  });
}

// Check 6: Migration file exists
const migrationPath = path.join(__dirname, '../supabase/fix-auth-and-schema.sql');
const migrationExists = fs.existsSync(migrationPath);
checks.push({
  name: 'Database migration file',
  passed: migrationExists,
  details: migrationExists ? 'Migration file found' : 'Migration file missing'
});

// Check 7: React Strict Mode is disabled
const mainJsxPath = path.join(__dirname, '../src/main.jsx');
if (fs.existsSync(mainJsxPath)) {
  const content = fs.readFileSync(mainJsxPath, 'utf8');
  const strictModeDisabled = content.includes('// <React.StrictMode>') || !content.includes('<React.StrictMode>');
  checks.push({
    name: 'React Strict Mode disabled',
    passed: strictModeDisabled,
    details: strictModeDisabled ? 'Strict Mode is commented out' : 'Strict Mode is active (may cause double mounting)'
  });
} else {
  checks.push({
    name: 'main.jsx exists',
    passed: false,
    details: 'File not found'
  });
}

// Print results
console.log('📋 Verification Results:\n');
let allPassed = true;

checks.forEach((check, index) => {
  const icon = check.passed ? '✅' : '❌';
  console.log(`${icon} ${index + 1}. ${check.name}`);
  console.log(`   ${check.details}\n`);
  if (!check.passed) allPassed = false;
});

console.log('─'.repeat(60));

if (allPassed) {
  console.log('\n✨ All checks passed! Your fixes are properly implemented.\n');
  console.log('Next steps:');
  console.log('1. Run the database migration: supabase/fix-auth-and-schema.sql');
  console.log('2. Clear browser cache and hard refresh');
  console.log('3. Test the application');
  console.log('\nSee AUTH_LOCK_FIX_GUIDE.md for detailed instructions.\n');
} else {
  console.log('\n⚠️  Some checks failed. Please review the issues above.\n');
  console.log('See AUTH_LOCK_FIX_GUIDE.md for troubleshooting.\n');
  process.exit(1);
}
