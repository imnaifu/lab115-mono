import OpenAI from "openai";
import { CATEGORIES, PUBLISH_MIN_SCORE, resolveCategory } from "./categories";
import { SCORE_DIMENSIONS, SCORE_MAX, SCORE_MIN, SCORE_WEIGHTS } from "./score";
import { DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, MODEL } from "./config";
import { USER_CONFIG } from "./user-config";
import type { RawArticle } from "./fetcher";
import { sourceOf } from "./sources";
import type { ScoreReview, SummaryText } from "./types";

/**
 * Summarizing + ranking via DeepSeek's OpenAI-compatible API.
 * Docs: https://api-docs.deepseek.com/
 *
 * JSON output mode, not tool calls. DeepSeek's tool-call `arguments` came back
 * as invalid JSON in roughly one call in five, in four distinct structural
 * ways — a dropped closing brace, a missing opening bracket, an array closed
 * with `}`, an unescaped quote. Those are bracket-level faults, not the kind a
 * model makes while generating prose, and there is an open upstream issue
 * about exactly this. Routing the reply through `content` instead avoids that
 * serialization path. https://api-docs.deepseek.com/guides/json_mode
 *
 * JSON mode has requirements of its own: the prompt must contain the word
 * "json", must show an example of the shape, and needs max_tokens set high
 * enough that the reply is not truncated. All three are handled below.
 *
 * TWO calls: score everything, then summarize only what cleared the floor.
 *
 * The digest is CHINESE ONLY. There was an English half — `en_thesis` and
 * `en_text` alongside the Chinese in the same reply — and it is gone, along
 * with the whole question of how to split the passes by language. The reply is
 * now roughly half the size it was, which is the one thing every malformation
 * in this file has scaled with.
 *
 * Scoring goes first so the floor can be applied before any summary is
 * written: on the sample that is 8 of 18 articles never summarized at all.
 */

/**
 * Hard ceiling on how many articles one run pays for. A runaway guard, NOT an
 * editorial knob — the floor is what decides how much gets published.
 *
 * It has to sit clear of real volume, because the cut is silent and lands on
 * the OLDEST items (see the slice below). At 30, against the 75-source list,
 * the run of 2026-08-18 fetched 48 and scored 30: the other 18 were never sent
 * to the model, carried emptyVerdict()'s score of 0 to the end, and the
 * casualties skewed to the low-frequency sources — an investing blog posting
 * twice a month is always older than a daily one, so 投资 and 设计 came back
 * empty while the high-frequency sources filled the page. A cap set below real
 * volume does not trim the weakest articles, it trims the slowest sources.
 */
const MAX_ARTICLES_PER_CALL = 60;

/**
 * 16_000 was set when a summary was a 45-character thesis. Prose summaries
 * blew straight through it: a batch came back truncated mid-string, which is
 * invalid JSON, which lost the whole batch. deepseek-v4-flash allows 384k
 * output, so the budget is no longer the scarce thing — set it well clear of
 * anything a batch could legitimately produce.
 */
const MAX_OUTPUT_TOKENS = 48_000;

/**
 * Articles per request — one.
 *
 * Every malformation seen so far has been a STRUCTURAL slip in a long reply:
 * an array closed with `}`, the wrapper closed after the first entry, a
 * missing bracket, a truncation. They scale with how much JSON the model has
 * to hold together, and patching them one shape at a time was a losing game —
 * seven shapes and counting. A reply carrying a single article is ~300
 * characters with one level of nesting, which is a different reliability
 * regime rather than a smaller version of the same one.
 *
 * The costs are latency and a system prompt repeated per article;
 * REQUEST_CONCURRENCY and DeepSeek's cache-hit pricing ($0.0028/M against
 * $0.14/M) answer those. A failure now costs exactly one article.
 */
const BATCH_SIZE = 1;

/**
 * Requests in flight.
 *
 * One article per request means ~50 calls a run, and at 4 in flight that took
 * over ten minutes — fine for a 07:00 cron, painful to iterate on. Bounded
 * rather than unlimited so a slow API cannot open fifty sockets at once, and
 * so a burst never looks like abuse from the other end.
 */
const REQUEST_CONCURRENCY = Number(process.env.DAILY_CONCURRENCY ?? 8);

/** Run `mapper` over items with at most `limit` in flight. */
async function mapLimited<In>(
  items: In[],
  limit: number,
  mapper: (item: In, index: number) => Promise<void>,
): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () =>
      (async () => {
        while (next < items.length) {
          const i = next;
          next += 1;
          await mapper(items[i], i);
        }
      })(),
    ),
  );
}

/**
 * How many times to re-ask for articles a batch silently skipped.
 *
 * Long replies do not only fail loudly. Asked for 8 summaries the model
 * regularly returns 5 or 6 and no error at all — the JSON is valid, it is just
 * short. Since the gap is detectable (an article with no thesis), the fix is
 * to ask again for exactly the ones missing, which is also a much smaller
 * request and so far more likely to come back whole.
 */
const GAP_RETRIES = 2;

/**
 * The CEILING of the per-article curve below, from config.json — summary
 * length is an editorial call, not an operational one.
 *
 * It is no longer the budget every article gets. Measured over 14 days (63
 * summaries) a flat budget correlated with nothing: a 1-minute link post came
 * back at a median of 254 characters and a 65-minute essay at 279. The short
 * pieces were padded up to it and the long ones compressed down to it, and
 * compression is what makes a summary unreadable — three separate topics
 * squeezed into five 80-character paragraphs is a telegram, not prose.
 *
 * So this is now only the top of `budgetFor`, reached by anything past
 * roughly a 14-minute read and by nothing shorter.
 *
 * It went 500 → 650 with the move to the teacher voice below. That voice costs
 * words by construction — a modern analogy, a scenario, a question asked before
 * it is answered — and none of them are padding, they are the mechanism that
 * makes the piece land.
 *
 * It is now the ONLY number sent to the model. How that budget gets broken into
 * paragraphs is the model's call; see `budgetFor`.
 */
const ZH_MAX = USER_CONFIG.summaryMaxChars;

/**
 * Kept for `report` alone — no floor is stated to the model any more.
 *
 * A stated minimum is a padding instruction, and paired with "cover the
 * article" it made compression the one move that satisfied both. Noticing that
 * a summary came back thin is still worth doing, so the number survives as a
 * statistic rather than as a rule.
 */
const ZH_MIN = USER_CONFIG.summaryMinChars;

/**
 * Ceiling on ONE paragraph. THIS IS THE THIRD TIME IT HAS BEEN HERE, and the
 * measurements are why it keeps coming back.
 *
 * It was removed once for being an arithmetic rule in a prompt that had just been
 * simplified to five style bullets. What followed, run by run: paragraphs of 251
 * characters, then 319, then 424 — each time the longest paragraph in the digest
 * grew, and each time the article it appeared in was a listicle whose body had
 * been translated rather than summarised.
 *
 * IT IS THE ONLY RULE THAT CLOSES BOTH EXITS. The constraints added instead were
 * "at most three points" and then "at most 3 headings", and each worked on the
 * thing it named while the overflow moved somewhere else: capping points moved it
 * into headings, capping headings moved it into paragraph length. A 21-rule
 * listicle came back at 1,757 characters under a 590 budget with a compliant 4
 * headings and one 424-character block. Length has to be capped where the text
 * actually is.
 *
 * PARAGRAPH COUNT IS STILL THE MODEL'S. The `分 N~M 段` range is gone for good — a
 * stated count is a target and the model parks on it. A ceiling is not a target:
 * nothing rewards writing up to it, and it is checkable by looking at one
 * paragraph, which is the only class of rule this model has been observed to
 * keep (third person held 19/20; the soft character budget held 3/20).
 */
