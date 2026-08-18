import OpenAI from "openai";
import { CATEGORIES, PUBLISH_MIN_SCORE, resolveCategory } from "./categories";
import { DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, MODEL } from "./config";
import { USER_CONFIG } from "./user-config";
import type { RawArticle } from "./fetcher";
import { sourceOf } from "./sources";
import type { SummaryText } from "./types";

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
 * TWO calls, split by JOB rather than by language: score everything, then
 * summarize only what cleared the floor, both languages in the one reply.
 *
 * The split used to run the other way — Chinese+score, then English from the
 * Chinese — because asking for score + Chinese + English together returned
 * Chinese for 10/10 articles and English for 0/10, the model filling the first
 * fields of each object and stopping. THAT WAS MEASURED WITH A BATCH OF
 * ARTICLES PER REQUEST. At BATCH_SIZE 1 the same combined reply is ~2,900
 * characters and comes back whole (10/10 with both halves, measured), so the
 * lesson is about reply size, not about combining languages.
 *
 * Scoring goes first so the floor can be applied before any summary is
 * written: on the sample that is 8 of 18 articles never summarized at all.
 */
const MAX_ARTICLES_PER_CALL = 30;

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
 * So this is now only the top of `budgetFor`, reached by an hour-long essay
 * and by nothing else.
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
 * Ceiling on ONE paragraph. It used to be ZH_MAX / 2.5, and that derivation is
 * what made the prose unreadable: a 300-character budget divided into thirds
 * gave the model a 120-character paragraph, and it filled every one of them
 * with a single sentence carrying five clauses — a conference abstract, not
 * something a person reads on a phone.
 *
 * Now it moves independently, and it moved DOWN while the total went up. Short
 * paragraphs are half of what makes the target voice work: the model cannot
 * pack five clauses into a paragraph it is only allowed 90 characters for, so
 * this ceiling does the work the style instructions alone could not.
 *
 * It has stayed at 90 across every move the total has made (300 → 420 → 600 →
 * 450 → a per-article curve) and that is the point. The total buys PARAGRAPH
 * COUNT, not paragraph length — the rhythm is a property of this number, and
 * moving it to "keep the ratio" in either direction would bring the
 * 92-character single-sentence paragraph straight back. It is why `budgetFor`
 * spends a bigger budget on more paragraphs and never on longer ones.
 */
const PARA_MAX = USER_CONFIG.summaryParaMaxChars;

/**
 * What ONE article is allowed, derived from how long that article is.
 *
 * Driven by `readingMinutes` rather than a raw character count because
 * `reading.ts` already normalises the two alphabets the feeds mix — CJK
 * codepoints at 400/min, everything else at 230 wpm — so a Chinese post and an
 * English one of the same substance land on the same number.
 *
 * Logarithmic, not proportional: the compression ratio should RISE with
 * length. A 1-minute link post has one thing to say and 200 characters is
 * already generous; a 60-minute essay has a dozen and still cannot have
 * 12,000. The constants fit two points picked editorially — ~200 characters at
 * 1 minute, ~475 at 10 — and the ZH_MAX clamp only bites past an hour.
 *
 * Against the same 14-day sample the median budget lands at 377 where the flat
 * one was 450, so MOST articles get less room than before, not more. Only the
 * long ones gain, which is the whole point.
 *
 * Nothing enforces any of this: it is written into the request and the model
 * obeys it or does not. The flat 450 was broken by 13% of summaries, and there
 * is no truncation or retry here to change that — a summary that runs long is
 * published long, and `report` counts it.
 */
function budgetFor(readingMinutes: number): {
  chars: number;
  paraLow: number;
  paraHigh: number;
} {
  const minutes = Math.max(1, readingMinutes);
  const chars = Math.min(ZH_MAX, Math.round(90 + 160 * Math.log(minutes + 1)));
  // Paragraph COUNT absorbs the budget, because PARA_MAX caps how long each
  // one may be: 800 characters over "3 to 5 paragraphs" would demand
  // 160-character paragraphs, contradicting that ceiling outright.
  return {
    chars,
    paraLow: Math.min(7, Math.max(2, Math.round(chars / 95))),
    paraHigh: Math.min(9, Math.max(3, Math.round(chars / 70))),
  };
}

