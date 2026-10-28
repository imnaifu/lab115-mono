// npm run voice -- --story stories/queue-demo.json                 plan only: which clips exist / are missing
// npm run voice -- --story … --segment hook [--play]                 generate one segment (audition)
// npm run voice -- --story … --all                                  generate every missing clip
// npm run voice -- --story … --segment hook --force                 regenerate a segment
// npm run voice -- --story … --list                                 every clip with its text (and file name for "files")
// npm run voice -- --story … --phonemes [--segment id]              Kokoro pronunciation check (G2P only, no audio)
//
// Generation is explicit: without --segment or --all nothing is synthesised. Paid providers
// additionally require --allow-paid. Finished clips are cached and never regenerated unless --force.

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { buildScene } from "../core/scene.ts";
import { DEFAULT_VOICE, type TimedClip } from "../core/story.ts";
import { encodeWav } from "../core/wav.ts";
import { cacheLookup, loadClipSamples, readClipMeta, removeClip, storeClip, VOICE_SAMPLE_RATE, voiceCacheDir } from "../voice/cache.ts";
import { createProvider } from "../voice/providers.ts";
import { loadStory, parseIntArg, PROJECT_ROOT, runCli } from "./common.ts";

const MAX_ATTEMPTS = 3;

runCli(async () => {
  const { values } = parseArgs({
    options: {
      story: { type: "string" },
      config: { type: "string" },
      seed: { type: "string" },
      segment: { type: "string" },
      all: { type: "boolean", default: false },
      force: { type: "boolean", default: false },
      play: { type: "boolean", default: false },
      list: { type: "boolean", default: false },
      phonemes: { type: "boolean", default: false },
      "allow-paid": { type: "boolean", default: false },
    },
  });
  if (!values.story) throw new Error("Missing --story (e.g. --story stories/queue-demo.json)");
  const loaded = loadStory(values.story, values.config);
  const voice = { ...DEFAULT_VOICE, ...loaded.story.voice };
  const cacheDir = voiceCacheDir(PROJECT_ROOT);
  const seed = values.seed !== undefined ? parseIntArg(values.seed, "seed", loaded.story.seed) : undefined;
  const scene = buildScene(loaded.experiment, loaded.rawConfig, loaded.story, { seed, lookup: cacheLookup(cacheDir) });
  const segments = values.segment?.split(",").map((id) => id.trim());
  for (const id of segments ?? []) {
    if (!scene.timeline.chapters.some((chapter) => chapter.spec.id === id)) {
      throw new Error(`Unknown or excluded segment "${id}". Segments: ${scene.timeline.chapters.map((chapter) => chapter.spec.id).join(", ")}`);
    }
  }
  const clips = scene.timeline.clips.filter((clip) => !segments || segments.includes(clip.chapterId));
  const cached = clips.filter((clip) => !clip.estimated);
  const missing = clips.filter((clip) => clip.estimated);

  console.log(`${loaded.story.name}: ${clips.length} clips${segments ? ` in ${segments.join(", ")}` : ""} · ${cached.length} cached · ${missing.length} missing`);
  console.log(`voice: ${voice.provider}${voice.voice ? ` / ${voice.voice}` : ""}${voice.model ? ` / ${voice.model}` : ""} · speed ${voice.speed ?? 1}`);

  if (values.list) {
    for (const clip of clips) {
      console.log(`\n${clip.id}  ${clip.estimated ? "missing" : `cached ${clip.duration.toFixed(2)}s`}\n  caption: ${clip.caption}${clip.speech !== clip.caption ? `\n  spoken:  ${clip.speech}` : ""}`);
      if (voice.provider === "files") console.log(`  file:    audio/${loaded.story.name}/${clip.id}.wav (or .m4a/.mp3/.aiff/.flac/.ogg)`);
    }
    return;
  }
  if (values.phonemes) {
    // Shows exactly how numbers, names and terms will be read — before generating anything.
    const python = join(PROJECT_ROOT, ".venv-tts", "bin", "python");
    const input = clips.map((clip) => JSON.stringify({ id: clip.id, text: clip.speech, voice: voice.voice ?? "af_heart", model: voice.model })).join("\n");
    const result = spawnSync(python, [join(PROJECT_ROOT, "tts", "kokoro_worker.py"), "--phonemes"], { input, cwd: PROJECT_ROOT, encoding: "utf8" });
    if (result.status !== 0) throw new Error(`Phoneme check failed (run npm run setup:tts first?):\n${(result.stderr ?? "").split("\n").slice(-5).join("\n")}`);
    const byId = new Map(result.stdout.trim().split("\n").map((line) => JSON.parse(line) as { id: string; phonemes: string }).map((row) => [row.id, row.phonemes]));
    for (const clip of clips) console.log(`\n${clip.id}  ${clip.speech}\n  ${byId.get(clip.id)}`);
    return;
  }
  if (!segments && !values.all) {
    const characters = missing.reduce((sum, clip) => sum + clip.speech.length, 0);
    console.log(`\nNothing generated. ${missing.length} clips (${characters} characters) would be synthesised.`);
    console.log("  Audition one segment:  npm run voice -- --story <story> --segment <id> --play");
    console.log("  Generate all missing:  npm run voice -- --story <story> --all");
    return;
  }

  const provider = createProvider(voice, PROJECT_ROOT, loaded.story.name);
  if (!provider) throw new Error('This story uses voice provider "none" — nothing to generate. Set story.voice.provider to "kokoro" or "files".');
  if (provider.paid && !values["allow-paid"]) {
    throw new Error(`Provider "${provider.id}" is a paid service. Re-run with --allow-paid to confirm (${missing.length} clips, ${missing.reduce((sum, clip) => sum + clip.speech.length, 0)} characters).`);
  }
  console.log(`provider: ${provider.describe(voice)}\n`);

  // Recordings replaced on disk invalidate their cache entry even though the text is the same.
  const isStale = (clip: TimedClip) => {
    if (voice.provider !== "files" || clip.estimated) return false;
    const meta = readClipMeta(cacheDir, clip.key);
    for (const ext of ["wav", "m4a", "mp3", "aiff", "flac", "ogg"]) {
      try {
        return statSync(join(PROJECT_ROOT, "audio", loaded.story.name, `${clip.id}.${ext}`)).mtime.toISOString() > (meta?.createdAt ?? "");
      } catch {
        // try next extension
      }
    }
    return false;
  };
  const targets = clips.filter((clip) => values.force || clip.estimated || isStale(clip));
  const failures: { clip: TimedClip; error: string }[] = [];
  try {
    for (const [i, clip] of targets.entries()) {
      if (values.force) removeClip(cacheDir, clip.key);
      let lastError = "";
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const started = performance.now();
        try {
          const file = await provider.synthesize({ clip, voice });
          const meta = storeClip(cacheDir, clip, file, voice);
          console.log(`  [${i + 1}/${targets.length}] ${clip.id} ✔ ${meta.duration.toFixed(2)}s audio · ${((performance.now() - started) / 1000).toFixed(1)}s`);
          lastError = "";
          break;
        } catch (error) {
          lastError = (error as Error).message;
          console.log(`  [${i + 1}/${targets.length}] ${clip.id} attempt ${attempt} failed: ${lastError.split("\n")[0]}`);
          // Missing recordings won't appear by retrying.
          if (voice.provider === "files") break;
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      }
      if (lastError) failures.push({ clip, error: lastError });
    }
  } finally {
    await provider.close();
  }
  if (targets.length === 0) console.log("All requested clips are already cached (use --force to regenerate).");

  if (values.play && segments) {
    const chosen = scene.timeline.clips.filter((clip) => segments.includes(clip.chapterId) && readClipMeta(cacheDir, clip.key));
    if (chosen.length > 0) await play(chosen.map((clip) => clip.key), cacheDir, voice.gap ?? 0.25);
  }
  if (failures.length > 0) {
    throw new Error(`${failures.length} clip(s) failed and were not cached; re-run the same command to retry only those:\n  ${failures.map((failure) => `${failure.clip.id}: ${failure.error.split("\n")[0]}`).join("\n  ")}`);
  }
});