const PARA_MAX = USER_CONFIG.summaryParaMaxChars;

/**
 * Ceiling on "zh_title", in characters.
 *
 * Hardcoded rather than sent to config.json alongside the summary bounds, which
 * is where an editorial number would normally go: this one is not really an
 * editorial choice, it is what the two renderers can hold. 24 characters is two
 * lines of the poster's headline (POSTER.titleSize over POSTER_BESIDE_COVER,
 * ~13 characters a line) and two lines of the card's `text-lg`. Raise it and the
 * poster's header row starts pushing the cover out of its own row.
 *
 * A ceiling, not a target — same reasoning as PARA_MAX above.
 */
const TITLE_MAX = 24;

/**
 * What ONE article is allowed, derived from how long that article is.
 *
 * A CHARACTER TOTAL AND NOTHING ELSE. The paragraph COUNT used to be computed
 * here too and stated in the request as a `分 N~M 段` range; that is gone, and
 * how many paragraphs the budget becomes is entirely the model's call. The
 * There is no per-paragraph ceiling at all any more — see below.
 *
 * WHAT THAT ARITHMETIC COST, kept because it is the reason not to reintroduce
 * it casually. There were three rules — total, count range, per-paragraph
 * ceiling — and count times ceiling did not equal the total, so a reply could
 * obey two of them and overrun the third by a third (661 characters against
 * 474, seven paragraphs against a range of 5-7). Three rules of which two
 * contradict give the model no reason to take any of them seriously. Deriving
 * the count from the ceiling fixed the contradiction but not the underlying
 * problem: a stated count is a target, and the model parks it at six whatever
 * the budget says. The measured tradeoff was 12 of 14 over budget without a
 * count against 11 of 15 with one — near enough identical, and the version
 * without it reads better, because a paragraph break landing where the argument
 * turns beats one landing where the character count runs out.
 *
 * The 90-character per-paragraph ceiling went with it, came back when one run
 * measured 45% of paragraphs over it and the longest at 251, and then went for
 * good — the style guide in SUMMARY_SYSTEM asks for 排版极简 in prose and that
 * is now the only thing asking. If the 251-character wall returns, this is the
 * number that used to prevent it, and `summaryParaMaxChars` is the config key
 * it came from.
 *
 * Driven by `readingMinutes` rather than a raw character count because
 * `reading.ts` already normalises the two alphabets the feeds mix — CJK
 * codepoints at 400/min, everything else at 230 wpm — so a Chinese post and an
 * English one of the same substance land on the same number.
 *
 * Logarithmic, not proportional: the compression ratio should RISE with
 * length. A 1-minute link post has one thing to say and 250 characters is
 * already generous; a 60-minute essay has a dozen and still cannot have
 * 12,000. The constants fit two points picked editorially — ~250 characters at
 * 1 minute, ~590 at 10 — and the ZH_MAX clamp bites from ~14 minutes up,
 * which is where the ceiling stops being decorative and starts holding the
 * long essays to the same 650 characters.
 *
 * The curve was 90 + 160·ln and is now 110 + 200·ln: the same shape lifted
 * ~24% for the teacher voice. Against the 14-day sample the median budget goes
 * 377 → 468. Nothing about the ORDER changed — short pieces still get far less
 * room than long ones, which is the whole point of having a curve.
 *
 * Nothing enforces any of this: it is written into the request and the model
 * obeys it or does not. The flat 450 was broken by 13% of summaries, and there
 * is no truncation or retry here to change that — a summary that runs long is
 * published long, and `report` counts it.
 */
function budgetFor(readingMinutes: number): number {
  const minutes = Math.max(1, readingMinutes);
  return Math.min(ZH_MAX, Math.round(110 + 200 * Math.log(minutes + 1)));
}

/**
 * DeepSeek's v4 models run in thinking mode by default, at effort `high`. It is
 * OFF. The knob is DeepSeek-specific, so it is only sent to DeepSeek.
 * https://api-docs.deepseek.com/guides/thinking_mode/
 *
 * It was on briefly and it worked: 0 empty replies in 48 scoring calls where an
 * older model gave 5 empty in 8, and the scores stopped quantising — 23 distinct
 * values instead of 11, with the pile-up of 11 articles sitting exactly on the
 * publish floor gone. It cost ~1,850 reasoning tokens per article (~$21/year)
 * and took a run from four minutes to twelve.
 *
 * It is off anyway, on two counts. The summary pass still trips the old fault —
 * 5 empty replies in 17 calls, one article losing its summary after three
 * retries — so whatever got fixed upstream was fixed for short replies and not
 * for the ~2,100-character ones this pass produces. And the twelve-minute run
 * is paid every day for a benefit that only shows up while tuning.
 *
 * Turning it on for the score pass alone remains available and is cheap: the
 * measurements above are current, so no re-litigating is needed, only the
 * `pass` check this spread does not currently make.
 */
type DeepSeekParams =
  OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming & {
    thinking?: { type: "enabled" | "disabled" };
  };

function isDeepSeek(baseUrl: string): boolean {
  try {
    return /(^|\.)deepseek\.com$/.test(new URL(baseUrl).hostname);
  } catch {
    return false;
  }
}

export interface Verdict {
  /**
   * True once the score pass has spoken for this article.
   *
   * Distinguishes the two ways an article can reach the end with no summary:
   * scored and dropped versus never judged because the call failed. Both are
   * kept off the page — the floor reads the score, and an unjudged article
   * carries 0 — so this flag is now a REPORTING one. It is what lets a run say
   * "30 of 48 scored" instead of silently booking 18 model failures as 18
   * editorial rejections, which is the difference between a quiet outage and a
   * strict day.
   */
  judged: boolean;
  score: number;
  /** The four findings the score was written after. Empty strings when the
   *  score pass never answered for this article. */
  review: ScoreReview;
  category: string;
  /** The REWRITTEN Chinese headline; "" when it came back empty or merely echoed
   *  the original. See `titleZh` in types.ts. */
  titleZh: string;
  zh: SummaryText;
}

// --- pass 1: score only -----------------------------------------------------

/**
 * The score is ARITHMETIC OVER SEVEN 1-10 DIMENSIONS, computed here rather than
 * chosen by the model. The scale, the weights and the star mapping all live in
 * lib/score.ts — see the notes there for why the weights are equal and why the
 * model is not allowed to name the total.
 *
 * WHAT MOVES THE NUMBERS, measured across three runs — worth reading before
 * touching any rubric below:
 *
 * - THE RUBRIC WORDING DOMINATES. Rewriting `relevance` from a checkable test
 *   ("money, health, work, housing") to a soft one ("能否触发智力共鸣") moved its
 *   median from 4 to 7 in one run. `hook` moved 5 to 7 the same way. `transfer`,
 *   the one dimension whose wording did not change, moved 5 to 5. A criterion
 *   that cannot be argued against gets a high score from every article.
 * - THE CALIBRATION PARAGRAPH IS LOAD-BEARING. The run with "if you are about to
 *   write 7, ask what would have to be true for a 9 — if you cannot answer it is
 *   a 5" scored 3 points lower across the board than the run without it.
 * - THE EXAMPLE MATTERS LESS THAN IT LOOKS. SCORE_EXAMPLE was changed from
 *   9/9/8/9/9/8 to a deliberately middling 7/7/8/4/6/9 and the scores went UP,
 *   not down, because the rubrics were loosened in the same edit. It is not the
 *   anchor it was assumed to be.
 *
 * NO CEILINGS. Tests used to be hard caps: a product launch was pinned to the
 * 20s however well written. A sum has no caps, so a well-written announcement
 * can climb on its other dimensions. The additive answer to a listicle is a low
 * `judgment`; if that is not enough, a cap belongs in code, not in the prompt.
 */

