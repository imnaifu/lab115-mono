// A/B split screen (design S01, S05–S07): the story's two compared rules side by side, A always
// left, each half a wide shot or a close-up of the window the followed customer uses in that run.
// Shared simulated clock at the top centre, a rule header and number cards per half, one brief
// callout. Camera moves at the start of a chapter: "open" (divider draws, halves slide in),
// "push" (wide → close-up) and "pull" (close-up → wide); no new labels appear while moving.

import type { Rect, Scene, ShotCard, ShotOptions, ShotSpec } from "../../core/experiment.ts";
import { formatDuration } from "../../core/format.ts";
import { fillRoundRect, tabularWidth, drawTabular } from "../../render/draw.ts";
import { appearance, drawPill } from "../../render/illustration.ts";
import { easeInOutCubic, frame, meaning, motion, palette, shape, space, type } from "../../style/channel.ts";
import type { QueueConfig } from "./config.ts";
import { CLOSE, designScale, WIDE, wideBaselines } from "./floor.ts";
import type { QueueInput } from "./input.ts";
import { drawCloseScene, drawRuleHeader, drawSimClock, type SceneOptions } from "./lane.ts";
import type { QueueRun } from "./simulate.ts";
import { drawWideScene } from "./wide.ts";

type QueueScene = Scene<QueueConfig, QueueInput, QueueRun>;
type View = "wide" | "close";

const HALF = 960;
/** Split open: the divider draws, then both halves slide in. */
const OPEN = { divider: 0.5, slide: 0.6 };

interface CameraState {
  /** Camera still moving (no new labels). */
  moving: boolean;
  /** Video seconds since the move ended (Infinity without a move). */
  sinceEnd: number;
  /** 0 → 1 through the move, eased. */
  progress: number;
}

function cameraState(enter: string | undefined, local: number): CameraState {
  const length = enter === "open" ? OPEN.divider + OPEN.slide : enter === "push" || enter === "pull" ? motion.cameraMove : 0;
  if (length === 0) return { moving: false, sinceEnd: Infinity, progress: 1 };
  return { moving: local < length, sinceEnd: local - length, progress: easeInOutCubic(local / length) };
}

const smooth = (value: number, from: number, to: number) => Math.min(1, Math.max(0, (value - from) / (to - from)));

export function drawSplitShot(ctx: CanvasRenderingContext2D, scene: QueueScene, shot: ShotSpec, t: number, rect: Rect, options: ShotOptions) {
  const { scale, x, y } = designScale(rect);
  const view: View = shot.view === "close" ? "close" : "wide";
  const local = options.chapterTime;
  const camera = cameraState(shot.enter, local);
  const focusId = scene.focus?.entityId ?? null;
  // Labels return only after the camera has settled.
  const tagAlpha = camera.moving ? 0 : camera.sinceEnd === Infinity ? 1 : appearance(camera.sinceEnd).alpha;

  ctx.fillStyle = meaning.background;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  const ids = scene.story.compare.slice(0, 2);
  ids.forEach((variantId, side) => {
    const run = scene.runs[variantId];
    const variant = scene.experiment.variants.find((candidate) => candidate.id === variantId)!;
    const half: Rect = { x: rect.x + side * HALF * scale, y: rect.y, w: HALF * scale, h: rect.h };
    const window = focusId !== null ? run.customers[focusId - 1].window : 0;
    const sceneOptions: SceneOptions = {
      speed: options.speed,
      labelSimTime: options.labelSimTime,
      focusId: options.focus?.entityId ?? null,
      tags: camera.moving ? "none" : view === "close" ? "focusAndCounter" : "focusOnly",
      tagAlpha,
    };
    ctx.save();
    // Each half stays in its own column and out of the caption zone (camera moves scale it up).
    ctx.beginPath();
    ctx.rect(half.x, half.y, half.w, y(frame.captionTop) - half.y);
    ctx.clip();
    if (shot.enter === "open") {
      // Nothing but the divider at first, then each half slides in from its outer edge.
      const slide = easeInOutCubic(smooth(local, OPEN.divider, OPEN.divider + OPEN.slide));
      if (slide <= 0) {
        ctx.restore();
        return;
      }
      ctx.translate((side === 0 ? -1 : 1) * half.w * (1 - slide), 0);
    }
    if (camera.moving && (shot.enter === "push" || shot.enter === "pull")) {
      drawCameraMove(ctx, scene, run, window, half, t, sceneOptions, shot.enter === "push" ? camera.progress : 1 - camera.progress);
    } else if (view === "close") {
      drawCloseScene(ctx, scene, run, window, half, CLOSE.half, t, sceneOptions);
    } else {
      drawWideScene(ctx, scene, run, half, WIDE.half, t, sceneOptions);
    }
    drawRuleHeader(ctx, half, variant.color, variant.short, variant.name ?? variant.label);
    ctx.restore();
    if (!camera.moving) drawCards(ctx, scene, shot, run, side, half, view, options, camera);
  });

  // Divider: 3 px line-strong down the middle (drawn top to bottom when the split opens).
  const dividerTop = y(view === "close" ? 230 : 150);
  const dividerBottom = y(frame.contentBottom - 20);
  const grow = shot.enter === "open" ? smooth(local, 0, OPEN.divider) : 1;
  ctx.fillStyle = palette.lineStrong;
  ctx.fillRect(x(HALF) - 1.5 * scale, dividerTop, shape.stroke * scale, (dividerBottom - dividerTop) * easeInOutCubic(grow));

  if (shot.enter !== "open" || !camera.moving) drawSimClock(ctx, x(HALF), y(frame.headerTop + 8), options.labelSimTime, "center", scale, "h:mm");
  drawCallout(ctx, options.callout, x(HALF), y(146), scale, camera, local);
}

