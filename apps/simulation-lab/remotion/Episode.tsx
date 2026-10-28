// The video composition. Layers:
//   scene   — the existing frame renderer draws the whole picture for frame N (simulation state at
//             the timeline's sim time, camera moves, cards, captions when burned in);
//   audio   — each narration clip placed at its timeline frame, plus the effects/music bed.
// Everything is a function of the frame number: Remotion can render any frame in any order.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, Audio, Sequence, cancelRender, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { renderFrame } from "../src/render/frame.ts";
import { meaning } from "../src/style/channel.ts";
import { type EpisodeProps, loadResources, sceneFor } from "./episode.ts";

/**
 * Narration clips are mono. Remotion upmixes them to stereo with FFmpeg (-ac 2), which puts a
 * mono source at -3 dB in each channel; the previous mix copied the voice to both channels at
 * full level. √2 restores that level exactly.
 */
const MONO_TO_STEREO = Math.SQRT2;

export const Episode: React.FC<EpisodeProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const scene = sceneFor(props);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Hold the render until fonts and illustrations are in: canvas text and images never load lazily.
  const [handle] = useState(() => delayRender("Loading fonts and illustrations"));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    loadResources().then(
      () => {
        setReady(true);
        continueRender(handle);
      },
      (error: Error) => cancelRender(error),
    );
  }, [handle]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!ready || !canvas) return;
    renderFrame(canvas.getContext("2d", { alpha: false })!, scene, frame / fps, { captions: props.captions });
  }, [ready, scene, frame, fps, width, height, props.captions]);

  return (
    <AbsoluteFill style={{ backgroundColor: meaning.background }}>
      <canvas ref={canvasRef} width={width} height={height} style={{ width: "100%", height: "100%" }} />
      {props.voiceDir &&
        scene.timeline.clips
          // Clips without audio yet keep their estimated slot silently (Studio only; the CLI refuses to render them).
          .filter((clip) => !clip.estimated)
          .map((clip) => (
            // Timeline clips start on whole frames, so audio lands exactly where the captions say.
            <Sequence key={clip.id} from={Math.round(clip.start * fps)} durationInFrames={Math.ceil(clip.duration * fps) + 1} layout="none" name={`voice ${clip.id}`}>
              <Audio src={staticFile(`${props.voiceDir}/${clip.key}.wav`)} volume={props.narrationGain * MONO_TO_STEREO} />
            </Sequence>
          ))}
      {props.bed && <Audio src={staticFile(props.bed)} name="effects" />}
    </AbsoluteFill>
  );
};
