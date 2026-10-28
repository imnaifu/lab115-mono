// The single frame renderer shared by the preview and the exporter: given a scene and a
// video time, paint the whole frame. No state carried between calls, so any frame can be
// rendered in any order.

import type { Rect, Scene } from "../core/experiment.ts";
import { formatClock } from "../core/format.ts";
import type { TimelineChapter } from "../core/story.ts";
import { CAPTION_STYLE } from "./captionStyle.ts";
import { clamp01, drawHighlighter, drawTabular, drawText, fillRoundRect, wrapText } from "./draw.ts";
import { frame, motion, palette, shape, withAlpha } from "../style/channel.ts";
import { displayFont, font, LOGICAL_HEIGHT, theme } from "./theme.ts";

const TOP_BAR = 96;
/** Space kept free for captions at the bottom: the caption zone and the bottom safe margin. */
export const CAPTION_AREA = LOGICAL_HEIGHT - frame.captionTop;
const MARGIN = 40;

export interface FrameOptions {
  /** Draw captions into the frame (preview). Export renders a clean frame and overlays captions separately. */
  captions?: boolean;
}

function logicalSize(canvas: HTMLCanvasElement) {
  // Lay out in a 1080-tall logical space; width follows the output's aspect ratio.
  const scale = canvas.height / LOGICAL_HEIGHT;
  return { scale, width: canvas.width / scale, height: LOGICAL_HEIGHT };
}

export function renderFrame(ctx: CanvasRenderingContext2D, scene: Scene, videoTime: number, options: FrameOptions = {}) {
  const { scale, width, height } = logicalSize(ctx.canvas);
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, width, height);

  const position = scene.timeline.at(videoTime);
  const { chapter, local, simTime, speed } = position;
  const kind = chapter.spec.kind;
  const fadeIn = clamp01(local / 0.45);
  const content: Rect = { x: MARGIN, y: TOP_BAR + 12, w: width - MARGIN * 2, h: height - TOP_BAR - 12 - CAPTION_AREA };

  // Full-frame illustrated shots carry their own composition: no dashboard-style top bar.
  if (kind === "sim" && chapter.spec.shot && scene.experiment.drawShot) {
    const nominal = chapter.playEnd > chapter.playStart ? (chapter.simTo - chapter.simFrom) / (chapter.playEnd - chapter.playStart) : 0;
    // On-screen numbers are sampled at most motion.numberRate times per second so they never flicker.
    const sampled = scene.timeline.at(Math.floor(videoTime * motion.numberRate) / motion.numberRate);
    const highlighted = scene.focus !== null && chapter.highlightFrom !== null && simTime >= chapter.highlightFrom;
    scene.experiment.drawShot(ctx, scene, chapter.spec.shot, simTime, { x: 0, y: 0, w: width, h: height }, {
      focus: highlighted ? scene.focus : null,
      dimOthers: highlighted && chapter.spec.dimOthers === true,
      showIds: scene.story.showIds === true,
      tweenSeconds: Math.max(4, speed * 0.2),
      // Walks are timed in video seconds; a frozen frame keeps the chapter's pace so poses don't jump.
      speed: speed > 0 ? speed : nominal,
      labelSimTime: sampled.chapter === chapter ? sampled.simTime : simTime,
      videoTime,
      chapterTime: local,
      clips: chapter.clips.map((clip) => ({ start: clip.localStart, duration: clip.duration, text: clip.caption })),
      callout: chapter.callout,
      localTimeOf: (moment) =>
        chapter.playEnd > chapter.playStart && chapter.simTo > chapter.simFrom
          ? chapter.playStart + ((Math.min(Math.max(moment, chapter.simFrom), chapter.simTo) - chapter.simFrom) / (chapter.simTo - chapter.simFrom)) * (chapter.playEnd - chapter.playStart)
          : 0,
    });
    if (options.captions !== false) {
      const caption = captionAt(scene, videoTime);
      if (caption) drawCaptionBox(ctx, caption, width, height);
    }
    ctx.restore();
    return;
  }

  drawTopBar(ctx, scene, width, simTime, speed, kind === "sim" || kind === "cards");

  if (kind === "chart") {
    const heading = chapter.heading ?? chapter.title;
    let chartRect = content;
    if (heading) {
      // Section heading as in the design system: centred, on the yellow highlighter.
      ctx.font = displayFont(48, 800);
      const headingWidth = ctx.measureText(heading).width;
      drawHighlighter(ctx, width / 2 - headingWidth / 2, content.y + 42, headingWidth, 48);
      drawText(ctx, heading, width / 2, content.y + 42, { size: 48, weight: 800, color: theme.text, align: "center", display: true });
      chartRect = { ...content, y: content.y + 70, h: content.h - 70 };
    }
    // Bars grow over at most ~5 s however long the narration is; reveal:false shows them settled.
    const reveal = chapter.spec.reveal === false ? 1 : clamp01(local / Math.min(5, chapter.end - chapter.start));
    scene.experiment.drawResults(ctx, scene, chartRect, reveal, { emphasis: chapter.spec.emphasis ?? [] });
  } else {
    drawPanels(ctx, scene, chapter, simTime, speed, content);
    if (kind === "title") drawTitleCard(ctx, chapter, width, height, fadeIn);
    if (kind === "cards") drawBulletCard(ctx, chapter, local, width, content, fadeIn);
    if (kind === "poll") drawPoll(ctx, scene, chapter, local, width, content, fadeIn);
    if (kind === "sim" && chapter.callout) drawCallout(ctx, chapter.callout, width / 2, content.y + content.h, fadeIn);
  }

  if (options.captions !== false) {
    const caption = captionAt(scene, videoTime);
    if (caption) drawCaptionBox(ctx, caption, width, height);
  }
  ctx.restore();
}

