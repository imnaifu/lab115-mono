import type { Experiment, Focus, Scene, SoundCue } from "../../core/experiment.ts";
import { formatDuration } from "../../core/format.ts";
import { spokenDuration } from "../../core/narration.ts";
import { seriesColors } from "../../style/channel.ts";
import { defaultQueueConfig, parseQueueConfig, type QueueConfig } from "./config.ts";
import { generateQueueInput, type QueueInput } from "./input.ts";
import { QUEUE_METRICS, queueMetrics } from "./metrics.ts";
import { drawLaneShot } from "./lane.ts";
import { drawSplitShot } from "./split.ts";
import { drawWideShot } from "./wide.ts";
import { drawQueuePanel, drawQueueResults } from "./present.ts";
import { type QueueRun, type QueueVariant, simulateQueue } from "./simulate.ts";

type QueueScene = Scene<QueueConfig, QueueInput, QueueRun>;

/**
 * `{ "id": 37 }` follows a given customer. `{ "pick": "maxWaitGap" }` picks the one whose wait
 * differs most between two variants; `arrivalWindow: [0.3, 0.75]` limits the pick to customers
 * arriving within that fraction of the arrival period, so the story can build up before it.
 */
type FocusSpec = { id: number } | { pick: "maxWaitGap"; between?: [string, string]; arrivalWindow?: [number, number] };

function resolveFocus(scene: QueueScene, raw: unknown): Focus | null {
  const spec = raw as FocusSpec;
  if (spec && typeof spec === "object" && "id" in spec) {
    if (!scene.input.customers.some((customer) => customer.id === spec.id)) throw new Error(`Focus customer #${spec.id} does not exist`);
    return { entityId: spec.id, label: `#${spec.id}` };
  }
  if (spec && typeof spec === "object" && "pick" in spec && spec.pick === "maxWaitGap") {
    const [leftId, rightId] = spec.between ?? scene.story.compare;
    const leftRun = scene.runs[leftId];
    const rightRun = scene.runs[rightId];
    if (!leftRun || !rightRun) throw new Error(`Focus "maxWaitGap" needs two known variants, got ${leftId}, ${rightId}`);
    const lastArrival = Math.max(...scene.input.customers.map((customer) => customer.arrival));
    const [fromFraction, toFraction] = spec.arrivalWindow ?? [0, 1];
    const eligible = leftRun.customers.filter((customer) => customer.arrival >= fromFraction * lastArrival && customer.arrival <= toFraction * lastArrival);
    let bestId = -1;
    let bestGap = -1;
    // Ascending ids + strict ">" make ties resolve to the lowest id.
    for (const customer of eligible.length > 0 ? eligible : leftRun.customers) {
      const gap = Math.abs(customer.wait - rightRun.customers[customer.id - 1].wait);
      if (gap > bestGap) {
        bestGap = gap;
        bestId = customer.id;
      }
    }
    return bestId > 0 ? { entityId: bestId, label: `#${bestId}` } : null;
  }
  throw new Error(`Unknown focus spec ${JSON.stringify(raw)}. Use {"id": n} or {"pick": "maxWaitGap"}`);
}

function compared(scene: QueueScene): QueueRun[] {
  return scene.story.compare.map((id) => scene.runs[id]);
}

/** Slow customers served at the focus customer's window while the focus customer was waiting. */
function slowAheadOf(run: QueueRun, focusId: number): number {
  const focus = run.customers[focusId - 1];
  return run.customers.filter(
    (other) => other.slow && other.id !== focusId && other.window === focus.window && other.serviceEnd > focus.arrival && other.serviceStart < focus.serviceStart,
  ).length;
}

/** focus.left.* / focus.right.* follow the story's main comparison. */
function aliasFocus<T>(scene: QueueScene, table: Record<string, T>) {
  scene.story.compare.slice(0, 2).forEach((variantId, i) => {
    const prefix = `focus.${variantId}.`;
    for (const [key, value] of Object.entries(table)) {
      if (key.startsWith(prefix)) table[`focus.${i === 0 ? "left" : "right"}.${key.slice(prefix.length)}`] = value;
    }
  });
}

// Pentatonic pitch per window, so the "served" dings sound musical rather than random.
const WINDOW_PITCH = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2, 9 / 4, 5 / 2, 3, 10 / 3, 4, 9 / 2];

