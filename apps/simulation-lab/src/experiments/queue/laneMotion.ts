// Business motion for the illustrated queue shots: where each shopper is at simulated time t,
// derived only from the run's event log and a floor plan (floor.ts). Walks are timed in VIDEO
// seconds by distance (natural start/stop, trapezoid speed profile), so they read the same at any
// simulation speed; nothing here can change who is served when — positions only trail the events.

import { motion, walkProgress, walkSpeedFraction } from "../../style/channel.ts";
import { type FloorPlan, type Point, pointAt, subpath } from "./floor.ts";
import type { QueueRun } from "./simulate.ts";
import { buildTracksCached, changeIndexAt, type Slot, type SlotChange } from "./visual.ts";

export type { Point };

export interface LanePose {
  id: number;
  slot: Slot;
  /** The slot before the current one (null right after arriving). */
  previous: Slot | null;
  x: number;
  y: number;
  facing: "left" | "right";
  /** -1 → 1 while turning around (horizontal flip), else 1. */
  turn: number;
  moving: boolean;
  /** Share of cruising speed right now: 0 standing, rising/falling at the start and stop. */
  pace: number;
  /** Video seconds since the current walk started (negative while waiting to start). */
  walkTime: number;
  /** Video seconds the current walk waited after its slot change (0 if they were still walking). */
  startDelay: number;
  /** Video seconds since the current walk ended (negative until then). */
  sinceStop: number;
  /** Video seconds since the current slot began. */
  slotAge: number;
  /** Video seconds since this shopper first stood still in the shot (tags appear then). */
  settledFor: number;
}

function route(from: Point, slot: Slot, previous: Slot | null, plan: FloorPlan): Point[] {
  switch (slot.kind) {
    case "queue": {
      const path = plan.queuePath(slot.lane);
      const target = slot.index * plan.spacing;
      // Moving up in the same line: follow the line (around the snake's turns).
      if (previous?.kind === "queue" && previous.lane === slot.lane) return subpath(path, previous.index * plan.spacing, target);
      // Joining: come in at the visible end of the line, then walk along it.
      const join = Math.max(slot.index, plan.cap) * plan.spacing;
      return [pointAt(path, join), ...subpath(path, join, target)];
    }
    case "service":
      return plan.servicePath(from, slot.window);
    case "exit":
      return plan.exitPath(from, slot.window);
    case "transit":
      // Rule C: head for the end of the new line; the next change walks along it.
      return [pointAt(plan.queuePath(slot.to), plan.cap * plan.spacing)];
  }
}

function length(from: Point, points: Point[]): number {
  let total = 0;
  let previous = from;
  for (const point of points) {
    total += Math.hypot(point.x - previous.x, point.y - previous.y);
    previous = point;
  }
  return total;
}

function along(from: Point, points: Point[], distance: number): { point: Point; dx: number } {
  let previous = from;
  let remaining = distance;
  for (const point of points) {
    const segment = Math.hypot(point.x - previous.x, point.y - previous.y);
    if (remaining <= segment || point === points[points.length - 1]) {
      const amount = segment > 0 ? Math.min(1, remaining / segment) : 1;
      return { point: { x: previous.x + (point.x - previous.x) * amount, y: previous.y + (point.y - previous.y) * amount }, dx: point.x - previous.x };
    }
    remaining -= segment;
    previous = point;
  }
  return { point: previous, dx: 0 };
}

/**
 * Video seconds between a slot change and the start of the walk. Leaving waits for the tag to
 * fade out; moving up waits for the leaver to clear, then goes front to back, one after another.
 */
function startDelay(track: SlotChange[], index: number, plan: FloorPlan): number {
  if (index === 0) return 0;
  const slot = track[index].slot;
  const previous = track[index - 1].slot;
  if (slot.kind === "exit") return motion.labelOut;
  if (previous.kind === "queue" && (slot.kind === "queue" || slot.kind === "service")) {
    // Past the visible places nobody is drawn, so there is no ripple to show.
    const rank = slot.kind === "service" ? 0 : Math.min(slot.index + 1, plan.cap);
    return motion.labelOut + rank * motion.advanceStagger;
  }
  return 0;
}

interface Evaluated {
  point: Point;
  facing: "left" | "right";
  moving: boolean;
  turn: number;
  pace: number;
  elapsedVideo: number;
  walkTime: number;
  sinceStop: number;
  /** Video seconds after the slot change at which this walk ends. */
  stopsAt: number;
  delay: number;
}

/** Where someone ends up standing for a slot (the end of its walk). */
function restingPoint(slot: Slot, plan: FloorPlan): Point {
  switch (slot.kind) {
    case "queue":
      return pointAt(plan.queuePath(slot.lane), slot.index * plan.spacing);
    case "transit":
      return pointAt(plan.queuePath(slot.to), plan.cap * plan.spacing);
    case "service": {
      const path = plan.servicePath(pointAt(plan.queuePath(plan.laneOf(slot.window)), 0), slot.window);
      return path[path.length - 1];
    }
    case "exit": {
      const path = plan.exitPath(restingPoint({ kind: "service", window: slot.window }, plan), slot.window);
      return path[path.length - 1];
    }
  }
}

/** The longest a walk can take after its slot change, in video seconds (delay included). */
function longestWalk(plan: FloorPlan, speed: number): number {
  return Math.min(motion.labelOut + plan.cap * motion.advanceStagger + motion.maxMove, motion.maxLagSim / speed);
}

