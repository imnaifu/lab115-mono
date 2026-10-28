// npm run timeline -- --story stories/queue-demo.json
// Builds the narration-driven timeline from cached clip durations and writes timeline.json,
// SRT/VTT captions, the narration script and (when every clip exists) the assembled narration.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { buildScene } from "../core/scene.ts";
import { DEFAULT_VOICE, toNarrationScript, toSrt, toTimelineJson, toVtt } from "../core/story.ts";
import { encodeWav } from "../core/wav.ts";
import { buildSoundtrack } from "../voice/assemble.ts";
import { cacheLookup, voiceCacheDir } from "../voice/cache.ts";
import { createRunDir, displayPath, loadStory, parseIntArg, PROJECT_ROOT, runCli, writeJson } from "./common.ts";

runCli(async () => {
  const { values } = parseArgs({ options: { story: { type: "string" }, config: { type: "string" }, seed: { type: "string" }, out: { type: "string" } } });
  if (!values.story) throw new Error("Missing --story (e.g. --story stories/queue-demo.json)");
  const loaded = loadStory(values.story, values.config);
  const voice = { ...DEFAULT_VOICE, ...loaded.story.voice };
  const cacheDir = voiceCacheDir(PROJECT_ROOT);
  const seed = values.seed !== undefined ? parseIntArg(values.seed, "seed", loaded.story.seed) : undefined;
  const scene = buildScene(loaded.experiment, loaded.rawConfig, loaded.story, { seed, lookup: voice.provider === "none" ? undefined : cacheLookup(cacheDir) });
  const timeline = scene.timeline;
  const dir = createRunDir("timeline", loaded.story.name, values.out);

  writeJson(join(dir, "timeline.json"), toTimelineJson(loaded.story, timeline));
  writeFileSync(join(dir, "captions.srt"), toSrt(timeline.captions));
  writeFileSync(join(dir, "captions.vtt"), toVtt(timeline.captions));
  writeFileSync(join(dir, "narration.md"), toNarrationScript(loaded.story, timeline));
  const missing = timeline.clips.filter((clip) => clip.estimated);
  if (voice.provider !== "none" && missing.length === 0 && timeline.clips.length > 0) {
    const track = buildSoundtrack(scene, cacheDir, { from: 0, to: timeline.duration, narration: true, sfx: false });
    writeFileSync(join(dir, "narration.wav"), encodeWav({ sampleRate: track.sampleRate, channels: [track.narration!] }));
  }

  console.log(`${loaded.story.name}: ${timeline.duration.toFixed(2)} s · ${timeline.chapters.length} chapters · ${timeline.clips.length} clips · ${timeline.captions.length} captions`);
  for (const chapter of timeline.chapters) {
    const speed = chapter.playEnd > chapter.playStart ? `×${Math.round((chapter.simTo - chapter.simFrom) / (chapter.playEnd - chapter.playStart))}` : "frozen";
    console.log(`  ${chapter.start.toFixed(2).padStart(6)}–${chapter.end.toFixed(2).padEnd(6)} ${chapter.spec.id.padEnd(12)} ${chapter.spec.kind.padEnd(6)} sim ${speed.padEnd(7)} ${chapter.clips.length} clips`);
  }
  if (missing.length > 0) {
    console.log(`\n⚠ ${missing.length} clip(s) have no audio — their lengths are reading-speed ESTIMATES, captions are not audio-synced.`);
    if (voice.provider !== "none") console.log(`  Generate them: npm run voice -- --story ${values.story} --all`);
  }
  console.log(`\nWrote ${displayPath(dir)}`);
});
