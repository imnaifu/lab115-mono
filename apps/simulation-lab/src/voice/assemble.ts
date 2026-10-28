// Builds the soundtrack from the timeline: narration clips at their timeline positions (pauses
// come from the timeline itself, audio is never stretched), plus optional synthesised effects.
// Also verifies the final audio against the timeline (sync, clipping, length).

import { execFileSync } from "node:child_process";
import type { Scene } from "../core/experiment.ts";
import { placeCues, renderSfx } from "../core/sound.ts";
import { peak } from "../core/wav.ts";
import { loadClipSamples, VOICE_SAMPLE_RATE } from "./cache.ts";

export interface Soundtrack {
  sampleRate: number;
  /** Narration only (mono) — also the key signal for music ducking and the sync check. */
  narration: Float32Array | null;
  /** Narration + effects, stereo. */
  mix: [Float32Array, Float32Array];
  cueCount: number;
  /** Peak before any safety gain (1.0 = full scale). */
  rawPeak: number;
  /** Gain applied to keep the mix below full scale (1 = none). */
  safetyGain: number;
}

/** Soundtrack for the video range [from, to). */
export function buildSoundtrack(scene: Scene, cacheDir: string, options: { from: number; to: number; narration: boolean; sfx: boolean }): Soundtrack {
  const sampleRate = VOICE_SAMPLE_RATE;
  const length = Math.ceil((options.to - options.from) * sampleRate);
  let narration: Float32Array | null = null;
  if (options.narration) {
    narration = new Float32Array(length);
    for (const clip of scene.timeline.clips) {
      if (clip.end <= options.from || clip.start >= options.to) continue;
      const samples = loadClipSamples(cacheDir, clip.key);
      const offset = Math.round((clip.start - options.from) * sampleRate);
      for (let i = 0; i < samples.length; i++) {
        const target = offset + i;
        if (target >= 0 && target < length) narration[target] += samples[i];
      }
    }
  }
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  if (narration) {
    left.set(narration);
    right.set(narration);
  }
  let cueCount = 0;
  if (options.sfx) {
    const cues = placeCues(scene)
      .filter((cue) => cue.time >= options.from - 1 && cue.time < options.to)
      .map((cue) => ({ ...cue, time: cue.time - options.from }));
    cueCount = cues.length;
    // Effects sit well under the voice.
    const [sfxLeft, sfxRight] = renderSfx(cues, options.to - options.from, sampleRate);
    const effectGain = narration ? 0.55 : 0.8;
    for (let i = 0; i < length; i++) {
      left[i] += sfxLeft[i] * effectGain;
      right[i] += sfxRight[i] * effectGain;
    }
  }
  const rawPeak = peak([left, right]);
  // Keep ~1 dB of headroom; this only engages if voice and effects pile up.
  const safetyGain = rawPeak > 0.89 ? 0.89 / rawPeak : 1;
  if (safetyGain !== 1) {
    for (let i = 0; i < length; i++) {
      left[i] *= safetyGain;
      right[i] *= safetyGain;
    }
  }
  return { sampleRate, narration, mix: [left, right], cueCount, rawPeak, safetyGain };
}

/** 4 ms RMS envelope — cheap to cross-correlate. */
function envelope(samples: Float32Array, sampleRate: number): Float32Array {
  const hop = Math.round(sampleRate * 0.004);
  const out = new Float32Array(Math.floor(samples.length / hop));
  for (let frame = 0; frame < out.length; frame++) {
    let sum = 0;
    for (let i = frame * hop; i < (frame + 1) * hop; i++) sum += samples[i] * samples[i];
    out[frame] = Math.sqrt(sum / hop);
  }
  return out;
}

export interface SyncReport {
  checkedClips: number;
  /** Largest |offset| between where a clip is in the final file and where the timeline says (seconds). */
  maxOffset: number;
  offsets: { id: string; start: number; offset: number }[];
  /** Peak level of the decoded final audio in dBFS. */
  peakDb: number;
  /** Samples at or above full scale in the final audio. */
  clippedSamples: number;
  audioDuration: number;
}

/**
 * Decode the audio of a finished MP4 and locate every narration clip in it by cross-correlating
 * loudness envelopes (works with effects/music mixed in). Each offset should be ~0.
 */
export function verifySync(videoPath: string, scene: Scene, narration: Float32Array, from: number): SyncReport {
  const sampleRate = 16000;
  const raw = execFileSync("ffmpeg", ["-v", "error", "-i", videoPath, "-map", "0:a:0", "-ac", "1", "-ar", String(sampleRate), "-f", "s16le", "-"], { maxBuffer: 1 << 30 });
  const decoded = new Float32Array(raw.length / 2);
  for (let i = 0; i < decoded.length; i++) decoded[i] = raw.readInt16LE(i * 2) / 32768;
  // Downsample the reference narration (48 kHz) to 16 kHz by averaging.
  const ratio = VOICE_SAMPLE_RATE / sampleRate;
  const reference = new Float32Array(Math.floor(narration.length / ratio));
  for (let i = 0; i < reference.length; i++) reference[i] = (narration[i * ratio] + narration[i * ratio + 1] + narration[i * ratio + 2]) / 3;
  const finalEnvelope = envelope(decoded, sampleRate);
  const referenceEnvelope = envelope(reference, sampleRate);
  const frameSeconds = 0.004;
  const maxLag = Math.round(0.25 / frameSeconds);
  const offsets: SyncReport["offsets"] = [];
  for (const clip of scene.timeline.clips) {
    const startFrame = Math.round((clip.start - from) / frameSeconds);
    const window = Math.min(Math.round(1.5 / frameSeconds), Math.round(clip.duration / frameSeconds));
    if (startFrame < 0 || startFrame + window + maxLag >= finalEnvelope.length || window < 20) continue;
    let bestLag = 0;
    let bestScore = -Infinity;
    for (let lag = -maxLag; lag <= maxLag; lag++) {
      let score = 0;
      for (let i = 0; i < window; i++) score += referenceEnvelope[startFrame + i] * (finalEnvelope[startFrame + i + lag] ?? 0);
      if (score > bestScore) {
        bestScore = score;
        bestLag = lag;
      }
    }
    offsets.push({ id: clip.id, start: clip.start, offset: bestLag * frameSeconds });
  }
  let clippedSamples = 0;
  for (const sample of decoded) if (Math.abs(sample) >= 0.999) clippedSamples++;
  const decodedPeak = peak([decoded]);
  return {
    checkedClips: offsets.length,
    maxOffset: Math.max(0, ...offsets.map((entry) => Math.abs(entry.offset))),
    offsets,
    peakDb: decodedPeak > 0 ? 20 * Math.log10(decodedPeak) : -Infinity,
    clippedSamples,
    audioDuration: decoded.length / sampleRate,
  };
}