async function play(keys: string[], cacheDir: string, gap: number) {
  const pieces: Float32Array[] = [];
  for (const key of keys) {
    pieces.push(loadClipSamples(cacheDir, key));
    pieces.push(new Float32Array(Math.round(gap * VOICE_SAMPLE_RATE)));
  }
  const joined = new Float32Array(pieces.reduce((sum, piece) => sum + piece.length, 0));
  let offset = 0;
  for (const piece of pieces) {
    joined.set(piece, offset);
    offset += piece.length;
  }
  const dir = mkdtempSync(join(tmpdir(), "simlab-play-"));
  const file = join(dir, "audition.wav");
  writeFileSync(file, encodeWav({ sampleRate: VOICE_SAMPLE_RATE, channels: [joined] }));
  console.log(`\n▶ playing ${(joined.length / VOICE_SAMPLE_RATE).toFixed(1)}s…`);
  const player = process.platform === "darwin" ? ["afplay", [file]] : ["ffplay", ["-nodisp", "-autoexit", "-loglevel", "error", file]];
  const result = spawnSync(player[0] as string, player[1] as string[], { stdio: "inherit" });
  if (result.error) console.log(`Could not play audio (${result.error.message}). File: ${file}`);
  else rmSync(dir, { recursive: true, force: true });
}
