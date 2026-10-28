// Draws the shoppers of a queue shot from their poses: ground discs first, then bodies in depth
// order, then head tags on top, plus a "+n" pill per line for people beyond the drawn places.
// Shared by the close-up and wide compositions so every shot reads the same.

import { formatDuration } from "../../core/format.ts";
import { assets } from "../../assets/library.ts";
import { appearance, characterWidth, drawCharacter, drawFootDisc, drawHeadTag, drawPill, type IconName } from "../../render/illustration.ts";
import { meaning, motion, space, type } from "../../style/channel.ts";
import { type FloorPlan, pointAt } from "./floor.ts";
import { gait, hiddenInLine, type LanePose } from "./laneMotion.ts";
import type { QueueRun } from "./simulate.ts";

/**
 * Which head tags a composition shows: close-up = everyone (full), split close-up = the followed
 * customer and whoever is at the counter, wide = compact for everyone (full for the followed
 * customer), split wide = the followed customer only.
 */
export type TagMode = "full" | "focusAndCounter" | "compact" | "focusOnly" | "none";

export interface CrowdOptions {
  /** Customer marked with the brand disc (null: nobody). */
  focusId: number | null;
  labelSimTime: number;
  /** Tags turn pink from this wait on (half of the red threshold). */
  longWait: number;
  tags: TagMode;
  /** Fades every tag (e.g. right after a camera move). */
  tagAlpha?: number;
  /** "+n" pills sit this share of a figure's height above the line's baseline. */
  pillLift: number;
  /** Close-ups: the window in shot (someone at another window's counter is out of shot). */
  window?: number;
}

export function drawCrowd(ctx: CanvasRenderingContext2D, run: QueueRun, plan: FloorPlan, everyone: LanePose[], options: CrowdOptions) {
  const library = assets();
  const poses = everyone.filter((pose) => !hiddenInLine(pose.slot, plan));

  // Ground layer: every disc before any body, so a disc never covers someone's feet.
  for (const pose of poses) {
    const width = characterWidth(library.customer(pose.id).asset, plan.personHeight);
    drawFootDisc(ctx, pose.x, pose.y, width, pose.id === options.focusId ? "focus" : "ground", fadeFromHidden(pose, plan));
  }

  const focus = poses.find((pose) => pose.id === options.focusId) ?? null;
  const tags: (() => void)[] = [];
  for (const pose of poses) {
    const customer = run.customers[pose.id - 1];
    const { asset } = library.customer(pose.id);
    const { bob } = gait(pose, plan.personHeight);
    const alpha = fadeFromHidden(pose, plan);
    const drawn = drawCharacter(ctx, { x: pose.x, y: pose.y + bob, height: plan.personHeight, facing: pose.facing, turn: pose.turn, asset, opacity: alpha });
    const isFocus = pose.id === options.focusId;
    const atCounter = pose.slot.kind === "service" && (options.window === undefined || pose.slot.window === options.window);
    const mode = tagModeFor(options.tags, isFocus, atCounter);
    if (!mode) continue;
    // A full tag needs room: its neighbours' compact tags step aside.
    if (!isFocus && focus && options.tags === "compact" && Math.abs(pose.y - focus.y) < 1 && Math.abs(pose.x - focus.x) < plan.spacing * 1.6) continue;
    const tag = tagFor(pose, customer, options.labelSimTime, options.longWait);
    const tagAlpha = tag.alpha * alpha * (options.tagAlpha ?? 1);
    if (tagAlpha <= 0) continue;
    // Tags follow x and the baseline only — the step bob is not passed on.
    const figureTop = drawn.top - bob;
    const showId = isFocus || options.tags === "full";
    tags.push(() => drawHeadTag(ctx, pose.x, figureTop, { ...tag, alpha: tagAlpha, compact: mode === "compact", id: showId ? `#${pose.id}` : undefined }));
  }
  tags.forEach((draw) => draw());

  // "+n" per line, at the first place that is not drawn.
  const hiddenPerLane = new Map<number, number>();
  for (const pose of everyone) {
    if (pose.slot.kind === "queue" && hiddenInLine(pose.slot, plan)) hiddenPerLane.set(pose.slot.lane, (hiddenPerLane.get(pose.slot.lane) ?? 0) + 1);
  }
  for (const [lane, count] of hiddenPerLane) {
    const spot = pointAt(plan.queuePath(lane), plan.cap * plan.spacing);
    const compact = plan.personHeight < 150;
    const height = compact ? 52 : 60;
    // Keep the pill inside the frame's safe area; pushed in over the last figure, it floats above
    // the row of head tags (a full tag is 64 tall, 12 above the head) so it never covers one.
    const inside = plan.frameLeft + space.safeX + height;
    const clamped = spot.x < inside;
    const top = clamped ? spot.y - plan.personHeight - 12 - 64 - 10 - height : spot.y - plan.personHeight * options.pillLift - height / 2;
    drawPill(ctx, Math.max(spot.x, inside), top, `+${count}`, { height, size: compact ? type.callout : type.label, align: "center" });
  }
}

function tagModeFor(mode: TagMode, isFocus: boolean, atCounter: boolean): "full" | "compact" | null {
  switch (mode) {
    case "none":
      return null;
    case "full":
      return "full";
    case "focusAndCounter":
      return isFocus || atCounter ? "full" : null;
    case "focusOnly":
      return isFocus ? "compact" : null;
    case "compact":
      return isFocus ? "full" : "compact";
  }
}

/** Someone coming out from behind the "+n" pill fades in as they start walking. */
function fadeFromHidden(pose: LanePose, plan: FloorPlan): number {
  if (!pose.previous || !hiddenInLine(pose.previous, plan)) return 1;
  return Math.min(1, Math.max(0, pose.walkTime / motion.labelIn));
}

interface TagState {
  time: string;
  fill: string;
  icon: IconName | null;
  fromIcon?: IconName | null;
  iconMix?: number;
  alpha: number;
  scale: number;
}

/**
 * Head tag state (design component 1): waiting = white; waited ≥ half the red threshold = pink
 * with an hourglass; at the counter the clock freezes and the prefix turns into a check mark
 * (the fill stays what it was). Appears 0.2 s after first standing still; fades before leaving.
 */
function tagFor(pose: LanePose, customer: QueueRun["customers"][number], labelSimTime: number, longWait: number): TagState {
  const waiting = pose.slot.kind === "queue" || pose.slot.kind === "transit";
  const seconds = waiting ? Math.max(0, labelSimTime - customer.arrival) : customer.wait;
  const long = seconds >= longWait;
  const fill = long ? meaning.waitLong : meaning.waiting;
  const waitIcon: IconName | null = long ? "hourglass" : null;
  const shown = appearance(pose.settledFor);
  if (waiting) return { time: formatDuration(seconds), fill, icon: waitIcon, ...shown };
  const leaving = pose.slot.kind === "exit";
  // The check replaces the waiting prefix once they reach the counter (cross-fade over labelIn).
  const atCounter = leaving ? Infinity : pose.sinceStop;
  const iconMix = Math.min(1, Math.max(0, atCounter / motion.labelIn));
  const alpha = leaving ? shown.alpha * Math.max(0, 1 - pose.slotAge / motion.labelOut) : shown.alpha;
  return { time: formatDuration(seconds), fill, icon: "check", fromIcon: waitIcon, iconMix, alpha, scale: shown.scale };
}
