// CI's "build" for this app. The real build, a Godot web export, happens inside the Docker
// image (see Dockerfile), which CI doesn't run; this catches the mistakes that would otherwise
// only surface there: a building the map uses missing from game/assets/soco-st/, or a file the
// export needs gone.
import { existsSync, readFileSync } from "node:fs";

const game = new URL("./game/", import.meta.url);
const problems = [];
for (const file of ["project.godot", "export_presets.cfg", "tools/export_web.sh", "tools/fetch_web_templates.py", "tools/service_worker_removal.js"]) {
  if (!existsSync(new URL(file, game))) problems.push(`missing game/${file}`);
}
const bayArea = readFileSync(new URL("scripts/bay_area.gd", game), "utf8");
const buildings = [...new Set([...bayArea.matchAll(/"soco:([a-z0-9_]+)"/g)].map((match) => match[1]))];
for (const name of buildings) {
  if (!existsSync(new URL(`assets/soco-st/${name}.png`, game))) problems.push(`missing game/assets/soco-st/${name}.png`);
}
if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`game project present; all ${buildings.length} soco-st buildings the map uses are committed`);
