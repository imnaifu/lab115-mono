// Renderer-facing names for the channel style tokens (src/style/channel.ts). Drawing code uses
// these roles; the actual values live in one place so the whole video and preview stay consistent.

import { fonts, meaning, palette, withAlpha } from "../style/channel.ts";

export const FONT_FAMILY = fonts.text;
export const DISPLAY_FAMILY = fonts.display;

export const theme = {
  background: meaning.background,
  panel: palette.paper,
  panelBorder: palette.line,
  surface: meaning.floor,
  text: palette.ink,
  textMuted: palette.inkMuted,
  textFaint: palette.inkMuted,
  /** Explanation layer: the one emphasis per frame. A fill only — text on it is ink. */
  accent: meaning.emphasis,
  onAccent: palette.ink,
  ink: palette.ink,
  /** Dims the scene behind title/poll cards. */
  overlay: withAlpha(palette.paper, 0.9),
  // Waiting colours for the overview dots: fresh (white) → long wait (pink → red), each with an ink outline.
  waitGood: palette.paper,
  waitMid: palette.fillPink,
  waitBad: palette.fav,
  transit: palette.ink,
  done: palette.paper,
};

/** Logical canvas height. Everything is laid out in a 1080-tall space and scaled to the output. */
export const LOGICAL_HEIGHT = 1080;

export type Weight = 400 | 500 | 600 | 700 | 800;

/** Text face (labels, captions). Noto Sans SC ships 400/500/700 here; 600/800 resolve to 700. */
export function font(size: number, weight: Weight = 400): string {
  return `${weight} ${size}px ${FONT_FAMILY}`;
}

/** Display face (titles, rule names, big numbers). Nunito 600/700/800. */
export function displayFont(size: number, weight: Weight = 700): string {
  return `${weight} ${size}px ${DISPLAY_FAMILY}`;
}
