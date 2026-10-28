class_name Difficulty
extends RefCounted
## The difficulty picked on the title screen. Players differ a lot (the live data had first runs
## dying at 1:39 next to second runs won at full health), and an open choice reads better than
## quietly tuning the run to how someone plays. "normal" is the balance the game was tuned at;
## the others scale it. Saved in Settings and sent with every run, so the data can be read per
## tier.

## `enemy_hp` / `boss_hp` scale health (bosses are the `elite` types), `damage` what hits the
## player, `spawn` the steady trickle, `ability_every` the gap between boss moves (above 1 is
## rarer), `max_bosses` how many bosses can be out before the next one waits.
const TIERS := {
	"intern": {"name": "实习生", "hint": "怪更脆、打人更轻，boss 最多同时 2 个",
		"enemy_hp": 0.7, "boss_hp": 0.6, "damage": 0.7, "spawn": 0.85, "ability_every": 1.3, "max_bosses": 2},
	"normal": {"name": "正式员工", "hint": "标准难度",
		"enemy_hp": 1.0, "boss_hp": 1.0, "damage": 1.0, "spawn": 1.0, "ability_every": 1.0, "max_bosses": 3},
	"996": {"name": "996", "hint": "怪血 +50%、打人更痛，boss 招式更勤",
		"enemy_hp": 1.5, "boss_hp": 1.5, "damage": 1.2, "spawn": 1.15, "ability_every": 0.75, "max_bosses": 4},
}
const ORDER := ["intern", "normal", "996"]
const DEFAULT := "normal"

static var current_id := DEFAULT


## Reads the saved choice; called when a run's scene loads.
static func load_saved() -> void:
	var saved: String = Settings.get_value("difficulty", DEFAULT)
	current_id = saved if TIERS.has(saved) else DEFAULT


## Picked on the title screen: this run is about to start, so it takes effect now.
static func choose(tier_id: String) -> void:
	current_id = tier_id
	Settings.set_value("difficulty", tier_id)


## Picked on the pause or end screen, right before a restart: saved for the next run only, so the
## run being left still reports (and shows) the tier it was played at.
static func save_for_next_run(tier_id: String) -> void:
	Settings.set_value("difficulty", tier_id)


static func value(key: String) -> float:
	return TIERS[current_id][key]


static func tier_name() -> String:
	return TIERS[current_id]["name"]
