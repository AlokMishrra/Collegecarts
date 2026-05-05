#!/bin/bash

# ============================================================
# Secret Scanner - Prevents committing sensitive data
# Run before: git commit
# ============================================================

echo "🔍 Scanning for exposed secrets..."
echo ""

FOUND_SECRETS=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Patterns to search for
PATTERNS=(
  "rzp_live_[A-Za-z0-9]+"
  "rzp_test_[A-Za-z0-9]+"
  "RAZORPAY_KEY_SECRET.*=.*[A-Za-z0-9]{20,}"
  "VITE_RAZORPAY_KEY_SECRET"
  "service_role.*eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
  "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.eyJpc3MiOiJzdXBhYmFzZSI"
  "SUPABASE_SERVICE_ROLE_KEY.*=.*eyJ"
  "SERVICE_KEY.*=.*eyJ"
)

# Files/directories to exclude
EXCLUDE_DIRS="node_modules|dist|.git|.vercel"
EXCLUDE_FILES=".env.example|scan-for-secrets.sh|SECURITY_AUDIT_REPORT.md|SECURE_DEPLOYMENT_GUIDE.md"

# Search for each pattern
for PATTERN in "${PATTERNS[@]}"; do
  echo "Checking for: $PATTERN"
  
  RESULTS=$(grep -rn -E "$PATTERN" . \
    --exclude-dir={node_modules,dist,.git,.vercel} \
    --exclude={.env.example,scan-for-secrets.sh,SECURITY_AUDIT_REPORT.md,SECURE_DEPLOYMENT_GUIDE.md} \
    2>/dev/null)
  
  if [ ! -z "$RESULTS" ]; then
    echo -e "${RED}❌ FOUND POTENTIAL SECRET:${NC}"
    echo "$RESULTS"
    echo ""
    FOUND_SECRETS=1
  fi
done

echo ""
echo "─────────────────────────────────────────────────────"

if [ $FOUND_SECRETS -eq 1 ]; then
  echo -e "${RED}🚨 SECRETS DETECTED!${NC}"
  echo ""
  echo "Potential secrets were found in your codebase."
  echo "Please remove them before committing to git."
  echo ""
  echo "Common fixes:"
  echo "  1. Move secrets to .env file (and ensure .env is in .gitignore)"
  echo "  2. Use environment variables instead of hardcoded values"
  echo "  3. For Supabase Edge Functions, use: Deno.env.get('SECRET_NAME')"
  echo "  4. Delete files containing secrets (e.g., archive/deploy-*.txt)"
  echo ""
  exit 1
else
  echo -e "${GREEN}✅ No secrets detected!${NC}"
  echo ""
  echo "Your code appears to be safe to commit."
  echo ""
  exit 0
fi
