#!/bin/sh
# publish-plugin.sh — push 04-scripts/studio-plugin/ to the public GitHub Pages repo that Studio loads the plug-in from.
# One-time: create an EMPTY public repo bennstorey/ai-check-plugin on github.com, then enable Pages (main, root).
# The plug-in URL to register in Studio: https://bennstorey.github.io/ai-check-plugin/dist/ai-check-plugin.js
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
python3 04-scripts/studio-plugin/build-plugin.py
git add 04-scripts/studio-plugin/dist/ai-check-plugin.js
git diff --cached --quiet || git -c core.hooksPath=/dev/null commit -q -m "Plug-in build $(date -u +%Y-%m-%dT%H:%M:%SZ)"
git remote get-url plugin-public >/dev/null 2>&1 || git remote add plugin-public git@github.com:bennstorey/ai-check-plugin.git
git subtree push --prefix=04-scripts/studio-plugin plugin-public main
echo "published: https://bennstorey.github.io/ai-check-plugin/dist/ai-check-plugin.js (Pages takes about a minute)"
