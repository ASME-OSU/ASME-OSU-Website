#!/bin/sh
# Live progress for a visual-suite run in another terminal.
#   sh tests/visual/watch.sh [log file]      (Ctrl-C to stop)
# Shows how many screenshots each stage has written recently, which
# suite/compiler processes are running, and the end of the log.
LOG="${1:-/tmp/gal-check.log}"
DIR="$(cd "$(dirname "$0")" && pwd)"
TOTAL=106
while true; do
  clear
  echo "Visual suite progress  $(date '+%H:%M:%S')   (Ctrl-C to stop watching; the run continues)"
  echo
  base=$(find "$DIR/.baseline" -name '*.png' -mmin -60 2>/dev/null | wc -l | tr -d ' ')
  cur=$(find "$DIR/.output/current" -name '*.png' -mmin -60 2>/dev/null | wc -l | tr -d ' ')
  echo "  Baseline screenshots written in the last hour:    $base / $TOTAL"
  echo "  Comparison screenshots written in the last hour:  $cur / $TOTAL"
  echo
  echo "Running:"
  ps -axo etime=,command= | grep -E "node (tests/visual/run|scripts/css-compile-page)" | grep -v grep | sed 's/^/  /' | cut -c1-110
  [ -z "$(ps -axo command= | grep -E 'node (tests/visual/run|scripts/css-compile-page)' | grep -v grep)" ] && echo "  (nothing; the run has finished)"
  echo
  echo "Log ($LOG):"
  tail -n 12 "$LOG" 2>/dev/null | sed 's/^/  /' | cut -c1-140
  sleep 5
done
