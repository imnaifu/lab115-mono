import { notFound } from "next/navigation";
import {
  BarRows,
  Histogram,
  Legend,
  type BarRowDatum,
  type MarkTone,
} from "./AdminChart";
import {
  AdminLink,
  AdminShell,
  KpiRow,
  num,
  Panel,
  pct,
  SampleSize,
  StatTile,
} from "./AdminShell";
import { PUBLISH_MIN_SCORE } from "@/lib/categories";
import { ADMIN_PATH, adminDayPath } from "@/lib/links";
import { MIN_PER_DIMENSION, SCORE_DIMENSIONS, SCORE_MAX } from "@/lib/score";
import { sourceOf } from "@/lib/sources";
import {
  blockingDimensions,
  dimensionStats,
  entryKey,
  judged,
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

  /**
   * Every outcome once, in the order the charts and the cards below both use.
   *
   * READ OFF `outcomes` RATHER THAN RECOMPUTED. `gateBreakdown` in lib/stats
   * answers the same question, but calling it here would replay the whole
   * archive a second time to keep five numbers for one day — and, worse, would
   * be a second code path that could drift from the verdict badge on the cards.
   * One map, one set of answers.
   */
  const dayOutcomes = sorted.map(
    (entry) => outcomes.get(entryKey(entry)) ?? "unscored",
  );
  const countOutcome = (outcome: GateOutcome) =>
    dayOutcomes.filter((each) => each === outcome).length;
  const wouldPublish = countOutcome("published");

  /**
   * The scores the model actually answered for — see `judged`. An unscored entry
   * carries 0, and averaging those in reports a failed model call as a bad day.
   */
  const scores = judged(day).map((entry) => entry.score);
  const meanScore = scores.length
    ? scores.reduce((sum, score) => sum + score, 0) / scores.length
    : 0;
  const bestScore = scores.length ? Math.max(...scores) : 0;

  const dims = dimensionStats(day);
  /** The shared y for the five small multiples. `1` so an empty day still
   *  produces a usable scale rather than a zero-height domain. */
  const peak = Math.max(...dims.flatMap((dim) => dim.histogram), 1);

  /**
   * The per-dimension blocking, for THIS DAY.
   *
   * `blockingDimensions` takes any entry array and its gate is per-day already,
   * so handing it `day` gives exactly what handing it the archive and filtering
   * would — the same argument as `outcomes` above, in the other direction.
   */
  const blocking = blockingDimensions(day);
  // A single article can be under on several dimensions and is counted under
  // each, so this is a tally of marks, not of articles — which is why it is only
  // used to decide whether there is anything to draw.
  const blockingMarks = blocking.reduce((sum, row) => sum + row.n, 0);

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
       * The day's headline four.
       *
       * NONE OF THEM REPEATS THE META LINE above, which already carries 抓取,
       * 发布, the window and the run time. What is here that is nowhere else is
       * the pair of counts that disagree — what this day published against what
       * today's rules would publish — and the shape of the scores behind them.
       */}
      <KpiRow>
        <StatTile label="经过评分" value={sorted.length} note="含被挡下的" />
        <StatTile
          label="实际发布"
          value={digest.stats.shown}
          note={`按当前规则重放 ${wouldPublish}`}
        />
        <StatTile
          label="均分"
          value={num(meanScore, 1)}
          note={`满分 ${SCORE_MAX} · 门槛 ${PUBLISH_MIN_SCORE}`}
        />
        <StatTile label="最高分" value={bestScore} note="当天的天花板" />
      </KpiRow>

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

      {/**
       * THE CHARTS, and only when there is something to plot.
       *
       * `sorted.length` is 0 for a digest whose scoring pass never produced a
       * file — rare, but it makes `maxValue` zero, which is a degenerate linear
       * scale and draws NaN-wide bars rather than an empty chart. The list panel
       * below already says "0 篇经过评分", which is the honest thing to show.
       */}
      {sorted.length > 0 ? (
        <>
          <Panel
            title="每篇的总分"
            note={
              <>
                按总分从高到低，满分 {SCORE_MAX}，每条上的竖线是门槛{" "}
                {PUBLISH_MIN_SCORE}。
                <strong className="font-bold text-ink-mid">
                  越过竖线却仍是浅色的那几条
                </strong>
                ，是总分够了、被别的门挡下的 —— 单维下限或每源配额。是哪一道，
                看下面两张图，或每篇卡片上的「结果」。标题是中文的那些就是发过的：
                中文标题由摘要那一轮写，没发的从来没进过摘要。
              </>
            }
          >
            {/**
             * HTML ROWS, NOT A NIVO CHART, and the headline is why.
             *
             * A Nivo axis label is an SVG `<text>`, and SVG text does not wrap —
             * so a full headline in the gutter means hand-splitting it into
             * `<tspan>`s AND giving every row the height of the longest one,
             * because a band scale has one height for all of them. Truncating
             * instead is what this panel did first, and a column of
             * `11. Caterpillar twitch…` is a column you cannot read.
             *
             * In HTML the title just wraps and the row grows. That is the whole
             * argument: this panel is a LIST WITH BARS, not a chart, and the one
             * thing the chart library was buying here — a tick algorithm for an
             * axis — is worth less than the headline being legible.
             *
             * The other two bar charts on this page stay on Nivo: their labels
             * are one short phrase and none of this applies.
             */}
            <div className="rounded-card border border-line">
              {sorted.map((entry, rank) => (
                <ScoreRow
                  entry={entry}
                  key={entryKey(entry)}
                  published={dayOutcomes[rank] === "published"}
                  rank={rank + 1}
                />
              ))}
            </div>
            <Legend
              items={[
                { tone: "accent", label: "按当前规则会发" },
                { tone: "mute", label: "被挡下" },
                { label: `门槛 ${PUBLISH_MIN_SCORE}` },
              ]}
            />
          </Panel>

          <Panel
            title="这一天的四道门"
            note={
              <>
                当天每篇的去处，按
                <strong className="font-bold text-ink-mid">当前</strong>
                规则重算。四道门要修的地方不一样：门槛在 config.json，单维弱是去和
                rubric 吵，配额是 PUBLISH_PER_SOURCE，而「从未打分」根本不是判断，
                是模型调用失败。
              </>
            }
          >
            <BarRows
              labelWidth={140}
              integer
              maxValue={sorted.length}
              height={5 * 26 + 44}
              rows={(
                [
                  ["发布", "published", "accent"],
                  [`总分未过 ${PUBLISH_MIN_SCORE}`, "under-floor", "mute"],
                  ["被每源配额挡下", "quota", "mute"],
                  [`有一维低于 ${MIN_PER_DIMENSION}`, "under-dimension", "mute"],
                  ["从未打分", "unscored", "mute"],
                ] as [string, GateOutcome, MarkTone][]
              )
                .map(([label, outcome, tone]) => ({
                  label,
                  tone,
                  n: countOutcome(outcome),
                }))
                .sort((a, b) => b.n - a.n)
                .map(
                  ({ label, tone, n }): BarRowDatum => ({
                    label,
                    value: n,
                    tone,
                    note: `${n} · ${pct(n / sorted.length)}`,
                  }),
                )}
            />
          </Panel>

          <Panel
            title="今天是哪一维在挡"
            note={
              <>
                上面那道「有一维低于 {MIN_PER_DIMENSION}」再往下钻一层：总分过了、
                却被单维下限挡下的那些，各维各挡了几篇。一篇可能同时低于多维，
                各维都记一次，所以这里的和是记号数，不是文章数。{" "}
                <SampleSize n={blockingMarks} />
              </>
            }
          >
            {/* An empty chart would be five zero-length bars, which reads as a
                broken panel rather than as a finding. The sentence is the
                finding, and it names where those articles went instead. */}
            {blockingMarks === 0 ? (
              <p className="rounded-card border border-line bg-page-deep px-4 py-3 text-sm text-ink-mid">
                今天没有文章是被单维下限挡下的 ——
                被挡下的都卡在总分或每源配额上。
              </p>
            ) : (
              <BarRows
                labelWidth={110}
                integer
                /* The DAY's max, not the archive's: scaled against the whole
                   archive a day's two or three would be a line of stubs. */
                maxValue={Math.max(...blocking.map((row) => row.n), 1)}
                height={blocking.length * 26 + 44}
                rows={blocking.map(
                  (row): BarRowDatum => ({
                    label: row.dimension,
                    /* `cool`, never the accent — these bars count what each
                       dimension STOPPED, the opposite of what accent means. */
                    tone: row.n > 0 ? "cool" : "mute",
                    value: row.n,
                    note: String(row.n),
                  }),
                )}
              />
            )}
          </Panel>

          <Panel
            title="这一天的五维分布"
            note={
              <>
                当天每篇的五维打分落在哪一档 —— 和总览那张同构，但只看这一天，
                回答的是「今天模型给分的形状和平时一样吗」。浅色的几档在单维下限{" "}
                {MIN_PER_DIMENSION} 以下，落在那里的分数会单独把文章挡掉。
                五张图共用一个纵轴，可以横向比。
                <strong className="font-bold text-ink-mid">
                  一天只有几十篇，看形状，不要读单独一档
                </strong>
                。 <SampleSize n={dims[0]?.n ?? 0} />
              </>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {dims.map((dim) => (
                <div key={dim.dimension}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-bold text-ink">
                      {dim.dimension}
                    </span>
                    <span className="text-xs tabular-nums text-ink-soft">
                      x̄ {num(dim.mean)} · sd {num(dim.sd)} · 用到 {dim.min}-
                      {dim.max}
                    </span>
                  </div>
                  <Histogram
                    maxY={peak}
                    floorAt={MIN_PER_DIMENSION}
                    buckets={dim.histogram.map((count, bucket) => ({
                      bucket: String(bucket + 1),
                      count,
                    }))}
                  />
                </div>
              ))}
            </div>
            <Legend
              items={[
                { tone: "cool", label: `≥ ${MIN_PER_DIMENSION}，可以过` },
                { tone: "mute", label: `< ${MIN_PER_DIMENSION}，单独就能挡掉` },
              ]}
            />
          </Panel>
        </>
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

/**
 * The headline this page shows for an entry: the Chinese one where the
 * summarise pass wrote one, empty otherwise.
 *
 * Empty rather than falling back to the original, because both callers need to
 * know WHICH they got: the chart puts the original on a second line only when
 * there is a first line, and the card does the same. See `titleZh` on
 * `ScoredEntry` for why it is missing on exactly the blocked articles.
 */
function chineseTitle(entry: ScoredEntry): string {
  return entry.titleZh?.trim() ?? "";
}

/**
 * One row of 每篇的总分: the rank, the headline in full, a bar, and the score.
 *
 * THE BAR IS THE NARROW COLUMN AND THE TITLE IS THE WIDE ONE, which is the
 * opposite of how a bar chart allocates its width and is right here. A score out
 * of 50 needs only enough length to be compared with the row above it and with
 * the floor; a headline needs as much room as it needs. So the bar is a fixed
 * column and the title takes everything that is left, wrapping freely.
 *
 * THE FLOOR IS A LINE INSIDE THE BAR, at its own fraction of the scale. It is
 * what makes the column readable at a glance: everything reaching past it scored
 * enough, and the ones past it that are still muted are the articles some OTHER
 * gate stopped — which is the finding this panel exists for.
 *
 * The colours are the chart tokens rather than the ink ones, so this reads as
 * part of the same set as the two Nivo charts under it. `--chart-accent` means
 * 发布 everywhere on this page; see index.css.
 */
function ScoreRow({
  entry,
  published,
  rank,
}: {
  entry: ScoredEntry;
  /** Under TODAY'S rules — the same split the two charts below colour by. */
  published: boolean;
  rank: number;
}) {
  const zh = chineseTitle(entry);
  const source = sourceOf(entry.sourceId);
  const width = Math.max(0, Math.min(100, (entry.score / SCORE_MAX) * 100));

  return (
    <div className="flex items-start gap-3 border-b border-line px-4 py-2.5 last:border-0 sm:gap-4">
      <span className="w-6 flex-none pt-0.5 text-right text-xs font-bold tabular-nums text-ink-soft">
        {rank}
      </span>

      {/**
       * THE TITLE BLOCK: the translation, the original, and where it came from.
       *
       * BOTH HEADLINES, which is the same call `ArticleTitle` makes on the site's
       * Chinese side and for the reason stated there — a headline is a NAME, so
       * the translation carries what the piece says and the original is what it
       * is called. On a blocked article there is no translation, so the original
       * is the only line and the source sits straight under it.
       *
       * `min-w-0` or a long unbroken token — a URL in a headline — would push the
       * bar column off the row instead of wrapping.
       */}
      <span className="min-w-0 flex-1">
        <span className="block text-sm leading-snug text-ink">
          {zh || entry.title}
        </span>
        {zh ? (
          <span className="mt-0.5 block text-xs leading-snug text-ink-soft">
            {entry.title}
          </span>
        ) : null}
        {/* The source last and quietest: it is what you check AFTER the headline
            has told you whether you care. Same placement as on the cards below,
            so the two lists read the same way. */}
        <span className="mt-1 block text-xs text-ink-soft">{source.name}</span>
      </span>

      {/* The scale, and the floor drawn across it. `relative` so the tick can be
          positioned as a percentage of the same 0-50 the bar is drawn on. */}
      <span className="relative hidden w-32 flex-none self-center sm:block lg:w-40">
        <span className="block h-2 w-full overflow-hidden rounded-full bg-page-deep">
          <span
            className="block h-full rounded-full"
            style={{
              background: published
                ? "var(--chart-accent)"
                : "var(--chart-mute)",
              width: `${width}%`,
            }}
          />
        </span>
        {/**
         * THE FLOOR, AS A TICK THAT CROSSES THE WHOLE BAR — a sibling of the
         * track rather than a child of it, and that placement is the point.
         *
         * Inside the track it was clipped by the `overflow-hidden` that rounds
         * the fill, so it could only ever be a hairline drawn over the fill in a
         * soft ink — invisible against the accent on exactly the rows where it
         * matters most, the ones that cleared it. Outside, it can overhang top
         * and bottom and take a stronger ink, so the same mark reads on the
         * filled part, on the empty part, and on both themes.
         */}
        <span
          className="absolute -top-0.5 -bottom-0.5 w-px bg-ink-mid"
          style={{ left: `${(PUBLISH_MIN_SCORE / SCORE_MAX) * 100}%` }}
        />
      </span>

      <span className="w-7 flex-none pt-0.5 text-right text-sm font-bold tabular-nums text-ink">
        {entry.score}
      </span>
    </div>
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
  const zh = chineseTitle(entry);

  return (
    <article className="rounded-card border border-line bg-paper px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0 flex-1">
          {/**
           * THE CHINESE HEADLINE, WITH THE ORIGINAL UNDER IT — the same two-line
           * shape `ArticleTitle` uses on the site's Chinese side, and for the
           * same reason stated there: a headline is a NAME, so the translation
           * carries what the piece says and the original is what it is called
           * and searched for. This page has one Chinese reader (see ADMIN_PATH),
           * which is what makes the translated line the one on top.
           *
           * BOTH LINES INSIDE THE `<a>`, so the whole title block opens the
           * article rather than only its first line.
           *
           * A blocked article shows one line, the original, because there is no
           * translation to show — see `chineseTitle`.
           */}
          <a
            className="text-base font-bold text-ink"
            href={entry.url}
            /* An admin page linking out to sixty different blogs is the one
               place `noreferrer` is right: these are not editorial links and
               there is no reason to announce where the visit came from. */
            rel="noreferrer"
          >
            {zh || entry.title}
            {zh ? (
              /* `font-medium` against the heading's bold and one step down in
                 size: the original is here to be recognised, not to compete with
                 the line that carries the meaning. `break-words` because a
                 headline can hold a URL-like token that would widen the card. */
              <span className="mt-1 block text-sm font-medium break-words text-ink-soft">
                {entry.title}
              </span>
            ) : null}
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
