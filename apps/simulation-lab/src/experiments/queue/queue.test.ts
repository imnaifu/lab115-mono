import { describe, expect, it } from "vitest";
import { parseQueueConfig, type QueueConfig } from "./config.ts";
import { generateQueueInput, type QueueInput } from "./input.ts";
import { queueMetrics } from "./metrics.ts";
import { QUEUE_VARIANTS, type QueueRun, simulateQueue } from "./simulate.ts";
import { buildTracks, slotAt, snapshotAt } from "./visual.ts";

const demoConfig = parseQueueConfig({});
const togetherConfig = parseQueueConfig({ arrival: { mode: "together" } });
const busyConfig = parseQueueConfig({ customers: 150, windows: 5, windowSpeeds: [1, 1, 0.6, 1, 1.3], arrival: { meanGap: 11 }, switching: { cost: 0, cooldown: 0, threshold: 0 } });

function manualInput(works: number[], arrivals?: number[]): QueueInput {
  return { seed: 0, customers: works.map((work, i) => ({ id: i + 1, arrival: arrivals?.[i] ?? 0, work, slow: false })) };
}

function checkInvariants(run: QueueRun, input: QueueInput) {
  // Every customer served exactly once, in a legal order.
  expect(run.customers).toHaveLength(input.customers.length);
  const starts = run.events.filter((event) => event.type === "start");
  const ends = run.events.filter((event) => event.type === "end");
  expect(new Set(starts.map((event) => event.customer)).size).toBe(input.customers.length);
  expect(starts).toHaveLength(input.customers.length);
  expect(ends).toHaveLength(input.customers.length);
  for (const customer of run.customers) {
    expect(customer.wait).toBeGreaterThanOrEqual(0);
    expect(customer.serviceStart).toBeGreaterThanOrEqual(customer.arrival);
    expect(customer.serviceEnd).toBeGreaterThan(customer.serviceStart);
    expect(customer.sojourn).toBeCloseTo(customer.wait + customer.service, 9);
    expect(customer.switchTime).toBeLessThanOrEqual(customer.wait + 1e-9);
  }
  // Event log is time-ordered.
  for (let i = 1; i < run.events.length; i++) expect(run.events[i].t).toBeGreaterThanOrEqual(run.events[i - 1].t);
  // A window never serves two people at once.
  for (let window = 0; window < run.windows; window++) {
    const intervals = run.customers.filter((customer) => customer.window === window).sort((left, right) => left.serviceStart - right.serviceStart);
    for (let i = 1; i < intervals.length; i++) expect(intervals[i].serviceStart).toBeGreaterThanOrEqual(intervals[i - 1].serviceEnd);
  }
  // Service duration is exactly work ÷ the window's speed.
  for (const customer of run.customers) expect(customer.service).toBeCloseTo(customer.work / run.windowSpeeds[customer.window], 9);
}

describe("input generation", () => {
  it("is reproducible for a fixed seed", () => {
    expect(generateQueueInput(demoConfig, 42)).toEqual(generateQueueInput(demoConfig, 42));
    expect(generateQueueInput(demoConfig, 42)).not.toEqual(generateQueueInput(demoConfig, 43));
  });

  it("keeps arrivals when only service parameters change (independent random streams)", () => {
    const base = generateQueueInput(demoConfig, 7);
    const moreSlow = generateQueueInput(parseQueueConfig({ service: { slowFraction: 0.3 } }), 7);
    expect(moreSlow.customers.map((customer) => customer.arrival)).toEqual(base.customers.map((customer) => customer.arrival));
  });
});

