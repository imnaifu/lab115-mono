// Discrete-event simulation of the three queueing rules. Pure: no DOM, no randomness
// (all randomness lives in the input), no wall clock.
//
// Same-time ordering (fixed, so runs are reproducible). At each event time t:
//   1. services ending at t, by window index      (frees windows first)
//   2. switchers reaching their new line, by customer id
//   3. new arrivals, by customer id
//   4. dispatch: every idle window takes the head of its line, by window index
//   5. strategy C only: switching decisions (see decideSwitches)
// Steps repeat if a zero-length switch creates another event at the same t.

import type { QueueConfig } from "./config.ts";
import { expectedWork, type QueueInput } from "./input.ts";

export type QueueVariant = "single" | "shortest" | "switch";
export const QUEUE_VARIANTS: QueueVariant[] = ["single", "shortest", "switch"];

export type QueueEvent =
  | { t: number; type: "arrive"; customer: number; lane: number }
  | { t: number; type: "switchStart"; customer: number; from: number; to: number }
  | { t: number; type: "switchEnd"; customer: number; lane: number }
  | { t: number; type: "start"; customer: number; lane: number; window: number }
  | { t: number; type: "end"; customer: number; window: number };

export interface CustomerRecord {
  id: number;
  arrival: number;
  slow: boolean;
  work: number;
  firstLane: number;
  window: number;
  serviceStart: number;
  serviceEnd: number;
  /** serviceStart - arrival. Includes time spent walking between lines. */
  wait: number;
  /** serviceEnd - serviceStart = work / window speed. */
  service: number;
  /** serviceEnd - arrival. */
  sojourn: number;
  switches: number;
  /** Total seconds spent walking between lines (part of `wait`). */
  switchTime: number;
}

export interface QueueRun {
  variant: QueueVariant;
  laneCount: number;
  windows: number;
  windowSpeeds: number[];
  customers: CustomerRecord[];
  events: QueueEvent[];
  /** Busy seconds per window. */
  windowBusy: number[];
  /** Time the last customer finished. */
  end: number;
}

/** What a customer in line can see. Deliberately excludes anyone's work/remaining service. */
interface VisibleLine {
  waiting: number;
  incoming: number;
  busy: boolean;
  /** How long the current service has been going on — observable, unlike its total length. */
  busyFor: number;
  speed: number;
}

interface Transit {
  customer: number;
  to: number;
  until: number;
}

