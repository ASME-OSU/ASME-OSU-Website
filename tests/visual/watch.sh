#!/bin/sh
# Live progress for a stylesheet rebuild or visual-suite run. The screen is
# redrawn only when something changes (checked quietly every 2 seconds).
#   sh tests/visual/watch.sh [log file]      (Ctrl-C stops watching, not the run)
# Shows each page as done / building (with time) / waiting, the current stage,
# and the results when the run finishes.
LOG="${1:-/tmp/rebuild.log}"
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"
PAGES="about calendar privacy sponsor-asme current-sponsors gallery leadership join member-resources member-points footer home"

minutes() { echo "$1" | awk -F: '{ if (NF==3) m=$1*60+$2; else m=$1; print (m<1 ? "under 1 min" : m " min") }'; }

render() {
  echo "Stylesheet rebuild progress   (Ctrl-C stops watching; the run continues)"
  echo
  running=$(ps -axo etime=,command= | grep -E "node (scripts/css-compile-page|tests/visual/run|tests/browser-smoke)" | grep -v grep)
  done_count=0; total=0
  echo "Pages and components:"
  for p in $PAGES; do
    total=$((total + 1))
    if grep -qE "^$p: [0-9]+ declarations" "$LOG" 2>/dev/null; then
      done_count=$((done_count + 1)); echo "  [done]      $p"
    else
      t=$(echo "$running" | grep "css-compile-page.mjs $p " | awk '{print $1}' | head -1)
      if [ -n "$t" ]; then echo "  [building]  $p   (running $(minutes "$t"))"; else echo "  [waiting]   $p"; fi
    fi
  done
  echo
  if grep -q "^--- browser tests" "$LOG" 2>/dev/null && ! grep -q "^# fail" "$LOG"; then
    stage="4 of 4: browser tests (about 2 minutes)"
  elif grep -q "^--- screenshots" "$LOG" 2>/dev/null && ! grep -q "screenshots match" "$LOG"; then
    shots=$(find "$ROOT/tests/visual/.output/current" -name '*.png' -newer "$ROOT/styles/pages/home.css" 2>/dev/null | wc -l | tr -d ' ')
    stage="3 of 4: screenshot check, $shots / 106 taken (about 5 minutes)"
  elif [ "$done_count" -lt "$total" ]; then
    stage="1 of 4: rebuilding pages, $done_count / $total done"
  elif grep -q "^# fail" "$LOG" 2>/dev/null; then
    stage="finished"
  else
    stage="2 of 4: building the stylesheet"
  fi
  echo "Stage: $stage"
  if [ -z "$running" ] && [ "$stage" != "finished" ]; then echo "  (nothing is running right now)"; fi
  if grep -q "screenshots match" "$LOG" 2>/dev/null; then
    echo
    echo "Results:"
    grep -E "screenshots match" "$LOG" | sed 's/ Report:.*//; s/^/  /'
    grep -E "^(CHANGED|STYLES|ERROR)" "$LOG" | awk '{print $2}' | sed 's/--.*//' | sort | uniq -c | awk '{printf "    differs: %s (%s views)\n", $2, $1}'
    grep -E "^# (pass|fail)" "$LOG" | sed 's/^# /  browser tests /'
  fi
}

last=""
while true; do
  now=$(render)
  if [ "$now" != "$last" ]; then
    clear
    echo "$now"
    echo
    echo "Last change: $(date '+%H:%M:%S')"
    last="$now"
  fi
  sleep 2
done
