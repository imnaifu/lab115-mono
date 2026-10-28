// Scene = everything one video (or preview) needs: config, the shared input, one run per
// variant, optional multi-seed batch stats, and the resolved, narration-driven timeline.
// Built identically in Node (CLI) and the browser (preview/export page).

import { runBatch } from "./batch.ts";
import type { AnyExperiment, MetricDef, Scene } from "./experiment.ts";
import { formatDuration, formatPercent } from "./format.ts";
import { type Language, spokenDuration } from "./narration.ts";
import { buildTimeline, type ClipLookup, parseStory, type StorySpec } from "./story.ts";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Recursive merge for config objects; arrays and scalars in `patch` replace the base value. */
export function mergeConfig(base: unknown, patch: unknown): unknown {
  if (!isPlainObject(base) || !isPlainObject(patch)) return patch === undefined ? base : patch;
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) merged[key] = mergeConfig(base[key], value);
  return merged;
}

export function formatMetric(def: MetricDef | undefined, value: number): string {
  if (!def) return String(value);
  if (def.unit === "seconds") return formatDuration(value);
  if (def.unit === "ratio") return formatPercent(value);
  return String(Math.round(value));
}

/** How a metric should be read aloud; only durations differ from the display form. */
export function spokenMetric(def: MetricDef | undefined, value: number, language: Language): string | null {
  if (def?.unit === "seconds") return spokenDuration(value, language);
  if (def?.unit === "ratio") return language === "zh" ? `百分之${Math.round(value * 100)}` : `${Math.round(value * 100)} percent`;
  return null;
}

export interface SceneOptions {
  /** Overrides story.seed (e.g. from a CLI flag or the preview UI). */
  seed?: number;
  /** Overrides story.batch.runs; 0 disables the batch. */
  batchRuns?: number;
  /** Audio duration of each narration clip, if generated; missing clips get flagged estimates. */
  lookup?: ClipLookup;
}

export function buildScene(experiment: AnyExperiment, rawConfig: unknown, rawStory: unknown, options: SceneOptions = {}): Scene {
  const story: StorySpec = parseStory(rawStory);
  if (story.experiment !== experiment.id) {
    throw new Error(`Story "${story.name}" is for experiment "${story.experiment}", not "${experiment.id}"`);
  }
  const variantIds = experiment.variants.map((variant) => variant.id);
  for (const id of story.compare) {
    if (!variantIds.includes(id)) throw new Error(`Story compares unknown variant "${id}". Known: ${variantIds.join(", ")}`);
  }
  for (const chapter of story.chapters) {
    for (const id of chapter.compare ?? []) {
      if (!variantIds.includes(id)) throw new Error(`Chapter "${chapter.id}" compares unknown variant "${id}"`);
    }
  }

  const config = experiment.parseConfig(mergeConfig(rawConfig, story.configOverrides ?? {}));
  const seed = options.seed ?? story.seed;
  const input = experiment.generateInput(config, seed);
  // Every variant is simulated (not only the compared pair) so result charts can show them all.
  const runs = Object.fromEntries(variantIds.map((id) => [id, experiment.simulate(input, config, id)]));
  const metrics = Object.fromEntries(variantIds.map((id) => [id, experiment.metrics(runs[id])]));

  const batchRuns = options.batchRuns ?? story.batch?.runs ?? 0;
  const batch = batchRuns > 0 ? runBatch(experiment, config, { runs: batchRuns, seedStart: story.batch?.seedStart ?? 1 }) : null;

  const scene: Scene = {
    experiment,
    config,
    seed,
    input,
    runs,
    metrics,
    batch,
    story,
    focus: null,
    anchors: {},
    timeline: undefined as never,
    vars: {},
    spokenVars: {},
    values: {},
    cache: new Map(),
  };

  scene.focus = story.focus !== undefined ? experiment.resolveFocus(scene, story.focus) : null;
  const compared = new Set([...story.compare, ...story.chapters.flatMap((chapter) => chapter.compare ?? [])]);
  scene.anchors = {
    start: 0,
    end: Math.max(...[...compared].map((id) => experiment.endTime(runs[id]))),
    ...experiment.anchors(scene),
  };
  const core = coreTemplateData(scene);
  scene.vars = { ...core.vars, ...experiment.templateVars(scene) };
  scene.spokenVars = { ...core.spoken, ...experiment.spokenVars?.(scene) };
  scene.values = { ...core.values, ...experiment.templateValues?.(scene) };
  aliasLeftRight(story.compare, scene.vars);
  aliasLeftRight(story.compare, scene.spokenVars);
  aliasLeftRight(story.compare, scene.values);
  scene.timeline = buildTimeline(story, { anchors: scene.anchors, vars: scene.vars, spokenVars: scene.spokenVars, values: scene.values, lookup: options.lookup });
  return scene;
}

