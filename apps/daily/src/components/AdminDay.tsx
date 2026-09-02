import { notFound } from "next/navigation";
import { AdminLink, AdminShell, num, Panel } from "./AdminShell";
import { PUBLISH_MIN_SCORE } from "@/lib/categories";
import { ADMIN_PATH, adminDayPath } from "@/lib/links";
import { MIN_PER_DIMENSION, SCORE_DIMENSIONS, SCORE_MAX } from "@/lib/score";
import { sourceOf } from "@/lib/sources";
import {
  entryKey,
  outcomesAt,
  type GateOutcome,
  type ScoredEntry,
} from "@/lib/stats";
import { allScored, listDates, readDigest } from "@/lib/store";

/**
 * `/admin/<date>` — one run, every article it considered, and why each one did
 * or did not make the page.
 *
 * THE QUESTION IT ANSWERS is the one `Digest.articles` keeps the rejections FOR,
 * quoted from that type: "why is that post missing". Until now the answer was in
 * a JSON file in a private repo — the score is there, the five dimensions are
 * there, and each one carries the sentence the model wrote to justify it, which
 * types.ts calls the thing that makes a score auditable. None of it was
 * readable anywhere.
 *
 * THE NOTES ARE THE REASON THIS PAGE IS WORTH MORE THAN THE OVERVIEW. A total of
 * 32 tells you nothing; `accessible 4 — "WebAudio internals and Bluetooth
 * multipoint"` tells you which line of the rubric to go and argue with. So every
 * dimension prints its sentence, not just its number.
 *
 * THE OUTCOME IS RECOMPUTED UNDER TODAY'S RULES, and the `published` flag from
 * the file is shown beside it. They disagree on the older days, which is the
 * point: that is what a rubric or a floor change looks like from the outside.
 */
export async function AdminDay({ date }: { date: string }) {
  const digest = await readDigest(date);
  if (!digest) notFound();

  const [entries, dates] = await Promise.all([allScored(), listDates()]);
  const day = entries.filter((entry) => entry.date === date);

  /**
   * Computed over THE WHOLE ARCHIVE and then read for this day, rather than over
   * this day alone.
   *
   * They give the same answer — every gate in `outcomesAt` is per-day already,
   * the per-source quota included — and going through the same call the overview
   * uses is what stops the two pages ever disagreeing about one article.
   */
  const outcomes = outcomesAt(entries, PUBLISH_MIN_SCORE);

  // Highest score first, which is the order the digest ranks by, so the run
  // reads top-down like the day it produced.
  const sorted = [...day].sort((a, b) => b.score - a.score);
  const at = dates.indexOf(date);

  return (
    <AdminShell
      title={date}
      meta={
        `抓取 ${digest.stats.fetched} · 发布 ${digest.stats.shown} · ` +
        `窗口 ${digest.window.from.slice(0, 16)} → ${digest.window.to.slice(0, 16)} · ` +
        `生成于 ${digest.generatedAt.slice(0, 16)}`
      }
      nav={
        <>
          <AdminLink href={ADMIN_PATH}>总览</AdminLink>
          {/* Newer is the SMALLER index — `listDates` is newest-first. Rendered
              only where there is a day to go to, so the pair never points at a
              date the archive does not have. */}
          {at > 0 ? (
            <AdminLink href={adminDayPath(dates[at - 1])}>← 更近</AdminLink>
          ) : null}
          {at >= 0 && at < dates.length - 1 ? (
            <AdminLink href={adminDayPath(dates[at + 1])}>更早 →</AdminLink>
          ) : null}
        </>
      }
    >
      {/**
       * THE FAILED SOURCES FIRST, and only when there are any.
       *
       * `SourceStatus.ok` is false for a source that threw, and the type's own
       * note says the entry exists so a page can say "this one failed today"
       * instead of silently pretending the site published nothing. No page ever
       * said it. A morning where eight sources timed out looks exactly like a
       * quiet morning in every other view of this data.
       */}
      {digest.sources.some((source) => !source.ok) ? (
        <Panel
          title="抓取失败的源"
          note="这一天这些源没能取到东西。文章少可能是因为这个，不是因为大家都没发。"
        >
          <div className="flex flex-col gap-2">
            {digest.sources
              .filter((source) => !source.ok)
              .map((source) => (
                <div
                  className="rounded-xl border border-line bg-page-deep px-4 py-3"
                  key={source.id}
                >
                  <div className="text-sm font-bold text-ink">
                    {source.name}
                  </div>
                  {source.error ? (
                    <div className="mt-1 font-mono text-xs break-all text-ink-soft">
                      {source.error}
                    </div>
                  ) : null}
                </div>
              ))}
          </div>
        </Panel>
      ) : null}

      <Panel
        title={`${sorted.length} 篇经过评分`}
        note={
          <>
            按总分从高到低。「结果」是按
            <strong className="font-bold text-ink-mid">当前</strong>
            规则重算的，「当天」是文件里记的实际结果 —— 两者不一致的地方，就是那之后
            门槛或 rubric 改过的证据。
          </>
        }
      >
        <div className="flex flex-col gap-2.5">
          {sorted.map((entry) => (
            <EntryCard
              key={entryKey(entry)}
              entry={entry}
              outcome={outcomes.get(entryKey(entry)) ?? "unscored"}
            />
          ))}
        </div>
      </Panel>
    </AdminShell>
  );
}

