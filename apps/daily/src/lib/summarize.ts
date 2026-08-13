import OpenAI from "openai";
import { CATEGORIES, resolveCategory } from "./categories";
import { DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, MODEL } from "./config";
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
const MAX_OUTPUT_TOKENS = 16_000;

/** Screenshot budget. Violations are logged, never silently truncated. */
const ZH_THESIS_LIMIT = 45;

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

const ZH_SYSTEM = `You are the editor of a daily reading digest for a curious, well-read generalist. They work in tech but read far beyond it — business, economics, history, design, science — and they are smart but NOT a specialist in any particular field you will encounter.

For each article, write in Chinese:
- a one-sentence thesis: what the piece actually ARGUES or REPORTS, not what topic it is about;
- 2-3 concrete takeaways — specific claims, numbers, tradeoffs. Never filler like "本文讨论了多个方面".

Each article is given to you with a number in brackets, like [3]. Return that number as "index" so the summary can be matched back.

WRITE FOR SOMEONE OUTSIDE THE FIELD. If a term only means something to practitioners (WAL, RAG, p99, cap rate, gain-of-function), either explain it in three or four words inline or find a plainer way to say it. Do not assume the reader has used the tool, read the prior article, or follows that industry. Keep product and company names as-is (Docker, Nvidia, Anthropic) — those are nouns, not jargon.

Prefer the part of the article a non-specialist would find interesting. For a deep technical post that is what it implies about how something works or fails, not the API surface.

Also file each article into exactly one section, using the "category" field. These are the ONLY allowed values, and the hard calls are the boundaries rather than the obvious cases:

${CATEGORIES.map((c) => `- "${c.id}" — ${c.hint}`).join("\n")}

Always choose the MOST SPECIFIC section that fits; the catch-all is for what genuinely belongs nowhere else. Never invent a value outside that list.

LENGTH IS A HARD REQUIREMENT, not a preference. The thesis must be at most ${ZH_THESIS_LIMIT} Chinese characters and each takeaway under 40. These are read as a screenshot on a phone; an overlong sentence breaks the layout. Cut adjectives and background before you cut facts.

Then score 0-100 in the "score" field. The first question is ARGUMENT OR ANNOUNCEMENT: does the piece reason toward a claim a reader could disagree with, or does it report that something happened? A firsthand account that draws conclusions counts as argument; a launch, a benchmark table, a version bump or a roundup of links is an announcement and belongs in the 30s or below, however important the event. Above that floor, score by how much a curious generalist gains. Be harsh and use the full range.

This digest is for reading OPINION AND ANALYSIS, not for keeping up with news. The test: if the whole piece can be restated as "X happened" or "Y was released" with nothing of substance lost, it is news — score it in the 30s or below and let something with an argument take the slot. Being newsworthy is not the same as being worth reading here. A well-argued essay outscores an expert write-up that only insiders can use, which outscores a competent report of real events, which outscores a rewritten press release.

FORMATTING RULE: never put a straight double-quote character inside any value. Use 「」 when you need to quote. A stray double-quote breaks the JSON.`;

const ZH_EXAMPLE =
  '{"articles":[{"index":0,"score":72,"category":"ai",' +
  '"zh_thesis":"一句话论点","zh_points":["要点一","要点二"]}]}';

// --- pass 2: English --------------------------------------------------------

const EN_PASS = "english";

const EN_SYSTEM = `You write the English half of a bilingual reading digest for a curious generalist — smart, widely read, not a specialist in the article's field.

For each entry you are given a number in brackets, the headline, and a Chinese summary. Return that number as "index". Produce the English version: the same information, written natively in English — NOT a word-for-word translation of the Chinese, and NOT a restatement of the headline. The headline is already displayed next to your text, so repeating it adds nothing.

Keep it free of unexplained jargon, the same way the Chinese is.

The two languages are displayed as PAIRS — every English line renders directly beneath the Chinese line it corresponds to. So return exactly as many takeaways as the Chinese entry lists, in the same order, one for one. Merging two Chinese points into one English sentence, or adding an extra, breaks the pairing.

Thesis under 25 words, each takeaway shorter. Keep product, tool and company names as-is.

FORMATTING RULE: never put a straight double-quote character inside any value. Use single quotes instead. A stray double-quote breaks the JSON.`;