describe("simulation", () => {
  for (const [name, config] of [["staggered", demoConfig], ["together", togetherConfig], ["uneven windows", busyConfig]] as const) {
    describe(name, () => {
      const input = generateQueueInput(config, 11);
      for (const variant of QUEUE_VARIANTS) {
        it(`${variant}: invariants hold and runs are reproducible`, () => {
          const run = simulateQueue(input, config, variant);
          checkInvariants(run, input);
          expect(simulateQueue(input, config, variant)).toEqual(run);
        });
      }

      it("every strategy sees identical customers", () => {
        for (const variant of QUEUE_VARIANTS) {
          const run = simulateQueue(input, config, variant);
          expect(run.customers.map(({ id, arrival, work, slow }) => ({ id, arrival, work, slow }))).toEqual(input.customers);
        }
      });
    });
  }

  it("does not use anyone's work before their service starts", () => {
    // Change customer k's work: everything that happened before k started must be unchanged.
    const config = busyConfig;
    const input = generateQueueInput(config, 5);
    for (const variant of QUEUE_VARIANTS) {
      const run = simulateQueue(input, config, variant);
      for (const target of [10, 60, 120]) {
        const startedAt = run.customers[target - 1].serviceStart;
        const altered: QueueInput = { ...input, customers: input.customers.map((customer) => (customer.id === target ? { ...customer, work: customer.work * 7 } : customer)) };
        const alteredRun = simulateQueue(altered, config, variant);
        const before = (events: QueueRun["events"]) => events.filter((event) => event.t <= startedAt);
        expect(before(alteredRun.events)).toEqual(before(run.events));
      }
    }
  });

  describe("hand-computed scenarios", () => {
    const config: QueueConfig = parseQueueConfig({
      customers: 4,
      windows: 2,
      service: { mean: 10, cv: 0, slowFraction: 0 },
      switching: { cost: 5, threshold: 1, cooldown: 0, maxSwitches: 2 },
    });

    it("equal work, everyone at t=0", () => {
      const input = manualInput([10, 10, 10, 10]);
      for (const variant of QUEUE_VARIANTS) {
        const metrics = queueMetrics(simulateQueue(input, config, variant));
        // Waits 0, 0, 10, 10.
        expect(metrics.avgWait).toBe(5);
        expect(metrics.medianWait).toBe(5);
        expect(metrics.maxWait).toBe(10);
        expect(metrics.p95Wait).toBeCloseTo(10, 9);
        expect(metrics.makespan).toBe(20);
        expect(metrics.utilization).toBe(1);
      }
    });

    it("one slow customer at the front", () => {
      // Customer 1 needs 100 s; the rest 10 s. Everyone arrives at t=0.
      const input = manualInput([100, 10, 10, 10]);

      // A: #1 → W1 [0,100], #2 → W2 [0,10], #3 → W2 [10,20], #4 → W2 [20,30].
      const single = simulateQueue(input, config, "single");
      expect(single.customers.map((customer) => customer.wait)).toEqual([0, 0, 10, 20]);
      expect(queueMetrics(single).makespan).toBe(100);

      // B: lines fill alternately (#1,#3 → line 1; #2,#4 → line 2). #3 is stuck behind #1.
      const shortest = simulateQueue(input, config, "shortest");
      expect(shortest.customers.map((customer) => customer.firstLane)).toEqual([0, 1, 0, 1]);
      expect(shortest.customers.map((customer) => customer.wait)).toEqual([0, 0, 100, 10]);
      expect(queueMetrics(shortest).avgWait).toBe(27.5);
      expect(queueMetrics(shortest).makespan).toBe(110);

      // C: at t=10 #3 estimates 10 s (W1 busy for 10 s) vs 5 walk + 5 = 10 at W2 → no gain.
      // At t=20 W2 is idle: 20 s vs 5 s walk → switch, arrive t=25, served [25,35].
      const switching = simulateQueue(input, config, "switch");
      expect(switching.customers.map((customer) => customer.wait)).toEqual([0, 0, 25, 10]);
      expect(switching.customers[2]).toMatchObject({ switches: 1, switchTime: 5, window: 1, serviceStart: 25, serviceEnd: 35 });
      expect(queueMetrics(switching).avgWait).toBe(8.75);
      expect(queueMetrics(switching).switches).toBe(1);
    });

    it("respects window speed", () => {
      const slowWindowConfig = parseQueueConfig({ ...config, windows: 1, windowSpeeds: [0.5] });
      const run = simulateQueue(manualInput([10, 10], [0, 0]), slowWindowConfig, "single");
      expect(run.customers.map((customer) => [customer.serviceStart, customer.serviceEnd])).toEqual([[0, 20], [20, 40]]);
    });

    it("cooldown and switch limit stop back-and-forth", () => {
      const input = generateQueueInput(busyConfig, 3);
      const run = simulateQueue(input, parseQueueConfig({ ...busyConfig, switching: { ...busyConfig.switching, maxSwitches: 1 } }), "switch");
      expect(Math.max(...run.customers.map((customer) => customer.switches))).toBeLessThanOrEqual(1);
    });
  });
});

describe("state queries", () => {
  const input = generateQueueInput(demoConfig, 9);
  const run = simulateQueue(input, demoConfig, "switch");
  const tracks = buildTracks(run);

  it("random seeks match sequential playback", () => {
    // Reference: replay the event log incrementally, as a naive player would.
    const times = Array.from({ length: 400 }, (_, i) => (run.end * i) / 399);
    const lanes: number[][] = Array.from({ length: run.laneCount }, () => []);
    let cursor = 0;
    const sequential = times.map((t) => {
      while (cursor < run.events.length && run.events[cursor].t <= t) {
        const event = run.events[cursor++];
        if (event.type === "arrive" || event.type === "switchEnd") lanes[event.lane].push(event.customer);
        if (event.type === "switchStart") lanes[event.from].splice(lanes[event.from].indexOf(event.customer), 1);
        if (event.type === "start") lanes[event.lane].splice(lanes[event.lane].indexOf(event.customer), 1);
      }
      return lanes.map((lane) => lane.length);
    });
    // Query in a scrambled order: results must not depend on what was rendered before.
    const shuffled = times.map((t, i) => ({ t, i })).sort((left, right) => ((left.i * 7919) % 400) - ((right.i * 7919) % 400));
    for (const { t, i } of shuffled) expect(snapshotAt(run, t).laneLengths).toEqual(sequential[i]);
  });

  it("frame rate does not change what is shown at a given moment", () => {
    // Frames at 24 and 60 fps that land on the same instant must see the same state.
    const at24 = Array.from({ length: 24 * 10 }, (_, frame) => frame / 24).filter((_, frame) => frame % 12 === 0);
    for (const t of at24) {
      const t60 = Math.round(t * 60) / 60;
      expect(snapshotAt(run, t60)).toEqual(snapshotAt(run, t));
    }
    // And the run itself is independent of any rendering parameter.
    expect(simulateQueue(input, demoConfig, "switch")).toEqual(run);
  });

  it("tracks agree with records", () => {
    for (const customer of run.customers) {
      const track = tracks.get(customer.id)!;
      expect(slotAt(track, customer.arrival - 1e-6)).toBeNull();
      expect(slotAt(track, customer.serviceStart)).toEqual({ kind: "service", window: customer.window });
      expect(slotAt(track, customer.serviceEnd)).toEqual({ kind: "exit", window: customer.window });
    }
  });
});
