import { paragraphsOf } from "./paragraphs";
import type { SummaryText } from "./types";

/**
 * Reading time. CJK has no spaces, so word-splitting alone would report ~0
 * minutes for a Chinese text — count CJK codepoints separately at 400/min and
 * everything else at 230 wpm.
 */
function rawMinutes(text: string): number {
  const cjk = (text.match(/[㐀-鿿豈-﫿]/g) ?? []).length;
  const words = text
    .replace(/[㐀-鿿豈-﫿]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return cjk / 400 + words / 230;
}

/** One text, rounded. Never zero: "0 分钟" reads as an error, not as "quick". */
export function readingMinutes(text: string): number {
  return Math.max(1, Math.round(rawMinutes(text)));
}

/**
 * Several texts, summed BEFORE rounding.
 *
 * The `max(1, round(…))` that keeps a single article honest is exactly what
 * breaks a sum of many, and it goes wrong in both directions. Measured on real
 * digests: 2026-08-11 has seven summaries of ~100 characters, so per-item
 * rounding reports 7 minutes against a true 1; 2026-08-14 has fifteen of ~465
 * characters, each just over a minute and each rounded down, reporting 15
 * against a true 17.
 */
export function totalReadingMinutes(texts: string[]): number {
  return Math.max(1, Math.round(texts.reduce((sum, t) => sum + rawMinutes(t), 0)));
}

/** Everything the reader actually sees for one article, in one language. */
export function summaryText(summary: SummaryText): string {
  return [summary.thesis, ...paragraphsOf(summary.text ?? "")]
    .filter(Boolean)
    .join(" ");
}
