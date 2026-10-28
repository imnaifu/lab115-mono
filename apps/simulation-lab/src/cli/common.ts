import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AnyExperiment } from "../core/experiment.ts";
import { getExperiment } from "../core/registry.ts";
import { mergeConfig } from "../core/scene.ts";
import { parseStory, type StorySpec } from "../core/story.ts";

export const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** User-supplied paths are relative to where the command runs (npm runs scripts from the project root). */
export function userPath(path: string): string {
  return isAbsolute(path) ? path : resolve(process.cwd(), path);
}

/** Paths inside stories (config, audio) are relative to the project root, so stories are portable. */
export function projectPath(path: string): string {
  return isAbsolute(path) ? path : resolve(PROJECT_ROOT, path);
}

export function readJson(path: string): unknown {
  if (!existsSync(path)) throw new Error(`File not found: ${path}`);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Could not parse JSON in ${path}: ${(error as Error).message}`);
  }
}

export function writeJson(path: string, value: unknown) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "number" ? (Number.isInteger(value) ? String(value) : value.toFixed(4)) : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function writeCsv(path: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    writeFileSync(path, "");
    return;
  }
  const columns = Object.keys(rows[0]);
  const lines = [columns.join(","), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))];
  writeFileSync(path, `${lines.join("\n")}\n`);
}

function timestamp(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

/**
 * A fresh directory per run under output/<kind>/. Never reuses an existing one, so earlier
 * videos are never overwritten. An explicit --out must not exist yet.
 */
export function createRunDir(kind: string, name: string, explicit?: string): string {
  if (explicit) {
    const dir = userPath(explicit);
    if (existsSync(dir)) throw new Error(`Output directory already exists: ${dir} (refusing to overwrite)`);
    mkdirSync(dir, { recursive: true });
    return dir;
  }
  const base = join(PROJECT_ROOT, "output", kind);
  mkdirSync(base, { recursive: true });
  const stem = `${name}-${timestamp()}`;
  for (let attempt = 1; attempt < 100; attempt++) {
    const dir = join(base, attempt === 1 ? stem : `${stem}-${attempt}`);
    try {
      // Non-recursive mkdir fails if the directory exists — an atomic "claim".
      mkdirSync(dir);
      return dir;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
  throw new Error(`Could not create a unique output directory under ${base}`);
}

export function displayPath(path: string): string {
  const rel = relative(process.cwd(), path);
  return rel.startsWith("..") ? path : rel;
}

export function runMeta() {
  const pkg = JSON.parse(readFileSync(join(PROJECT_ROOT, "package.json"), "utf8")) as { version: string };
  let gitCommit: string | null = null;
  try {
    gitCommit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: PROJECT_ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    // Not a git checkout — fine.
  }
  return { tool: "simulation-lab", version: pkg.version, gitCommit, node: process.version, platform: `${process.platform}-${process.arch}`, createdAt: new Date().toISOString() };
}

export interface LoadedStory {
  story: StorySpec;
  storyPath: string;
  experiment: AnyExperiment;
  /** Config file contents merged with story.configOverrides (validated later by buildScene). */
  rawConfig: unknown;
  configPath: string | null;
}

export function loadStory(storyArg: string, configArg?: string): LoadedStory {
  const storyPath = userPath(storyArg);
  const story = parseStory(readJson(storyPath));
  const experiment = getExperiment(story.experiment);
  const configPath = configArg ? userPath(configArg) : story.config ? projectPath(story.config) : null;
  const fileConfig = configPath ? readJson(configPath) : {};
  return { story, storyPath, experiment, rawConfig: fileConfig, configPath };
}

/** Load an experiment config file (or defaults) and validate it. */
export function loadConfig(experiment: AnyExperiment, configArg?: string, overrides?: unknown): unknown {
  const raw = configArg ? readJson(userPath(configArg)) : {};
  return experiment.parseConfig(mergeConfig(raw, overrides ?? {}));
}

export function parseIntArg(value: string | undefined, name: string, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`--${name} must be an integer, got "${value}"`);
  return parsed;
}

export function parseNumberArg(value: string | undefined, name: string): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`--${name} must be a number, got "${value}"`);
  return parsed;
}

/** Run a CLI main with a clear error message and a non-zero exit code on failure. */
export function runCli(main: () => Promise<void>) {
  main().catch((error: unknown) => {
    console.error(`\n✖ ${error instanceof Error ? error.message : String(error)}`);
    if (process.env.DEBUG && error instanceof Error) console.error(error.stack);
    process.exitCode = 1;
  });
}

export function printTable(rows: string[][]) {
  const widths = rows[0].map((_, column) => Math.max(...rows.map((row) => row[column].length)));
  for (const row of rows) console.log(row.map((cell, column) => (column === 0 ? cell.padEnd(widths[column]) : cell.padStart(widths[column]))).join("  "));
}
