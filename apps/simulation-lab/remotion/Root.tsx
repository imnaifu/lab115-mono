// Compositions. "Episode" is what the CLI renders (it passes the story, config and clip durations
// as input props); the per-story entries are for browsing in Remotion Studio (npm run studio).

import { Composition } from "remotion";
import type { StorySpec } from "../src/core/story.ts";
import demoConfig from "../configs/queue-demo.json";
import sampleConfig from "../configs/queue-lane-sample.json";
import togetherConfig from "../configs/queue-together.json";
import demoStory from "../stories/queue-demo.json";
import sampleStory from "../stories/socost-sample.json";
import switchingStory from "../stories/queue-switching.json";
import { Episode } from "./Episode.tsx";
import { calculateEpisodeMetadata, type EpisodeProps } from "./episode.ts";

const STUDIO_STORIES: [StorySpec, unknown][] = [
  [demoStory as unknown as StorySpec, demoConfig],
  [sampleStory as unknown as StorySpec, sampleConfig],
  [switchingStory as unknown as StorySpec, togetherConfig],
];

function defaults(story: StorySpec, config: unknown): EpisodeProps {
  return {
    story,
    config,
    clipDurations: null,
    // remotion/public/cache → the project's cache/ (npm run studio links it and writes the manifest).
    voiceDir: "cache/voice",
    bed: null,
    narrationGain: 1,
    captions: true,
    width: story.video?.width ?? 1920,
    height: story.video?.height ?? 1080,
    fps: story.video?.fps ?? 30,
  };
}

export const Root: React.FC = () => (
  <>
    <Composition id="Episode" component={Episode} calculateMetadata={calculateEpisodeMetadata} defaultProps={defaults(...STUDIO_STORIES[0])} durationInFrames={1} fps={30} width={1920} height={1080} />
    {STUDIO_STORIES.map(([story, config]) => (
      <Composition
        key={story.name}
        id={story.name}
        component={Episode}
        calculateMetadata={calculateEpisodeMetadata}
        defaultProps={defaults(story, config)}
        durationInFrames={1}
        fps={30}
        width={1920}
        height={1080}
      />
    ))}
  </>
);
