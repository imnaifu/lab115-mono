import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { TopicView } from "@/components/TopicView";
import { DEFAULT_LANG, isLang } from "@/lib/lang";
import { topicMetadata } from "@/lib/topics";

/** Dynamic for the same reason every other `[lang]` page is — the archive is a
 *  git clone the container makes when it starts, so nothing here may be baked at
 *  build time. See the note in app/sitemap.ts for what that cost once. */
export const dynamic = "force-dynamic";

/**
 * `/topic/tech` — the first page of one subject's run of takes.
 *
 * THE BODY IS `TopicView`, shared with `/topic/tech/<n>`. This route exists only
 * to be the page-1 URL: `/topic/tech/1` redirects here rather than rendering, so
 * one page never has two addresses.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; topic: string }>;
}): Promise<Metadata> {
  const { lang, topic } = await params;
  return topicMetadata(isLang(lang) ? lang : DEFAULT_LANG, topic, 1);
}

export default async function TopicPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; topic: string }>;
  /* `?sort=hot` — a VIEW of this page, not another page. It changes nothing
     about the canonical, which `topicMetadata` builds from the path. See the
     `sort` prop in TopicView. */
  searchParams: Promise<{ sort?: string }>;
}) {
  const { lang, topic } = await params;
  const { sort } = await searchParams;
  if (!isLang(lang)) notFound();
  return <TopicView lang={lang} id={topic} page={1} sort={sort} />;
}