/** `left.x` / `right.x` (and `batch.left.x`…) follow the story's main comparison. */
function aliasLeftRight<T>(compare: string[], table: Record<string, T>) {
  const aliases = ["left", "right"];
  compare.slice(0, 2).forEach((variantId, i) => {
    for (const [key, value] of Object.entries(table)) {
      if (key.startsWith(`${variantId}.`)) table[`${aliases[i]}.${key.slice(variantId.length + 1)}`] = value;
      if (key.startsWith(`batch.${variantId}.`)) table[`batch.${aliases[i]}.${key.slice(`batch.${variantId}.`.length)}`] = value;
    }
  });
}

/** Template data every experiment gets for free, derived from its metric definitions. */
function coreTemplateData(scene: Scene) {
  const { experiment, metrics, batch, story } = scene;
  const language = story.language ?? "en";
  const defs = new Map(experiment.meta.metrics.map((def) => [def.key, def]));
  const vars: Record<string, string> = { seed: String(scene.seed), title: story.title };
  const spoken: Record<string, string> = {};
  const values: Record<string, number> = {};
  const { primaryMetric, lowerIsBetter } = experiment.meta;
  const better = (left: number, right: number) => (lowerIsBetter ? left < right : left > right);
  const put = (key: string, def: MetricDef | undefined, value: number) => {
    vars[key] = formatMetric(def, value);
    values[key] = value;
    const asSpoken = spokenMetric(def, value, language);
    if (asSpoken !== null) spoken[key] = asSpoken;
  };

  for (const variant of experiment.variants) {
    vars[`${variant.id}.label`] = variant.label;
    vars[`${variant.id}.short`] = variant.short;
    for (const [key, value] of Object.entries(metrics[variant.id])) put(`${variant.id}.${key}`, defs.get(key), value);
    if (batch?.summary[variant.id]) {
      for (const [key, summary] of Object.entries(batch.summary[variant.id])) put(`batch.${variant.id}.${key}`, defs.get(key), summary.mean);
      vars[`batch.${variant.id}.wins`] = String(batch.wins[variant.id]);
      values[`batch.${variant.id}.wins`] = batch.wins[variant.id];
    }
  }

  // "best"/"worst" are computed, never assumed — the story text must not presuppose a winner.
  const ranked = [...experiment.variants].sort((left, right) => (better(metrics[left.id][primaryMetric], metrics[right.id][primaryMetric]) ? -1 : 1));
  for (const [alias, variant] of [["best", ranked[0]], ["worst", ranked[ranked.length - 1]]] as const) {
    vars[`${alias}.label`] = variant.label;
    vars[`${alias}.short`] = variant.short;
    for (const [key, value] of Object.entries(metrics[variant.id])) put(`${alias}.${key}`, defs.get(key), value);
  }

  if (batch) {
    vars["batch.runs"] = String(batch.seeds.length);
    values["batch.runs"] = batch.seeds.length;
    vars["batch.seedStart"] = String(batch.seeds[0]);
    vars["batch.seedEnd"] = String(batch.seeds[batch.seeds.length - 1]);
    const batchRanked = [...experiment.variants].sort((left, right) =>
      better(batch.summary[left.id][primaryMetric].mean, batch.summary[right.id][primaryMetric].mean) ? -1 : 1,
    );
    vars["batch.best.label"] = batchRanked[0].label;
    vars["batch.best.short"] = batchRanked[0].short;
    vars["batch.best.wins"] = String(batch.wins[batchRanked[0].id]);
    values["batch.best.wins"] = batch.wins[batchRanked[0].id];
  }
  return { vars, spoken, values };
}
