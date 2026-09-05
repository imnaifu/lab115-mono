import {
  BarRows,
  DayColumns,
  FloorCurve,
  Histogram,
  Legend,
  SourceScatter,
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
  Row,
  SampleSize,
  StatTile,
  Table,
} from "./AdminShell";
import { SortableTable } from "./SortableTable";
import { PUBLISH_MIN_SCORE } from "@/lib/categories";
import { MODEL } from "@/lib/config";
import { adminDayPath } from "@/lib/links";
import { MIN_PER_DIMENSION, SCORE_MAX } from "@/lib/score";
import { PUBLISH_PER_SOURCE } from "@/lib/sources";
import {
  blockingDimensions,
  byDay,
  correlations,
  dimensionStats,
  floorCurve,
  gateBreakdown,
  humanEdits,
  judged,
  sourceRows,
} from "@/lib/stats";
import { allScored, listDates } from "@/lib/store";

/**
 * `/admin` — what the scorer has actually been doing, over the whole archive.
 *
 * THE PANELS ARE THE MEASUREMENTS THIS APP WAS TUNED BY, made standing. Every one
 * of them exists in the source already, as a paragraph of numbers in a comment:
 * the 7→5 dimension merge in lib/score.ts, the flash-versus-pro table in
 * lib/config.ts, the `MIN_PER_DIMENSION` 5-not-6 argument, the floor's effect.
 * Each was computed once, in a script, against whatever the archive held that
 * week — and each is the kind of thing that goes stale the next time the model or
 * the rubric moves. That is the whole reason for the page: the comments record
 * what was true when a decision was made, and this says whether it still is.
 *
 * IT WAS TABLES, AND THE TABLES ARE STILL HERE. The first version of this page
 * was eight of them, and a column of numbers is the wrong instrument for every
 * question on it: whether the model uses the top of its range is a SHAPE, whether
 * the floor is worth moving is a SLOPE, and which sources earn their slot is a
 * POSITION in two dimensions. Each panel now leads with the form that answers its
 * question and keeps the table underneath — every value stays readable as text,
 * which is what makes the charts free to be charts rather than the only way to
 * read a number.
 *
 * IT READS THE ARCHIVE ON EVERY REQUEST, uncached. See `allScored`.
 */