/**
 * DeepSeek's v4 models run in thinking mode by default, at effort `high`.
 * Thinking tokens bill as output, and this job extracts and scores rather than
 * reasoning at length, so it is off. The knob is DeepSeek-specific, so it is
 * only sent to DeepSeek. https://api-docs.deepseek.com/guides/thinking_mode/
 *
 * IT WAS TRIED ON, for pass 1, on the theory that a pass which JUDGES should
 * think first — the scores were badly bunched (40 of 64 published articles
 * between 50 and 75, five of one day's thirteen tied at exactly 65, the same
 * article re-scored 20 points apart across two runs).
 *
 * It cost 4 of 15 articles their summaries. Reasoning and `json_object` do not
 * cohabit: measured over one reproduction, 5 of 8 pass-1 calls came back with
 * an EMPTY content field — DeepSeek documents this as an occasional JSON-mode
 * fault and thinking turns "occasional" into 62%. It is not truncation
 * (`finish_reason` was never "length") and not the timeout (the failures were
 * 1-to-7-minute articles while a 74-minute one succeeded).
 *
 * The scoring fix that came out of that experiment lives in the prompt instead
 * — "score" is the LAST field written, so it is judged against a summary that
 * already exists. That part works with thinking off.
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
   * scored and dropped (the digest should not carry it) versus never judged
   * because the call failed (it keeps its place as a bare title). Without this
   * flag those look identical downstream, and a model outage would publish
   * every rejected article instead of none.
   */
  judged: boolean;
  score: number;
  category: string;
  /** The headline in Chinese; "" when it was already Chinese or came back empty.
   *  See `titleZh` in types.ts. */
  titleZh: string;
  zh: SummaryText;
  en: SummaryText;
}

// --- pass 1: score only -----------------------------------------------------

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

