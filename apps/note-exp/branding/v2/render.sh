#!/usr/bin/env bash
# Renders every Chrome Web Store asset from index.html with headless Chrome.
# Output: out/<lang>/<name>.png — 24-bit PNG with no alpha (store requirement).
# Usage: bash render.sh            (all assets)
#        bash render.sh zh s1      (one asset)
set -euo pipefail
cd "$(dirname "$0")"

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PAGE="file://$PWD/index.html"

# id → output name and canvas size
ASSETS=(
  "s1 01-post-download 1280 800"
  "s2 02-one-folder 1280 800"
  "s3 03-note-list 1280 800"
  "s4 04-csv 1280 800"
  "s5 05-three-steps 1280 800"
  "small small-tile-440x280 440 280"
  "marquee marquee-1400x560 1400 560"
)

render() {
  local lang=$1 id=$2 name=$3 width=$4 height=$5
  local out="out/$lang/$name.png"
  mkdir -p "out/$lang"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size="$width,$height" --virtual-time-budget=2000 \
    --screenshot="$PWD/$out" "$PAGE?lang=$lang&id=$id" >/dev/null 2>&1
  # Chrome's PNG carries an alpha channel; a JPEG round-trip flattens it, then
  # back to PNG so the store gets lossless 24-bit RGB.
  sips -s format jpeg -s formatOptions best "$out" --out "${out%.png}.jpg" >/dev/null
  sips -s format png "${out%.png}.jpg" --out "$out" >/dev/null
  rm "${out%.png}.jpg"
  echo "$out $(sips -g pixelWidth -g pixelHeight -g hasAlpha "$out" | awk 'NR>1{printf "%s ", $2}')"
}

for lang in zh en; do
  for asset in "${ASSETS[@]}"; do
    read -r id name width height <<<"$asset"
    if [[ $# -eq 0 || ( "$1" == "$lang" && "$2" == "$id" ) ]]; then
      render "$lang" "$id" "$name" "$width" "$height"
    fi
  done
done
