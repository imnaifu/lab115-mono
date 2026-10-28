// Channel style: the single source of design parameters for every video frame and the preview
// page. Colours, font families, spacing and radii come from the Sokosoko design system
// (https://claude.ai/artifact/KPRSTffJfVbQawMQ8681A7): sokosoko.tokens.json is a verbatim copy of
// its tokens.json — replace that file to pick up a new version. This file only adds what video
// needs on top: 1080p sizes, motion, and what each colour means on screen.
//
// Direction (from the design system): white ground, one ink line plus flat pastel fills, one warm
// yellow that marks what matters, round shapes, flat surfaces (no resting shadows).

import tokens from "./sokosoko.tokens.json";

interface Token {
  name: string;
  value: string | Record<string, string>;
}

/** A token's value in the first (light) theme, following "{other-token}" aliases. */
function tokenValue(list: Token[], name: string, depth = 0): string {
  const token = list.find((candidate) => candidate.name === name);
  if (!token || depth > 8) throw new Error(`design system: no usable token "${name}"`);
  const value = typeof token.value === "string" ? token.value : Object.values(token.value)[0];
  const alias = /^\{(.+)\}$/.exec(value);
  return alias ? tokenValue(list, alias[1], depth + 1) : value;
}

const color = (name: string) => tokenValue(tokens.color.tokens, name);
const pixels = (list: Token[], name: string) => parseFloat(tokenValue(list, name));

export const palette = {
  /** Page and frame background — most of every frame is this white. */
  paper: color("paper"),
  /** Warm cream band: floors, alternating sections. */
  paperSoft: color("paper-soft"),
  /** Wells, tag fills, input fills. */
  paperSunk: color("paper-sunk"),
  /** Hairlines and dividers. */
  line: color("line"),
  /** Control borders (3.2:1 on paper). */
  lineStrong: color("line-strong"),
  /** All text and the one outline colour of illustrations. */
  ink: color("ink"),
  /** Secondary text. */
  inkMuted: color("ink-muted"),
  /** The one warm accent: a fill with ink on it — never text, never white on it. */
  brand: color("brand"),
  brandDeep: color("brand-deep"),
  brandSoft: color("brand-soft"),
  /** Links and focus rings. */
  link: color("link"),
  /** Icon-only red (hearts in the design system); not for text. */
  fav: color("fav"),
  /** Flat illustration fills. */
  fillSkin: color("fill-skin"),
  fillSky: color("fill-sky"),
  fillMint: color("fill-mint"),
  fillPink: color("fill-pink"),
  fillLilac: color("fill-lilac"),
} as const;

/**
 * What colours mean in a video. Text is always ink (or inkMuted); colour never carries meaning on
 * its own — positions, icons and labels say it too.
 */
export const meaning = {
  background: palette.paper,
  floor: palette.paperSoft,
  well: palette.paperSunk,
  /** Disc under every character's feet: puts them on the ground instead of a shadow. */
  ground: palette.paperSunk,
  /** The one thing to look at right now (focus disc, emphasised number) — at most one per frame. */
  emphasis: palette.brand,
  /** Heading highlighter, as the design system's SectionHeading. */
  highlighter: palette.brand,
  /** Head label while waiting. */
  waiting: palette.paper,
  /** Head label once a wait gets long (with an hourglass). Pink is used for nothing else. */
  waitLong: palette.fillPink,
} as const;

/** Clothes, goods and decor: the design system's flat illustration fills. */
export const supporting = [palette.fillSky, palette.fillMint, palette.fillPink, palette.brandSoft, palette.fillSkin] as const;

/**
 * Compared rules (A, B, C…): pastels of similar lightness, filled with an ink outline and always
 * labelled with the letter. Never brand-soft (reads as emphasis) or fill-pink (means "waited long").
 */
export const seriesColors = [palette.fillSky, palette.fillMint, palette.fillLilac, palette.fillSkin] as const;

export const fonts = {
  /** Headlines, big numbers, rule names: Nunito (rounded), CJK falls back to Noto Sans SC. */
  display: tokens.type.families.display,
  /** Captions, labels, UI: Noto Sans SC. */
  text: tokens.type.families.sans,
} as const;

/** Type scale in logical pixels (frame is 1080 tall). Checked at phone size (frame ≈ 390 px wide). */
export const type = {
  /** Episode title (Nunito 800). */
  title: 104,
  /** Chapter and section headings. */
  chapter: 56,
  /** Rule names next to their badge. */
  ruleName: 48,
  /** Lane header text ("Pick a line · window 2"). */
  shotHeader: 44,
  /** Key numbers on number cards: large / medium. */
  numberLarge: 96,
  number: 64,
  /** Head tags: full (close-up) and compact (wide shots). */
  label: 40,
  labelCompact: 34,
  /** Captions (Noto Sans SC 500). */
  caption: 46,
  /** Explanation callouts, sim clock, overflow counts. */
  callout: 36,
  /** Axis text and secondary lines (ink-muted). */
  small: 34,
  /**
   * Nothing in a video frame is smaller than this. A 1080p frame watched inline on a phone is
   * ~390 px wide (×0.2), so 34 px ≈ 7 px there; key numbers stay ≥ 44 px.
   */
  minimum: 34,
} as const;

