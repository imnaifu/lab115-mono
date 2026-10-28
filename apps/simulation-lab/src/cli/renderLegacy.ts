// npm run render:legacy -- --story stories/queue-demo.json [--preview] [--from 0 --to 8] [--stills 3,20,50]
//
// The previous exporter, kept while the Remotion exporter (render.ts) settles; same options and
// outputs. Deterministic export: a headless Chromium page renders frame N on request (no timers, no
// screen recording); PNG frames are piped into FFmpeg, which writes a clean MP4 and one with
// burned-in captions in the same pass. Narration clips are placed exactly where the timeline
// says, and the finished audio is checked against the timeline (sync, clipping, length).

import { type ChildProcessWithoutNullStreams, execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parseArgs } from "node:util";
import type { Browser } from "playwright";
import { buildScene } from "../core/scene.ts";
import { DEFAULT_VOICE, toNarrationScript, toSrt, toTimelineJson, toVtt } from "../core/story.ts";
import { encodeWav } from "../core/wav.ts";
import type { RenderLoadArgs, RenderLoadResult } from "../export/page.ts";
import { buildSoundtrack, verifySync } from "../voice/assemble.ts";
import { cacheLookup, cacheManifest, voiceCacheDir } from "../voice/cache.ts";
import { createRunDir, displayPath, loadStory, parseIntArg, parseNumberArg, PROJECT_ROOT, projectPath, runCli, runMeta, userPath, writeCsv, writeJson } from "./common.ts";

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

type Cleanup = () => Promise<void> | void;
const cleanups: Cleanup[] = [];