const EN_EXAMPLE =
  '{"articles":[{"index":0,"en_thesis":"One sentence.",' +
  '"en_points":["Point one","Point two"]}]}';

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
    `zh_points: ${verdict.zh.points.join(" / ")}`,
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
    zh: { thesis: "", points: [] },
    en: { thesis: "", points: [] },
  };
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
    const parsed = JSON.parse(unfenced) as {
      articles?: Array<Record<string, unknown>>;
    };
    return parsed.articles ?? [];
  } catch (error) {
    logParseFailure(pass, unfenced, error as Error);
    throw error;
  }
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
    console.warn("[daily] DEEPSEEK_API_KEY unset — publishing without summaries");
    return out;
  }

  const client = new OpenAI({
    apiKey: DEEPSEEK_API_KEY,
    baseURL: DEEPSEEK_BASE_URL,
    maxRetries: 2,
    timeout: 180_000,
  });

  // --- pass 1: score + category + Chinese ---
  try {
    const rows = await callModel(
      client,
      ZH_PASS,
      ZH_SYSTEM,
      `Here are today's ${batch.length} articles. Summarize and score every ` +
        `one of them.\n\n` +
        batch.map(renderArticle).join("\n\n---\n\n"),
      ZH_EXAMPLE,
    );

    for (const row of rows) {
      const article = batch[Number(row.index)];
      if (!article) continue; // hallucinated index — ignore
      out.set(article.id, {
        score: Math.max(0, Math.min(100, Number(row.score) || 0)),
        category: resolveCategory(row.category),
        zh: {
          thesis: String(row.zh_thesis ?? "").trim(),
          points: asPoints(row.zh_points),
        },
        en: { thesis: "", points: [] },
      });
    }
  } catch (error) {
    console.error("[daily] Chinese pass failed, publishing bare titles:", error);
    return out;
  }

  // --- pass 2: English, from the Chinese (no bodies re-sent) ---
  const withZh = batch.filter((a) => out.get(a.id)?.zh.thesis);
  if (withZh.length === 0) return out;

  try {
    const rows = await callModel(
      client,
      EN_PASS,
      EN_SYSTEM,
      `Write the English half for all ${withZh.length} entries below.\n\n` +
        withZh
          .map((a, i) => renderForEnglish(a, out.get(a.id)!, i))
          .join("\n\n---\n\n"),
      EN_EXAMPLE,
    );

    for (const row of rows) {
      const article = withZh[Number(row.index)];
      if (!article) continue;
      const verdict = out.get(article.id)!;
      verdict.en = {
        thesis: String(row.en_thesis ?? "").trim(),
        points: asPoints(row.en_points),
      };
    }
  } catch (error) {
    // The Chinese half is already in hand — ship it rather than losing the day.
    console.error("[daily] English pass failed, publishing Chinese only:", error);
  }

  report(batch, out);
  return out;
}

/** Surface the things that would otherwise degrade silently: a missing half,
 *  and a thesis too long for the screenshot. */
function report(batch: RawArticle[], out: Map<string, Verdict>): void {
  let missingZh = 0;
  let missingEn = 0;
  let overLimit = 0;

  for (const article of batch) {
    const verdict = out.get(article.id);
    if (!verdict?.zh.thesis) missingZh += 1;
    if (!verdict?.en.thesis) missingEn += 1;
    if ((verdict?.zh.thesis.length ?? 0) > ZH_THESIS_LIMIT) overLimit += 1;
  }

  const total = batch.length;
  console.log(
    `[daily] summaries — zh ${total - missingZh}/${total}, ` +
      `en ${total - missingEn}/${total}, ` +
      `zh thesis over ${ZH_THESIS_LIMIT} chars: ${overLimit}/${total}`,
  );
}
