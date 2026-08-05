import categoriesData from "@/data/categories.json";
import hospital from "@/data/scenes/hospital.json";
import living from "@/data/scenes/living.json";
import kitchen from "@/data/scenes/kitchen.json";
import classroom from "@/data/scenes/classroom.json";

export type DifficultyKey = "easy" | "medium" | "hard";

export interface Word {
  /** unique id within the level (used as drag handle + slot id) */
  id: string;
  /** the English word shown on the card and answer */
  word: string;
  /** IPA phonetic, shown on the card */
  ipa: string;
  /** Chinese translation, shown in study mode */
  zh: string;
  /** placement of the drop-zone over the image, in PERCENT of the image:
   *  [left, top, width, height] */
  box: [number, number, number, number];
}

export interface Level {
  /** path under /public, e.g. "/scenes/hospital.png" */
  image: string;
  words: Word[];
}

export interface Scene {
  id: string;
  name: string;
  category: string;
  /** CSS aspect-ratio string for the stage, e.g. "1024 / 559" */
  aspectRatio?: string;
  /** when true the scene shows as "coming soon" and cannot be played */
  locked?: boolean;
  levels?: Partial<Record<DifficultyKey, Level>>;
}

export interface Category {
  id: string;
  name: string;
  en: string;
  scenes: string[];
}

export const DIFFICULTIES: { key: DifficultyKey; label: string }[] = [
  { key: "easy", label: "简单" },
  { key: "medium", label: "中等" },
  { key: "hard", label: "困难" },
];

export const categories = (categoriesData as { categories: Category[] }).categories;

const sceneList: Scene[] = [hospital, living, kitchen, classroom] as Scene[];

export const scenesById: Record<string, Scene> = Object.fromEntries(
  sceneList.map((s) => [s.id, s])
);

export function getScene(id: string | null): Scene | null {
  return id ? scenesById[id] ?? null : null;
}

export function getLevel(scene: Scene | null, diff: DifficultyKey | null): Level | null {
  if (!scene || !scene.levels || !diff) return null;
  return scene.levels[diff] ?? null;
}

export function availableDifficulties(scene: Scene): DifficultyKey[] {
  if (!scene.levels || scene.locked) return [];
  return DIFFICULTIES.map((d) => d.key).filter((k) => scene.levels![k]);
}