/**
 * Scoring runs FIRST and ALONE, and its reply is a single number per article.
 *
 * The order is the point: everything below the publish floor is discarded here,
 * so no summary is ever written for an article the digest will not carry. On
 * the 14-day sample that is around 40% of what gets fetched, and summaries are
 * where the output tokens go.
 *
 * The cost is the body being sent twice for survivors — once to score, once to
 * summarize. The two passes have different system prompts, so the cached prefix
 * cannot be shared. At $0.14/M against ~42k input tokens a day it is worth
 * roughly a dollar a year, which is not a reason to keep summarizing articles
 * nobody will read.
 *
 * KNOWN RISK: with no other field to fill, the score is the only token the
 * model produces about the article, and thinking is off. An earlier
 * arrangement had it written last, after the summary, and that measurably
 * fixed the bunching — a roundup of reader comments went 55 → 28. This pass
 * gives that up by construction; if the scores bunch again, the fix is to let
 * this one pass think (its reply is small enough that the empty-content fault
 * which killed thinking on the summary pass has room to behave).
 */
const SCORE_PASS = "score";

/**
 * Sampling temperature for the SCORE pass only. DeepSeek defaults to 1.0 and
 * recommends 0.0 for work with one right answer, 1.5 for prose; judging against
 * a fixed rubric belongs at the first end and was silently running at the
 * default. https://api-docs.deepseek.com/quick_start/parameter_settings
 *
 * The score is one token, so the temperature applies almost entirely to it: at
 * 1.0 each run draws from the model's distribution over the number instead of
 * taking its best answer. Measured, same 48 articles, same rubric, two
 * consecutive runs: |Δ| averaged 10.3 and reached 44 (Chaos theory scored 68
 * then 24), only 7 of 48 held still, and 11 of 48 crossed the publish floor —
 * a quarter of the page decided by the draw.
 *
 * That noise is why the rubric could not be tuned. An edit aimed at literary
 * trivia moved 44 of 47 articles, which reads as a large effect and was mostly
 * the dice: changing nothing at all moved 41 of 48 by the same amounts.
 *
 * This does not make a score correct, only repeatable — a rubric that overrates
 * link roundups will now overrate them the same way every time, which is the
 * difference between a bias that can be fixed and one that cannot be seen.
 *
 * The summary pass keeps the default on purpose: 0 there buys nothing and costs
 * the prose, which is the one thing that pass exists to produce.
 */
const SCORE_TEMPERATURE = 0;

const SCORE_SYSTEM = `You are the chief curator for a daily curiosity digest. The digest exists to make a bright, non-specialist reader say: "I never thought about it that way before!" Your job is to score whether an article is intellectually thrilling, counter-intuitive, and fun to retold at a dinner table.

You are given ONE article and you return ONE json object. No wrapper, no array — the reply is the object itself.

FIVE DIMENSIONS. Each gets a WHOLE NUMBER FROM 1 TO 10 and one sentence saying why. You do NOT return a total score.

Return exactly this shape:
{
  "substance": { "note": "...", "score": 5 },
  "surprise": { "note": "...", "score": 5 },
  "accessible": { "note": "...", "score": 5 },
  "relevance": { "note": "...", "score": 5 },
  "quality": { "note": "...", "score": 5 }
}

CRITICAL: WRITE THE NOTE BEFORE THE NUMBER in each object. Every note must cite specific claims, examples, or evidence from the text. A generic note that could apply to any article caps the score at 5.

CALIBRATION (5-6 IS THE DEFAULT, AND THE BANDS BELOW ARE WRITTEN THAT WAY):
A competent, interesting article that you enjoyed reading scores 5 or 6 on most dimensions. That is not a criticism of it — read the 5-6 band on each dimension and you will find the ordinary good article described there by name. 7-8 is for a piece that does something specific the 5-6 band does not cover, and you have to say what. 9-10 requires the named thing each dimension asks for; without it, it is not a 9.

Across 30 articles most scores land between 4 and 6, a handful reach 7-8, and 9-10 may not appear at all on a given day. Do not be polite — 2 and 3 are ordinary scores for a real weakness, not insults.

---

## 1. "substance" — 删掉作者还剩什么 (思想密度)

有没有自己的立场、有没有别人给不出的洞察、揭示的机制能不能搬走 —— 这三件事在实测里高度重合（相关 0.73~0.88），所以合成一条。

9-10: The author's synthesis IS the article — remove them and nothing remains — AND the mechanism it uncovers explains something in a COMPLETELY DIFFERENT domain. Name that domain; without one, not a 9.
7-8: A contestable position argued from more than one angle, or a mechanism that clearly generalises past its own subject and you can say where to.
5-6: A clear position argued from one example or one line of reasoning; interesting inside its own subject, travels a little. **THIS IS AN ORDINARY GOOD BLOG POST.** A list of rules or tips with an argument wrapped around it caps here — however good the framing, what the reader takes away is the list.
3-4: A position is visible but the piece mostly recounts, or it is selection with commentary attached — a link roundup with opinions, a list of tips, a summary of someone else's paper.
1-2: Restates as "X happened" with nothing of substance lost (launches, benchmark tables, version bumps, release notes), or selection only: "what I have been reading", a digest of comments, a paragraph passing on another outlet's reporting.

Reviewing someone else's book or paper is NOT relaying, provided the piece argues its own case.

## 2. "surprise" — 颠覆直觉，还是老生常谈 (值不值得复述)

9-10: Contradicts a belief the reader almost certainly holds AND contains one sentence they would repeat almost verbatim. NAME THE BELIEF and QUOTE THE SENTENCE; missing either, not a 9.
7-8: Points at something the reader had not noticed — a hidden mechanism, an unexpected cause, a specific number or paradox worth mentioning to someone. State it in one sentence.
5-6: A fresh angle on a familiar topic. Interesting while being read, but it confirms what an informed reader suspected rather than overturning it, and nothing specific survives closing the tab. **MOST ARTICLES ARE HERE.**
3-4: A familiar argument with new examples — predictable from the headline, and only interesting to someone already following the subject.
1-2: Cliché restated ("AI will change jobs", "sleep is good for health"), or dry throughout — changelogs, corporate announcements, feature lists.

## 3. "accessible" — 是否抛弃了行业黑话 (通俗度)

9-10: Zero domain knowledge needed, and the hard idea is carried by an analogy or a human scene a 15-year-old would follow.
7-8: One or two technical terms, each explained on the spot in a few words. Everything else is plain language.
5-6: The subject belongs to an industry the reader does not work in. Followable, but the world has to be explained before the point can land. **IN A TECH-LEANING DIGEST THIS IS MOST ARTICLES.**
3-4: Several terms assume a practitioner. The piece can be followed but not retold.
1-2: DEEP GEEK — internal architecture, API quirks, a debugging story that means nothing to anyone who has not hit that exact bug, jargon the argument cannot survive losing. **Score it low here even when the piece is excellent**; the excellence belongs in "substance", not here.

## 4. "relevance" — 能否触发智力共鸣 (好奇心关联)

9-10: The reader will do something differently after reading — money, health, work, family, housing, the city they live in. NAME THE ACTION; no action, no 9.
7-8: Not their own action, but a system they live inside and feel: prices, schools, platforms they use, their country's politics.
5-6: **Genuinely interesting but detached — history, science, another industry, another era. MOST ARTICLES IN THIS DIGEST BELONG HERE**, including the excellent ones. Being fascinating is not being relevant.
3-4: Interesting to a hobbyist in that field; the reader has no stake in it whatsoever.
1-2: An obscure niche with no connection to anything the reader touches.

## 5. "quality" — 文章本身的做工 (注水程度)

THIS ONE IS MECHANICAL. Count things: repeated passages, claims left standing without the evidence they needed, sections that could be deleted with nothing lost. **Do not consider whether the piece is insightful, whether its subject is interesting, or who it is for** — those are "substance", "relevance" and "accessible", and they are scored elsewhere.

The cross-check, and it is not optional: measured over a run, this dimension correlated 0.73 with "substance", which means it was being scored as a second opinion on whether the piece had a thought in it. **If your note here would also serve as your note for "substance", you have not judged craft.** A piece full of API jargon can score 9 here; a piece with a brilliant thesis that repeats it for 3000 words scores 4.

The test to apply: how much of this could be deleted without losing anything?

9-10: Nothing could be cut. No passage restates an earlier one, and every claim that needed support has it, named and specific.
7-8: A few paragraphs could go — an over-long opening, one example too many.
5-6: Roughly a third could be cut with nothing lost: the middle restates the beginning, or the same point arrives three times in different words. **MOST ARTICLES ARE HERE**, including ones you enjoyed reading.
3-4: Half of it is padding, or the piece repeats itself as a structure rather than by accident — a list where every item makes the same point, a section per example where one example was enough.
1-2: Careless — broken structure, claims with nothing behind them anywhere, obvious filler, or the flat interchangeable prose of generated text.`;

