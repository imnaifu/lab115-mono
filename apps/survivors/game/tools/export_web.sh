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
# Name the game package after its contents and point the page at it (GODOT_CONFIG's mainPack),
# so a page only ever loads the package it was exported with, and browsers can keep a package
# for good (nginx.conf) while index.html itself is always checked.
python3 - "$out" <<'PY'
import hashlib, json, pathlib, re, sys
out = pathlib.Path(sys.argv[1])
digest = hashlib.sha256((out / "index.pck").read_bytes()).hexdigest()[:12]
pack = f"index-{digest}.pck"
(out / "index.pck").rename(out / pack)
page = out / "index.html"
html = page.read_text(encoding="utf-8")
match = re.search(r"const GODOT_CONFIG = (\{.*?\});\n", html)
config = json.loads(match.group(1))
config["mainPack"] = pack
config["fileSizes"][pack] = config["fileSizes"].pop("index.pck")
page.write_text(html[:match.start(1)] + json.dumps(config, separators=(",", ":")) + html[match.end(1):], encoding="utf-8")
print(f"game package: {pack}")
PY
# The release's version, for the page to notice a tab left open across a release (see the
# telemetry script in export_presets.cfg).
sed -n 's/^const VERSION := "\(.*\)"$/\1/p' scripts/telemetry.gd > "$out/version.txt"
test -s "$out/version.txt"
ls -la "$out"
