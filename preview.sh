#!/bin/sh
# preview.sh — look at the REAL plug-in without Studio.
#
#   sh 04-scripts/studio-plugin/preview.sh            # newest report of the usual layout
#   sh 04-scripts/studio-plugin/preview.sh 94502      # a particular layout's newest report
#
# It builds the plug-in, copies the newest saved report and its page previews into preview-data/, and serves the
# folder so preview.html can load them. The design is then worked on at any pane width, with Send logging what it
# WOULD write rather than writing it. Nothing here touches Studio.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
ID="${1:-93098}"
PORT="${PORT:-8798}"

python3 "$HERE/build-plugin.py"

RUN="$(ls -dt "$ROOT/05-ground-truth/ai-reader/$ID"/ai-* 2>/dev/null | head -1)"
[ -n "$RUN" ] || { echo "No saved report for layout $ID under 05-ground-truth/ai-reader/$ID." >&2; exit 1; }
REPORT="$(ls -t "$RUN"/"$ID"-runner-ai-*.json 2>/dev/null | head -1)"
[ -n "$REPORT" ] || { echo "No AI report in $RUN." >&2; exit 1; }

mkdir -p "$HERE/preview-data"
cp "$REPORT" "$HERE/preview-data/report.json"
for f in "$RUN"/current/page-*.jpg; do [ -f "$f" ] && cp "$f" "$HERE/preview-data/$(basename "$f")"; done
echo "preview-data: $(basename "$RUN") — $(ls "$HERE/preview-data" | tr '\n' ' ')"

# the layout id and its pages are written into the page, so the preview matches the report it just copied
PAGES="$(ls "$HERE/preview-data"/page-*.jpg 2>/dev/null | sed 's/.*page-//;s/\.jpg//' | tr '\n' ' ')"
echo "layout $ID, pages: $PAGES"
echo
echo "open http://localhost:$PORT/preview.html"
cd "$HERE" && python3 -m http.server "$PORT"