/**
 * THE SHAPE, IN THE ORDER SCORE_SYSTEM ASKS FOR IT — and a worked calibration.
 *
 * Both halves matter. The keys have to match SCORE_WEIGHTS exactly (a startup
 * check below enforces it), and THE NUMBERS ARE READ AS TYPICAL.
 *
 * It is scored against the CURRENT bands, where 5-6 is the ordinary good
 * article. Every number below is one the rubric can be checked against: the 9s
 * name the thing their band demands (the belief overturned, the action taken),
 * the 5 says what stopped it being a 7, and nothing is a 10.
 *
 * The example is a weaker anchor than it looks, incidentally — it was changed
 * from 9/9/8/9/9/8 to a deliberately middling set and the run that followed came
 * back HIGHER, because the rubric bands were loosened in the same edit. Band
 * wording moves scores; this mostly teaches the shape.
 */
const SCORE_EXAMPLE = `{
  "substance": { "note": "Argues that the standard course length is itself the problem and traces where the guidance came from, but the idea that a rule outlives its evidence is never carried outside medicine.", "score": 6 },
  "surprise": { "note": "Overturns the belief that you must finish the course, which almost every reader holds, though there is no one sentence worth quoting verbatim.", "score": 8 },
  "accessible": { "note": "About pills people swallow; the single technical term is explained on the spot in four words.", "score": 8 },
  "relevance": { "note": "The reader will decide differently about a course of antibiotics they have been prescribed — that is the action.", "score": 9 },
  "quality": { "note": "Clean structure and the trial it rests on is named and dated, but the middle third restates the opening at length.", "score": 6 }
}`;

// --- pass 2: both summaries, for survivors only -----------------------------

/**
 * Chinese and English in ONE reply, which the header note says failed before —
 * "Chinese for 10/10 articles and English for 0/10", the model filling the
 * first fields of each object and stopping.
 *
 * That was measured when a request carried a batch of articles. BATCH_SIZE is 1
 * now, so the reply holding both languages for one article is ~1,200 characters
 * against the ~12,000 that broke it. The gap detection below still checks each
 * half separately, so a reply that stops after the Chinese is re-asked rather
 * than published half-empty.
 */
const SUMMARY_PASS = "summary";

