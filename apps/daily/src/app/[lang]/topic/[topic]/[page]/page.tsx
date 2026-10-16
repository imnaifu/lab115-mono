import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { TopicView } from "@/components/TopicView";
import { DEFAULT_LANG, href, isLang } from "@/lib/lang";
import { topicPath } from "@/lib/links";
import { strings } from "@/lib/i18n";
import { topicMetadata } from "@/lib/topics";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ lang: string; topic: string; page: string }> };

/**
 * The page number, or null if this segment is not one.
 *
 * STRICT, and copied deliberately from the archive's route rather than shared
 * with it: only a run of digits with no leading zero, and never `1`. `/topic/
 * tech/1` is a second address for `/topic/tech` and is redirected rather than
 * rendered — see `topicPath`. `01`, `1.0` and `2e1` are not page numbers at all.
 */
function pageNumber(segment: string): number | null {
  if (!/^[1-9][0-9]*$/.test(segment)) return null;
  return Number(segment);
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang, topic, page: segment } = await params;
  const pageLang = isLang(lang) ? lang : DEFAULT_LANG;
  const page = pageNumber(segment);
  if (page === null) {
    const t = strings(pageLang);
    return { title: `${t.notFoundTitle} · ${t.brand}` };
  }
  /* Page 2 and up stay out of the index: they are deeper slices of the same
     list, made of article cards whose own pages are noindex — see the note on
     `robots` in the article route. Page 1 (the other route) stays indexed. */
  return {
    ...(await topicMetadata(pageLang, topic, page)),
    robots: { index: false, follow: true },
  };
}

export default async function TopicPagedPage({
  params,
  searchParams,
}: Params & { searchParams: Promise<{ sort?: string }> }) {
  const { lang, topic, page: segment } = await params;
  const { sort } = await searchParams;
  if (!isLang(lang)) notFound();

  const page = pageNumber(segment);
  if (page === null) notFound();
  // `/topic/<id>/1` is `/topic/<id>`. One page, one URL.
  if (page === 1) permanentRedirect(href(lang, topicPath(topic)));

  return <TopicView lang={lang} id={topic} page={page} sort={sort} />;
}
