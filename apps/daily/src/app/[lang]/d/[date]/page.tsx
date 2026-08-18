import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DigestView } from "@/components/DigestView";
import { strings } from "@/lib/i18n";
import { DEFAULT_LANG, isLang } from "@/lib/lang";
import { readDigest } from "@/lib/store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ lang: string; date: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang, date } = await params;
  // `[lang]` matches any segment, and this runs before the page's own check
  // rejects an unknown one — so fall back rather than throw on the title.
  const t = strings(isLang(lang) ? lang : DEFAULT_LANG);
  return { title: `${t.brand} · ${date}` };
}

export default async function DayPage({ params }: Params) {
  const { lang, date } = await params;
  if (!isLang(lang)) notFound();

  // readDigest validates the yyyy-mm-dd shape, so a crafted [date] cannot walk
  // out of the repo directory.
  const digest = await readDigest(date);
  if (!digest) notFound();

  return <DigestView digest={digest} lang={lang} path={`/d/${date}`} />;
}