/** One half during a push (`zoom` 0 → 1) or pull (1 → 0): the wide view zooms on the window while the close-up fades in. */
function drawCameraMove(ctx: CanvasRenderingContext2D, scene: QueueScene, run: QueueRun, window: number, half: Rect, t: number, options: SceneOptions, zoom: number) {
  const { x, y } = designScale(half);
  const wide = WIDE.half;
  const close = CLOSE.half;
  const baseline = wideBaselines(wide, run.windows)[window];
  // The same spot in both compositions: just in front of this window's counter.
  const wideAnchor = { x: x(wide.serviceX - wide.spacing), y: y(baseline - wide.personHeight / 2) };
  const closeAnchor = { x: x(close.serviceX - close.spacing), y: y(close.baseline - close.personHeight / 2) };
  const ratio = close.personHeight / wide.personHeight;
  const anchor = { x: wideAnchor.x + (closeAnchor.x - wideAnchor.x) * zoom, y: wideAnchor.y + (closeAnchor.y - wideAnchor.y) * zoom };
  // Exponential zoom reads as a steady push.
  const wideScale = ratio ** zoom;
  const closeScale = wideScale / ratio;
  const layers: [number, number, { x: number; y: number }, () => void][] = [
    [1 - smooth(zoom, 0.45, 0.85), wideScale, wideAnchor, () => drawWideScene(ctx, scene, run, half, wide, t, { ...options, tags: "none" }, false)],
    [smooth(zoom, 0.45, 0.85), closeScale, closeAnchor, () => drawCloseScene(ctx, scene, run, window, half, close, t, { ...options, tags: "none" }, false)],
  ];
  for (const [alpha, factor, from, draw] of layers) {
    if (alpha <= 0) continue;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(anchor.x - from.x * factor, anchor.y - from.y * factor);
    ctx.scale(factor, factor);
    draw();
    ctx.restore();
  }
}

/** Video seconds since a card's moment came (negative before it). */
function cardSince(card: ShotCard, options: ShotOptions, camera: CameraState): number {
  const settle = (camera.sinceEnd === Infinity ? options.chapterTime : camera.sinceEnd) - motion.cutSettle;
  if (!card.at) return settle;
  const clip = options.clips[card.at.clip];
  if (!clip) return -Infinity;
  let start = clip.start;
  // Approximate a word's moment by its position in the caption.
  if (card.at.word) {
    const index = clip.text.toLowerCase().indexOf(card.at.word.toLowerCase());
    if (index >= 0) start += clip.duration * (index / Math.max(1, clip.text.length));
  }
  return Math.min(settle, options.chapterTime - start);
}

interface CardContent {
  label: string;
  value: string;
  note?: string;
  /** Video seconds since the content became true (Infinity: always). */
  readySince: number;
}

/** The number a card shows, from this half's run at the current (sampled) simulated time. */
function cardContent(card: ShotCard, scene: QueueScene, run: QueueRun, options: ShotOptions): CardContent | null {
  const now = options.labelSimTime;
  const focusId = scene.focus?.entityId;
  switch (card.value) {
    case "served": {
      const served = run.customers.filter((customer) => customer.serviceEnd <= now).length;
      return { label: card.label ?? "Served", value: `${served} / ${run.customers.length}`, readySince: Infinity };
    }
    case "focusWait": {
      if (!focusId) return null;
      return { label: card.label ?? "Waits", value: formatDuration(run.customers[focusId - 1].wait), readySince: Infinity };
    }
    case "focusWaitLive": {
      if (!focusId) return null;
      const record = run.customers[focusId - 1];
      if (now < record.arrival) return null;
      const done = now >= record.serviceStart;
      return { label: card.label ?? (done ? "Waited" : "Waiting so far"), value: formatDuration(done ? record.wait : now - record.arrival), readySince: Infinity };
    }
    case "makespan": {
      // Both cards appear together, once both rules are done.
      const doneAt = Math.max(...scene.story.compare.slice(0, 2).map((id) => scene.runs[id].end));
      if (now < doneAt) return null;
      // Video time, not sim time: the clock stops at closing, but the card still has to fade in.
      return { label: card.label ?? "All done", value: formatDuration(run.end), note: "from opening to last checkout", readySince: options.chapterTime - options.localTimeOf(doneAt) };
    }
    default:
      throw new Error(`Unknown card value "${card.value}" (available: served, focusWait, focusWaitLive, makespan)`);
  }
}

