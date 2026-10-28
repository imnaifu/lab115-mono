// Caption look, in one place. Used by the frame renderer (preview and burned-in export) and by
// the narration splitter's width estimate, so all three agree. Design component 10: plain ink
// text, no box or outline — the caption zone (y 860–1020) holds nothing else, so it stays clear.

import { palette, type } from "../style/channel.ts";

export const CAPTION_STYLE = {
  fontSize: type.caption,
  fontWeight: 500 as const,
  lineHeight: 64,
  /** Maximum text width in logical pixels (frame is 1080 tall). */
  maxWidth: 1520,
  /** Subtitle readability rule: at most this many characters per line (Latin text). */
  maxChars: 42,
  maxLines: 2,
  /** Vertical centre of a one-line caption, and of a two-line block. */
  centerOneLine: 918,
  centerTwoLines: 940,
  text: palette.ink,
};

// Kinsoku: characters that must not start a line, and ones that must not end one.
export const NO_LINE_START = new Set([..."，。！？、；：）」』”’》〉】,.!?;:)]}%"]);
export const NO_LINE_END = new Set([..."（「『“‘《〈【([{"]);