const SCORE_SYSTEM = `You are the first reader for a daily digest aimed at a curious generalist: smart, widely read, not a specialist in whatever field the article belongs to. Your only job is to decide how much that reader gains from the piece.

Return one entry per article, as json, with exactly two fields:
- "index" — the number the article was given in brackets, like [3].
- "score" — 0-100, by the rubric below.

NOTHING ELSE. No summary, no headline, no category, no reasoning. Just the number.

ONE ENTRY PER ARTICLE. Every article you are given gets its own object in "articles", carrying the index it was given. Never one object covering several, never a subset, and never an entry for an article you were not given.

SCORING — four tests, then the landing.

Tests 1-3 are CEILINGS: hitting one caps the score at the band named, and a piece that hits several takes the LOWEST cap. Test 4 is a BONUS: it moves a piece around inside the band its ceiling allows, and can never lift it over that ceiling. Test 5 is where it finally lands.

1. ARGUMENT OR ANNOUNCEMENT? Does it reason toward a contestable claim, or report that something happened?
- If the whole piece can be restated as "X happened" with nothing of substance lost, it is news. CAP: 30s.
- Launches, benchmark tables, version bumps, link roundups. CAP: 30s however important the event — this digest is for opinion and analysis, not for keeping up.
- A model, chip or product release. CAP: 20s, even when the thing released matters enormously.

2. DOES A NON-SPECIALIST COME AWAY WITH ANYTHING? The reader is curious and widely read, but is not a practitioner in this field and never will be.
- Written for people already inside — one library's internals, one chip's fabrication step, one browser's decoder quirk, one framework's release notes, one conference talk's recap. CAP: 20s.
- The one exception: the mechanism it uncovers TRANSFERS to how the reader thinks about something else, and then there is no cap. "A 16-year-old bug in SQLite's WAL reset corrupted a production database" transfers — it is about how silent data corruption hides. "Here is how DRAM capacitors are etched" does not.
- The test is portability out of the field, not fascination inside it.

3. A CLAIM, OR A LIST? Did the writer supply judgment, or only selection?
- A digest of the week's best reader comments, a "what I have been reading lately" list, a paragraph passing on what another outlet reported. CAP: 20s-30s, however good the material it points at — the reader's takeaway is "here are some things", which is not a takeaway.
- The test: delete the writer and see what is lost.
- NOT relaying: reviewing someone else's book, paper or reporting, PROVIDED the piece argues. 「音乐版权的规则不是天然如此，是一层层临时补丁堆出来的，内部互相矛盾」 is a claim you can disagree with, and it scores as an argument even though the occasion was somebody else's book. But 「这本书讲了 A、B、C，值得一读」 is a list wearing a review's clothes.
- NOT about length: 「外置卷帘在美国买不到，因为木框架加护墙板的房子根本装不了，也就没有供应链」 is four paragraphs carrying a claim with a mechanism under it, and it beats a long, careful relay of another outlet's reporting.

4. WOULD AN ORDINARY PERSON WANT TO READ IT? Up to +15, the only test that adds rather than caps. It moves a piece INSIDE the band tests 1-3 allow: a product launch that is a delight to read is still a product launch, still capped in the 20s.
What earns it:
- It is about something people live with — money, health, work, housing, schooling, cities, what AI is doing to their job.
- There are people and scenes in it, not only propositions: somebody did something, somewhere, and it turned out a particular way.
- It has a hook — a fact that contradicts what you assumed, a number startling on its own, something you would repeat at dinner.
- You can walk in with no background. Nothing has to be explained before it becomes interesting.
What does not:
- Interesting only to people already in the field. That is test 2, which caps rather than adds.
- Worthy but inert: correct, well-sourced, and about an abstraction from the first line to the last.
Be honest rather than generous. Most pieces earn +0 to +5; +15 is for the one a reader would send to a friend.

5. WHERE IT LANDS. Under the ceilings, score by how much a generalist gains, then add the bonus from 4. Be harsh; use the full range — a run where most articles land between 50 and 75 means the range is not being used, and the middle is where a bad score hides.`;

const SCORE_EXAMPLE = `{
  "articles": [
    {
      "index": 0,
      "score": 72
    }
  ]
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

const SUMMARY_SYSTEM = `You edit a daily digest for a curious generalist: smart, widely read, not a specialist in whatever field the article belongs to.

YOUR SUMMARY REPLACES THE ARTICLE — they finish it and never open the original. Not "should I read this?" but "now I know this."

Every article you are given has already been judged worth carrying. Summarize it; do not re-litigate whether it deserves the space.

The rules below are grouped: what to return, then the headline, then how the summary is written, how it ends, how long it runs, then the English half, and finally how it is classified. Read all of them before writing anything.

## 一、返回什么

Return one entry per article, with these fields:
- "index" — the number the article was given in brackets, like [3].
- "zh_title" — the HEADLINE in Chinese. See 二 below.
- "zh_thesis" — ONE sentence carrying the claim on its own; something a reader could disagree with.
- "zh_paragraphs" — SHORT paragraphs, each AT MOST ${PARA_MAX} characters; how many this article gets is stated with it. They carry the context and the evidence the claim rests on, and THE LAST ONE IS ALWAYS A CLOSING — see 四 below.
- "en_thesis" and "en_paragraphs" — the same summary in English. See 六.
- "category" — see 七.

FILL THE FIELDS IN THE ORDER LISTED. The Chinese is written first and the English is written from it, so the two halves cannot drift apart; "category" is last because by then you know what the piece actually is.

ONE ENTRY PER ARTICLE. Every article you are given gets its own object in "articles", carrying the index it was given. Never one object covering several, never a subset, and never an entry for an article you were not given.

FORMATTING: never put a straight double-quote inside a value — use 「」 in the Chinese and single quotes in the English. A stray quote breaks the JSON.

## 二、标题

