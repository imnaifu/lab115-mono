import { describe, expect, it } from "vitest";
import { buildScene } from "../../core/scene.ts";
import { templateExperiment } from "./index.ts";

// Keeps the template honest: it must always plug into the shared scene/story pipeline.
describe("template experiment", () => {
  it("builds a scene with a story, anchors and template vars", () => {
    const scene = buildScene(templateExperiment, { runners: 5 }, {
      name: "template-test",
      experiment: "template",
      title: "Template",
      seed: 1,
      compare: ["steady", "sprint"],
      batch: { runs: 3 },
      chapters: [
        { id: "run", kind: "sim", sim: { speed: 10 }, narration: "{{runners}} runners, best: {{best.label}}." },
        { id: "chart", kind: "chart", duration: 3 },
      ],
    });
    expect(scene.timeline.duration).toBeGreaterThan(3);
    expect(scene.timeline.captions[0].text).toMatch(/^5 runners, best: /);
    // No audio generated: timing is an explicit estimate.
    expect(scene.timeline.estimated).toBe(true);
    expect(scene.batch?.seeds).toEqual([1, 2, 3]);
  });
});
