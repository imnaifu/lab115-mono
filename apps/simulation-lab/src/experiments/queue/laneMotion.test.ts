import { describe, expect, it } from "vitest";
import sampleConfig from "../../../configs/queue-lane-sample.json";
import demoConfig from "../../../configs/queue-demo.json";
import { frame, motion } from "../../style/channel.ts";
import { parseQueueConfig } from "./config.ts";
import { CLOSE, closePlan, type FloorPlan, WIDE, widePlan } from "./floor.ts";
import { generateQueueInput } from "./input.ts";
import { closeUpMembers, floorState, gait, hiddenInLine, type LanePose } from "./laneMotion.ts";
import { type QueueRun, simulateQueue } from "./simulate.ts";

const FPS = 30;
const FULL = { x: 0, y: 0, w: 1920, h: 1080 };
const HALF = { x: 0, y: 0, w: 960, h: 1080 };

function runOf(config: unknown, seed: number, variant: "single" | "shortest"): QueueRun {
  const parsed = parseQueueConfig(config);
  return simulateQueue(generateQueueInput(parsed, seed), parsed, variant);
}

interface Case {
  name: string;
  speed: number;
  plan: FloorPlan;
  /** Straight lines (not the snake): order and spacing can be checked along x. */
  straight: boolean;
  counterLeft: number | null;
  frames: LanePose[][];
}

/** Every video frame of a shot played at `speed` sim-seconds per video second, from `start`. */
function framesOf(run: QueueRun, plan: FloorPlan, include: (customer: QueueRun["customers"][number]) => boolean, speed: number, seconds: number, start = 0) {
  return Array.from({ length: Math.round(seconds * FPS) }, (_, frame) => floorState(run, plan, start + (frame / FPS) * speed, speed, include));
}

const sample = runOf(sampleConfig, 78, "single");
const demoA = runOf(demoConfig, 7, "single");
const demoB = runOf(demoConfig, 7, "shortest");
const everyone = () => true;

const cases: Case[] = [
  (() => {
    const plan = closePlan(FULL, CLOSE.full, 0, true);
    return { name: "close-up: socost sample", speed: 7.4, plan, straight: true, counterLeft: CLOSE.full.counter.left, frames: framesOf(sample, plan, closeUpMembers(sample, 0), 7.4, 14) };
  })(),
  (() => {
    const plan = closePlan(FULL, CLOSE.full, 2, false);
    return { name: "close-up: rule B window 3", speed: 40, plan, straight: true, counterLeft: CLOSE.full.counter.left, frames: framesOf(demoB, plan, closeUpMembers(demoB, 2), 40, 45) };
  })(),
  (() => {
    const plan = closePlan(FULL, CLOSE.full, 1, true);
    return { name: "close-up: rule A shared line at window 2", speed: 40, plan, straight: true, counterLeft: CLOSE.full.counter.left, frames: framesOf(demoA, plan, closeUpMembers(demoA, 1), 40, 45) };
  })(),
  (() => {
    const plan = closePlan(HALF, CLOSE.half, 1, true);
    return { name: "split close-up: rule A", speed: 105, plan, straight: true, counterLeft: CLOSE.half.counter.left, frames: framesOf(demoA, plan, closeUpMembers(demoA, 1), 105, 20, 900) };
  })(),
  (() => {
    const plan = closePlan(HALF, CLOSE.half, 2, false);
    return { name: "split close-up: rule B", speed: 105, plan, straight: true, counterLeft: CLOSE.half.counter.left, frames: framesOf(demoB, plan, closeUpMembers(demoB, 2), 105, 20, 900) };
  })(),
  (() => {
    const plan = widePlan(FULL, WIDE.full, 4, false);
    return { name: "wide: rule B", speed: 60, plan, straight: true, counterLeft: null, frames: framesOf(demoB, plan, everyone, 60, 30) };
  })(),
  (() => {
    const plan = widePlan(FULL, WIDE.full, 4, true);
    return { name: "wide: rule A snake", speed: 60, plan, straight: false, counterLeft: null, frames: framesOf(demoA, plan, everyone, 60, 30) };
  })(),
  (() => {
    const plan = widePlan(HALF, WIDE.half, 4, false);
    return { name: "split wide: rule B", speed: 137, plan, straight: true, counterLeft: null, frames: framesOf(demoB, plan, everyone, 137, 20) };
  })(),
  (() => {
    const plan = widePlan(HALF, WIDE.half, 4, true);
    return { name: "split wide: rule A snake", speed: 137, plan, straight: false, counterLeft: null, frames: framesOf(demoA, plan, everyone, 137, 20) };
  })(),
];

