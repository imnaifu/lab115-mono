#!/usr/bin/env python3
"""Writes scripts/achievement_rates.gd: how many players have each achievement, from the live
run data, for the 收藏 page's 成就 tab ("12% 的玩家达成"). Run it before each release:

    python3 tools/achievement_rates.py

It reads the self-hosted Umami (stats.lab115.com) through the read-only query helper on this
machine (~/.claude/bin/umami-readonly-query, or $UMAMI_QUERY), which goes over SSH to the
database; nothing else needs it, and the game only ever sees the numbers written here.

No device id goes out with the run data, but none is needed: each device earns an achievement
once, in one run, whose run_end lists it in `new_achievements` (from .19). So the devices that
earned X are the distinct runs listing it, and the players are those that earned 第一天上班
(first_day, every finished run's first). A run can be sent twice (page closed mid-run, see
telemetry.gd), hence distinct run ids. Clearing the browser's data makes a returning player count
as new.
"""
import json
import os
import pathlib
import subprocess

GAME = pathlib.Path(__file__).resolve().parent.parent
OUT = GAME / "scripts" / "achievement_rates.gd"
QUERY = os.environ.get("UMAMI_QUERY", str(pathlib.Path.home() / ".claude" / "bin" / "umami-readonly-query"))
WEBSITE = "9964fbf9-2ee4-4776-b017-ee567f898758"

SQL = f"""
with ends as (
  select distinct r.string_value as run, a.string_value as earned
  from website_event e
  join event_data r on r.website_event_id = e.event_id and r.data_key = 'run'
  join event_data a on a.website_event_id = e.event_id and a.data_key = 'new_achievements'
  where e.website_id = '{WEBSITE}' and e.event_name = 'run_end' and a.string_value <> ''
), items as (
  select distinct run, unnest(string_to_array(earned, ',')) as id from ends
)
select coalesce(json_object_agg(id, runs), '{{}}') from (
  select id, count(distinct run) as runs from items group by id order by id
) counts;
"""


def main() -> None:
    output = subprocess.run([QUERY, SQL], check=True, capture_output=True, text=True).stdout
    # psql prints a table round the one JSON value.
    line = next(row.strip() for row in output.splitlines() if row.strip().startswith("{"))
    unlocks: dict[str, int] = json.loads(line)
    players = unlocks.get("first_day", 0)
    entries = ", ".join(f'"{key}": {unlocks[key]}' for key in sorted(unlocks))
    OUT.write_text(
        "class_name AchievementRates\n"
        "extends RefCounted\n"
        "## Written by tools/achievement_rates.py from the live run data; run it again rather than\n"
        "## editing. PLAYERS have finished a run (earned first_day); UNLOCKS is, per achievement,\n"
        "## how many of them have earned it.\n"
        "\n"
        f"const PLAYERS := {players}\n"
        f"const UNLOCKS := {{{entries}}}\n"
    )
    print(f"{players} players; {len(unlocks)} achievements earned by anyone; wrote {OUT.relative_to(GAME)}")


if __name__ == "__main__":
    main()
