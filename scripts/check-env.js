// Script to check for spaces in environment variables
import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');

const lines = envContent.split('\n');
let hasIssues = false;

lines.forEach((line, index) => {
  if (line.trim() && !line.startsWith('#')) {
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=');
    
    if (value && (value.startsWith(' ') || value.endsWith(' '))) {
      console.error(`❌ Line ${index + 1}: "${key}" has leading/trailing spaces`);
      console.error(`   Current: "${value}"`);
      console.error(`   Should be: "${value.trim()}"`);
      hasIssues = true;
    }
  }
});

if (!hasIssues) {
  console.log('✅ No environment variable issues found!');
} else {
  console.log('\n⚠️  Please remove spaces from the values above');
  process.exit(1);
}
