// CI's "build" for this app. The real build, a Godot web export, happens inside the Docker
// image (see Dockerfile), which CI doesn't run; this catches the mistakes that would otherwise
// only surface there: a building the map uses missing from game/assets/soco-st/, a sound
// scripts/sound.gd plays missing from game/assets/audio/, or a file the export needs gone.
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
// The keys of EFFECTS / TRACKS in sound.gd are the file names under sfx/ and music/.
const sound = readFileSync(new URL("scripts/sound.gd", game), "utf8");
const sounds = [];
for (const [table, folder] of [["EFFECTS", "sfx"], ["TRACKS", "music"]]) {
  const body = sound.match(new RegExp(`const ${table} := \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? "";
  for (const match of body.matchAll(/^\t"([a-z_]+)":/gm)) sounds.push(`${folder}/${match[1]}.ogg`);
}
if (sounds.length === 0) problems.push("found no sounds in game/scripts/sound.gd");
for (const file of sounds) {
  if (!existsSync(new URL(`assets/audio/${file}`, game))) problems.push(`missing game/assets/audio/${file}`);
}
if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`game project present; all ${buildings.length} soco-st buildings the map uses and all ${sounds.length} sounds are committed`);
