import fs from "node:fs/promises";
import path from "node:path";
import { REPO_SUBDIR } from "./config";
import { REPO_PATH } from "./paths";
import type { Digest } from "./types";

/**
 * Read/write side of the git clone. There is no index file: the archive list
 * is produced by walking the directory, so the filesystem and the repo can
 * never disagree about which days exist.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** `daily/2026/08/2026-08-10.json`, relative to the repo root. */
export function relPathFor(date: string): string {
  const [year, month] = date.split("-");
  return path.join(REPO_SUBDIR, year, month, `${date}.json`);
}

function absPathFor(date: string): string {
  return path.join(REPO_PATH, relPathFor(date));
}

export async function writeDigest(digest: Digest): Promise<string> {
  const rel = relPathFor(digest.date);
  const abs = path.join(REPO_PATH, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, `${JSON.stringify(digest, null, 2)}\n`, "utf8");
  return rel;
}

/** null when that day was never generated (or the clone isn't there yet). */
export async function readDigest(date: string): Promise<Digest | null> {
  if (!DATE_RE.test(date)) return null; // also blocks path traversal via [date]
  try {
    const raw = await fs.readFile(absPathFor(date), "utf8");
    return JSON.parse(raw) as Digest;
  } catch {
    return null;
  }
}

/** Every generated date, newest first. Walks daily/<yyyy>/<mm>/. */
export async function listDates(): Promise<string[]> {
  const root = path.join(REPO_PATH, REPO_SUBDIR);
  const dates: string[] = [];

  let years: string[];
  try {
    years = await fs.readdir(root);
  } catch {
    return []; // repo not cloned yet — the pages render an empty state
  }

  for (const year of years) {
    let months: string[];
    try {
      months = await fs.readdir(path.join(root, year));
    } catch {
      continue;
    }
    for (const month of months) {
      let files: string[];
      try {
        files = await fs.readdir(path.join(root, year, month));
      } catch {
        continue;
      }
      for (const file of files) {
        const date = file.replace(/\.json$/, "");
        if (file.endsWith(".json") && DATE_RE.test(date)) dates.push(date);
      }
    }
  }

  return dates.sort().reverse();
}

/** The most recent digest on disk — what `/` falls back to before the first
 *  run of the day has happened. */
export async function readLatest(): Promise<Digest | null> {
  const [newest] = await listDates();
  return newest ? readDigest(newest) : null;
}
