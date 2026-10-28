// Turns a run's event log into per-customer "where should this dot be" tracks, and answers
// state queries for any simulated time directly (no frame-by-frame accumulation), so
// seeking, replaying and exporting at any FPS all show exactly the same picture.

import type { QueueRun } from "./simulate.ts";

export type Slot =
  | { kind: "queue"; lane: number; index: number }
  | { kind: "transit"; from: number; to: number }
  | { kind: "service"; window: number }
  | { kind: "exit"; window: number };

export interface SlotChange {
  t: number;
  slot: Slot;
}

/** Track per customer id, sorted by time; at most one entry per timestamp (the last state at t). */
export type Tracks = Map<number, SlotChange[]>;

export function buildTracks(run: QueueRun): Tracks {
  const tracks: Tracks = new Map(run.customers.map((customer) => [customer.id, []]));
  const lanes: number[][] = Array.from({ length: run.laneCount }, () => []);

  const set = (customer: number, t: number, slot: Slot) => {
    const track = tracks.get(customer)!;
    const last = track[track.length - 1];
    // Several changes at the same instant collapse to the final one.
    if (last && last.t === t) last.slot = slot;
    else track.push({ t, slot });
  };
  const reindex = (lane: number, from: number, t: number) => {
    for (let index = from; index < lanes[lane].length; index++) set(lanes[lane][index], t, { kind: "queue", lane, index });
  };

  for (const event of run.events) {
    switch (event.type) {
      case "arrive":
      case "switchEnd":
        lanes[event.lane].push(event.customer);
        reindex(event.lane, lanes[event.lane].length - 1, event.t);
        break;
      case "switchStart": {
        const index = lanes[event.from].indexOf(event.customer);
        lanes[event.from].splice(index, 1);
        set(event.customer, event.t, { kind: "transit", from: event.from, to: event.to });
        reindex(event.from, index, event.t);
        break;
      }
      case "start": {
        const index = lanes[event.lane].indexOf(event.customer);
        lanes[event.lane].splice(index, 1);
        set(event.customer, event.t, { kind: "service", window: event.window });
        reindex(event.lane, index, event.t);
        break;
      }
      case "end":
        set(event.customer, event.t, { kind: "exit", window: event.window });
        break;
    }
  }
  return tracks;
}

/** Index of the last change at or before t, or -1 if the customer has not arrived yet. */
export function changeIndexAt(track: SlotChange[], t: number): number {
  let low = 0;
  let high = track.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (track[middle].t <= t) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
}

export function slotAt(track: SlotChange[], t: number): Slot | null {
  const index = changeIndexAt(track, t);
  return index < 0 ? null : track[index].slot;
}

export interface QueueSnapshot {
  t: number;
  arrived: number;
  served: number;
  inService: number;
  waiting: number;
  walking: number;
  /** Mean wait of customers whose service has started by t (their wait is final). */
  avgWaitSoFar: number;
  laneLengths: number[];
  /** Customer being served at each window, or null. */
  serving: (number | null)[];
}

/** Numbers shown on screen at time t, computed from the run's records — never hard-coded. */
export function snapshotAt(run: QueueRun, t: number): QueueSnapshot {
  let arrived = 0;
  let served = 0;
  let inService = 0;
  let walking = 0;
  let waitSum = 0;
  let waitCount = 0;
  const serving: (number | null)[] = Array(run.windows).fill(null);
  for (const customer of run.customers) {
    if (customer.arrival > t) continue;
    arrived++;
    if (customer.serviceStart <= t) {
      waitSum += customer.wait;
      waitCount++;
      if (customer.serviceEnd <= t) served++;
      else {
        inService++;
        serving[customer.window] = customer.id;
      }
    }
  }
  const laneLengths: number[] = Array(run.laneCount).fill(0);
  const tracks = buildTracksCached(run);
  for (const track of tracks.values()) {
    const slot = slotAt(track, t);
    if (slot?.kind === "queue") laneLengths[slot.lane]++;
    else if (slot?.kind === "transit") walking++;
  }
  return {
    t,
    arrived,
    served,
    inService,
    waiting: laneLengths.reduce((sum, length) => sum + length, 0),
    walking,
    avgWaitSoFar: waitCount > 0 ? waitSum / waitCount : NaN,
    laneLengths,
    serving,
  };
}

const trackCache = new WeakMap<QueueRun, Tracks>();
export function buildTracksCached(run: QueueRun): Tracks {
  let tracks = trackCache.get(run);
  if (!tracks) {
    tracks = buildTracks(run);
    trackCache.set(run, tracks);
  }
  return tracks;
}
