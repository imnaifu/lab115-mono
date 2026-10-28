// Story = the video's narrative layer, driven by the narration script. Each chapter (segment)
// says what to show and what to say; the simulation runs first, the text pulls real numbers from
// it, the narration is split into caption-sized clips, and clip audio durations (or, without
// audio, flagged estimates) lay out the video timeline. Stories are JSON (stories/*.json).

import type { ShotSpec } from "./experiment.ts";
import { formatSrtTime } from "./format.ts";
import {
  applyLexicon,
  conditionHolds,
  estimateSpeechSeconds,
  fillTemplate,
  hashKey,
  type Language,
  selectItems,
  splitIntoClips,
  type TextItem,
} from "./narration.ts";

/**
 * A moment in simulated time: seconds, a named anchor ("start", "end", or one the experiment
 * provides such as "focus.arrival"), or an anchor with scale/offset: value * scale + offset.
 */
export type AnchorSpec = number | string | { anchor: string; scale?: number; offset?: number };

export type ChapterKind = "title" | "cards" | "poll" | "sim" | "chart";

export interface SimSpec {
  from?: AnchorSpec;
  to?: AnchorSpec;
  /** Freeze on this moment for the whole chapter (pause the simulation while narrating). */
  at?: AnchorSpec;
  /** "during": the simulation runs while the narration plays. "after": hold at `from` while narrating, then play at `speed`. */
  play?: "during" | "after";
  /** Simulated seconds per video second. Required for play "after"; optional cap/pace for "during". */
  speed?: number;
}

export interface ChapterSpec {
  id: string;
  kind: ChapterKind;
  /** Include this chapter only if the condition on result values holds. */
  when?: string;
  unless?: string;
  /** What is said. Items can be conditional; each sentence (or clause, if long) becomes one audio clip and one caption. */
  narration?: TextItem | TextItem[];
  /** Video seconds. With narration it is a minimum; without narration it is the length. */
  duration?: number;
  /** Silence before the first and after the last clip (seconds). */
  pauseBefore?: number;
  pauseAfter?: number;
  sim?: SimSpec;
  title?: string;
  subtitle?: string;
  heading?: string;
  bullets?: TextItem[];
  /** Banner text over the running simulation. */
  callout?: string;
  /** Highlight the story's focus entity; `{ "from": anchor }` starts the highlight at that simulated moment. */
  highlight?: boolean | { from: AnchorSpec };
  dimOthers?: boolean;
  /** Variant ids to show side by side; defaults to the story's `compare`. */
  compare?: string[];
  /** sim: a full-frame illustrated shot instead of side-by-side panels. */
  shot?: ShotSpec;
  /** poll: seconds of countdown after the narration. */
  countdown?: number;
  /** chart: animate bars in (default true). */
  reveal?: boolean;
  /** chart: metric keys to emphasise. */
  emphasis?: string[];
}

export interface VoiceSpec {
  /** "kokoro" (local open-source TTS), "files" (your own recordings), or "none" (silent, estimated timing). */
  provider: string;
  voice?: string;
  model?: string;
  speed?: number;
  /** Speech-only replacements, e.g. { "Poisson": "[Poisson](/pwɑsˈɔn/)" } (Kokoro/misaki phoneme markup). */
  lexicon?: Record<string, string>;
  /** Silence between clips of the same chapter (seconds). */
  gap?: number;
}

export interface SoundSpec {
  /** Synthesised effects from simulation events. Off unless enabled. */
  sfx?: boolean;
  /** Background music file (relative to the project root). Off unless set. */
  music?: string | null;
  /** Linear gain for music (default 0.18); ducked further under narration. */
  musicVolume?: number;
}

export interface StorySpec {
  name: string;
  experiment: string;
  title: string;
  language?: Language;
  /** Path (relative to the project root) of the experiment config JSON. */
  config?: string;
  /** Merged over the config file — handy for story-specific tweaks. */
  configOverrides?: Record<string, unknown>;
  seed: number;
  compare: string[];
  focus?: unknown;
  batch?: { runs: number; seedStart?: number };
  video?: { width?: number; height?: number; fps?: number };
  voice?: VoiceSpec;
  sound?: SoundSpec;
  showIds?: boolean;
  chapters: ChapterSpec[];
}

