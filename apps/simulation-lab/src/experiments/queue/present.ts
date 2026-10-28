// Queue presentation: maps a run's state at simulated time t to pixels in a panel rect.
// Used unchanged by the preview and the exporter.

import type { PanelOptions, Rect, ResultsOptions, Scene } from "../../core/experiment.ts";
import { formatDuration, formatPercent } from "../../core/format.ts";
import { clamp01, drawHighlighter, drawTabular, drawText, easeInOut, fillRoundRect, lerpPoint, mixColor, type Point, roundRect, tabularWidth, withAlpha } from "../../render/draw.ts";
import { font, theme } from "../../render/theme.ts";
import { palette } from "../../style/channel.ts";
import type { QueueConfig } from "./config.ts";
import type { QueueInput } from "./input.ts";
import type { CustomerRecord, QueueRun } from "./simulate.ts";
import { buildTracksCached, changeIndexAt, type Slot, type SlotChange, snapshotAt } from "./visual.ts";

type QueueScene = Scene<QueueConfig, QueueInput, QueueRun>;

interface Layout {
  radius: number;
  spacing: number;
  windowCenters: Point[];
  boxWidth: number;
  boxHeight: number;
  servicePoints: Point[];
  entrance: Point;
  slot(lane: number, index: number): Point;
  exit(window: number): Point;
}

// Sized for phone viewing: a 1080p frame is often watched ~6 inches wide.
const HEADER_HEIGHT = 118;
const LEGEND_HEIGHT = 40;

function layoutFor(run: QueueRun, rect: Rect): Layout {
  const windowCount = run.windows;
  const radius = 14;
  const spacing = radius * 2 + 5;
  const columnWidth = rect.w / windowCount;
  const boxWidth = Math.min(176, columnWidth - 18);
  const boxHeight = 68;
  const windowY = rect.y + HEADER_HEIGHT + 16 + boxHeight / 2;
  const windowCenters = Array.from({ length: windowCount }, (_, i) => ({ x: rect.x + columnWidth * (i + 0.5), y: windowY }));
  const servicePoints = windowCenters.map((center) => ({ x: center.x, y: center.y + boxHeight / 2 + radius + 14 }));
  const queueTop = servicePoints[0].y + radius + spacing + 10;
  const queueBottom = rect.y + rect.h - LEGEND_HEIGHT - spacing;
  const rows = Math.max(1, Math.floor((queueBottom - queueTop) / spacing) + 1);

  const slot = (lane: number, index: number): Point => {
    if (run.laneCount === 1) {
      // One shared line snakes back and forth below the windows; head at top-left.
      const perRow = Math.max(4, Math.min(16, Math.floor((rect.w - 80) / spacing)));
      const row = Math.floor(index / perRow);
      const column = index % perRow;
      const left = rect.x + rect.w / 2 - ((perRow - 1) * spacing) / 2;
      const x = left + (row % 2 === 0 ? column : perRow - 1 - column) * spacing;
      return { x, y: queueTop + row * spacing };
    }
    // Separate lines: a column under each window; overflow wraps into extra columns either side.
    const column = Math.floor(index / rows);
    const row = index % rows;
    const maxColumns = Math.max(1, Math.floor((columnWidth - 8) / spacing));
    const wrapped = column % maxColumns;
    const offset = wrapped === 0 ? 0 : (wrapped % 2 === 1 ? 1 : -1) * Math.ceil(wrapped / 2);
    return { x: windowCenters[lane].x + offset * spacing, y: queueTop + row * spacing };
  };

  return {
    radius,
    spacing,
    windowCenters,
    boxWidth,
    boxHeight,
    servicePoints,
    entrance: { x: rect.x + rect.w / 2, y: rect.y + rect.h - LEGEND_HEIGHT },
    slot,
    // Finished customers step sideways off the counter and fade, clear of the window labels.
    exit: (window) => ({ x: servicePoints[window].x + boxWidth / 2 - radius, y: servicePoints[window].y + 4 }),
  };
}

function staticPosition(layout: Layout, slot: Slot): Point {
  switch (slot.kind) {
    case "queue":
      return layout.slot(slot.lane, slot.index);
    case "service":
      return layout.servicePoints[slot.window];
    case "exit":
      return layout.exit(slot.window);
    case "transit":
      return layout.slot(slot.to, 0);
  }
}

