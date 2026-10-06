#!/bin/sh
# ask-states.sh — the design board for Ask Studio: every state, side by side, at a chosen pane width.
#
#   sh 04-scripts/studio-plugin/ask-states.sh      # then open http://localhost:8800/ask-states.html
#
# Nothing is wired: no Studio, no service, no key, no layout. The words are invented; the layout names are the lab's
# own so the widths are honest. Mark it up and it gets fixed in one round.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
PORT="${PORT:-8800}"
echo "open http://localhost:$PORT/ask-states.html"
cd "$HERE" && python3 -m http.server "$PORT"
