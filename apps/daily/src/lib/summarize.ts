import OpenAI from "openai";
import { CATEGORIES, resolveCategory } from "./categories";
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
 * TWO calls, not one. Asking for score + Chinese + English together produced
 * Chinese for 10/10 articles and English for 0/10: the model filled the first
 * four fields of each object and stopped. Splitting the work makes each reply
 * small enough to finish, and the English pass needs no article bodies at all
 * — it rewrites from the Chinese, so it is nearly free.
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
 * Bounds for one article's Chinese summary, from config.json — summary length
 * is an editorial call, not an operational one.
 *
 * A total budget alone did not hold: asked for "150-500 characters overall"
 * the model came back with a median of 508. Per-paragraph budgets in the
 * prompt below are what actually constrain it, and these two numbers just set
 * the frame.
 */
const ZH_MIN = USER_CONFIG.summaryMinChars;
const ZH_MAX = USER_CONFIG.summaryMaxChars;

/**
 * Ceiling on ONE paragraph. It used to be ZH_MAX / 2.5, and that derivation is
 * what made the prose unreadable: a 300-character budget divided into thirds
 * gave the model a 120-character paragraph, and it filled every one of them
 * with a single sentence carrying five clauses — a conference abstract, not
 * something a person reads on a phone.
 *
 * Now it moves independently, and DOWN while the total went up: 420 total but
 * 90 per paragraph, so the summary is 4-5 short paragraphs instead of 3 dense
 * ones. Short paragraphs are half of what makes the target voice work — the
 * model cannot pack five clauses into a paragraph it is only allowed 90
 * characters for, so the ceiling does the work the style instructions alone
 * could not.
 */
const PARA_MAX = USER_CONFIG.summaryParaMaxChars;