export function captionAt(scene: Scene, videoTime: number): string | null {
  return scene.timeline.captions.find((candidate) => videoTime >= candidate.start && videoTime < candidate.end)?.text ?? null;
}

/** Transparent frame with only a caption — the burned-in subtitle layer for export. */
export function renderCaptionLayer(ctx: CanvasRenderingContext2D, text: string) {
  const { scale, width, height } = logicalSize(ctx.canvas);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  drawCaptionBox(ctx, text, width, height);
  ctx.restore();
}

/**
 * Lines a caption wraps to with the real font — used to reject captions that need a third line.
 * Latin text: one line if it fits (width and ≤ maxChars), else the most balanced two-line split
 * (a long line over a stub reads badly), else a greedy wrap that shows how many lines it needs.
 * Chinese text keeps the width-based kinsoku wrap.
 */
export function captionLines(ctx: CanvasRenderingContext2D, text: string): string[] {
  const style = CAPTION_STYLE;
  if (/[\u3000-\u9fff\uff00-\uffef]/u.test(text)) return wrapText(ctx, text, style.maxWidth, style.fontSize, style.fontWeight);
  ctx.font = font(style.fontSize, style.fontWeight);
  const fits = (line: string) => line.length <= style.maxChars && ctx.measureText(line).width <= style.maxWidth;
  if (fits(text)) return [text];
  const words = text.split(" ");
  let best: string[] | null = null;
  let bestWidth = Infinity;
  for (let i = 1; i < words.length; i++) {
    const lines = [words.slice(0, i).join(" "), words.slice(i).join(" ")];
    const widest = Math.max(...lines.map((line) => ctx.measureText(line).width));
    if (lines.every(fits) && widest < bestWidth) {
      best = lines;
      bestWidth = widest;
    }
  }
  if (best) return best;
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (fits(candidate) || !current) current = candidate;
    else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);
  return lines;
}

function drawTopBar(ctx: CanvasRenderingContext2D, scene: Scene, width: number, simTime: number, speed: number, showClock: boolean) {
  drawText(ctx, scene.story.title, MARGIN, 58, { size: 32, weight: 700, color: theme.textMuted, display: true });
  if (!showClock) return;
  drawText(ctx, "simulated time", width - MARGIN, 82, { size: 17, weight: 500, color: theme.textFaint, align: "right" });
  drawTabular(ctx, formatClock(simTime), width - MARGIN, 58, { size: 40, weight: 700, color: theme.text, align: "right" });
  // Icons are drawn as shapes: ▶/❚❚ glyphs are missing from the bundled font and vary by system.
  const x = width - MARGIN - 250;
  if (speed > 0.01) {
    ctx.fillStyle = theme.text;
    ctx.beginPath();
    ctx.moveTo(x - 92, 38);
    ctx.lineTo(x - 72, 49);
    ctx.lineTo(x - 92, 60);
    ctx.closePath();
    ctx.fill();
    drawText(ctx, `×${speed >= 10 ? Math.round(speed) : speed.toFixed(1)}`, x - 64, 58, { size: 26, weight: 800, color: theme.text });
  } else {
    ctx.fillStyle = theme.textMuted;
    ctx.fillRect(x - 92, 38, 7, 22);
    ctx.fillRect(x - 80, 38, 7, 22);
    drawText(ctx, "paused", x - 64, 58, { size: 24, weight: 700, color: theme.textMuted });
  }
}

