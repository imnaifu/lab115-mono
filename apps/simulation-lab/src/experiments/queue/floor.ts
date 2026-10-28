// Floor plans for the queue shots: where people stand in each composition of the design
// (01b lane close-up, 01a wide, S01/S06 split close-up, S05/S07 split wide). A plan turns slots
// (queue index, window) into points on screen; laneMotion walks people between them.
// Numbers are design pixels of a 1920-wide frame (or a 960-wide half), scaled to the target rect.

import type { Rect } from "../../core/experiment.ts";
import { motion } from "../../style/channel.ts";

export interface Point {
  x: number;
  y: number;
}

export interface FloorPlan {
  /** Left and right edges of the composition on the canvas (people beyond them are out of shot). */
  frameLeft: number;
  frameRight: number;
  personHeight: number;
  /** Cruising pace in px per video second. */
  walkSpeed: number;
  /** Distance between neighbours along a line. */
  spacing: number;
  /** Waiting places drawn per line; people further back are summed up in a "+n" pill. */
  cap: number;
  /** The line a window's customers queue in (one shared line for rule A). */
  laneOf(window: number): number;
  /** Polyline from the head of `lane` (index 0) back along the line; positions run past its end. */
  queuePath(lane: number): Point[];
  /** Where a newcomer to `lane` appears (off-screen). */
  entry(lane: number): Point;
  /** Walk to be served at `window`; the last point is where they stand (may be off-screen). */
  servicePath(from: Point, window: number): Point[];
  /** Walk out after being served, in front of the counter and off-screen. */
  exitPath(from: Point, window: number): Point[];
}

// --- Polyline helpers -------------------------------------------------------------------------

function segmentLength(from: Point, to: Point): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

/** Point `distance` along the polyline; past the end it continues along the last segment. */
export function pointAt(path: Point[], distance: number): Point {
  let remaining = Math.max(0, distance);
  for (let i = 1; i < path.length; i++) {
    const length = segmentLength(path[i - 1], path[i]);
    if (remaining <= length || i === path.length - 1) {
      const amount = length > 0 ? remaining / length : 0;
      return { x: path[i - 1].x + (path[i].x - path[i - 1].x) * amount, y: path[i - 1].y + (path[i].y - path[i - 1].y) * amount };
    }
    remaining -= length;
  }
  return path[0];
}

/** Points to walk through from distance `from` to distance `to` along the polyline (either direction), ending at `to`. */
export function subpath(path: Point[], from: number, to: number): Point[] {
  const corners: number[] = [];
  let travelled = 0;
  for (let i = 1; i < path.length - 1; i++) {
    travelled += segmentLength(path[i - 1], path[i]);
    corners.push(travelled);
  }
  const between = corners.filter((corner) => corner > Math.min(from, to) && corner < Math.max(from, to));
  if (to < from) between.reverse();
  return [...between.map((corner) => pointAt(path, corner)), pointAt(path, to)];
}

export function queuePoint(plan: FloorPlan, lane: number, index: number): Point {
  return pointAt(plan.queuePath(lane), index * plan.spacing);
}

// --- Compositions -----------------------------------------------------------------------------

/** Maps design pixels of a composition onto a rect (its height is 1080 design pixels). */
export function designScale(rect: Rect) {
  const scale = rect.h / 1080;
  return { scale, x: (value: number) => rect.x + value * scale, y: (value: number) => rect.y + value * scale };
}

/** Lane close-up: one line leading to one window, side view, feet on one baseline. */
export const CLOSE = {
  full: {
    baseline: 800,
    serviceX: 1290,
    spacing: 220,
    personHeight: 260,
    cap: 4,
    counter: { left: 1390, width: 320, height: 160 },
    cashier: { x: 1520, height: 260 },
    numberSize: 48,
    walkSpeed: motion.walkSpeed.lane,
    width: 1920,
  },
  half: {
    baseline: 800,
    serviceX: 590,
    spacing: 190,
    personHeight: 230,
    cap: 2,
    counter: { left: 680, width: 184, height: 140 },
    cashier: { x: 790, height: 200 },
    numberSize: 44,
    walkSpeed: motion.walkSpeed.splitClose,
    width: 960,
  },
  /** Leaving shoppers pass this far in front of the counter, still above the caption zone. */
  exitOffset: 36,
} as const;

export type CloseLayout = (typeof CLOSE)["full"] | (typeof CLOSE)["half"];

/**
 * Close-up of `window`. With one shared line (rule A) the camera shows the head of that line and
 * this window; people called to other windows walk off to the right in front of the counter.
 */