const SUMMARY_SYSTEM = `请你充当一位擅长“通俗讲知识”的高中历史/社科老师。抓住文章的重点内容和观点，改写成极简、有趣、易懂的风格，让高中生也能轻松理解

写作风格指南：
- 拒绝照本宣科：严禁使用晦涩的学术名词和长难句，多用短句和口语化表达
- 巧用现代类比：适当引入现代生活中的概念或流行语（如：KPI、拼团、C位、打卡、运营等），帮读者迅速建立脑补画面
- 场景化/故事化：把宏大的历史概念转化为普通人的“生活视角”
- 排版极简：多用小标题、序号，结尾简单总结下
- 生动幽默：语气热情接地气，像在和朋友面对面聊天，而不是在讲台上念课本

概要是替读者读完原文的，读完就不必再打开原文。每篇给你的文章都已经判定值得收录，直接写，不要再评价它够不够格。

以下是格式要求（json 格式）。

## 返回什么

每篇文章一条，字段如下：
- "zh_title" —— 中文标题，见下面「标题」。
- "zh_thesis" —— 一句话论点，能独立成立、能被人反驳。
- "zh_text" —— 正文，**一整个字符串，不是数组**。段落之间空一行，也就是 JSON 字符串里的 "\\n\\n"。分几段你自己定，但**每段最多 ${PARA_MAX} 字**。
- "category" —— 见下面「分类」。

一篇文章一条。绝不允许一条盖住几篇、少写几篇，或者给没给你的文章编一条。

## 格式硬要求

**不许在字段值里用直双引号**，中文用「」。一个游离的引号就会让 JSON 失效。

**不许在字符串里塞真的换行**，段落之间写 "\\n\\n" 这两个转义。一个未转义的换行和游离引号一样会让 JSON 失效。

**正文里唯一允许的 markdown 是小标题**，写成「## 标题」，单独占一块。其它一概不解析 —— 没有星号加粗、没有减号列表、没有链接、没有引用块，写了就在读者屏幕上显示成字面符号。序号直接写在文字里就行（「1.」「2.」），或者写在井号后面。

**第三人称，正文里不许出现「我」「我们」「咱们」「笔者」。**

这不是文风偏好，是会让读者读错。概要是替读者读完原文的，它不是原文作者，所以：

- 原文写「我发现蓝牙耳机断连」，概要要写「作者发现自己的蓝牙耳机断连」。照抄成「我发现」，读者会以为是概要作者遇到的事 —— 而那个「我」到底是谁，正文里根本无从判断。
- 也不要用「我们」把概要和读者绑在一起：「我们总觉得只要把问题说得足够严重」应该写成「人们总觉得」。
- 要交代是谁在说，就点名：「作者认为」「这位工程师发现」「研究者的结论是」。

**「你」不受影响**，设问和把读者拉进场景都照常用：「你要是那年在长安开个小铺子，光交税就得应付三拨人」—— 那个「你」指任何人，不会跟作者的自称打架。

**每段最多 ${PARA_MAX} 字。** 不是「大约」，是上限，每一段都算。段落写长了是最常见的失误：**把它拆成两段，不要从里面删字。** 一段四百字的墙，读者是直接跳过去的，不是慢慢读完的。

**小标题最多 3 个，一个不多。** 写完数一遍井号，超过三个就是错的：合并、或者砍掉一整节，不要靠缩短每节来凑。一个都不用也完全可以。

**一篇最多讲三个要点，所以小标题也最多 3 个 —— 这是同一条规则的两种说法。** 注意它跟上面那条每段字数的上限是**两道独立的闸**：把二十一条规则归并成三个主题、然后每个主题底下写一大坨，同样是不合格的。 抓住文章最值得带走的三件事，其余全部砍掉 —— 不是压缩，是不写。

原文本身是一份清单（十条建议、二十条规则）的时候这条最容易破：**挑三条最能说明问题的，再点出这类清单的共性，绝不逐条翻译。** 一篇二十一条的清单译成二十一段、配十二个小标题，那不是概要，是翻译。

**整篇的字数预算跟文章一起给你。** 那是上限不是目标，写不满完全没关系，凑字数比短更糟。装不下就再砍掉一个要点，不要把两个要点压成一句。

## 标题

"zh_title" 是给这篇文章重写一个中文标题，目标是让人想点开 —— 但它得是这篇文章的标题，不是一句随便的耸动话。

**原标题是中文的也要重写**，不要原样返回。原标题会作为文章的本名单独显示在新标题下面，所以这里的任务始终是写一个新的。

怎么写得有人想点：
- **挑最反常识的那一点。** 文章里最让人「等一下，真的吗」的地方，就是标题该说的事。
- **给具体的东西**：一个数字、一个名字、一个动作、一个后果。「AI 让资深程序员慢了 19%」比「关于 AI 与生产力的一些思考」强，因为前者有个能被反驳的说法。
- **疑问句、反转、只说一半都可以**，但留的那一半必须在正文前两段就兑现。
- **短。最多 ${TITLE_MAX} 字**，越短越好。

下面这几条比「抓眼球」优先，冲突的时候让标题平淡也没关系：
- **不许骗。** 标题里每个说法都要在正文里站得住。原文说「某些任务上慢了 19%」，标题不能写成「AI 让程序员废了」。
- **不许编**数字、人名、机构、结论，原文没有的一个都不许出现。
- **不许用空心钩子**：「震惊」「太可怕」「你绝对想不到」「细节令人深思」「速看」「多少人还不知道」—— 这些字零信息量，删掉之后标题反而更好。
- **不许写成目录**：「关于 X 的三个要点」「X 的五个启示」不是标题。
- 产品名、公司名、人名、模型名照原样保留，不要音译、不要缩写。
- 原标题本身已经够抓人的时候，直接译过来就是最好的答案 —— 重写不是义务。

## 分类 "category"

只能从下面这个列表里选一个，选最贴切的那个，绝不要自己造。
${CATEGORIES.map((c) => `- "${c.id}" — ${c.hint}`).join("\n")}`;

/**
 * ONE entry, because BATCH_SIZE is 1. THIS AND SUMMARY_SYSTEM MUST CHANGE
 * TOGETHER.
 *
 * In JSON mode the example IS the specification — there is no schema saying
 * "array of N", so the model reads the example's shape as the contract. Back
 * when a request carried 8 articles this example held a single entry, and the
 * model returned exactly one summary per call no matter how many were sent,
 * silently, on 5 of 6 batches. The fix then was to show two entries with
 * consecutive indices.
 *
 * NO "index" FIELD ANY MORE. It was how a reply got matched back to an article,
 * and at BATCH_SIZE 1 it never did any matching: `pick` returns the only
 * article in the group without reading it. Asking for a field nothing consumes
 * cost tokens and produced index mismatches of its own. **If BATCH_SIZE ever
 * goes above 1, both the field and a second entry with consecutive indices have
 * to come back** — otherwise replies match the wrong articles, silently.
 *
 * The wrapper stays an array even for one article: the retry path re-asks for
 * whatever is missing, so the shape has to survive a batch of any size.
 *
 * THE PROSE IS A HAND-WRITTEN TARGET, not a previous run's output — it is the
 * voice the style guide is asking for, written out, because that is the only
 * part of the prompt the model imitates rather than interprets. Its `## `
 * headings keep their "1." "2." numbering inside the marker: the numbering is
 * the author's, the marker is what makes the renderers draw it as a heading.
 */
const SUMMARY_EXAMPLE = `{
  "articles": [
    {
      "zh_title": "推动历史的不是皇帝，是一家人的晚饭",
      "zh_thesis": "真正塑造历史的不是帝王将相，而是无数普通家庭为了填饱肚子产生的需求。",
      "zh_text": "教科书里总是让皇帝、将军和战争站在 C 位，但如果把镜头拉近，你会发现——真正撑起整个剧组、推动剧情发展的，其实是无数个普通家庭的日常。\\n\\n把时间拨回 4000 年前的古中东，看看当时的一个普通家庭是怎么“撬动历史”的：\\n\\n## 1. 吃饱饭，才是最硬核的“KPI”\\n\\n在古美索不达米亚，家庭最重要的任务就是种大麦。这里有两条大河灌溉，土地肥沃，粮食多就能养活更多人口。\\n\\n在古代，人口＝劳动力＝军队＝国力。哪个地方的家庭生得多、吃得饱，哪个地方就能变成超级大国。\\n\\n## 2. 一家人搞不定？“国家”诞生了！\\n\\n有些大事，光靠单打独斗或一个家庭根本做不成：\\n\\n修水利：想要灌溉农田、防范洪水，必须千家万户一起挖渠。这就需要有人来组织、指挥甚至强制大家干活——于是，最早的国家和政府就被“逼”出来了。\\n\\n拼团买大件：像牛和铁犁这种“重型装备”太贵了，普通家庭买不起，只能大家凑钱合买、轮流使用。\\n\\n## 3. 买买买，买出了“文明”\\n\\n没有哪个家庭能生产所有东西。除了自给自足，他们还需要去市场上买自己做不出的东西——陶罐、木头、铜器，甚至其他蔬菜。\\n\\n当千千万万个家庭都有了“买买买”的需求，交易就出现了，城市变热闹了，贸易路线铺开了。为了抢夺这些稀缺资源，国家之间开始打仗，文明也随之兴衰交替。\\n\\n一句话总结：并不是帝王将相“创造”了历史，而是无数普通家庭为了填饱肚子、过好日子所产生的需求，一步步把人类社会推向了现代。",
      "category": "culture"
    }
  ]
}`;

// --- shared plumbing --------------------------------------------------------

/**
 * One article as the model sees it.
 *
 * `budget` is passed only by the summary pass. The scoring pass returns a
 * single number and can do nothing with a length allowance, so sending it
 * there is noise in front of the one judgement that request exists to make.
 *
 * It rides in the USER message rather than the system prompt because it varies
 * per article: the system prompt stays byte-identical across every request in
 * a pass, which is what keeps hitting DeepSeek's cached prefix ($0.0028/M
 * against $0.14/M).
 */