async function cleanupAll() {
  // Last registered first: ffmpeg, then browser, then dev server.
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
    },
  });
  if (!values.story) throw new Error("Missing --story (e.g. --story stories/queue-demo.json)");
  const loaded = loadStory(values.story, values.config);
  const { story, experiment } = loaded;
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
    if (!execFileSync("ffmpeg", ["-hide_banner", "-encoders"]).toString().includes("libx264")) {
      throw new Error("This FFmpeg build has no libx264 encoder; install a build with x264 support.");
    }
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

  // Soundtrack: narration at timeline positions + optional effects, mixed in Node.
  let soundtrack: ReturnType<typeof buildSoundtrack> | null = null;
  const audioPath = join(dir, "audio.wav");
  if (!stillTimes && (hasNarration || sfxEnabled)) {
    soundtrack = buildSoundtrack(scene, cacheDir, { from, to, narration: hasNarration, sfx: sfxEnabled });
    writeFileSync(audioPath, encodeWav({ sampleRate: soundtrack.sampleRate, channels: soundtrack.mix }));
    if (soundtrack.narration) writeFileSync(join(dir, "narration.wav"), encodeWav({ sampleRate: soundtrack.sampleRate, channels: [soundtrack.narration] }));
    meta.soundtrack = { rawPeakDb: round(20 * Math.log10(soundtrack.rawPeak || 1e-9)), safetyGain: round(soundtrack.safetyGain), sfxCues: soundtrack.cueCount };
  }

  let succeeded = false;
  const cleanVideo = join(dir, "video.mp4");
  const burnedVideo = join(dir, "video.captioned.mp4");
  const burn = !values["no-burn"] && clipCaptions.length > 0;
  try {
    const started = performance.now();
    // Dev server serves render.html with the same modules the preview uses.
    const { createServer } = await import("vite");
    const server = await createServer({ root: PROJECT_ROOT, configFile: join(PROJECT_ROOT, "vite.config.ts"), logLevel: "error", clearScreen: false, server: { host: "127.0.0.1", port: 5299, strictPort: false } });
    cleanups.push(() => server.close());
    await server.listen();
    const baseUrl = server.resolvedUrls?.local[0];
    if (!baseUrl) throw new Error("Vite dev server did not report a URL");

    const { chromium } = await import("playwright");
    let browser: Browser;
    try {
      browser = await chromium.launch();
    } catch (error) {
      throw new Error(`Could not start Chromium (${(error as Error).message.split("\n")[0]}). Run \`npm run setup:browser\` once to download it.`);
    }
    cleanups.push(() => browser.close());
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(new URL("render.html", baseUrl).href);
    await page.waitForFunction(() => "__simlab" in window, null, { timeout: 30_000 });
    const loadArgs: RenderLoadArgs = { story, config: loaded.rawConfig, seed, batchRuns, width, height, fps, clipDurations: voice.provider === "none" ? null : cacheManifest(cacheDir) };
    const result: RenderLoadResult = await page.evaluate((args) => window.__simlab.load(args), loadArgs);
    if (!result.fontsReady) throw new Error("Bundled fonts did not load in the render page");
    // The browser rebuilt the scene independently; it must agree with Node exactly.
    if (JSON.stringify(result.metrics) !== JSON.stringify(scene.metrics)) {
      const differences = Object.keys(scene.metrics).flatMap((variant) =>
        Object.keys(scene.metrics[variant])
          .filter((key) => !Object.is(scene.metrics[variant][key], result.metrics[variant]?.[key]))
          .map((key) => `${variant}.${key}: node=${scene.metrics[variant][key]} browser=${result.metrics[variant]?.[key]}`),
      );
      throw new Error(`Browser and Node simulations disagree — refusing to render a video that does not match the saved data:\n  ${differences.slice(0, 8).join("\n  ")}`);
    }
    if (Math.abs(result.duration - fullDuration) > 1e-6) throw new Error(`Browser timeline is ${result.duration} s but Node's is ${fullDuration} s`);
    meta.missingAssets = result.missingAssets;
    if (result.missingAssets.length > 0) {
      const message = `${result.missingAssets.length} illustration slot(s) have no file and are drawn as placeholders (run \`npm run assets\`):\n  ${result.missingAssets.slice(0, 6).join("\n  ")}${result.missingAssets.length > 6 ? "\n  …" : ""}`;
      if (values["require-assets"]) throw new Error(message);
      console.log(`⚠ ${message}`);
    }
    if (result.captionOverflow.length > 0) {
      throw new Error(`These captions need more than two lines at the caption font size — shorten or split them with punctuation:\n  ${result.captionOverflow.join("\n  ")}`);
    }

    const capture = async (frame: number, captions: boolean) => {
      await page.evaluate(([index, withCaptions]) => window.__simlab.renderFrame(index, withCaptions), [frame, captions] as const);
      if (pageErrors.length > 0) throw new Error(`Render page error: ${pageErrors[0]}`);
      return page.screenshot({ type: "png", clip: { x: 0, y: 0, width, height } });
    };

    if (stillTimes) {
      for (const time of stillTimes) {
        const file = join(dir, `still-${time.toFixed(2).replace(".", "_")}s.png`);
        writeFileSync(file, await capture(Math.min(Math.round(time * fps), Math.round(fullDuration * fps) - 1), true));
        console.log(`  ${displayPath(file)}`);
      }
      succeeded = true;
      return;
    }

    // Burned-in subtitles: each caption is drawn once by the same Canvas code as the preview,
    // saved as a transparent PNG and overlaid by FFmpeg during its time range.
    const captionFiles: string[] = [];
    if (burn) {
      const captionDir = join(dir, "caption-layers");
      mkdirSync(captionDir);
      for (const [i, caption] of clipCaptions.entries()) {
        const dataUrl: string = await page.evaluate((text) => window.__simlab.renderCaption(text), caption.text);
        const file = join(captionDir, `caption-${String(i + 1).padStart(3, "0")}.png`);
        writeFileSync(file, Buffer.from(dataUrl.split(",")[1], "base64"));
        captionFiles.push(file);
      }
    }

    const framesDir = join(dir, "frames");
    if (values["keep-frames"]) mkdirSync(framesDir);

    const args = ["-hide_banner", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "png", "-i", "pipe:0"];
    let inputIndex = 1;
    const audioInput = soundtrack ? inputIndex++ : -1;
    if (soundtrack) args.push("-i", audioPath);
    const musicInput = musicArg ? inputIndex++ : -1;
    if (musicArg) args.push("-stream_loop", "-1", "-i", musicArg);
    const captionInputStart = inputIndex;
    for (const file of captionFiles) args.push("-i", file);

    const filters: string[] = [];
    let videoClean = "0:v";
    let videoBurned = "";
    if (burn) {
      filters.push("[0:v]split=2[vclean][vb0]");
      clipCaptions.forEach((caption, i) => {
        filters.push(`[vb${i}][${captionInputStart + i}:v]overlay=0:0:enable='between(t,${caption.start.toFixed(3)},${(caption.end - 0.001).toFixed(3)})'[vb${i + 1}]`);
      });
      videoClean = "[vclean]";
      videoBurned = `[vb${clipCaptions.length}]`;
    }
    // Audio: Node's mix, plus optional music ducked under the narration.
    let audioLabels: string[] = [];
    const outputs = burn ? 2 : 1;
    if (musicArg) {
      const musicVolume = story.sound?.musicVolume ?? 0.18;
      filters.push(`[${musicInput}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${musicVolume},afade=t=in:d=1,afade=t=out:st=${Math.max(0, clipDuration - 2).toFixed(3)}:d=2[music]`);
      if (soundtrack) {
        filters.push(`[${audioInput}:a]asplit=2[mainmix][duckkey]`);
        filters.push("[music][duckkey]sidechaincompress=threshold=0.02:ratio=8:attack=15:release=400[ducked]");
        filters.push("[mainmix][ducked]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.89[aout]");
      } else {
        filters.push("[music]alimiter=limit=0.89[aout]");
      }
      if (outputs === 2) {
        filters.push("[aout]asplit=2[aout1][aout2]");
        audioLabels = ["[aout1]", "[aout2]"];
      } else audioLabels = ["[aout]"];
    } else if (soundtrack) {
      audioLabels = Array(outputs).fill(`${audioInput}:a`);
    }
    if (filters.length > 0) args.push("-filter_complex", filters.join(";"));

    const encode = (video: string, audio: string | undefined, file: string) => {
      args.push("-map", video, "-c:v", "libx264", "-preset", "medium", "-crf", String(crf), "-pix_fmt", "yuv420p", "-r", String(fps));
      if (audio) args.push("-map", audio, "-c:a", "aac", "-b:a", "192k", "-ar", "48000");
      // -t pins the length to the video; -n never overwrites.
      args.push("-t", clipDuration.toFixed(6), "-movflags", "+faststart", "-n", file);
    };
    encode(videoClean, audioLabels[0], cleanVideo);
    if (burn) encode(videoBurned, audioLabels[1], burnedVideo);

    const ffmpeg: ChildProcessWithoutNullStreams = spawn("ffmpeg", args, { stdio: ["pipe", "pipe", "pipe"] });
    let ffmpegLog = "";
    ffmpeg.stderr.on("data", (chunk: Buffer) => (ffmpegLog = (ffmpegLog + chunk.toString()).slice(-4000)));
    const ffmpegExit = once(ffmpeg, "close") as Promise<[number | null]>;
    let ffmpegDied = false;
    void ffmpegExit.then(() => (ffmpegDied = true));
    cleanups.push(() => {
      if (!ffmpegDied) ffmpeg.kill("SIGKILL");
    });

    console.log(`Rendering ${frameCount} frames (${clipDuration.toFixed(2)} s) at ${width}×${height}, ${fps} fps · narration ${hasNarration ? "on" : "off"} · sfx ${sfxEnabled ? "on" : "off"} · music ${musicArg ? "on" : "off"} · burned captions ${burn ? "yes" : "no"}`);
    let lastReport = 0;
    for (let frame = firstFrame; frame < lastFrame; frame++) {
      const png = await capture(frame, false);
      if (values["keep-frames"]) writeFileSync(join(framesDir, `${String(frame).padStart(6, "0")}.png`), png);
      if (ffmpegDied) throw new Error(`FFmpeg exited early:\n${ffmpegLog}`);
      // Respect backpressure so memory stays flat on long videos.
      if (!ffmpeg.stdin.write(png)) await once(ffmpeg.stdin, "drain");
      const done = frame - firstFrame + 1;
      const now = performance.now();
      if (now - lastReport > 3000 || done === frameCount) {
        lastReport = now;
        const rate = done / ((now - started) / 1000);
        console.log(`  ${done}/${frameCount} frames · ${rate.toFixed(1)} fps · ETA ${Math.max(0, (frameCount - done) / rate).toFixed(0)} s`);
      }
    }
    ffmpeg.stdin.end();
    const [code] = await ffmpegExit;
    if (code !== 0) throw new Error(`FFmpeg failed (exit ${code}):\n${ffmpegLog}`);

    // Checks on the finished files.
    const report: Record<string, unknown> = {};
    for (const file of burn ? [cleanVideo, burnedVideo] : [cleanVideo]) {
      const info = probe(file);
      const video = info.streams.find((stream) => stream.codec_type === "video");
      const audio = info.streams.find((stream) => stream.codec_type === "audio") ?? null;
      const audioDuration = audio?.duration ? Number(audio.duration) : null;
      report[basename(file)] = { duration: Number(info.format.duration), sizeBytes: Number(info.format.size), video, audio };
      if (audioDuration !== null && Math.abs(audioDuration - clipDuration) > 0.05) {
        throw new Error(`${basename(file)}: audio track is ${audioDuration.toFixed(3)} s but the video is ${clipDuration.toFixed(3)} s`);
      }
      console.log(`\n✔ ${displayPath(file)}\n  ${video?.width}×${video?.height} · ${video?.r_frame_rate} fps · ${Number(info.format.duration).toFixed(2)} s · ${video?.nb_frames} frames · ${(Number(info.format.size) / 1e6).toFixed(1)} MB · audio: ${audio ? `${audio.codec_name} ${audio.sample_rate} Hz ${audio.channels}ch, ${audioDuration?.toFixed(2)} s` : "none"}`);
    }
    meta.output = report;
    if (soundtrack?.narration) {
      const sync = verifySync(cleanVideo, scene, soundtrack.narration, from);
      meta.sync = sync;
      console.log(`  sync: ${sync.checkedClips} clips located, max offset ${(sync.maxOffset * 1000).toFixed(0)} ms · audio peak ${sync.peakDb.toFixed(1)} dBFS · clipped samples ${sync.clippedSamples}`);
      // One video frame is the tolerance for calling it in sync.
      if (sync.maxOffset > 1 / fps) throw new Error(`Narration is off by up to ${(sync.maxOffset * 1000).toFixed(0)} ms from the timeline — see meta.json "sync"`);
      if (sync.clippedSamples > 0) console.log(`  ⚠ ${sync.clippedSamples} clipped samples in the final audio`);
    } else if (!soundtrack) {
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

