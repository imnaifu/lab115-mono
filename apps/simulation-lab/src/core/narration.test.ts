import { describe, expect, it } from "vitest";
import { wrapText } from "../render/draw.ts";
import { applyLexicon, evaluateCondition, fillTemplate, hashKey, splitIntoClips, spokenDuration } from "./narration.ts";

describe("conditions", () => {
  const values = { "left.median": 135, "right.median": 117, "right.p95": 416, "left.p95": 244 };
  it("evaluates comparisons with && and ||", () => {
    expect(evaluateCondition("right.median < left.median && right.p95 > left.p95", values, "t")).toBe(true);
    expect(evaluateCondition("right.median > left.median || left.p95 >= 244", values, "t")).toBe(true);
    expect(evaluateCondition("left.p95 == 244", values, "t")).toBe(true);
    expect(evaluateCondition("left.p95 != 244", values, "t")).toBe(false);
  });
  it("fails loudly on typos", () => {
    expect(() => evaluateCondition("left.mediam < 3", values, "t")).toThrow(/Unknown value/);
    expect(() => evaluateCondition("left.median <<< 3", values, "t")).toThrow(/Cannot parse/);
    expect(() => fillTemplate("{{nope}}", {}, "t")).toThrow(/Unknown template variable/);
  });
});

describe("spoken forms", () => {
  it("reads durations as words", () => {
    expect(spokenDuration(492, "en")).toBe("8 minutes and 12 seconds");
    expect(spokenDuration(60, "en")).toBe("1 minute");
    expect(spokenDuration(3725, "en")).toBe("1 hour 2 minutes and 5 seconds");
    expect(spokenDuration(0, "en")).toBe("0 seconds");
    expect(spokenDuration(492, "zh")).toBe("8分12秒");
    expect(spokenDuration(600, "zh")).toBe("10分");
  });
  it("applies the lexicon to whole words only", () => {
    const lexicon = { Poisson: "[Poisson](/pwɑsˈɔn/)" };
    expect(applyLexicon("A Poisson process.", lexicon)).toBe("A [Poisson](/pwɑsˈɔn/) process.");
    expect(applyLexicon("Poissonian", lexicon)).toBe("Poissonian");
  });
});

describe("clip splitting", () => {
  const same = (text: string) => text;
  it("splits sentences in English and Chinese", () => {
    expect(splitIntoClips("One. Two! Three?", same, "t")).toEqual(["One.", "Two!", "Three?"]);
    expect(splitIntoClips("同一个人。同一时刻！对吗？", same, "t")).toEqual(["同一个人。", "同一时刻！", "对吗？"]);
  });
  it("splits a long sentence at clause punctuation so each caption fits two lines", () => {
    const long = "This sentence is deliberately long, it keeps going with several clauses, each adding more words, until it cannot fit in two caption lines anymore, which forces a split.";
    const clips = splitIntoClips(long, same, "t");
    expect(clips.length).toBeGreaterThan(1);
    expect(clips.join(" ")).toBe(long);
  });
  it("refuses a single clause that is too long instead of guessing timings", () => {
    const run = "word ".repeat(60).trim() + ".";
    expect(() => splitIntoClips(run, same, "t")).toThrow(/too long for two caption lines/);
  });
  it("checks fit on the display text but keeps template placeholders intact", () => {
    const clips = splitIntoClips("Waited {{wait}}. Done.", (text) => text.replace("{{wait}}", "8:12"), "t");
    expect(clips).toEqual(["Waited {{wait}}.", "Done."]);
  });
});

describe("hash keys", () => {
  it("are stable and input-sensitive", () => {
    expect(hashKey("hello")).toBe(hashKey("hello"));
    expect(hashKey("hello")).not.toBe(hashKey("hello."));
    expect(hashKey("hello")).toMatch(/^[0-9a-f]{28}$/);
  });
});

describe("caption line breaking", () => {
  // Fake canvas: every character is 1 unit wide, so line widths are easy to reason about.
  const ctx = { font: "", measureText: (text: string) => ({ width: [...text].length }) } as unknown as CanvasRenderingContext2D;
  it("breaks Chinese anywhere but never starts a line with closing punctuation", () => {
    const lines = wrapText(ctx, "一二三四五，六七八", 5, 10);
    expect(lines[0]).toBe("一二三四五，");
    expect(lines[1]).toBe("六七八");
  });
  it("breaks English between words", () => {
    expect(wrapText(ctx, "aaa bbb ccc", 7, 10)).toEqual(["aaa bbb", "ccc"]);
  });
});
