// Plays generated narration clips in the preview, scheduled with Web Audio at their timeline
// positions. While it plays, the audio clock drives the video clock, so picture, captions and
// voice stay in step even if rendering drops frames.

import type { TimedClip } from "../core/story.ts";

const START_DELAY = 0.06;

export class NarrationPlayer {
  private context: AudioContext | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private sources: AudioBufferSourceNode[] = [];
  private startedAt = 0;
  private startVideoTime = 0;

  private audio(): AudioContext {
    this.context ??= new AudioContext();
    return this.context;
  }

  /** Fetch and decode clips not loaded yet. Returns how many are available. */
  async preload(clips: TimedClip[]): Promise<number> {
    await Promise.all(
      clips
        .filter((clip) => !clip.estimated && !this.buffers.has(clip.key))
        .map(async (clip) => {
          const response = await fetch(`/__simlab/voice/${clip.key}.wav`);
          if (!response.ok) return;
          this.buffers.set(clip.key, await this.audio().decodeAudioData(await response.arrayBuffer()));
        }),
    );
    return clips.filter((clip) => this.buffers.has(clip.key)).length;
  }

  start(videoTime: number, clips: TimedClip[]) {
    this.stop();
    const context = this.audio();
    void context.resume();
    this.startedAt = context.currentTime + START_DELAY;
    this.startVideoTime = videoTime;
    for (const clip of clips) {
      const buffer = this.buffers.get(clip.key);
      if (!buffer || clip.start + buffer.duration <= videoTime) continue;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      const offset = Math.max(0, videoTime - clip.start);
      source.start(this.startedAt + Math.max(0, clip.start - videoTime), offset);
      this.sources.push(source);
    }
  }

  /** Current video time according to the audio clock. */
  videoTime(): number {
    if (!this.context) return this.startVideoTime;
    return this.startVideoTime + Math.max(0, this.context.currentTime - this.startedAt);
  }

  stop() {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        // already stopped
      }
    }
    this.sources = [];
  }
}
