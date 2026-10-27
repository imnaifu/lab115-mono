#!/usr/bin/env bash
# Exports the web build into apps/survivors/public/, the folder that gets deployed
# (apps/survivors/Dockerfile serves it with nginx). Needs Godot 4.7 on PATH and its
# web export templates installed (see README.md).
set -euo pipefail
cd "$(dirname "$0")/.."
out="../../apps/survivors/public"
./tools/fetch_soco_st.sh
# Refresh the import cache first: a script added since the last import would otherwise be
# missing from the class cache the export packs.
godot --headless --path . --import
rm -rf "$out"
mkdir -p "$out"
godot --headless --path . --export-release Web "$out/index.html"
# The font's OFL licence must travel with the font; ship it as a plain file beside the game
# rather than as a credits line in the UI.
mkdir -p "$out/licenses"
cp assets/fonts/OFL.txt "$out/licenses/ZCOOLKuaiLe-OFL.txt"
ls -la "$out"
