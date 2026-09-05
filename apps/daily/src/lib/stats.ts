import { PUBLISH_MIN_SCORE } from "./categories";
import {
  clearsEveryDimension,
  MIN_PER_DIMENSION,
  SCORE_DIMENSIONS,
  type ScoreDimension,
} from "./score";
import { PUBLISH_PER_SOURCE, sourceOf } from "./sources";
import type { ScoreReview } from "./types";

/**
 * The arithmetic behind `/admin`: what the scorer actually did, over the whole
 * archive.
 *
 * WHY THIS IS A MODULE AND NOT A SCRIPT. Every number here has been computed
 * before — the correlation matrix in lib/score.ts, the flash-versus-pro table in
 * lib/config.ts, the `MIN_PER_DIMENSION` measurements — each time in a throwaway
 * script, against whatever the archive held that week. Those are the decisions
 * this app is made of, and they were all one-shot: re-checking whether the merge
 * still holds, or whether a rubric edit did what it said, meant writing the
 * script again. The point of a page is that the answer is standing.
 *
 * EVERY FUNCTION HERE IS PURE, over a list handed in. Reading the archive is
 * `allScored` in lib/store — one walk, one caller — so nothing in this file
 * touches the filesystem and every number can be checked against a fixture.
 *
 * IT REPORTS `n` EVERYWHERE, and that is not decoration. Fourteen days of one
 * blog's output is not a sample anybody should be tuning a rubric against, and a
 * page that prints a correlation to three decimals without saying what it was
 * computed over invites exactly that. See `SAMPLE_FLOOR`.
 */

/**
 * One article as the scorer left it, from either shape of digest file.
 *
 * TWO FILE SHAPES FEED THIS, and the fields that differ are the optional ones.
 * Digests from 2026-08-26 on carry one merged `articles` list where a missing
 * `summary` means "considered and turned down"; the six days before that split
 * them into `articles` plus a `rejected` array whose entries carry four fields
 * and no `id`, `category` or `publishedAt`. See the note on `Digest.articles`.
 *
 * `url` stands in for `id`, because it is the one key both shapes have — the id
 * is a sha1 OF the url, so they are the same fact. It is not on its own an
 * identity across the archive, though: see `entryKey`.
 */
export interface ScoredEntry {
  date: string;
  title: string;
  /**
   * The Chinese headline, and its ABSENCE IS A FACT rather than a gap.
   *
   * It is written by the summarise pass — `verdict.titleZh` in summarize.ts —
   * which only runs for an article that clears the gate. So an article that was
   * blocked has never been translated and never will be. Measured over the
   * archive: 215 of 215 published entries carry one, and 0 of 111 blocked ones
   * do. Anything rendering this must therefore expect it to be missing on
   * exactly the rejections, and must not read that as bad data.
   *
   * Absent for a second reason on the six legacy days: `RejectedArticle` has
   * four fields and this is not among them — see the note on the rejected list
   * in `allScored`. Those are all rejections too, so the two reasons agree.
   */
  titleZh?: string;
  url: string;
  sourceId: string;
  /** 5–50. The number in the file, which a human may have typed. */
  score: number;
  /** What the model said before any edit. Absent on the six legacy days. */
  modelScore?: number;
  scoredBy?: "human";
  /** Absent only for an article the score pass never answered for. */
  review?: ScoreReview;
  /** Whether it actually ran, read off `summary` — not recomputed from the
   *  gate, so a day published under an older floor still reports the truth. */
  published: boolean;
  /** For the per-source tie-break in `winnersFor`. Absent on legacy days. */
  publishedAt?: string;
  category?: string;
}

/**
 * Below this many articles, a statistic is shown with a warning rather than
 * withheld.
 *
 * NOT A CUTOFF, on purpose. Hiding a number until it is "significant" is how a
 * page becomes useless in exactly the situation it is most wanted — the first
 * week after a rubric change, when the whole question is "did that do anything".
 * What the page owes instead is the `n` beside every figure and a visible mark
 * when it is this thin.
 *
 * 30 is the conventional hand-wave and is used as one. The real answer depends
 * on the effect size being looked for, which a page cannot know.
 */
