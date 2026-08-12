import OpenAI from "openai";
import { CATEGORIES, resolveCategory } from "./categories";
import { DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, MODEL } from "./config";
import type { RawArticle } from "./fetcher";
import { sourceOf } from "./sources";
import type { SummaryText } from "./types";

/**
 * Summarizing + ranking via DeepSeek's OpenAI-compatible API.
 * Docs: https://api-docs.deepseek.com/ — tool calls follow the OpenAI shape,
 * so the stock `openai` SDK works with nothing but a different base URL.
 *
 * TWO calls, not one. Asking for score + Chinese + English in a single tool
 * call produced Chinese for 10/10 articles and English for 0/10: the model
 * filled the first four fields of each object and stopped. Splitting the work
 * makes each call small enough to complete, and the English pass needs no
 * article bodies at all — it rewrites from the Chinese summary, so it is
 * nearly free.
 */
const MAX_ARTICLES_PER_CALL = 30;
const MAX_OUTPUT_TOKENS = 16_000;

/** Screenshot budget. Violations are logged, never silently truncated. */
const ZH_THESIS_LIMIT = 45;

/**
 * DeepSeek's v4 models run in thinking mode by default (effort `high`), and
 * thinking mode rejects a `tool_choice` that names a specific function:
 *
 *   400 Thinking mode does not support this tool_choice
 *
 * We turn it off. This job extracts and scores — it does not need a chain of
 * thought — and thinking tokens bill as output, so leaving it on costs money
 * and latency for nothing. With it off, `tool_choice` can force the schema.
 *
 * The knob is DeepSeek-specific, so it is only sent to DeepSeek: pointing
 * DEEPSEEK_BASE_URL at any other OpenAI-compatible provider omits it.
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

// --- pass 1: score + Chinese -----------------------------------------------

const ZH_TOOL_NAME = "emit_chinese";

const ZH_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: ZH_TOOL_NAME,
    description: "Return the Chinese summary and score for EVERY article.",
    parameters: {
      type: "object",
      properties: {
        articles: {
          type: "array",
          items: {
            type: "object",
            properties: {
              index: {
                type: "integer",
                description: "The [n] index of the article being summarized.",
              },
              score: {
                type: "integer",
                description:
                  "0-100: how much a curious generalist gains from this " +
                  "piece. An idea that changes how they see something scores " +
                  "high, whatever the field. Version bumps, benchmark " +
                  "numbers, release notes and anything only a specialist in " +
                  "that one niche could care about score low, however " +
                  "technically impressive.",
              },
              category: {
                type: "string",
                // Generated from the registry, so adding a category in
                // categories.ts updates the model's options automatically.
                enum: CATEGORIES.map((c) => c.id),
                description:
                  "Which section this article belongs in. " +
                  CATEGORIES.map((c) => `"${c.id}" — ${c.hint}`).join(" "),
              },
              zh_thesis: {
                type: "string",
                description:
                  `One Chinese sentence stating what the article argues. ` +
                  `HARD LIMIT ${ZH_THESIS_LIMIT} Chinese characters — it has ` +
                  `to fit one or two lines of a phone screenshot.`,
              },
              zh_points: {
                type: "array",
                items: { type: "string" },
                description:
                  "2-3 concrete Chinese takeaways, each under 40 characters.",
              },
            },
            required: [
              "index",
              "score",
              "category",
              "zh_thesis",
              "zh_points",
            ],
          },
        },
      },
      required: ["articles"],
    },
  },
};

const ZH_SYSTEM = `You are the editor of a daily reading digest for a curious, well-read generalist. They work in tech but read far beyond it — business, economics, history, design, science — and they are smart but NOT a specialist in any particular field you will encounter.

For each article, write in Chinese:
- a one-sentence thesis: what the piece actually ARGUES or REPORTS, not what topic it is about;
- 2-3 concrete takeaways — specific claims, numbers, tradeoffs. Never filler like "本文讨论了多个方面".

WRITE FOR SOMEONE OUTSIDE THE FIELD. If a term only means something to practitioners (WAL, RAG, p99, cap rate, gain-of-function), either explain it in three or four words inline or find a plainer way to say it. Do not assume the reader has used the tool, read the prior article, or follows that industry. Keep product and company names as-is (Docker, Nvidia, Anthropic) — those are nouns, not jargon.

Prefer the part of the article a non-specialist would find interesting. For a deep technical post that is what it implies about how something works or fails, not the API surface.

Also file each article into exactly one section. The options and their boundaries are in the schema — read them, because the hard calls are the boundaries, not the obvious cases. Always choose the MOST SPECIFIC section that fits; the catch-all is for what genuinely belongs nowhere else.

LENGTH IS A HARD REQUIREMENT, not a preference. The thesis must be at most ${ZH_THESIS_LIMIT} Chinese characters and each takeaway under 40. These are read as a screenshot on a phone; an overlong sentence breaks the layout. Cut adjectives and background before you cut facts.

Then score 0-100 as described in the schema. Be harsh and use the full range. A well-argued essay that travels beyond its own field outscores an expert write-up that only insiders can use, which outscores a rewritten press release.

FORMATTING RULE: never put a straight double-quote character inside any value. Use 「」 when you need to quote. A stray double-quote breaks the JSON.`;

// --- pass 2: English --------------------------------------------------------

const EN_TOOL_NAME = "emit_english";

const EN_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: EN_TOOL_NAME,
    description: "Return the English summary for EVERY article listed.",
    parameters: {
      type: "object",
      properties: {
        articles: {
          type: "array",
          items: {
            type: "object",
            properties: {
              index: {
                type: "integer",
                description: "The [n] index of the article.",
              },
              en_thesis: {
                type: "string",
                description:
                  "One English sentence stating what the article argues. " +
                  "Under 25 words. Must NOT restate the headline.",
              },
              en_points: {
                type: "array",
                items: { type: "string" },
                description:
                  "The English takeaways. EXACTLY as many as the Chinese " +
                  "entry has, in the SAME ORDER — they are rendered as pairs, " +
                  "each English line sitting under the Chinese one it " +
                  "matches. Never merge, split, drop or reorder them.",
              },
            },
            required: ["index", "en_thesis", "en_points"],
          },
        },
      },
      required: ["articles"],
    },
  },
};

const EN_SYSTEM = `You write the English half of a bilingual reading digest for a curious generalist — smart, widely read, not a specialist in the article's field.

For each entry you are given the headline and a Chinese summary. Produce the English version: the same information, written natively in English — NOT a word-for-word translation of the Chinese, and NOT a restatement of the headline. The headline is already displayed next to your text, so repeating it adds nothing.

Keep it free of unexplained jargon, the same way the Chinese is.

The two languages are displayed as PAIRS — every English line renders directly beneath the Chinese line it corresponds to. So return exactly as many takeaways as the Chinese entry lists, in the same order, one for one. Merging two Chinese points into one English sentence, or adding an extra, breaks the pairing.

Thesis under 25 words, each takeaway shorter. Keep product, tool and company names as-is.

FORMATTING RULE: never put a straight double-quote character inside any value. Use single quotes instead. A stray double-quote breaks the JSON.`;

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
    // An unclassified article still needs a section to live in.
    category: resolveCategory(undefined),
    zh: { thesis: "", points: [] },
    en: { thesis: "", points: [] },
  };
}

/**
 * Pull the rows out of the reply. `tool_choice` should force a tool call, but
 * OpenAI-compatible providers vary in how strictly they honour it, so a plain
 * JSON reply in `content` is accepted too.
 */
