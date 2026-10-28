// The contract every experiment module implements. Everything outside src/experiments/
// (story timeline, preview UI, captions, export) only talks to experiments through this.

import type { Timeline, StorySpec } from "./story.ts";
import type { BatchResult } from "./batch.ts";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MetricDef {
  key: string;
  label: string;
  definition: string;
  unit: "seconds" | "ratio" | "count";
}

export interface VariantInfo {
  id: string;
  /** Long name for titles, e.g. "A · One shared line". */
  label: string;
  /** Short tag for charts, e.g. "A". */
  short: string;
  /** Rule name shown next to its badge, e.g. "One line". Falls back to `label`. */
  name?: string;
  description: string;
  color: string;
}

/** A form field the preview UI renders generically; `path` is a dot path into the config. */
export interface ControlSpec {
  path: string;
  label: string;
  type: "number" | "select" | "text";
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  help?: string;
}

/** One entity the story wants viewers to follow across all panels. */
export interface Focus {
  entityId: number;
  label: string;
}

export interface PanelOptions {
  /** The highlighted entity, or null when the chapter (or the current moment) has no highlight. */
  focus: Focus | null;
  /** Fade everything except the focused entity. */
  dimOthers: boolean;
  showIds: boolean;
  /** How long (in simulated seconds) a position change takes to animate. Purely visual. */
  tweenSeconds: number;
}

export interface Scene<C = unknown, I = unknown, R = unknown> {
  experiment: Experiment<C, I, R>;
  config: C;
  seed: number;
  input: I;
  /** One run per variant, all from the same input. */
  runs: Record<string, R>;
  metrics: Record<string, Record<string, number>>;
  /** Multi-seed statistics, if the story asked for them. Never mixed up with `metrics` (one seed). */
  batch: BatchResult | null;
  story: StorySpec;
  focus: Focus | null;
  anchors: Record<string, number>;
  timeline: Timeline;
  /** Display strings for {{vars}} in story text. */
  vars: Record<string, string>;
  /** Spoken forms used in the narration sent to TTS (e.g. "8 minutes 12 seconds" for "8:12"). */
  spokenVars: Record<string, string>;
  /** Numbers for `when`/`unless` conditions in stories. */
  values: Record<string, number>;
  /** Scratch space for presenters to memoise derived visual data. */
  cache: Map<string, unknown>;
}

/** A camera shot a story can ask for, e.g. { "type": "lane", "variant": "single", "window": 0 }. */
/** A number card in a shot (values are defined by the experiment, e.g. "served"). */
export interface ShotCard {
  value: string;
  label?: string;
  /** Which half of a split shot shows it (default both). */
  side?: "left" | "right" | "both";
  /** Appear when this narration clip of the chapter starts — or when it reaches `word`. */
  at?: { clip: number; word?: string };
  /** S: label and value side by side (44 px); M: value 64 px; L: value 96 px. */
  size?: "S" | "M" | "L";
}

export interface ShotSpec {
  type: string;
  variant?: string;
  window?: number;
  title?: string;
  /** split: what each half shows ("wide" or "close"). */
  view?: string;
  /** Camera move at the start of the chapter: "open" (split opens), "push" (wide → close-up), "pull" (close-up → wide). */
  enter?: string;
  cards?: ShotCard[];
}

export interface ShotOptions extends PanelOptions {
  /** Simulated seconds per video second right now (0 when frozen). Motion durations are set in video time. */
  speed: number;
  /** Simulated time for on-screen numbers, sampled at most `motion.numberRate` times per second. */
  labelSimTime: number;
  videoTime: number;
  /** Seconds since the chapter started. */
  chapterTime: number;
  /** The chapter's narration clips, chapter-local, for overlays timed to what is said. */
  clips: { start: number; duration: number; text: string }[];
  /** The chapter's callout with variables filled in. */
  callout?: string;
  /** Chapter-local video time at which the simulation reaches `simTime` (for overlays tied to sim moments). */
  localTimeOf(simTime: number): number;
}

export interface ResultsOptions {
  /** Metric keys to emphasise (others are dimmed). */
  emphasis: string[];
}

/** A sound effect tied to a simulated moment in one variant's run. */
export interface SoundCue {
  simTime: number;
  cue: "ding" | "chime" | "whoosh" | "pop" | "tick";
  /** Pitch multiplier (1 = base). */
  pitch?: number;
  gain?: number;
}

export interface ExperimentMeta {
  title: string;
  summary: string;
  assumptions: string[];
  metrics: MetricDef[];
  /** Metric used to count "wins" in batch runs. */
  primaryMetric: string;
  lowerIsBetter: boolean;
}

export interface Experiment<C = unknown, I = unknown, R = unknown> {
  id: string;
  meta: ExperimentMeta;
  variants: VariantInfo[];
  defaultConfig: C;
  controls: ControlSpec[];

  /** Validate and fill defaults; throw an Error with a readable message on bad input. */
  parseConfig(raw: unknown): C;
  /** Everything random about the world is decided here, once, shared by every variant. */
  generateInput(config: C, seed: number): I;
  /** Deterministic: same input + config + variant => identical run. */
  simulate(input: I, config: C, variantId: string): R;
  /** Simulated time when the run is over. */
  endTime(run: R): number;
  metrics(run: R): Record<string, number>;
  /** Per-entity rows (written to CSV). */
  records(run: R): Record<string, string | number | boolean | null>[];
  /** Event log (written to JSON); enough to rebuild any state. */
  events(run: R): unknown[];

  // Story hooks: let story JSON refer to moments and numbers without hard-coding them.
  anchors(scene: Scene<C, I, R>): Record<string, number>;
  templateVars(scene: Scene<C, I, R>): Record<string, string>;
  /** Spoken forms for vars whose display form reads badly aloud (durations, ids). */
  spokenVars?(scene: Scene<C, I, R>): Record<string, string>;
  /** Extra numbers for story conditions (core already provides every metric per variant). */
  templateValues?(scene: Scene<C, I, R>): Record<string, number>;
  /** Optional sound effects for one variant's run (used only when a story enables sfx). */
  soundCues?(scene: Scene<C, I, R>, variantId: string): SoundCue[];
  resolveFocus(scene: Scene<C, I, R>, spec: unknown): Focus | null;

  // Presentation: pure functions of (scene, simTime) so seeking and export are exact.
  drawPanel(
    ctx: CanvasRenderingContext2D,
    scene: Scene<C, I, R>,
    variantId: string,
    simTime: number,
    rect: Rect,
    options: PanelOptions,
  ): void;
  drawResults(ctx: CanvasRenderingContext2D, scene: Scene<C, I, R>, rect: Rect, progress: number, options: ResultsOptions): void;
  /** Optional full-frame illustrated shots (close-ups, wide store views). */
  drawShot?(ctx: CanvasRenderingContext2D, scene: Scene<C, I, R>, shot: ShotSpec, simTime: number, rect: Rect, options: ShotOptions): void;
}

// Registry entries erase the generic parameters; each module stays fully typed internally.
export type AnyExperiment = Experiment<any, any, any>;
