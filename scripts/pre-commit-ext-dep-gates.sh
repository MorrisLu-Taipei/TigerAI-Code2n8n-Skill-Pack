#!/usr/bin/env bash
# v0.39.0 SEC-019 enforcement — local pre-commit gates for
# external-dependency-security Skill rules. Catches violations BEFORE
# they reach CI (faster feedback for AI Coders / human devs).
#
# Install:
#   chmod +x scripts/pre-commit-ext-dep-gates.sh
#   ln -sf ../../scripts/pre-commit-ext-dep-gates.sh .git/hooks/pre-commit
#
# Or invoke manually before commit:
#   bash scripts/pre-commit-ext-dep-gates.sh
#
# Exit 0 = pass, non-zero = blocked.

set -e
fail=0

echo "=== Gate 1 (Skill §3): GitHub raw URLs must lock commit sha ==="
# Look at staged changes only (faster + relevant to this commit)
STAGED=$(git diff --cached --diff-filter=AM --name-only | grep -vE '^(node_modules/|dist/|\.git/)' || true)
if [ -n "$STAGED" ]; then
  OFFENDERS=""
  for f in $STAGED; do
    [ -f "$f" ] || continue
    HITS=$(grep -hoE 'raw\.githubusercontent\.com/[^/]+/[^/]+/[^/[:space:]"'"'"']+' "$f" 2>/dev/null || true)
    for h in $HITS; do
      # Extract the <ref> segment
      ref=$(echo "$h" | sed -E 's|raw\.githubusercontent\.com/[^/]+/[^/]+/([^/]+)/.*|\1|')
      if [ ${#ref} -ne 40 ] || ! echo "$ref" | grep -qE '^[a-f0-9]{40}$'; then
        OFFENDERS="$OFFENDERS\n  - $f: $h (ref='$ref' is not 40-char hex sha)"
      fi
    done
  done
  if [ -n "$OFFENDERS" ]; then
    echo "❌ Skill §3 violation — GitHub raw URLs must lock commit sha:"
    echo -e "$OFFENDERS"
    echo "Fix: replace /main/ or /master/ with the actual commit sha."
    fail=1
  else
    echo "OK — all GitHub raw URLs in staged files lock commit sha."
  fi
fi

echo ""
echo "=== Gate 2 (Skill §1.6): package.json must use exact pins (no caret/tilde/range) ==="
STAGED_PKGS=$(git diff --cached --diff-filter=AM --name-only | grep -E '/(svc|api)/package.json$' || true)
if [ -n "$STAGED_PKGS" ]; then
  for pj in $STAGED_PKGS; do
    [ -f "$pj" ] || continue
    OFFENDERS=$(node -e "
      const p = JSON.parse(require('fs').readFileSync('$pj','utf8'));
      const o = [];
      for (const sec of ['dependencies','devDependencies']) {
        for (const [n,v] of Object.entries(p[sec]||{})) {
          if (/^[\\^~><=]/.test(v)) o.push(n + '@' + v);
        }
      }
      if (o.length) console.log(o.join('\n'));
    ")
    if [ -n "$OFFENDERS" ]; then
      echo "❌ Skill §1.6 violation — $pj has range specifiers:"
      echo "$OFFENDERS" | sed 's/^/  - /'
      fail=1
    else
      echo "OK — $pj all pins exact."
    fi
  done
fi

echo ""
echo "=== Gate 3 (Skill §5.2): Dockerfile FROM must hash-pin (sha256 digest or ARG) ==="
STAGED_DF=$(git diff --cached --diff-filter=AM --name-only | grep -E '(^|/)Dockerfile$' || true)
if [ -n "$STAGED_DF" ]; then
  for df in $STAGED_DF; do
    [ -f "$df" ] || continue
    UNPINNED=$(grep -E '^FROM ' "$df" | grep -vE '@sha256:|\$\{[A-Z_]+\}' || true)
    if [ -n "$UNPINNED" ]; then
      if ! grep -qE 'ARG\s+[A-Z_]*(IMAGE|DIGEST)' "$df"; then
        echo "❌ Skill §5.2 violation — $df FROM not hash-pinned + no ARG/DIGEST:"
        echo "$UNPINNED" | sed 's/^/  - /'
        fail=1
      fi
    fi
  done
  [ $fail -eq 0 ] && echo "OK — Dockerfile FROM hash-pinned or ARG-based."
fi

echo ""
if [ $fail -ne 0 ]; then
  echo "❌ pre-commit blocked by external-dependency-security gates."
  echo "Either fix the violations above, or commit with --no-verify (NOT recommended)."
  exit 1
fi
echo "✅ all external-dependency-security pre-commit gates passed."
exit 0
