"use client";

import { ResponsiveBar, type BarDatum } from "@nivo/bar";
import { ResponsiveLine } from "@nivo/line";
import { ResponsiveScatterPlot } from "@nivo/scatterplot";
import type { ReactNode } from "react";

/**
 * The charts `/admin` is drawn with — Nivo, wrapped so nothing else sees it.
 *
 * IT WAS HAND-WRITTEN SVG FIRST, twice: once with an SVG `<title>` per mark as
 * the hover, then with a delegated pointer layer of my own. Both worked and
 * neither looked good enough. What a library actually buys is not the geometry —
 * that part is arithmetic — it is the hundred small finishes nobody wants to
 * write: tick algorithms that pick round numbers and then avoid collisions, axis
 * legends placed off the plot, transitions when the numbers change, a tooltip
 * positioned against the viewport rather than its container, and hit areas that
 * are already right.
 *
 * WHY NIVO AND NOT THE OTHERS, measured for exactly the subset these charts
 * need — react excluded, minified, gzipped:
 *
 *   visx           24 KB   primitives only. The design work stays mine, and the
 *                          design work is what was not good enough
 *   Chart.js       59 KB   CANVAS. It cannot read `var(--chart-accent)`, and
 *                          this site's dark mode is `light-dark()` in CSS — the
 *                          validated palette would need a JS bridge and a
 *                          theme-change listener to survive at all
 *   Nivo          109 KB   SVG, best defaults, 24 packages, no state library
 *   Recharts      118 KB   SVG, but pulls @reduxjs/toolkit, react-redux, immer
 *                          and reselect: a state manager inside a chart library
 *   Observable    136 KB   imperative — render into a node through an effect
 *   ECharts       196 KB   most capable interactions, twice Nivo's weight, and
 *                          an options-object API unlike anything else here
 *
 * The lightest thing that is a finished chart rather than a box of parts.
 *
 * WHAT SURVIVED THE REWRITES is the part worth keeping: the palette. Three
 * marks, each with one fixed job, snapped to a passing step per mode and
 * validated — see `--chart-*` in index.css. Nivo renders SVG, so those CSS
 * variables land in `fill` and keep working across the theme switch with no
 * JavaScript watching anything.
 *
 * NO FUNCTION PROPS CROSS THE BOUNDARY. `AdminOverview` is a server component,
 * so every prop here is plain data; the colour pickers, tooltips and formatters
 * all live inside this file.
 */

/** The three mark colours, by the job they do. See index.css. */
export const MARK = {
  accent: "var(--chart-accent)",
  cool: "var(--chart-cool)",
  mute: "var(--chart-mute)",
} as const;

export type MarkTone = keyof typeof MARK;

const INK = "var(--color-ink)";
const INK_MID = "var(--color-ink-mid)";
const INK_SOFT = "var(--color-ink-soft)";
const GRID = "var(--color-line)";
const SURFACE = "var(--color-paper)";

/**
 * The chart theme, in the site's own tokens.
 *
 * NIVO'S DEFAULT IS A LIGHT-MODE CHART — near-black text, a grey grid, a white
 * tooltip. On the dark side of this site that is a white-ish chart floating on an
 * indigo page. Every value here is a CSS variable instead, so the charts flip
 * with the rest of the page and nothing has to watch the theme.
 *
 * SOLID HAIRLINES. A dashed grid reads as a projection or a threshold when it is
 * neither, which is what leaves the real thresholds — the markers below — as the
 * only lines on these charts that look like they mean something.
 *
 * TEXT WEARS TEXT TOKENS, never a mark colour.
 */
