// Props, scene cache and pre-render checks for the Remotion composition. The scene comes from the
// same pure modules as the preview and the CLI (simulation → scene → narration timeline); this
// file only adapts them to Remotion's props and metadata.

import type { CalculateMetadataFunction } from "remotion";
import { staticFile } from "remotion";
import type { Scene } from "../src/core/experiment.ts";
import { getExperiment } from "../src/core/registry.ts";
import { buildScene } from "../src/core/scene.ts";
import type { StorySpec } from "../src/core/story.ts";
import { loadAssets } from "../src/assets/library.ts";
import { CAPTION_STYLE } from "../src/render/captionStyle.ts";
import { fontsReady, loadFonts } from "../src/render/fonts.ts";
import { captionLines } from "../src/render/frame.ts";

export type EpisodeCheck = {
  metrics: Record<string, Record<string, number>>;
  duration: number;
  fontsReady: boolean;
  missingAssets: string[];
  /** Captions that would need more than the allowed number of lines. */
  captionOverflow: string[];
};

export type EpisodeProps = {
  story: StorySpec;
  /** Contents of the story's config file (its configOverrides are applied by buildScene). */
  config: unknown;
  seed?: number;
  batchRuns?: number;
  /** Voice-cache key → seconds. null: read `<voiceDir>/manifest.json` (Studio), else estimate. */
  clipDurations: Record<string, number> | null;
  /** Folder under remotion/public with the narration clips (`<key>.wav`); null = silent. */
  voiceDir: string | null;
  /** Effects/music bed (WAV under remotion/public) prepared by the CLI, if any. */
  bed: string | null;
  /** Gain on the narration clips (keeps narration + bed under full scale). */
  narrationGain: number;
  /** Burn captions into the frame. */
  captions: boolean;
  width: number;
  height: number;
  fps: number;
  /** Filled in by calculateMetadata: the browser's own view of the scene, checked by the CLI. */
  check?: EpisodeCheck;
};

/** URL prefix of remotion/public, for code that builds its own paths (the asset library). */
export function publicBase(): string {
  return staticFile("assets").slice(0, -"assets".length);
}

// Building a scene runs every simulation (and the batch); do it once per set of inputs.
let cached: { key: string; scene: Scene } | null = null;

export function sceneFor(props: EpisodeProps): Scene {
  const key = JSON.stringify([props.story, props.config, props.seed, props.batchRuns, props.clipDurations]);
  if (cached?.key !== key) {
    const durations = props.clipDurations;
    const scene = buildScene(getExperiment(String(props.story.experiment)), props.config, props.story, {
      seed: props.seed,
      batchRuns: props.batchRuns,
      lookup: durations ? (clip) => durations[clip.key] ?? null : undefined,
    });
    cached = { key, scene };
  }
  return cached.scene;
}

/** Fonts and illustrations, loaded once per page. */
export function loadResources() {
  return Promise.all([loadFonts(), loadAssets(publicBase())]).then(([, library]) => library);
}

/**
 * Duration and size from the story, plus the checks the CLI needs before rendering: the browser
 * rebuilds the scene independently, and its metrics must match Node's exactly.
 */
export const calculateEpisodeMetadata: CalculateMetadataFunction<EpisodeProps> = async ({ props }) => {
  let clipDurations = props.clipDurations;
  const narrated = (props.story.voice?.provider ?? "none") !== "none";
  if (clipDurations === null && narrated && props.voiceDir) {
    // Studio: use whatever clips are cached (npm run studio writes the manifest).
    const response = await fetch(staticFile(`${props.voiceDir}/manifest.json`)).catch(() => null);
    clipDurations = response?.ok ? ((await response.json()) as Record<string, number>) : null;
  }
  const library = await loadResources();
  const full: EpisodeProps = { ...props, clipDurations };
  const scene = sceneFor(full);
  const measure = document.createElement("canvas").getContext("2d")!;
  const check: EpisodeCheck = {
    metrics: scene.metrics,
    duration: scene.timeline.duration,
    fontsReady: fontsReady(),
    missingAssets: library.missing,
    captionOverflow: scene.timeline.captions.map((caption) => caption.text).filter((text) => captionLines(measure, text).length > CAPTION_STYLE.maxLines),
  };
  return {
    // The timeline ends on a whole frame, so this is exact.
    durationInFrames: Math.max(1, Math.round(scene.timeline.duration * props.fps)),
    fps: props.fps,
    width: props.width,
    height: props.height,
    props: { ...full, check },
  };
};