/** Position for change `index` evaluated at time t, easing from where the dot was before. */
function positionAt(layout: Layout, track: SlotChange[], index: number, t: number, tween: number, depth = 0): Point {
  const change = track[index];
  const previous = (): Point => (index === 0 || depth > 6 ? layout.entrance : positionAt(layout, track, index - 1, change.t, tween, depth + 1));
  if (change.slot.kind === "transit") {
    // Walking between lines takes exactly the simulated switching time.
    const next = track[index + 1];
    const target = next ? staticPosition(layout, next.slot) : staticPosition(layout, change.slot);
    const span = next ? next.t - change.t : 0;
    return lerpPoint(previous(), target, span > 0 ? easeInOut(clamp01((t - change.t) / span)) : 1);
  }
  const target = staticPosition(layout, change.slot);
  const elapsed = t - change.t;
  if (elapsed >= tween) return target;
  return lerpPoint(previous(), target, easeInOut(clamp01(elapsed / tween)));
}

/** White → pink → red, getting darker as well as warmer, so it reads without hue. */
export function waitColor(seconds: number, redAt: number): string {
  const ratio = clamp01(seconds / redAt);
  return ratio < 0.5 ? mixColor(theme.waitGood, theme.waitMid, ratio * 2) : mixColor(theme.waitMid, theme.waitBad, (ratio - 0.5) * 2);
}

/** A face on the dot: smile → flat → frown → angry brows as `mood` goes 0 → 1. */
function drawFace(ctx: CanvasRenderingContext2D, center: Point, radius: number, mood: number) {
  const ink = palette.ink;
  ctx.fillStyle = ink;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(center.x + side * radius * 0.36, center.y - radius * 0.18, radius * 0.13, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(1.5, radius * 0.13);
  ctx.lineCap = "round";
  ctx.beginPath();
  if (mood < 0.34) {
    ctx.arc(center.x, center.y + radius * 0.05, radius * 0.42, Math.PI * 0.2, Math.PI * 0.8);
  } else if (mood < 0.67) {
    ctx.moveTo(center.x - radius * 0.3, center.y + radius * 0.38);
    ctx.lineTo(center.x + radius * 0.3, center.y + radius * 0.38);
  } else {
    ctx.arc(center.x, center.y + radius * 0.78, radius * 0.4, Math.PI * 1.22, Math.PI * 1.78);
  }
  ctx.stroke();
  if (mood >= 0.85) {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(center.x + side * radius * 0.58, center.y - radius * 0.52);
      ctx.lineTo(center.x + side * radius * 0.16, center.y - radius * 0.36);
      ctx.stroke();
    }
  }
}

/** A small stack of papers: this customer's service is the long one. */
function drawPaperStack(ctx: CanvasRenderingContext2D, center: Point, radius: number) {
  for (let i = 2; i >= 0; i--) {
    const x = center.x + radius * 0.6 + i * 2;
    const y = center.y - radius * 1.5 - i * 4;
    fillRoundRect(ctx, x, y, radius * 1.1, radius * 0.75, 2, i === 0 ? palette.paper : palette.line);
  }
}

