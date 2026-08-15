import { notFound } from "next/navigation";
import { DigestView, EmptyState } from "@/components/DigestView";
import { PageShell } from "@/components/Shell";
import { dateKey } from "@/lib/config";
import { isLang } from "@/lib/lang";
import { readDigest, readLatest } from "@/lib/store";

// Read from the git clone on every request — the cron rewrites those files
// underneath a long-running server, so nothing here may be cached at build time.
export const dynamic = "force-dynamic";

export default async function Home({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  // `[lang]` matches any first segment, so an unknown one has to 404 rather
  // than render the site in a language that does not exist.
  if (!isLang(lang)) notFound();

  const today = dateKey(new Date());

  // Before the day's run has happened there is no file for `today` yet; fall
  // back to the newest digest on disk so the page is never blank.
  const digest = (await readDigest(today)) ?? (await readLatest());

  if (!digest) {
    return (
      <PageShell>
        <EmptyState lang={lang} />
      </PageShell>
    );
  }

  return <DigestView digest={digest} lang={lang} path="/" />;
}