"zh_title" 是把原标题译成中文，不是重写，也不是把论点缩短成标题。原文说什么就译什么，包括它故意的含糊、疑问句和反讽；不要替它把答案补上。原标题是「Why does Opus 5 feel worse to work with?」就译「为什么 Opus 5 用起来更难受？」，不要译成「Opus 5 因为对齐基准而失去了主动提问的能力」——那是论点，论点有自己的字段。

标题里的产品名、公司名、人名、模型名照原样保留，不要音译：「Claude Code」「a16z」「Zuckerberg」「DiG-bench」。中英文之间照样加空格。不要加书名号、引号或句末标点。

如果原标题本身就是中文（比如「科技爱好者周刊（第 408 期）」），"zh_title" 就原样返回它，不要改写。

## 三、正文怎么写

写得像中文，不像译文 —— 这条比信息量重要，也是最容易失守的一条。

一句话只走一条逻辑线。分句可以多，但方向要一致 —— 顺着往下推（再、然后、于是、就、这样一来）可以拉长；把转折、因果、并列、类比混在同一句里，就必须断开。

反例，五个独立命题钉在一起，四种逻辑关系（但／主要因为／且／如同）挤在一句：「Town CEO 认为 AI 代理将取代传统软件，但当前仅能消除知识工作者 10-20% 的琐事，主要因为大多数人不了解 AI 能力，且习惯改变缓慢，如同 iPhone 普及耗时十年。」读的时候要同时挂着五个开口，那是论文摘要。拆开写：「Town 的 CEO 认为，AI 代理会取代现在的软件。但眼下它只能替知识工作者省掉 10-20% 的杂事。为什么这么慢？因为多数人根本不知道 AI 能做什么，习惯改起来也慢。当年 iPhone 也用了十年才普及。」

正例，同样很长却读一遍就懂，因为从头到尾只有一条因果链：「如果对话的间隔特别久，下一次输入跟上一次之间超过了 10 分钟，缓存就被删除了，模型收到上一轮的提示词，就不得不重新计算，收取的费用就变成了 1 元。」**所以长句本身不是毛病，一句话里塞进几条逻辑线才是。**

字数只是提醒：句子过了 50 字就回头检查一遍，是不是掺进了第二条线。是就断开，不是就留着。

用口语的连接词：但是、不过、因为、所以、这样一来、问题在于、也就是说。不要用「综合权衡」「而非」「其中」「且」「基于」「使得」这类书面语。

多用动词，少堆名词。写「命中缓存一次只要 2 分钱，是没命中的五十分之一」，不写「缓存命中的输入价格为未命中价格的五十分之一」。

段落要短，但不要空。正常一段是 2~3 个短句、60~85 字。偶尔用一句话独占一段来强调转折可以，但不要每段都这样 —— 五个 25 字的段落加起来才 125 字，那是把内容砍掉了，不是把它排开了。

可以设问再回答，可以说「你」和「我们」。「还有一项缓存命中价格，这是什么东西？」远好过「另需考虑缓存命中定价机制」。

中文与英文、数字之间加空格：「Token 的输入价格」「1.6 万行 Go 代码」「82% 的工程师」，不写「Token的输入价格」「1.6万行Go代码」「82%的工程师」。

术语第一次出现就地解释，四五个字说清：「paraxanthine（咖啡因在体内的代谢产物）」「WAL（数据库的预写日志）」。产品名、公司名、人名照原样写，那是名词不是术语。

WRITE FOR SOMEONE OUTSIDE THE FIELD. The reader is curious and widely read but is not a practitioner in this field. Explain practitioner terms (WAL, RAG, p99, cap rate) inline, as above.

你是在给读者写，不是在给编辑写。**永远不要提分数、分类，或者这是一份日报的一部分。**「分数低是因为它没有论点」这种话是内部判断，写进正文就露馅了；「本文归入 AI 类」同理。

## 四、收尾

