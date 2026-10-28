// Minimal experiment template. Copy this folder to src/experiments/<your-id>/, rename, then
// register it in src/core/registry.ts. It is a complete, working (if dull) experiment:
// runners start at random times and cross a track; variants differ in their pacing rule.
// See docs/new-experiment.md for the walkthrough.

import type { Experiment, Focus, Scene } from "../../core/experiment.ts";
import { formatDuration } from "../../core/format.ts";
import { rngStream } from "../../core/rng.ts";
import { mergeConfig } from "../../core/scene.ts";
import { mean } from "../../core/stats.ts";
import { drawText, fillRoundRect } from "../../render/draw.ts";
import { theme } from "../../render/theme.ts";
import { seriesColors } from "../../style/channel.ts";

// 1. Config: plain JSON-able object + defaults + validation.
export interface TemplateConfig {
  runners: number;
  trackLength: number;
}
const defaultConfig: TemplateConfig = { runners: 20, trackLength: 100 };

// 2. Input: everything random, generated once per seed and shared by all variants.
interface TemplateInput {
  runners: { id: number; start: number; stamina: number }[];
}

// 3. Run: the result of one variant — enough to answer "what is the state at time t?".
interface TemplateRun {
  variant: string;
  runners: { id: number; start: number; finish: number }[];
  end: number;
}

type TemplateScene = Scene<TemplateConfig, TemplateInput, TemplateRun>;

const SPEED_RULES: Record<string, (stamina: number) => number> = {
  steady: () => 5,
  sprint: (stamina) => 3 + stamina * 4,
};

export const templateExperiment: Experiment<TemplateConfig, TemplateInput, TemplateRun> = {
  id: "template",
  meta: {
    title: "Template experiment",
    summary: "Runners cross a track; two pacing rules.",
    assumptions: ["Speed is constant per runner."],
    metrics: [{ key: "avgFinish", label: "Average finish time", unit: "seconds", definition: "Mean of finish − start." }],
    primaryMetric: "avgFinish",
    lowerIsBetter: true,
  },
  variants: [
    { id: "steady", short: "A", label: "A · Steady pace", color: seriesColors[0], description: "Everyone runs at 5 m/s." },
    { id: "sprint", short: "B", label: "B · Stamina-based", color: seriesColors[1], description: "Speed depends on stamina." },
  ],
  defaultConfig,
  controls: [
    { path: "runners", label: "Runners", type: "number", min: 1, max: 200, step: 1 },
    { path: "trackLength", label: "Track length (m)", type: "number", min: 10, step: 10 },
  ],

  parseConfig(raw) {
    const config = mergeConfig(defaultConfig, raw ?? {}) as TemplateConfig;
    if (!Number.isInteger(config.runners) || config.runners < 1) throw new Error("Invalid template config: runners must be a positive integer");
    if (!(config.trackLength > 0)) throw new Error("Invalid template config: trackLength must be > 0");
    return config;
  },

  generateInput(config, seed) {
    // Separate named streams per attribute keep inputs stable when unrelated settings change.
    const starts = rngStream(seed, "template.start");
    const stamina = rngStream(seed, "template.stamina");
    return {
      runners: Array.from({ length: config.runners }, (_, i) => ({
        id: i + 1,
        // Rounded to ms so results are bit-identical across JS engines (see queue/input.ts).
        start: Math.round(starts.uniform(0, 30) * 1000) / 1000,
        stamina: Math.round(stamina.next() * 1000) / 1000,
      })),
    };
  },

  simulate(input, config, variantId) {
    const speedOf = SPEED_RULES[variantId];
    if (!speedOf) throw new Error(`Unknown template variant "${variantId}"`);
    const runners = input.runners.map((runner) => ({ id: runner.id, start: runner.start, finish: runner.start + config.trackLength / speedOf(runner.stamina) }));
    return { variant: variantId, runners, end: Math.max(...runners.map((runner) => runner.finish)) };
  },
  endTime: (run) => run.end,
  metrics: (run) => ({ avgFinish: mean(run.runners.map((runner) => runner.finish - runner.start)) }),
  records: (run) => run.runners,
  events: (run) => run.runners.flatMap((runner) => [{ t: runner.start, type: "start", id: runner.id }, { t: runner.finish, type: "finish", id: runner.id }]).sort((left, right) => left.t - right.t),

  anchors: (scene: TemplateScene) => ({ firstFinish: Math.min(...Object.values(scene.runs).flatMap((run) => run.runners.map((runner) => runner.finish))) }),
  templateVars: (scene: TemplateScene) => ({ runners: String(scene.config.runners) }),
  resolveFocus: (_scene, spec): Focus | null => {
    const id = (spec as { id?: number })?.id;
    return typeof id === "number" ? { entityId: id, label: `#${id}` } : null;
  },

  // 4. Presentation: draw state at simTime inside rect. Pure — no state kept between calls.
  drawPanel(ctx, scene, variantId, simTime, rect, options) {
    const run = scene.runs[variantId];
    const variant = scene.experiment.variants.find((candidate) => candidate.id === variantId)!;
    fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 18, theme.panel);
    drawText(ctx, variant.label, rect.x + 24, rect.y + 50, { size: 30, weight: 700, color: theme.text });
    const rowHeight = (rect.h - 100) / run.runners.length;
    for (const [i, runner] of run.runners.entries()) {
      const progress = Math.min(1, Math.max(0, (simTime - runner.start) / (runner.finish - runner.start)));
      const x = rect.x + 40 + progress * (rect.w - 80);
      const y = rect.y + 90 + (i + 0.5) * rowHeight;
      ctx.globalAlpha = options.dimOthers && runner.id !== options.focus?.entityId ? 0.25 : 1;
      ctx.beginPath();
      ctx.arc(x, y, Math.min(10, rowHeight / 2.5), 0, Math.PI * 2);
      ctx.fillStyle = progress >= 1 ? theme.done : variant.color;
      ctx.fill();
      // Pastel fills always get the ink outline (channel style).
      ctx.strokeStyle = theme.ink;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  },
  drawResults(ctx, scene, rect, progress) {
    fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 18, theme.panel);
    scene.experiment.variants.forEach((variant, i) => {
      const value = scene.metrics[variant.id].avgFinish;
      const y = rect.y + 80 + i * 70;
      fillRoundRect(ctx, rect.x + 200, y, (value / 40) * (rect.w - 400) * progress, 40, 8, variant.color);
      ctx.strokeStyle = theme.ink;
      ctx.lineWidth = 2;
      ctx.stroke();
      drawText(ctx, `${variant.label}: ${formatDuration(value)}`, rect.x + 30, y + 28, { size: 22, weight: 600, color: theme.text });
    });
  },
};