/** One sentence/clause of narration = one audio file = one caption. */
export interface NarrationClip {
  id: string;
  chapterId: string;
  index: number;
  /** Text sent to the TTS (spoken number forms, lexicon applied). */
  speech: string;
  /** Text shown as the caption (the original narration with display number forms). */
  caption: string;
  /** Voice-cache key: depends on speech text and every voice setting. */
  key: string;
}

export interface ClipTiming {
  duration: number;
  /** True when no audio exists and the duration is a reading-speed estimate. */
  estimated: boolean;
}

/** Returns the audio duration of a clip, or null if it has not been generated. */
export type ClipLookup = (clip: NarrationClip) => number | null;

export interface TimedClip extends NarrationClip, ClipTiming {
  /** Whole-video time. */
  start: number;
  end: number;
  /** Time within the chapter. */
  localStart: number;
}

export interface TimedCaption {
  start: number;
  end: number;
  text: string;
}

export interface TimelineChapter {
  spec: ChapterSpec;
  index: number;
  start: number;
  end: number;
  simFrom: number;
  simTo: number;
  /** Chapter-local window in which simulated time advances (empty when frozen). */
  playStart: number;
  playEnd: number;
  compare: string[];
  clips: TimedClip[];
  captions: TimedCaption[];
  /** Simulated time from which the focus entity is highlighted (null = no highlight). */
  highlightFrom: number | null;
  /** poll: chapter-local countdown window. */
  countdownStart: number;
  title?: string;
  subtitle?: string;
  heading?: string;
  bullets: string[];
  callout?: string;
}

export interface TimelinePosition {
  chapter: TimelineChapter;
  /** Seconds since the chapter started. */
  local: number;
  /** 0..1 through the chapter. */
  progress: number;
  simTime: number;
  /** Simulated seconds per video second right now (0 while paused on a frame). */
  speed: number;
}

export interface Timeline {
  duration: number;
  chapters: TimelineChapter[];
  clips: TimedClip[];
  captions: TimedCaption[];
  /** True if any clip duration is an estimate (no audio). */
  estimated: boolean;
  at(videoTime: number): TimelinePosition;
  /** Inverse mapping inside one chapter: when (video time) does simulated time t appear? */
  videoTimeOf(chapter: TimelineChapter, simTime: number): number | null;
}

export interface TimelineInputs {
  anchors: Record<string, number>;
  /** Display text for {{vars}}. */
  vars: Record<string, string>;
  /** Spoken overrides (e.g. durations as words) used for the TTS text. */
  spokenVars: Record<string, string>;
  /** Numbers for `when`/`unless` conditions. */
  values: Record<string, number>;
  lookup?: ClipLookup;
}

export { fillTemplate } from "./narration.ts";

const CHAPTER_KINDS: ChapterKind[] = ["title", "cards", "poll", "sim", "chart"];
export const DEFAULT_VOICE: VoiceSpec = { provider: "none", gap: 0.25 };

function fail(message: string): never {
  throw new Error(`Invalid story: ${message}`);
}

/** Structural validation with messages that point at the offending field. */
export function parseStory(raw: unknown): StorySpec {
  if (!raw || typeof raw !== "object") fail("expected a JSON object");
  const story = raw as Record<string, unknown>;
  for (const key of ["name", "experiment", "title"]) {
    if (typeof story[key] !== "string" || !story[key]) fail(`"${key}" must be a non-empty string`);
  }
  if (!Number.isInteger(story.seed)) fail(`"seed" must be an integer`);
  if (!Array.isArray(story.compare) || story.compare.length === 0) fail(`"compare" must list at least one variant id`);
  if (!Array.isArray(story.chapters) || story.chapters.length === 0) fail(`"chapters" must be a non-empty array`);
  if (story.language !== undefined && story.language !== "en" && story.language !== "zh") fail(`"language" must be "en" or "zh"`);
  const ids = new Set<string>();
  story.chapters.forEach((chapter: Record<string, unknown>, i: number) => {
    const where = `chapters[${i}]`;
    if (typeof chapter.id !== "string" || !/^[\w-]+$/.test(chapter.id)) fail(`${where}.id must be letters, digits, - or _`);
    if (ids.has(chapter.id)) fail(`${where}.id "${chapter.id}" is duplicated`);
    ids.add(chapter.id);
    if (!CHAPTER_KINDS.includes(chapter.kind as ChapterKind)) fail(`${where}.kind must be one of ${CHAPTER_KINDS.join(", ")}`);
    const sim = chapter.sim as SimSpec | undefined;
    const hasLength = chapter.narration !== undefined || (typeof chapter.duration === "number" && chapter.duration > 0) || (chapter.kind === "sim" && (sim?.speed ?? 0) > 0);
    if (!hasLength) fail(`${where} needs "narration", a positive "duration", or (sim) a "speed"`);
    if (sim?.play === "after" && !((sim.speed ?? 0) > 0)) fail(`${where}.sim.play "after" needs a positive sim.speed`);
  });
  if (story.batch !== undefined) {
    const batch = story.batch as Record<string, unknown>;
    if (!Number.isInteger(batch.runs) || (batch.runs as number) < 1) fail(`"batch.runs" must be a positive integer`);
  }
  return story as unknown as StorySpec;
}