function drawCheck(ctx: CanvasRenderingContext2D, center: Point, radius: number) {
  ctx.beginPath();
  ctx.arc(center.x + radius * 0.8, center.y - radius * 0.8, radius * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = theme.done;
  ctx.fill();
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(center.x + radius * 0.58, center.y - radius * 0.8);
  ctx.lineTo(center.x + radius * 0.75, center.y - radius * 0.62);
  ctx.lineTo(center.x + radius * 1.02, center.y - radius * 0.98);
  ctx.stroke();
}

function drawHeader(ctx: CanvasRenderingContext2D, rect: Rect, label: string, color: string, stats: [string, string][]) {
  // The rule's pastel as a small ink-outlined tab; the label itself says which rule.
  fillRoundRect(ctx, rect.x + 22, rect.y + 22, 14, 44, 7, color);
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 2;
  ctx.stroke();
  drawText(ctx, label, rect.x + 48, rect.y + 58, { size: 36, weight: 800, color: theme.text, display: true });
  let x = rect.x + 48;
  for (const [value, caption] of stats) {
    drawTabular(ctx, value, x, rect.y + 104, { size: 30, weight: 800, color: theme.text });
    x += tabularWidth(ctx, value, { size: 30, weight: 800 }) + 10;
    drawText(ctx, caption, x, rect.y + 104, { size: 21, weight: 600, color: theme.textMuted });
    ctx.font = font(21, 600);
    x += ctx.measureText(caption).width + 30;
  }
}

function drawLegend(ctx: CanvasRenderingContext2D, rect: Rect, redAt: number) {
  const y = rect.y + rect.h - 22;
  const left = rect.x + 24;
  drawText(ctx, "just arrived", left, y + 6, { size: 18, weight: 600, color: theme.textMuted });
  ctx.font = font(18, 600);
  const barLeft = left + ctx.measureText("just arrived").width + 12;
  const gradient = ctx.createLinearGradient(barLeft, 0, barLeft + 180, 0);
  gradient.addColorStop(0, theme.waitGood);
  gradient.addColorStop(0.5, theme.waitMid);
  gradient.addColorStop(1, theme.waitBad);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(barLeft, y - 6, 180, 12, 6);
  ctx.fill();
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  drawText(ctx, `waited ${formatDuration(redAt)}+`, barLeft + 192, y + 6, { size: 18, weight: 600, color: theme.textMuted });
}

export function drawQueuePanel(ctx: CanvasRenderingContext2D, scene: QueueScene, variantId: string, t: number, rect: Rect, options: PanelOptions) {
  const run = scene.runs[variantId];
  const variant = scene.experiment.variants.find((candidate) => candidate.id === variantId)!;
  const layout = layoutFor(run, rect);
  const snapshot = snapshotAt(run, t);
  const redAt = scene.config.presentation.waitRedAt;
  const customersById = new Map(run.customers.map((customer) => [customer.id, customer]));

  fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 18, theme.panel);
  ctx.lineWidth = 2;
  ctx.strokeStyle = theme.panelBorder;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 18);
  ctx.stroke();
  drawHeader(ctx, rect, variant.label, variant.color, [
    [`${snapshot.served}/${run.customers.length}`, "served"],
    [formatDuration(snapshot.avgWaitSoFar), "avg wait so far"],
    [String(snapshot.waiting + snapshot.walking), "in line"],
  ]);
  drawLegend(ctx, rect, redAt);

  // Windows.
  layout.windowCenters.forEach((center, window) => {
    const busyId = snapshot.serving[window];
    const busy = busyId !== null ? customersById.get(busyId)! : null;
    const left = center.x - layout.boxWidth / 2;
    const top = center.y - layout.boxHeight / 2;
    fillRoundRect(ctx, left, top, layout.boxWidth, layout.boxHeight, 12, busy ? palette.paper : palette.paperSunk);
    ctx.strokeStyle = busy ? palette.ink : theme.panelBorder;
    ctx.lineWidth = 2;
    roundRect(ctx, left, top, layout.boxWidth, layout.boxHeight, 12);
    ctx.stroke();
    drawText(ctx, `Window ${window + 1}`, center.x, top + 29, { size: 22, weight: 700, color: theme.text, align: "center" });
    const speed = run.windowSpeeds[window];
    const subtitle = busy?.slow ? "slow customer" : speed !== 1 ? `speed ×${speed}` : busy ? "serving" : "idle";
    drawText(ctx, subtitle, center.x, top + 53, { size: 18, weight: busy?.slow ? 800 : 600, color: busy?.slow ? theme.text : theme.textMuted, align: "center" });
    if (busy) {
      const progress = clamp01((t - busy.serviceStart) / (busy.serviceEnd - busy.serviceStart));
      fillRoundRect(ctx, left + 8, top + layout.boxHeight - 8, (layout.boxWidth - 16) * progress, 5, 2, palette.ink);
    }
  });

  // Lane guides for separate lines make "which line am I in" readable.
  if (run.laneCount > 1) {
    ctx.strokeStyle = withAlpha(theme.panelBorder, 0.7);
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 8]);
    for (let lane = 1; lane < run.laneCount; lane++) {
      const x = rect.x + (rect.w / run.laneCount) * lane;
      ctx.beginPath();
      ctx.moveTo(x, layout.servicePoints[0].y + layout.radius + 10);
      ctx.lineTo(x, rect.y + rect.h - LEGEND_HEIGHT - 6);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  // Customers. The focused one is drawn last so it sits on top.
  const tracks = buildTracksCached(run);
  const focusId = options.focus?.entityId;
  for (const customer of run.customers) {
    if (customer.id !== focusId) drawCustomer(ctx, layout, tracks.get(customer.id)!, customer, t, run.end, redAt, options, false);
  }
  if (focusId !== undefined) drawCustomer(ctx, layout, tracks.get(focusId)!, customersById.get(focusId)!, t, run.end, redAt, options, true);
}