function drawCards(ctx: CanvasRenderingContext2D, scene: QueueScene, shot: ShotSpec, run: QueueRun, side: number, half: Rect, view: View, options: ShotOptions, camera: CameraState) {
  const { scale, x, y } = designScale(half);
  const sideName = side === 0 ? "left" : "right";
  let top = y(view === "close" ? (options.callout ? 250 : 160) : 150);
  for (const card of shot.cards ?? []) {
    if (card.side && card.side !== "both" && card.side !== sideName) continue;
    const content = cardContent(card, scene, run, options);
    if (!content) continue;
    const since = Math.min(cardSince(card, options, camera), content.readySince);
    if (since < 0) continue;
    const shown = appearance(since);
    const height = drawNumberCard(ctx, x(space.safeX), top, content, card.size ?? (view === "wide" ? "S" : "M"), scale, shown.alpha, shown.scale);
    top += height + space.gap * scale;
  }
}

/**
 * Number card (design component 6): paper, 3 px ink, radius 24; label Noto 500 34 px ink-muted
 * over the value in Nunito 800 (L 96, M 64), or side by side at 44 px (S, wide shots).
 */
function drawNumberCard(ctx: CanvasRenderingContext2D, left: number, top: number, content: CardContent, size: "S" | "M" | "L", scale: number, alpha: number, grow: number): number {
  const labelStyle = { size: type.small * scale, weight: 500 as const };
  const valueSize = (size === "L" ? type.numberLarge : size === "M" ? type.number : 44) * scale;
  const valueStyle = { size: valueSize, weight: 800 as const, display: true };
  const padX = (size === "S" ? 26 : 30) * scale;
  const padY = (size === "S" ? 14 : 18) * scale;
  const labelWidth = tabularWidth(ctx, content.label, labelStyle);
  const valueWidth = tabularWidth(ctx, content.value, valueStyle);
  const noteWidth = content.note ? tabularWidth(ctx, content.note, labelStyle) : 0;
  const inline = size === "S";
  const lineLabel = 44 * scale;
  const width = padX * 2 + (inline ? labelWidth + 16 * scale + valueWidth : Math.max(labelWidth, valueWidth, noteWidth));
  const height = padY * 2 + (inline ? 56 * scale : lineLabel + valueSize * 1.2 + (content.note ? lineLabel : 0));
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(left + width / 2, top + height / 2);
  ctx.scale(grow, grow);
  ctx.translate(-width / 2, -height / 2);
  fillRoundRect(ctx, 0, 0, width, height, shape.radius * scale, palette.paper);
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = shape.stroke * scale;
  ctx.stroke();
  if (inline) {
    const baseline = height / 2 + valueSize * 0.36;
    drawTabular(ctx, content.label, padX, baseline, { ...labelStyle, color: palette.inkMuted });
    drawTabular(ctx, content.value, padX + labelWidth + 16 * scale, baseline, { ...valueStyle, color: palette.ink });
  } else {
    drawTabular(ctx, content.label, padX, padY + lineLabel * 0.75, { ...labelStyle, color: palette.inkMuted });
    drawTabular(ctx, content.value, padX, padY + lineLabel + valueSize * 0.95, { ...valueStyle, color: palette.ink });
    if (content.note) drawTabular(ctx, content.note, padX, padY + lineLabel + valueSize * 1.2 + lineLabel * 0.75, { ...labelStyle, color: palette.inkMuted });
  }
  ctx.restore();
  return height;
}

/** One brief explanation label at the top centre, after the camera settles (design component 9). */
function drawCallout(ctx: CanvasRenderingContext2D, text: string | undefined, centerX: number, top: number, scale: number, camera: CameraState, local: number) {
  if (!text || camera.moving) return;
  const since = (camera.sinceEnd === Infinity ? local : camera.sinceEnd) - motion.cutSettle;
  if (since < 0) return;
  const fadeOut = Math.max(0, Math.min(1, 1 - (since - motion.calloutMax) / motion.labelOut));
  const shown = appearance(since);
  if (fadeOut <= 0) return;
  drawPill(ctx, centerX, top, text, { height: 68 * scale, size: type.callout * scale, align: "center", alpha: shown.alpha * fadeOut, display: false });
}
