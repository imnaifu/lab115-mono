#!/usr/bin/env bash
# Exports the web build. Production does this inside the Docker build (../Dockerfile); run it
# yourself to try the web build locally: it writes to ../public/ (gitignored) unless given
# another output directory. Needs Godot 4.7 on PATH and its web export templates installed
# (tools/fetch_web_templates.py).
set -euo pipefail
cd "$(dirname "$0")/.."
out="${1:-../public}"
# Refresh the import cache first: a script added since the last import would otherwise be
# missing from the class cache the export packs.
godot --headless --path . --import
rm -rf "$out"
mkdir -p "$out"
godot --headless --path . --export-release Web "$out/index.html"
# The fonts' OFL licences must travel with the fonts; ship them as plain files beside the game
# rather than as a credits line in the UI.
mkdir -p "$out/licenses"
cp assets/fonts/Nunito-OFL.txt assets/fonts/NotoSansSC-OFL.txt "$out/licenses/"
# PWA is off, but browsers from the PWA days still run its caching worker; this replacement
# clears it out (see the file). Keep it until nobody can still have the old one.
cp tools/service_worker_removal.js "$out/index.service.worker.js"
# Export succeeds even when the engine failed to write the game package; don't ship that.
test -s "$out/index.pck" && test -s "$out/index.wasm"
ls -la "$out"