const THEME = {
  text: { fill: INK_SOFT, fontFamily: "inherit", fontSize: 11 },
  axis: {
    domain: { line: { stroke: GRID, strokeWidth: 1 } },
    ticks: {
      line: { stroke: "transparent" },
      text: { fill: INK_SOFT, fontSize: 10 },
    },
    legend: { text: { fill: INK_SOFT, fontSize: 10, fontWeight: 700 } },
  },
  grid: { line: { stroke: GRID, strokeWidth: 1 } },
  /**
   * THE VALUE LABELS THAT RIDE THE BARS, and leaving this out is a bug that only
   * shows on one theme.
   *
   * Nivo's `labelTextColor` defaults to `{ theme: "labels.text.fill" }`, so with
   * no `labels` entry here it fell through to Nivo's own near-black — which
   * looks fine on cream and is nearly invisible on the dark page. Every other
   * text token was overridden and this one was missed precisely because the
   * light side looked right.
   */
  labels: { text: { fill: INK, fontSize: 10, fontWeight: 700 } },
  crosshair: { line: { stroke: INK_SOFT, strokeWidth: 1, strokeOpacity: 1 } },
  annotations: {
    text: { fill: INK_MID, fontSize: 10, fontWeight: 700 },
    link: { stroke: INK_SOFT, strokeWidth: 1 },
  },
  // Nivo's own tooltip wrapper is stripped so `Tip` below is the whole thing.
  tooltip: {
    container: { background: "transparent", boxShadow: "none", padding: 0 },
  },
} as const;

/**
 * The tooltip body, shared by every chart.
 *
 * ONE COMPONENT so the hover chrome is identical everywhere, in the site's card
 * styling. The swatch carries identity and the text stays a text token — the
 * same rule the legend follows.
 */