function drawCustomer(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  track: SlotChange[],
  customer: CustomerRecord,
  t: number,
  runEnd: number,
  redAt: number,
  options: PanelOptions,
  isFocus: boolean,
) {
  const index = changeIndexAt(track, t);
  if (index < 0) return;
  const slot = track[index].slot;
  let alpha = options.dimOthers && !isFocus ? 0.2 : 1;
  let exiting = false;
  if (slot.kind === "exit") {
    const fade = clamp01((t - track[index].t) / options.tweenSeconds);
    // The followed customer stays visible after finishing, so both panels can be compared.
    if (!isFocus) {
      // Once everyone is done the picture is final — no half-faded leftovers on a frozen frame.
      if (fade >= 1 || t >= runEnd) return;
      alpha *= 1 - fade;
    }
    exiting = true;
  }
  const position = positionAt(layout, track, index, t, options.tweenSeconds);
  const waited = slot.kind === "queue" || slot.kind === "transit" ? t - customer.arrival : customer.wait;
  const radius = layout.radius * (exiting && !isFocus ? 1 + 0.25 * Math.sin(Math.PI * clamp01((t - track[index].t) / options.tweenSeconds)) : 1);
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(position.x, position.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = waitColor(waited, redAt);
  ctx.fill();
  // Ink outline: a fresh (white) customer must still read on the white panel.
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 2;
  ctx.stroke();
  if (slot.kind === "transit") {
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = theme.transit;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (options.showIds) {
    drawText(ctx, String(customer.id), position.x, position.y + 0.5, { size: customer.id >= 100 ? 10 : 13, weight: 800, color: palette.ink, align: "center", baseline: "middle" });
  } else {
    // Relief once called to a window; done customers smile.
    const mood = exiting ? 0 : slot.kind === "service" ? clamp01(waited / redAt) * 0.6 : clamp01(waited / redAt);
    drawFace(ctx, position, radius, mood);
  }
  if (slot.kind === "service") {
    const progress = clamp01((t - customer.serviceStart) / (customer.serviceEnd - customer.serviceStart));
    ctx.beginPath();
    ctx.arc(position.x, position.y, radius + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    ctx.strokeStyle = theme.text;
    ctx.lineWidth = 3;
    ctx.stroke();
    if (customer.slow) drawPaperStack(ctx, position, radius);
  }
  if (exiting) drawCheck(ctx, position, radius);
  if (isFocus) drawFocusMarker(ctx, position, radius, options.focus!.label, waited, exiting);
  ctx.globalAlpha = 1;
}

function drawFocusMarker(ctx: CanvasRenderingContext2D, position: Point, radius: number, label: string, waited: number, done: boolean) {
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(position.x, position.y, radius + 9, 0, Math.PI * 2);
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(position.x, position.y, radius + 12, 0, Math.PI * 2);
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 2;
  ctx.stroke();
  const text = done ? `${label} · served after ${formatDuration(waited)}` : `${label} · waiting ${formatDuration(waited)}`;
  ctx.font = font(24, 800);
  const width = ctx.measureText(text).width + 28;
  // Below the dot: above it would cover the window labels while the customer is served.
  const top = position.y + radius + 14;
  fillRoundRect(ctx, position.x - width / 2, top, width, 40, 20, theme.accent);
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 2;
  ctx.stroke();
  drawTabular(ctx, text, position.x, top + 29, { size: 24, weight: 800, color: theme.onAccent, align: "center" });
}

const RESULT_METRICS: [string, string][] = [
  ["avgWait", "Average wait"],
  ["medianWait", "Typical (median)"],
  ["p95Wait", "Worst 5% (P95)"],
  ["maxWait", "Longest wait"],
];

export function drawQueueResults(ctx: CanvasRenderingContext2D, scene: QueueScene, rect: Rect, progress: number, options: ResultsOptions) {
  const variants = scene.experiment.variants;
  const hasBatch = scene.batch !== null;
  const leftWidth = hasBatch ? rect.w * 0.6 : rect.w;
  const emphasis = new Set(options.emphasis);

  // Left: this single run. Metric groups are revealed one after another for a bit of suspense.
  fillRoundRect(ctx, rect.x, rect.y, leftWidth - 16, rect.h, 18, theme.panel);
  drawText(ctx, `This run (seed ${scene.seed})`, rect.x + 32, rect.y + 54, { size: 34, weight: 800, color: theme.text });
  drawText(ctx, "one random draw — not a general rule", rect.x + 32, rect.y + 88, { size: 21, weight: 600, color: theme.textMuted });
  const scaleMax = Math.max(...variants.flatMap((variant) => RESULT_METRICS.map(([key]) => scene.metrics[variant.id][key])));
  const groupTop = rect.y + 116;
  const groupHeight = (rect.h - 136) / RESULT_METRICS.length;
  const barHeight = Math.min(32, (groupHeight - 40) / variants.length - 6);
  const labelWidth = 272;
  const barLeft = rect.x + 32 + labelWidth;
  const barMaxWidth = leftWidth - 16 - labelWidth - 32 - 120;
  RESULT_METRICS.forEach(([key, label], group) => {
    const grow = easeInOut(clamp01((progress - group * 0.18) / 0.4));
    const top = groupTop + group * groupHeight;
    const emphasised = emphasis.has(key);
    ctx.globalAlpha = emphasis.size > 0 && !emphasised ? 0.3 : 1;
    if (emphasised) {
      ctx.font = font(26, 800);
      drawHighlighter(ctx, rect.x + 32, top + 34, ctx.measureText(label).width, 26);
    }
    drawText(ctx, label, rect.x + 32, top + 34, { size: 26, weight: 800, color: theme.text });
    variants.forEach((variant, i) => {
      const value = scene.metrics[variant.id][key];
      const y = top + 12 + i * (barHeight + 6);
      const width = Math.max(2, (value / scaleMax) * barMaxWidth * grow);
      fillRoundRect(ctx, barLeft, y, width, barHeight, 6, variant.color);
      ctx.strokeStyle = palette.ink;
      ctx.lineWidth = 2;
      ctx.stroke();
      drawText(ctx, variant.short, barLeft - 14, y + barHeight / 2 + 1, { size: 22, weight: 800, color: theme.text, align: "right", baseline: "middle" });
      if (grow > 0) drawTabular(ctx, formatDuration(value * grow), barLeft + width + 12, y + barHeight / 2 + 8, { size: 24, weight: 700, color: theme.text });
    });
    ctx.globalAlpha = 1;
  });

  if (!scene.batch) return;
  // Right: many seeds — this is what supports a general statement.
  const batch = scene.batch;
  const left = rect.x + leftWidth + 16;
  const width = rect.w - leftWidth - 16;
  fillRoundRect(ctx, left, rect.y, width, rect.h, 18, theme.panel);
  drawText(ctx, `Across ${batch.seeds.length} random runs`, left + 32, rect.y + 54, { size: 34, weight: 800, color: theme.text });
  const metricKey = emphasis.size > 0 ? [...emphasis][0] : "avgWait";
  const metricLabel = RESULT_METRICS.find(([key]) => key === metricKey)?.[1] ?? metricKey;
  drawText(ctx, `${metricLabel.toLowerCase()} · bar = mean, line = 10th–90th pct`, left + 32, rect.y + 88, { size: 20, weight: 600, color: theme.textMuted });
  const summaries = variants.map((variant) => batch.summary[variant.id][metricKey]);
  const axisMax = Math.max(...summaries.map((summary) => summary.p90)) * 1.08;
  const chartLeft = left + 80;
  const chartWidth = width - 80 - 130;
  const rowHeight = Math.min(140, (rect.h - 130) / variants.length);
  const grow = easeInOut(clamp01((progress - 0.3) / 0.5));
  variants.forEach((variant, i) => {
    const summary = summaries[i];
    const y = rect.y + 126 + i * rowHeight;
    const barWidth = (summary.mean / axisMax) * chartWidth * grow;
    drawText(ctx, variant.short, left + 46, y + 32, { size: 32, weight: 800, color: theme.text, align: "center" });
    fillRoundRect(ctx, chartLeft, y + 4, Math.max(2, barWidth), 44, 8, variant.color);
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 2;
    ctx.stroke();
    const whiskerLeft = chartLeft + (summary.p10 / axisMax) * chartWidth * grow;
    const whiskerRight = chartLeft + (summary.p90 / axisMax) * chartWidth * grow;
    ctx.strokeStyle = theme.text;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(whiskerLeft, y + 26);
    ctx.lineTo(whiskerRight, y + 26);
    ctx.moveTo(whiskerLeft, y + 14);
    ctx.lineTo(whiskerLeft, y + 38);
    ctx.moveTo(whiskerRight, y + 14);
    ctx.lineTo(whiskerRight, y + 38);
    ctx.stroke();
    drawTabular(ctx, formatDuration(summary.mean * grow), chartLeft + chartWidth + 16, y + 36, { size: 28, weight: 800, color: theme.text });
    if (metricKey === batch.winMetric) {
      const winShare = batch.wins[variant.id] / batch.seeds.length;
      drawText(ctx, `lowest in ${batch.wins[variant.id]} of ${batch.seeds.length} runs (${formatPercent(winShare)})`, chartLeft, y + 80, { size: 21, weight: 600, color: theme.textMuted });
    }
  });
}
