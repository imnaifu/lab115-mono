import { rngStream } from "../../core/rng.ts";
import type { QueueConfig } from "./config.ts";

export interface CustomerInput {
  /** 1-based, also the arrival order. */
  id: number;
  arrival: number;
  /** Seconds of service at a speed-1 window. Hidden from strategies until service starts. */
  work: number;
  slow: boolean;
}

export interface QueueInput {
  seed: number;
  customers: CustomerInput[];
}

/**
 * Math.log/exp/cos may differ in the last bit between JS engines (e.g. Node vs Chromium).
 * Rounding inputs to whole milliseconds makes everything downstream (only + − × ÷ and
 * comparisons) bit-identical across engines and machines.
 */
const quantize = (seconds: number) => Math.round(seconds * 1000) / 1000;

/**
 * The world, decided once per seed. Every strategy receives exactly this list, so strategies
 * differ only in how they route people — never in who shows up or how long they take.
 * Each attribute uses its own random stream: changing e.g. slowFraction keeps arrival times.
 */
export function generateQueueInput(config: QueueConfig, seed: number): QueueInput {
  const arrivals = rngStream(seed, "queue.arrivals");
  const works = rngStream(seed, "queue.work");
  const slowness = rngStream(seed, "queue.slow");
  const customers: CustomerInput[] = [];
  let clock = 0;
  for (let i = 0; i < config.customers; i++) {
    // First customer arrives at t=0; later ones after exponential gaps (a Poisson process).
    if (config.arrival.mode === "staggered" && i > 0) clock += arrivals.exponential(config.arrival.meanGap);
    const slow = slowness.next() < config.service.slowFraction;
    const baseWork = works.lognormal(config.service.mean, config.service.cv);
    customers.push({
      id: i + 1,
      arrival: config.arrival.mode === "together" ? 0 : quantize(clock),
      // At least 1 ms so service always takes time.
      work: Math.max(0.001, quantize(baseWork * (slow ? config.service.slowMultiplier : 1))),
      slow,
    });
  }
  return { seed, customers };
}

/** Average work per customer that everyone can know from experience (not the realised values). */
export function expectedWork(config: QueueConfig): number {
  return config.service.mean * (1 + config.service.slowFraction * (config.service.slowMultiplier - 1));
}
