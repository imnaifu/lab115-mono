// Voice clip cache: cache/voice/<key>.wav + <key>.json. The key hashes the speech text and every
// voice setting, so editing one sentence only invalidates that sentence, and nothing that is
// already generated is ever generated (or paid for) twice.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ClipLookup, NarrationClip, VoiceSpec } from "../core/story.ts";
import { audibleRange, decodeWav, encodeWav } from "../core/wav.ts";

export const VOICE_SAMPLE_RATE = 48000;

export interface ClipMeta {
  key: string;
  provider: string;
  voice: string;
  model: string;
  speed: number;
  speech: string;
  /** Seconds after trimming leading/trailing silence. */
  duration: number;
  rawDuration: number;
  createdAt: string;
}

export function voiceCacheDir(projectRoot: string): string {
  return join(projectRoot, "cache", "voice");
}

export function readClipMeta(cacheDir: string, key: string): ClipMeta | null {
  const metaPath = join(cacheDir, `${key}.json`);
  if (!existsSync(metaPath) || !existsSync(join(cacheDir, `${key}.wav`))) return null;
  return JSON.parse(readFileSync(metaPath, "utf8")) as ClipMeta;
}

export function cacheLookup(cacheDir: string): ClipLookup {
  return (clip) => readClipMeta(cacheDir, clip.key)?.duration ?? null;
}

/** key → duration for every cached clip (served to the preview). */
export function cacheManifest(cacheDir: string): Record<string, number> {
  if (!existsSync(cacheDir)) return {};
  const manifest: Record<string, number> = {};
  for (const file of readdirSync(cacheDir)) {
    if (!file.endsWith(".json")) continue;
    const meta = readClipMeta(cacheDir, file.slice(0, -5));
    if (meta) manifest[meta.key] = meta.duration;
  }
  return manifest;
}

/**
 * Convert any audio file to the cache format (48 kHz mono PCM16), trim silence at both ends so
 * caption timing matches speech, and store it atomically.
 */
export function storeClip(cacheDir: string, clip: NarrationClip, sourceFile: string, voice: VoiceSpec): ClipMeta {
  mkdirSync(cacheDir, { recursive: true });
  const normalized = join(cacheDir, `${clip.key}.normalizing.wav`);
  try {
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", sourceFile, "-ac", "1", "-ar", String(VOICE_SAMPLE_RATE), "-c:a", "pcm_s16le", normalized]);
    const audio = decodeWav(readFileSync(normalized));
    const samples = audio.channels[0];
    const [start, end] = audibleRange(samples, audio.sampleRate);
    if (end <= start) throw new Error(`clip ${clip.id} is silent`);
    const trimmed = samples.slice(start, end);
    const temporary = join(cacheDir, `${clip.key}.tmp.wav`);
    writeFileSync(temporary, encodeWav({ sampleRate: audio.sampleRate, channels: [trimmed] }));
    renameSync(temporary, join(cacheDir, `${clip.key}.wav`));
    const meta: ClipMeta = {
      key: clip.key,
      provider: voice.provider,
      voice: voice.voice ?? "",
      model: voice.model ?? "",
      speed: voice.speed ?? 1,
      speech: clip.speech,
      duration: trimmed.length / audio.sampleRate,
      rawDuration: samples.length / audio.sampleRate,
      createdAt: new Date().toISOString(),
    };
    writeFileSync(join(cacheDir, `${clip.key}.json`), `${JSON.stringify(meta, null, 2)}\n`);
    return meta;
  } finally {
    rmSync(normalized, { force: true });
  }
}

export function removeClip(cacheDir: string, key: string) {
  rmSync(join(cacheDir, `${key}.wav`), { force: true });
  rmSync(join(cacheDir, `${key}.json`), { force: true });
}

export function loadClipSamples(cacheDir: string, key: string): Float32Array {
  const audio = decodeWav(readFileSync(join(cacheDir, `${key}.wav`)));
  if (audio.sampleRate !== VOICE_SAMPLE_RATE) throw new Error(`cached clip ${key} has sample rate ${audio.sampleRate}`);
  return audio.channels[0];
}