export const SAMPLE_FLOOR = 30;

/**
 * The key that identifies one entry: THE DAY AND THE URL, never the url alone.
 *
 * There is no cross-day dedup in this app — the fetch window is the only thing
 * stopping an article appearing twice, and it does not always (see "没有跨天去重"
 * in the README). One article in the archive has run on two days, and keying the
 * gate maps below by url alone silently merged the pair and lost an entry from
 * every count on this page. A statistic that is quietly one short is worse than
 * one that is obviously broken, so this is a composite.
 *
 * `\u0000` as the separator because it cannot occur in either half, so no pair of
 * distinct entries can collide by concatenation.
 */
export function entryKey(entry: ScoredEntry): string {
  return `${entry.date}\u0000${entry.url}`;
}

/** Entries the score pass actually answered for. Everything statistical runs
 *  over these: an unjudged article carries an all-zero review, and averaging
 *  those in would drag every dimension toward zero for a model outage. */
export function judged(entries: ScoredEntry[]): ScoredEntry[] {
  return entries.filter((entry) => entry.review !== undefined);
}

function mean(values: number[]): number {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

/**
 * POPULATION standard deviation, not the sample estimate.
 *
 * The archive is not a sample of some larger set of runs we are trying to infer
 * about — it is every article the scorer has ever seen, i.e. the whole
 * population of the thing being described. Dividing by `n` rather than `n - 1`
 * is the right one for "how spread out were the numbers it gave", which is the
 * only question asked of it here.
 */
function stdDev(values: number[]): number {
  if (!values.length) return 0;
  const centre = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - centre) ** 2)));
}

/** Pearson r. Zero when either side never varies — a dimension that answered
 *  the same number every time correlates with nothing, and dividing by its
 *  zero spread would report NaN as if it were a finding. */
function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  const mx = mean(xs);
  const my = mean(ys);
  let top = 0;
  let sx = 0;
  let sy = 0;
  for (let at = 0; at < n; at++) {
    const dx = xs[at] - mx;
    const dy = ys[at] - my;
    top += dx * dy;
    sx += dx * dx;
    sy += dy * dy;
  }
  return sx > 0 && sy > 0 ? top / Math.sqrt(sx * sy) : 0;
}

export interface DimensionStat {
  dimension: ScoreDimension;
  n: number;
  mean: number;
  sd: number;
  min: number;
  max: number;
  /** Ten buckets, index 0 = a score of 1. How much of the 1-10 range the model
   *  is actually using, which is the question lib/config's model table was
   *  built to answer by hand. */
  histogram: number[];
}

/**
 * Each dimension's distribution.
 *
 * THE HISTOGRAM IS THE POINT, more than the mean. The finding recorded in
 * lib/config — that `deepseek-v4-flash` never once scored a 9, so everything
 * piled up between 30 and 38 and a floor of 30 passed 90% of what was fetched —
 * is invisible in a mean and obvious in ten buckets. A rubric asks for the full
 * range twice over; whether it gets it is a property of the model, and it
 * changes when the model does.
 */
export function dimensionStats(entries: ScoredEntry[]): DimensionStat[] {
  const scored = judged(entries);
  return SCORE_DIMENSIONS.map((dimension) => {
    const values = scored.map((entry) => entry.review![dimension].score);
    const histogram = Array.from({ length: 10 }, () => 0);
    for (const value of values) {
      // Clamped rather than trusted: the band is 1-10 by the rubric, and a model
      // that returns 0 or 11 must not write outside the array.
      const bucket = Math.min(9, Math.max(0, Math.round(value) - 1));
      histogram[bucket]++;
    }
    return {
      dimension,
      n: values.length,
      mean: mean(values),
      sd: stdDev(values),
      min: values.length ? Math.min(...values) : 0,
      max: values.length ? Math.max(...values) : 0,
      histogram,
    };
  });
}

export interface Correlation {
  a: ScoreDimension;
  b: ScoreDimension;
  r: number;
}

