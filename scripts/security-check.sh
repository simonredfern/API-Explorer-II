#!/usr/bin/env bash
# Runs three tiers of security checks and reports all findings together:
#   1. npm audit                    - known CVEs in dependencies
#   2. secretlint                   - committed secrets / tokens / keys
#   3. eslint-plugin-security       - insecure code patterns (eval, regex dos, etc.)
#
# Intentionally runs all three even if an earlier one fails, so a single run
# gives the full picture. Exits non-zero if any check reported issues.

set -u
cd "$(dirname "$0")/.."

FAILED=0

section() {
  echo ""
  echo "================================================================"
  echo "  $1"
  echo "================================================================"
}

section "1/3  npm audit (dependency vulnerabilities, high+)"
npm audit --audit-level=high || FAILED=1

section "2/3  secretlint (committed secrets)"
npx --no-install secretlint --maskSecrets "**/*" || FAILED=1

section "3/3  eslint-plugin-security (insecure code patterns)"
npx --no-install eslint \
  --config scripts/eslint-security.config.mjs \
  src server \
  || FAILED=1

echo ""
if [ "$FAILED" -eq 0 ]; then
  echo "OK  all security checks passed"
else
  echo "FAIL  one or more security checks reported issues (see output above)"
fi
exit $FAILED
