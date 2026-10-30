class_name AchievementRates
extends RefCounted
## Written by tools/achievement_rates.py from the live run data; run it again rather than
## editing. PLAYERS have finished a run (earned first_day); UNLOCKS is, per achievement,
## how many of them have earned it.

const PLAYERS := 1
const UNLOCKS := {"first_boss": 1, "first_day": 1, "full_kit": 1, "untouched": 1}
