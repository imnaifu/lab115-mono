// Remotion serves static files from one public folder. Ours links to the two real locations —
// public/assets (Soco-st files, git-ignored) and cache/ (voice clips, render beds) — so nothing
// is copied: Remotion's bundler re-creates symlinks instead of copying their contents.

import { existsSync, lstatSync, mkdirSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { cacheManifest, voiceCacheDir } from "../voice/cache.ts";

export function remotionPublicDir(projectRoot: string): string {
  return join(projectRoot, "remotion", "public");
}

/** Create (or repair) remotion/public/{assets,cache} and the voice manifest Studio reads. */
export function prepareRemotionPublic(projectRoot: string): string {
  const dir = remotionPublicDir(projectRoot);
  mkdirSync(dir, { recursive: true });
  const links: [string, string][] = [
    ["assets", join(projectRoot, "public", "assets")],
    ["cache", join(projectRoot, "cache")],
  ];
  for (const [name, target] of links) {
    mkdirSync(target, { recursive: true });
    const link = join(dir, name);
    const wanted = relative(dir, target);
    if (existsSync(link) || isSymlink(link)) {
      if (isSymlink(link) && readlinkSync(link) === wanted) continue;
      rmSync(link, { recursive: true, force: true });
    }
    symlinkSync(wanted, link);
  }
  // Studio has no Node side to ask: give it the cached clip durations as a file.
  const voiceDir = voiceCacheDir(projectRoot);
  mkdirSync(voiceDir, { recursive: true });
  writeFileSync(join(voiceDir, "manifest.json"), JSON.stringify(cacheManifest(voiceDir)));
  return dir;
}

function isSymlink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}
