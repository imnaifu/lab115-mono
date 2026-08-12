import OpenAI from "openai";
import { DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, MODEL } from "./config";
import type { RawArticle } from "./fetcher";
import { sourceOf } from "./sources";
import type { SummaryText } from "./types";

/**
 * Summarizing + ranking via DeepSeek's OpenAI-compatible API.
 * Docs: https://api-docs.deepseek.com/ — tool calls follow the OpenAI shape,
 * so the stock `openai` SDK works with nothing but a different base URL.
 *
 * Everything goes into ONE call so the scores are mutually comparable —
 * ranking is the whole point, and per-article calls would each score in a
 * vacuum. deepseek-v4-flash has a 1M context and a 384K output ceiling, so
 * neither the prompt nor the reply is anywhere near a limit; the cap below is
 * a guard against a source suddenly firehosing, not a token constraint.
 */
const MAX_ARTICLES_PER_CALL = 30;
const MAX_OUTPUT_TOKENS = 16_000;

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
  zh: SummaryText;
  en: SummaryText;
}

const TOOL_NAME = "emit_digest";

const TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: TOOL_NAME,
    description: "Return the bilingual summary and score for every article.",
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
                  "0-100 information density: how much a technically " +
                  "literate reader gains from this piece. Original analysis, " +
                  "hard numbers and hands-on detail score high; press-release " +
                  "rewrites, listicles and speculation score low.",
              },
              zh_thesis: {
                type: "string",
                description: "One Chinese sentence: what the article argues.",
              },
              zh_points: {
                type: "array",
                items: { type: "string" },
                description: "2-3 concrete Chinese takeaways.",
              },
              en_thesis: {
                type: "string",
                description: "One English sentence: what the article argues.",
              },
              en_points: {
                type: "array",
                items: { type: "string" },
                description: "2-3 concrete English takeaways.",
              },
            },
            required: [
              "index",
              "score",
              "zh_thesis",
              "zh_points",
              "en_thesis",
              "en_points",
            ],
          },
        },
      },
      required: ["articles"],
    },
  },
};

const SYSTEM = `You are the editor of a daily reading digest for a senior software engineer.

For each article you receive, produce:
- a one-sentence thesis (what the piece actually ARGUES or REPORTS, not what topic it is about), and
- 2-3 concrete takeaways — specific claims, numbers, tool names, tradeoffs. Never write filler like "the article discusses various aspects".

Write both a Chinese and an English version. They must carry the same information, each written natively — the Chinese is not a word-for-word translation of the English. Keep product, tool and company names in their original form (Docker, Proxmox, Claude). Keep every sentence tight enough to read on a phone screenshot: thesis under 45 Chinese characters or 25 English words, each takeaway shorter still.

Then score information density 0-100. Be harsh and use the full range: a rare, carefully argued essay outscores a competent news write-up, which outscores a rewritten press release. Rank by what is worth a reader's time, not by topical popularity.

FORMATTING RULE: never put a straight double-quote character inside any value you return. When you need to quote something, use 「」 in Chinese and single quotes in English. A stray double-quote breaks the JSON and costs the whole day's summaries.`;

function renderArticle(article: RawArticle, index: number): string {
  const source = sourceOf(article.sourceId);
  return [
    `[${index}] ${article.title}`,
    `source: ${source.name}`,
    `url: ${article.url}`,
    `published: ${article.publishedAt}`,
    `body: ${article.body || "(body unavailable — judge from the title alone)"}`,
  ].join("\n");
}

/** A short, honest placeholder so a model failure degrades to a link list
 *  rather than taking the whole run down. */
function fallback(article: RawArticle): Verdict {
  return {
    score: 0,
    zh: { thesis: article.title, points: [] },
    en: { thesis: article.title, points: [] },
  };
}

/**
 * Pull the rows out of the reply. `tool_choice` should force a tool call, but
 * OpenAI-compatible providers vary in how strictly they honour it, so a plain
 * JSON reply in `content` is accepted too.
 */
