import OpenAI from "openai";
import { CATEGORIES, PUBLISH_MIN_SCORE, resolveCategory } from "./categories";
import { SCORE_DIMENSIONS, SCORE_MAX, SCORE_MIN, SCORE_WEIGHTS } from "./score";
import { DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, MODEL } from "./config";
import { USER_CONFIG } from "./user-config";
import { bodyFor, type RawArticle } from "./fetcher";
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
const REQUEST_CONCURRENCY = 8;

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
 * NO RETRIES ANYWHERE IN THIS FILE. Every pass asks once and takes what comes
 * back; `GAP_RETRIES = 2` and the four loops around it are gone.
 *
 * WHAT THAT GIVES UP, kept here because it is a real measurement rather than a
 * worry: long replies do not only fail loudly — asked for 8 summaries the model
 * regularly returned 5 or 6 and no error at all, the JSON valid and simply
 * short. The gap is detectable (an article with no thesis) and re-asking for
 * exactly the missing ones used to close it. Now it does not get closed: the
 * article publishes with a bare title, the score pass leaves it unjudged, the
 * photo keeps its English caption.
 *
 * TWO THINGS MAKE THAT LESS BAD THAN IT SOUNDS. BATCH_SIZE is 1, so "returned 5
 * of 8" is not a shape a request can have any more — a reply is whole or it is
 * absent. And the client keeps `maxRetries: 1`, which still covers the network
 * faults that a re-ask was never the right answer to.
 *
 * Every failure is logged where it happens, and `report` counts what came back.
 * That is the whole safety net now.
 */

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
 * The floor, stated to the model AND counted by `report`.
 *
 * The comment here used to say no floor was stated any more — that had stopped
 * being true: SUMMARY_SYSTEM carries 「但下限是 ${ZH_MIN} 字」 next to the budget,
 * and it is deliberate. A minimum on its own is a padding instruction, and
 * paired with "cover the article" it made compression the one move that
 * satisfied both. What it sits next to now is 「装不下就少讲一层」 — the floor says
 * an empty summary is a failure, and the sentence after it says the way out is
 * fewer points, not denser ones.
 *
 * The 106-character all-platitudes reply recorded in the prompt is what a run
 * with no floor at all looks like.
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
  /**
   * The English half, or null when the reply carried only the Chinese one.
   *
   * Null rather than an empty SummaryText because the two are read differently:
   * `zh.thesis` being empty is what marks an article as never summarized, while
   * a missing English half is a take that shipped without one — see
   * `applySummaries`. Keeping it nullable makes "there is no English take for
   * this article" a value the job can copy straight into the optional field on
   * `Article.summary`.
   */
  en: SummaryText | null;
}

/**
 * Rebuild a verdict map from scores that were written to disk.
 *
 * The two-step path (`npm run score` … `npm run summary`) runs the two passes
 * in separate processes, so pass 2 cannot be handed the map pass 1 built. It
 * gets this instead: the stored judgement, plus the empty summary fields pass 2
 * is about to fill. Whatever edited the scores in between is none of this
 * function's business — it copies the number it is given.
 */