/** Vertical bands of a 1080-tall frame. Nothing but captions enters the caption zone. */
export const frame = {
  /** Chapter label / shot header band. */
  headerTop: 60,
  contentTop: 136,
  contentBottom: 860,
  captionTop: 860,
  captionBottom: 1020,
} as const;

export const space = {
  /** Title-safe margins of a 1920×1080 frame. */
  safeX: 96,
  safeY: 60,
  gap: 24,
  gapLarge: 48,
} as const;

/** Video radii are the design system's web radii at 2× (a 1080p frame is viewed smaller than a page). */
const VIDEO_SCALE = 2;

export const shape = {
  radiusSmall: pixels(tokens.radius.tokens, "radius-sm") * VIDEO_SCALE,
  radius: pixels(tokens.radius.tokens, "radius-md") * VIDEO_SCALE,
  radiusLarge: pixels(tokens.radius.tokens, "radius-lg") * VIDEO_SCALE,
  /** One ink outline weight for drawn shapes, close to the illustrations' own line at video size. */
  stroke: 3,
  /** Emphasis outlines (focus disc, rule badges, vote options). */
  strokeStrong: 4,
} as const;

/** Motion rules shared by every scene. Times are in VIDEO seconds unless stated. */
export const motion = {
  /** Cruising pace per shot type, in logical px per video second (smaller figures walk slower on screen). */
  walkSpeed: { lane: 360, splitClose: 320, wide: 130, splitWide: 100 },
  minMove: 0.4,
  maxMove: 3.0,
  /** Time to get up to pace / to come to a stop (trapezoid speed profile, not a sprint-and-brake). */
  walkAccel: 0.3,
  /** Step bob while walking: amplitude = figure height × bobScale, one bump per step, 2 steps/s; zero when standing. */
  bobScale: 0.02,
  stepPeriod: 0.5,
  /** Turning around = quick horizontal flip (only used if someone walks left). */
  turn: 0.18,
  /** Queue advance: people behind start one after another, front first. */
  advanceStagger: 0.1,
  /** Labels and tags: appear (opacity + scale 0.92→1), disappear (opacity only). */
  labelIn: 0.2,
  labelOut: 0.2,
  labelScaleFrom: 0.92,
  /** Explanation callouts stay this long. */
  calloutMin: 1.5,
  calloutMax: 4,
  /** After a cut, no explanation labels for this long. */
  cutSettle: 0.3,
  /** Numbers on screen change at most this many times per second. */
  numberRate: 4,
  /**
   * The picture may trail the simulation by at most this many SIMULATED seconds. Slow playback
   * keeps the calm walking above; fast playback compresses walks into a time-lapse instead of
   * leaving people far behind what the simulation says (or still queuing after closing time).
   */
  maxLagSim: 45,
  /** Camera moves: never shorter than cameraMin (default length cameraMove), no new labels while moving. */
  cameraMin: 1.0,
  cameraMove: 1.2,
} as const;

/**
 * Walking progress (0..1) after `fraction` of a move lasting `seconds`: accelerate for
 * motion.walkAccel, cruise, decelerate. Peak speed is only ~1/(1−a) × average — unlike a cubic
 * ease, whose 3× peak reads as sprinting.
 */
export function walkProgress(fraction: number, seconds: number): number {
  const f = Math.min(1, Math.max(0, fraction));
  // Too short for a full start and stop: the trapezoid becomes a triangle (half speeding up, half slowing).
  const a = Math.min(0.5, motion.walkAccel / Math.max(seconds, 1e-6));
  const peak = 1 / (1 - a);
  if (f < a) return (peak * f * f) / (2 * a);
  if (f > 1 - a) return 1 - (peak * (1 - f) * (1 - f)) / (2 * a);
  return peak * (f - a / 2);
}

/** Current speed as a share of cruising speed (0 at start and stop, 1 while cruising). */
export function walkSpeedFraction(fraction: number, seconds: number): number {
  const f = Math.min(1, Math.max(0, fraction));
  const a = Math.min(0.5, motion.walkAccel / Math.max(seconds, 1e-6));
  if (f <= 0 || f >= 1) return 0;
  if (f < a) return f / a;
  if (f > 1 - a) return (1 - f) / a;
  return 1;
}

/** cubic ease-in-out: for camera moves and fades (not for walking). */
export function easeInOutCubic(amount: number): number {
  const t = Math.min(1, Math.max(0, amount));
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** A #rrggbb palette colour with transparency. */
export function withAlpha(hex: string, alpha: number): string {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

/**
 * The design system's tokens as CSS custom properties under their own names (--paper,
 * --space-4, --radius-pill, --font-sans…), so the preview page can use its component classes as-is.
 */
export function cssVariables(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const token of tokens.color.tokens) vars[`--${token.name}`] = color(token.name);
  for (const family of [tokens.spacing, tokens.radius, tokens.shadow]) {
    for (const token of family.tokens) vars[`--${token.name}`] = token.value;
  }
  vars["--font-display"] = fonts.display;
  vars["--font-sans"] = fonts.text;
  return vars;
}