function extractRows(
  message: OpenAI.Chat.Completions.ChatCompletionMessage,
  toolName: string,
): Array<Record<string, unknown>> {
  const call = message.tool_calls?.find(
    (c) => "function" in c && c.function.name === toolName,
  );

  const raw =
    call && "function" in call ? call.function.arguments : message.content;
  if (!raw) throw new Error("model returned neither a tool call nor content");

  // A content fallback may be fenced as ```json … ```.
  const unfenced = raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");

  try {
    const parsed = JSON.parse(unfenced) as {
      articles?: Array<Record<string, unknown>>;
    };
    return parsed.articles ?? [];
  } catch (error) {
    // One malformed element used to cost the whole day's summaries.
    logParseFailure(unfenced, error as Error);
    const rows = salvageRows(unfenced);
    if (rows.length === 0) throw error;
    console.warn(
      `[daily] salvaged ${rows.length} article(s) from the malformed reply`,
    );
    return rows;
  }
}

/** Print the exact neighbourhood of the syntax error — without it, a malformed
 *  reply is undiagnosable after the fact. */
function logParseFailure(raw: string, error: Error): void {
  const at = Number(/position (\d+)/.exec(error.message)?.[1] ?? NaN);
  const where = Number.isNaN(at)
    ? raw.slice(0, 300)
    : raw.slice(Math.max(0, at - 120), at + 120);
  console.error(
    `[daily] tool-call JSON is malformed (${error.message}); ` +
      `length=${raw.length}, around the error: …${where}…`,
  );
}

/**
 * Best-effort recovery from malformed JSON, so one botched element does not
 * cost the whole day's summaries.
 *
 * Observed failure (deepseek-v4-flash, tool-call arguments): an element's
 * closing brace is simply dropped —
 *
 *   …"zh_points": ["…"], {"index": 1, "score": 58, …
 *                       ↑ the `}` for element 0 never arrives
 *
 * Brace counting cannot recover from that: depth never returns to zero, so
 * every following element is swallowed into the first. Instead we split on the
 * one thing both schemas guarantee — every element opens with `"index"` — and
 * then repair each fragment independently.
 */
