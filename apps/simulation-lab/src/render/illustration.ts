// Illustration layer: draws characters and props from the asset library, or neutral placeholders
// when a file is missing (faceless ink outlines on paper-sunk, no style of their own — the real
// files bring the look). Assets are only transformed as a whole (position, scale, a horizontal
// flip for left-facing originals, opacity) — never cropped, recoloured or altered, faces
// included; discs, tags and badges are drawn outside the image.

import { assets, type LoadedAsset } from "../assets/library.ts";
import { meaning, motion, palette, shape, type } from "../style/channel.ts";
import { drawTabular, fillRoundRect, styleFont, tabularWidth } from "./draw.ts";

export type Facing = "left" | "right";

/** Placeholder figures are 150 × 260 in the design: width = height × this. */
const PLACEHOLDER_ASPECT = 150 / 260;

export interface CharacterOptions {
  /** Feet position (bottom centre) in logical pixels. */
  x: number;
  y: number;
  /** Rendered height of an adult character. */
  height: number;
  facing: Facing;
  /** Horizontal scale during a turn: 1 = facing as requested, passes through 0 when turning. */
  turn?: number;
  opacity?: number;
  asset: LoadedAsset | null;
}

/** Width a character will be drawn at (for discs and tags), without drawing it. */
export function characterWidth(asset: LoadedAsset | null, height: number): number {
  const scaled = height * (asset?.entry.heightScale ?? 1);
  return asset ? (asset.image.naturalWidth / asset.image.naturalHeight) * scaled : height * PLACEHOLDER_ASPECT;
}

export function drawCharacter(ctx: CanvasRenderingContext2D, options: CharacterOptions): { top: number; width: number } {
  const { x, y, asset } = options;
  const height = options.height * (asset?.entry.heightScale ?? 1);
  const nativeFacing: Facing = asset?.entry.facing ?? "right";
  // Only mirrored when the original faces the other way (allowed by the Soco-st terms).
  const mirror = (options.facing === nativeFacing ? 1 : -1) * (options.turn ?? 1);
  const width = characterWidth(asset, options.height);
  ctx.save();
  ctx.globalAlpha *= options.opacity ?? 1;
  ctx.translate(x, y);
  ctx.scale(mirror, 1);
  if (asset) ctx.drawImage(asset.image, -width / 2, -height, width, height);
  else drawPlaceholderPerson(ctx, width, height);
  ctx.restore();
  return { top: y - height, width };
}

function outline(ctx: CanvasRenderingContext2D, width: number = shape.stroke) {
  ctx.lineWidth = width;
  ctx.strokeStyle = palette.ink;
  ctx.lineJoin = "round";
  ctx.stroke();
}

/** Faceless stand-in for a missing character file: head circle over a rounded body. */
function drawPlaceholderPerson(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const head = width * 0.58;
  ctx.fillStyle = palette.paperSunk;
  ctx.beginPath();
  ctx.arc(0, -height + head / 2, head / 2, 0, Math.PI * 2);
  ctx.fill();
  outline(ctx);
  // The body overlaps the bottom of the head, as in the design's slot drawing.
  ctx.beginPath();
  ctx.roundRect(-width / 2, -height + width * 0.5, width, height - width * 0.5, [width * 0.46, width * 0.46, width * 0.2, width * 0.2]);
  ctx.fillStyle = palette.paperSunk;
  ctx.fill();
  outline(ctx);
}

export type FootDiscKind = "ground" | "focus" | "cooldown";

/**
 * Disc under a character, centred on the feet: `ground` puts everyone on the floor (instead of a
 * shadow), `focus` marks the followed customer (the frame's one brand mark), `cooldown` is a
 * dashed ring after switching lines (rule C). Draw it before the character.
 */
export function drawFootDisc(ctx: CanvasRenderingContext2D, x: number, baseline: number, figureWidth: number, kind: FootDiscKind = "ground", alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.beginPath();
  ctx.ellipse(x, baseline, (figureWidth * 1.36) / 2, (figureWidth * 0.28) / 2, 0, 0, Math.PI * 2);
  ctx.fillStyle = kind === "focus" ? meaning.emphasis : meaning.ground;
  ctx.fill();
  if (kind === "focus") outline(ctx, shape.strokeStrong);
  if (kind === "cooldown") {
    ctx.setLineDash([10, 8]);
    outline(ctx);
  }
  ctx.restore();
}

