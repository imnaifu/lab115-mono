import { mergeConfig } from "../../core/scene.ts";

export type ArrivalMode = "together" | "staggered";

export interface QueueConfig {
  customers: number;
  windows: number;
  /** Relative speed per window (1 = normal). Service duration = work / speed. */
  windowSpeeds: number[];
  arrival: {
    /** "together": everyone is at the door at t=0. "staggered": Poisson arrivals. */
    mode: ArrivalMode;
    /** Mean gap between arrivals in seconds (staggered only). */
    meanGap: number;
  };
  service: {
    /** Mean work per ordinary customer, in seconds at speed 1. */
    mean: number;
    /** Coefficient of variation of the lognormal work distribution. */
    cv: number;
    /** Share of customers whose work is multiplied by `slowMultiplier`. */
    slowFraction: number;
    slowMultiplier: number;
  };
  switching: {
    /** Seconds spent walking between lines; the customer is in no line meanwhile. */
    cost: number;
    /** Minimum estimated saving (seconds, after paying `cost`) needed to switch. */
    threshold: number;
    /** Seconds after joining a line before the customer reconsiders. */
    cooldown: number;
    maxSwitches: number;
    /** Whether customers know each window's speed when estimating waits. */
    speedsVisible: boolean;
  };
  presentation: {
    /** Waiting time (seconds) at which a dot turns fully red. */
    waitRedAt: number;
  };
}

export const defaultQueueConfig: QueueConfig = {
  customers: 100,
  windows: 4,
  windowSpeeds: [1, 1, 1, 1],
  arrival: { mode: "staggered", meanGap: 18 },
  service: { mean: 60, cv: 0.5, slowFraction: 0.08, slowMultiplier: 5 },
  switching: { cost: 10, threshold: 30, cooldown: 60, maxSwitches: 2, speedsVisible: true },
  presentation: { waitRedAt: 600 },
};

function check(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid queue config: ${message}`);
}

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function parseQueueConfig(raw: unknown): QueueConfig {
  const config = mergeConfig(defaultQueueConfig, raw ?? {}) as QueueConfig;
  check(Number.isInteger(config.customers) && config.customers >= 1 && config.customers <= 2000, "customers must be an integer in 1..2000");
  check(Number.isInteger(config.windows) && config.windows >= 1 && config.windows <= 12, "windows must be an integer in 1..12");

  // Window count often changes in the preview; pad/trim speeds instead of rejecting.
  const speeds = Array.isArray(config.windowSpeeds) ? config.windowSpeeds : [];
  config.windowSpeeds = Array.from({ length: config.windows }, (_, i) => speeds[i] ?? 1);
  check(config.windowSpeeds.every((speed) => isNumber(speed) && speed > 0), "windowSpeeds must be positive numbers");

  check(config.arrival.mode === "together" || config.arrival.mode === "staggered", 'arrival.mode must be "together" or "staggered"');
  check(isNumber(config.arrival.meanGap) && config.arrival.meanGap > 0, "arrival.meanGap must be > 0");
  check(isNumber(config.service.mean) && config.service.mean > 0, "service.mean must be > 0");
  check(isNumber(config.service.cv) && config.service.cv >= 0 && config.service.cv <= 3, "service.cv must be in 0..3");
  check(isNumber(config.service.slowFraction) && config.service.slowFraction >= 0 && config.service.slowFraction <= 1, "service.slowFraction must be in 0..1");
  check(isNumber(config.service.slowMultiplier) && config.service.slowMultiplier >= 1, "service.slowMultiplier must be >= 1");
  check(isNumber(config.switching.cost) && config.switching.cost >= 0, "switching.cost must be >= 0");
  check(isNumber(config.switching.threshold) && config.switching.threshold >= 0, "switching.threshold must be >= 0");
  check(isNumber(config.switching.cooldown) && config.switching.cooldown >= 0, "switching.cooldown must be >= 0");
  check(Number.isInteger(config.switching.maxSwitches) && config.switching.maxSwitches >= 0, "switching.maxSwitches must be an integer >= 0");
  check(typeof config.switching.speedsVisible === "boolean", "switching.speedsVisible must be true or false");
  check(isNumber(config.presentation.waitRedAt) && config.presentation.waitRedAt > 0, "presentation.waitRedAt must be > 0");
  return config;
}