function salvageRows(raw: string): Array<Record<string, unknown>> {
  const arrayStart = raw.indexOf("[", raw.indexOf('"articles"'));
  if (arrayStart < 0) return [];

  const rows: Array<Record<string, unknown>> = [];

  // Lookahead split: keep the `{"index"` that starts each element.
  for (const fragment of raw
    .slice(arrayStart + 1)
    .split(/(?=\{\s*"index"\s*:)/)) {
    const repaired = repairElement(fragment);
    if (!repaired) continue;
    try {
      rows.push(JSON.parse(repaired));
    } catch {
      /* this one article is unrecoverable — keep the rest */
    }
  }

  return rows;
}

/**
 * Trim a fragment back to one JSON object, closing anything the model left
 * open. Unlike the splitter, this scan IS string-aware — it has to be, to know
 * whether a `}` is structure or just a character inside a summary.
 */
function repairElement(fragment: string): string | null {
  const text = fragment.trim();
  if (!text.startsWith("{")) return null;

  const open: string[] = [];
  let inString = false;
  let escaped = false;
  let end = text.length;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString) {
      if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') inString = true;
    else if (ch === "{") open.push("}");
    else if (ch === "[") open.push("]");
    else if (ch === "}" || ch === "]") {
      open.pop();
      // The element closed cleanly — drop the trailing comma and whatever
      // belongs to the array or the enclosing object.
      if (open.length === 0) {
        end = i + 1;
        break;
      }
    }
  }

  let out = text.slice(0, end);

  if (inString) {
    out += '"'; // also covers a reply cut off mid-sentence
  } else {
    // The fragment was cut at the next element, so it still carries the comma
    // that separated them — and `{"a": 1, }` is not valid JSON.
    out = out.replace(/[\s,]+$/, "");
  }

  while (open.length) out += open.pop();
  return out;
}

/**
 * One tool call, with a fallback attempt. The fallback exists because
 * provider-specific restrictions around `tool_choice` have already broken this
 * once, and a rejected request means a whole day published without summaries.
 */
async function callTool(
  client: OpenAI,
  tool: OpenAI.Chat.Completions.ChatCompletionTool,
  toolName: string,
  system: string,
  user: string,
): Promise<Array<Record<string, unknown>>> {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  const attempts: DeepSeekParams[] = [
    {
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      messages,
      tools: [tool],
      tool_choice: { type: "function", function: { name: toolName } },
      ...(isDeepSeek(DEEPSEEK_BASE_URL)
        ? { thinking: { type: "disabled" as const } }
        : {}),
    },
    {
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      messages,
      tools: [tool],
      tool_choice: "auto",
    },
  ];

  let response: OpenAI.Chat.Completions.ChatCompletion | undefined;

  for (const [index, params] of attempts.entries()) {
    try {
      response = await client.chat.completions.create(params);
      if (index > 0) console.warn(`[daily] ${toolName} used the fallback call`);
      break;
    } catch (error) {
      const status = (error as { status?: number }).status;
      // The fallback exists for ONE thing: the provider rejecting our
      // tool_choice/thinking combination, which is a 400. Anything else —
      // 429, 5xx, a network drop — is transient and already retried inside the
      // SDK, so re-sending different parameters just doubles the traffic.
      if (index === attempts.length - 1 || status !== 400) throw error;
      console.warn(
        `[daily] ${toolName} rejected the forced tool_choice, retrying ` +
          `without it: ${(error as Error).message}`,
      );
    }
  }

  const choice = response?.choices[0];
  const message = choice?.message;
  if (!message) throw new Error("model returned no choices");

  // `length` means the reply was cut off at max_tokens — that produces
  // malformed JSON too, and the fix is a bigger budget, not better parsing.
  if (choice?.finish_reason === "length") {
    console.warn(
      `[daily] ${toolName} hit max_tokens (${MAX_OUTPUT_TOKENS}) and is truncated`,
    );
  }

  return extractRows(message, toolName);
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
    // The SDK's own retries cover 429/5xx; ours (below) cover a 400 on
    // tool_choice. Bound both so a bad day cannot stall the cron run.
    maxRetries: 2,
    timeout: 180_000,
  });

  // --- pass 1: score + Chinese ---
  try {
    const rows = await callTool(
      client,
      ZH_TOOL,
      ZH_TOOL_NAME,
      ZH_SYSTEM,
      `Here are today's ${batch.length} articles. Summarize and score every ` +
        `one of them, and call ${ZH_TOOL_NAME} exactly once.\n\n` +
        batch.map(renderArticle).join("\n\n---\n\n"),
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
    const rows = await callTool(
      client,
      EN_TOOL,
      EN_TOOL_NAME,
      EN_SYSTEM,
      `Write the English half for all ${withZh.length} entries below, and ` +
        `call ${EN_TOOL_NAME} exactly once.\n\n` +
        withZh
          .map((a, i) => renderForEnglish(a, out.get(a.id)!, i))
          .join("\n\n---\n\n"),
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

/** Surface the two things that silently degraded before: a missing English
 *  half, and a thesis too long for the screenshot. */
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