/**
 * Every pair of dimensions, strongest first.
 *
 * WHAT IT IS FOR, stated in lib/score.ts and worth repeating at the code that
 * computes it: five dimensions that all correlate above 0.9 are one dimension
 * asked five times, and equal weights then mean something other than what they
 * say. The 7→5 merge was made on these numbers (`opinion`↔`judgment` 0.88,
 * `novelty`↔`hook` 0.76) and the note admits the merge rebuilt the problem —
 * `substance`↔`surprise` came out at 0.91 afterwards.
 *
 * So this is the standing version of that check, and the number to watch is the
 * top row. `accessible` correlating 0.17-0.42 with everything is the one
 * genuinely independent thing in the rubric; if that ever climbs, the rubric has
 * quietly collapsed to a single axis.
 */
export function correlations(entries: ScoredEntry[]): Correlation[] {
  const scored = judged(entries);
  const columns = new Map<ScoreDimension, number[]>(
    SCORE_DIMENSIONS.map((dimension) => [
      dimension,
      scored.map((entry) => entry.review![dimension].score),
    ]),
  );

  const pairs: Correlation[] = [];
  for (let i = 0; i < SCORE_DIMENSIONS.length; i++) {
    for (let j = i + 1; j < SCORE_DIMENSIONS.length; j++) {
      const a = SCORE_DIMENSIONS[i];
      const b = SCORE_DIMENSIONS[j];
      pairs.push({ a, b, r: pearson(columns.get(a)!, columns.get(b)!) });
    }
  }
  return pairs.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
}

/**
 * Which of the four gates an entry would fall at, under a given sum floor.
 *
 * A FAITHFUL REPLAY OF `publishable` IN LIB/SUMMARIZE, and it has to be: a floor
 * curve computed from the sum alone would be wrong in both directions — it would
 * count articles the per-source quota was always going to drop, and it would
 * miss the ones `alwaysPublish` lets through underneath any floor. The four
 * questions, in that function's own order:
 *
 *   the per-source quota  — has this source already had its turn today?
 *   `alwaysPublish`       — is this a source kept for who writes it?
 *   the sum floor         — is the total good enough?
 *   MIN_PER_DIMENSION     — is any single dimension a real weakness?
 *
 * `quota` IS COMPUTED PER DAY by the caller and handed in, because that is the
 * scope the real rule has: `bestPerSource` runs once per run, over that run's
 * articles. Anything computed across the whole archive at once would be a
 * different rule wearing the same name.
 */
export type GateOutcome =
  | "published"
  | "quota"
  | "unscored"
  | "under-floor"
  | "under-dimension";

function outcomeFor(
  entry: ScoredEntry,
  winners: Set<string>,
  floor: number,
): GateOutcome {
  if (!winners.has(entryKey(entry))) return "quota";
  if (sourceOf(entry.sourceId).alwaysPublish) return "published";
  // An unscored article carries 0 and loses to every floor — reported as its own
  // outcome rather than as "under-floor", because a pile of these is a model
  // outage and not a rubric that is working.
  if (!entry.review) return "unscored";
  if (entry.score < floor) return "under-floor";
  return clearsEveryDimension(entry.review) ? "published" : "under-dimension";
}

/**
 * The ids — urls, here — that win their source's slots on one day.
 *
 * `bestPerSource` in lib/summarize, restated over `ScoredEntry`. The tie-break
 * is `publishedAt` descending there; on the six legacy days that field is absent
 * and ties fall back to the order the file lists them in. It affects only which
 * of two equally-scored articles from ONE source on ONE day wins, so it cannot
 * move a count by more than a rounding error — but it is why this is a replay
 * and not a recomputation of history.
 */
function winnersFor(dayEntries: ScoredEntry[]): Set<string> {
  const bySource = new Map<string, ScoredEntry[]>();
  for (const entry of dayEntries) {
    const group = bySource.get(entry.sourceId);
    if (group) group.push(entry);
    else bySource.set(entry.sourceId, [entry]);
  }
  const winners = new Set<string>();
  for (const group of bySource.values()) {
    [...group]
      .sort(
        (a, b) =>
          b.score - a.score ||
          (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""),
      )
      .slice(0, PUBLISH_PER_SOURCE)
      .forEach((entry) => winners.add(entryKey(entry)));
  }
  return winners;
}