function drawPanels(ctx: CanvasRenderingContext2D, scene: Scene, chapter: TimelineChapter, simTime: number, speed: number, content: Rect) {
  const gap = 28;
  const count = chapter.compare.length;
  const panelWidth = (content.w - gap * (count - 1)) / count;
  // Highlight can start at a simulated moment (e.g. when the focus customer arrives).
  const highlighted = scene.focus !== null && chapter.highlightFrom !== null && simTime >= chapter.highlightFrom;
  chapter.compare.forEach((variantId, i) => {
    scene.experiment.drawPanel(ctx, scene, variantId, simTime, { x: content.x + i * (panelWidth + gap), y: content.y, w: panelWidth, h: content.h }, {
      focus: highlighted ? scene.focus : null,
      dimOthers: highlighted && chapter.spec.dimOthers === true,
      showIds: scene.story.showIds === true,
      // Moves animate over ~0.2 s of *video* time whatever the speed, never less than 4 sim seconds.
      tweenSeconds: Math.max(4, speed * 0.2),
    });
  });
}

function drawTitleCard(ctx: CanvasRenderingContext2D, chapter: TimelineChapter, width: number, height: number, alpha: number) {
  ctx.fillStyle = theme.overlay;
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = alpha;
  const lines = wrapText(ctx, chapter.title ?? "", width * 0.8, 96, 800, true);
  const top = height / 2 - (lines.length * 108) / 2 - 60;
  lines.forEach((line, i) => drawText(ctx, line, width / 2, top + i * 108 + 80, { size: 96, weight: 800, color: theme.text, align: "center", display: true }));
  if (chapter.subtitle) {
    const subLines = wrapText(ctx, chapter.subtitle, width * 0.72, 44, 600);
    subLines.forEach((line, i) => drawText(ctx, line, width / 2, top + lines.length * 108 + 70 + i * 56, { size: 44, weight: 600, color: theme.textMuted, align: "center" }));
  }
  ctx.globalAlpha = 1;
}

/** When bullet i appears: with narration clip i if there are enough clips, else spread evenly. */
function bulletRevealTimes(chapter: TimelineChapter, count: number): number[] {
  if (chapter.clips.length >= count) return chapter.clips.slice(0, count).map((clip) => clip.localStart);
  const window = (chapter.end - chapter.start) * 0.6;
  return Array.from({ length: count }, (_, i) => (count > 1 ? (window * i) / count : 0));
}

function drawBulletCard(ctx: CanvasRenderingContext2D, chapter: TimelineChapter, local: number, width: number, content: Rect, alpha: number) {
  const bullets = chapter.bullets;
  const cardWidth = Math.min(1400, width - 160);
  const bulletLines = bullets.map((bullet) => wrapText(ctx, bullet, cardWidth - 150, 40, 600));
  const bodyHeight = bulletLines.reduce((sum, lines) => sum + lines.length * 52 + 26, 0);
  const cardHeight = (chapter.heading ? 110 : 40) + bodyHeight + 30;
  const left = width / 2 - cardWidth / 2;
  const top = content.y + content.h / 2 - cardHeight / 2;
  const reveal = bulletRevealTimes(chapter, bullets.length);
  ctx.globalAlpha = alpha;
  fillRoundRect(ctx, left, top, cardWidth, cardHeight, shape.radiusLarge, palette.paper);
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = shape.stroke;
  ctx.beginPath();
  ctx.roundRect(left, top, cardWidth, cardHeight, shape.radiusLarge);
  ctx.stroke();
  let cursor = top + 40;
  if (chapter.heading) {
    drawText(ctx, chapter.heading, left + 60, cursor + 36, { size: 56, weight: 800, color: theme.text, display: true });
    cursor += 110;
  }
  bulletLines.forEach((lines, i) => {
    ctx.globalAlpha = alpha * clamp01((local - reveal[i]) / 0.35);
    ctx.beginPath();
    ctx.arc(left + 76, cursor + 24, 10, 0, Math.PI * 2);
    ctx.fillStyle = theme.accent;
    ctx.fill();
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 2;
    ctx.stroke();
    lines.forEach((line, j) => drawText(ctx, line, left + 108, cursor + 38 + j * 52, { size: 40, weight: 600, color: theme.text }));
    cursor += lines.length * 52 + 26;
  });
  ctx.globalAlpha = 1;
}

