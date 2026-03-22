#!/usr/bin/env bash

engine_passed=0 engine_failed=0
ui_passed=0 ui_failed=0

# Strip ANSI color codes for reliable parsing
strip_ansi() {
  sed 's/\x1b\[[0-9;]*m//g'
}

# Filter vitest output to summary lines only (RUN header, test file results, totals, duration)
vitest_summary() {
  grep -E '^\s*(✓|×|❯|RUN|Test Files|Tests|Start at|Duration)' || true
}

echo "════════════════════════════════════════"
echo "  Engine Tests (@miko/engine)"
echo "════════════════════════════════════════"
engine_output=$(npm -w @miko/engine run test 2>&1) || true
echo "$engine_output" | strip_ansi | vitest_summary
engine_clean=$(echo "$engine_output" | strip_ansi)
engine_passed=$(echo "$engine_clean" | grep -o '[0-9]* passed' | tail -1 | grep -o '[0-9]*')
engine_failed=$(echo "$engine_clean" | grep -o '[0-9]* failed' | tail -1 | grep -o '[0-9]*')
engine_passed=${engine_passed:-0}
engine_failed=${engine_failed:-0}

echo ""
echo "════════════════════════════════════════"
echo "  UI Tests (@miko/ui)"
echo "════════════════════════════════════════"
ui_output=$(npm -w @miko/ui run test 2>&1) || true
echo "$ui_output" | strip_ansi | vitest_summary
ui_clean=$(echo "$ui_output" | strip_ansi)
ui_passed=$(echo "$ui_clean" | grep -o '[0-9]* passed' | tail -1 | grep -o '[0-9]*')
ui_failed=$(echo "$ui_clean" | grep -o '[0-9]* failed' | tail -1 | grep -o '[0-9]*')
ui_passed=${ui_passed:-0}
ui_failed=${ui_failed:-0}

total_passed=$((engine_passed + ui_passed))
total_failed=$((engine_failed + ui_failed))
total=$((total_passed + total_failed))

if [ "$total" -gt 0 ]; then
  pct=$((total_passed * 100 / total))
else
  pct=0
fi

echo ""
echo "════════════════════════════════════════"
echo "  SUMMARY"
echo "════════════════════════════════════════"
printf "  Engine:  %d passed, %d failed\n" "$engine_passed" "$engine_failed"
printf "  UI:      %d passed, %d failed\n" "$ui_passed" "$ui_failed"
printf "  Total:   %d / %d  (%d%%)\n" "$total_passed" "$total" "$pct"
echo "════════════════════════════════════════"

[ "$total_failed" -eq 0 ] || exit 1