最后一段固定是收尾，每篇都要有。写「这事意味着什么」：作者的判断最终落在哪里、读者该记住什么、接下来会怎样、或者该怎么做。前面几段是「发生了什么」，这一段是「所以呢」。

收尾**不是复述**。论点那句已经印在正文上方，读者刚看过，再说一遍等于白费一段。也不要用「总之」「综上所述」「总的来说」「这篇文章讨论了」开头 —— 那是清嗓子，不是结论。

好的收尾是具体的，能自己站住：
- 「所以最新的建议是改成每 4 分钟激活一次缓存。」
- 「所以这不算评测，只是一个用户在一个场景里的体验。」
- 「所以真正该问的不是模型能不能动手，而是它动手前会不会先看一眼。」

如果文章本身没有结论（链接汇总、发布公告），收尾就写清它为什么给不出结论：「每条链接都得自己点开，这篇本身不提供可带走的东西。」不要硬凑一个。

## 五、长度与取舍

LENGTH — each paragraph AT MOST ${PARA_MAX} characters. Not "about" — at most. A paragraph running long is the single commonest failure; SPLIT IT INTO TWO paragraphs rather than trimming words out of it.

The budget for the whole entry comes with the article, and it is a ceiling, not a target. Being well under it is fine and padding is worse than brevity. Never invent detail the article lacks.

KEEP THE SPECIFICS — numbers, named cases, mechanisms. "五步链条每步成功率 95%，走完只剩 77%" earns its place; "作者讨论了可靠性" does not.

BUT READABILITY OUTRANKS COVERAGE. When the budget is tight, drop a point — never compress two points into one long sentence. A reader finishes a summary that covers less ground; he skips the long sentence entirely.

## 六、英文

"en_thesis" and "en_paragraphs" are the English of the SAME summary you have just written: same claim, same evidence, same number of paragraphs, same order. Write it natively, not word-for-word, and never as a restatement of the headline — that already sits next to your text.

MATCH THE CHINESE RHYTHM, which is deliberately plain: short paragraphs, a question asked and then answered, and ONE LINE OF REASONING PER SENTENCE. A long sentence is fine when its clauses all push the same way ("if the gap is long enough the cache is dropped, so the model recomputes, so you pay a full yuan"); it is wrong when a reversal, a cause, an addition and an analogy are stapled together in one breath. Break those apart. Use the connectives speech uses — but, so, because, which means — not "moreover", "notably", "in terms of", "it should be noted that". Prefer verbs to nominalisations: write "a cache hit costs one fiftieth of a miss" rather than "the input price for a cache hit constitutes one fiftieth of the miss price". This is not telegraphic — the sentences still connect — it is simply unhurried.

The reader switches between the two languages rather than seeing them side by side, so the English must stand alone: someone who reads only this ends up knowing what the Chinese reader knows. Keep it as free of unexplained jargon as the Chinese; product, tool and company names stay as they are.

## 七、分类 "category"

Exactly one, from this list only, the most specific that fits. The catch-all is for what genuinely belongs nowhere else. Never invent a value outside the list.
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
 * Now that a request carries one article, that second entry describes a case
 * that never happens: measured against a one-entry example it cost ~73 input
 * tokens per request and one index mismatch in 12. **If BATCH_SIZE ever goes
 * back above 1, this example must show two entries again** — otherwise the
 * 5-of-6 failure returns.
 *
 * The wrapper stays an array even for one article: the appliers match replies
 * to articles by index, and the retry path re-asks for whatever is missing, so
 * the shape has to survive a batch of any size.
 */