export interface PropOptions {
  /** Which file of the role to use (shelf-1 / shelf-2…). */
  index?: number;
  /** Placeholder width; real files keep their own aspect ratio. */
  width?: number;
  /** Text drawn on the prop in its own layer (e.g. the window number on a counter). */
  number?: string;
  numberSize?: number;
}

/** Props by role, from the library or as placeholders. Anchored at bottom centre. */
export function drawProp(ctx: CanvasRenderingContext2D, role: string, x: number, y: number, height: number, options: PropOptions = {}): { width: number } {
  const files = assets().roleAll(role);
  const asset = files.length > 0 ? files[(options.index ?? 0) % files.length] : null;
  const width = asset ? (asset.image.naturalWidth / asset.image.naturalHeight) * height : (options.width ?? height);
  ctx.save();
  ctx.translate(x, y);
  if (asset) ctx.drawImage(asset.image, -width / 2, -height, width, height);
  else drawPlaceholderProp(ctx, role, width, height);
  ctx.restore();
  if (options.number) {
    const size = options.numberSize ?? type.ruleName;
    drawTabular(ctx, options.number, x, y - height / 2 + size * 0.36, { size, weight: 800, color: palette.ink, align: "center", display: true });
  }
  return { width };
}

function drawPlaceholderProp(ctx: CanvasRenderingContext2D, role: string, width: number, height: number) {
  ctx.beginPath();
  switch (role) {
    case "checkout-counter":
      ctx.roundRect(-width / 2, -height, width, height, [shape.radius, shape.radius, 0, 0]);
      ctx.fillStyle = palette.paper;
      break;
    case "entrance":
      ctx.roundRect(-width / 2, -height, width, height, [shape.radiusLarge, shape.radiusLarge, 0, 0]);
      ctx.fillStyle = palette.paperSunk;
      break;
    case "decor":
      ctx.roundRect(-width / 2, -height, width, height, [shape.radiusLarge, shape.radiusLarge, shape.radiusSmall, shape.radiusSmall]);
      ctx.fillStyle = palette.paperSunk;
      break;
    default:
      // Shelves, baskets, carts: a plain well.
      ctx.roundRect(-width / 2, -height, width, height, shape.radiusSmall);
      ctx.fillStyle = palette.paperSunk;
  }
  ctx.fill();
  outline(ctx);
}

// Line icons from the design (24 × 24 grid, round caps), drawn as paths: the bundled Latin font
// subsets have no ✓ or ⌛ glyphs, and emoji are not allowed.
const ICONS = {
  hourglass: { path: "M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9", stroke: 2.6 },
  check: { path: "M4.5 12.5l5 5L19.5 7", stroke: 3 },
  clock: { path: "M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0M12 7v5l3 2", stroke: 2.6 },
} as const;
export type IconName = keyof typeof ICONS;

export function drawIcon(ctx: CanvasRenderingContext2D, name: IconName, left: number, top: number, size: number, alpha = 1) {
  if (alpha <= 0) return;
  const icon = ICONS[name];
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(left, top);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = icon.stroke;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke(new Path2D(icon.path));
  ctx.restore();
}

export interface HeadTagOptions {
  /** "#12" — full tags only. */
  id?: string;
  time: string;
  fill: string;
  /** Prefix icon; `iconMix` cross-fades from `fromIcon` (0) to `icon` (1). */
  icon: IconName | null;
  fromIcon?: IconName | null;
  iconMix?: number;
  compact?: boolean;
  alpha?: number;
  scale?: number;
}

/**
 * Head tag: a pill centred over the figure, its bottom 12 px (compact: 8) above the figure's top.
 * Full: 64 tall, 40 px, "#id  m:ss"; compact (wide shots): 50 tall, 34 px, time only.
 */
