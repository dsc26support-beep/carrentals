#!/usr/bin/env bash
# Applies every migration to a throwaway database, then asserts the constraints
# and RLS policies actually behave. Run:  ./v2/tests/db/run.sh
set -euo pipefail

HOST="${PGHOST:-/tmp}"; PORT="${PGPORT:-5433}"; DB="tenana_test"
HERE="$(cd "$(dirname "$0")" && pwd)"; MIG="$HERE/../../supabase/migrations"
psql() { command psql -h "$HOST" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 "$@"; }

psql -d postgres -qc "drop database if exists $DB;" >/dev/null
psql -d postgres -qc "create database $DB;"        >/dev/null

psql -d "$DB" -qf "$HERE/shim.sql" >/dev/null
for f in "$MIG"/*.sql; do
  psql -d "$DB" -qf "$f" >/dev/null || { echo "FAILED applying $(basename "$f")"; exit 1; }
  echo "  applied $(basename "$f")"
done
psql -d "$DB" -qf "$HERE/grants.sql"                >/dev/null
psql -d "$DB" -qf "$HERE/../../supabase/seed.sql"   >/dev/null
echo "  seeded"
psql -d "$DB" -f "$HERE/assert.sql" 2>&1 | grep -E "PASS|FAIL|---"
psql -d "$DB" -f "$HERE/rls.sql" 2>&1 | grep -E "PASS|FAIL|---"