export function closePlan(rect: Rect, layout: CloseLayout, window: number, sharedLine: boolean): FloorPlan {
  const { scale, x, y } = designScale(rect);
  const baseline = y(layout.baseline);
  const aisle = y(layout.baseline + CLOSE.exitOffset);
  const offRight = x(layout.width + 150);
  const walkOff = (from: Point): Point[] => [{ x: from.x + 12 * scale, y: aisle }, { x: offRight, y: aisle }];
  return {
    frameLeft: rect.x,
    frameRight: x(layout.width),
    personHeight: layout.personHeight * scale,
    walkSpeed: layout.walkSpeed * scale,
    spacing: layout.spacing * scale,
    cap: layout.cap,
    laneOf: (other) => (sharedLine ? 0 : other),
    queuePath: () => [{ x: x(layout.serviceX - layout.spacing), y: baseline }, { x: x(-4000), y: baseline }],
    entry: () => ({ x: x(-150), y: baseline }),
    servicePath: (from, other) => (other === window ? [{ x: x(layout.serviceX), y: baseline }] : walkOff(from)),
    exitPath: (from, other) => (other === window ? walkOff(from) : [{ x: offRight, y: aisle }]),
  };
}

/** Wide shot: every window in a right-hand column; one line per window, or one snake-shaped line (rule A). */
export const WIDE = {
  full: {
    /** Feet baselines of the first and last window's line. */
    top: 280,
    bottom: 745,
    serviceX: 1500,
    spacing: 112,
    personHeight: 88,
    cap: 9,
    counter: { left: 1560, width: 140, height: 72 },
    cashierX: 1738,
    numberSize: 36,
    floorLeft: 300,
    exitDrop: 24,
    walkSpeed: motion.walkSpeed.wide,
    width: 1920,
    snake: { rows: [380, 520, 660], left: 420, right: 1180, head: 1260, spacing: 88 },
  },
  half: {
    top: 360,
    bottom: 720,
    serviceX: 700,
    spacing: 64,
    personHeight: 70,
    cap: 8,
    counter: { left: 750, width: 114, height: 50 },
    cashierX: 807,
    numberSize: 34,
    floorLeft: 96,
    exitDrop: 20,
    walkSpeed: motion.walkSpeed.splitWide,
    width: 960,
    snake: { rows: [420, 540, 660], left: 240, right: 600, head: 600, spacing: 60 },
  },
} as const;

export type WideLayout = (typeof WIDE)["full"] | (typeof WIDE)["half"];

/** Feet baseline of each window's row, spread evenly between the layout's top and bottom. */
export function wideBaselines(layout: WideLayout, windows: number): number[] {
  if (windows <= 1) return [(layout.top + layout.bottom) / 2];
  return Array.from({ length: windows }, (_, i) => layout.top + ((layout.bottom - layout.top) * i) / (windows - 1));
}

/** The snake's polyline, head first (design pixels): rows alternate direction, joined at open ends. */
export function snakePath(layout: WideLayout): Point[] {
  const { rows, left, right, head } = layout.snake;
  const points: Point[] = [{ x: head, y: rows[0] }];
  rows.forEach((row, i) => {
    const leftward = i % 2 === 0;
    if (i > 0) points.push({ x: leftward ? right : left, y: row });
    points.push({ x: leftward ? left : right, y: row });
  });
  // Past the last row the line keeps going the same way (hidden behind "+n").
  const last = points[points.length - 1];
  points.push({ x: last.x + (rows.length % 2 === 1 ? -4000 : 4000), y: last.y });
  return points;
}

export function snakeLength(layout: WideLayout): number {
  const path = snakePath(layout);
  let total = 0;
  for (let i = 1; i < path.length - 1; i++) total += segmentLength(path[i - 1], path[i]);
  return total;
}

export function widePlan(rect: Rect, layout: WideLayout, windows: number, sharedLine: boolean): FloorPlan {
  const { scale, x, y } = designScale(rect);
  const baselines = wideBaselines(layout, windows);
  const snake = snakePath(layout).map((point) => ({ x: x(point.x), y: y(point.y) }));
  const spacing = sharedLine ? layout.snake.spacing : layout.spacing;
  return {
    frameLeft: rect.x,
    frameRight: x(layout.width),
    personHeight: layout.personHeight * scale,
    walkSpeed: layout.walkSpeed * scale,
    spacing: spacing * scale,
    // The snake shows as many people as fit along it.
    cap: sharedLine ? Math.floor(snakeLength(layout) / layout.snake.spacing) + 1 : layout.cap,
    laneOf: (window) => (sharedLine ? 0 : window),
    queuePath: (lane) =>
      sharedLine ? snake : [{ x: x(layout.serviceX - layout.spacing), y: y(baselines[lane]) }, { x: x(-4000), y: y(baselines[lane]) }],
    entry: (lane) => ({ x: x(-60), y: y(sharedLine ? layout.snake.rows[layout.snake.rows.length - 1] : baselines[lane]) }),
    servicePath: (_from, window) => [{ x: x(layout.serviceX), y: y(baselines[window]) }],
    exitPath: (from) => [
      { x: from.x + 8 * scale, y: from.y + layout.exitDrop * scale },
      { x: x(layout.width + 120), y: from.y + layout.exitDrop * scale },
    ],
  };
}
