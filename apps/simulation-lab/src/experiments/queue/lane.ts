// Lane close-up (design boards 01b and S01/S06): one window and the line leading to it, side
// view, feet on one baseline at y 800. Full width shows the shop around it (entrance, shelves,
// plant); the half-width version used in split screens shows only the counter. Every position
// comes from floorState(), every number from the run. Nothing but captions goes below y 860.

import type { Rect, Scene, ShotOptions, ShotSpec } from "../../core/experiment.ts";
import { formatDuration } from "../../core/format.ts";
import { assets } from "../../assets/library.ts";
import { drawText } from "../../render/draw.ts";
import { drawCharacter, drawPill, drawProp, drawRuleBadge } from "../../render/illustration.ts";
import { frame, meaning, palette, shape, space, type } from "../../style/channel.ts";
import type { QueueConfig } from "./config.ts";
import { drawCrowd, type TagMode } from "./crowd.ts";
import { CLOSE, type CloseLayout, closePlan, designScale } from "./floor.ts";
import type { QueueInput } from "./input.ts";
import { closeUpMembers, floorState } from "./laneMotion.ts";
import type { QueueRun } from "./simulate.ts";

type QueueScene = Scene<QueueConfig, QueueInput, QueueRun>;

/** The shop around a full-width close-up (design 01b). */
const FULL_PROPS = {
  entrance: { left: 96, width: 200, height: 500 },
  shelves: [
    { left: 400, width: 480, top: 170, height: 260 },
    { left: 920, width: 420, top: 170, height: 260 },
  ],
  plant: { left: 1730, width: 94, height: 170 },
} as const;

export interface SceneOptions {
  speed: number;
  labelSimTime: number;
  focusId: number | null;
  tags: TagMode;
  tagAlpha?: number;
}

/** Background, props and shoppers of a close-up of `window` inside `rect`. */
export function drawCloseScene(ctx: CanvasRenderingContext2D, scene: QueueScene, run: QueueRun, window: number, rect: Rect, layout: CloseLayout, t: number, options: SceneOptions, background = true) {
  const { scale, x, y } = designScale(rect);
  const plan = closePlan(rect, layout, window, run.laneCount === 1);
  const library = assets();
  const baseline = y(layout.baseline);

  // Room: white wall (skipped while cross-fading with another view), one hairline for the floor.
  if (background) {
    ctx.fillStyle = meaning.background;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }
  ctx.fillStyle = palette.line;
  ctx.fillRect(x(space.safeX), baseline - 1.5 * scale, (layout.width - space.safeX * 2) * scale, shape.stroke * scale);

  if (layout === CLOSE.full) {
    const { entrance, shelves, plant } = FULL_PROPS;
    drawProp(ctx, "entrance", x(entrance.left + entrance.width / 2), baseline, entrance.height * scale, { width: entrance.width * scale });
    shelves.forEach((shelf, index) => drawProp(ctx, "shelf", x(shelf.left + shelf.width / 2), y(shelf.top + shelf.height), shelf.height * scale, { index, width: shelf.width * scale }));
    drawProp(ctx, "decor", x(plant.left + plant.width / 2), baseline, plant.height * scale, { width: plant.width * scale });
  }

  // Cashier behind the counter. Waiting shoppers stand left of the counter and leavers pass in
  // front of it, so drawing the counter before all shoppers keeps the depth right.
  const cashier = library.roleAll("cashier")[0] ?? null;
  drawCharacter(ctx, { x: x(layout.cashier.x), y: baseline, height: layout.cashier.height * scale, facing: "left", asset: cashier });
  const counter = layout.counter;
  drawProp(ctx, "checkout-counter", x(counter.left + counter.width / 2), baseline, counter.height * scale, { width: counter.width * scale, number: String(window + 1), numberSize: layout.numberSize * scale });

  const poses = floorState(run, plan, t, options.speed, closeUpMembers(run, window));
  drawCrowd(ctx, run, plan, poses, {
    focusId: options.focusId,
    labelSimTime: options.labelSimTime,
    longWait: scene.config.presentation.waitRedAt / 2,
    tags: options.tags,
    tagAlpha: options.tagAlpha,
    pillLift: 0.81,
    window,
  });
}

/** Rule badge and name at the top left of a frame or half (design: badge 64, name 44). */
export function drawRuleHeader(ctx: CanvasRenderingContext2D, rect: Rect, color: string, letter: string | null, text: string) {
  const { scale, x, y } = designScale(rect);
  const top = y(frame.headerTop + 4);
  let left = x(space.safeX);
  if (letter) {
    drawRuleBadge(ctx, left + 32 * scale, top + 32 * scale, 64 * scale, color, letter);
    left += (64 + 20) * scale;
  }
  drawText(ctx, text, left, top + 32 * scale + type.shotHeader * 0.36 * scale, { size: type.shotHeader * scale, weight: 800, color: palette.ink, display: true });
}

/**
 * Simulated clock pill (design component 7), anchored right or centred. Split screens use the
 * design's h:mm (narrow, between the two headers); single shots of short runs keep m:ss so the
 * clock visibly runs.
 */
export function drawSimClock(ctx: CanvasRenderingContext2D, x: number, top: number, simTime: number, align: "right" | "center", scale = 1, format: "m:ss" | "h:mm" = "m:ss") {
  const text = format === "h:mm" ? `${Math.floor(simTime / 3600)}:${String(Math.floor((simTime % 3600) / 60)).padStart(2, "0")}` : formatDuration(simTime);
  drawPill(ctx, x, top, text, { height: 56 * scale, size: type.callout * scale, icon: "clock", align });
}

/** Full-frame close-up of one window: `{ "type": "lane", "variant": "single", "window": 0 }`. */
export function drawLaneShot(ctx: CanvasRenderingContext2D, scene: QueueScene, shot: ShotSpec, t: number, rect: Rect, options: ShotOptions) {
  const variantId = shot.variant ?? scene.story.compare[0];
  const run = scene.runs[variantId];
  const variant = scene.experiment.variants.find((candidate) => candidate.id === variantId)!;
  const window = shot.window ?? 0;
  drawCloseScene(ctx, scene, run, window, rect, CLOSE.full, t, {
    speed: options.speed,
    labelSimTime: options.labelSimTime,
    focusId: options.focus?.entityId ?? null,
    tags: "full",
  });
  // The rule only matters with more than one window.
  const showRule = run.windows > 1;
  drawRuleHeader(ctx, rect, variant.color, showRule ? variant.short : null, shot.title ?? (showRule ? `${variant.name ?? variant.label} · window ${window + 1}` : `Checkout ${window + 1}`));
  const { x, y, scale } = designScale(rect);
  drawSimClock(ctx, x(1920 - space.safeX), y(frame.headerTop + 8), options.labelSimTime, "right", scale);
}