export function simulateQueue(input: QueueInput, config: QueueConfig, variant: QueueVariant): QueueRun {
  if (!QUEUE_VARIANTS.includes(variant)) throw new Error(`Unknown queue variant "${variant}"`);
  const windowCount = config.windows;
  const laneCount = variant === "single" ? 1 : windowCount;
  const speeds = config.windowSpeeds;
  const switching = config.switching;
  const typicalWork = expectedWork(config);

  const lanes: number[][] = Array.from({ length: laneCount }, () => []);
  const serving: (number | null)[] = Array(windowCount).fill(null);
  const servingSince: number[] = Array(windowCount).fill(0);
  const windowFreeAt: number[] = Array(windowCount).fill(Infinity);
  const windowBusy: number[] = Array(windowCount).fill(0);
  const transits: Transit[] = [];
  const events: QueueEvent[] = [];

  const byId = new Map(input.customers.map((customer) => [customer.id, customer]));
  const arrivalsOrdered = [...input.customers].sort((left, right) => left.arrival - right.arrival || left.id - right.id);
  const records = new Map<number, CustomerRecord>();
  const joinedAt = new Map<number, number>();
  for (const customer of input.customers) {
    records.set(customer.id, {
      id: customer.id,
      arrival: customer.arrival,
      slow: customer.slow,
      work: customer.work,
      firstLane: -1,
      window: -1,
      serviceStart: NaN,
      serviceEnd: NaN,
      wait: NaN,
      service: NaN,
      sojourn: NaN,
      switches: 0,
      switchTime: 0,
    });
  }

  const visibleLine = (lane: number, t: number): VisibleLine => ({
    waiting: lanes[lane].length,
    incoming: transits.filter((transit) => transit.to === lane).length,
    busy: serving[lane] !== null,
    busyFor: serving[lane] !== null ? t - servingSince[lane] : 0,
    speed: switching.speedsVisible ? speeds[lane] : 1,
  });

  /**
   * Estimated seconds until a newcomer with `ahead` people in front would be served.
   * The person at the window is assumed to need max(half a typical service, as long again as
   * they have already taken) — so a visibly stuck window looks worse the longer it stays stuck.
   */
  const estimateWait = (line: VisibleLine, ahead: number): number => {
    const typical = typicalWork / line.speed;
    return ahead * typical + (line.busy ? Math.max(typical / 2, line.busyFor) : 0);
  };

  /** B and C: join the line with the fewest people (waiting + being served + walking towards it). */
  const chooseLane = (t: number): number => {
    if (laneCount === 1) return 0;
    let bestLane = 0;
    let bestCount = Infinity;
    for (let lane = 0; lane < laneCount; lane++) {
      const line = visibleLine(lane, t);
      const count = line.waiting + line.incoming + (line.busy ? 1 : 0);
      if (count < bestCount) {
        bestCount = count;
        bestLane = lane;
      }
    }
    return bestLane;
  };

  const startService = (t: number, window: number, lane: number) => {
    const customerId = lanes[lane].shift()!;
    // The work amount is read only here, when service begins — strategies never see it earlier.
    const duration = byId.get(customerId)!.work / speeds[window];
    serving[window] = customerId;
    servingSince[window] = t;
    windowFreeAt[window] = t + duration;
    windowBusy[window] += duration;
    const record = records.get(customerId)!;
    record.window = window;
    record.serviceStart = t;
    record.wait = t - record.arrival;
    events.push({ t, type: "start", customer: customerId, lane, window });
  };

  const dispatch = (t: number) => {
    for (let window = 0; window < windowCount; window++) {
      if (serving[window] !== null) continue;
      const lane = laneCount === 1 ? 0 : window;
      if (lanes[lane].length > 0) startService(t, window, lane);
    }
  };

  /**
   * Strategy C. Eligible: waiting in a line, past the cooldown since last joining, under the
   * switch limit. Waits are estimated with `estimateWait` from what is visible (people ahead,
   * how long the current service has run, window speed if `speedsVisible`). A switch happens
   * when (current estimate) − (estimate at the other line's tail + walking cost) > threshold.
   * People further back decide first (they have the most to gain), ties by id; each one sees
   * the lines as left by those who decided before them, and people already walking towards a
   * line count as part of it, which prevents everyone rushing the same window.
   */
  const decideSwitches = (t: number) => {
    const candidates: { customer: number; position: number }[] = [];
    lanes.forEach((lane) =>
      lane.forEach((customer, position) => {
        const record = records.get(customer)!;
        if (record.switches >= switching.maxSwitches) return;
        if (t - joinedAt.get(customer)! < switching.cooldown) return;
        candidates.push({ customer, position });
      }),
    );
    candidates.sort((left, right) => right.position - left.position || left.customer - right.customer);

    for (const { customer } of candidates) {
      const currentLane = lanes.findIndex((lane) => lane.includes(customer));
      const ahead = lanes[currentLane].indexOf(customer);
      const currentEstimate = estimateWait(visibleLine(currentLane, t), ahead);
      let bestLane = -1;
      let bestGain = switching.threshold;
      for (let lane = 0; lane < laneCount; lane++) {
        if (lane === currentLane) continue;
        const line = visibleLine(lane, t);
        const estimate = switching.cost + estimateWait(line, line.waiting + line.incoming);
        const gain = currentEstimate - estimate;
        // Strictly greater: equal gains never trigger a move, so lowest-index lane wins ties.
        if (gain > bestGain) {
          bestGain = gain;
          bestLane = lane;
        }
      }
      if (bestLane < 0) continue;
      lanes[currentLane].splice(ahead, 1);
      transits.push({ customer, to: bestLane, until: t + switching.cost });
      const record = records.get(customer)!;
      record.switches += 1;
      record.switchTime += switching.cost;
      events.push({ t, type: "switchStart", customer, from: currentLane, to: bestLane });
    }
  };

  let nextArrival = 0;
  const guardLimit = input.customers.length * (switching.maxSwitches + 4) * 4 + 100;
  for (let step = 0; ; step++) {
    if (step > guardLimit) throw new Error("Queue simulation did not terminate (event guard exceeded)");
    const t = Math.min(
      arrivalsOrdered[nextArrival]?.arrival ?? Infinity,
      ...windowFreeAt,
      ...transits.map((transit) => transit.until),
    );
    if (t === Infinity) break;

    for (let window = 0; window < windowCount; window++) {
      if (windowFreeAt[window] !== t) continue;
      const customerId = serving[window]!;
      const record = records.get(customerId)!;
      record.serviceEnd = t;
      record.service = t - record.serviceStart;
      record.sojourn = t - record.arrival;
      serving[window] = null;
      windowFreeAt[window] = Infinity;
      events.push({ t, type: "end", customer: customerId, window });
    }

    const landing = transits.filter((transit) => transit.until === t).sort((left, right) => left.customer - right.customer);
    for (const transit of landing) {
      transits.splice(transits.indexOf(transit), 1);
      lanes[transit.to].push(transit.customer);
      joinedAt.set(transit.customer, t);
      events.push({ t, type: "switchEnd", customer: transit.customer, lane: transit.to });
    }

    while (nextArrival < arrivalsOrdered.length && arrivalsOrdered[nextArrival].arrival === t) {
      const customer = arrivalsOrdered[nextArrival++];
      const lane = chooseLane(t);
      lanes[lane].push(customer.id);
      joinedAt.set(customer.id, t);
      records.get(customer.id)!.firstLane = lane;
      events.push({ t, type: "arrive", customer: customer.id, lane });
    }

    dispatch(t);
    if (variant === "switch") decideSwitches(t);
  }

  const customers = [...records.values()].sort((left, right) => left.id - right.id);
  return {
    variant,
    laneCount,
    windows: windowCount,
    windowSpeeds: [...speeds],
    customers,
    events,
    windowBusy,
    end: Math.max(0, ...customers.map((customer) => customer.serviceEnd)),
  };
}
