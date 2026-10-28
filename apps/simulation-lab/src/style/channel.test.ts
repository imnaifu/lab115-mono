import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import rawManifest from "../../config/assets.socost.json";
import { customerPool, parseManifest, poolIndexFor } from "../assets/manifest.ts";
import tokens from "./sokosoko.tokens.json";
import { meaning, palette, seriesColors, supporting, walkProgress } from "./channel.ts";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|css)$/.test(name) && !name.endsWith(".test.ts") ? [path] : [];
  });
}

describe("channel style", () => {
  it("keeps every colour in the design-system tokens", () => {
    // Scenes must reuse the shared palette instead of picking colours per episode; only the
    // tokens file (JSON, not scanned) holds colour values.
    const offenders = sourceFiles(join(import.meta.dirname, "..")).filter((file) =>
      /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![\w-])|rgba?\(\s*\d/.test(readFileSync(file, "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "")),
    );
    expect(offenders).toEqual([]);
  });

  it("takes every colour from the design system, and every meaning from the palette", () => {
    const systemColours = new Set(tokens.color.tokens.map((token) => token.value.toLowerCase()));
    for (const value of Object.values(palette)) expect(systemColours).toContain(value.toLowerCase());
    const paletteColours = new Set<string>(Object.values(palette));
    for (const value of [...Object.values(meaning), ...seriesColors, ...supporting]) expect(paletteColours).toContain(value);
  });

  it("never uses the long-wait colour or the emphasis colour for a rule", () => {
    // Rule colours must not hint at a winner: pink means "waited long", yellow means "look here".
    expect(seriesColors).not.toContain(meaning.waitLong);
    expect(seriesColors).not.toContain(meaning.emphasis);
  });

  it("walks with a gentle start and stop, never faster than ~1.25× the cruising pace", () => {
    const seconds = 2;
    let peak = 0;
    for (let i = 1; i <= 1000; i++) peak = Math.max(peak, (walkProgress(i / 1000, seconds) - walkProgress((i - 1) / 1000, seconds)) * 1000);
    expect(walkProgress(0, seconds)).toBe(0);
    expect(walkProgress(1, seconds)).toBeCloseTo(1, 9);
    expect(peak).toBeLessThan(1.25);
    expect(walkProgress(0.01, seconds)).toBeLessThan(0.002);
  });
});

describe("illustration manifest", () => {
  const manifest = parseManifest(rawManifest);
  it("is valid and keeps raw files out of the repo path", () => {
    expect(manifest.dir).toBe("public/assets/socost");
    expect(readFileSync(join(import.meta.dirname, "../../.gitignore"), "utf8")).toContain("/public/assets/socost/*");
  });
  it("gives each customer a stable look: slot = shopper-((id − 1) mod pool) + 1", () => {
    const pool = customerPool(manifest).length;
    const first = Array.from({ length: 100 }, (_, i) => poolIndexFor(i + 1, pool));
    expect(first.slice(0, 7)).toEqual([0, 1, 2, 3, 4, 5, 0].map((value) => value % pool));
    expect(new Set(first).size).toBe(pool);
    // Neighbours never share a look (with more than one file).
    if (pool > 1) expect(first.filter((value, i) => value === first[i + 1]).length).toBe(0);
  });
  it("rejects paths that could escape the asset folder", () => {
    expect(() => parseManifest({ ...manifest, assets: [{ id: "x", kind: "prop", role: "shelf", file: "../secret.svg", source: null }] })).toThrow(/plain file name/);
  });
});