/**
 * DeepSeek's v4 models run in thinking mode by default, at effort `high`.
 * This job extracts and scores — it does not need a chain of thought — and
 * thinking tokens bill as output, so leaving it on costs money and latency for
 * nothing. The knob is DeepSeek-specific, so it is only sent to DeepSeek.
 * https://api-docs.deepseek.com/guides/thinking_mode/
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
  score: number;
  category: string;
  zh: SummaryText;
  en: SummaryText;
}

// --- pass 1: score + category + Chinese -------------------------------------

const ZH_PASS = "chinese";

const ZH_SYSTEM = `You edit a daily digest for a curious generalist: smart, widely read, not a specialist in whatever field the article belongs to.

YOUR SUMMARY REPLACES THE ARTICLE — they finish it and never open the original. Not "should I read this?" but "now I know this."

Return one entry per article, in Chinese, with these fields:
- "index" — the number the article was given in brackets, like [3].
- "thesis" — ONE sentence carrying the claim on its own; something a reader could disagree with.
- "paragraphs" — 3 to 5 SHORT paragraphs, each AT MOST ${PARA_MAX} characters. Together they carry the context, the evidence the claim rests on, and what follows if it holds.
- "category" and "score" — see below.

ONE ENTRY PER ARTICLE. Every article you are given gets its own object in "articles", carrying the index it was given. Never one object covering several, never a subset, and never an entry for an article you were not given.

写得像中文，不像译文 —— 这条比信息量重要，也是最容易失守的一条。

一句话只讲一个意思，每句不超过 35 字。最常见的失败是把四句话塞进一个五分句的长句：「Town CEO 认为 AI 代理将取代传统软件，但当前仅能消除知识工作者 10-20% 的琐事，主要因为大多数人不了解 AI 能力，且习惯改变缓慢，如同 iPhone 普及耗时十年。」那是论文摘要。应该写成：「Town 的 CEO 认为，AI 代理会取代现在的软件。但眼下它只能替知识工作者省掉 10-20% 的杂事。为什么这么慢？因为多数人根本不知道 AI 能做什么，习惯改起来也慢。当年 iPhone 也用了十年才普及。」

用口语的连接词：但是、不过、因为、所以、这样一来、问题在于、也就是说。不要用「具体来说」「值得注意的是」「综合权衡」「而非」「其中」「且」「基于」「使得」这类书面语。

多用动词，少堆名词。写「命中缓存一次只要 2 分钱，是没命中的五十分之一」，不写「缓存命中的输入价格为未命中价格的五十分之一」。

段落要短。一段只讲一件事，讲完就换段 —— 一句话独占一段完全可以，那正是手机上读得轻快的样子。

术语第一次出现就地解释，四五个字说清：「paraxanthine（咖啡因在体内的代谢产物）」「WAL（数据库的预写日志）」。产品名、公司名、人名照原样写，那是名词不是术语。

中文与英文、数字之间加空格：「Token 的输入价格」「1.6 万行 Go 代码」「82% 的工程师」，不写「Token的输入价格」「1.6万行Go代码」「82%的工程师」。

可以设问再回答，可以说「你」和「我们」。「还有一项缓存命中价格，这是什么东西？」远好过「另需考虑缓存命中定价机制」。

KEEP THE SPECIFICS — numbers, named cases, mechanisms. "五步链条每步成功率 95%，走完只剩 77%" earns its place; "作者讨论了可靠性" does not.

BUT READABILITY OUTRANKS COVERAGE. When the budget is tight, drop a point — never compress two points into one long sentence. A reader finishes a summary that covers less ground; he skips the long sentence entirely.

短句不等于少写，这两件事不要搞混。${ZH_MAX} 字的额度是给你用的：一篇有料的文章应该写到 300 字以上，只是拆成 4~5 段、每段几个短句，而不是塞进 3 个长句。真正要砍的是长句，不是内容。只有当文章本身没什么可说时（链接汇总、发布公告），才该短到 100 字上下。

LENGTH IS A HARD CEILING, and the constraint most often broken. Count before you return:
- each paragraph: AT MOST ${PARA_MAX} characters. Not "about" — at most. A paragraph running long is the single commonest failure; SPLIT IT INTO TWO paragraphs rather than trimming words out of it.
- the whole entry: AT MOST ${ZH_MAX}, thesis included. This is read on a phone; past that the reader stops.

Getting under it means CUTTING — throat-clearing, the restated headline, hedges, the second example once the first landed, and if it comes to it a whole point. Being well under is fine: a short link post holds ~${ZH_MIN} characters of substance, and padding is worse than brevity. Never invent detail the article lacks.

WRITE FOR SOMEONE OUTSIDE THE FIELD. The reader is curious and widely read but is not a practitioner in this field. Explain practitioner terms (WAL, RAG, p99, cap rate) inline, as above.

CATEGORY — exactly one, from this list only, the most specific that fits. The catch-all is for what genuinely belongs nowhere else. Never invent a value outside the list.
${CATEGORIES.map((c) => `- "${c.id}" — ${c.hint}`).join("\n")}

SCORE 0-100. First question: argument or announcement? A piece reasoning toward a contestable claim beats one reporting that something happened. Launches, benchmark tables, version bumps and link roundups sit in the 30s or below however important the event — this digest is for opinion and analysis, not for keeping up. If the whole piece can be restated as "X happened" with nothing of substance lost, it is news — 30s or below. A model, chip or product release is an announcement even when the thing released matters enormously: 20s.

Second question: does a NON-SPECIALIST come away with anything? The reader is curious and widely read, but is not a practitioner in this field and never will be. A tour of one library's internals, one chip's fabrication step, one browser's decoder quirk, one framework's release notes, one conference talk's recap — written for people already inside — sits in the 20s UNLESS the mechanism it uncovers transfers to how the reader thinks about something else. "A 16-year-old bug in SQLite's WAL reset corrupted a production database" transfers: it is about how silent data corruption hides. "Here is how DRAM capacitors are etched" does not. Fascination inside the field is not the test; portability out of it is.

Above those floors, score by how much a generalist gains. Be harsh; use the full range.

FORMATTING: never put a straight double-quote inside a value — use 「」. A stray quote breaks the JSON.`;

/**
 * ONE entry, because BATCH_SIZE is 1. THESE TWO MUST CHANGE TOGETHER.
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
 * The wrapper stays an array even for one article: `applyChinese` matches
 * replies to articles by index, and the retry path re-asks for whatever is
 * missing, so the shape has to survive a batch of any size.
 */
const ZH_EXAMPLE = `{
  "articles": [
    {
      "index": 0,
      "score": 72,
      "category": "ai",
      "zh_thesis": "一句话说清这篇在主张什么，读者能对它点头或摇头。",
      "zh_paragraphs": [
        "先交代背景。一句话一个意思，不要往里塞。",
        "但是这里有个转折。命中缓存一次只要 2 分钱，是没命中的五十分之一。",
        "为什么差这么多？因为命中缓存几乎不耗算力，收的其实是存储费。",
        "所以，值得专门安排提示词的顺序，把不变的那部分放在最前面。"
      ]
    }
  ]
}`;

