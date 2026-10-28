// npm run render -- --story stories/queue-demo.json [--preview] [--from 0 --to 8] [--stills 3,20,50]
//
// Export with Remotion. The composition (remotion/) draws frame N with the same pure renderer as
// the preview and places every narration clip at its timeline frame; Remotion renders the frames
// in parallel headless Chrome tabs (no timers, no screen recording) and encodes H.264/AAC. Before
// rendering, the browser's own scene is checked against Node's; afterwards the finished audio is
// checked against the timeline (sync, clipping, length). Same options and outputs as before; the
// previous exporter is `npm run render:legacy`.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { parseArgs } from "node:util";
import { buildScene } from "../core/scene.ts";
import { DEFAULT_VOICE, toNarrationScript, toSrt, toTimelineJson, toVtt } from "../core/story.ts";
import { decodeWav, encodeWav, peak } from "../core/wav.ts";
import { prepareRemotionPublic } from "../export/remotionPublic.ts";
import { buildSoundtrack, verifySync } from "../voice/assemble.ts";
import { cacheLookup, cacheManifest, voiceCacheDir } from "../voice/cache.ts";
import { createRunDir, displayPath, loadStory, parseIntArg, parseNumberArg, PROJECT_ROOT, projectPath, runCli, runMeta, userPath, writeCsv, writeJson } from "./common.ts";
import type { EpisodeProps } from "../../remotion/episode.ts";

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

type Cleanup = () => Promise<void> | void;
const cleanups: Cleanup[] = [];

async function cleanupAll() {
  // Last registered first.
  while (cleanups.length > 0) {
    try {
      await cleanups.pop()!();
    } catch {
      // Best effort — we are already shutting down.
    }
  }
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.error(`\n${signal} received, cleaning up…`);
    void cleanupAll().finally(() => process.exit(130));
  });
}

function requireBinary(name: string, hint: string) {
  try {
    execFileSync(name, ["-version"], { stdio: "ignore" });
  } catch {
    throw new Error(`${name} not found on PATH. ${hint}`);
  }
}

function probe(file: string) {
  const output = execFileSync("ffprobe", [
    "-v", "error",
    "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames,duration,pix_fmt,sample_rate,channels:format=duration,size",
    "-of", "json",
    file,
  ]).toString();
  return JSON.parse(output) as {
    streams: { codec_type: string; codec_name: string; width?: number; height?: number; r_frame_rate?: string; nb_frames?: string; duration?: string; sample_rate?: string; channels?: number }[];
    format: { duration: string; size: string };
  };
}

/** Music ducked under the narration (same filter as before), decoded to 48 kHz stereo samples. */
function duckedMusic(music: string, narrationWav: string, duration: number, volume: number, workDir: string): [Float32Array, Float32Array] {
  const out = join(workDir, "music-ducked.wav");
  execFileSync("ffmpeg", [
    "-v", "error", "-y",
    "-stream_loop", "-1", "-i", music,
    "-i", narrationWav,
    "-filter_complex",
    `[0:a]aresample=48000,aformat=channel_layouts=stereo,volume=${volume},afade=t=in:d=1,afade=t=out:st=${Math.max(0, duration - 2).toFixed(3)}:d=2[music];` +
      "[1:a]aresample=48000,aformat=channel_layouts=stereo[key];[music][key]sidechaincompress=threshold=0.02:ratio=8:attack=15:release=400[ducked]",
    "-map", "[ducked]", "-t", duration.toFixed(6), "-c:a", "pcm_s16le", out,
  ]);
  const decoded = decodeWav(readFileSync(out));
  return [decoded.channels[0], decoded.channels[1] ?? decoded.channels[0]];
}

