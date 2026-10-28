// Entry for render.html — the bare page the exporter drives through Playwright.
// It rebuilds the scene from the same JSON the CLI used and paints frames on request;
// nothing runs on timers, so frame N is identical however fast the machine is.

import type { Scene } from "../core/experiment.ts";
import { getExperiment } from "../core/registry.ts";
import { buildScene } from "../core/scene.ts";
import { CAPTION_STYLE } from "../render/captionStyle.ts";
import { loadAssets } from "../assets/library.ts";
import { fontsReady, loadFonts } from "../render/fonts.ts";
import { captionLines, renderCaptionLayer, renderFrame } from "../render/frame.ts";

export interface RenderLoadArgs {
  story: unknown;
  config: unknown;
  seed?: number;
  batchRuns?: number;
  width: number;
  height: number;
  fps: number;
  /** Voice-cache key → clip duration; null for stories without narration audio. */
  clipDurations: Record<string, number> | null;
}

export interface RenderLoadResult {
  duration: number;
  frameCount: number;
  metrics: Record<string, Record<string, number>>;
  fontsReady: boolean;
  /** Captions that would need more than the allowed number of lines. */
  captionOverflow: string[];
  /** Illustration slots without a usable file (drawn as placeholders). */
  missingAssets: string[];
}

declare global {
  interface Window {
    __simlab: {
      load(args: RenderLoadArgs): Promise<RenderLoadResult>;
      renderFrame(index: number, captions: boolean): void;
      /** PNG data URL of a transparent frame containing only this caption. */
      renderCaption(text: string): string;
    };
  }
}

const canvas = document.getElementById("frame") as HTMLCanvasElement;
const ctx = canvas.getContext("2d", { alpha: false })!;
const layer = document.createElement("canvas");
const layerCtx = layer.getContext("2d")!;
let scene: Scene | null = null;
let fps = 30;

window.__simlab = {
  async load(args) {
    await loadFonts();
    const library = await loadAssets();
    const story = args.story as { experiment?: string };
    const durations = args.clipDurations;
    scene = buildScene(getExperiment(String(story.experiment)), args.config, args.story, {
      seed: args.seed,
      batchRuns: args.batchRuns,
      lookup: durations ? (clip) => durations[clip.key] ?? null : undefined,
    });
    canvas.width = layer.width = args.width;
    canvas.height = layer.height = args.height;
    fps = args.fps;
    return {
      duration: scene.timeline.duration,
      frameCount: Math.round(scene.timeline.duration * fps),
      metrics: scene.metrics,
      fontsReady: fontsReady(),
      missingAssets: library.missing,
      captionOverflow: scene.timeline.captions.map((caption) => caption.text).filter((text) => captionLines(ctx, text).length > CAPTION_STYLE.maxLines),
    };
  },
  renderFrame(index, captions) {
    if (!scene) throw new Error("render page: load() was not called");
    renderFrame(ctx, scene, index / fps, { captions });
  },
  renderCaption(text) {
    renderCaptionLayer(layerCtx, text);
    return layer.toDataURL("image/png");
  },
};