// --- pass 2: English --------------------------------------------------------

const EN_PASS = "english";

const EN_SYSTEM = `You write the English half of a bilingual digest for a curious generalist — smart, widely read, not a specialist in the article's field.

Each entry gives you a number in brackets, the headline, and the finished Chinese summary. Return that number as "index" and the English of the SAME summary: same claim, same evidence, same number of paragraphs, same order. ONE ENTRY PER ARTICLE — every entry you are given gets its own object in "articles", carrying the index it was given, never fewer and never one you were not given.

Write it natively, not word-for-word, and never as a restatement of the headline — that already sits next to your text.

MATCH THE CHINESE RHYTHM, which is deliberately plain: one idea per sentence, short sentences, short paragraphs, a question asked and then answered. Use the connectives speech uses — but, so, because, which means — not "moreover", "notably", "in terms of", "it should be noted that". Prefer verbs to nominalisations: write "a cache hit costs one fiftieth of a miss" rather than "the input price for a cache hit constitutes one fiftieth of the miss price". This is not telegraphic — the sentences still connect — it is simply unhurried.

The reader switches between the two languages rather than seeing them side by side, so the English must stand alone: someone who reads only this ends up knowing what the Chinese reader knows. Keep it as free of unexplained jargon as the Chinese; product, tool and company names stay as they are.

FORMATTING: never put a straight double-quote inside a value — use single quotes. A stray quote breaks the JSON.`;

/** One entry, for the same reason as ZH_EXAMPLE — see the note there. */
const EN_EXAMPLE = `{
  "articles": [
    {
      "index": 0,
      "en_thesis": "One sentence stating the claim.",
      "en_paragraphs": [
        "The setting, in a sentence or two. One idea at a time.",
        "But here is the turn. A cache hit costs one fiftieth of a miss.",
        "Why the gap? A hit barely touches the GPU, so you are paying for storage.",
        "So it is worth ordering a prompt to put the unchanging part first."
      ]
    }
  ]
}`;

// --- shared plumbing --------------------------------------------------------

function renderArticle(article: RawArticle, index: number): string {
  const source = sourceOf(article.sourceId);
  return [
    `[${index}] ${article.title}`,
    `source: ${source.name}`,
    `published: ${article.publishedAt}`,
    `body: ${article.body || "(body unavailable — judge from the title alone)"}`,
  ].join("\n");
}