export async function AdminOverview() {
  const [entries, dates] = await Promise.all([allScored(), listDates()]);
  const scored = judged(entries);
  const dims = dimensionStats(entries);
  const gate = gateBreakdown(entries);
  const actuallyPublished = entries.filter((entry) => entry.published).length;
  const edits = humanEdits(entries);
  const blocking = blockingDimensions(entries);
  const rows = sourceRows(entries);
  const curve = floorCurve(entries);
  const pairs = correlations(entries);

  /** Oldest day first, so time runs left to right like every other time axis. */
  const days = [...byDay(entries).entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, group]) => ({
      date,
      considered: group.length,
      published: group.filter((entry) => entry.published).length,
    }));
  const busiest = days.reduce(
    (best, day, at) => (day.considered > days[best].considered ? at : best),
    0,
  );

  return (
    <AdminShell
      title="打分数据"
      meta={
        `模型 ${MODEL} · 总分门槛 ${PUBLISH_MIN_SCORE}/${SCORE_MAX} · ` +
        `单维下限 ${MIN_PER_DIMENSION} · 每源每天 ${PUBLISH_PER_SOURCE} 篇`
      }
      nav={
        <>
          <AdminLink href="/admin" current>
            总览
          </AdminLink>
          {dates.slice(0, 5).map((date) => (
            <AdminLink href={adminDayPath(date)} key={date}>
              {date.slice(5)}
            </AdminLink>
          ))}
        </>
      }
    >
      {/* The headline four. Tiles rather than charts — there is nothing to
          compare each against, so the number is the chart. */}
      <KpiRow>
        <StatTile label="天数" value={dates.length} />
        <StatTile label="经过评分" value={entries.length} note="含被挡下的" />
        <StatTile label="实际发布" value={actuallyPublished} />
        <StatTile
          label="通过率"
          value={pct(entries.length ? actuallyPublished / entries.length : 0)}
          note={`按当前规则重放 ${pct(gate.total ? gate.published / gate.total : 0)}`}
        />
      </KpiRow>

      <Panel
        title="每天的产出"
        note="发布的和被挡下的，叠在一起就是那天抓了多少。点任一根柱子进那一天。"
      >
        <DayColumns
          data={days.map((day) => ({
            date: day.date,
            tick: day.date.slice(5),
            published: day.published,
            blocked: day.considered - day.published,
            href: adminDayPath(day.date),
          }))}
        />
        <Legend
          items={[
            { tone: "accent", label: "发布" },
            { tone: "mute", label: "被挡下" },
          ]}
        />
      </Panel>

      <Panel
        title="五维分布"
        note={
          <>
            每一维 1-10，五维等权相加。
            <strong className="font-bold text-ink-mid">
              形状比均值重要
            </strong>
            —— rubric 两次要求用满 1-10，模型是不是真的用了，只有分布看得出来；
            config.ts 里那条结论（flash 一次 9 都没给过，分数全堆在 30-38）就是这个。
            浅色的那几档在单维下限 {MIN_PER_DIMENSION} 以下 —— 落在那里的分数会单独
            把文章挡掉。五张图共用一个纵轴，所以可以横向比。{" "}
            <SampleSize n={scored.length} />
          </>
        }
      >
        {/* Small multiples: one shared y-scale across all five, or the shapes
            cannot be compared — which is the only reason to put them together. */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dims.map((dim) => {
            const peak = Math.max(...dims.flatMap((each) => each.histogram));
            return (
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
                  buckets={dim.histogram.map((count, at) => ({
                    bucket: String(at + 1),
                    count,
                  }))}
                />
              </div>
            );
          })}
        </div>
        <Legend
          items={[
            { tone: "cool", label: `≥ ${MIN_PER_DIMENSION}，可以过` },
            { tone: "mute", label: `< ${MIN_PER_DIMENSION}，单独就能挡掉` },
          ]}
        />
      </Panel>

      <Panel
        title="维度相关性"
        note={
          <>
            五维如果两两高相关，就是同一个问题问了五遍，「等权」于是名不副实。
            score.ts 里 7→5 的合并就是按这个做的，而那条注释自己承认合并之后
            substance↔surprise 又回到了 0.91。竖线是 0.8 —— 越过它的那几对染成强调色。
            accessible 与其余的低相关是 rubric 里唯一真正独立的一维，它要是爬上去了，
            rubric 就已经坍缩成单一轴了。 <SampleSize n={scored.length} />
          </>
        }
      >
        <BarRows
          labelWidth={168}
          maxValue={1}
          height={pairs.length * 26 + 44}
          threshold={{ at: 0.8, label: "0.8" }}
          rows={pairs.map((pair): BarRowDatum => ({
            label: `${pair.a} × ${pair.b}`,
            value: pair.r,
            tone: Math.abs(pair.r) >= 0.8 ? "accent" : "cool",
            note: num(pair.r, 3),
          }))}
        />
      </Panel>

      <Panel
        title="四道门的去处"
        note={
          <>
            按<strong className="font-bold text-ink-mid">当前</strong>
            配置把整个归档重放一遍。四道门修的地方不一样 —— 门槛改 config.json，
            单维弱要去和 rubric 吵，配额是 PUBLISH_PER_SOURCE，而「没打分」根本不是
            判断，是模型调用失败。重放得 {gate.published} 篇，归档里实际发布{" "}
            {actuallyPublished} 篇：差额是历史，那些天是按当时的门槛和 rubric 发的。
          </>
        }
      >
        <BarRows
          labelWidth={140}
          integer
          maxValue={gate.total}
          height={5 * 26 + 44}
          rows={(
            [
              ["发布", gate.published, "accent"],
              [`总分未过 ${PUBLISH_MIN_SCORE}`, gate.underFloor, "mute"],
              ["被每源配额挡下", gate.quota, "mute"],
              [`有一维低于 ${MIN_PER_DIMENSION}`, gate.underDimension, "mute"],
              ["从未打分", gate.unscored, "mute"],
            ] as [string, number, MarkTone][]
          )
            .sort((a, b) => b[1] - a[1])
            .map(([label, count, tone]): BarRowDatum => ({
              label,
              value: count,
              tone,
              note: `${count} · ${pct(gate.total ? count / gate.total : 0)}`,
            }))}
        />
      </Panel>

      <Panel
        title="是哪一维在挡"
        note={
          <>
            总分过了、却被单维下限挡下的那些文章，各维各挡了几篇。把
            MIN_PER_DIMENSION 定在 5 而不是 6 的那次测算就是看这个：6 的时候挡人的是
            substance 和 relevance 而不是 accessible，而这两维的 5-6 档在 rubric 里
            写的就是「普通的好文章」。一篇可能同时低于多维，各维都记一次。
          </>
        }
      >
        <BarRows
          labelWidth={110}
          integer
          maxValue={Math.max(...blocking.map((row) => row.n), 1)}
          height={blocking.length * 26 + 44}
          rows={blocking.map((row): BarRowDatum => ({
            label: row.dimension,
            value: row.n,
            /* `cool`, NOT the accent. The tokens fix accent to mean 发布/通过 —
               see index.css — and these bars count the opposite: how many
               articles each dimension STOPPED. */
            tone: row.n > 0 ? "cool" : "mute",
            note: String(row.n),
          }))}
        />
      </Panel>

      <Panel
        title="门槛敏感性"
        note={
          <>
            每个候选门槛下会发布多少篇 —— 其余三道门按现状固定。竖线是当前的{" "}
            {PUBLISH_MIN_SCORE}。
            <strong className="font-bold text-ink-mid">这是模型，不是历史</strong>
            ：没被摘要过的文章没有 take，真按低门槛发是要额外付一次模型调用的；而归档
            里本来就只有 COLLECT_PER_SOURCE 放进来的那些，降门槛救不回在打分之前就被
            截掉的。
          </>
        }
      >
        <FloorCurve marker={PUBLISH_MIN_SCORE} points={curve} />
      </Panel>

      <Panel
        title="每个源：均分 × 产量"
        note={
          <>
            横轴是这个源经过评分的篇数，纵轴是它的平均总分，横线是门槛{" "}
            {PUBLISH_MIN_SCORE}。
            <strong className="font-bold text-ink-mid">
              线下方且靠右的那些是在花钱不出活
            </strong>
            —— 每天抓正文、打分，平均分却在门槛之下。只标了产量最高的几个，其余悬停可看，
            全部数字在下面的表里。
          </>
        }
      >
        <SourceScatter
          rule={PUBLISH_MIN_SCORE}
          points={rows.map((row) => ({
            name: row.name,
            considered: row.considered,
            mean: row.meanScore,
            published: row.published,
            rate: row.rate,
          }))}
        />
        <Legend items={[{ label: `门槛 ${PUBLISH_MIN_SCORE}` }]} />

        <div className="mt-4">
          {/**
           * THE ONE SORTABLE TABLE ON THE PAGE — see SortableTable.tsx for why it
           * is a separate client component and why the other tables are not.
           *
           * It earns the interaction because the question it answers is a
           * different sort each time it is asked: "which source is costing the
           * most for nothing" is 经过 descending against 发布率 ascending, and
           * "which brings the best writing" is 均分 descending. Fixed at volume
           * order — which is still what it opens in — only the first of those is
           * readable without counting down the column by eye.
           *
           * `sort` CARRIES THE RAW NUMBER AND `text` THE FORMATTED ONE, which is
           * the whole reason this takes data instead of cells: 发布率 shows `42%`
           * and must order on `0.42`, and 均分 shows one decimal but must not tie
           * every source that agrees to one decimal.
           */}
          <SortableTable
            columns={[
              { key: "name", label: "源" },
              { key: "considered", label: "经过", numeric: true },
              { key: "published", label: "发布", numeric: true },
              { key: "rate", label: "发布率", numeric: true },
              { key: "mean", label: "均分", numeric: true },
              { key: "best", label: "最高", numeric: true },
            ]}
            rows={rows.map((row) => ({
              id: row.sourceId,
              sort: {
                name: row.name,
                considered: row.considered,
                published: row.published,
                rate: row.rate,
                mean: row.meanScore,
                best: row.bestScore,
              },
              text: {
                name: row.name,
                considered: String(row.considered),
                published: String(row.published),
                rate: pct(row.rate),
                mean: num(row.meanScore, 1),
                best: String(row.bestScore),
              },
              ...(row.alwaysPublish ? { note: "白名单" } : {}),
            }))}
          />
          <p className="mt-2 max-w-prose text-xs text-ink-soft">
            点表头按那一列排序，再点一次反向 —— 开着的是产量序。发布率不是质量分：
            每源每天上限 {PUBLISH_PER_SOURCE} 篇，产量高的源再好
            也高不了。发布率要对着「经过」看，质量看均分。
          </p>
        </div>
      </Panel>

      <Panel
        title="人工改分"
        note="读的是 scoredBy 而不是 score ≠ modelScore —— 早期六天没写 modelScore，那个比较分不出「没人动过」和「本来就没有基线」。"
      >
        {edits.length === 0 ? (
          <p className="rounded-card border border-line bg-page-deep px-4 py-3 text-sm text-ink-mid">
            没有任何一篇被手工改过分。
          </p>
        ) : (
          <Table head={["日期", "标题", "模型", "改后", "差"]}>
            {edits.map((edit) => (
              <Row
                key={`${edit.date}-${edit.url}`}
                cells={[
                  edit.date,
                  <span key="t" className="font-medium text-ink-mid">
                    {edit.title}
                  </span>,
                  num(edit.modelScore, 0),
                  edit.score,
                  edit.delta === null
                    ? "—"
                    : `${edit.delta > 0 ? "+" : ""}${edit.delta}`,
                ]}
              />
            ))}
          </Table>
        )}
      </Panel>

      <Panel title="每一天" note="每篇的五维分数、每维那句 note，以及被哪道门挡下。">
        <div className="flex flex-wrap gap-2">
          {dates.map((date) => (
            <AdminLink href={adminDayPath(date)} key={date}>
              {date}
            </AdminLink>
          ))}
        </div>
      </Panel>
    </AdminShell>
  );
}