/** The entries of one archive, split by the day they ran on. */
export function byDay(entries: ScoredEntry[]): Map<string, ScoredEntry[]> {
  const days = new Map<string, ScoredEntry[]>();
  for (const entry of entries) {
    const group = days.get(entry.date);
    if (group) group.push(entry);
    else days.set(entry.date, [entry]);
  }
  return days;
}

/** Every entry's outcome under one floor, keyed by `entryKey`. */
export function outcomesAt(
  entries: ScoredEntry[],
  floor: number,
): Map<string, GateOutcome> {
  const outcomes = new Map<string, GateOutcome>();
  for (const dayEntries of byDay(entries).values()) {
    const winners = winnersFor(dayEntries);
    for (const entry of dayEntries) {
      outcomes.set(entryKey(entry), outcomeFor(entry, winners, floor));
    }
  }
  return outcomes;
}

export interface FloorPoint {
  floor: number;
  published: number;
  /** Against the count at the floor currently configured. */
  delta: number;
  current: boolean;
}

/**
 * How many articles would have run at each candidate floor.
 *
 * WHAT THIS ANSWERS THAT THE ARCHIVE CANNOT. `published` on an entry is history —
 * it reflects the floor, the quota and the rubric as they stood that morning, and
 * several of those have since moved. This replays every day against one floor at
 * a time with today's other rules held fixed, which is the only way "what does
 * moving the floor cost" has a number attached instead of an argument.
 *
 * IT IS A MODEL, NOT A REPLAY OF WHAT WOULD HAVE HAPPENED. Two things it cannot
 * know: an article that never got summarized has no take, so publishing it at a
 * lower floor would have cost a model call that may have failed; and the archive
 * only contains what `COLLECT_PER_SOURCE` already let through, so lowering the
 * floor cannot recover anything that was capped before it was ever scored.
 *
 * The step is 1 because the numbers here are small integers over a 5-50 scale
 * and a coarser grid hides exactly the one-point moves anybody would actually
 * make.
 */
export function floorCurve(
  entries: ScoredEntry[],
  span = 8,
): FloorPoint[] {
  const at = (floor: number) =>
    [...outcomesAt(entries, floor).values()].filter(
      (outcome) => outcome === "published",
    ).length;

  const baseline = at(PUBLISH_MIN_SCORE);
  const points: FloorPoint[] = [];
  for (
    let floor = Math.max(SCORE_DIMENSIONS.length, PUBLISH_MIN_SCORE - span);
    floor <= PUBLISH_MIN_SCORE + span;
    floor++
  ) {
    const published = at(floor);
    points.push({
      floor,
      published,
      delta: published - baseline,
      current: floor === PUBLISH_MIN_SCORE,
    });
  }
  return points;
}

export interface GateBreakdown {
  total: number;
  published: number;
  quota: number;
  unscored: number;
  underFloor: number;
  underDimension: number;
}

/**
 * Where everything the archive holds falls, under the floor as configured now.
 *
 * FIVE NUMBERS RATHER THAN "PUBLISHED / NOT", because the four gates are fixed
 * in four different places and a single rejection count hides which one to go
 * and argue with: the floor is a line in config.json, a weak dimension is an
 * argument with the rubric in summarize.ts, the quota is `PUBLISH_PER_SOURCE`,
 * and `unscored` is not a judgement at all — it is a model call that failed.
 * `publishable` already logs this split per run; this is the same split standing.
 */
export function gateBreakdown(entries: ScoredEntry[]): GateBreakdown {
  const outcomes = [...outcomesAt(entries, PUBLISH_MIN_SCORE).values()];
  const count = (outcome: GateOutcome) =>
    outcomes.filter((each) => each === outcome).length;
  return {
    total: outcomes.length,
    published: count("published"),
    quota: count("quota"),
    unscored: count("unscored"),
    underFloor: count("under-floor"),
    underDimension: count("under-dimension"),
  };
}

