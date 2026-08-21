import { PUBLISH_MIN_SCORE } from "./categories";

/**
 * The score scale, in one place because the scoring pass that produces it and the
 * publish floor that reads it are in different modules.
 *
 * IT IS NOT DISPLAYED ANYWHERE. It used to drive a five-star rating on every card
 * and poster; `starCount` and `<Stars>` are gone. What the score still does is
 * decide what gets published and in what order — see PUBLISH_MIN_SCORE and the
 * ranking in jobs/daily.ts.
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


