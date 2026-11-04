#!/usr/bin/env python3
"""Where players come from and whether they stay, per channel (.94, the money plan's R1: 每个渠道
带来多少设备、多少人第二天回来). Prints one table:

    python3 tools/channel_report.py            # installs first seen in the last 30 days
    python3 tools/channel_report.py --days 7

A channel is the `source` the page stamps on game_ready from .94 (telemetry.gd): the first
visit's ?from= (the links per channel are in apps/survivors/README.md), `ref:<host>` when a
page linked here without one, `direct`, or `old` for a browser that played before .94. An
install (`install`, a random id per browser) with no game_ready carrying a source shows as
`unknown`: mostly ones only seen before .94.

Per channel:
- 设备: installs first seen in the window.
- 次日回访: of those first seen at least a day ago, the share back the next day (UTC days).
- 7 日内回访: of those first seen at least 7 days ago, the share back on any of the 7 days after.
- 人均局数: distinct runs started (run_start) per install.
- 撑到 10:00: the share of runs that lasted 600 s or more (a run's longest run_end, as a run can
  arrive twice, telemetry.gd).
- 首局中位: the median length of each install's first run, in seconds.

It reads the self-hosted Umami (stats.lab115.com) through the read-only query helper on this
machine (~/.claude/bin/umami-readonly-query, or $UMAMI_QUERY), like achievement_rates.py.
Clearing the browser's data makes a returning player count as a new install of `direct`.
"""
import argparse
import json
import os
import pathlib
import subprocess

QUERY = os.environ.get("UMAMI_QUERY", str(pathlib.Path.home() / ".claude" / "bin" / "umami-readonly-query"))
WEBSITE = "9964fbf9-2ee4-4776-b017-ee567f898758"


def sql(days: int) -> str:
    return f"""
with ev as (
  select e.event_id, e.event_name, e.created_at, i.string_value as install
  from website_event e
  join event_data i on i.website_event_id = e.event_id and i.data_key = 'install'
  where e.website_id = '{WEBSITE}'
), installs as (
  select install, min(created_at) as first_at, min(created_at)::date as first_day
  from ev group by install
  having min(created_at) > now() - interval '{days} days'
), sources as (
  -- The page sets it once, so any game_ready's will do; the earliest to be sure.
  select distinct on (ev.install) ev.install, s.string_value as source
  from ev join event_data s on s.website_event_id = ev.event_id and s.data_key = 'source'
  where ev.event_name = 'game_ready'
  order by ev.install, ev.created_at
), active as (
  select distinct install, created_at::date as day from ev
), starts as (
  select ev.install, r.string_value as run, min(ev.created_at) as started_at
  from ev join event_data r on r.website_event_id = ev.event_id and r.data_key = 'run'
  where ev.event_name = 'run_start'
  group by ev.install, r.string_value
), lengths as (
  select r.string_value as run, max(sec.number_value) as seconds
  from website_event e
  join event_data r on r.website_event_id = e.event_id and r.data_key = 'run'
  join event_data sec on sec.website_event_id = e.event_id and sec.data_key = 'seconds'
  where e.website_id = '{WEBSITE}' and e.event_name = 'run_end'
  group by r.string_value
), firsts as (
  select distinct on (install) install, run from starts order by install, started_at
), per_install as (
  select i.install, coalesce(s.source, 'unknown') as source,
    i.first_day <= (now() at time zone 'utc')::date - 1 as day1_due,
    exists (select 1 from active a where a.install = i.install and a.day = i.first_day + 1) as day1_back,
    i.first_day <= (now() at time zone 'utc')::date - 7 as day7_due,
    exists (select 1 from active a where a.install = i.install and a.day between i.first_day + 1 and i.first_day + 7) as day7_back,
    (select count(*) from starts st where st.install = i.install) as runs,
    (select count(*) from starts st join lengths l on l.run = st.run where st.install = i.install and l.seconds >= 600) as long_runs,
    (select l.seconds from firsts f join lengths l on l.run = f.run where f.install = i.install) as first_seconds
  from installs i left join sources s on s.install = i.install
)
select coalesce(json_agg(row_to_json(t)), '[]') from (
  select source, count(*) as installs,
    count(*) filter (where day1_due) as day1_due, count(*) filter (where day1_due and day1_back) as day1_back,
    count(*) filter (where day7_due) as day7_due, count(*) filter (where day7_due and day7_back) as day7_back,
    sum(runs) as runs, sum(long_runs) as long_runs,
    percentile_cont(0.5) within group (order by first_seconds) as first_median
  from per_install group by source order by count(*) desc, source
) t;
"""


def share(part: int, whole: int) -> str:
    return f"{100 * part / whole:.0f}% ({part}/{whole})" if whole else "-"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--days", type=int, default=30, help="installs first seen in this many days (default 30)")
    args = parser.parse_args()
    output = subprocess.run([QUERY, sql(args.days)], check=True, capture_output=True, text=True).stdout
    # psql prints a table round the one JSON value.
    line = next(row.strip() for row in output.splitlines() if row.strip().startswith("["))
    rows: list[dict] = json.loads(line)
    header = ["渠道", "设备", "次日回访", "7 日内回访", "人均局数", "撑到 10:00", "首局中位"]
    table = [header]
    for row in rows:
        runs = int(row["runs"] or 0)
        median = row["first_median"]
        table.append([
            row["source"],
            str(row["installs"]),
            share(row["day1_back"], row["day1_due"]),
            share(row["day7_back"], row["day7_due"]),
            f"{runs / row['installs']:.1f}",
            share(int(row["long_runs"] or 0), runs),
            "-" if median is None else f"{median:.0f} 秒",
        ])
    if len(table) == 1:
        print(f"最近 {args.days} 天没有新设备")
        return
    widths = [max(_width(line[i]) for line in table) for i in range(len(header))]
    for line in table:
        print("  ".join(cell + " " * (widths[i] - _width(cell)) for i, cell in enumerate(line)))


def _width(text: str) -> int:
    # A CJK character takes two columns in a terminal.
    return sum(2 if ord(char) > 0x2E80 else 1 for char in text)


if __name__ == "__main__":
    main()