/**
 * Which dimension does the blocking, among the articles that clear the sum and
 * fail `MIN_PER_DIMENSION`.
 *
 * The measurement that set that constant to 5 rather than 6 turned on exactly
 * this: at 6 the dimensions doing the discarding were `substance` and
 * `relevance`, not `accessible` — and both of their 5-6 bands describe the
 * ordinary good article, so the rule was throwing out the band the rubric calls
 * normal. Standing, because the answer moves when either the model or the bands
 * do.
 *
 * An article can be under on several dimensions and is counted under each: the
 * question is "which lines are doing this", not "how do I attribute a rejection".
 */
export function blockingDimensions(
  entries: ScoredEntry[],
): { dimension: ScoreDimension; n: number }[] {
  const outcomes = outcomesAt(entries, PUBLISH_MIN_SCORE);
  const blocked = entries.filter(
    (entry) => outcomes.get(entryKey(entry)) === "under-dimension",
  );
  return SCORE_DIMENSIONS.map((dimension) => ({
    dimension,
    n: blocked.filter(
      (entry) => entry.review![dimension].score < MIN_PER_DIMENSION,
    ).length,
  })).sort((a, b) => b.n - a.n);
}

export interface SourceRow {
  sourceId: string;
  name: string;
  considered: number;
  published: number;
  meanScore: number;
  bestScore: number;
  /** published ÷ considered. */
  rate: number;
  alwaysPublish: boolean;
}

/**
 * Per source: how much it brought, how much ran, and how it scored.
 *
 * THE QUESTION IT IS FOR is the one lib/sources says should be answerable
 * without opening the site — "should this be dropped" — and the hand-written
 * `description` was carrying it alone. A source that has brought thirty articles
 * and published none is costing body fetches and scoring tokens every morning to
 * contribute nothing, and nothing on the site said so.
 *
 * `rate` IS NOT A QUALITY SCORE. `PUBLISH_PER_SOURCE` caps a source at one
 * article a day, so a prolific source cannot have a high rate however good it is
 * — Hacker News brings the most and is capped like everything else. Read it
 * against `considered`, and read `meanScore` for the quality question.
 */
export function sourceRows(entries: ScoredEntry[]): SourceRow[] {
  const rows = new Map<string, ScoredEntry[]>();
  for (const entry of entries) {
    const group = rows.get(entry.sourceId);
    if (group) group.push(entry);
    else rows.set(entry.sourceId, [entry]);
  }

  return [...rows.entries()]
    .map(([sourceId, group]) => {
      const source = sourceOf(sourceId);
      const scores = judged(group).map((entry) => entry.score);
      const published = group.filter((entry) => entry.published).length;
      return {
        sourceId,
        name: source.name,
        considered: group.length,
        published,
        meanScore: mean(scores),
        bestScore: scores.length ? Math.max(...scores) : 0,
        rate: group.length ? published / group.length : 0,
        alwaysPublish: source.alwaysPublish,
      };
    })
    .sort((a, b) => b.considered - a.considered);
}

/**
 * Every score a human overruled, newest first.
 *
 * `scoredBy` IS THE FIELD READ, not `score !== modelScore`. types.ts calls the
 * string derivable and writes it anyway for this exact reason: the six legacy
 * days carry no `modelScore` at all, so the comparison cannot tell "nobody
 * touched this" from "there was no baseline to compare against". The flag can.
 *
 * The delta is still computed from the pair where both exist, because "by how
 * much" is the interesting half — a rubric that needs correcting by ten points
 * is a different problem from one needing two.
 */
export function humanEdits(
  entries: ScoredEntry[],
): (ScoredEntry & { delta: number | null })[] {
  return entries
    .filter((entry) => entry.scoredBy === "human")
    .map((entry) => ({
      ...entry,
      delta:
        entry.modelScore === undefined ? null : entry.score - entry.modelScore,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}
