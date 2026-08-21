import { PUBLISH_MIN_SCORE } from "./categories";

/**
 * The score scale, in one place because three different things read it: the
 * scoring pass that produces it, the page's `<Stars>`, and the share poster's
 * own copy of the same arithmetic.
 *
 * It lives here rather than in summarize.ts so a client component can import it
 * without dragging the OpenAI client into the bundle.
 */

/**
 * FIVE DIMENSIONS, EACH 1-10, EACH WEIGHT 1 — so the total runs 5 to 50 and the
 * model never names it.
 *
 * IT WAS SEVEN, AND FIVE OF THEM WERE MEASURING TWO THINGS. Correlations over a
 * 22-article run: `opinion`↔`judgment` 0.88, `novelty`↔`hook` 0.76,
 * `judgment`↔`transfer` 0.76, `opinion`↔`transfer` 0.73. Two clusters, one
 * genuinely independent dimension (`accessible`, correlating 0.17-0.42 with
 * everything else), and `relevance` half-attached to the first cluster. So
 * "equal weights" was in fact 3:2:1:1 — an article's rank was decided by whether
 * it had a thought of its own, asked three times.
 *
 * `opinion` + `judgment` + `transfer` are now `substance`; `novelty` + `hook` are
 * now `surprise`. Merged, the ordering of that run is preserved at rank
 * correlation 0.962 — the same as the effect of dropping `novelty` alone, which
 * is to say the three extra dimensions were producing no ordering information at
 * all. Dropping any single dimension moved the ranking by 0.964-0.999.
 *
 * The gain is not accuracy, it is that a rubric edit now moves what it says it
 * moves. Editing `opinion` used to shift 3/7 of the weight at once, which is why
 * the effect of every rubric change was so hard to predict.
 *
 * EQUAL WEIGHTS, DELIBERATELY. They were 2/2/2/2/1/1 for one run and the
 * weighting changed nothing: rescored with equal weights, that run produced the
 * same ordering and the same articles over the floor. A knob that changes no
 * outcome is only a consistency burden.
 *
 * WHY THE MODEL DOES NOT NAME THE TOTAL. Asked for one 0-100 number it returned
 * six distinct values across 19 articles (85 five times, 82 six times, 78 four
 * times) — a model picks from round numbers, so the field had about six steps of
 * real resolution. Seven small judgements plus arithmetic spread much further.
 *
 * ANY CHANGE HERE MUST CHANGE SCORE_SYSTEM TOO. A key named here that the prompt
 * never asks for makes every reply incomplete, every article unjudged, and the
 * digest silently empty — summarize.ts throws at load if the two drift apart.
 */
export const SCORE_WEIGHTS = {
  substance: 1,
  surprise: 1,
  accessible: 1,
  relevance: 1,
  quality: 1,
} as const;

export type ScoreDimension = keyof typeof SCORE_WEIGHTS;

export const SCORE_DIMENSIONS = Object.keys(SCORE_WEIGHTS) as ScoreDimension[];

/** 5 and 50 by construction — five dimensions of 1-10 at weight 1. */
export const SCORE_MIN = SCORE_DIMENSIONS.reduce(
  (sum, d) => sum + SCORE_WEIGHTS[d],
  0,
);
export const SCORE_MAX = SCORE_MIN * 10;

/** Points of score per star, above the floor. See `starCount`. */
const PER_STAR = 4;

export const MAX_STARS = 5;

/**
 * Stars, counted FROM THE PUBLISH FLOOR rather than from zero.
 *
 * Every article on the page cleared the floor, so the interesting range is
 * floor-to-maximum and nothing below it is ever displayed. Dividing the full
 * 7-70 scale into fifths instead put every published article on the same two or
 * three stars — measured: a digest whose scores ran 36-45 rendered as 2 stars,
 * all of it, and 5 stars was unreachable by construction.
 *
 * So the band is `PUBLISH_MIN_SCORE` to `SCORE_MAX` — 30 to 50 as configured,
 * 20 points — cut at four points a star.
 *
 * IT STILL DOES NOT SPREAD, and that is a property of the scores rather than of
 * this arithmetic. Measured over five runs the model's medians sit at 6-7 on
 * most dimensions whatever the rubric says, so the published band is about a
 * sixth of the nominal range and no cut of it gives five usable stars: at five
 * points a star every article lands on 1-3, at two points a 1-point difference
 * changes the rating. This is recorded rather than fixed because the fix is not
 * here.
 *
 * ONE STAR IS THE FLOOR, NOT ZERO. A source marked `alwaysPublish` skips the
 * floor entirely, so a published article can score below it; that is a real one
 * star, not the absence of a rating. Only a score of 0 — the scoring pass never
 * answered — returns 0 here, and the callers render nothing for it.
 *
 * Digests archived before this scale existed carry 0-100 scores and will show
 * five stars throughout. Those numbers are not comparable and are not converted.
 */
export function starCount(score: number): number {
  if (!Number.isFinite(score) || score <= 0) return 0;
  const above = Math.floor((score - PUBLISH_MIN_SCORE) / PER_STAR) + 1;
  return Math.min(MAX_STARS, Math.max(1, above));
}
