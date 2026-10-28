// Browser-side asset library: loads the manifest's files from /assets/<library>/ (served from
// public/), reports what is missing, and hands images to the renderer. Missing files are not
// fatal — the renderer draws a same-style placeholder and the preview/export say what's missing.

import rawManifest from "../../config/assets.socost.json";
import { type AssetEntry, customerPool, parseManifest, poolIndexFor } from "./manifest.ts";

export interface LoadedAsset {
  entry: AssetEntry;
  image: HTMLImageElement;
}

export interface AssetLibrary {
  /** Loaded assets by id. */
  byId: Map<string, LoadedAsset>;
  /** Human-readable problems: unfilled slots and files that failed to load. */
  missing: string[];
  /** First loaded asset with this role (props), or null. */
  role(role: string): LoadedAsset | null;
  /** All loaded assets with this role, in manifest order. */
  roleAll(role: string): LoadedAsset[];
  /** The customer's character (stable per id), or null + a placeholder index when none is loaded. */
  customer(customerId: number): { asset: LoadedAsset | null; variant: number };
}

export const manifest = parseManifest(rawManifest);

function emptyLibrary(missing: string[]): AssetLibrary {
  return build(new Map(), missing);
}

function build(byId: Map<string, LoadedAsset>, missing: string[]): AssetLibrary {
  const pool = customerPool(manifest);
  const loadedPool = pool.map((entry) => byId.get(entry.id) ?? null).filter((asset): asset is LoadedAsset => asset !== null);
  return {
    byId,
    missing,
    role: (role) => manifest.assets.map((entry) => byId.get(entry.id)).find((asset) => asset?.entry.role === role) ?? null,
    roleAll: (role) => manifest.assets.map((entry) => byId.get(entry.id)).filter((asset): asset is LoadedAsset => asset?.entry.role === role),
    customer(customerId) {
      // Identity uses loaded assets only, so a partially filled pool still never shows a gap.
      const size = loadedPool.length > 0 ? loadedPool.length : Math.max(pool.length, 4);
      const index = poolIndexFor(customerId, size);
      return { asset: loadedPool[index] ?? null, variant: index };
    },
  };
}

let current: AssetLibrary = emptyLibrary([]);
let loading: Promise<AssetLibrary> | null = null;

export function assets(): AssetLibrary {
  return current;
}

/** Load every manifest file once. Resolves even when files are missing. */
export function loadAssets(baseUrl = "/"): Promise<AssetLibrary> {
  loading ??= (async () => {
    const folder = manifest.dir.replace(/^public\//, "");
    const byId = new Map<string, LoadedAsset>();
    const missing: string[] = [];
    await Promise.all(
      manifest.assets.map(async (entry) => {
        if (!entry.file) {
          missing.push(`${entry.id} (${entry.role}): no file set in config/assets.socost.json`);
          return;
        }
        const image = new Image();
        image.src = `${baseUrl}${folder}/${encodeURIComponent(entry.file)}`;
        try {
          await image.decode();
          byId.set(entry.id, { entry, image });
        } catch {
          missing.push(`${entry.id} (${entry.role}): ${manifest.dir}/${entry.file} not found or unreadable`);
        }
      }),
    );
    current = build(byId, missing.sort());
    return current;
  })();
  return loading;
}
