import { describe, expect, it } from "vitest";
import demoConfig from "../../configs/queue-demo.json";
import demoStory from "../../stories/queue-demo.json";
import { formatSrtTime } from "./format.ts";
import { getExperiment } from "./registry.ts";
import { Rng, rngStream } from "./rng.ts";
import { buildScene } from "./scene.ts";
import { placeCues, renderSfx } from "./sound.ts";
import { percentile } from "./stats.ts";
import { buildTimeline, type StorySpec, toSrt, toVtt } from "./story.ts";
import { audibleRange, decodeWav, encodeWav } from "./wav.ts";

describe("rng", () => {
  it("is deterministic and in [0, 1)", () => {
    const first = new Rng(123);
    const second = new Rng(123);
    for (let i = 0; i < 1000; i++) {
      const value = first.next();
      expect(value).toBe(second.next());
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
    expect(rngStream(1, "a").next()).not.toBe(rngStream(1, "b").next());
  });
});

describe("stats", () => {
  it("percentile interpolates between ranks", () => {
    expect(percentile([1, 2, 3, 4], 50)).toBe(2.5);
    expect(percentile([0, 10], 95)).toBeCloseTo(9.5, 9);
    expect(percentile([5], 95)).toBe(5);
  });
});

/** Minimal story for timeline tests: anchors/vars supplied directly, no experiment needed. */
function story(chapters: StorySpec["chapters"], extra: Partial<StorySpec> = {}): StorySpec {
  return { name: "t", experiment: "x", title: "T", seed: 1, compare: ["a"], voice: { provider: "kokoro", gap: 0.25 }, chapters, ...extra };
}
const inputs = { anchors: { start: 0, end: 1000, arrive: 400 }, vars: { wait: "8:12", n: "52" }, spokenVars: { wait: "8 minutes and 12 seconds" }, values: { big: 10, small: 1 } };

describe("timeline", () => {
  it("lays clips out from real audio durations, with pauses and gaps, never stretching audio", () => {
    const durations: Record<string, number> = {};
    const timeline = buildTimeline(story([{ id: "one", kind: "title", narration: "First sentence. Second one waited {{wait}}.", pauseBefore: 0.2, pauseAfter: 0.5 }]), {
      ...inputs,
      lookup: (clip) => (durations[clip.key] = clip.index === 0 ? 1.5 : 2.25),
    });
    const [first, second] = timeline.clips;
    expect(first).toMatchObject({ start: 0.2, end: 1.7, duration: 1.5, estimated: false, caption: "First sentence." });
    // 1.7 + 0.25 = 1.95 s, moved to the next whole frame at 30 fps (frame 59 = 1.9667 s).
    expect(second.start).toBeCloseTo(59 / 30, 9);
    expect(second.duration).toBe(2.25);
    expect(second.caption).toBe("Second one waited 8:12.");
    expect(second.speech).toBe("Second one waited 8 minutes and 12 seconds.");
    // The chapter also ends on a whole frame.
    expect(timeline.duration).toBeCloseTo(Math.ceil((second.end + 0.5) * 30 - 1e-6) / 30, 9);
    for (const clip of timeline.clips) expect(Math.abs(clip.start * 30 - Math.round(clip.start * 30))).toBeLessThan(1e-6);
    expect(timeline.estimated).toBe(false);
    // Captions start exactly with their clip.
    expect(timeline.captions.map((caption) => caption.start)).toEqual([first.start, second.start]);
  });

  it("flags estimated timing when audio is missing", () => {
    const timeline = buildTimeline(story([{ id: "one", kind: "title", narration: "No audio for this yet." }]), inputs);
    expect(timeline.estimated).toBe(true);
    expect(timeline.clips[0].estimated).toBe(true);
  });

  it("supports pausing the simulation while narrating, then playing at a speed", () => {
    const timeline = buildTimeline(
      story([{ id: "s", kind: "sim", narration: "Watch this.", pauseBefore: 0, pauseAfter: 0, sim: { from: 100, to: 300, play: "after", speed: 50 } }]),
      { ...inputs, lookup: () => 2 },
    );
    const chapter = timeline.chapters[0];
    expect(chapter.playStart).toBe(2);
    expect(chapter.playEnd).toBe(6);
    expect(timeline.at(1).simTime).toBe(100);
    expect(timeline.at(1).speed).toBe(0);
    expect(timeline.at(4).simTime).toBeCloseTo(200, 9);
    expect(timeline.at(4).speed).toBeCloseTo(50, 9);
    expect(timeline.videoTimeOf(chapter, 200)).toBeCloseTo(4, 9);
  });

  it("stretches the simulation, not the narration, across a chapter", () => {
    const timeline = buildTimeline(story([{ id: "s", kind: "sim", narration: "Short.", duration: 10, sim: { from: 0, to: 500 } }]), { ...inputs, lookup: () => 1 });
    expect(timeline.duration).toBe(10);
    expect(timeline.clips[0].duration).toBe(1);
    expect(timeline.at(5).simTime).toBeCloseTo(250, 9);
  });

  it("highlights from an anchor, adds poll countdowns and applies conditions", () => {
    const timeline = buildTimeline(
      story([
        { id: "p", kind: "poll", narration: "Guess.", countdown: 3, pauseBefore: 0, pauseAfter: 0 },
        { id: "h", kind: "sim", narration: [{ text: "Shown.", when: "big > small" }, { text: "Hidden.", unless: "big > small" }], highlight: { from: "arrive" } },
        { id: "skipped", kind: "title", narration: "Never.", when: "small > big" },
      ]),
      { ...inputs, lookup: () => 1 },
    );
    expect(timeline.chapters.map((chapter) => chapter.spec.id)).toEqual(["p", "h"]);
    expect(timeline.chapters[0].countdownStart).toBe(1);
    expect(timeline.chapters[0].end).toBe(4);
    expect(timeline.chapters[1].highlightFrom).toBe(400);
    expect(timeline.clips.map((clip) => clip.caption)).toEqual(["Guess.", "Shown."]);
  });

  it("changes a clip's cache key only when its own speech or the voice changes", () => {
    const base = buildTimeline(story([{ id: "c", kind: "title", narration: "Keep this. Change {{n}}." }]), inputs);
    const edited = buildTimeline(story([{ id: "c", kind: "title", narration: "Keep this. Change {{n}} now." }]), inputs);
    const otherVoice = buildTimeline(story([{ id: "c", kind: "title", narration: "Keep this. Change {{n}}." }], { voice: { provider: "kokoro", voice: "am_michael" } }), inputs);
    expect(edited.clips[0].key).toBe(base.clips[0].key);
    expect(edited.clips[1].key).not.toBe(base.clips[1].key);
    expect(otherVoice.clips[0].key).not.toBe(base.clips[0].key);
  });

  it("writes SRT and WebVTT", () => {
    expect(formatSrtTime(3661.25)).toBe("01:01:01,250");
    expect(toSrt([{ start: 0, end: 1.5, text: "Hi" }])).toBe("1\n00:00:00,000 --> 00:00:01,500\nHi\n");
    expect(toVtt([{ start: 0, end: 1.5, text: "Hi" }])).toBe("WEBVTT\n\n00:00:00.000 --> 00:00:01.500\nHi\n");
  });
});

describe("demo story", () => {
  const experiment = getExperiment("queue");

  it("builds a monotonic timeline whose text comes from the run", () => {
    const scene = buildScene(experiment, demoConfig, demoStory, { batchRuns: 5, lookup: (clip) => 1 + (clip.speech.length % 7) / 4 });
    const chapters = scene.timeline.chapters;
    for (let i = 1; i < chapters.length; i++) expect(chapters[i].start).toBeCloseTo(chapters[i - 1].end, 9);
    const captions = scene.timeline.captions;
    for (let i = 1; i < captions.length; i++) expect(captions[i].start).toBeGreaterThanOrEqual(captions[i - 1].end - 1e-9);
    expect(captions.every((caption) => !caption.text.includes("{{"))).toBe(true);
    // Durations in captions are display form; in speech they are words.
    const hook = scene.timeline.clips.find((clip) => clip.chapterId === "hook" && clip.caption.includes("waits"))!;
    expect(hook.caption).toMatch(/\d+:\d\d/);
    expect(hook.speech).toMatch(/minutes?/);
    expect(scene.timeline.at(20)).toEqual(scene.timeline.at(20));
  });

  it("places sound cues inside the video and synthesises them deterministically", () => {
    const scene = buildScene(experiment, demoConfig, demoStory, { batchRuns: 5, lookup: () => 1.5 });
    const cues = placeCues(scene);
    expect(cues.length).toBeGreaterThan(20);
    for (let i = 1; i < cues.length; i++) expect(cues[i].time).toBeGreaterThanOrEqual(cues[i - 1].time);
    expect(cues.every((cue) => cue.time >= 0 && cue.time <= scene.timeline.duration)).toBe(true);
    const [left] = renderSfx(cues.slice(0, 10), 5, 8000);
    const [again] = renderSfx(cues.slice(0, 10), 5, 8000);
    expect(left).toEqual(again);
  });
});

describe("wav", () => {
  it("round-trips PCM16 and trims silence", () => {
    const samples = new Float32Array(4800);
    for (let i = 1000; i < 2000; i++) samples[i] = 0.5 * Math.sin(i / 5);
    const decoded = decodeWav(encodeWav({ sampleRate: 48000, channels: [samples] }));
    expect(decoded.sampleRate).toBe(48000);
    expect(decoded.channels[0][1500]).toBeCloseTo(samples[1500], 3);
    const [start, end] = audibleRange(decoded.channels[0], 48000, -45, 0);
    expect(start).toBeGreaterThanOrEqual(1000);
    expect(start).toBeLessThan(1010);
    expect(end).toBeLessThanOrEqual(2000);
    expect(end).toBeGreaterThan(1990);
  });
});
