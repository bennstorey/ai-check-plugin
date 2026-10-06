#!/bin/sh
# ask-preview.sh — the whole Ask Studio flow with nothing at risk: the real plug-in, the real service, a fake Studio.
#
#   sh 04-scripts/studio-plugin/ask-preview.sh      # then open http://localhost:8801/ask-preview.html
#
# The statuses and layouts are the lab's own, read on 2026-10-06. Every write is logged instead of made.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
PORT="${PORT:-8801}"
python3 "$HERE/build-plugin.py"
echo
echo "open http://localhost:$PORT/ask-preview.html"
cd "$HERE" && python3 -m http.server "$PORT"