export const queueExperiment: Experiment<QueueConfig, QueueInput, QueueRun> = {
  id: "queue",
  meta: {
    title: "Which queueing rule makes everyone wait the least?",
    summary: "Customers arrive at a row of service windows. The same customers are routed by three different rules and we compare their waits.",
    assumptions: [
      "Every rule sees the exact same customers: same arrival times, same amount of work each.",
      "Work per customer is lognormal around the configured mean; a configured share of 'slow' customers need several times more.",
      "Service time = work ÷ window speed. Nobody knows a customer's work before their service starts.",
      "B and C: a newcomer joins the line with the fewest people (waiting + being served + walking towards it); ties go to the lowest window number.",
      "C: customers reconsider only when something happens (an arrival, a service ending, someone switching). They estimate each line's wait as people ahead × average service time, plus — for the person at the window — max(half an average service, as long again as that person has already been there). They switch if the saving exceeds the walking cost plus a threshold. A cooldown and a switch limit stop back-and-forth.",
      "Walking between lines takes a fixed time and counts as waiting; the person is in no line meanwhile.",
      "Events at the same instant: service ends → switchers arrive → newcomers arrive → idle windows call the next person → switching decisions.",
      "No balking, reneging, priority customers or breaks. Windows never idle while someone is in their line.",
    ],
    metrics: QUEUE_METRICS,
    primaryMetric: "avgWait",
    lowerIsBetter: true,
  },
  variants: [
    { id: "single", short: "A", name: "One line", label: "A · One shared line", color: seriesColors[0], description: "Everyone waits in one line; the person at the front goes to the next free window." },
    { id: "shortest", short: "B", name: "Pick a line", label: "B · Shortest line, stay put", color: seriesColors[1], description: "Each window has its own line. Newcomers join the shortest line and never switch." },
    { id: "switch", short: "C", name: "Switch if worth it", label: "C · Shortest line + switching", color: seriesColors[2], description: "Like B, but people switch lines when they estimate a clear saving (with walking cost and cooldown)." },
  ],
  defaultConfig: defaultQueueConfig,
  controls: [
    { path: "arrival.mode", label: "Arrivals", type: "select", options: [{ value: "staggered", label: "Staggered (random)" }, { value: "together", label: "All at once" }] },
    { path: "customers", label: "Customers", type: "number", min: 1, max: 2000, step: 1 },
    { path: "windows", label: "Windows", type: "number", min: 1, max: 12, step: 1 },
    { path: "arrival.meanGap", label: "Mean gap between arrivals (s)", type: "number", min: 1, step: 1 },
    { path: "service.mean", label: "Mean work (s)", type: "number", min: 1, step: 1 },
    { path: "service.cv", label: "Work variability (CV)", type: "number", min: 0, max: 3, step: 0.05 },
    { path: "service.slowFraction", label: "Slow customer share", type: "number", min: 0, max: 1, step: 0.01 },
    { path: "service.slowMultiplier", label: "Slow customer ×work", type: "number", min: 1, step: 0.5 },
    { path: "windowSpeeds", label: "Window speeds (comma list)", type: "text", help: "e.g. 1,1,1,0.6" },
    { path: "switching.cost", label: "Switching walk (s)", type: "number", min: 0, step: 1 },
    { path: "switching.threshold", label: "Switch threshold (s)", type: "number", min: 0, step: 1 },
    { path: "switching.cooldown", label: "Switch cooldown (s)", type: "number", min: 0, step: 1 },
    { path: "switching.maxSwitches", label: "Max switches per person", type: "number", min: 0, step: 1 },
  ],

  parseConfig: parseQueueConfig,
  generateInput: generateQueueInput,
  simulate: (input, config, variantId) => simulateQueue(input, config, variantId as QueueVariant),
  endTime: (run) => run.end,
  metrics: queueMetrics,
  records: (run) => run.customers.map((customer) => ({ ...customer })),
  events: (run) => run.events,

  anchors(scene) {
    const anchors: Record<string, number> = {
      lastArrival: Math.max(...scene.input.customers.map((customer) => customer.arrival)),
      // First service to finish in the compared runs — e.g. "someone leaves, the line moves up".
      firstEnd: Math.min(...scene.story.compare.map((id) => Math.min(...scene.runs[id].customers.map((customer) => customer.serviceEnd)))),
    };
    for (const [id, run] of Object.entries(scene.runs)) {
      anchors[`${id}.end`] = run.end;
      const firstSlow = run.customers.filter((customer) => customer.slow).sort((left, right) => left.serviceStart - right.serviceStart)[0];
      if (firstSlow) anchors[`${id}.firstSlowStart`] = firstSlow.serviceStart;
    }
    if (scene.focus) {
      const records = compared(scene).map((run) => run.customers[scene.focus!.entityId - 1]);
      anchors["focus.arrival"] = records[0].arrival;
      anchors["focus.firstStart"] = Math.min(...records.map((record) => record.serviceStart));
      anchors["focus.lastStart"] = Math.max(...records.map((record) => record.serviceStart));
      anchors["focus.lastEnd"] = Math.max(...records.map((record) => record.serviceEnd));
    }
    return anchors;
  },

  spokenVars(scene) {
    const language = scene.story.language ?? "en";
    const spoken: Record<string, string> = {
      switchCost: spokenDuration(scene.config.switching.cost, language),
      meanWork: spokenDuration(scene.config.service.mean, language),
      waitRedAt: spokenDuration(scene.config.presentation.waitRedAt, language),
    };
    if (scene.focus) {
      for (const [id, run] of Object.entries(scene.runs)) spoken[`focus.${id}.wait`] = spokenDuration(run.customers[scene.focus.entityId - 1].wait, language);
      spoken["focus.label"] = language === "zh" ? `${scene.focus.entityId}号` : `number ${scene.focus.entityId}`;
      aliasFocus(scene, spoken);
    }
    return spoken;
  },

  templateValues(scene) {
    const values: Record<string, number> = { customers: scene.config.customers, windows: scene.config.windows };
    if (scene.focus) {
      for (const [id, run] of Object.entries(scene.runs)) {
        const record = run.customers[scene.focus.entityId - 1];
        values[`focus.${id}.wait`] = record.wait;
        values[`focus.${id}.switches`] = record.switches;
        values[`focus.${id}.slowAhead`] = slowAheadOf(run, scene.focus.entityId);
      }
      aliasFocus(scene, values);
    }
    return values;
  },

  soundCues(scene, variantId) {
    const run = scene.runs[variantId];
    const focusId = scene.focus?.entityId;
    const cues: SoundCue[] = [];
    for (const event of run.events) {
      if (event.type === "end") {
        cues.push(event.customer === focusId ? { simTime: event.t, cue: "chime", gain: 1 } : { simTime: event.t, cue: "ding", pitch: WINDOW_PITCH[event.window % WINDOW_PITCH.length], gain: 0.6 });
      } else if (event.type === "switchStart") {
        cues.push({ simTime: event.t, cue: "whoosh", gain: 0.7 });
      }
    }
    return cues;
  },

  templateVars(scene) {
    const vars: Record<string, string> = {
      customers: String(scene.config.customers),
      windows: String(scene.config.windows),
      slowCount: String(scene.input.customers.filter((customer) => customer.slow).length),
      switchCost: formatDuration(scene.config.switching.cost),
      meanWork: formatDuration(scene.config.service.mean),
      waitRedAt: formatDuration(scene.config.presentation.waitRedAt),
    };
    if (scene.focus) {
      const focusId = scene.focus.entityId;
      vars["focus.id"] = String(focusId);
      vars["focus.label"] = scene.focus.label;
      // Same arrival in every run (shared input): shown as time since opening.
      vars["focus.arrival"] = formatDuration(scene.input.customers[focusId - 1].arrival);
      for (const [id, run] of Object.entries(scene.runs)) {
        const record = run.customers[focusId - 1];
        vars[`focus.${id}.wait`] = formatDuration(record.wait);
        vars[`focus.${id}.window`] = String(record.window + 1);
        vars[`focus.${id}.switches`] = String(record.switches);
      }
      scene.story.compare.slice(0, 2).forEach((id, i) => {
        const alias = i === 0 ? "left" : "right";
        for (const key of ["wait", "window", "switches"]) vars[`focus.${alias}.${key}`] = vars[`focus.${id}.${key}`];
      });
    }
    return vars;
  },

  resolveFocus,
  drawPanel: drawQueuePanel,
  drawResults: drawQueueResults,
  drawShot(ctx, scene, shot, simTime, rect, options) {
    if (shot.type === "lane") return drawLaneShot(ctx, scene, shot, simTime, rect, options);
    if (shot.type === "wide") return drawWideShot(ctx, scene, shot, simTime, rect, options);
    if (shot.type === "split") return drawSplitShot(ctx, scene, shot, simTime, rect, options);
    throw new Error(`Unknown shot type "${shot.type}" for the queue experiment (available: lane, wide, split)`);
  },
};