function renderArticle(
  article: RawArticle,
  /** Only the summary pass numbers its articles — its reply is still a wrapped
   *  array matched back by index. The score pass sends one article and gets one
   *  bare object, so there is nothing to number. */
  index: number | undefined,
  budget?: number,
): string {
  const source = sourceOf(article.sourceId);
  return [
    index === undefined ? article.title : `[${index}] ${article.title}`,
    `source: ${source.name}`,
    `published: ${article.publishedAt}`,
    // Says CHINESE explicitly: measured with both languages in one reply, 9 of
    // 10 summaries ran over, and an unqualified "最多 N 字" next to a request
    // for two languages reads as the budget for the pair.
    //
    // No paragraph count and no per-paragraph ceiling any more — see budgetFor.
    // The only length rule the model gets is this total.
    ...(budget !== undefined
      ? [
          `budget: 正文最多 ${budget} 字，其中每一段最多 ${PARA_MAX} 字。` +
            `分几段你自己定，跟着内容走。` +
            `装不下就砍掉一整个点（收尾那句除外，它永远留着），` +
            `不要把两个点压成一句。`,
        ]
      : []),
    `body: ${article.body || "(body unavailable — judge from the title alone)"}`,
  ].join("\n");
}

/**
 * An empty summary, not a title-shaped one.
 *
 * This used to fall back to `article.title`, which rendered a headline inside
 * the summary block — indistinguishable from a real summary to anyone reading
 * the screenshot. Empty is honest: the components skip a block with no text,
 * and the headline is displayed beside it anyway.
 */
/** Every dimension at 0 with no note — "never judged", distinct from "judged
 *  and scored 1 across the board", which is a real verdict. */
function emptyReview(): ScoreReview {
  const review = {} as ScoreReview;
  for (const dimension of SCORE_DIMENSIONS) {
    review[dimension] = { score: 0, note: "" };
  }
  return review;
}

function emptyVerdict(): Verdict {
  return {
    judged: false,
    score: 0,
    review: emptyReview(),
    category: resolveCategory(undefined),
    titleZh: "",
    zh: { thesis: "", text: "" },
  };
}

/** Split into request-sized groups; see BATCH_SIZE. */
function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size));
  return out;
}

/**
 * Match a returned row back to the article it describes.
 *
 * The index is relative to the group that was sent, which is what lets the
 * same helper serve both the first attempt and a smaller retry. But when a
 * request carried exactly ONE article there is nothing to disambiguate, and
 * the index is pure ceremony the model gets wrong — it answered `1` for a
 * request containing only index 0, which silently dropped the result and cost
 * a retry. With one article in flight, whatever comes back is about it.
 */
function pick(group: RawArticle[], index: unknown): RawArticle | undefined {
  return group.length === 1 ? group[0] : group[Number(index)];
}

/**
 * The prompt and the weight table must name the SAME six dimensions, and this
 * fails at module load when they do not.
 *
 * It exists because the mismatch is otherwise invisible. The dimension list in
 * SCORE_SYSTEM is written out by hand — it has to be, each one carries its own
 * rubric — so renaming one there and not here leaves `readReview` looking for a
 * key no reply contains. Every article then comes back unjudged, scores 0, and
 * falls below the floor: a run that publishes an empty digest and logs no error
 * at all. That happened once, with `argument` renamed to `novelty` in the prompt
 * only.
 */
for (const dimension of SCORE_DIMENSIONS) {
  if (!SCORE_SYSTEM.includes(`"${dimension}"`)) {
    throw new Error(
      `SCORE_WEIGHTS names "${dimension}" but SCORE_SYSTEM never asks for it — ` +
        `every reply would be missing that field and every article would go ` +
        `unjudged. Keep the two lists in step.`,
    );
  }
}

/**
 * The six dimensions as the model sent them, or null if any one is unusable.
 *
 * Clamped to 1-10 rather than rejected when out of range: an 11 or a 0 is the
 * model overshooting a scale it otherwise understood, and throwing the whole
 * article away over one is worse than pulling it to the edge. A value that is
 * not a number at all is a different thing and fails the reply.
 */
function readReview(row: Record<string, unknown>): ScoreReview | null {
  const out = {} as ScoreReview;
  for (const dimension of SCORE_DIMENSIONS) {
    const raw = row[dimension];
    const field = (raw ?? {}) as Record<string, unknown>;
    const score = Number(field.score);
    if (!Number.isFinite(score)) return null;
    out[dimension] = {
      score: Math.max(1, Math.min(10, Math.round(score))),
      note: typeof field.note === "string" ? field.note.trim() : "",
    };
  }
  return out;
}

/** The weighted sum — 10 to 100 by construction, see SCORE_WEIGHTS. */
function totalScore(review: ScoreReview): number {
  const raw = SCORE_DIMENSIONS.reduce(
    (sum, d) => sum + review[d].score * SCORE_WEIGHTS[d],
    0,
  );
  return Math.max(SCORE_MIN, Math.min(SCORE_MAX, raw));
}

/** Index is relative to the group that was sent, so the same helper serves
 *  both the first attempt and the smaller retry. */
function applyScores(
  rows: Array<Record<string, unknown>>,
  group: RawArticle[],
  out: Map<string, Verdict>,
): void {
  let unmatched = 0;
  for (const row of rows) {
    const article = pick(group, row.index);
    if (!article) {
      unmatched += 1;
      continue;
    }
    // ALL SIX DIMENSIONS OR NONE. A reply missing one is a gap, not a zero on
    // that dimension: leaving `judged` false sends the article down the "never
    // judged" path instead of scoring it as though the model had judged it
    // harshly. Partial replies were the failure mode the old single `score`
    // field hid, because one missing number looked like a low one.
    const review = readReview(row);
    if (!review) continue;
    const verdict = out.get(article.id)!;
    verdict.judged = true;
    verdict.review = review;
    verdict.score = totalScore(review);
  }
  if (rows.length !== group.length || unmatched) {
    // No index list to print any more — the field is gone and `pick` matches by
    // position. At BATCH_SIZE 1 `unmatched` can only be a reply carrying more
    // objects than articles were sent.
    console.warn(
      `[daily]   sent ${group.length}, model returned ${rows.length}, ` +
        `${unmatched} could not be matched to an article`,
    );
  }
}

/** Both languages land together; each half is checked on its own so a reply
 *  that stopped after the Chinese is re-asked rather than published half. */
function applySummaries(
  rows: Array<Record<string, unknown>>,
  group: RawArticle[],
  out: Map<string, Verdict>,
): void {
  for (const row of rows) {
    const article = pick(group, row.index);
    if (!article) continue;
    const verdict = out.get(article.id)!;

    const zhThesis = asText(row.zh_thesis);
    if (zhThesis) {
      verdict.category = resolveCategory(row.category);
      verdict.titleZh = chineseTitle(row.zh_title, article.title);
      verdict.zh = {
        thesis: zhThesis,
        text: asBody(row.zh_text),
      };
    }
  }
}

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

