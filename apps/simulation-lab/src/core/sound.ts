// Sound effects synthesised from the timeline — no samples, so no licensing questions.
// Cues come from simulation events (via the experiment's soundCues hook) mapped through each
// chapter's sim→video mapping, plus a few generic chapter cues. Off unless a story enables sfx.

import type { Scene, SoundCue } from "./experiment.ts";
import { Rng } from "./rng.ts";

export interface PlacedCue {
  /** Whole-video seconds. */
  time: number;
  cue: SoundCue["cue"];
  pitch: number;
  gain: number;
  /** -1 (left) … 1 (right). */
  pan: number;
}

/** Minimum spacing between identical cues in one panel, so fast-forward doesn't become noise. */
const MIN_SPACING = 0.09;

export function placeCues(scene: Scene): PlacedCue[] {
  const placed: PlacedCue[] = [];
  for (const chapter of scene.timeline.chapters) {
    const kind = chapter.spec.kind;
    if (kind === "title") placed.push({ time: chapter.start, cue: "whoosh", pitch: 1, gain: 0.8, pan: 0 });
    if (kind === "chart" && chapter.spec.reveal !== false) placed.push({ time: chapter.start, cue: "pop", pitch: 1, gain: 0.8, pan: 0 });
    if (kind === "poll") {
      const countdown = chapter.spec.countdown ?? 3;
      for (let second = 0; second < countdown; second++) placed.push({ time: chapter.start + chapter.countdownStart + second, cue: "tick", pitch: 1, gain: 0.9, pan: 0 });
    }
    if (kind !== "sim" || !scene.experiment.soundCues || chapter.playEnd <= chapter.playStart) continue;
    const speed = (chapter.simTo - chapter.simFrom) / (chapter.playEnd - chapter.playStart);
    // Quieter when many events are crammed into little video time.
    const density = Math.min(1, Math.max(0.35, 60 / Math.max(speed, 1)));
    chapter.compare.forEach((variantId, panelIndex) => {
      const pan = chapter.compare.length === 1 ? 0 : -0.6 + (1.2 * panelIndex) / (chapter.compare.length - 1);
      const lastByCue = new Map<string, number>();
      for (const cue of scene.experiment.soundCues!(scene, variantId)) {
        const time = scene.timeline.videoTimeOf(chapter, cue.simTime);
        if (time === null) continue;
        if (time - (lastByCue.get(cue.cue) ?? -Infinity) < MIN_SPACING && cue.cue !== "chime") continue;
        lastByCue.set(cue.cue, time);
        placed.push({ time, cue: cue.cue, pitch: cue.pitch ?? 1, gain: (cue.gain ?? 1) * (cue.cue === "chime" ? 1 : density), pan });
      }
    });
  }
  return placed.sort((left, right) => left.time - right.time);
}

/** Mono sample buffer for one cue. Deterministic (noise comes from a fixed-seed RNG). */
function synthesize(cue: PlacedCue, sampleRate: number): Float32Array {
  const seconds = { ding: 0.5, chime: 0.9, whoosh: 0.4, pop: 0.12, tick: 0.05 }[cue.cue];
  const samples = new Float32Array(Math.round(seconds * sampleRate));
  const attack = Math.round(0.004 * sampleRate);
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    const fadeIn = Math.min(1, i / attack);
    let value = 0;
    switch (cue.cue) {
      case "ding": {
        const frequency = 880 * cue.pitch;
        value = (Math.sin(2 * Math.PI * frequency * t) + 0.35 * Math.sin(2 * Math.PI * frequency * 2 * t) + 0.12 * Math.sin(2 * Math.PI * frequency * 3 * t)) * Math.exp(-t * 9) * 0.2;
        break;
      }
      case "chime": {
        // Two notes a fifth apart, slightly staggered.
        const note = (frequency: number, delay: number) => (t < delay ? 0 : Math.sin(2 * Math.PI * frequency * (t - delay)) * Math.exp(-(t - delay) * 5));
        value = (note(659.25, 0) + 0.9 * note(987.77, 0.08)) * 0.22;
        break;
      }
      case "pop": {
        const frequency = 620 - 3200 * t;
        value = Math.sin(2 * Math.PI * frequency * t) * Math.exp(-t * 30) * 0.35;
        break;
      }
      case "tick":
        value = Math.sin(2 * Math.PI * 1760 * t) * Math.exp(-t * 90) * 0.3;
        break;
      case "whoosh":
        break;
    }
    samples[i] = value * fadeIn;
  }
  if (cue.cue === "whoosh") {
    // Low-passed noise with a sweeping cutoff and a smooth swell.
    const rng = new Rng(7);
    let state = 0;
    for (let i = 0; i < samples.length; i++) {
      const progress = i / samples.length;
      const cutoff = 300 + 2600 * Math.sin(Math.PI * progress);
      const alpha = 1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate);
      state += alpha * (rng.next() * 2 - 1 - state);
      samples[i] = state * Math.sin(Math.PI * progress) * 0.5;
    }
  }
  return samples;
}

/** Mix cues into stereo channels of `duration` seconds. */
export function renderSfx(cues: PlacedCue[], duration: number, sampleRate: number): [Float32Array, Float32Array] {
  const length = Math.ceil(duration * sampleRate);
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  for (const cue of cues) {
    const samples = synthesize(cue, sampleRate);
    // Equal-power panning.
    const angle = ((cue.pan + 1) * Math.PI) / 4;
    const leftGain = Math.cos(angle) * cue.gain;
    const rightGain = Math.sin(angle) * cue.gain;
    const offset = Math.round(cue.time * sampleRate);
    for (let i = 0; i < samples.length && offset + i < length; i++) {
      if (offset + i < 0) continue;
      left[offset + i] += samples[i] * leftGain;
      right[offset + i] += samples[i] * rightGain;
    }
  }
  return [left, right];
}
