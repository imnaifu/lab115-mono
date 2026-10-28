// Wide shot (design boards 01a and S05/S07): every window in a right-hand column, one line per
// window (rules B, C) or one snake-shaped shared line between stanchion belts (rule A). Full width
// for a single rule, half width inside a split screen. People keep their size in a crowd; lines
// longer than the drawn places end in a "+n" pill.

import type { Rect, Scene, ShotOptions, ShotSpec } from "../../core/experiment.ts";
import { assets } from "../../assets/library.ts";
import { drawCharacter, drawProp } from "../../render/illustration.ts";
import { frame, meaning, palette, shape, space } from "../../style/channel.ts";
import type { QueueConfig } from "./config.ts";
import { drawCrowd } from "./crowd.ts";
import { designScale, WIDE, type WideLayout, wideBaselines, widePlan } from "./floor.ts";
import type { QueueInput } from "./input.ts";
import { drawRuleHeader, drawSimClock, type SceneOptions } from "./lane.ts";
import { floorState } from "./laneMotion.ts";
import type { QueueRun } from "./simulate.ts";

type QueueScene = Scene<QueueConfig, QueueInput, QueueRun>;

export function drawWideScene(ctx: CanvasRenderingContext2D, scene: QueueScene, run: QueueRun, rect: Rect, layout: WideLayout, t: number, options: SceneOptions, background = true) {
  const { scale, x, y } = designScale(rect);
  const shared = run.laneCount === 1;
  const plan = widePlan(rect, layout, run.windows, shared);
  const baselines = wideBaselines(layout, run.windows);
  const library = assets();

  if (background) {
    ctx.fillStyle = meaning.background;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }

  // Floor hairlines: along each line (rules B/C), or just at the windows (rule A).
  const counter = layout.counter;
  ctx.fillStyle = palette.line;
  for (const baseline of baselines) {
    const from = shared ? layout.serviceX - layout.snake.spacing : layout.floorLeft;
    ctx.fillRect(x(from), y(baseline) - 1.5 * scale, (counter.left + counter.width - from) * scale, shape.stroke * scale);
  }
  if (shared) drawBelts(ctx, layout, x, y, scale);

  if (layout === WIDE.full) {
    // Entrance and a basket stack on the left wall.
    const doorBottom = layout.bottom;
    drawProp(ctx, "entrance", x(96 + 75), y(doorBottom), 445 * scale, { width: 150 * scale });
    drawProp(ctx, "basket", x(250 + 35), y(doorBottom), 55 * scale, { width: 70 * scale });
  }

  // Counters with their window numbers; cashiers beside (full) or peeking over (half) them.
  const cashier = library.roleAll("cashier")[0] ?? null;
  baselines.forEach((baseline, window) => {
    const behind = layout === WIDE.half;
    if (behind) drawCharacter(ctx, { x: x(layout.cashierX), y: y(baseline), height: layout.personHeight * scale, facing: "left", asset: cashier });
    drawProp(ctx, "checkout-counter", x(counter.left + counter.width / 2), y(baseline), counter.height * scale, { width: counter.width * scale, number: String(window + 1), numberSize: layout.numberSize * scale });
    if (!behind) drawCharacter(ctx, { x: x(layout.cashierX), y: y(baseline), height: layout.personHeight * scale, facing: "left", asset: cashier });
  });

  const poses = floorState(run, plan, t, options.speed, () => true);
  drawCrowd(ctx, run, plan, poses, {
    focusId: options.focusId,
    labelSimTime: options.labelSimTime,
    longWait: scene.config.presentation.waitRedAt / 2,
    tags: options.tags,
    tagAlpha: options.tagAlpha,
    pillLift: 0.5,
  });
}

/** Stanchion belts between the snake's rows, open at the end where the line turns. */
function drawBelts(ctx: CanvasRenderingContext2D, layout: WideLayout, x: (value: number) => number, y: (value: number) => number, scale: number) {
  const { rows, left, right } = layout.snake;
  const gap = layout.snake.spacing * 0.9;
  ctx.strokeStyle = palette.lineStrong;
  ctx.lineWidth = shape.stroke * scale;
  ctx.lineCap = "round";
  for (let i = 0; i < rows.length - 1; i++) {
    const beltY = y((rows[i] + rows[i + 1]) / 2);
    // Row i turns into row i+1 at its far end (left for even rows, right for odd ones).
    const turnsLeft = i % 2 === 0;
    ctx.beginPath();
    ctx.moveTo(x(turnsLeft ? left + gap : left - gap * 0.4), beltY);
    ctx.lineTo(x(turnsLeft ? right + gap * 0.4 : right - gap), beltY);
    ctx.stroke();
  }
}

/** Full-frame wide shot of one rule: `{ "type": "wide", "variant": "shortest" }`. */
export function drawWideShot(ctx: CanvasRenderingContext2D, scene: QueueScene, shot: ShotSpec, t: number, rect: Rect, options: ShotOptions) {
  const variantId = shot.variant ?? scene.story.compare[0];
  const run = scene.runs[variantId];
  const variant = scene.experiment.variants.find((candidate) => candidate.id === variantId)!;
  drawWideScene(ctx, scene, run, rect, WIDE.full, t, {
    speed: options.speed,
    labelSimTime: options.labelSimTime,
    focusId: options.focus?.entityId ?? null,
    tags: "compact",
  });
  drawRuleHeader(ctx, rect, variant.color, variant.short, shot.title ?? variant.name ?? variant.label);
  const { x, y, scale } = designScale(rect);
  drawSimClock(ctx, x(1920 - space.safeX), y(frame.headerTop + 8), options.labelSimTime, "right", scale);
}
