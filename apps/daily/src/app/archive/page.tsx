import type { Metadata } from "next";
import {
  Footer,
  Masthead,
  PAD,
  PageShell,
  SECTION,
} from "@/components/Shell";
import { readDigest, listDates } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "归档 · 今日速读" };

export default async function Archive() {
  const dates = await listDates();
  // Small enough to just open every file — one JSON per day, and the archive
  // page is not on the screenshot path.
  const rows = await Promise.all(
    dates.map(async (date) => ({ date, digest: await readDigest(date) })),
  );

  return (
    <PageShell>
      <Masthead title="归档" subtitle="Archive">
        <span>{dates.length} 天</span>
      </Masthead>

      <section className={`${SECTION} flex flex-col gap-2.5 ${PAD}`}>
        {rows.length === 0 ? (
          <div className="rounded-card bg-cream-deep px-5 py-4">
            还没有任何归档 · Nothing archived yet.
          </div>
        ) : (
          rows.map(({ date, digest }) => (
            <a
              className="flex items-center justify-between gap-3.5 rounded-xl border border-line bg-paper px-5 py-4"
              key={date}
              href={`/d/${date}`}
            >
              <span className="text-lg font-bold text-ink">{date}</span>
              <span className="text-sm font-bold text-ink-soft">
                {digest ? `${digest.stats.fetched} 篇` : "—"}
              </span>
            </a>
          ))
        )}
      </section>

      <Footer left="daily.lab115.com" link={<a href="/">今日 Today</a>} />
    </PageShell>
  );
}