/** On screen and not behind a "+n" pill (people called to a window out of shot stand off-screen). */
const visible = (poses: LanePose[], plan: FloorPlan) => poses.filter((pose) => !hiddenInLine(pose.slot, plan) && pose.x > -60 && pose.x < plan.frameRight + 60);

function groupBy<T>(items: T[], key: (item: T) => number): T[][] {
  const groups = new Map<number, T[]>();
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  return [...groups.values()];
}

describe.each(cases)("motion: $name", ({ plan, speed, straight, counterLeft, frames }) => {
  it("has people on screen to check", () => {
    expect(frames.some((poses) => visible(poses, plan).length >= 3)).toBe(true);
  });

  it("never teleports: per-frame movement stays within walking pace", () => {
    // Fastest legal pace: the longest walk (~4000 px) squeezed into maxMove — or into the lag
    // budget at fast playback — at the profile's peak (a triangle at most: 2× average).
    const shortest = Math.min(motion.maxMove, motion.maxLagSim / speed);
    const limit = (2 * Math.max(plan.walkSpeed, 4000 / shortest)) / FPS + 1;
    for (let i = 1; i < frames.length; i++) {
      const previous = new Map(frames[i - 1].map((pose) => [pose.id, pose]));
      for (const pose of frames[i]) {
        const before = previous.get(pose.id);
        if (before) expect(Math.hypot(pose.x - before.x, pose.y - before.y)).toBeLessThanOrEqual(limit);
      }
    }
  });

  it("never stacks two standing shoppers", () => {
    for (const poses of frames) {
      const standing = visible(poses, plan).filter((pose) => !pose.moving);
      for (let i = 0; i < standing.length; i++) {
        for (let j = i + 1; j < standing.length; j++) {
          if (Math.abs(standing[i].y - standing[j].y) < 1) expect(Math.abs(standing[i].x - standing[j].x)).toBeGreaterThanOrEqual(plan.spacing * 0.95);
        }
      }
    }
  });

  it.runIf(straight)("keeps each line in order (nobody overtakes)", () => {
    for (const poses of frames) {
      const inLine = visible(poses, plan).filter((pose) => !pose.moving && pose.slot.kind === "queue");
      for (const lane of groupBy(inLine, (pose) => (pose.slot as { lane: number }).lane)) {
        const sorted = lane.sort((left, right) => (left.slot as { index: number }).index - (right.slot as { index: number }).index);
        for (let i = 1; i < sorted.length; i++) expect(sorted[i].x).toBeLessThan(sorted[i - 1].x);
      }
    }
  });

  it.runIf(counterLeft !== null)("never walks through the counter", () => {
    for (const poses of frames) {
      for (const pose of poses) {
        // Anyone at the counter's x range must be on the path in front of it.
        if (pose.x > counterLeft! - 10) expect(pose.y).toBeGreaterThan(CLOSE.full.baseline + 20);
      }
    }
  });

  it("keeps feet above the caption zone", () => {
    for (const poses of frames) for (const pose of visible(poses, plan)) expect(pose.y).toBeLessThan(frame.captionTop);
  });

  it.runIf(straight)("moves up front to back, one after another", () => {
    for (const poses of frames) {
      // Only people who were standing when the line moved (someone still walking in just keeps going).
      const advancing = visible(poses, plan).filter((pose) => pose.previous?.kind === "queue" && pose.slot.kind !== "exit" && pose.startDelay > 0 && pose.slotAge < 2);
      for (const lane of groupBy(advancing, (pose) => (pose.previous as { lane: number }).lane)) {
        const byPlace = lane.sort((left, right) => right.x - left.x);
        for (let i = 1; i < byPlace.length; i++) if (byPlace[i].walkTime > 0) expect(byPlace[i - 1].walkTime).toBeGreaterThan(byPlace[i].walkTime);
      }
    }
  });

  it("stands perfectly still when not walking", () => {
    for (const poses of frames) for (const pose of poses.filter((candidate) => !candidate.moving)) expect(gait(pose, plan.personHeight)).toEqual({ bob: 0 });
  });
});
