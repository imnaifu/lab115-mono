// Small Canvas 2D helpers shared by the frame renderer and experiment presenters.

import { meaning, withAlpha } from "../style/channel.ts";
import { NO_LINE_END, NO_LINE_START } from "./captionStyle.ts";
import { displayFont, font } from "./theme.ts";

export { withAlpha };

export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
export const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;
export const easeInOut = (amount: number) => (amount < 0.5 ? 2 * amount * amount : 1 - (-2 * amount + 2) ** 2 / 2);

export interface Point {
  x: number;
  y: number;
}

export const lerpPoint = (from: Point, to: Point, amount: number): Point => ({ x: lerp(from.x, to.x, amount), y: lerp(from.y, to.y, amount) });

function hexToRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Blend two #rrggbb colours. */
export function mixColor(from: string, to: string, amount: number): string {
  const [r1, g1, b1] = hexToRgb(from);
  const [r2, g2, b2] = hexToRgb(to);
  const mix = (left: number, right: number) => Math.round(lerp(left, right, clamp01(amount)));
  return `rgb(${mix(r1, r2)}, ${mix(g1, g2)}, ${mix(b1, b2)})`;
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(radius, w / 2, h / 2));
}

export function fillRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number, fill: string) {
  roundRect(ctx, x, y, w, h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
}

export interface TextStyle {
  size: number;
  weight?: 400 | 500 | 600 | 700 | 800;
  /** Use the display face (titles, rule names, big numbers) instead of the text face. */
  display?: boolean;
  color: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
}

export function styleFont(style: Pick<TextStyle, "size" | "weight" | "display">): string {
  return style.display ? displayFont(style.size, style.weight ?? 700) : font(style.size, style.weight);
}

/**
 * The design system's heading highlighter: a rounded yellow stroke behind the lower half of a
 * line of text (SectionHeading). Draw it before the text; `left`/`width` span the text itself.
 */
export function drawHighlighter(ctx: CanvasRenderingContext2D, left: number, baseline: number, width: number, size: number, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  fillRoundRect(ctx, left - size * 0.35, baseline - size * 0.34, width + size * 0.7, size * 0.52, size, withAlpha(meaning.highlighter, 0.85));
  ctx.restore();
}

export function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, style: TextStyle) {
  ctx.font = styleFont(style);
  ctx.fillStyle = style.color;
  ctx.textAlign = style.align ?? "left";
  ctx.textBaseline = style.baseline ?? "alphabetic";
  ctx.fillText(text, x, y);
}

/**
 * Digits in the channel fonts are proportional, so a ticking clock would jitter. Draw each character in a
 * fixed-width cell instead (Canvas has no font-variant-numeric).
 */
function tabularWidths(ctx: CanvasRenderingContext2D, text: string, style: Pick<TextStyle, "size" | "weight" | "display">): number[] {
  ctx.font = styleFont(style);
  const cell = ctx.measureText("0").width;
  return [...text].map((char) => (/\d/.test(char) ? cell : ctx.measureText(char).width));
}

/** Width of `text` as drawTabular lays it out (wider than measureText for proportional digits). */
export function tabularWidth(ctx: CanvasRenderingContext2D, text: string, style: Pick<TextStyle, "size" | "weight" | "display">): number {
  return tabularWidths(ctx, text, style).reduce((sum, width) => sum + width, 0);
}

export function drawTabular(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, style: TextStyle) {
  const widths = tabularWidths(ctx, text, style);
  const total = widths.reduce((sum, width) => sum + width, 0);
  const align = style.align ?? "left";
  let cursor = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  [...text].forEach((char, i) => {
    drawText(ctx, char, cursor + widths[i] / 2, y, { ...style, align: "center" });
    cursor += widths[i];
  });
}

const CJK_CHAR = /[\u3000-\u303f\u3400-\u9fff\uf900-\ufaff\uff00-\uffef]/u;

/**
 * Line breaking for English and Chinese: breaks between words, or between any two CJK
 * characters, and applies kinsoku (no "，。！？" etc. at a line start, no opening brackets at a
 * line end). Lines may exceed maxWidth slightly when a punctuation mark is pulled back.
 */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, size: number, weight: TextStyle["weight"] = 400, display = false): string[] {
  ctx.font = display ? displayFont(size, weight) : font(size, weight);
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const tokens = paragraph.match(/[\u3000-\u303f\u3400-\u9fff\uf900-\ufaff\uff00-\uffef]|[^\s\u3000-\u303f\u3400-\u9fff\uf900-\ufaff\uff00-\uffef]+|\s+/gu) ?? [];
    let line = "";
    for (const token of tokens) {
      if (/^\s+$/.test(token)) {
        if (line) line += " ";
        continue;
      }
      const candidate = line + token;
      const forcedStay = NO_LINE_START.has(token[0]) && line.length > 0;
      if (ctx.measureText(candidate.trimEnd()).width <= maxWidth || !line.trim() || forcedStay) {
        line = candidate;
        continue;
      }
      let carry = token;
      // An opening bracket must not end a line: move it down with the next token.
      while (line.length > 0 && NO_LINE_END.has(line.trimEnd().slice(-1))) {
        const trimmed = line.trimEnd();
        carry = trimmed.slice(-1) + carry;
        line = trimmed.slice(0, -1);
      }
      lines.push(line.trimEnd());
      line = carry;
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

export function isCjk(char: string): boolean {
  return CJK_CHAR.test(char);
}
