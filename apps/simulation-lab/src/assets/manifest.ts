// Illustration asset manifest (config/assets.socost.json): which local file plays which role.
// Pure — shared by the browser loader, the CLI check and tests.

export type AssetKind = "character" | "prop" | "background" | "icon";

export interface AssetEntry {
  id: string;
  kind: AssetKind;
  /** What the asset is used for: "customer", "cashier", "checkout-counter", "shelf", "entrance", … */
  role: string;
  /** File name inside the manifest's `dir`; null until you add the download. */
  file: string | null;
  /** Characters: which way the figure looks in the original file. */
  facing?: "left" | "right";
  /** Characters: relative height (1 = adult). */
  heightScale?: number;
  /** Props: display height in logical pixels at scale 1. */
  height?: number;
  /** The page on the source site the file came from. */
  source: string | null;
  notes?: string;
}

export interface AssetManifest {
  library: string;
  terms: string;
  dir: string;
  rules: string[];
  assets: AssetEntry[];
}

const KINDS: AssetKind[] = ["character", "prop", "background", "icon"];

export function parseManifest(raw: unknown): AssetManifest {
  const manifest = raw as AssetManifest;
  if (!manifest || !Array.isArray(manifest.assets)) throw new Error("Asset manifest needs an `assets` array");
  const ids = new Set<string>();
  manifest.assets.forEach((entry, i) => {
    const where = `assets[${i}]`;
    if (!entry.id || ids.has(entry.id)) throw new Error(`${where}: missing or duplicate id "${entry.id}"`);
    ids.add(entry.id);
    if (!KINDS.includes(entry.kind)) throw new Error(`${where}: kind must be one of ${KINDS.join(", ")}`);
    if (!entry.role) throw new Error(`${where}: role is required`);
    if (entry.file !== null && (typeof entry.file !== "string" || entry.file.includes("/") || entry.file.includes(".."))) {
      throw new Error(`${where}: file must be a plain file name inside ${manifest.dir}`);
    }
    if (entry.file && !/\.(svg|png)$/i.test(entry.file)) throw new Error(`${where}: only .svg and .png are supported`);
    if (entry.kind === "character" && entry.facing !== "left" && entry.facing !== "right") throw new Error(`${where}: characters need facing "left" or "right"`);
  });
  return manifest;
}

/** Customer characters in manifest order — the pool identities are drawn from. */
export function customerPool(manifest: AssetManifest): AssetEntry[] {
  return manifest.assets.filter((entry) => entry.kind === "character" && entry.role === "customer");
}

/**
 * Stable identity: customer #n always gets the same pool slot, in every shot and every render
 * (it depends only on the id and the manifest order — adding assets re-deals the cast).
 */
export function poolIndexFor(customerId: number, poolSize: number): number {
  if (poolSize <= 0) return 0;
  // Design decision D3: slot = shopper-((id − 1) mod 6) + 1 — neighbours (#51, #52, #53) never share a look.
  return (((customerId - 1) % poolSize) + poolSize) % poolSize;
}
