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
const PARA_MAX = Math.round(ZH_MAX / 2.5);

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
- "paragraphs" — 2 or 3 paragraphs of flowing prose, each AT MOST ${PARA_MAX} characters. Together they carry the context, the evidence the claim rests on, and what follows if it holds.
- "category" and "score" — see below.

ONE ENTRY PER ARTICLE. Every article you are given gets its own object in "articles", carrying the index it was given. Never one object covering several, never a subset, and never an entry for an article you were not given.

PROSE, NOT BULLETS. Each paragraph is 3-5 sentences that connect — 具体来说, 原因是, 但, 结果是. Facts live inside sentences: write "OPT 扩展使本土高技能就业增长 0.5%、工资增长 1%，说明高技能移民并未挤出本地人", not "高技能移民促进本土就业。". Clipped standalone sentences read like a telegram.

KEEP THE SPECIFICS — numbers, named cases, mechanisms. "五步链式每步 95% 成功率，整体只剩 77%" earns its place; "作者讨论了可靠性" does not. Prose without evidence is merely vague.

LENGTH IS A HARD CEILING, and the constraint most often broken. Count before you return:
- each paragraph: AT MOST ${PARA_MAX} characters. Not "about" — at most. A paragraph running long is the single commonest failure; split it or cut it.
- the whole entry: AT MOST ${ZH_MAX}, thesis included. This is read on a phone; past that the reader stops.

Getting under it means CUTTING — throat-clearing, the restated headline, hedges, the second example once the first landed — not covering less ground; numbers are the last thing to drop. Being well under is fine: a short link post holds ~${ZH_MIN} characters of substance, and padding is worse than brevity. Never invent detail the article lacks.

WRITE FOR SOMEONE OUTSIDE THE FIELD. Explain practitioner terms (WAL, RAG, p99, cap rate) in three or four words inline. Product and company names stay as they are — those are nouns, not jargon.

CATEGORY — exactly one, from this list only, the most specific that fits. The catch-all is for what genuinely belongs nowhere else. Never invent a value outside the list.
${CATEGORIES.map((c) => `- "${c.id}" — ${c.hint}`).join("\n")}

SCORE 0-100. First question: argument or announcement? A piece reasoning toward a contestable claim beats one reporting that something happened. Launches, benchmark tables, version bumps and link roundups sit in the 30s or below however important the event — this digest is for opinion and analysis, not for keeping up. If the whole piece can be restated as "X happened" with nothing of substance lost, it is news — 30s or below. Above that floor, score by how much a generalist gains. Be harsh; use the full range.

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
      "zh_thesis": "这篇文章的一句话论点。",
      "zh_paragraphs": [
        "交代语境，并说明主张从何而来。",
        "具体证据，数字和案例写在句子里，句与句之间有承接。"
      ]
    }
  ]
}`;

// --- pass 2: English --------------------------------------------------------

const EN_PASS = "english";

const EN_SYSTEM = `You write the English half of a bilingual digest for a curious generalist — smart, widely read, not a specialist in the article's field.

Each entry gives you a number in brackets, the headline, and the finished Chinese summary. Return that number as "index" and the English of the SAME summary: same claim, same evidence, same number of paragraphs, same order. ONE ENTRY PER ARTICLE — every entry you are given gets its own object in "articles", carrying the index it was given, never fewer and never one you were not given.

Write it natively, in flowing paragraphs, never clipped standalone sentences. Not a word-for-word translation, and never a restatement of the headline, which already sits next to your text.

The reader switches between the two languages rather than seeing them side by side, so the English must stand alone: someone who reads only this ends up knowing what the Chinese reader knows. Keep it as free of unexplained jargon as the Chinese; product, tool and company names stay as they are.

FORMATTING: never put a straight double-quote inside a value — use single quotes. A stray quote breaks the JSON.`;

/** One entry, for the same reason as ZH_EXAMPLE — see the note there. */
const EN_EXAMPLE = `{
  "articles": [
    {
      "index": 0,
      "en_thesis": "One sentence.",
      "en_paragraphs": [
        "First paragraph of flowing prose.",
        "Second paragraph carrying the evidence."
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