/** What each gate outcome is called, and whether it reads as a pass. */
const OUTCOME: Record<GateOutcome, { label: string; pass: boolean }> = {
  published: { label: "发布", pass: true },
  "under-floor": { label: `总分未过 ${PUBLISH_MIN_SCORE}`, pass: false },
  "under-dimension": { label: `单维 < ${MIN_PER_DIMENSION}`, pass: false },
  quota: { label: "每源配额", pass: false },
  unscored: { label: "未打分", pass: false },
};

/**
 * One article: the score, where it fell, and the five sentences behind it.
 *
 * THE TITLE LINKS TO THE ORIGINAL, not to this site's page for it — half the
 * articles here have no page, because they were turned down, and the reason to
 * open one from this view is to check the model's reading against the actual
 * piece.
 */
function EntryCard({
  entry,
  outcome,
}: {
  entry: ScoredEntry;
  outcome: GateOutcome;
}) {
  const verdict = OUTCOME[outcome];
  const source = sourceOf(entry.sourceId);
  const edited = entry.scoredBy === "human";

  return (
    <article className="rounded-card border border-line bg-paper px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0 flex-1">
          <a
            className="text-base font-bold text-ink"
            href={entry.url}
            /* An admin page linking out to sixty different blogs is the one
               place `noreferrer` is right: these are not editorial links and
               there is no reason to announce where the visit came from. */
            rel="noreferrer"
          >
            {entry.title}
          </a>
          <div className="mt-1 text-xs text-ink-soft">
            {source.name}
            {entry.category ? ` · ${entry.category}` : ""}
          </div>
        </div>
        <div className="flex items-baseline gap-2.5 whitespace-nowrap">
          {edited ? (
            <span
              className="text-xs font-bold text-ink-soft"
              title={`模型给 ${entry.modelScore ?? "?"}`}
            >
              人工 {entry.modelScore !== undefined ? `←${entry.modelScore}` : ""}
            </span>
          ) : null}
          <span className="text-lg font-bold tabular-nums text-ink">
            {entry.score}
            <span className="text-xs font-medium text-ink-soft">
              /{SCORE_MAX}
            </span>
          </span>
          {/* The recomputed verdict, then what actually happened. Both, because
              the pair is the finding on any day older than the last rule change. */}
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-bold ${
              verdict.pass
                ? "bg-ink text-paper"
                : "border border-line text-ink-mid"
            }`}
          >
            {verdict.label}
          </span>
          {entry.published !== verdict.pass ? (
            <span
              className="text-xs font-bold text-ink-mid"
              title="当前规则的结果和当天的实际结果不一致"
            >
              当天{entry.published ? "发布" : "未发"} ⚠
            </span>
          ) : null}
        </div>
      </div>

      {/**
       * The five dimensions and the sentence each one wrote.
       *
       * A GRID RATHER THAN A ROW OF NUMBERS. The numbers alone are on the
       * overview; what is here that is nowhere else is `ScoreFinding.note`, and a
       * note is a sentence — so each dimension gets a line of its own and the
       * numbers stay in a column you can read down.
       *
       * A dimension under the per-dimension floor is marked, because that is the
       * one number on the card that can single-handedly explain the verdict.
       */}
      {entry.review ? (
        <dl className="mt-3 flex flex-col gap-1.5 border-t border-line pt-3">
          {SCORE_DIMENSIONS.map((dimension) => {
            const finding = entry.review![dimension];
            const weak = finding.score < MIN_PER_DIMENSION;
            return (
              <div className="flex gap-3 text-sm" key={dimension}>
                <dt className="flex w-28 flex-none items-baseline justify-between gap-2">
                  <span className="text-xs font-bold text-ink-soft">
                    {dimension}
                  </span>
                  <span
                    className={`font-bold tabular-nums ${
                      weak ? "text-ink" : "text-ink-mid"
                    }`}
                  >
                    {finding.score}
                    {weak ? " ⚠" : ""}
                  </span>
                </dt>
                <dd className="min-w-0 flex-1 text-ink-mid">{finding.note}</dd>
              </div>
            );
          })}
        </dl>
      ) : (
        <p className="mt-3 border-t border-line pt-3 text-sm text-ink-soft">
          这一篇没有 review —— 打分那一轮没有为它给出答案，分数记为{" "}
          {num(entry.score, 0)}。
        </p>
      )}
    </article>
  );
}
