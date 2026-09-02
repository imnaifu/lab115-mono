import type { ScoreReview } from "./types";
import { USER_CONFIG } from "./user-config";

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
 * STILL FIVE, AND THREE CANDIDATE SIXTH DIMENSIONS WERE MEASURED AND REJECTED.
 * The reason to record the numbers rather than the verdicts: the candidates are
 * all reasonable-sounding, so they will be proposed again.
 *
 * The thing they were up against is that these five already measure ONE thing.
 * Over the three archived days that store every fetched article (85 of them),
 * the correlation matrix has a single eigenvalue above 1 — the first component
 * explains 73% of the variance with every dimension loading on it (0.34-0.51),
 * and the second (14%) is `accessible` alone, against the rest.
 * `substance`↔`surprise` is 0.91, the same figure as the pairs the 7→5 merge
 * above was made to fix, so that merge rebuilt the problem it removed.
 *
 * Each candidate was scored on 61 articles from 2026-08-27/28 in the same reply
 * as the five, so the correlations below carry no run-to-run noise. Two tests:
 * every correlation under 0.5, and Spearman against the unchanged total under
 * 0.95. Nothing passed both.
 *
 *   `firsthand` (where the material came from) — sd 2.09, moved the ranking most
 *   (0.9236), notes cleanly judged provenance. But it correlates -0.52 with
 *   `accessible`, because first-hand technical material is not readable, and at
 *   equal weight the two CANCEL: `accessible` + `firsthand` has sd 1.93 against
 *   1.87 for `accessible` alone. Adding it made the total closer to
 *   substance+surprise+relevance (0.9712) than the five it replaced (0.9160).
 *
 *   `humor` (is the writing funny) — the most orthogonal thing tested, 0.29 at
 *   worst, and it judged prose rather than subject as asked. Dead on arrival for
 *   a different reason: sd 0.96, with 36 of 52 articles on the same number,
 *   because these blogs are not funny. Ordering moved 0.9930, i.e. not at all.
 *
 *   `premise` (is the SUBJECT interesting, ignoring the writing) — sd 1.63 is
 *   usable and its notes did describe premises, but 0.62 with `surprise`: asking
 *   "is the topic good" is a rephrasing of "is the piece surprising". It also
 *   varied more BETWEEN sources than within them (1.57 vs 1.24) — what a blog
 *   writes about is a property of the blog, and config.json already expresses
 *   that.
 *
 * THE RULE THOSE THREE PRODUCE, for the next candidate: a new dimension can only
 * land off the first component if its question is NOT a rephrasing of "is this
 * piece good". The test to apply before writing any bands — can an excellent
 * article score low on it, and a bad article score high? `firsthand` and `humor`
 * pass that (a terrible post can be first-hand, a great one can be humourless);
 * `premise` cannot, which is why it landed back on `surprise`.
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



/**
 * The floor under EACH dimension, as opposed to PUBLISH_MIN_SCORE which is the
 * floor under their sum. An article has to clear both.
 *
 * WHY A SUM NEEDS A SECOND RULE. The five dimensions are one vote each, so four
 * of them outvote the fifth: `I trained a small transformer in 1.5hrs` scored
 * substance 8, surprise 8, accessible 4 and published at 32 against a floor of
 * 30 — unreadable to anyone outside the field, which is the one thing this
 * digest says it will not print. `accessible` cannot stop that on its own, and
 * WEIGHTING IT DOES NOT HELP: measured over 238 archived articles, doubling it
 * moved the ranking to 0.9788 and let in four readable-but-thin pieces for the
 * one it removed; tripling it published MORE (178 against 171) because a
 * multiplier is symmetric — it rewards the hundred articles that are good at a
 * dimension while punishing the four that are bad at it. Only a gate is
 * one-directional.
 *
 * FIVE, NOT SIX. At 6 this rule discards 40% of everything published (171 → 102
 * over those days) and the two dimensions doing the discarding are `substance`
 * (35 articles) and `relevance` (29), not `accessible` (8) — and both of their
 * 5-6 bands say in so many words that the ordinary good article lives there. A
 * rule that throws out the band the rubric calls normal is not a quality filter,
 * it is a different publication. At 5 it costs 7 articles of 171, and every one
 * of them has a dimension in the bottom two bands, which is a real weakness by
 * the rubric's own description.
 *
 * `alwaysPublish` exempts a source from this as it does from the sum — see the
 * field in user-config.ts. 硅谷居士 has a dimension under 5 in five of six
 * articles, so a gate that did not exempt it would silently retire the whitelist.
 */
export const MIN_PER_DIMENSION = USER_CONFIG.minPerDimension;

/** Every dimension at or above MIN_PER_DIMENSION. False for an unjudged article,
 *  whose review is all zeroes — the same answer the sum gives it. */
export function clearsEveryDimension(review: ScoreReview): boolean {
  return SCORE_DIMENSIONS.every(
    (dimension) => review[dimension].score >= MIN_PER_DIMENSION,
  );
}
