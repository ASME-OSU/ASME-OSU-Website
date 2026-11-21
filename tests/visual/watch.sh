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

# Screenshot progress from tests/visual/run.mjs: done / total, differences so
# far, and how many screenshots each page still has to take.
shots() {
  P="$ROOT/tests/visual/.output/progress.txt"; J="$ROOT/tests/visual/.output/progress-jobs.txt"
  [ -f "$P" ] || return
  total=$(head -1 "$P" | cut -d' ' -f1); done_n=$(($(wc -l < "$P") - 1))
  diffs=$(tail -n +2 "$P" | grep -cE " (changed|styles|error)$")
  echo "  Screenshots: $done_n / $total taken, $diffs differ so far"
  left=$(tail -n +2 "$P" | cut -d' ' -f1 | sort > /tmp/watch-done.$$; sort "$J" | comm -23 - /tmp/watch-done.$$ | sed 's/--.*//' | sort | uniq -c | awk '{printf "%s (%s), ", $2, $1}'; rm -f /tmp/watch-done.$$)
  [ -n "$left" ] && echo "  Still to take: ${left%, }"
}

render() {
  # A run of scripts/css-rebuild.mjs names its pages on its first line.
  only=$(sed -n 's/^Rebuilding \(.*\) from Phase 1.*/\1/p' "$LOG" 2>/dev/null | head -1 | tr -d ',')
  [ -n "$only" ] && PAGES="$only"
  # A checks-only log (no rebuild) has no pages to list.
  if [ -z "$only" ] && grep -q "^Screenshots (" "$LOG" 2>/dev/null && ! grep -qE "declarations" "$LOG"; then PAGES=""; fi
  echo "Stylesheet rebuild progress   (Ctrl-C stops watching; the run continues)"
  echo
  running=$(ps -axo etime=,command= | grep -E "node (scripts/css-compile-page|tests/visual/run|tests/browser-smoke)" | grep -v grep)
  done_count=0; total=0
  [ -n "$PAGES" ] && echo "Pages and components:"
  for p in $PAGES; do
    total=$((total + 1))
    if grep -qE "^($p|  \[done\] +$p): [0-9]+ declarations" "$LOG" 2>/dev/null; then
      done_count=$((done_count + 1)); echo "  [done]      $p"
    else
      t=$(echo "$running" | grep "css-compile-page.mjs $p " | grep -v -- "--strip" | awk '{print $1}' | head -1)
      plog="$ROOT/tests/visual/.output/rebuild/$p.log"
      views=""
      if [ -f "$plog" ]; then
        n=$(grep -c "^Compiled [0-9]" "$plog" 2>/dev/null)
        tv=$(sed -n 's/^Sampling \([0-9]*\) widths.*/\1/p' "$plog" | head -1)
        tv=$(( ${tv:-10} * 2 ))
        if [ "$n" -gt 0 ]; then views=", $n / $tv views"; else views=", preparing"; fi
      fi
      if [ -n "$t" ]; then echo "  [building]  $p   (running $(minutes "$t")$views)"; else echo "  [waiting]   $p"; fi
    fi
  done
  echo
  if grep -qE "^Finished" "$LOG" 2>/dev/null; then
    stage="finished"
  elif grep -qE "^(--- browser tests|Browser tests)" "$LOG" 2>/dev/null && ! grep -qE "^ *# fail" "$LOG"; then
    stage="5 of 5: browser tests (about 2 minutes)"
  elif grep -qE "^(--- in-between widths|Screenshots \(in-between)" "$LOG" 2>/dev/null; then
    shots=$(find "$ROOT/tests/visual/.output/current" -name '*--[0-9]*--*.png' -newer "$LOG.widths-marker" 2>/dev/null | wc -l | tr -d ' ')
    stage="4 of 5: in-between widths check (480 to 1700px)"
  elif grep -qE "^(--- screenshots|Screenshots \(standard)" "$LOG" 2>/dev/null && ! grep -q "screenshots match" "$LOG"; then
    shots=$(find "$ROOT/tests/visual/.output/current" -name '*.png' -newer "$ROOT/styles/pages/home.css" 2>/dev/null | wc -l | tr -d ' ')
    stage="3 of 5: screenshot check (standard widths)"
  elif [ "$done_count" -lt "$total" ]; then
    stage="1 of 5: rebuilding pages, $done_count / $total done"
  elif grep -qE "^ *# fail|^Finished" "$LOG" 2>/dev/null; then
    stage="finished"
  else
    stage="2 of 5: building the stylesheet"
  fi
  echo "Stage: $stage"
  case "$stage" in 3*|4*) shots ;; esac
  if [ -z "$running" ] && [ "$stage" != "finished" ]; then echo "  (nothing is running right now)"; fi
  if grep -qE "^Finished|^ *# fail" "$LOG" 2>/dev/null; then
    echo
    echo "Results:"
    grep -E "screenshots match" "$LOG" | sed 's/ Report:.*//; s/^/  /'
    grep -E "^ *(CHANGED|STYLES|ERROR)" "$LOG" | awk '{print $2}' | sed 's/--.*//' | sort | uniq -c | awk '{printf "    differs: %s (%s views)\n", $2, $1}'
    grep -E "^ *# (pass|fail)" "$LOG" | sed 's/^ *# /  browser tests /'
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
