#!/bin/sh
# states.sh — every card the panel can draw, on one screen, in the real plug-in.
#
#   sh 04-scripts/studio-plugin/states.sh            # builds, then serves http://localhost:8799/states.html
#
# Nothing here touches Studio and nothing here is a real layout: the report is invented (build-states-report.py),
# so the page can be opened by anyone. Use it to check a design change in one look instead of one card at a time.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
PORT="${PORT:-8799}"
python3 "$HERE/build-plugin.py"
python3 "$HERE/build-states-report.py"
echo
echo "open http://localhost:$PORT/states.html"
cd "$HERE" && python3 -m http.server "$PORT"