function Tip({
  title,
  rows,
}: {
  title?: string;
  rows: { label: string; value: ReactNode; tone?: MarkTone }[];
}) {
  return (
    <div className="rounded-xl border border-line bg-paper px-3 py-2 shadow-soft">
      {title ? <div className="text-xs font-bold text-ink">{title}</div> : null}
      <div className={`flex flex-col gap-0.5 ${title ? "mt-1" : ""}`}>
        {rows.map((row) => (
          <div
            className="flex items-baseline gap-2 text-xs whitespace-nowrap"
            key={row.label}
          >
            {row.tone ? (
              <span
                className="size-2 flex-none rounded-full"
                style={{ background: MARK[row.tone] }}
              />
            ) : null}
            <span className="text-ink-soft">{row.label}</span>
            <span className="ml-auto pl-3 font-bold tabular-nums text-ink">
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * ANIMATION OFF, EVERYWHERE, and it is a bug not a preference.
 *
 * Nivo animates through `@react-spring/web`, and on React 19 in this app the
 * enter transition does not land its final frame: bars render frozen at an
 * arbitrary interpolation of their width — measured at 12.7px against a 64.4px
 * band on one load and 0px on the next, for a bar that should be 42.5px. The
 * height animates correctly, so only the width interpolation is stuck.
 *
 * `animate={false}` makes Nivo pass `immediate: true` to the spring, so every
 * value is written at its final number and nothing interpolates. It costs the
 * transitions — which were part of what the library was chosen for — and it is
 * the difference between charts that are wrong and charts that are right.
 */
const ANIMATE = false;

/** Bars never fill their band — the padding is the leftover air. */
const BAR_PADDING = 0.34;
/** The rounded data end; Nivo leaves the baseline square. */
const RADIUS = 4;

export interface DayDatum extends BarDatum {
  date: string;
  /** The x tick — the date without its year. */
  tick: string;
  published: number;
  blocked: number;
  href: string;
}

/**
 * Days across the bottom, each column split into published and blocked.
 *
 * STACKED, NOT GROUPED: blocked + published IS the day's total, so stacking
 * states a real sum rather than leaving the addition to the reader.
 *
 * ONE TOOLTIP FOR THE WHOLE COLUMN. Nivo's default names only the segment under
 * the pointer, which means hovering twice — once on each half of a 24px bar — to
 * add a day up. This one reads the whole datum, so anywhere on the column gives
 * the complete answer.
 */
export function DayColumns({ data }: { data: DayDatum[] }) {
  return (
    <div className="h-44 w-full">
      <ResponsiveBar
        animate={ANIMATE}
        data={data}
        keys={["published", "blocked"]}
        indexBy="tick"
        theme={THEME}
        margin={{ top: 10, right: 8, bottom: 26, left: 36 }}
        padding={BAR_PADDING}
        colors={({ id }) => (id === "published" ? MARK.accent : MARK.mute)}
        /* THE 2px GAP BETWEEN STACKED SEGMENTS, and `innerPadding` is the right
           API for it: Nivo measures it in PIXELS and takes it out of the
           segments, which is a gap. The first attempt drew a 2px stroke in the
           surface colour instead — that is a border around a mark, which is the
           mechanism the rule forbids, and it also inset the outer edge of every
           stack. */
        innerPadding={2}
        borderRadius={RADIUS}
        enableLabel={false}
        gridYValues={4}
        axisLeft={{ tickValues: 4, tickPadding: 6 }}
        axisBottom={{ tickPadding: 6 }}
        onClick={(bar) => {
          const href = (bar.data as unknown as DayDatum).href;
          if (href) window.location.assign(href);
        }}
        tooltip={({ data: day }) => {
          const row = day as unknown as DayDatum;
          return (
            <Tip
              title={row.date}
              rows={[
                { label: "发布", value: row.published, tone: "accent" },
                { label: "被挡下", value: row.blocked, tone: "mute" },
                { label: "共", value: row.published + row.blocked },
              ]}
            />
          );
        }}
        role="img"
        ariaLabel="每天抓取与发布的数量"
      />
    </div>
  );
}

export interface BucketDatum extends BarDatum {
  bucket: string;
  count: number;
}

/**
 * Whether a bucket sits below the per-dimension floor — derived, not stored.
 *
 * It was a `below: boolean` field on the datum, which `BarDatum`'s index
 * signature (`string | number`) will not carry. Deriving it is better anyway:
 * the bucket IS the score and the floor is already a prop, so there was never a
 * third fact to keep in step with the other two.
 */
const isBelow = (bucket: string, floorAt: number) => Number(bucket) < floorAt;

/**
 * One dimension's 1-10 distribution.
 *
 * `maxY` IS PASSED IN, NOT DERIVED, which is what makes five of these a set of
 * small multiples rather than five unrelated charts: a shared y-scale is the only
 * thing that lets the shapes be compared, and comparing them is the entire reason
 * to put them side by side.
 */
export function Histogram({
  buckets,
  maxY,
  floorAt,
}: {
  buckets: BucketDatum[];
  maxY: number;
  /** The per-dimension floor: where the colour splits, and a tick. */
  floorAt: number;
}) {
  return (
    <div className="h-28 w-full">
      <ResponsiveBar
        animate={ANIMATE}
        data={buckets}
        keys={["count"]}
        indexBy="bucket"
        theme={THEME}
        margin={{ top: 8, right: 4, bottom: 20, left: 32 }}
        padding={BAR_PADDING}
        valueScale={{ type: "linear", min: 0, max: maxY }}
        colors={({ data }) =>
          isBelow((data as unknown as BucketDatum).bucket, floorAt)
            ? MARK.mute
            : MARK.cool
        }
        borderRadius={RADIUS}
        enableLabel={false}
        gridYValues={3}
        axisLeft={{ tickValues: 3, tickPadding: 4 }}
        // The ends and the floor. A tick per bar is a solid band of digits.
        axisBottom={{ tickPadding: 4, tickValues: ["1", String(floorAt), "10"] }}
        tooltip={({ data }) => {
          const row = data as unknown as BucketDatum;
          const below = isBelow(row.bucket, floorAt);
          return (
            <Tip
              title={`${row.bucket} 分`}
              rows={[
                {
                  label: below ? "低于单维下限" : "篇数",
                  value: row.count,
                  tone: below ? "mute" : "cool",
                },
              ]}
            />
          );
        }}
        role="img"
        ariaLabel="分数分布"
      />
    </div>
  );
}

export interface BarRowDatum extends BarDatum {
  label: string;
  value: number;
  tone: MarkTone;
  /** What rides the bar's tip and the tooltip — a count plus its share. */
  note: string;
}

/**
 * Horizontal bars, in the order given.
 *
 * HORIZONTAL BECAUSE THE LABELS ARE LONG — `substance × surprise` and
 * `被每源配额挡下` do not fit under a column, and rotated tick labels are their
 * own anti-pattern.
 *
 * `threshold` is a Nivo marker: the line the reader compares against (0.8 on the
 * correlations). It is allowed to look unlike the grid because it is the only
 * line here that means something.
 */
export function BarRows({
  rows,
  labelWidth,
  maxValue,
  threshold,
  height,
  integer,
}: {
  rows: BarRowDatum[];
  labelWidth: number;
  maxValue?: number;
  threshold?: { at: number; label: string };
  height: number;
  /** The values are whole articles — suppress the fractional axis ticks. */
  integer?: boolean;
}) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveBar
        animate={ANIMATE}
        /**
         * REVERSED, because Nivo lays a horizontal bar chart out from the BOTTOM
         * up: the first datum lands on the last row. Every list handed to this
         * component is already sorted the way it should read — strongest
         * correlation first, biggest outcome first — so without this the page
         * showed all three of them upside down, weakest at the top.
         *
         * Reversed here rather than at each call site: the callers sort for
         * meaning, and which end of the array Nivo starts from is this
         * component's problem.
         */
        data={[...rows].reverse()}
        keys={["value"]}
        indexBy="label"
        layout="horizontal"
        theme={THEME}
        margin={{ top: 16, right: 64, bottom: 24, left: labelWidth }}
        padding={BAR_PADDING}
        valueScale={
          maxValue === undefined
            ? undefined
            : { type: "linear", min: 0, max: maxValue }
        }
        colors={({ data }) => MARK[(data as unknown as BarRowDatum).tone]}
        borderRadius={RADIUS}
        enableGridY={false}
        enableGridX
        gridXValues={5}
        axisLeft={{ tickPadding: 6 }}
        /* `integer` hides the fractional ticks Nivo generates for a small count
           axis — "0.5 articles" is not a thing, and 0/0.5/1/1.5/2 under a chart
           of whole articles reads as a unit error. */
        axisBottom={{
          tickValues: 5,
          tickPadding: 6,
          format: integer
            ? (value: number) => (Number.isInteger(value) ? String(value) : "")
            : undefined,
        }}
        /* Bars → value at the tip, placed OUTSIDE the bar. `labelSkipWidth={0}`
           keeps it there even on a short bar: a label cropped by its own mark is
           worse than no label. */
        label={(bar) => (bar.data as unknown as BarRowDatum).note}
        labelPosition="end"
        labelOffset={10}
        labelSkipWidth={0}
        labelTextColor={INK}
        markers={
          threshold
            ? [
                {
                  axis: "x",
                  value: threshold.at,
                  lineStyle: { stroke: INK_SOFT, strokeWidth: 1 },
                  legend: threshold.label,
                  legendPosition: "top",
                  textStyle: { fill: INK_MID, fontSize: 10, fontWeight: 700 },
                },
              ]
            : undefined
        }
        tooltip={({ data }) => {
          const row = data as unknown as BarRowDatum;
          return (
            <Tip rows={[{ label: row.label, value: row.note, tone: row.tone }]} />
          );
        }}
        role="img"
        ariaLabel="横向条形图"
      />
    </div>
  );
}

export interface FloorPointDatum {
  floor: number;
  published: number;
  delta: number;
}

/**
 * The floor curve: how many articles publish at each candidate floor.
 *
 * AN AREA UNDER THE LINE AT 10% — a wash, never a block. The shape is the
 * finding (a plateau below the current floor, a cliff above it), and a little
 * mass makes the plateau legible.
 *
 * ONE SERIES, SO NO LEGEND: the panel's title names what is plotted. `enableSlices`
 * gives the crosshair, so the pointer anywhere in a column reads that floor
 * rather than having to land on a point.
 */
export function FloorCurve({
  points,
  marker,
}: {
  points: FloorPointDatum[];
  /** The floor as configured — a reference line and the one direct label. */
  marker: number;
}) {
  const byFloor = new Map(points.map((point) => [point.floor, point]));
  return (
    <div className="h-52 w-full">
      <ResponsiveLine
        animate={ANIMATE}
        data={[
          {
            id: "发布",
            data: points.map((point) => ({
              x: point.floor,
              y: point.published,
            })),
          },
        ]}
        theme={THEME}
        margin={{ top: 20, right: 14, bottom: 44, left: 40 }}
        xScale={{ type: "linear", min: "auto", max: "auto" }}
        yScale={{ type: "linear", min: 0, max: "auto" }}
        curve="monotoneX"
        colors={[MARK.cool]}
        lineWidth={2}
        enableArea
        areaOpacity={0.1}
        enablePoints={false}
        // ≥8px across, with a 2px ring in the surface so it stays legible where
        // it sits on the line.
        pointSize={8}
        pointBorderWidth={2}
        pointBorderColor={SURFACE}
        enableGridX={false}
        gridYValues={4}
        axisLeft={{ tickValues: 4, tickPadding: 6 }}
        /* The legend sits CENTRED under the axis, not at its end — at the end it
           landed on the last tick. The bottom margin is grown to hold it. */
        axisBottom={{
          tickValues: 9,
          tickPadding: 6,
          legend: "总分门槛",
          legendOffset: 32,
          legendPosition: "middle",
        }}
        enableSlices="x"
        markers={[
          {
            axis: "x",
            value: marker,
            lineStyle: { stroke: INK_SOFT, strokeWidth: 1 },
            legend: `现状 ${marker}`,
            legendPosition: "top",
            textStyle: { fill: INK_MID, fontSize: 10, fontWeight: 700 },
          },
        ]}
        sliceTooltip={({ slice }) => {
          const floor = Number(slice.points[0]?.data.x);
          const point = byFloor.get(floor);
          return (
            <Tip
              title={`门槛 ${floor}`}
              rows={[
                { label: "发布", value: point?.published ?? 0, tone: "cool" },
                {
                  label: "相对现状",
                  value:
                    point === undefined || point.delta === 0
                      ? "—"
                      : `${point.delta > 0 ? "+" : ""}${point.delta}`,
                },
              ]}
            />
          );
        }}
        role="img"
        ariaLabel="不同门槛下的发布篇数"
      />
    </div>
  );
}

export interface SourcePointDatum {
  name: string;
  considered: number;
  mean: number;
  published: number;
  rate: number;
}

/**
 * Every source as a dot: how much it brought against how it scored.
 *
 * THE Y DOMAIN STARTS AT THE DATA, NOT AT ZERO, and that is legitimate here in a
 * way it never is for a bar. A bar encodes its value as LENGTH, so a truncated
 * baseline overstates every difference. A dot encodes POSITION: the axis says
 * what it says. No source has ever averaged below the high teens on a 5-50 scale,
 * so a domain from zero spent more than half the plot on empty cream — measured,
 * at 55% — and squeezed every real difference, and the publish floor this chart
 * exists to compare against, into a band at the top.
 *
 * THE RULE'S LABEL SITS IN THE LEFT MARGIN. Inside the plot it landed on dots at
 * whichever edge it was put: the right holds the highest-volume sources, and
 * thirty of the forty-nine have brought fewer than five articles, so the left is
 * crowded too. There is no free space inside a scatter this dense.
 *
 * `useMesh` IS WHY THE CROWDING IS SURVIVABLE. It builds a nearest-point layer,
 * so the pointer resolves to the closest dot rather than to whichever one the
 * browser happens to hit-test first — the exact thing the hand-rolled version
 * could not do, and the reason the left edge was unreadable there.
 */
export function SourceScatter({
  points,
  rule,
}: {
  points: SourcePointDatum[];
  /** The publish floor, as a horizontal reference line. */
  rule: number;
}) {
  const low = Math.min(...points.map((point) => point.mean), rule);
  const high = Math.max(...points.map((point) => point.mean), rule);
  return (
    <div className="h-64 w-full">
      <ResponsiveScatterPlot
        animate={ANIMATE}
        data={[
          {
            id: "源",
            data: points.map((point) => ({
              x: point.considered,
              y: point.mean,
              name: point.name,
              published: point.published,
              rate: point.rate,
            })),
          },
        ]}
        theme={THEME}
        margin={{ top: 14, right: 18, bottom: 46, left: 52 }}
        xScale={{ type: "linear", min: 0, max: "auto" }}
        yScale={{
          type: "linear",
          min: Math.floor(low - 2),
          max: Math.ceil(high + 2),
        }}
        colors={[MARK.cool]}
        nodeSize={9}
        useMesh
        gridYValues={4}
        /* Both legends centred rather than at the axis ends, where they sat on
           the outermost tick — "均分" against the top tick, "经过评分的篇数"
           against the last one. */
        axisLeft={{
          tickValues: 4,
          tickPadding: 6,
          legend: "均分",
          legendOffset: -38,
          legendPosition: "middle",
        }}
        axisBottom={{
          tickPadding: 6,
          legend: "经过评分的篇数",
          legendOffset: 34,
          legendPosition: "middle",
        }}
        /**
         * THE MARKER CARRIES NO LABEL OF ITS OWN, and the `Legend` under the
         * chart names it instead.
         *
         * Nivo places a marker legend either inside the plot or in the margin,
         * and on this chart both fail: inside, it lands on dots at whichever
         * edge it is put — the right holds the highest-volume sources and thirty
         * of the forty-nine sit against the left; in the margin, `门槛 30` is
         * wider than the axis gutter and got clipped into a vertical stack of
         * characters. A legend below the plot cannot collide with anything.
         */
        markers={[
          {
            axis: "y",
            value: rule,
            lineStyle: { stroke: INK_SOFT, strokeWidth: 1 },
          },
        ]}
        tooltip={({ node }) => {
          const datum = node.data as unknown as {
            name: string;
            published: number;
            rate: number;
          };
          return (
            <Tip
              title={datum.name}
              rows={[
                { label: "经过评分", value: node.data.x },
                /* `.toFixed(1)`, not `node.formattedY` — Nivo's default format
                   leaves a mean as 24.666666666666668. */
                { label: "均分", value: Number(node.data.y).toFixed(1), tone: "cool" },
                { label: "发布", value: datum.published },
                { label: "发布率", value: `${Math.round(datum.rate * 100)}%` },
              ]}
            />
          );
        }}
        role="img"
        ariaLabel="每个源的平均分与产量"
      />
    </div>
  );
}

/**
 * The legend. PRESENT WHENEVER THERE ARE TWO OR MORE SERIES — the dependable
 * identity channel, so nothing here depends on matching a colour to a memory. A
 * single-series chart gets none: its title already names it.
 *
 * Plain HTML rather than Nivo's `legends`, because it then sits outside the
 * chart's box and cannot steal height from the plot.
 */
export function Legend({
  items,
}: {
  /** `tone` names a mark; omitting it draws the reference-line swatch. */
  items: { tone?: MarkTone; label: string }[];
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
      {items.map((item) => (
        <span
          className="flex items-center gap-1.5 text-xs font-medium text-ink-soft"
          key={item.label}
        >
          {item.tone ? (
            <span
              className="size-2 flex-none rounded-full"
              style={{ background: MARK[item.tone] }}
            />
          ) : (
            // A short rule, drawn the way the marker is: the swatch has to look
            // like the thing it names.
            <span
              className="h-px w-3 flex-none"
              style={{ background: INK_SOFT }}
            />
          )}
          {item.label}
        </span>
      ))}
    </div>
  );
}