/** Pass 2's input: no bodies, just what pass 1 concluded. */
function renderForEnglish(
  article: RawArticle,
  verdict: Verdict,
  index: number,
): string {
  return [
    `[${index}] ${article.title}`,
    `zh_thesis: ${verdict.zh.thesis}`,
    ...(verdict.zh.paragraphs ?? []).map(
      (p, i) => `zh_paragraph_${i + 1}: ${p}`,
    ),
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
    score: 0,
    category: resolveCategory(undefined),
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
function applyChinese(
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
    const thesis = asText(row.zh_thesis);
    if (!thesis) continue; // an entry with no thesis is a gap, not a result
    out.set(article.id, {
      score: Math.max(0, Math.min(100, Number(row.score) || 0)),
      category: resolveCategory(row.category),
      zh: { thesis, paragraphs: asPoints(row.zh_paragraphs) },
      en: { thesis: "", paragraphs: [] },
    });
  }
  if (rows.length !== group.length || unmatched) {
    console.warn(
      `[daily]   sent ${group.length}, model returned ${rows.length}, ` +
        `${unmatched} had an index outside the batch ` +
        `(indices: ${rows.map((r) => r.index).join(",")})`,
    );
  }
}

function applyEnglish(
  rows: Array<Record<string, unknown>>,
  group: RawArticle[],
  out: Map<string, Verdict>,
): void {
  for (const row of rows) {
    const article = pick(group, row.index);
    if (!article) continue;
    const thesis = asText(row.en_thesis);
    if (!thesis) continue;
    out.get(article.id)!.en = {
      thesis,
      paragraphs: asPoints(row.en_paragraphs),
    };
  }
}

function asText(value: unknown): string {
  return String(value ?? "").trim();
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
 * Returns a verdict per article, keyed by article id. Any failure degrades to
 * an empty summary for the affected articles — the digest still publishes,
 * just with bare titles.
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

  // --- pass 1: score + category + Chinese, one article per request ---
  const batches = chunk(batch, BATCH_SIZE);
  let zhFailures = 0;

  // Retries live inside the worker so a stumble on one article never blocks
  // the others; the whole pass is bounded by REQUEST_CONCURRENCY.
  await mapLimited(batches, REQUEST_CONCURRENCY, async (group, i) => {
    const label = `${ZH_PASS} ${i + 1}/${batches.length}`;

    for (let attempt = 0; attempt <= GAP_RETRIES; attempt += 1) {
      // Covers both failure modes at once: a request that threw, and one that
      // returned valid JSON with entries silently missing.
      const missing = group.filter((a) => !out.get(a.id)?.zh.thesis);
      if (!missing.length) return;

      try {
        const rows = await callModel(
          client,
          attempt ? `${label} retry ${attempt}` : label,
          ZH_SYSTEM,
          `Here ${missing.length === 1 ? "is 1 article" : `are ${missing.length} articles`}. ` +
            `Summarize and score every one of them.\n\n` +
            missing.map(renderArticle).join("\n\n---\n\n"),
          ZH_EXAMPLE,
        );
        applyChinese(rows, missing, out);
      } catch (error) {
        if (attempt === GAP_RETRIES) {
          zhFailures += 1;
          console.error(
            `[daily] ${label} failed after ${attempt + 1} attempts ` +
              `(${group.length} article(s) keep bare titles): ` +
              `${(error as Error).message}`,
          );
        }
      }
    }
  });

  if (zhFailures === batches.length) return out;

  // --- pass 2: English, from the Chinese (no bodies re-sent) ---
  const withZh = batch.filter((a) => out.get(a.id)?.zh.thesis);
  if (withZh.length === 0) return out;

  const enBatches = chunk(withZh, BATCH_SIZE);
  await mapLimited(enBatches, REQUEST_CONCURRENCY, async (group, i) => {
    const label = `${EN_PASS} ${i + 1}/${enBatches.length}`;

    for (let attempt = 0; attempt <= GAP_RETRIES; attempt += 1) {
      const missing = group.filter((a) => !out.get(a.id)?.en.thesis);
      if (!missing.length) return;

      try {
        const rows = await callModel(
          client,
          attempt ? `${label} retry ${attempt}` : label,
          EN_SYSTEM,
          `Write the English version for ` +
            `${missing.length === 1 ? "this entry" : `these ${missing.length} entries`}.\n\n` +
            missing
              .map((a, j) => renderForEnglish(a, out.get(a.id)!, j))
              .join("\n\n---\n\n"),
          EN_EXAMPLE,
        );
        applyEnglish(rows, missing, out);
      } catch (error) {
        // The Chinese half is already in hand — ship it rather than losing it.
        if (attempt === GAP_RETRIES) {
          console.error(`[daily] ${label} failed: ${(error as Error).message}`);
        }
      }
    }
  });

  report(batch, out);
  return out;
}

/** Surface what would otherwise degrade silently: a missing half, and
 *  summaries that came back too thin to replace the article. */
function report(batch: RawArticle[], out: Map<string, Verdict>): void {
  let zh = 0;
  let en = 0;
  let thin = 0;
  let over = 0;
  const lengths: number[] = [];

  for (const article of batch) {
    const verdict = out.get(article.id);
    if (!verdict?.zh.thesis) continue;
    zh += 1;
    if (verdict.en.thesis) en += 1;

    const chars =
      verdict.zh.thesis.length +
      (verdict.zh.paragraphs ?? []).reduce((sum, p) => sum + p.length, 0);
    lengths.push(chars);
    if (chars < ZH_MIN) thin += 1;
    if (chars > ZH_MAX) over += 1;
  }

  const total = batch.length;
  const median =
    lengths.sort((a, b) => a - b)[Math.floor(lengths.length / 2)] ?? 0;
  console.log(
    `[daily] summaries — zh ${zh}/${total}, en ${en}/${total}, ` +
      `median ${median} chars, over ${ZH_MAX}: ${over}/${total}, ` +
      `under ${ZH_MIN}: ${thin}/${total}`,
  );
}
