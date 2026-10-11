#!/usr/bin/env bash
# Fail if anything a partner could reach names Centum or points at a CADB host.
#
# Scans the partner apps' source and their built output (what browsers and
# servers actually run). Run after building, before every partner deploy:
#
#   scripts/check-partner-brand.sh
#
# Comments in this file and in packages/partner-db are allowed to mention the
# words; the scan covers only the partner apps.

set -uo pipefail
cd "$(dirname "$0")/.."

PATTERN='centum|cadb\.centumacademy|65\.0\.41\.55'
TARGETS=()
for app in apps/partner-*; do
  [ -d "$app/src" ] && TARGETS+=("$app/src")
  [ -d "$app/dist" ] && TARGETS+=("$app/dist")
  [ -d "$app/.next/static" ] && TARGETS+=("$app/.next/static")
  [ -d "$app/.next/server" ] && TARGETS+=("$app/.next/server")
  [ -d "$app/public" ] && TARGETS+=("$app/public")
done

if [ ${#TARGETS[@]} -eq 0 ]; then echo "No partner apps found."; exit 1; fi

hits="$(grep -rliE "$PATTERN" "${TARGETS[@]}" 2>/dev/null || true)"
if [ -n "$hits" ]; then
  echo "FAIL: Centum or CADB host references found in partner code:"
  echo "$hits" | sed 's/^/  /'
  grep -rnoiE "$PATTERN" $hits 2>/dev/null | head -20 | sed 's/^/    /'
  exit 1
fi
echo "OK: no Centum or CADB host references in ${#TARGETS[@]} partner locations."
