"""The balance formula (DESIGN.md 2.8, .72): predicts a run's chance of lasting the ten minutes from the
game's own numbers, so a change to them can be judged before it ships.

    godot --headless --path . -s tools/dump_compendium.gd -- /tmp/compendium.json
    python3 tools/balance.py /tmp/compendium.json

The formula's shape is fixed (the user, .72: 把公式固定，后面调整都只调整参数，不动公式). Only PARAMS
change, and only when they are measured again (tests/balance_bot.gd); a new mechanic is first turned
into one of the inputs below (DESIGN.md 2.8's 换算表), never a new term.

    logit(通关率) = β0 + β_off · ln(输出比) + β_def · ln(承伤比) + β_armor · Δ护甲 + β_speed · Δ移速 / 10

    输出比 = (伤害 ÷ 冷却) ÷ (10:00 怪物生命倍率 × 地图生命 ÷ 3.5 × (刷怪倍率)^s)
    承伤比 = (生命 + k · 每秒回血 · 600) ÷ 100 ÷ 地图伤害

Everything is measured against the reference: 硅谷, no landmarks or 培训, a 10:00 enemy-health
multiplier of 3.5 and the spawn rate of when PARAMS were measured, the five jobs averaged (their own
health, armour and speed as they are). Δ护甲 and Δ移速 are against the jobs' average.
"""

import json
import math
import sys

# NOTE (.72): being calibrated; until DESIGN.md 2.8 says otherwise these are the .53 formula's numbers
# and beta0 is a placeholder.
# Measured by the balance bot (tests/balance_bot.gd: knows the cards, dodges the red shapes, goes for
# stars; 硅谷, the five jobs alike). Each with where it came from; change one only with a new
# measurement, and note it in DESIGN.md 2.8.
PARAMS = {
    # logit of the reference's pass rate.
    "beta0": 0.0,
    # Per unit of ln(输出比): from enemy health ×1.4 (and checked against player damage +40%).
    "beta_off": 4.3,
    # Per unit of ln(承伤比): from enemy damage ×1.4 (and checked against health +40).
    "beta_def": 3.1,
    # Per point of armour, and per 10 of move speed.
    "beta_armor": 0.25,
    "beta_speed": 0.70,
    # How much of the spawn rate counts as enemy health: 1 = twice the spawns as hard as twice the health.
    "s": 1.0,
    # The share of a run's regeneration (每秒回血 × 600 s) that counts as health.
    "k": 0.5,
    # Where the reference stood when PARAMS were measured.
    "ref_hp_at_10": 3.5,
    "ref_spawn_at_10": 5.8,
}


def logistic(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def predict(stats: dict, job_avg: dict, pacing: dict, difficulty: dict, params: dict = PARAMS) -> float:
    """The pass rate for a player with `stats` (the dump's Player numbers, before the job's) on a map
    of `difficulty`, the jobs averaged."""
    p = params
    last = pacing["minutes"][-1]
    enemy_hp = last["hp"] * difficulty["hp"] / p["ref_hp_at_10"]
    spawn = last["rate"] * difficulty["spawn"] / p["ref_spawn_at_10"]
    output = stats["might"] / stats["cooldown_scale"] / (enemy_hp * spawn ** p["s"])
    # The job's own health is 100 for all of them; training and landmarks add to it.
    health = job_avg["hp"] - 100.0 + stats["max_hp"] + p["k"] * stats["regen"] * 600.0
    survive = health / 100.0 / difficulty["damage"]
    # Speed: the job's own times what the landmarks and 培训 multiply it by (they start from 62).
    speed_gain = job_avg["speed"] * (stats["move_speed"] / 62.0 - 1.0)
    logit = (p["beta0"] + p["beta_off"] * math.log(output) + p["beta_def"] * math.log(survive)
             + p["beta_armor"] * stats["armor"] + p["beta_speed"] * speed_gain / 10.0)
    return logistic(logit)


def main(path: str) -> None:
    data = json.load(open(path, encoding="utf-8"))
    jobs = data["jobs"]
    job_avg = {key: sum(job[key] for job in jobs) / len(jobs) for key in ("hp", "speed", "armor")}
    stats = data["stats"]
    pacing = data["pacing"]
    print(f"version {data['version']}  ·  10:00 怪物生命 ×{pacing['minutes'][-1]['hp']}  刷怪 {pacing['minutes'][-1]['rate']}/秒")
    print("PARAMS " + ", ".join(f"{key}={value}" for key, value in PARAMS.items()))
    profiles = ["新手", "培训各 1 级", "本图打卡 5/5", "培训练满", "全打卡 + 练满"]
    print(f"\n{'地图':6}" + "".join(f"{name:>14}" for name in profiles))
    for game_map in data["maps"]:
        rows = {
            "新手": stats["start"],
            "培训各 1 级": stats["training_one"],
            "本图打卡 5/5": stats["map_stamps"][game_map["id"]],
            "培训练满": stats["all_training"],
            "全打卡 + 练满": combine(stats["start"], stats["all_stamps"], stats["all_training"]),
        }
        cells = "".join(f"{predict(rows[name], job_avg, pacing, game_map['difficulty']):>14.0%}" for name in profiles)
        print(f"{game_map['name']:6}{cells}")


def combine(start: dict, *bonuses: dict) -> dict:
    """Stats with several sets of bonuses together: additive ones add up, multipliers multiply."""
    combined = dict(start)
    for bonus in bonuses:
        for key in ("max_hp", "armor", "regen", "luck", "might", "pickup_radius"):
            combined[key] += bonus[key] - start[key]
        for key in ("cooldown_scale", "move_speed"):
            combined[key] *= bonus[key] / start[key]
    return combined


if __name__ == "__main__":
    main(sys.argv[1])