/** Pose for track change `index` at time t; `speed` = simulated seconds per video second. */
function evaluate(track: SlotChange[], index: number, t: number, speed: number, plan: FloorPlan, depth = 0): Evaluated {
  const change = track[index];
  const firstLane = change.slot.kind === "queue" ? change.slot.lane : change.slot.kind === "service" ? plan.laneOf(change.slot.window) : 0;
  let startPose: Pick<Evaluated, "point" | "facing" | "sinceStop">;
  if (index === 0) startPose = { point: plan.entry(firstLane), facing: "right", sinceStop: Infinity };
  else if (depth > 24 || speed <= 0 || (change.t - track[index - 1].t) / speed > longestWalk(plan, speed)) {
    // The previous walk had certainly ended: start where it ended, without replaying the whole
    // history (a long line moves up dozens of times).
    startPose = { point: restingPoint(track[index - 1].slot, plan), facing: "right", sinceStop: Infinity };
  } else startPose = evaluate(track, index - 1, change.t, speed, plan, depth + 1);
  const points = route(startPose.point, change.slot, index > 0 ? track[index - 1].slot : null, plan);
  const total = length(startPose.point, points);
  // Starting and stopping cost walkAccel in total, so the cruising pace equals walkSpeed for every move.
  let durationVideo = total < 1 ? 0 : Math.min(motion.maxMove, Math.max(motion.minMove, total / plan.walkSpeed + motion.walkAccel));
  // Someone still walking when the next change comes keeps going: pausing mid-stride would look like a glitch.
  let delay = startPose.sinceStop < 0 ? 0 : startDelay(track, index, plan);
  // Fast playback: squeeze the pause and the walk so the picture never trails the run by more than maxLagSim.
  const budget = speed > 0 ? motion.maxLagSim / speed : Infinity;
  if (delay + durationVideo > budget) {
    const squeeze = budget / (delay + durationVideo);
    delay *= squeeze;
    durationVideo *= squeeze;
  }
  const elapsedVideo = speed > 0 ? (t - change.t) / speed : Infinity;
  const walkTime = elapsedVideo - delay;
  const fraction = durationVideo > 0 ? Math.min(1, Math.max(0, walkTime / durationVideo)) : 1;
  const { point, dx } = along(startPose.point, points, walkProgress(fraction, durationVideo) * total);
  const moving = walkTime > 0 && fraction < 1 && total >= 1;
  // Standing shoppers face the counter; walkers face where they go.
  const facing: "left" | "right" = moving && Math.abs(dx) > 0.5 ? (dx > 0 ? "right" : "left") : "right";
  const turn = facing !== startPose.facing ? Math.min(1, -1 + 2 * Math.min(1, elapsedVideo / motion.turn)) : 1;
  const pace = moving ? walkSpeedFraction(fraction, durationVideo) : 0;
  return { point, facing, moving, turn, pace, elapsedVideo, walkTime, sinceStop: walkTime - durationVideo, stopsAt: delay + durationVideo, delay };
}

/** Video seconds since the shopper first stood still: the first walk that ended before the next change. */
function settledFor(track: SlotChange[], index: number, t: number, speed: number, plan: FloorPlan): number {
  if (speed <= 0) return Infinity;
  for (let k = 0; k <= index; k++) {
    const stopTime = track[k].t + evaluate(track, k, track[k].t, speed, plan).stopsAt * speed;
    if (k === index || stopTime <= track[k + 1].t) return (t - stopTime) / speed;
  }
  return Infinity;
}

/** Everyone `include`d who is in the shop at simulated time t (leavers until they are off-screen). */
export function floorState(run: QueueRun, plan: FloorPlan, t: number, speed: number, include: (customer: QueueRun["customers"][number]) => boolean): LanePose[] {
  const tracks = buildTracksCached(run);
  const poses: LanePose[] = [];
  for (const customer of run.customers) {
    if (customer.arrival > t || !include(customer)) continue;
    const track = tracks.get(customer.id)!;
    const index = changeIndexAt(track, t);
    if (index < 0) continue;
    const slot = track[index].slot;
    const pose = evaluate(track, index, t, speed, plan);
    // Gone once they have walked out of frame.
    if (slot.kind === "exit" && pose.sinceStop >= 0) continue;
    poses.push({
      id: customer.id,
      slot,
      previous: index > 0 ? track[index - 1].slot : null,
      x: pose.point.x,
      y: pose.point.y,
      facing: pose.facing,
      turn: pose.turn,
      moving: pose.moving,
      pace: pose.pace,
      walkTime: pose.walkTime,
      startDelay: pose.delay,
      sinceStop: pose.sinceStop,
      slotAge: pose.elapsedVideo,
      settledFor: settledFor(track, index, t, speed, plan),
    });
  }
  // Painter's order: further back (smaller y) first, then left to right.
  return poses.sort((left, right) => left.y - right.y || left.x - right.x);
}

/** Who belongs in a close-up of `window`: its own line, or everyone when all share one line. */
export function closeUpMembers(run: QueueRun, window: number) {
  return (customer: QueueRun["customers"][number]) => run.laneCount === 1 || customer.window === window;
}

/** Hidden behind the "+n" pill: waiting further back than the plan draws. */
export function hiddenInLine(slot: Slot, plan: FloorPlan): boolean {
  return slot.kind === "queue" && slot.index >= plan.cap;
}

/** Step bob: one small bump per step, 2 steps per second, scaled by current pace; none when standing. */
export function gait(pose: Pick<LanePose, "moving" | "walkTime" | "pace">, figureHeight: number): { bob: number } {
  if (!pose.moving) return { bob: 0 };
  return { bob: -Math.abs(Math.sin((Math.PI * pose.walkTime) / motion.stepPeriod)) * figureHeight * motion.bobScale * pose.pace };
}