function extractRows(
  message: OpenAI.Chat.Completions.ChatCompletionMessage,
): Array<Record<string, unknown>> {
  const call = message.tool_calls?.find(
    (c) => "function" in c && c.function.name === TOOL_NAME,
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
    // One unescaped quote in one summary used to cost the whole day's
    // summaries. Salvage what parses instead.
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
 *   …"en_points": ["…and training"], {"index": 1, "score": 58, …
 *                                  ↑ the `}` for element 0 never arrives
 *
 * Brace counting cannot recover from that: depth never returns to zero, so
 * every following element is swallowed into the first. Instead we split on the
 * one thing our own schema guarantees — every element opens with `"index"` —
 * and then repair each fragment independently.
 */
function salvageRows(raw: string): Array<Record<string, unknown>> {
  const arrayStart = raw.indexOf("[", raw.indexOf('"articles"'));
  if (arrayStart < 0) return [];

  const rows: Array<Record<string, unknown>> = [];

  // Lookahead split: keep the `{"index"` that starts each element.
  for (const fragment of raw.slice(arrayStart + 1).split(/(?=\{\s*"index"\s*:)/)) {
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
 * Returns a verdict per article, keyed by article id. On any API failure the
 * map comes back filled with fallbacks — the digest still publishes, just
 * without summaries.
 */
export async function summarize(
  articles: RawArticle[],
): Promise<Map<string, Verdict>> {
  const out = new Map<string, Verdict>();
  if (articles.length === 0) return out;

  // Newest first — if the cap bites, we drop the stalest items.
  const batch = articles.slice(0, MAX_ARTICLES_PER_CALL);
  for (const article of articles) out.set(article.id, fallback(article));

  if (!DEEPSEEK_API_KEY) {
    console.warn("[daily] DEEPSEEK_API_KEY unset — publishing without summaries");
    return out;
  }

  const client = new OpenAI({
    apiKey: DEEPSEEK_API_KEY,
    baseURL: DEEPSEEK_BASE_URL,
  });

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content:
        `Here are today's ${batch.length} articles. Summarize and score ` +
        `every one of them, and call ${TOOL_NAME} exactly once.\n\n` +
        batch.map(renderArticle).join("\n\n---\n\n"),
    },
  ];

  /**
   * Attempt 1 forces the tool call with thinking off. Attempt 2 drops both
   * knobs and lets the model answer however it likes — `extractRows` accepts a
   * plain JSON reply too. The fallback exists because provider-specific
   * restrictions around tool_choice have already bitten once, and a rejected
   * request means a whole day published with no summaries.
   */
  const attempts: DeepSeekParams[] = [
    {
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      messages,
      tools: [TOOL],
      tool_choice: { type: "function", function: { name: TOOL_NAME } },
      ...(isDeepSeek(DEEPSEEK_BASE_URL)
        ? { thinking: { type: "disabled" as const } }
        : {}),
    },
    {
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      messages,
      tools: [TOOL],
      tool_choice: "auto",
    },
  ];

  try {
    let response: OpenAI.Chat.Completions.ChatCompletion | undefined;

    for (const [index, params] of attempts.entries()) {
      try {
        response = await client.chat.completions.create(params);
        if (index > 0) console.warn("[daily] summarize used the fallback call");
        break;
      } catch (error) {
        const isLast = index === attempts.length - 1;
        if (isLast) throw error;
        console.warn(
          `[daily] summarize attempt ${index + 1} rejected, retrying without ` +
            `tool_choice/thinking: ${(error as Error).message}`,
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
        `[daily] reply hit max_tokens (${MAX_OUTPUT_TOKENS}) and is truncated`,
      );
    }

    for (const row of extractRows(message)) {
      const article = batch[Number(row.index)];
      if (!article) continue; // hallucinated index — ignore, keep the fallback
      out.set(article.id, {
        score: Math.max(0, Math.min(100, Number(row.score) || 0)),
        zh: {
          thesis: String(row.zh_thesis ?? article.title),
          points: (row.zh_points as string[] | undefined)?.map(String) ?? [],
        },
        en: {
          thesis: String(row.en_thesis ?? article.title),
          points: (row.en_points as string[] | undefined)?.map(String) ?? [],
        },
      });
    }
  } catch (error) {
    console.error("[daily] summarize failed, publishing bare titles:", error);
  }

  return out;
}
