// CI's "build" for this app. The real build, a Godot web export, happens inside the Docker
// image (see Dockerfile), which CI doesn't run; this catches the mistakes that would otherwise
// only surface there: a building or drawing a map uses missing from game/assets/, a sound
// scripts/sound.gd plays missing from game/assets/audio/, text using a character the subset
// fonts leave out, or a file the export needs gone.
import { existsSync, readdirSync, readFileSync } from "node:fs";

const game = new URL("./game/", import.meta.url);
const problems = [];
for (const file of ["project.godot", "export_presets.cfg", "tools/export_web.sh", "tools/fetch_web_templates.py", "tools/service_worker_removal.js"]) {
  if (!existsSync(new URL(file, game))) problems.push(`missing game/${file}`);
}
// Every map (scripts/maps.gd lists them; .37 added the two left out, 西雅图 and 伦敦), and the
// achievements' pictures.
const maps = ["bay_area.gd", "london.gd", "seattle.gd", "singapore.gd", "beijing.gd"].map((file) => readFileSync(new URL(`scripts/${file}`, game), "utf8")).join("\n");
const buildings = [...new Set([...maps.matchAll(/"soco:([a-z0-9_]+)"/g)].map((match) => match[1]))];
for (const name of buildings) {
  if (!existsSync(new URL(`assets/soco-st/${name}.png`, game))) problems.push(`missing game/assets/soco-st/${name}.png`);
}
const achievements = readFileSync(new URL("scripts/achievements.gd", game), "utf8");
const enemies = readFileSync(new URL("scripts/spawner.gd", game), "utf8");
const drawings = new Set([...(maps + achievements + enemies).matchAll(/"art:([a-z0-9_]+)"|"(?:art|icon|tree)": "([a-z0-9_]+)"/g)].map((match) => match[1] ?? match[2]));
// Each map's street props and vehicles (lists of names), and its weather's icon (event_<id>).
for (const list of maps.matchAll(/"props": \[([^\]]*)\]|const VEHICLES := \[([^\]]*)\]/g)) {
  for (const name of (list[1] ?? list[2]).matchAll(/"([a-z0-9_]+)"/g)) drawings.add(name[1]);
}
for (const match of maps.matchAll(/const TRAIN := "([a-z0-9_]+)"|const MAP_EVENT := \{"id": "([a-z0-9_]+)"/g)) {
  drawings.add(match[1] ?? `event_${match[2]}`);
}
for (const name of drawings) {
  if (!existsSync(new URL(`assets/art/${name}.svg`, game))) problems.push(`missing game/assets/art/${name}.svg`);
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
// The fonts are cut down to the characters in the scripts' string literals; tools/subset_fonts.py
// lists them in glyphs.txt. Same literal pattern as that script.
const glyphs = new Set(readFileSync(new URL("assets/fonts/glyphs.txt", game), "utf8").replace(/\n$/, ""));
const missing = new Set();
const scripts = readdirSync(new URL("scripts/", game), { recursive: true }).filter((file) => file.endsWith(".gd"));
for (const file of scripts) {
  const text = readFileSync(new URL(`scripts/${file}`, game), "utf8");
  for (const literal of text.matchAll(/"(?:[^"\\\n]|\\.)*"/g)) {
    for (const char of literal[0].slice(1, -1)) {
      if (char >= " " && !glyphs.has(char)) missing.add(char);
    }
  }
}
if (missing.size > 0) {
  problems.push(`text uses characters the fonts leave out (rerun game/tools/subset_fonts.py): ${[...missing].join(" ")}`);
}
if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`game project present; all ${buildings.length} soco-st buildings and ${drawings.size} drawings the maps use and all ${sounds.length} sounds are committed; the fonts cover every character in the scripts`);