export function resolveAnchor(spec: AnchorSpec, anchors: Record<string, number>, where: string): number {
  if (typeof spec === "number") return spec;
  const name = typeof spec === "string" ? spec : spec.anchor;
  const value = anchors[name];
  if (value === undefined) throw new Error(`Unknown anchor "${name}" in ${where}. Available: ${Object.keys(anchors).join(", ")}`);
  if (typeof spec === "string") return value;
  return value * (spec.scale ?? 1) + (spec.offset ?? 0);
}

/** All narration clips of a story with their texts and cache keys — no timing yet. */
export function narrationClips(story: StorySpec, inputs: Pick<TimelineInputs, "vars" | "spokenVars" | "values">): Map<string, NarrationClip[]> {
  const voice = { ...DEFAULT_VOICE, ...story.voice };
  const language = story.language ?? "en";
  const speechVars = { ...inputs.vars, ...inputs.spokenVars };
  const result = new Map<string, NarrationClip[]>();
  for (const chapter of story.chapters) {
    const where = `chapter "${chapter.id}"`;
    if (!conditionHolds(chapter, inputs.values, where)) continue;
    const clips: NarrationClip[] = [];
    for (const item of selectItems(chapter.narration, inputs.values, `${where} narration`)) {
      const pieces = splitIntoClips(item.text, (text) => fillTemplate(text, inputs.vars, where), where);
      if (item.caption !== undefined && pieces.length !== 1) {
        throw new Error(`${where}: a "caption" override needs its narration item to be a single clip, but it splits into ${pieces.length}`);
      }
      for (const piece of pieces) {
        const speech = applyLexicon(fillTemplate(piece, speechVars, where), voice.lexicon);
        const caption = fillTemplate(item.caption ?? piece, inputs.vars, where);
        const key = hashKey(JSON.stringify([voice.provider, voice.voice ?? "", voice.model ?? "", voice.speed ?? 1, language, speech]));
        clips.push({ id: `${chapter.id}-${clips.length + 1}`, chapterId: chapter.id, index: clips.length, speech, caption, key });
      }
    }
    result.set(chapter.id, clips);
  }
  return result;
}

