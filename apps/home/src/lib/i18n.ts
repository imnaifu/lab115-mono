import type { Lang } from "@/lib/lang";

/**
 * Every word the site says, per language.
 *
 * Mostly metadata — the title, the description, the brand name in structured
 * data. The page shows only the tagline and the intro, under the wordmark; the
 * wordmark is the same in both languages and lives in components/Logo.tsx.
 */
export type Strings = {
  /** Used in <title>, Open Graph and structured data. */
  brand: string;
  /** In <title>, and on the page under the wordmark. */
  tagline: string;
  /** The one sentence on the page under the tagline. */
  intro: string;
  metaDescription: string;
};

const zh: Strings = {
  brand: "LAB115",
  tagline: "AI 产品实验室",
  intro: "做一些好玩的小东西",
  metaDescription:
    "LAB115 是一个独立的 AI 产品实验室。我们把大模型用在具体的小问题上，每个想法都做成真的能每天用的产品。",
};

const en: Strings = {
  brand: "LAB115",
  tagline: "AI product lab",
  intro: "Making fun little things",
  metaDescription:
    "LAB115 is an independent AI product lab. We point large models at small, concrete problems and ship each idea as something you can actually use every day.",
};

export const STRINGS: Record<Lang, Strings> = { zh, en };

export function strings(lang: Lang): Strings {
  return STRINGS[lang];
}
