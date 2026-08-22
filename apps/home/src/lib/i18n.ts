import type { Lang } from "@/lib/lang";

/**
 * Every word on the page that is not part of a product's own record.
 *
 * One object per language rather than a key-by-key `t()` lookup: the whole site
 * is a single page, the copy is short, and having each language readable top to
 * bottom is what makes it possible to tell whether the two halves still say the
 * same thing.
 */
export type Strings = {
  /** Used in <title>, the nav wordmark's screen-reader label and the footer. */
  brand: string;
  tagline: string;
  metaDescription: string;

  navProducts: string;
  navMethod: string;
  /** Label on the language toggle — always written in the language it leads to. */
  langSwitch: string;
  skipToContent: string;

  heroEyebrow: string;
  heroTitle: string;
  heroLede: string;
  heroPrimaryCta: string;
  heroSecondaryCta: string;

  productsEyebrow: string;
  productsTitle: string;
  productsLede: string;
  /** Verb on a product's link button; the destination follows it. */
  visit: string;

  methodEyebrow: string;
  methodTitle: string;
  method: { title: string; body: string }[];

  footerNote: string;
  footerRights: string;
};

const zh: Strings = {
  brand: "LAB115",
  tagline: "AI 产品实验室",
  metaDescription:
    "LAB115 是一个独立的 AI 产品实验室。我们把大模型用在具体的小问题上，每个想法都做成真的能每天用的产品。",

  navProducts: "产品",
  navMethod: "方法",
  langSwitch: "EN",
  skipToContent: "跳到主要内容",

  heroEyebrow: "AI 产品实验室",
  heroTitle: "把想法\n做成产品。",
  heroLede:
    "LAB115 是一个独立的 AI 产品实验室。我们不做平台，也不做框架——只把大模型用在具体的小问题上，然后把它做成真的能上线、能每天打开的东西。",
  heroPrimaryCta: "看看在做什么",
  heroSecondaryCta: "我们怎么做",

  productsEyebrow: "产品",
  productsTitle: "已经在跑的东西。",
  productsLede: "都在线上，都可以现在就打开。",
  visit: "打开",

  methodEyebrow: "方法",
  methodTitle: "一个实验室的三条规矩。",
  method: [
    {
      title: "从一件具体的麻烦事开始",
      body: "每个产品都对应一件我们自己每天要做、又觉得烦的事。先有那件事，才有产品——不是先有技术，再找地方用。",
    },
    {
      title: "只让模型做模型该做的",
      body: "抓取、去重、排版、导出这些交给代码，写清楚、跑得稳；只有判断和写作交给大模型。边界画得越清楚，结果越可预期。",
    },
    {
      title: "上线了才算做完",
      body: "每个想法都跑在自己的域名上，每天真的在运行、真的有人用。走不到这一步的，我们不叫它产品，它还只是一个 demo。",
    },
  ],

  footerNote: "独立的 AI 产品实验室。",
  footerRights: "版权所有。",
};

const en: Strings = {
  brand: "LAB115",
  tagline: "AI product lab",
  metaDescription:
    "LAB115 is an independent AI product lab. We point large models at small, concrete problems and ship each idea as something you can actually use every day.",

  navProducts: "Products",
  navMethod: "Method",
  langSwitch: "中文",
  skipToContent: "Skip to main content",

  heroEyebrow: "AI product lab",
  heroTitle: "Ideas, shipped\nas products.",
  heroLede:
    "LAB115 is an independent AI product lab. We don't build platforms or frameworks — we point large models at small, concrete problems, then ship the result as something that runs in the open and is worth opening again tomorrow.",
  heroPrimaryCta: "See what we've built",
  heroSecondaryCta: "How we work",

  productsEyebrow: "Products",
  productsTitle: "Things already running.",
  productsLede: "All live. All open to anyone, right now.",
  visit: "Open",

  methodEyebrow: "Method",
  methodTitle: "Three rules for a small lab.",
  method: [
    {
      title: "Start from one real annoyance",
      body: "Every product answers something we personally had to do every day and resented. The chore comes first and the product second — never a technology hunting for somewhere to be used.",
    },
    {
      title: "Let the model do only model work",
      body: "Fetching, de-duplicating, laying out, exporting — that is code's job, written plainly and run predictably. Only judgement and prose go to the model. The sharper that line, the more repeatable the result.",
    },
    {
      title: "Shipped, or it doesn't count",
      body: "Every idea runs on its own domain, on a real schedule, for real users. Anything that never gets that far we don't call a product — it is still a demo.",
    },
  ],

  footerNote: "An independent AI product lab.",
  footerRights: "All rights reserved.",
};

export const STRINGS: Record<Lang, Strings> = { zh, en };

export function strings(lang: Lang): Strings {
  return STRINGS[lang];
}