export function verdictsFrom(
  entries: Iterable<{
    id: string;
    judged: boolean;
    score: number;
    review?: ScoreReview;
    /** The summary pass's own fields, when the day already has them. Carrying
     *  them in is what makes a re-run cheap: an article that arrives with a
     *  thesis is not in `missing`, so no request is made for it. */
    category?: string;
    titleZh?: string;
    summary?: { zh: SummaryText; en?: SummaryText };
  }>,
): Map<string, Verdict> {
  const out = new Map<string, Verdict>();
  for (const entry of entries) {
    const empty = emptyVerdict();
    out.set(entry.id, {
      ...empty,
      judged: entry.judged,
      score: entry.score,
      review: entry.review ?? empty.review,
      category: entry.category ?? empty.category,
      titleZh: entry.titleZh ?? empty.titleZh,
      zh: entry.summary?.zh ?? empty.zh,
      en: entry.summary?.en ?? empty.en,
    });
  }
  return out;
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
7-8: A contestable position argued from more than one angle, or a mechanism that clearly generalises past its own subject and you can say where to. **A rule the reader can act on counts here WHEN THE PIECE SUPPLIES THE MECHANISM** — "the one golden rule of writing is to read a lot" is a 7 if it says what reading actually does to a writer's ear, and a 3 if it only asserts it. State the mechanism in your note; if you cannot, it is not a 7.
5-6: A clear position argued from one example or one line of reasoning; interesting inside its own subject, travels a little. **THIS IS AN ORDINARY GOOD BLOG POST.** A list of rules or tips caps here when the reasons behind the items are thin — what the reader takes away is the list, not why any item works.
3-4: A position is visible but the piece mostly recounts, or it is selection with commentary attached — a link roundup with opinions, a list of tips asserted with no reason given why any of them works, a summary of someone else's paper.
1-2: Restates as "X happened" with nothing of substance lost (launches, benchmark tables, version bumps, release notes), or selection only: "what I have been reading", a digest of comments, a paragraph passing on another outlet's reporting.

Reviewing someone else's book or paper is NOT relaying, provided the piece argues its own case.

## 2. "surprise" — 颠覆直觉，还是老生常谈 (值不值得复述)

9-10: Contradicts a belief the reader almost certainly holds AND contains one sentence they would repeat almost verbatim. NAME THE BELIEF and QUOTE THE SENTENCE; missing either, not a 9.
7-8: Points at something the reader had not noticed — a hidden mechanism, an unexpected cause, a specific number or paradox worth mentioning to someone. State it in one sentence.
5-6: A fresh angle on a familiar topic. Interesting while being read, but it confirms what an informed reader suspected rather than overturning it, and nothing specific survives closing the tab. **MOST ARTICLES ARE HERE.** A familiar CONCLUSION belongs here too, not below, when the piece supplies the mechanism or the evidence that would actually make the reader do it — an old maxim shown to be true for a reason the reader did not know is not a cliché. Its worth is then scored in "substance" and "relevance", not here.
3-4: A familiar argument with new examples — predictable from the headline, and only interesting to someone already following the subject.
1-2: Cliché ASSERTED with nothing behind it ("AI will change jobs", "sleep is good for health" — said and not shown), or dry throughout — changelogs, corporate announcements, feature lists.

## 3. "accessible" — 是否抛弃了行业黑话 (通俗度)

9-10: Zero domain knowledge needed, and the hard idea is carried by an analogy or a human scene a 15-year-old would follow.
7-8: One or two technical terms, each explained on the spot in a few words. Everything else is plain language.
5-6: The subject belongs to an industry the reader does not work in. Followable, but the world has to be explained before the point can land. **IN A TECH-LEANING DIGEST THIS IS MOST ARTICLES.**
3-4: Several terms assume a practitioner. The piece can be followed but not retold.
1-2: DEEP GEEK — internal architecture, API quirks, a debugging story that means nothing to anyone who has not hit that exact bug, jargon the argument cannot survive losing. **Score it low here even when the piece is excellent**; the excellence belongs in "substance", not here.

## 4. "relevance" — 能否触发智力共鸣 (好奇心关联)

9-10: The reader will do something differently after reading — money, health, work, family, housing, the city they live in. **A PRACTICE COUNTS AS AN ACTION**: a way of writing, training, eating, sleeping or working that the reader could adopt this week is as much a 9 as a decision about money, provided the piece is specific enough to be followed. NAME THE ACTION; no action, no 9.
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
 * against the ~12,000 that broke it. Each half is still read separately below,
 * so a reply that stops after the Chinese publishes as Chinese-only rather than
 * as a half-empty English take — nothing re-asks for it, see the note on
 * retries at the top of this file.
 */
const SUMMARY_PASS = "summary";

/**
 * What the English half has to be, stated once and interpolated into BOTH
 * prompts that ask for it: the summary pass, which writes it beside the Chinese,
 * and the backfill pass, which writes it for a digest that already shipped
 * without one.
 *
 * SHARED RATHER THAN COPIED because the two must not drift. An English take
 * written by the backfill is published on the same page, under the same headline,
 * next to the same poster as one written by the daily run — a reader cannot tell
 * which produced the article they are reading, so neither should be allowed its
 * own idea of what the English is supposed to sound like.
 *
 * The Chinese rules are NOT shared this way and should not be: the backfill never
 * writes Chinese, so there is one caller and nothing to keep in step.
 *
 * NOT SHARED IS NOT FREE, and this is the drift it produced. This block used to
 * say 「中文没有小标题（新写的概要都不该有，见「连着讲」那条）」 — written when the
 * Chinese rules said to write straight through without headings. The Chinese side
 * has since flipped to 「尽量用小标题，1 到 3 个」, the 「连着讲」 rule it pointed at
 * no longer exists, and nothing here noticed: the English half was being told to
 * drop headings the Chinese half had just been told to write, under a heading that
 * says 「结构跟着中文走」. It now states the correspondence and nothing else, which
 * is the only form that cannot go stale when the Chinese rules move again.
 */
const EN_RULES = `"en_thesis" 和 "en_text" 是**同一篇概要**的英文：同一个论点、同样的证据、同样的段落断点。中文那边的硬要求这边同样有效 —— 第三人称、不分点、段落写长了就拆。

**结构跟着中文走。** 中文几个小标题英文就几个、位置一一对应，中文几段英文就几段。不许英文这边自己长出中文没有的标题、编号或分点。

**写地道英文，不是逐词换。** 现代类比要**重新本地化，不是翻译**：「拼团买大件」是 chipping in with the neighbours，不是 group-buying；「C 位」是 centre stage，不是 the C position；「KPI」「打卡」这类已经进入英文办公语汇的词照用。直译过来的中文梗，英文读者读到的是一句不知所云的话。

英文里不许出现「」『』和中文标点，引话用单引号 —— 直双引号在这边同样会让整条 JSON 失效。

**两边的读者不会同时看到两种语言**，英文必须自己站得住：只读英文的人，最后知道的东西要和只读中文的人一样多。产品名、公司名、人名、模型名两边都照原样。`;

/**
 * The style guide. CUT BY A FIFTH, from ~5,100 characters to ~4,000, and what
 * went was duplication rather than rules: every rule that was here is still here,
 * stated once. What it had accumulated instead was the same rule argued three
 * times over — the per-paragraph ceiling appeared in the style bullets, in the
 * field list and again in the format section; the swap-two-paragraphs test
 * appeared in a worked example and then as a rule; 摘要-versus-讲述 was argued in
 * the opening and re-argued 2,000 characters later. A rule repeated in three
 * wordings is three things to keep in step, and the model reads the third one no
 * more carefully than the first.
 *
 * TWO PIECES OF EVIDENCE LEFT THE PROMPT AND LIVE HERE INSTEAD, because they are
 * reasons for a maintainer not to delete a rule, not instructions for the model:
 *
 *   - The emoji ban. Asking Google Fonts for a character like 💣 returns
 *     something that is not a usable font file at all, so the poster's subset has
 *     no emoji glyph and any emoji in the body renders as an empty box.
 *
 *   - The ✗/✓ worked example (Amazon scanning and pulping books). Its ✗ half —
 *     conclusion-shaped lede, three headings tracking the article's own three
 *     sections, blocks that swap freely — survives as prose, because naming the
 *     bad shape is what the rule cannot do on its own. Its ✓ half was 600
 *     characters of a second full rewrite whose one exclusive job was showing
 *     unnumbered headings, and SUMMARY_EXAMPLE shows those now that its own
 *     numbering is stripped. The swap test itself stays as a rule.
 *
 * The rest of the file's measurements stay where they are enforced: PARA_MAX for
 * the 251-character wall, budgetFor for the length curve.
 */
const SUMMARY_SYSTEM = `你是一位极具洞察力的科技人文评论员，擅长用优雅的幽默和恰到好处的冷嘲热讽解读文章。

**先把文章读懂，然后合上它，用自己的话讲一遍 —— 讲给一个初中二年级的学生听。**

总结是对着原文提取要点，讲述是理解之后从头组织。前者必然是原文的缩小版：顺序跟着原文、每句都是某段的压缩。写完自问：**这读起来像一个懂行的人在讲，还是像一份摘要。**

**讲清一件事，不是覆盖全文。** 一篇文章通常只有一件事真正值得让人知道 —— 找到它，讲透，其余不提，写不到原文十分之一完全正常。给你的文章都已经判定值得收录，直接写，不要再评价它够不够格。

## 怎么写

- **语气像懂行的朋友在吐槽**，不是讲台上念课本。**刻薄必须落在具体的事上** ——「又一个把用户当韭菜的订阅制」有对象；「这很讽刺」「令人深思」是空话，删掉之后句子反而更好
- **点出作者在骂谁、在反抗什么。把有立场的文章写成中立综述，是这里最常见的失手**
- 巧用现代类比（KPI、拼团、C位、打卡、外包）帮读者迅速建立画面
- **尽量用小标题，1 到 3 个**：它是换气点不是目录条目，标的是「讲到哪儿了」而不是「第几个要点」。短文用一个也行，但**不要一个都不用** —— 那样段落容易越写越长
- **结尾留一句大实话**：抛开所有高大上的名词，用最接地气的一句话给读者留个东西

## 让初中生读得懂

标准：一个初二学生读完能把这件事讲给同学听 —— 讲不出来就是有台阶没铺。

**一、专有名词第一次出现就当场解释。** 「以色列的 Nimbus 项目」——Nimbus 是什么？读者卡在名字上，后面写得再好也接不上。**但删掉的是名字，不是事实**：名字换成一句人话（「以色列花 12 亿请谷歌和亚马逊替政府建云、后来被曝用于监视巴勒斯坦人」），不是把整件事删掉。实测栽过：这条第一版写成「要么解释要么不提」，模型判定一篇文章「全都不值得提」，交出 106 字全是空话 —— **读得懂每个字却什么也没学到，是最坏的结果。**

**二、行业黑话包括看起来像中文的词。** 「从 0 到 1」写成「自己想出新东西」，「知识产权垄断」写成「专利和版权攥在少数几家公司手里」。**抽象名词堆的句子读着像话，其实没画面。**

**三、数字必须带参照。** 「850 万台设备瘫痪」——多吗？「不到全球 Windows 电脑的 1%，就足够让机场停摆」才有意义。

**四、一句话最多两个逗号**，超过就拆。段落短了，句子照样能长得读不懂。

## 讲述，不是分点

**一篇只讲一件事。** 讲透一件事需要的是背景、机制、后果这类**同一条线上的东西**，不是三个并列的话题。写完**逐段**检查：**任意两个相邻段落，交换顺序而不影响理解，就说明它们是并列条目而不是讲述** —— 合并，或者砍掉一个（实测栽过：一篇讲各国数字主权的文章一段塞一个国家，四段随便换顺序都读得通）。

最常写坏的形状：一句结论式导语，然后三个小标题对应原文的三个部分，顺序跟着原文，每节两句话。**从一个具体动作开口，不要从结论开口**，收尾那句留给讲述者自己的判断。

**小标题少不等于连贯。** 把二十一条规则归并成三个主题、每个主题底下写一大坨，那还是分点，只是分得少了。原文本身是一份清单（十条建议、二十条规则）时这条最容易破：**不要挑几条来讲，去讲这份清单背后的那一件事** —— 它为什么存在、它假设了什么、照着做的人真正会遇到什么。二十一条译成二十一段是翻译，译成三段还是摘要。

**每段最多 ${PARA_MAX} 字。** 不是「大约」，是上限，每一段都算，跟「一篇只讲一件事」是**两道独立的闸**。**写长了拆成两段，不要从里面删字**；一段里塞了四个并列例子，改短的办法是**砍掉三个**，不是把四个压得更紧。小标题也不是写长段的许可：一个小标题下面三四个短段是正常的。

**字数预算跟文章一起给你**，那是上限不是目标，写不满完全没关系，凑字数比短更糟。**但下限是 ${ZH_MIN} 字**：低于它说明写空了，不是写精炼了。装不下就少讲一层，不要把两层压成一句。

## 格式硬要求

**不许用 emoji。** 正文会被画进分享海报，海报的字体子集里没有 emoji 字形，写了就是一个空方框。

**不许在字段值里用直双引号**，中文用「」；**不许在字符串里塞真的换行**，段落之间写 "\\n\\n" 这两个转义。一个游离的引号、一个未转义的换行，都会让 JSON 失效。

**正文里唯一允许的 markdown 是小标题**，写成「## 标题」，单独占一块。其它一概不解析 —— 没有星号加粗、没有减号列表、没有链接、没有引用块，写了就在读者屏幕上显示成字面符号。**小标题里不许有编号**：「## 1. 版权法的护身符」写成「## 版权法成了护身符」，编号是目录的记号，它一出现，三个小标题就变成了三个并列条目。

**第三人称，正文里不许出现「我」「我们」「咱们」「笔者」。** 讲述者不是原文作者：原文写「我发现蓝牙耳机断连」，这里写「作者发现自己的蓝牙耳机断连」；不要用「我们」把概要和读者绑在一起（写「人们」）。要交代是谁在说就点名：「作者认为」「研究者的结论是」。**不知道性别就写「作者」**，不要按名字猜（实测同一篇文章两次跑分别写成「他」和「她」，至少有一次是编的）。**「你」不受影响**，设问和把读者拉进场景都照常用 —— 那个「你」指任何人，不会跟作者的自称打架。

## 返回什么（json 格式）

每篇文章一条，字段如下：
- "zh_title" —— 中文标题，见下面「标题」。
- "zh_thesis" —— 一句话论点，能独立成立、能被人反驳。
- "zh_text" —— 正文，**一整个字符串，不是数组**。段落之间写 "\\n\\n"，分几段你自己定，但**每段最多 ${PARA_MAX} 字**。
- "en_thesis" 和 "en_text" —— 同一篇概要的英文版，见下面「英文」。
- "category" —— 见下面「分类」。

**按上面的顺序填字段。** 中文先写完，英文从写好的中文来，两半就不会各说一套；"category" 放最后，因为写到那时你才真的知道这篇是什么。

一篇文章一条。绝不允许一条盖住几篇、少写几篇，或者给没给你的文章编一条。

## 标题

"zh_title" 是给这篇文章重写一个中文标题，目标是让人想点开 —— 但它得是这篇文章的标题，不是一句随便的耸动话。**原标题是中文的也要重写**（原标题会作为文章的本名单独显示在新标题下面）。

- **挑最反常识的那一点**：文章里最让人「等一下，真的吗」的地方。
- **给具体的东西**：一个数字、一个名字、一个动作、一个后果。「AI 让资深程序员慢了 19%」比「关于 AI 与生产力的一些思考」强，因为前者有个能被反驳的说法。
- **疑问句、反转、只说一半都可以**，但留的那一半必须在正文前两段就兑现。
- **短。最多 ${TITLE_MAX} 字**，越短越好。

下面几条比「抓眼球」优先，冲突的时候让标题平淡也没关系：
- **不许骗。** 每个说法都要在正文里站得住：原文说「某些任务上慢了 19%」，标题不能写成「AI 让程序员废了」。
- **不许编**数字、人名、机构、结论，原文没有的一个都不许出现。
- **不许出现「我」**（引号内引用原话除外）：写「作者靠给日记编索引提升了写作」，不写「我如何靠写日记提升写作」。
- **不许用空心钩子**：「震惊」「太可怕」「你绝对想不到」「细节令人深思」「速看」—— 零信息量，删掉之后标题反而更好。
- **不许写成目录**：「关于 X 的三个要点」「X 的五个启示」不是标题。
- 产品名、公司名、人名、模型名照原样保留，不要音译、不要缩写。
- 原标题本身已经够抓人的时候，直接译过来就是最好的答案 —— 重写不是义务。

## 英文

${EN_RULES}

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
 * The wrapper stays an array even for one article: BATCH_SIZE is the only thing
 * deciding how many entries a request carries, so the shape has to survive a
 * batch of any size.
 *
 * THE PROSE IS A HAND-WRITTEN TARGET, not a previous run's output — it is the
 * voice the style guide is asking for, written out, because that is the only
 * part of the prompt the model imitates rather than interprets. Its `## `
 * headings carry NO "1." "2." numbering, because the prompt forbids numbering in
 * headings and this example is read as the stronger of the two: the numbers were
 * here while that rule was also here, which is a contradiction the model settles
 * by copying rather than by obeying.
 *
 * BOTH HALVES ARE HAND-WRITTEN, and the English one is doing a second job: it is
 * the only place the prompt can SHOW what "localise the analogy, do not translate
 * it" means. 「拼团买大件」 is written here as neighbours chipping in, 「C 位」 as
 * centre stage — and KPI stays KPI, because that one really did cross over. A rule
 * this soft is imitated far more reliably than it is followed.
 *
 * The two halves have the SAME paragraph count and the SAME three headings, block
 * for block. That is the contract the English section states in prose, and the
 * example is where the model actually reads it.
 */
/**
 * The hand-written target, field by field, SHARED between the two examples.
 *
 * `SUMMARY_EXAMPLE` composes all of it; `BACKFILL_EXAMPLE` composes the English
 * pair alone and shows the Chinese as input instead. Split for that reason and no
 * other — a second copy of 2,000 characters of prose is a second thing to edit
 * and a guaranteed drift.
 *
 * Every note on `SUMMARY_EXAMPLE` below applies to these strings: they are
 * written by hand rather than lifted from a run, the two halves mirror each other
 * block for block, and the English is where "localise the analogy" is shown
 * rather than merely asked for.
 */
const EXAMPLE_ZH_TITLE = `推动历史的不是皇帝，是一家人的晚饭`;
const EXAMPLE_ZH_THESIS = `真正塑造历史的不是帝王将相，而是无数普通家庭为了填饱肚子产生的需求。`;
const EXAMPLE_ZH_TEXT = `教科书里总是让皇帝、将军和战争站在 C 位，但如果把镜头拉近，你会发现——真正撑起整个剧组、推动剧情发展的，其实是无数个普通家庭的日常。\\n\\n把时间拨回 4000 年前的古中东，看看当时的一个普通家庭是怎么“撬动历史”的：\\n\\n## 吃饱饭，才是最硬核的“KPI”\\n\\n在古美索不达米亚，家庭最重要的任务就是种大麦。这里有两条大河灌溉，土地肥沃，粮食多就能养活更多人口。\\n\\n在古代，人口＝劳动力＝军队＝国力。哪个地方的家庭生得多、吃得饱，哪个地方就能变成超级大国。\\n\\n## 一家人搞不定？“国家”诞生了！\\n\\n有些大事，光靠单打独斗或一个家庭根本做不成：\\n\\n修水利：想要灌溉农田、防范洪水，必须千家万户一起挖渠。这就需要有人来组织、指挥甚至强制大家干活——于是，最早的国家和政府就被“逼”出来了。\\n\\n拼团买大件：像牛和铁犁这种“重型装备”太贵了，普通家庭买不起，只能大家凑钱合买、轮流使用。\\n\\n## 买买买，买出了“文明”\\n\\n没有哪个家庭能生产所有东西。除了自给自足，他们还需要去市场上买自己做不出的东西——陶罐、木头、铜器，甚至其他蔬菜。\\n\\n当千千万万个家庭都有了“买买买”的需求，交易就出现了，城市变热闹了，贸易路线铺开了。为了抢夺这些稀缺资源，国家之间开始打仗，文明也随之兴衰交替。\\n\\n一句话总结：并不是帝王将相“创造”了历史，而是无数普通家庭为了填饱肚子、过好日子所产生的需求，一步步把人类社会推向了现代。`;
const EXAMPLE_EN_THESIS = `History was not driven by kings and generals but by the everyday needs of countless ordinary families trying to put dinner on the table.`;
const EXAMPLE_EN_TEXT = `Textbooks give emperors, generals and wars the centre stage. Zoom in, though, and you find that the ones actually holding the production together — and moving the plot along — were millions of ordinary households going about their day.\\n\\nSo rewind 4,000 years to the ancient Near East and watch how one unremarkable family levered history along:\\n\\n## Getting fed was the original hardcore KPI\\n\\nIn ancient Mesopotamia a family's most important job was growing barley. Two great rivers watered the land, the soil was rich, and more grain meant more mouths could be fed.\\n\\nIn the ancient world people were labour, labour was an army, and an army was national power. Wherever families had more children and enough to feed them, that is where a superpower grew.\\n\\n## Too big for one household? Enter the state\\n\\nSome jobs were simply beyond a single family, however hard it worked:\\n\\nIrrigation: watering the fields and holding back the floods meant thousands of households digging one canal. Somebody had to organise that, direct it, and at times force people to turn up — which is how the earliest states and governments got squeezed into existence.\\n\\nBig-ticket items: an ox and an iron plough were heavy equipment, far beyond one family's savings, so neighbours chipped in together, bought one between them, and took turns.\\n\\n## Shopping built civilisation\\n\\nNo household could make everything it needed. Beyond what they grew themselves, families went to market for what they could not produce — pots, timber, bronze, even someone else's vegetables.\\n\\nOnce millions of households all wanted to buy, trade appeared, cities filled up and trade routes spread out. States went to war over the scarce goods behind all of it, and civilisations rose and fell along with them.\\n\\nIn one line: emperors and generals did not create history. The needs of countless ordinary families trying to eat well and live a little better pushed human society, step by step, into the modern world.`;

const SUMMARY_EXAMPLE = `{
  "articles": [
    {
      "zh_title": "${EXAMPLE_ZH_TITLE}",
      "zh_thesis": "${EXAMPLE_ZH_THESIS}",
      "zh_text": "${EXAMPLE_ZH_TEXT}",
      "en_thesis": "${EXAMPLE_EN_THESIS}",
      "en_text": "${EXAMPLE_EN_TEXT}",
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
    // Says CHINESE explicitly, and says the English does not count — restored
    // with the English half, because an unqualified "最多 N 字" next to a request
    // for two languages does not say whose budget it is.
    //
    // IT IS NOT THE FIX FOR ANYTHING, and the measurement is worth carrying next
    // to it so nobody re-discovers this hopefully: with both languages in one
    // reply 9 of 10 summaries ran over their budget, and adding this exact
    // qualifier moved that to 8 of 10. The overrun is the price of merging the
    // two languages into one reply, not a wording bug — see the README section on
    // the English half. This clause is here because the ambiguity is real, not
    // because it buys discipline.
    //
    // The English gets no number of its own. Its length is pinned to the Chinese
    // by structure instead — same paragraphs, same headings — which is a rule the
    // model can check itself, where a second character count would be one more
    // soft budget to miss.
    //
    // No paragraph count and no per-paragraph ceiling any more — see budgetFor.
    // The only length rule the model gets is this total.
    ...(budget !== undefined
      ? [
          `budget: 中文正文最多 ${budget} 字（英文不计入），` +
            `其中每一段最多 ${PARA_MAX} 字。` +
            `分几段你自己定，跟着内容走，英文段数照中文走。` +
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
    en: null,
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
 * The index is relative to the group that was sent, which is what lets one
 * helper serve a group of any size. But when a request carried exactly ONE
 * article there is nothing to disambiguate, and the index is pure ceremony the
 * model gets wrong — it answered `1` for a request containing only index 0,
 * which silently dropped the result. Back when a retry existed that cost a
 * second request; now it costs the article its take outright. With one article
 * in flight, whatever comes back is about it.
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

/** Index is relative to the group that was sent, so one helper serves a group
 *  of any size. */
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

/**
 * Both languages land together, and EACH HALF IS TAKEN ON ITS OWN.
 *
 * The Chinese decides whether this article was summarized at all: an empty
 * `zh.thesis` is what every reader downstream reads as "no take". A reply that
 * arrives mangled or short leaves it empty, and NOTHING ASKS AGAIN — the retry
 * loop that used to is gone, see the note at the top of this file.
 *
 * NEITHER HALF IS WRITTEN UNLESS IT ARRIVED WHOLE, which is what makes a failed
 * request safe: the caller does not clear the previous take before asking, so a
 * rewrite that comes back empty leaves whatever was there. An article whose
 * English never arrives publishes with `zh` alone and reads as Chinese on /en,
 * which is where the site already was.
 *
 * `report` counts what came back in each language, so this degrades in the log
 * rather than silently. If that count is ever routinely bad the escalation is one
 * line — add the English to the `missing` predicate in the summary pass.
 *
 * Both fields are required for the English to count: a thesis with no body is a
 * card with a claim and nothing under it, which is worse than the fallback.
 */
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
        // Omitted rather than stored empty, on the same rule as `titleZh` and
        // the English half: an absent field means "there are none", and an
        // empty array would make a model that skipped the field look like one
        // that considered the question and came back with nothing.
      };
    }

    const enThesis = asText(row.en_thesis);
    const enText = asBody(row.en_text);
    if (enThesis && enText) {
      verdict.en = { thesis: enThesis, text: enText };
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
 * The client, with the one retry this file still has anywhere in it.
 *
 * A helper rather than a literal inside `summarize`, because `englishFor` needs
 * exactly the same settings and a second copy would be a second place for them
 * to drift.
 */
function makeClient(): OpenAI {
  return new OpenAI({
    apiKey: DEEPSEEK_API_KEY,
    baseURL: DEEPSEEK_BASE_URL,
    // A single-article reply is ~300 characters and normally lands in well
    // under 30s. The old 180s × 2 retries let one stalled request hold a worker
    // for nine minutes, and with the gap loops that used to sit on top the tail
    // reached half an hour — a run that took 28s one time took over ten minutes
    // the next.
    //
    // ONE RETRY, NOT ZERO, and it is the only one left: it covers a connection
    // that never opened or a 5xx, which is the class of fault where the same
    // request sent again genuinely works. Everything above it now asks once.
    maxRetries: 1,
    timeout: 60_000,
  });
}

// --- the backfill pass: English for a digest that shipped without it -------

const BACKFILL_PASS = "backfill-en";

/**
 * The English of a take that ALREADY EXISTS in Chinese.
 *
 * A third prompt rather than a third mode of the summary one, because the input
 * is a different thing: not an article to summarize but a summary to render in
 * the other language. It never sees the original article — the digests do not
 * store the body, and re-fetching a URL that was live weeks ago is a different
 * job with its own failure modes (dead links, paywalls that closed since).
 *
 * WHICH IS NOT A COMPROMISE, and this is the reason the whole backfill is only a
 * prompt and a loop: the live path writes the English FROM the Chinese too, in
 * the same call, deliberately, so the two halves cannot drift apart. Working from
 * the Chinese take is what the daily run does. Doing it a day later, from a take
 * read off disk instead of one still in memory, is the same operation.
 *
 * So the one rule this prompt has that the summary prompt does not: add nothing.
 * A model given a take and asked for its English has a standing temptation to
 * improve it — fill a gap the Chinese left, drop a point it finds weak — and any
 * of that makes /en and /zh disagree about what the article said.
 */
const BACKFILL_SYSTEM = `你的任务是把一篇已经写好的中文概要，写成英文。

给你的是这个站已经发布过的中文概要，它是替读者读完原文用的。**原文你看不到，也不需要看。**

## 返回什么

每条概要一条，字段如下：
- "en_thesis" —— 一句话论点，就是中文 thesis 那一句的英文。
- "en_text" —— 正文，**一整个字符串，不是数组**。段落之间写 "\\n\\n" 这两个转义。

一条概要一条。绝不允许一条盖住几条、少写几条，或者给没给你的概要编一条。

## 只译不改

**中文里有的都要有，中文里没有的一个都不许加。**

- 不许补充中文没提到的事实、数字、人名、机构、结论 —— 你看不到原文，任何补充都是编的。
- 不许因为觉得某个要点弱就删掉它，也不许自己合并两个要点。
- 中文有几个小标题，英文就是几个；中文分了几段，英文就分几段。**逐块对应。**
- 中文那句收尾（「一句话总结」之类）照样收尾，不要省掉。

${EN_RULES}`;

/**
 * ONE entry, matching BATCH_SIZE — see the long note on SUMMARY_EXAMPLE for why
 * an example with one entry is a contract for one entry.
 *
 * The Chinese is shown as INPUT rather than as a field to fill: this pass returns
 * the English alone, and an example carrying a `zh_text` slot would invite the
 * model to rewrite the Chinese too — which the job would then have to decide
 * whether to trust. It does not: the backfill only ever writes `summary.en`.
 */
const BACKFILL_EXAMPLE = `{
  "articles": [
    {
      "en_thesis": "${EXAMPLE_EN_THESIS}",
      "en_text": "${EXAMPLE_EN_TEXT}"
    }
  ]
}`;

/** One take to translate: its id, so the caller can put the answer back, and the
 *  article's own headline, which is how names and products are spelled. */
export interface EnglishRequest {
  id: string;
  title: string;
  zh: SummaryText;
}

/**
 * The English half for takes that never got one.
 *
 * Keyed by id, and ONLY ids that came back — a caller writing this into a digest
 * must be able to tell "no English for this one" from "an empty English for this
 * one", exactly as `applySummaries` does on the live path.
 *
 * ONE REQUEST PER TAKE, like the summary pass and for the same reason: the reply
 * carries ~2,000 characters of prose, and every malformation in this file scales
 * with reply size. `chunk` is not used because there is nothing to chunk at size
 * one; if BATCH_SIZE ever means something here, the example needs a second entry
 * and an `index` field first — see the note on SUMMARY_EXAMPLE.
 */
export async function englishFor(
  items: EnglishRequest[],
): Promise<Map<string, SummaryText>> {
  const out = new Map<string, SummaryText>();
  if (!items.length) return out;

  if (!DEEPSEEK_API_KEY) {
    console.warn("[daily] DEEPSEEK_API_KEY unset — no English to backfill with");
    return out;
  }

  const client = makeClient();

  await mapLimited(items, REQUEST_CONCURRENCY, async (item, i) => {
    const label = `${BACKFILL_PASS} ${i + 1}/${items.length}`;

    try {
      const rows = await callModel(
        client,
        label,
        BACKFILL_SYSTEM,
        `Here is 1 Chinese summary. Write its English.\n\n` +
          `title: ${item.title}\n` +
          `zh_thesis: ${item.zh.thesis}\n` +
          `zh_text: ${item.zh.text}`,
        BACKFILL_EXAMPLE,
      );
      for (const row of rows) {
        const thesis = asText(row.en_thesis);
        const text = asBody(row.en_text);
        // Both halves, same as the live path: a claim with nothing under it is
        // worse than falling back to the Chinese.
        if (thesis && text) out.set(item.id, { thesis, text });
      }
    } catch (error) {
      console.error(
        `[daily] ${label} failed ` +
          `(${item.id.slice(0, 8)} keeps its Chinese only): ` +
          `${(error as Error).message}`,
      );
    }
  });

  console.log(`[daily] backfill — ${out.size}/${items.length} English written`);
  return out;
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
/**
 * THE CAP, APPLIED IDENTICALLY BY BOTH HALVES.
 *
 * `scoreAll` and `summarizeSurvivors` each slice their input, rather than the
 * first handing the second a already-capped list, because the two now run in
 * separate processes: `npm run score` writes every fetched article to the day's
 * file and `npm run summary` reads them back. Slicing in one place only would mean
 * the summarize half saw articles the score half never scored — and an unscored
 * article whose source is `alwaysPublish` would then be summarized, which is
 * exactly the case the cap exists to stop.
 *
 * Newest first — if the cap bites, we drop the stalest items — which is why
 * `Plan.articles` must keep fetch order.
 */
function capped(articles: RawArticle[]): RawArticle[] {
  return articles.slice(0, MAX_ARTICLES_PER_CALL);
}

/**
 * Pass 1 on its own: every article scored, nothing summarized.
 *
 * Split out of `summarize` so the score can be looked at, and argued with,
 * before any of the expensive half runs — see `WorkingDigest` in lib/store.ts.
 * The returned map
 * holds an entry for EVERY article, `emptyVerdict()` for the ones the model
 * never answered for and for the ones the cap dropped.
 */
export async function scoreAll(
  articles: RawArticle[],
): Promise<Map<string, Verdict>> {
  const out = new Map<string, Verdict>();
  if (articles.length === 0) return out;

  const batch = capped(articles);
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

  const client = makeClient();

  // --- pass 1: score every article, one per request ---
  const scoreBatches = chunk(batch, BATCH_SIZE);

  // One request per group, and a failure stays inside the worker so a stumble
  // on one article never blocks the others; the whole pass is bounded by
  // REQUEST_CONCURRENCY.
  await mapLimited(scoreBatches, REQUEST_CONCURRENCY, async (group, i) => {
    const label = `${SCORE_PASS} ${i + 1}/${scoreBatches.length}`;

    try {
      const rows = await callModel(
        client,
        label,
        SCORE_SYSTEM,
        `Here ${group.length === 1 ? "is 1 article" : `are ${group.length} articles`}. ` +
          `Score every one of them.\n\n` +
          group.map((a) => renderArticle(a, undefined)).join("\n\n---\n\n"),
        SCORE_EXAMPLE,
        SCORE_TEMPERATURE,
      );
      applyScores(rows, group, out);
    } catch (error) {
      console.error(
        `[daily] ${label} failed ` +
          `(${group.length} article(s) keep bare titles): ` +
          `${(error as Error).message}`,
      );
    }
  });

  const unjudgedCount = batch.filter((a) => !out.get(a.id)!.judged).length;
  console.log(
    `[daily] scored ${batch.length - unjudgedCount}/${batch.length}` +
      (unjudgedCount ? `, ${unjudgedCount} unscored` : ""),
  );
  return out;
}

/**
 * Pass 2 on its own: the floor, then a summary for everything above it.
 *
 * `verdicts` is whatever `scoreAll` produced — possibly with scores a human has
 * since edited, which is the point. It is mutated in place and returned, so the
 * caller can hand the same map to the digest builder.
 */
export async function summarizeSurvivors(
  articles: RawArticle[],
  out: Map<string, Verdict>,
): Promise<Map<string, Verdict>> {
  if (articles.length === 0) return out;
  const batch = capped(articles);

  if (!DEEPSEEK_API_KEY) {
    console.warn(
      "[daily] DEEPSEEK_API_KEY unset — publishing without summaries",
    );
    return out;
  }

  const client = makeClient();

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
    // THE SCORE ALONE, not `judged && score`. The extra clause was redundant
    // — an unjudged article carries 0 and 0 is below any floor — and once a
    // human can write the score it is actively wrong: a number typed into the
    // file for an article the model never answered for is still a decision to
    // publish it, and this filter would have silently dropped it while the
    // floor downstream let it through, i.e. published it with no summary.
    return verdict.score >= PUBLISH_MIN_SCORE;
  });
  const exempt = survivors.filter(
    (a) =>
      sourceOf(a.sourceId).alwaysPublish &&
      (out.get(a.id)!.score < PUBLISH_MIN_SCORE || !out.get(a.id)!.judged),
  ).length;
  /**
   * Three counts that partition the batch, and they have to be derived from
   * `survivors` rather than from `judged`.
   *
   * The arithmetic here used to be `batch - unjudged - survivors`, on the
   * assumption that a survivor is always an article the model scored. That
   * stopped being true the moment a human could type a number into the file:
   * a run where every model call failed and one score was set by hand printed
   * "-1 dropped unsummarized".
   */
  const kept = new Set(survivors.map((a) => a.id));
  const dropped = batch.filter((a) => !kept.has(a.id));
  const unscored = dropped.filter((a) => !out.get(a.id)!.judged).length;
  console.log(
    `[daily] ${survivors.length} at or above the floor ` +
      `(${PUBLISH_MIN_SCORE}), ${dropped.length} below it` +
      (unscored ? ` (${unscored} of them never scored)` : "") +
      (exempt ? `, ${exempt} below it but whitelisted` : ""),
  );
  if (survivors.length === 0) return out;

  // --- pass 2: both languages, survivors only ---
  const summaryBatches = chunk(survivors, BATCH_SIZE);
  await mapLimited(summaryBatches, REQUEST_CONCURRENCY, async (group, i) => {
    const label = `${SUMMARY_PASS} ${i + 1}/${summaryBatches.length}`;

    /**
     * CLEARED FIRST, WRITTEN BACK ONLY ON SUCCESS.
     *
     * Every survivor is rewritten on every run — an article that already has a
     * take is not skipped, which is what makes re-running the way to replace one
     * that came back wrong (in the wrong language, over budget, shaped like a
     * listicle) instead of hand-editing the file.
     *
     * THE FIELDS GO EMPTY BEFORE THE REQUEST, and they stay empty if it fails.
     * The alternative — ask first, overwrite only what comes back — leaves the
     * old take standing whenever the model stumbles, so a run that "succeeded"
     * can publish a mix of takes from two different runs with nothing saying
     * which is which. Empty is a state the rest of the job already handles:
     * `publishFrom` holds an article with no thesis off the page and says so.
     *
     * The cost is real and is the point: A FAILED REWRITE COSTS THAT ARTICLE ITS
     * TAKE FOR THE DAY. There are no retries here (see the note at the top of
     * this file), so one failed request is the whole story for that article.
     *
     * A MISSING BODY IS FETCHED BACK, NOT WORKED AROUND. A published digest
     * carries none (see WorkingArticle in lib/store.ts), so a re-run over a day
     * that already shipped used to have only the headline to work from —
     * `bodyFor` goes and gets the article again. When even that fails the
     * request still goes out with no body, because the alternative is a command
     * that silently does nothing on exactly the days someone is fixing
     * something; `renderArticle` says so in the request, and what comes back is
     * a headline-grade take that replaces a better one. Re-score the day
     * instead if that matters.
     *
     * The re-fetched text is not guaranteed to be the text that was SCORED —
     * see the note on `bodyFor`.
     */
    const sending: RawArticle[] = [];
    for (const article of group) {
      // Only when the file no longer has one: a normal run's articles arrive
      // with their bodies and must not be re-fetched, both for the request it
      // saves and because the body they carry is the one they were scored on.
      const body = article.body || (await bodyFor(article.url));
      sending.push(body === article.body ? article : { ...article, body });

      const verdict = out.get(article.id)!;
      const empty = emptyVerdict();
      verdict.category = empty.category;
      verdict.titleZh = empty.titleZh;
      verdict.zh = empty.zh;
      verdict.en = empty.en;
    }

    try {
      const rows = await callModel(
        client,
        label,
        SUMMARY_SYSTEM,
        `Here ${sending.length === 1 ? "is 1 article" : `are ${sending.length} articles`}. ` +
          `Summarize every one of them, in Chinese and then in English.\n\n` +
          sending
            .map((a, j) => renderArticle(a, j, budgetFor(a.readingMinutes)))
            .join("\n\n---\n\n"),
        SUMMARY_EXAMPLE,
      );
      applySummaries(rows, sending, out);
    } catch (error) {
      // The fields were cleared above and nothing wrote them back, so these
      // articles now have no take at all — `publishFrom` holds them off the
      // page and logs them again there.
      console.error(
        `[daily] ${label} failed ` +
          `(${group.length} article(s) lose their take): ` +
          `${(error as Error).message}`,
      );
    }
  });

  report(survivors, out);
  return out;
}

/** Surface what would otherwise degrade silently: a missing half, and
 *  summaries that came back too thin to replace the article. Measured over the
 *  articles that cleared the floor — the rejected ones have no summary on
 *  purpose and would read as failures here.
 *
 *  THESE COUNTS ARE THE WHOLE SAFETY NET, now that no pass re-asks for anything
 *  (see the note on retries at the top of this file). A day where the English
 *  reads 3/14 is a day most of the English site fell back to Chinese, and a day
 *  where the first number is short is a day some articles kept bare titles —
 *  nothing else anywhere says so. */
function report(survivors: RawArticle[], out: Map<string, Verdict>): void {
  let zh = 0;
  let en = 0;
  let thin = 0;
  let over = 0;
  const lengths: number[] = [];

  for (const article of survivors) {
    const verdict = out.get(article.id);
    if (!verdict?.zh.thesis) continue;
    zh += 1;
    if (verdict.en) en += 1;

    // The CHINESE length: `budgetFor` is a Chinese-character budget and the
    // prompt tells the model the English does not count against it.
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
    `[daily] summaries — ${zh}/${total} written, ${en}/${total} with English, ` +
      `median ${median} chars, over their own budget: ${over}/${total}, ` +
      `under ${ZH_MIN}: ${thin}/${total}`,
  );
}

// --- the caption pass: one line under the day's photograph ------------------

const CAPTION_PASS = "caption";

/**
 * A FOURTH PROMPT rather than a mode of the backfill one, and the direction is
 * the reason: every other pass in this file writes Chinese from a Chinese source
 * or English from Chinese. This one goes English → Chinese, and it is translating
 * a stranger's sentence about a photograph rather than rewriting our own prose.
 *
 * The invention rule is the same rule as everywhere else in this file, and it
 * matters more here than it looks: the model cannot see the photograph. Anything
 * it adds — a colour, a time of day, a mood — is made up about an image the
 * reader is looking at, which is the one place a fabrication is instantly
 * visible. It is the only rule left.
 *
 * FOUR LINES, DOWN FROM THIRTY-FIVE. What went was a length ceiling, a fixed
 * order for what to delete when the English overran it, a list of the kinds of
 * detail to drop, and a worked argument for each — machinery for fitting a
 * translation into 60 characters. None of it is needed once the answer to "how
 * long should this be" is "as long as the English is": the caption is prose in a
 * `<p>` under a full-width plate, so the description's own length is the right
 * length, and a rule that trims it is a rule that makes the Chinese say less than
 * the English. The ceiling went with it — `photoCaptionMaxChars` is gone from
 * config.json rather than left there unread.
 *
 * The JSON-safety line stays because it is mechanical rather than editorial: one
 * straight double quote invalidates the whole reply. `callModel` supplies the
 * shape and the "json only" instruction itself, which is why nothing here
 * describes the wrapper.
 */
const CAPTION_SYSTEM = `把维基共享资源为一张照片写的英文说明，翻译成中文。

- "zh" —— 译文。英文说了什么就译什么，一句不漏，也不许添英文里没有的东西 —— 你看不到这张照片，读者看得到。
- **专有名词：给了中文名的，照给的写。** 没给又没有通行中译的就留原文，不要音译硬造，更不要按字面意思拆开翻 —— Coldai 不是「冷」。
- 中文引号用「」，不许出现直双引号 —— 一个直引号就让整条 json 失效。`;

/**
 * The shape, and — more than that — the LENGTH and the completeness.
 *
 * It used to be a single 55-character clause, which was the right example while
 * the ceiling was 60 and the Chinese was allowed to be a label. The model imitates
 * this string more closely than it follows any rule above it, so an example that
 * stops at the subject and the anchor teaches exactly the caption this pass is no
 * longer supposed to write.
 *
 * The USS Missouri lithograph on purpose: it is the archive's worst case for the
 * old rules — most of its description is what happened AFTER the picture — and it
 * shows that half being translated rather than dropped.
 */
const CAPTION_EXAMPLE = `{
  "zh": "《直布罗陀港内 USS 密苏里号意外失火》石版画。火起于 1843 年的今天，四小时内这艘蒸汽护卫舰就烧成一具焦黑下沉的空壳，8 月 27 日凌晨 3 点 20 分前部弹药库爆炸，将燃烧的船彻底摧毁"
}`;

/**
 * One Chinese caption for the day's photograph, or "" when there is no Chinese
 * to be had.
 *
 * CALLED FOR EVERY PHOTO THAT HAS AN ENGLISH DESCRIPTION, which is nearly all of
 * them. It used to run only on the days Wikimedia held no simplified-Chinese
 * caption of its own, on the reasoning that a hand-written caption beats a
 * translation and is free. Both halves of that were wrong about what the two
 * strings are: the English is `description.text`, a written sentence carrying the
 * day's anchor, while the Chinese is a STRUCTURED CAPTION, which is a title —
 * 「多洛米堤山脚下的科尔代湖」 against 230 characters of English on the same
 * photograph. Preferring it was not choosing the better sentence, it was choosing
 * the shorter kind of thing. It is the fallback now; see lib/photo.ts.
 *
 * RETURNS "" ON FAILURE, and the caller decides what to do about it. It used to
 * return the English on the grounds that an English line under the photo beats no
 * line at all — which is still true, and is still what happens, one level up.
 * What changed is that there is now a THIRD option worth trying first: on a day
 * Wikimedia does hold a Chinese title, that title is better than an English
 * paragraph, and a fallback buried in here could not know it existed.
 */
export async function captionZh(
  english: string,
  date: string,
  /**
   * Wikimedia's own simplified-Chinese label for the file, when it has one.
   *
   * NOT A FALLBACK HERE — the caller holds that; see lib/photo.ts. It is passed in
   * as a GLOSSARY, because it is the one thing in this pass that the model cannot
   * derive and should not guess: how the subject's name is written in Chinese. Left
   * to itself it invented three different names for the same lake across three runs
   * — 科尔代湖, 科达伊湖, and then 冷湖, which is `Coldai` read as the English word
   * "cold" — while Wikimedia had a hand-written 「多洛米堤山脚下的科尔代湖」 sitting
   * in the payload the whole time.
   *
   * A fact in the user message rather than a rule in the system prompt, which is
   * the distinction this prompt is now built on: the system prompt says what to do
   * and stays four lines, and anything that is knowledge about THIS photograph
   * travels with the photograph.
   */
  zhLabel = "",
): Promise<string> {
  const source = english.trim();
  if (!source) return "";

  if (!DEEPSEEK_API_KEY) {
    console.warn("[daily] DEEPSEEK_API_KEY unset — no Chinese caption");
    return "";
  }

  const client = makeClient();

  const label = `${CAPTION_PASS} ${date}`;
  try {
    const rows = await callModel(
      client,
      label,
      CAPTION_SYSTEM,
      `Here is 1 English caption. Write its Chinese.\n\nen: ${source}` +
        (zhLabel ? `\n\n维基自己的中文标题（专有名词照它写）: ${zhLabel}` : ""),
      CAPTION_EXAMPLE,
    );
    for (const row of rows) {
      const zh = asText(row.zh);
      if (!zh) continue;
      return zh;
    }
  } catch (error) {
    console.error(
      `[daily] ${label} failed (the caller falls back): ` +
        `${(error as Error).message}`,
    );
  }

  return "";
}