/** "Pause and guess": every rule as a big card, plus a countdown once the narration ends. */
function drawPoll(ctx: CanvasRenderingContext2D, scene: Scene, chapter: TimelineChapter, local: number, width: number, content: Rect, alpha: number) {
  // Nearly opaque: the big heading must not mix with panel text underneath.
  ctx.fillStyle = withAlpha(palette.paper, 0.96);
  ctx.fillRect(0, content.y - 12, width, content.h + 24);
  ctx.globalAlpha = alpha;
  drawText(ctx, chapter.heading ?? "Pause and guess", width / 2, content.y + 96, { size: 76, weight: 800, color: theme.text, align: "center", display: true });
  if (chapter.subtitle) drawText(ctx, chapter.subtitle, width / 2, content.y + 156, { size: 38, weight: 600, color: theme.textMuted, align: "center" });
  const variants = scene.experiment.variants;
  const cardWidth = Math.min(440, (width - 200) / variants.length - 30);
  const totalWidth = variants.length * cardWidth + (variants.length - 1) * 36;
  const top = content.y + 210;
  variants.forEach((variant, i) => {
    const left = width / 2 - totalWidth / 2 + i * (cardWidth + 36);
    // Rule cards: the rule's pastel with an ink outline; text stays ink.
    fillRoundRect(ctx, left, top, cardWidth, 230, shape.radiusLarge, variant.color);
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = shape.stroke;
    ctx.beginPath();
    ctx.roundRect(left, top, cardWidth, 230, shape.radiusLarge);
    ctx.stroke();
    drawText(ctx, variant.short, left + cardWidth / 2, top + 108, { size: 96, weight: 800, color: theme.text, align: "center", display: true });
    const name = variant.label.replace(/^\S+\s*·\s*/, "");
    wrapText(ctx, name, cardWidth - 40, 30, 600).forEach((line, j) =>
      drawText(ctx, line, left + cardWidth / 2, top + 160 + j * 36, { size: 30, weight: 600, color: theme.text, align: "center" }),
    );
  });
  const countdown = chapter.spec.countdown ?? 3;
  const elapsed = local - chapter.countdownStart;
  if (elapsed >= 0 && elapsed < countdown) {
    const remaining = countdown - elapsed;
    const centerY = top + 360;
    // A yellow disc (ink digits on it) with the remaining time as an ink arc around it.
    ctx.beginPath();
    ctx.arc(width / 2, centerY, 64, 0, Math.PI * 2);
    ctx.fillStyle = theme.accent;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(width / 2, centerY, 74, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (remaining / countdown));
    ctx.strokeStyle = theme.text;
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.stroke();
    drawText(ctx, String(Math.ceil(remaining)), width / 2, centerY + 2, { size: 72, weight: 800, color: theme.text, align: "center", baseline: "middle" });
  }
  ctx.globalAlpha = 1;
}

/** Banner centred near the bottom of the panels — the area least likely to hold queues. */
function drawCallout(ctx: CanvasRenderingContext2D, text: string, centerX: number, bottom: number, alpha: number) {
  ctx.globalAlpha = alpha;
  const lines = wrapText(ctx, text, 1100, 36, 800, true);
  ctx.font = displayFont(36, 800);
  const width = Math.max(...lines.map((line) => ctx.measureText(line).width)) + 64;
  const height = lines.length * 46 + 26;
  // Clear of the panels' legends along the bottom edge.
  const y = bottom - height - 56;
  fillRoundRect(ctx, centerX - width / 2, y, width, height, shape.radius, theme.accent);
  lines.forEach((line, i) => drawText(ctx, line, centerX, y + 46 + i * 46, { size: 36, weight: 800, color: theme.onAccent, align: "center", display: true }));
  ctx.globalAlpha = 1;
}

function drawCaptionBox(ctx: CanvasRenderingContext2D, text: string, width: number, height: number) {
  const style = CAPTION_STYLE;
  // Anything past two lines was rejected at load time; slicing is a last-resort guard.
  const lines = captionLines(ctx, text).slice(0, style.maxLines);
  const scale = height / LOGICAL_HEIGHT;
  const center = (lines.length === 1 ? style.centerOneLine : style.centerTwoLines) * scale;
  const top = center - (lines.length * style.lineHeight) / 2;
  lines.forEach((line, i) =>
    drawText(ctx, line, width / 2, top + i * style.lineHeight + style.lineHeight / 2, { size: style.fontSize, weight: style.fontWeight, color: style.text, align: "center", baseline: "middle" }),
  );
}