runCli(async () => {
  const { values } = parseArgs({
    options: {
      story: { type: "string" },
      experiment: { type: "string" },
      config: { type: "string" },
      seed: { type: "string" },
      "batch-runs": { type: "string" },
      width: { type: "string" },
      height: { type: "string" },
      fps: { type: "string" },
      preview: { type: "boolean", default: false },
      from: { type: "string" },
      to: { type: "string" },
      silent: { type: "boolean", default: false },
      "no-burn": { type: "boolean", default: false },
      sfx: { type: "boolean" },
      "no-sfx": { type: "boolean", default: false },
      music: { type: "string" },
      "no-music": { type: "boolean", default: false },
      "keep-frames": { type: "boolean", default: false },
      stills: { type: "string" },
      crf: { type: "string" },
      out: { type: "string" },
      "require-assets": { type: "boolean", default: false },
      concurrency: { type: "string" },
    },
  });
  if (!values.story) throw new Error("Missing --story (e.g. --story stories/queue-demo.json)");
  const loaded = loadStory(values.story, values.config);
  const { experiment } = loaded;
  // --fps re-snaps the narration timeline to the new frame grid (clips start on whole frames).
  const story = values.fps !== undefined ? { ...loaded.story, video: { ...loaded.story.video, fps: parseIntArg(values.fps, "fps", 30) } } : loaded.story;
  if (values.experiment && values.experiment !== experiment.id) {
    throw new Error(`--experiment ${values.experiment} does not match the story's experiment "${experiment.id}"`);
  }

  // Video settings: story defaults, --preview for a quick low-res pass, explicit flags win.
  const width = parseIntArg(values.width, "width", values.preview ? 960 : (story.video?.width ?? 1920));
  const height = parseIntArg(values.height, "height", values.preview ? 540 : (story.video?.height ?? 1080));
  const fps = parseIntArg(values.fps, "fps", story.video?.fps ?? 30);
  // H.264 with yuv420p needs even dimensions.
  if (width % 2 || height % 2 || width < 64 || height < 64) throw new Error("--width/--height must be even and at least 64");
  if (fps < 1 || fps > 120) throw new Error("--fps must be in 1..120");
  const crf = parseIntArg(values.crf, "crf", 18);
  const concurrency = values.concurrency !== undefined ? parseIntArg(values.concurrency, "concurrency", 1) : null;
  const seed = values.seed !== undefined ? parseIntArg(values.seed, "seed", story.seed) : undefined;
  const batchRuns = values["batch-runs"] !== undefined ? parseIntArg(values["batch-runs"], "batch-runs", 0) : undefined;
  const stillTimes = values.stills?.split(",").map((part) => {
    const time = Number(part);
    if (!Number.isFinite(time) || time < 0) throw new Error(`--stills expects comma-separated seconds, got "${part}"`);
    return time;
  });

  // Narration: real clip durations from the voice cache drive the timeline.
  const voice = { ...DEFAULT_VOICE, ...story.voice };
  const cacheDir = voiceCacheDir(PROJECT_ROOT);
  const useVoice = voice.provider !== "none" && !values.silent;
  const scene = buildScene(experiment, loaded.rawConfig, story, { seed, batchRuns, lookup: voice.provider === "none" ? undefined : cacheLookup(cacheDir) });
  const missing = scene.timeline.clips.filter((clip) => clip.estimated);
  if (useVoice && missing.length > 0 && !stillTimes) {
    throw new Error(
      `${missing.length} narration clip(s) have no audio yet (${missing.slice(0, 4).map((clip) => clip.id).join(", ")}${missing.length > 4 ? ", …" : ""}).\n` +
        `  Generate them:  npm run voice -- --story ${values.story} --all\n  Or export a silent captioned video with estimated timing:  --silent`,
    );
  }
  const hasNarration = useVoice && scene.timeline.clips.length > 0;
  const sfxEnabled = values["no-sfx"] ? false : (values.sfx ?? story.sound?.sfx ?? false);
  const musicArg = values["no-music"] ? null : values.music ? userPath(values.music) : story.sound?.music ? projectPath(story.sound.music) : null;
  if (musicArg && !existsSync(musicArg)) throw new Error(`Music file not found: ${musicArg}`);

  const fullDuration = scene.timeline.duration;
  const from = parseNumberArg(values.from, "from") ?? 0;
  const to = Math.min(parseNumberArg(values.to, "to") ?? fullDuration, fullDuration);
  if (!(to > from) || from < 0) throw new Error(`Invalid range --from ${from} --to ${to} (video is ${fullDuration.toFixed(2)} s)`);
  const firstFrame = Math.round(from * fps);
  const lastFrame = Math.round(to * fps); // exclusive
  const frameCount = lastFrame - firstFrame;
  const clipDuration = frameCount / fps;

  if (!stillTimes) {
    requireBinary("ffmpeg", "Install FFmpeg (macOS: `brew install ffmpeg`, Debian/Ubuntu: `sudo apt install ffmpeg`).");
    requireBinary("ffprobe", "ffprobe ships with FFmpeg.");
  }

  const label = stillTimes ? `${story.name}-stills` : values.preview ? `${story.name}-preview` : story.name;
  const dir = createRunDir("render", label, values.out);
  console.log(`Output: ${displayPath(dir)}`);

  // Reproducibility artefacts.
  writeJson(join(dir, "story.json"), story);
  writeJson(join(dir, "config.json"), scene.config);
  writeJson(join(dir, "input.json"), scene.input);
  writeJson(join(dir, "metrics.json"), { seed: scene.seed, note: "Single run shown in the video.", metrics: scene.metrics });
  if (scene.batch) writeJson(join(dir, "batch-summary.json"), { seeds: [scene.batch.seeds[0], scene.batch.seeds.at(-1)], wins: scene.batch.wins, summary: scene.batch.summary });
  for (const variant of experiment.variants) {
    writeJson(join(dir, `events-${variant.id}.json`), experiment.events(scene.runs[variant.id]));
    writeCsv(join(dir, `records-${variant.id}.csv`), experiment.records(scene.runs[variant.id]));
  }
  writeJson(join(dir, "timeline.json"), { ...toTimelineJson(story, scene.timeline), anchors: scene.anchors, focus: scene.focus });
  writeFileSync(join(dir, "narration.md"), toNarrationScript(story, scene.timeline));
  // Captions for the rendered range, shifted so they line up with the clip.
  const clipCaptions = scene.timeline.captions
    .filter((caption) => caption.end > from && caption.start < to)
    .map((caption) => ({ text: caption.text, start: Math.max(caption.start, from) - from, end: Math.min(caption.end, to) - from }));
  writeFileSync(join(dir, "captions.srt"), toSrt(clipCaptions));
  writeFileSync(join(dir, "captions.vtt"), toVtt(clipCaptions));

  const meta: Record<string, unknown> = {
    ...runMeta(),
    command: "render",
    engine: "remotion",
    experiment: experiment.id,
    story: displayPath(loaded.storyPath),
    configFile: loaded.configPath ? displayPath(loaded.configPath) : null,
    seed: scene.seed,
    width,
    height,
    fps,
    crf,
    range: { from, to, fullDuration },
    frames: frameCount,
    voice: { ...voice, narration: hasNarration, clips: scene.timeline.clips.length, estimatedTiming: scene.timeline.estimated },
    sound: { sfx: sfxEnabled, music: musicArg },
  };
  writeJson(join(dir, "meta.json"), meta);

  // Audio. The composition plays each narration clip itself; everything else (effects, music
  // ducked under the voice) is mixed here into one "bed" track for the whole video.
  const runId = basename(dir);
  const workDir = join(cacheDir, "..", "render", runId);
  cleanups.push(() => rmSync(workDir, { recursive: true, force: true }));
  let narrationReference: Float32Array | null = null;
  let narrationGain = 1;
  let bed: string | null = null;
  if (!stillTimes && (hasNarration || sfxEnabled || musicArg)) {
    mkdirSync(workDir, { recursive: true });
    // Reference for the sync check and the artefacts, for the rendered range (as before).
    const ranged = buildSoundtrack(scene, cacheDir, { from, to, narration: hasNarration, sfx: sfxEnabled });
    narrationReference = ranged.narration;
    writeFileSync(join(dir, "audio.wav"), encodeWav({ sampleRate: ranged.sampleRate, channels: ranged.mix }));
    if (ranged.narration) writeFileSync(join(dir, "narration.wav"), encodeWav({ sampleRate: ranged.sampleRate, channels: [ranged.narration] }));
    // The whole video: the composition starts at frame 0, Remotion trims to the range.
    const full = buildSoundtrack(scene, cacheDir, { from: 0, to: fullDuration, narration: hasNarration, sfx: sfxEnabled });
    narrationGain = full.safetyGain;
    const voiceTrack = full.narration;
    // Bed = the mix without the voice.
    const bedLeft = new Float32Array(full.mix[0]);
    const bedRight = new Float32Array(full.mix[1]);
    if (voiceTrack) {
      for (let i = 0; i < bedLeft.length; i++) {
        bedLeft[i] -= voiceTrack[i] * full.safetyGain;
        bedRight[i] -= voiceTrack[i] * full.safetyGain;
      }
    }
    if (musicArg) {
      const key = join(workDir, "narration-key.wav");
      writeFileSync(key, encodeWav({ sampleRate: full.sampleRate, channels: [voiceTrack ?? new Float32Array(bedLeft.length)] }));
      const [musicLeft, musicRight] = duckedMusic(musicArg, key, fullDuration, story.sound?.musicVolume ?? 0.18, workDir);
      for (let i = 0; i < bedLeft.length; i++) {
        bedLeft[i] += musicLeft[i] ?? 0;
        bedRight[i] += musicRight[i] ?? 0;
      }
      // Voice + bed must stay under full scale (the old limiter's job): scale both if needed.
      const combined = [0, 1].map((channel) => {
        const out = new Float32Array(bedLeft.length);
        const side = channel === 0 ? bedLeft : bedRight;
        for (let i = 0; i < out.length; i++) out[i] = side[i] + (voiceTrack ? voiceTrack[i] * narrationGain : 0);
        return out;
      });
      const combinedPeak = peak(combined);
      if (combinedPeak > 0.89) {
        const gain = 0.89 / combinedPeak;
        narrationGain *= gain;
        for (let i = 0; i < bedLeft.length; i++) {
          bedLeft[i] *= gain;
          bedRight[i] *= gain;
        }
      }
    }
    if (sfxEnabled || musicArg) {
      writeFileSync(join(workDir, "bed.wav"), encodeWav({ sampleRate: full.sampleRate, channels: [bedLeft, bedRight] }));
      bed = `cache/render/${runId}/bed.wav`;
    }
    meta.soundtrack = { rawPeakDb: round(20 * Math.log10(full.rawPeak || 1e-9)), narrationGain: round(narrationGain), sfxCues: full.cueCount, bed: bed !== null };
  }

  let succeeded = false;
  const cleanVideo = join(dir, "video.mp4");
  const burnedVideo = join(dir, "video.captioned.mp4");
  const burn = !values["no-burn"] && clipCaptions.length > 0;
  try {
    const started = performance.now();
    const publicDir = prepareRemotionPublic(PROJECT_ROOT);
    const { bundle } = await import("@remotion/bundler");
    const { ensureBrowser, makeCancelSignal, renderFrames, renderMedia, renderStill, selectComposition } = await import("@remotion/renderer");
    await ensureBrowser();
    const bundleDir = mkdtempSync(join(tmpdir(), "simlab-bundle-"));
    cleanups.push(() => rmSync(bundleDir, { recursive: true, force: true }));
    console.log("Bundling the composition…");
    const serveUrl = await bundle({
      entryPoint: join(PROJECT_ROOT, "remotion", "index.ts"),
      publicDir,
      outDir: bundleDir,
      // A throwaway bundle: link the public folder instead of copying assets and the voice cache.
      symlinkPublicDir: true,
      onProgress: () => {},
    });
    const { cancelSignal, cancel } = makeCancelSignal();
    cleanups.push(() => cancel());

    const inputProps: EpisodeProps = {
      story,
      config: loaded.rawConfig,
      seed,
      batchRuns,
      clipDurations: voice.provider === "none" ? null : cacheManifest(cacheDir),
      voiceDir: hasNarration ? "cache/voice" : null,
      bed,
      narrationGain,
      captions: false,
      width,
      height,
      fps,
    };
    const composition = await selectComposition({ serveUrl, id: "Episode", inputProps, logLevel: "error" });
    const check = (composition.props as EpisodeProps).check!;
    if (!check.fontsReady) throw new Error("Bundled fonts did not load in the render page");
    // The browser rebuilt the scene independently; it must agree with Node exactly.
    if (JSON.stringify(check.metrics) !== JSON.stringify(scene.metrics)) {
      const differences = Object.keys(scene.metrics).flatMap((variant) =>
        Object.keys(scene.metrics[variant])
          .filter((key) => !Object.is(scene.metrics[variant][key], check.metrics[variant]?.[key]))
          .map((key) => `${variant}.${key}: node=${scene.metrics[variant][key]} browser=${check.metrics[variant]?.[key]}`),
      );
      throw new Error(`Browser and Node simulations disagree — refusing to render a video that does not match the saved data:\n  ${differences.slice(0, 8).join("\n  ")}`);
    }
    if (Math.abs(check.duration - fullDuration) > 1e-6) throw new Error(`Browser timeline is ${check.duration} s but Node's is ${fullDuration} s`);
    meta.missingAssets = check.missingAssets;
    if (check.missingAssets.length > 0) {
      const message = `${check.missingAssets.length} illustration slot(s) have no file and are drawn as placeholders (run \`npm run assets\`):\n  ${check.missingAssets.slice(0, 6).join("\n  ")}${check.missingAssets.length > 6 ? "\n  …" : ""}`;
      if (values["require-assets"]) throw new Error(message);
      console.log(`⚠ ${message}`);
    }
    if (check.captionOverflow.length > 0) {
      throw new Error(`These captions need more than two lines at the caption font size — shorten or split them with punctuation:\n  ${check.captionOverflow.join("\n  ")}`);
    }

    // Same composition, captions on or off.
    const withCaptions = (captions: boolean) => ({ composition: { ...composition, props: { ...composition.props, captions } }, inputProps: { ...inputProps, captions } });

    if (stillTimes) {
      for (const time of stillTimes) {
        const file = join(dir, `still-${time.toFixed(2).replace(".", "_")}s.png`);
        await renderStill({ ...withCaptions(true), serveUrl, output: file, frame: Math.min(Math.round(time * fps), composition.durationInFrames - 1), logLevel: "error" });
        console.log(`  ${displayPath(file)}`);
      }
      succeeded = true;
      return;
    }

    if (values["keep-frames"]) {
      const framesDir = join(dir, "frames");
      mkdirSync(framesDir);
      await renderFrames({ ...withCaptions(false), serveUrl, outputDir: framesDir, imageFormat: "png", frameRange: [firstFrame, lastFrame - 1], onStart: () => {}, onFrameUpdate: () => {}, cancelSignal, logLevel: "error", ...(concurrency ? { concurrency } : {}) });
    }

    const hasAudio = hasNarration || bed !== null;
    console.log(`Rendering ${frameCount} frames (${clipDuration.toFixed(2)} s) at ${width}×${height}, ${fps} fps · narration ${hasNarration ? "on" : "off"} · sfx ${sfxEnabled ? "on" : "off"} · music ${musicArg ? "on" : "off"} · burned captions ${burn ? "yes" : "no"}`);
    const encode = async (file: string, captions: boolean) => {
      let lastReport = 0;
      await renderMedia({
        ...withCaptions(captions),
        serveUrl,
        codec: "h264",
        outputLocation: file,
        crf,
        x264Preset: "medium",
        pixelFormat: "yuv420p",
        audioCodec: "aac",
        audioBitrate: "192k",
        frameRange: [firstFrame, lastFrame - 1],
        muted: !hasAudio,
        enforceAudioTrack: hasAudio,
        overwrite: false,
        cancelSignal,
        logLevel: "error",
        ...(concurrency ? { concurrency } : {}),
        onProgress: ({ renderedFrames, encodedFrames }) => {
          const now = performance.now();
          if (now - lastReport < 3000 && encodedFrames < frameCount) return;
          lastReport = now;
          console.log(`  ${basename(file)}: ${renderedFrames}/${frameCount} rendered · ${encodedFrames} encoded`);
        },
      });
    };
    await encode(cleanVideo, false);
    if (burn) await encode(burnedVideo, true);

    // Checks on the finished files.
    const report: Record<string, unknown> = {};
    for (const file of burn ? [cleanVideo, burnedVideo] : [cleanVideo]) {
      const info = probe(file);
      const video = info.streams.find((stream) => stream.codec_type === "video");
      const audio = info.streams.find((stream) => stream.codec_type === "audio") ?? null;
      const audioDuration = audio?.duration ? Number(audio.duration) : null;
      report[basename(file)] = { duration: Number(info.format.duration), sizeBytes: Number(info.format.size), video, audio };
      if (Number(video?.nb_frames) !== frameCount) throw new Error(`${basename(file)}: ${video?.nb_frames} frames, expected ${frameCount}`);
      if (audioDuration !== null && Math.abs(audioDuration - clipDuration) > 0.05) {
        throw new Error(`${basename(file)}: audio track is ${audioDuration.toFixed(3)} s but the video is ${clipDuration.toFixed(3)} s`);
      }
      console.log(`\n✔ ${displayPath(file)}\n  ${video?.width}×${video?.height} · ${video?.r_frame_rate} fps · ${Number(info.format.duration).toFixed(2)} s · ${video?.nb_frames} frames · ${(Number(info.format.size) / 1e6).toFixed(1)} MB · audio: ${audio ? `${audio.codec_name} ${audio.sample_rate} Hz ${audio.channels}ch, ${audioDuration?.toFixed(2)} s` : "none"}`);
    }
    meta.output = report;
    if (narrationReference) {
      const sync = verifySync(cleanVideo, scene, narrationReference, from);
      meta.sync = sync;
      console.log(`  sync: ${sync.checkedClips} clips located, max offset ${(sync.maxOffset * 1000).toFixed(0)} ms · audio peak ${sync.peakDb.toFixed(1)} dBFS · clipped samples ${sync.clippedSamples}`);
      // One video frame is the tolerance for calling it in sync.
      if (sync.maxOffset > 1 / fps) throw new Error(`Narration is off by up to ${(sync.maxOffset * 1000).toFixed(0)} ms from the timeline — see meta.json "sync"`);
      if (sync.clippedSamples > 0) console.log(`  ⚠ ${sync.clippedSamples} clipped samples in the final audio`);
    } else if (!hasAudio) {
      console.log(`  (no audio track${scene.timeline.estimated ? "; caption timing uses reading-speed estimates" : ""})`);
    }
    meta.renderSeconds = (performance.now() - started) / 1000;
    writeJson(join(dir, "meta.json"), meta);
    succeeded = true;
  } finally {
    await cleanupAll();
    if (!succeeded) {
      // Never leave a truncated video that looks finished.
      for (const file of [cleanVideo, burnedVideo]) if (existsSync(file)) rmSync(file);
      writeJson(join(dir, "meta.json"), meta);
      writeFileSync(join(dir, "FAILED.txt"), "Render failed — see the console output. Artefacts here are incomplete.\n");
    }
  }
});
