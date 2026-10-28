// npm run publish:voice                                 publish the narration of every Kokoro-voiced story
// npm run publish:voice -- --include queue-switching    also publish a story voiced with "files"
//
// The deployed preview (video.lab115.com) is a static build without the dev server's voice route,
// so it reads the same URLs — /__simlab/voice/manifest.json and /__simlab/voice/<key>.wav — from
// public/__simlab/voice, which this command fills from cache/voice. The folder is rebuilt from
// scratch, so it holds exactly the clips the stories use now: an edited sentence leaves no stale
// clip behind. Commit the result together with the stories.
//
// "files" stories are skipped unless named: their recordings may be stand-ins (queue-switching's
// are macOS `say` voices, licensed for personal use only) or someone else's voice.

import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { buildScene } from "../core/scene.ts";
import { DEFAULT_VOICE } from "../core/story.ts";
import { cacheLookup, readClipMeta, voiceCacheDir } from "../voice/cache.ts";
import { loadStory, PROJECT_ROOT, runCli, writeJson } from "./common.ts";

runCli(async () => {
  const { values } = parseArgs({ options: { include: { type: "string", multiple: true, default: [] } } });
  const cacheDir = voiceCacheDir(PROJECT_ROOT);
  const storyDir = join(PROJECT_ROOT, "stories");
  const outDir = join(PROJECT_ROOT, "public", "__simlab", "voice");

  const manifest: Record<string, number> = {};
  const problems: string[] = [];
  for (const file of readdirSync(storyDir).filter((name) => name.endsWith(".json")).sort()) {
    const loaded = loadStory(join(storyDir, file));
    const { name } = loaded.story;
    const provider = { ...DEFAULT_VOICE, ...loaded.story.voice }.provider;
    if (provider === "none") continue;
    if (provider !== "kokoro" && !values.include.includes(name)) {
      console.log(`${name}: skipped (voice provider "${provider}"; publish it with --include ${name})`);
      continue;
    }
    // Same scene as `npm run voice` and the preview build, so the clip keys match what the page asks for.
    const scene = buildScene(loaded.experiment, loaded.rawConfig, loaded.story, { lookup: cacheLookup(cacheDir) });
    const missing = scene.timeline.clips.filter((clip) => clip.estimated);
    if (missing.length > 0) {
      problems.push(`${name}: ${missing.length} clip(s) not generated yet — npm run voice -- --story stories/${file} --all`);
      continue;
    }
    for (const clip of scene.timeline.clips) manifest[clip.key] = readClipMeta(cacheDir, clip.key)!.duration;
    console.log(`${name}: ${scene.timeline.clips.length} clips`);
  }
  // All or nothing: a half-published story would go online with silent sentences.
  if (problems.length > 0) throw new Error(`Nothing published.\n  ${problems.join("\n  ")}`);

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  let bytes = 0;
  for (const key of Object.keys(manifest)) {
    const target = join(outDir, `${key}.wav`);
    copyFileSync(join(cacheDir, `${key}.wav`), target);
    bytes += statSync(target).size;
  }
  writeJson(join(outDir, "manifest.json"), manifest);
  console.log(`\nPublished ${Object.keys(manifest).length} clips (${(bytes / 1e6).toFixed(1)} MB) to public/__simlab/voice.`);
});