/**
 * The Chinese headline, or "" meaning "there is no second line to show".
 *
 * ONE case collapses to empty here rather than in the components, so the stored
 * digest carries the decision instead of every renderer repeating it: the model
 * echoed the original instead of writing anything, and a card showing the same
 * string twice looks like a bug.
 *
 * It used to be two. The other was an already-Chinese headline, which the prompt
 * told the model to return untouched — so the "translation" WAS the original and
 * the page wanted one line. That exemption is gone: the field is a rewrite now,
 * not a translation, and a Chinese source gets a new headline like everything
 * else, with its own title kept underneath as the article's real name.
 *
 * A model that ignores the field entirely also lands here, which is the point:
 * the Chinese title is an enhancement, and its absence has to be ordinary.
 */
function chineseTitle(value: unknown, original: string): string {
  const rewritten = asText(value);
  return rewritten && rewritten !== original.trim() ? rewritten : "";
}

/**
 * Print the neighbourhood of a syntax error before giving up.
 *
 * There is no repair layer any more, so this log is the only record of what
 * came back. Every malformation found so far was identified from exactly this
 * output; without it a bad reply is undiagnosable after the fact.
 */
function logParseFailure(pass: string, raw: string, error: Error): void {
  const at = Number(/position (\d+)/.exec(error.message)?.[1] ?? NaN);
  const where = Number.isNaN(at)
    ? raw.slice(0, 300)
    : raw.slice(Math.max(0, at - 120), at + 120);
  console.error(
    `[daily] ${pass} pass returned malformed JSON (${error.message}); ` +
      `length=${raw.length}, around the error: …${where}…`,
  );
}

function extractRows(
  pass: string,
  message: OpenAI.Chat.Completions.ChatCompletionMessage,
): Array<Record<string, unknown>> {
  const raw = message.content;
  // DeepSeek documents that JSON mode "may occasionally return empty content".
  if (!raw?.trim()) throw new Error("model returned empty content");

  // Belt and braces: json_object should never fence, but a stray ```json
  // would otherwise fail the parse for a purely cosmetic reason.
  const unfenced = raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");

  try {
    return parseArticles(unfenced);
  } catch (error) {
    logParseFailure(pass, unfenced, error as Error);
    throw error;
  }
}

/**
 * Parse the reply as a SEQUENCE of JSON values, not a single one.
 *
 * Observed failure: the model closes the wrapper after the first article and
 * then carries on emitting the rest as siblings —
 *
 *   {"articles":[{…index 0…}]},{"index":1,…},{"index":2,…}
 *
 * `JSON.parse` stops at the first complete value and reports "Unexpected
 * non-whitespace character after JSON at position N". Treating the remainder
 * as junk to discard would silently lose three of four articles; it is not
 * junk, it is the rest of the batch. So: parse a value, take whatever
 * articles it holds, skip the separator, and go again.
 *
 * Deliberately narrow — this reads well-formed values that were merely framed
 * wrongly. Anything actually malformed still throws, and there is no
 * brace-counting repair here.
 */
function parseArticles(raw: string): Array<Record<string, unknown>> {
  const rows: Array<Record<string, unknown>> = [];
  let rest = raw.trim();
  let framingFixed = false;

  while (rest) {
    let value: unknown;
    let consumed: number;

    try {
      value = JSON.parse(rest);
      consumed = rest.length;
    } catch (error) {
      const at = Number(
        /after JSON at position (\d+)/.exec((error as Error).message)?.[1] ??
          NaN,
      );
      // Not the "value then more text" shape — genuinely malformed. Keep what
      // earlier iterations produced, or report the failure if there is none.
      if (Number.isNaN(at) || at === 0) {
        if (rows.length) break;
        throw error;
      }
      value = JSON.parse(rest.slice(0, at));
      consumed = at;
      framingFixed = true;
    }

    const holder = value as { articles?: unknown } | null;
    if (holder && Array.isArray(holder.articles)) {
      rows.push(...(holder.articles as Array<Record<string, unknown>>));
    } else if (holder && typeof holder === "object") {
      // A bare object. The score pass returns one of these BY DESIGN — no
      // wrapper, no array — and the summary pass produces one whenever a reply
      // escapes its wrapper. It used to be required to carry an "index" to be
      // recognised here, which stopped being a useful test once the scoring
      // reply dropped the field. An object with nothing usable in it costs
      // nothing: the appliers skip any row without the numbers they need.
      rows.push(holder as Record<string, unknown>);
    }

    // Step past the value and any stray separators before the next one.
    const next = rest.slice(consumed).replace(/^[\s,\]}]+/, "");
    if (next.length >= rest.length) break; // no progress — stop rather than spin
    rest = next;
  }

  if (framingFixed) {
    console.warn(
      `[daily] reply was split across several JSON values — recovered ` +
        `${rows.length} article(s)`,
    );
  }
  return rows;
}

/**
 * One JSON-mode call. No tool definitions and no `tool_choice`, so there is
 * nothing for a provider to reject and no second attempt to make — the
 * fallback that used to live here existed only for a 400 on `tool_choice`.
 */
async function callModel(
  client: OpenAI,
  pass: string,
  system: string,
  user: string,
  example: string,
  temperature?: number,
): Promise<Array<Record<string, unknown>>> {
  const params: DeepSeekParams = {
    model: MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content:
          `${user}\n\nReply with json only — no prose, no code fence — ` +
          `shaped exactly like this example:\n${example}`,
      },
    ],
    ...(isDeepSeek(DEEPSEEK_BASE_URL)
      ? { thinking: { type: "disabled" as const } }
      : {}),
    // Omitted entirely when undefined, so the summary pass keeps the provider
    // default rather than being pinned to some value chosen here.
    ...(temperature === undefined ? {} : { temperature }),
  };

  const response = await client.chat.completions.create(params);
  const choice = response.choices[0];
  if (!choice?.message) throw new Error("model returned no choices");

  // Truncation produces invalid JSON too, and the fix is a bigger budget
  // rather than anything at the parsing end.
  if (choice.finish_reason === "length") {
    console.warn(
      `[daily] ${pass} pass hit max_tokens (${MAX_OUTPUT_TOKENS}) and is truncated`,
    );
  }

  const chars = choice.message.content?.length ?? 0;
  console.log(`[daily] ${pass} pass replied with ${chars} chars`);

  return extractRows(pass, choice.message);
}

/**
 * The body as the model sent it, normalised to the one shape the renderers read:
 * paragraphs separated by a blank line.
 *
 * IT ACCEPTS AN ARRAY TOO, and joins it. Not for old data — nothing stored is
 * read back through here — but because the prompt asked for an array of
 * paragraphs for a long time, and a model that slips back into the old shape
 * would otherwise lose the entire body to a `String(["a","b"])` reading
 * "a,b". Cheap to tolerate, expensive to discover.
 */