export function drawHeadTag(ctx: CanvasRenderingContext2D, centerX: number, figureTop: number, options: HeadTagOptions) {
  const compact = options.compact === true;
  const size = compact ? type.labelCompact : type.label;
  const height = compact ? 50 : 64;
  const padding = compact ? 12 : 22;
  const iconSize = compact ? 28 : 34;
  const gap = 10;
  const textStyle = { size, weight: 800 as const, display: true };
  const idWidth = options.id ? tabularWidth(ctx, options.id, textStyle) + gap : 0;
  const timeWidth = tabularWidth(ctx, options.time, textStyle);
  const mix = Math.min(1, Math.max(0, options.iconMix ?? 1));
  // The icon slot keeps its width while either icon is visible, so the text never jumps.
  const hasIcon = options.icon !== null || (options.fromIcon ?? null) !== null;
  const iconWidth = hasIcon ? iconSize + gap : 0;
  const width = padding * 2 + iconWidth + idWidth + timeWidth;
  const bottom = figureTop - (compact ? 8 : 12);
  ctx.save();
  ctx.globalAlpha *= options.alpha ?? 1;
  const scale = options.scale ?? 1;
  ctx.translate(centerX, bottom - height / 2);
  ctx.scale(scale, scale);
  fillRoundRect(ctx, -width / 2, -height / 2, width, height, height / 2, options.fill);
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = shape.stroke;
  ctx.stroke();
  let cursor = -width / 2 + padding;
  if (hasIcon) {
    if (options.fromIcon) drawIcon(ctx, options.fromIcon, cursor, -iconSize / 2, iconSize, 1 - mix);
    if (options.icon) drawIcon(ctx, options.icon, cursor, -iconSize / 2, iconSize, options.fromIcon === undefined ? 1 : mix);
    cursor += iconWidth;
  }
  // Nunito's cap height is ~0.7 em: this baseline centres digits in the pill.
  const baseline = size * 0.35;
  if (options.id) {
    drawTabular(ctx, options.id, cursor, baseline, { ...textStyle, color: palette.ink });
    cursor += idWidth;
  }
  drawTabular(ctx, options.time, cursor, baseline, { ...textStyle, color: palette.ink });
  ctx.restore();
}

/** Rule badge: the rule's pastel disc with its letter (diameter 96 / 64 / 48). */
export function drawRuleBadge(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, diameter: number, color: string, letter: string) {
  ctx.beginPath();
  ctx.arc(centerX, centerY, diameter / 2, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  outline(ctx, diameter >= 96 ? shape.strokeStrong : shape.stroke);
  const size = Math.max(type.minimum, Math.round(diameter * 0.62));
  ctx.font = styleFont({ size, weight: 800, display: true });
  ctx.fillStyle = palette.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(letter, centerX, centerY + size * 0.36);
}

/**
 * Outlined paper pill with optional leading icon: sim clock, "+n", chapter label (Nunito 800), or
 * an explanation callout (`display: false`: Noto Sans SC 500).
 */
export function drawPill(ctx: CanvasRenderingContext2D, x: number, top: number, text: string, options: { height: number; size: number; icon?: IconName; align?: "left" | "right" | "center"; alpha?: number; display?: boolean }) {
  const display = options.display !== false;
  const style = { size: options.size, weight: (display ? 800 : 500) as 800 | 500, display };
  const iconSize = Math.round(options.size * 0.9);
  const padding = Math.round(options.height * 0.38);
  const iconWidth = options.icon ? iconSize + 12 : 0;
  const width = padding * 2 + iconWidth + tabularWidth(ctx, text, style);
  const left = options.align === "right" ? x - width : options.align === "center" ? x - width / 2 : x;
  ctx.save();
  ctx.globalAlpha *= options.alpha ?? 1;
  fillRoundRect(ctx, left, top, width, options.height, options.height / 2, palette.paper);
  outline(ctx);
  if (options.icon) drawIcon(ctx, options.icon, left + padding, top + (options.height - iconSize) / 2, iconSize);
  drawTabular(ctx, text, left + padding + iconWidth, top + options.height / 2 + options.size * 0.35, { ...style, color: palette.ink });
  ctx.restore();
  return { width };
}

/** Appear: opacity and scale 0.92 → 1 with ease-out; `age` in video seconds since it should start. */
export function appearance(age: number): { alpha: number; scale: number } {
  const amount = Math.min(1, Math.max(0, age / motion.labelIn));
  const eased = 1 - (1 - amount) ** 2;
  return { alpha: amount, scale: motion.labelScaleFrom + (1 - motion.labelScaleFrom) * eased };
}