const SUMMARY_EXAMPLE = `{
  "articles": [
    {
      "index": 0,
      "zh_title": "大模型的缓存命中价，能省五十倍的钱",
      "zh_thesis": "缓存命中价便宜五十倍，所以提示词的顺序值得专门设计。",
      "zh_paragraphs": [
        "大模型的收费分输入和输出两部分，这个好理解。但价目表上还有第三项，叫「输入缓存命中价」。很多人扫过去就跳过了，其实它是省钱的关键。",
        "以 DeepSeek V4 Flash 为例，命中缓存一次只要 2 分钱，没命中是 1 元。差了整整五十倍。",
        "为什么差这么多？模型要把提示词拆成 Token，再算它们两两之间的注意力，这一步最耗算力。命中缓存就不必重算了，收的其实只是存储费。",
        "但缓存有期限。DeepSeek 是 10 分钟，Anthropic 只有 5 分钟，OpenAI 在 10 到 30 分钟之间逐步失效。过期就得从头算，价格跳回 1 元。",
        "所以 AI 工具的保活请求不用发那么密。既然最短的缓存期限也有 5 分钟，每 4 分钟发一次就够了，以前那种每 30 秒一次纯属浪费。"
      ],
      "en_thesis": "A cache hit costs one fiftieth of a miss, so prompt order is worth designing.",
      "en_paragraphs": [
        "Model pricing splits into input and output, which is easy enough. But there is a third line on the price list, the input cache hit rate. Most people skim past it, and it is where the savings are.",
        "On DeepSeek V4 Flash a hit costs two cents where a miss costs a full yuan. That is a factor of fifty.",
        "Why the gap? The model has to split a prompt into tokens and compute attention between every pair of them, which is the expensive step. A hit skips it entirely, so what you pay for is storage.",
        "But caches expire. DeepSeek holds one for 10 minutes, Anthropic for 5, OpenAI decays between 10 and 30. Past that it recomputes and you are back to a yuan.",
        "So the keep-alive pinging can be far lazier than it usually is. The shortest cache anyone offers lasts five minutes, so once every four is enough, and the old habit of once every 30 seconds was pure waste."
      ],
      "category": "tech"
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
  index: number,
  budget?: ReturnType<typeof budgetFor>,
): string {
  const source = sourceOf(article.sourceId);
  return [
    `[${index}] ${article.title}`,
    `source: ${source.name}`,
    `published: ${article.publishedAt}`,
    // Says CHINESE explicitly: measured with both languages in one reply, 9 of
    // 10 summaries ran over, and an unqualified "最多 N 字" next to a request
    // for two languages reads as the budget for the pair.
    ...(budget
      ? [
          `budget: 中文正文最多 ${budget.chars} 字（英文不计入），` +
            `分 ${budget.paraLow}~${budget.paraHigh} 段，英文段数照中文走。` +
            `装不下就砍掉一整个点，不要把两个点压成一句。`,
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
function emptyVerdict(): Verdict {
  return {
    judged: false,
    score: 0,
    category: resolveCategory(undefined),
    titleZh: "",
    zh: { thesis: "", paragraphs: [] },
    en: { thesis: "", paragraphs: [] },
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
    // A row that carries no usable number is a gap, not a score of zero —
    // leaving `judged` false sends it down the "never judged" path instead of
    // the "rejected" one.
    const score = Number(row.score);
    if (!Number.isFinite(score)) continue;
    const verdict = out.get(article.id)!;
    verdict.judged = true;
    verdict.score = Math.max(0, Math.min(100, score));
  }
  if (rows.length !== group.length || unmatched) {
    console.warn(
      `[daily]   sent ${group.length}, model returned ${rows.length}, ` +
        `${unmatched} had an index outside the batch ` +
        `(indices: ${rows.map((r) => r.index).join(",")})`,
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
        paragraphs: asPoints(row.zh_paragraphs),
      };
    }

    const enThesis = asText(row.en_thesis);
    if (enThesis) {
      verdict.en = {
        thesis: enThesis,
        paragraphs: asPoints(row.en_paragraphs),
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
 * Two cases collapse to empty here rather than in the components, so the stored
 * digest carries the decision instead of every renderer repeating it:
 *
 * - The model echoed the original. Instructed to leave an already-Chinese
 *   headline alone, it also does that for English ones now and then, and a card
 *   showing the same string twice looks like a bug.
 * - The headline was Chinese to begin with, so the "translation" is the original
 *   and the page needs one line, not two.
 *
 * A model that ignores the field entirely also lands here, which is the point:
 * the Chinese title is an enhancement, and its absence has to be ordinary.
 */
function chineseTitle(value: unknown, original: string): string {
  const translated = asText(value);
  return translated && translated !== original.trim() ? translated : "";
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
    } else if (holder && typeof holder === "object" && "index" in holder) {
      // A bare article that escaped the wrapper.
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

function asPoints(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(String).filter((s) => s.trim().length > 0)
    : [];
}

/**
 * Returns a verdict per article, keyed by article id.
 *
 * TWO passes: score everything, drop what the floor rejects, then summarize
 * only what survived. A verdict therefore comes back in one of three states —
 * scored and summarized, scored and rejected (no summary, by design), or never
 * judged at all because the call failed. `Verdict.judged` is what tells the
 * last two apart, and the caller must respect it: a failure degrades to a bare
 * title so the digest still publishes, while a rejection is meant to vanish.
 */
export async function summarize(
  articles: RawArticle[],
): Promise<Map<string, Verdict>> {
  const out = new Map<string, Verdict>();
  if (articles.length === 0) return out;

  // Newest first — if the cap bites, we drop the stalest items.
  const batch = articles.slice(0, MAX_ARTICLES_PER_CALL);
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
            missing.map((a, j) => renderArticle(a, j)).join("\n\n---\n\n"),
          SCORE_EXAMPLE,
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
  // never spoke for are NOT dropped here — an outage must not empty the digest,
  // so they go on as bare titles, which is what `judged` distinguishes.
  const survivors = batch.filter((a) => {
    const verdict = out.get(a.id)!;
    return verdict.judged && verdict.score >= PUBLISH_MIN_SCORE;
  });
  const unjudged = batch.filter((a) => !out.get(a.id)!.judged).length;
  console.log(
    `[daily] scored ${batch.length - unjudged}/${batch.length}; ` +
      `${survivors.length} at or above the floor (${PUBLISH_MIN_SCORE}), ` +
      `${batch.length - unjudged - survivors.length} dropped unsummarized` +
      (unjudged ? `, ${unjudged} unscored and kept as bare titles` : ""),
  );
  if (survivors.length === 0) return out;

  // --- pass 2: both summaries, survivors only ---
  const summaryBatches = chunk(survivors, BATCH_SIZE);
  await mapLimited(summaryBatches, REQUEST_CONCURRENCY, async (group, i) => {
    const label = `${SUMMARY_PASS} ${i + 1}/${summaryBatches.length}`;

    for (let attempt = 0; attempt <= GAP_RETRIES; attempt += 1) {
      // Either half missing counts as a gap: a reply that stopped after the
      // Chinese is re-asked rather than published with an empty English side.
      const missing = group.filter((a) => {
        const verdict = out.get(a.id)!;
        return !verdict.zh.thesis || !verdict.en.thesis;
      });
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
  let en = 0;
  let thin = 0;
  let over = 0;
  const lengths: number[] = [];

  for (const article of survivors) {
    const verdict = out.get(article.id);
    if (!verdict?.zh.thesis) continue;
    zh += 1;
    if (verdict.en.thesis) en += 1;

    const chars =
      verdict.zh.thesis.length +
      (verdict.zh.paragraphs ?? []).reduce((sum, p) => sum + p.length, 0);
    lengths.push(chars);
    if (chars < ZH_MIN) thin += 1;
    // Against ITS OWN budget, not a shared number — that is the only ceiling
    // this article was ever given.
    if (chars > budgetFor(article.readingMinutes).chars) over += 1;
  }

  const total = survivors.length;
  const median =
    lengths.sort((a, b) => a - b)[Math.floor(lengths.length / 2)] ?? 0;
  console.log(
    `[daily] summaries — zh ${zh}/${total}, en ${en}/${total}, ` +
      `median ${median} chars, over their own budget: ${over}/${total}, ` +
      `under ${ZH_MIN}: ${thin}/${total}`,
  );
}