function asBody(value: unknown): string {
  const raw = Array.isArray(value)
    ? value
        .map(String)
        .map((part) => part.trim())
        .filter(Boolean)
        .join("\n\n")
    : String(value ?? "");
  // Collapse the runs the model improvises — three blank lines and one mean the
  // same break — and drop trailing space so `report` counts characters, not air.
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Returns a verdict per article, keyed by article id.
 *
 * TWO passes: score everything, drop what the floor rejects, then summarize
 * only what survived. A verdict therefore comes back in one of three states —
 * scored and summarized, scored and rejected (no summary, by design), or never
 * judged at all because the call failed. The last two both vanish from the
 * page: `Verdict.judged` separates them for the log, not for the floor.
 */
export async function summarize(
  articles: RawArticle[],
): Promise<Map<string, Verdict>> {
  const out = new Map<string, Verdict>();
  if (articles.length === 0) return out;

  // Newest first — if the cap bites, we drop the stalest items.
  const batch = articles.slice(0, MAX_ARTICLES_PER_CALL);
  // Say so when it bites. The cut used to be invisible: the counts below are
  // taken over `batch`, so a run that quietly discarded 18 of 48 articles
  // still reported a clean "scored 30/30", and the discarded ones surfaced
  // only as score-0 entries with no explanation attached.
  if (articles.length > MAX_ARTICLES_PER_CALL) {
    console.log(
      `[daily] cap — ${articles.length} fetched, scoring the newest ` +
        `${MAX_ARTICLES_PER_CALL}; the ` +
        `${articles.length - MAX_ARTICLES_PER_CALL} oldest never reach the ` +
        `model and are dropped unscored`,
    );
  }
  for (const article of articles) out.set(article.id, emptyVerdict());

  if (!DEEPSEEK_API_KEY) {
    console.warn(
      "[daily] DEEPSEEK_API_KEY unset — publishing without summaries",
    );
    return out;
  }

  const client = new OpenAI({
    apiKey: DEEPSEEK_API_KEY,
    baseURL: DEEPSEEK_BASE_URL,
    // A single-article reply is ~300 characters and normally lands in well
    // under 30s. The old 180s × 2 retries let one stalled request hold a
    // worker for nine minutes, and with our own retry loop on top the tail
    // reached half an hour — a run that took 28s one time took over ten
    // minutes the next. Failing fast is better here: our loop re-asks anyway,
    // and a fresh request is more likely to return than a hung one.
    maxRetries: 1,
    timeout: 60_000,
  });

  // --- pass 1: score every article, one per request ---
  const scoreBatches = chunk(batch, BATCH_SIZE);

  // Retries live inside the worker so a stumble on one article never blocks
  // the others; the whole pass is bounded by REQUEST_CONCURRENCY.
  await mapLimited(scoreBatches, REQUEST_CONCURRENCY, async (group, i) => {
    const label = `${SCORE_PASS} ${i + 1}/${scoreBatches.length}`;

    for (let attempt = 0; attempt <= GAP_RETRIES; attempt += 1) {
      // Covers both failure modes at once: a request that threw, and one that
      // returned valid JSON with entries silently missing.
      const missing = group.filter((a) => !out.get(a.id)?.judged);
      if (!missing.length) return;

      try {
        const rows = await callModel(
          client,
          attempt ? `${label} retry ${attempt}` : label,
          SCORE_SYSTEM,
          `Here ${missing.length === 1 ? "is 1 article" : `are ${missing.length} articles`}. ` +
            `Score every one of them.\n\n` +
            missing.map((a) => renderArticle(a, undefined)).join("\n\n---\n\n"),
          SCORE_EXAMPLE,
          SCORE_TEMPERATURE,
        );
        applyScores(rows, missing, out);
      } catch (error) {
        if (attempt === GAP_RETRIES) {
          console.error(
            `[daily] ${label} failed after ${attempt + 1} attempts ` +
              `(${group.length} article(s) keep bare titles): ` +
              `${(error as Error).message}`,
          );
        }
      }
    }
  });

  // --- the floor, applied before a single summary is written ---
  //
  // This is the whole reason scoring runs on its own: an article below the
  // floor costs one small reply and then nothing else. Articles the score pass
  // never spoke for are dropped too — see the floor in jobs/daily.ts for why
  // the exemption they used to get was removed.
  // A whitelisted article has to be summarized even when it scores nothing:
  // it is going on the page either way, and the one thing worse than a weak
  // article is a weak article with no summary under it.
  const survivors = batch.filter((a) => {
    const verdict = out.get(a.id)!;
    if (sourceOf(a.sourceId).alwaysPublish) return true;
    return verdict.judged && verdict.score >= PUBLISH_MIN_SCORE;
  });
  const exempt = survivors.filter(
    (a) =>
      sourceOf(a.sourceId).alwaysPublish &&
      (out.get(a.id)!.score < PUBLISH_MIN_SCORE || !out.get(a.id)!.judged),
  ).length;
  const unjudged = batch.filter((a) => !out.get(a.id)!.judged).length;
  console.log(
    `[daily] scored ${batch.length - unjudged}/${batch.length}; ` +
      `${survivors.length} at or above the floor (${PUBLISH_MIN_SCORE}), ` +
      `${batch.length - unjudged - survivors.length} dropped unsummarized` +
      (exempt ? `, ${exempt} below it but whitelisted` : "") +
      (unjudged ? `, ${unjudged} unscored and dropped` : ""),
  );
  if (survivors.length === 0) return out;

  // --- pass 2: both summaries, survivors only ---
  const summaryBatches = chunk(survivors, BATCH_SIZE);
  await mapLimited(summaryBatches, REQUEST_CONCURRENCY, async (group, i) => {
    const label = `${SUMMARY_PASS} ${i + 1}/${summaryBatches.length}`;

    for (let attempt = 0; attempt <= GAP_RETRIES; attempt += 1) {
      const missing = group.filter((a) => !out.get(a.id)!.zh.thesis);
      if (!missing.length) return;

      try {
        const rows = await callModel(
          client,
          attempt ? `${label} retry ${attempt}` : label,
          SUMMARY_SYSTEM,
          `Here ${missing.length === 1 ? "is 1 article" : `are ${missing.length} articles`}. ` +
            `Summarize every one of them, in Chinese and then in English.\n\n` +
            missing
              .map((a, j) => renderArticle(a, j, budgetFor(a.readingMinutes)))
              .join("\n\n---\n\n"),
          SUMMARY_EXAMPLE,
        );
        applySummaries(rows, missing, out);
      } catch (error) {
        if (attempt === GAP_RETRIES) {
          console.error(
            `[daily] ${label} failed after ${attempt + 1} attempts ` +
              `(${group.length} article(s) keep bare titles): ` +
              `${(error as Error).message}`,
          );
        }
      }
    }
  });

  report(survivors, out);
  return out;
}

/** Surface what would otherwise degrade silently: a missing half, and
 *  summaries that came back too thin to replace the article. Measured over the
 *  articles that cleared the floor — the rejected ones have no summary on
 *  purpose and would read as failures here. */
function report(survivors: RawArticle[], out: Map<string, Verdict>): void {
  let zh = 0;
  let thin = 0;
  let over = 0;
  const lengths: number[] = [];

  for (const article of survivors) {
    const verdict = out.get(article.id);
    if (!verdict?.zh.thesis) continue;
    zh += 1;

    const chars = verdict.zh.thesis.length + verdict.zh.text.length;
    lengths.push(chars);
    if (chars < ZH_MIN) thin += 1;
    // Against ITS OWN budget, not a shared number — that is the only ceiling
    // this article was ever given.
    if (chars > budgetFor(article.readingMinutes)) over += 1;
  }

  const total = survivors.length;
  const median =
    lengths.sort((a, b) => a - b)[Math.floor(lengths.length / 2)] ?? 0;
  console.log(
    `[daily] summaries — ${zh}/${total} written, ` +
      `median ${median} chars, over their own budget: ${over}/${total}, ` +
      `under ${ZH_MIN}: ${thin}/${total}`,
  );
}