export function buildTimeline(story: StorySpec, inputs: TimelineInputs): Timeline {
  const { anchors, vars, values } = inputs;
  const end = anchors.end ?? 0;
  const language = story.language ?? "en";
  const voice = { ...DEFAULT_VOICE, ...story.voice };
  const gap = voice.gap ?? 0.25;
  const clipsByChapter = narrationClips(story, inputs);
  const clampSim = (value: number) => Math.min(Math.max(value, 0), end);
  // Clips and chapters start on whole video frames: audio can only be placed at a frame in the
  // video composition, and every caption change lands exactly on a frame. Each start moves later
  // by less than one frame; nothing accumulates.
  const fps = story.video?.fps ?? 30;
  const toFrame = (seconds: number) => Math.ceil(seconds * fps - 1e-6) / fps;
  const chapters: TimelineChapter[] = [];
  let videoCursor = 0;
  let simCursor = 0;

  story.chapters.forEach((spec) => {
    const where = `chapter "${spec.id}"`;
    if (!conditionHolds(spec, values, where)) return;
    const narrated = clipsByChapter.get(spec.id) ?? [];
    const pauseBefore = spec.pauseBefore ?? (narrated.length ? 0.2 : 0);
    const pauseAfter = spec.pauseAfter ?? (narrated.length ? 0.45 : 0);

    // Lay clips out back to back; real audio durations when available, flagged estimates otherwise.
    let cursor = pauseBefore;
    const timedLocal = narrated.map((clip, i) => {
      const actual = inputs.lookup?.(clip) ?? null;
      const duration = actual ?? estimateSpeechSeconds(clip.speech, language);
      const localStart = toFrame(cursor);
      cursor = localStart;
      cursor += duration + (i < narrated.length - 1 ? gap : 0);
      return { ...clip, duration, estimated: actual === null, localStart };
    });
    const narrationEnd = cursor;

    let simFrom: number;
    let simTo: number;
    const sim = spec.sim;
    if (sim?.at !== undefined) {
      simFrom = simTo = clampSim(resolveAnchor(sim.at, anchors, where));
    } else if (spec.kind === "sim") {
      simFrom = sim?.from !== undefined ? clampSim(resolveAnchor(sim.from, anchors, where)) : simCursor;
      simTo = sim?.to !== undefined ? clampSim(resolveAnchor(sim.to, anchors, where)) : end;
      // Anchors depend on the run (seed/config); never let a chapter run backwards.
      if (simTo < simFrom) simTo = simFrom;
    } else {
      // Non-sim chapters freeze on wherever the previous chapter left off.
      simFrom = simTo = simCursor;
    }
    const range = simTo - simFrom;

    let duration = Math.max(narrated.length ? narrationEnd + pauseAfter : 0, spec.duration ?? 0);
    let playStart = 0;
    let playEnd = 0;
    let countdownStart = 0;
    if (spec.kind === "poll") {
      countdownStart = narrationEnd;
      duration = Math.max(duration, narrationEnd + (spec.countdown ?? 3) + pauseAfter);
    }
    if (range > 0) {
      if (sim?.play === "after") {
        playStart = narrationEnd;
        playEnd = playStart + range / sim.speed!;
        duration = Math.max(duration, playEnd + pauseAfter);
      } else if (sim?.speed) {
        playEnd = range / sim.speed;
        duration = Math.max(duration, playEnd);
      } else {
        playEnd = duration;
      }
    }
    if (!(duration > 0)) throw new Error(`${where} ends up with zero length`);
    duration = toFrame(duration);

    const start = videoCursor;
    const clips: TimedClip[] = timedLocal.map((clip) => ({ ...clip, start: start + clip.localStart, end: start + clip.localStart + clip.duration }));
    // A caption stays up through the short gap after its clip so text doesn't flicker between sentences.
    const captions = clips.map((clip, i) => ({
      start: clip.start,
      end: Math.min(clip.end + (i < clips.length - 1 ? gap : Math.min(pauseAfter, 0.4)), start + duration),
      text: clip.caption,
    }));
    const fill = (text: string | undefined, field: string) => (text === undefined ? undefined : fillTemplate(text, vars, `${where} ${field}`));
    const highlight = spec.highlight;
    chapters.push({
      spec,
      index: chapters.length,
      start,
      end: start + duration,
      simFrom,
      simTo,
      playStart,
      playEnd,
      compare: spec.compare ?? story.compare,
      clips,
      captions,
      highlightFrom: highlight === true ? -Infinity : highlight ? resolveAnchor(highlight.from, anchors, `${where} highlight`) : null,
      countdownStart,
      title: fill(spec.title, "title"),
      subtitle: fill(spec.subtitle, "subtitle"),
      heading: fill(spec.heading, "heading"),
      bullets: selectItems(spec.bullets, values, `${where} bullets`).map((item, i) => fillTemplate(item.text, vars, `${where} bullet ${i + 1}`)),
      callout: fill(spec.callout, "callout"),
    });
    videoCursor = start + duration;
    simCursor = simTo;
  });

  if (chapters.length === 0) throw new Error("Invalid story: every chapter was excluded by its condition");
  const duration = videoCursor;
  const clips = chapters.flatMap((chapter) => chapter.clips);

  return {
    duration,
    chapters,
    clips,
    captions: chapters.flatMap((chapter) => chapter.captions),
    estimated: clips.some((clip) => clip.estimated),
    at(videoTime: number): TimelinePosition {
      const time = Math.min(Math.max(videoTime, 0), duration);
      // Chapters are few; a linear scan is clearer than a binary search here.
      const chapter = chapters.find((candidate) => time < candidate.end) ?? chapters[chapters.length - 1];
      const length = chapter.end - chapter.start;
      const local = time - chapter.start;
      const playLength = chapter.playEnd - chapter.playStart;
      let simTime = chapter.simFrom;
      let speed = 0;
      if (playLength > 0) {
        const amount = Math.min(Math.max((local - chapter.playStart) / playLength, 0), 1);
        simTime = chapter.simFrom + (chapter.simTo - chapter.simFrom) * amount;
        if (local >= chapter.playStart && local < chapter.playEnd) speed = (chapter.simTo - chapter.simFrom) / playLength;
      }
      return { chapter, local, progress: length > 0 ? Math.min(local / length, 1) : 1, simTime, speed };
    },
    videoTimeOf(chapter, simTime) {
      const playLength = chapter.playEnd - chapter.playStart;
      const range = chapter.simTo - chapter.simFrom;
      if (!(playLength > 0) || simTime < chapter.simFrom || simTime >= chapter.simTo) return null;
      return chapter.start + chapter.playStart + ((simTime - chapter.simFrom) / range) * playLength;
    },
  };
}

