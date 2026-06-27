#!/usr/bin/env bash
# LOOPHOLE — Benchmark harness
set -euo pipefail
cd "$(dirname "$0")"

echo "=== LOOPHOLE Benchmark ===" >&2
echo "Running simulation benchmark..." >&2

/mnt/c/nvm4w/nodejs/node.exe node_modules/tsx/dist/cli.mjs benchmark.ts > _bench_output.txt 2>&1

METRICS=$(grep '^METRIC' _bench_output.txt || true)
rm -f _bench_output.txt

if [ -z "$METRICS" ]; then
  echo "ERROR: No METRIC lines produced" >&2
  exit 1
fi

echo "$METRICS"
echo "=== Done ===" >&2
