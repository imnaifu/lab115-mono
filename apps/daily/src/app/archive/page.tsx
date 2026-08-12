import type { Metadata } from "next";
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
    <div className="page">
      <header className="masthead">
        <span className="masthead__eyebrow">daily.lab115.com</span>
        <h1 className="masthead__title">
          归档
          <small>Archive</small>
        </h1>
        <div className="masthead__meta">
          <span>{dates.length} 天</span>
        </div>
      </header>

      <section className="section pad">
        {rows.length === 0 ? (
          <div className="folded">还没有任何归档 · Nothing archived yet.</div>
        ) : (
          rows.map(({ date, digest }) => (
            <a className="archive__row" key={date} href={`/d/${date}`}>
              <span className="archive__date">{date}</span>
              <span className="section__count">
                {digest ? `${digest.stats.fetched} 篇` : "—"}
              </span>
            </a>
          ))
        )}
      </section>

      <footer className="foot pad">
        <span>daily.lab115.com</span>
        <span className="foot__links">
          <a href="/">今日 Today</a>
        </span>
      </footer>
    </div>
  );
}
