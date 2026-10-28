// Narration text handling shared by Node (voice generation, export) and the browser (preview):
// sentence/clause splitting, spoken number formats, conditions, cache keys and duration estimates.
// Pure functions only — no DOM, no Node APIs.

import { CAPTION_STYLE } from "../render/captionStyle.ts";

export type Language = "en" | "zh";

/** A piece of story text that may be included only when a condition on the results holds. */
export type TextItem = string | { text: string; when?: string; unless?: string; caption?: string };

/**
 * Tiny condition language over numeric result values, e.g.
 * "right.medianWait < left.medianWait && right.p95Wait > left.p95Wait". Supports < <= > >= == !=,
 * && and ||, numbers and value names. Unknown names are an error so typos fail loudly.
 */
export function evaluateCondition(expression: string, values: Record<string, number>, where: string): boolean {
  const operand = (token: string): number => {
    if (/^-?\d+(\.\d+)?$/.test(token)) return Number(token);
    if (!(token in values)) throw new Error(`Unknown value "${token}" in condition "${expression}" (${where})`);
    return values[token];
  };
  return expression.split("||").some((alternative) =>
    alternative.split("&&").every((term) => {
      const match = term.trim().match(/^([\w.-]+)\s*(<=|>=|==|!=|<|>)\s*([\w.-]+)$/);
      if (!match) throw new Error(`Cannot parse condition "${term.trim()}" in "${expression}" (${where})`);
      const [, leftToken, operator, rightToken] = match;
      const left = operand(leftToken);
      const right = operand(rightToken);
      switch (operator) {
        case "<":
          return left < right;
        case "<=":
          return left <= right;
        case ">":
          return left > right;
        case ">=":
          return left >= right;
        case "==":
          return left === right;
        default:
          return left !== right;
      }
    }),
  );
}

export function conditionHolds(item: { when?: string; unless?: string }, values: Record<string, number>, where: string): boolean {
  if (item.when !== undefined && !evaluateCondition(item.when, values, where)) return false;
  if (item.unless !== undefined && evaluateCondition(item.unless, values, where)) return false;
  return true;
}

/** Keep the items whose conditions hold; returns plain objects for uniform handling. */
export function selectItems(items: TextItem | TextItem[] | undefined, values: Record<string, number>, where: string) {
  const list = items === undefined ? [] : Array.isArray(items) ? items : [items];
  return list
    .map((item) => (typeof item === "string" ? { text: item } : item))
    .filter((item) => conditionHolds(item, values, where));
}

/** Replace {{name}} placeholders; unknown names are an error so typos never reach a video. */
export function fillTemplate(text: string, vars: Record<string, string>, where: string): string {
  return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, name: string) => {
    if (!(name in vars)) throw new Error(`Unknown template variable {{${name}}} in ${where}`);
    return vars[name];
  });
}

/** 492 -> "8 minutes 12 seconds" / "8分12秒". Display text uses "8:12"; TTS reads that as "eight twelve". */
export function spokenDuration(seconds: number, language: Language): string {
  const total = Math.round(Math.max(0, seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (language === "zh") {
    const parts = [hours ? `${hours}小时` : "", minutes ? `${minutes}分` : "", secs || total === 0 ? `${secs}秒` : ""];
    return parts.join("");
  }
  const unit = (value: number, name: string) => `${value} ${name}${value === 1 ? "" : "s"}`;
  const parts = [hours ? unit(hours, "hour") : "", minutes ? unit(minutes, "minute") : "", secs || total === 0 ? unit(secs, "second") : ""].filter(Boolean);
  return parts.length > 1 ? `${parts.slice(0, -1).join(" ")} and ${parts[parts.length - 1]}` : parts[0];
}

const CJK = /[　-〿㐀-鿿豈-﫿＀-￯]/;

/**
 * Rough caption width in em, used to split long sentences *before* generating audio (so every
 * caption maps to exactly one audio clip). The browser re-checks with real font metrics.
 */
export function estimateWidthEm(text: string): number {
  let width = 0;
  for (const char of text) {
    if (CJK.test(char)) width += 1;
    else if (char === " ") width += 0.28;
    else if (/[A-Z0-9]/.test(char)) width += 0.66;
    else if (/[a-z]/.test(char)) width += 0.55;
    else width += 0.35;
  }
  return width;
}

/** Whether a caption is expected to fit in the configured number of lines (with a safety margin). */
export function fitsCaption(text: string): boolean {
  const perLine = CAPTION_STYLE.maxWidth / CAPTION_STYLE.fontSize;
  // Latin captions also keep to maxChars per line; word breaks need some slack.
  const latin = !/[\u3000-\u9fff\uff00-\uffef]/u.test(text);
  if (latin && text.length > CAPTION_STYLE.maxChars * CAPTION_STYLE.maxLines * 0.92) return false;
  return estimateWidthEm(text) <= perLine * CAPTION_STYLE.maxLines * 0.82;
}

/**
 * Split template source text into clips: sentences first, then clauses for sentences whose
 * *display* text would not fit two caption lines. Splitting the template source (not the filled
 * text) keeps caption and speech versions aligned clip for clip.
 */
export function splitIntoClips(source: string, display: (text: string) => string, where: string): string[] {
  const sentences = source
    .split(/(?<=[.!?…])\s+(?=\S)|(?<=[。！？])/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const clips: string[] = [];
  for (const sentence of sentences) {
    if (fitsCaption(display(sentence))) {
      clips.push(sentence);
      continue;
    }
    // Greedy: keep adding clauses while the caption still fits.
    const clauses = sentence.split(/(?<=[,;:，；：])\s*/u).filter(Boolean);
    let current = "";
    for (const clause of clauses) {
      const candidate = current ? `${current}${/[　-鿿]/u.test(clause[0]) ? "" : " "}${clause}` : clause;
      if (fitsCaption(display(candidate))) {
        current = candidate;
        continue;
      }
      if (current) clips.push(current);
      if (!fitsCaption(display(clause))) {
        throw new Error(`Narration in ${where} has a clause too long for two caption lines: "${display(clause)}". Split it with punctuation.`);
      }
      current = clause;
    }
    if (current) clips.push(current);
  }
  return clips;
}

/** Apply a pronunciation lexicon (whole-word, case-sensitive) to the speech text only. */
export function applyLexicon(text: string, lexicon: Record<string, string> | undefined): string {
  if (!lexicon) return text;
  let result = text;
  for (const [word, replacement] of Object.entries(lexicon)) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`(?<![\\w\\]/])${escaped}(?![\\w(])`, "g"), replacement);
  }
  return result;
}

/**
 * Stable 106-bit hash (two cyrb53 lanes) as hex. Pure JS so Node and the browser compute the
 * same voice-cache keys without async Web Crypto.
 */
export function hashKey(text: string): string {
  const lane = (seed: number) => {
    let h1 = 0xdeadbeef ^ seed;
    let h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ code, 2654435761);
      h2 = Math.imul(h2 ^ code, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
  };
  return `${lane(1)}${lane(2)}`;
}

/**
 * Reading-speed estimate used only when no audio exists (silent caption video, preview before
 * voice generation). Always flagged as estimated — never presented as synced audio.
 */
export function estimateSpeechSeconds(text: string, language: Language): number {
  if (language === "zh") {
    const characters = [...text].filter((char) => CJK.test(char)).length;
    return Math.max(1.2, characters / 4.5 + 0.3);
  }
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1.2, words / 2.6 + 0.3);
}
