#!/usr/bin/env bash
# Rebuild the composition from the cut clips. assemble-index hoists each frame's <video> into index.html
# and strips it from the frame file, so frames are regenerated on every run.
set -euo pipefail
cd "$(dirname "$0")/.."
S=~/.claude/skills/product-launch-video/scripts

python3 recorder/gen_frames.py
# Captions are off for this video (user request); assemble-index mounts them only if this file exists.
if [ -f compositions/captions.html ]; then mv compositions/captions.html .media/captions.disabled.html; fi
node "$S/assemble-index.mjs" --storyboard ./STORYBOARD.md --hyperframes . > .media/assemble.log
node "$S/transitions.mjs" inject --storyboard ./STORYBOARD.md --hyperframes . | head -1
node "$S/transitions.mjs" verify --storyboard ./STORYBOARD.md --index ./index.html | tail -1
echo "videos in index.html: $(grep -c '<video' index.html)"