export function toSrt(captions: TimedCaption[]): string {
  return captions
    .filter((caption) => caption.end > caption.start && caption.text.trim())
    .map((caption, i) => `${i + 1}\n${formatSrtTime(caption.start)} --> ${formatSrtTime(caption.end)}\n${caption.text}\n`)
    .join("\n");
}

export function toVtt(captions: TimedCaption[]): string {
  const vttTime = (seconds: number) => formatSrtTime(seconds).replace(",", ".");
  const cues = captions
    .filter((caption) => caption.end > caption.start && caption.text.trim())
    .map((caption) => `${vttTime(caption.start)} --> ${vttTime(caption.end)}\n${caption.text}\n`);
  return `WEBVTT\n\n${cues.join("\n")}`;
}

/** 62.35 -> "1:02.4" — compact time for human-readable scripts. */
function shortTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds - minutes * 60).toFixed(1).padStart(4, "0")}`;
}

/** Narration script for review or recording, with each clip's time slot. */
export function toNarrationScript(story: StorySpec, timeline: Timeline): string {
  const lines = [`# ${story.title}`, "", `Total length: ${timeline.duration.toFixed(1)} s${timeline.estimated ? " (contains estimated clip lengths — no audio yet)" : ""}`, ""];
  for (const chapter of timeline.chapters) {
    lines.push(`## ${shortTime(chapter.start)} · ${chapter.spec.id} (${chapter.spec.kind}, ${(chapter.end - chapter.start).toFixed(1)} s)`, "");
    if (chapter.clips.length === 0) lines.push("(no narration)", "");
    for (const clip of chapter.clips) {
      lines.push(`- \`${clip.id}\` ${shortTime(clip.start)}–${shortTime(clip.end)}${clip.estimated ? " (estimated)" : ""}: ${clip.caption}`);
      if (clip.speech !== clip.caption) lines.push(`  - spoken as: ${clip.speech}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

/** Machine-readable timeline: whole-video time, chapter-local time and simulated time side by side. */
export function toTimelineJson(story: StorySpec, timeline: Timeline) {
  return {
    story: story.name,
    duration: timeline.duration,
    estimated: timeline.estimated,
    units: { start: "whole-video seconds", localStart: "seconds within the chapter", sim: "simulated seconds" },
    chapters: timeline.chapters.map((chapter) => ({
      id: chapter.spec.id,
      kind: chapter.spec.kind,
      start: round(chapter.start),
      end: round(chapter.end),
      sim: {
        from: round(chapter.simFrom),
        to: round(chapter.simTo),
        playLocal: chapter.playEnd > chapter.playStart ? [round(chapter.playStart), round(chapter.playEnd)] : null,
        speed: chapter.playEnd > chapter.playStart ? round((chapter.simTo - chapter.simFrom) / (chapter.playEnd - chapter.playStart)) : 0,
        highlightFrom: chapter.highlightFrom === null ? null : Number.isFinite(chapter.highlightFrom) ? round(chapter.highlightFrom) : "always",
      },
      clips: chapter.clips.map((clip) => ({
        id: clip.id,
        key: clip.key,
        start: round(clip.start),
        end: round(clip.end),
        localStart: round(clip.localStart),
        duration: round(clip.duration),
        estimated: clip.estimated,
        caption: clip.caption,
        speech: clip.speech,
      })),
    })),
  };
}

const round = (value: number) => Math.round(value * 1000) / 1000;
