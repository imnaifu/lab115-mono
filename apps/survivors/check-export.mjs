// CI's "build" for this app. The game is exported from Godot locally (Godot can't run in
// CI here), so all CI can do is make sure a complete export was committed: these are the
// files the browser loads, and a missing one means a blank page rather than a game.
import { statSync } from "node:fs";

const required = ["index.html", "index.js", "index.wasm", "index.pck", "index.audio.worklet.js"];
const missing = required.filter((name) => {
  try {
    return statSync(new URL(`./public/${name}`, import.meta.url)).size === 0;
  } catch {
    return true;
  }
});
if (missing.length > 0) {
  console.error(`public/ is missing ${missing.join(", ")}: run games/survivors/tools/export_web.sh`);
  process.exit(1);
}
console.log("web export present:", required.join(", "));
