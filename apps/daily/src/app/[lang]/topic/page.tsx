import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { TopicHub } from "@/components/TopicHub";
import { DEFAULT_LANG, isLang } from "@/lib/lang";
import { topicHubMetadata } from "@/lib/topics";

/** Dynamic like every other `[lang]` page — the archive is a clone the
 *  container makes at start, so nothing here may be baked at build time. */
export const dynamic = "force-dynamic";

/**
 * `/topic` — the topic hub. See components/TopicHub for what is on it and why
 * it is a page rather than a row of links.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return topicHubMetadata(isLang(lang) ? lang : DEFAULT_LANG);
}

export default async function TopicHubPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return <TopicHub lang={lang} />;
}
