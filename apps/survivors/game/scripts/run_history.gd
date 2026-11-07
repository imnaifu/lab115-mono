class_name RunHistory
extends RefCounted
## 战绩 (66, the user: 支持查看历史战绩): a summary of each run kept in the save (Progress.runs, the
## newest Progress.RUNS_KEPT, synced with the cloud save like the rest), listed newest first on
## the collection page's 战绩 tab. Recorded from this version on: older runs were never kept on
## the device (only sent as play data), so they can't be shown.

## Runs shorter than this aren't kept (a start abandoned at once isn't a run worth listing).
const MIN_SECONDS := 30.0
## Damage sources listed per run, the biggest first.
const TOP_SOURCES := 3
## How a run ended, as listed: its words and the pill's colour and text colour.
const RESULTS := {
	"win": ["通关", Color("4caf6a"), Color.WHITE],
	"died": ["被裁", Art.BOSS_RED, Color.WHITE],
	"quit": ["下班", Art.PAPER_SUNK, Art.INK_MUTED],
}


## Keeps the run `game` is playing, which ended as `result` (win / died, or quit when it was given
## up from the pause screen). Nothing in 测试模式, whose runs leave no trace.
static func record(game: Game, result: String) -> void:
	if TestMode.on or game.elapsed < MIN_SECONDS:
		return
	var player := game.player
	var total := 0.0
	for amount: float in game.damage_by_source.values():
		total += amount
	# The weapons and passives that did the most, in percent of all damage (map events and the like
	# left out: they aren't the player's).
	var sources := []
	for source: String in game.damage_by_source:
		if Upgrades.WEAPONS.has(source) or Upgrades.PASSIVES.has(source):
			sources.append([source, roundi(100.0 * game.damage_by_source[source] / maxf(total, 1.0))])
	sources.sort_custom(func(a: Array, b: Array) -> bool: return a[1] > b[1])
	var evolved := []
	for weapon in player.weapons:
		if weapon.evolved:
			evolved.append(weapon.id)
	Progress.add_run(game.run_id, {
		"at": int(Time.get_unix_time_from_system()),
		"job": player.job,
		"map": Maps.current_id,
		"result": result,
		"seconds": roundi(game.elapsed),
		"level": game.level,
		"kills": game.kills,
		"killer": game.telemetry.last_hurt_by,
		"salary": game.salary_earned,
		"damage": sources.slice(0, TOP_SOURCES),
		"evolved": evolved,
		"version": Telemetry.VERSION,
		# 无尽模式 (0.2.0): listed with its mode; runs before have no key and were the usual one.
		"endless": game.endless,
	})


## Every run kept, newest first, each a summary with its `id` added.
static func entries() -> Array:
	var runs := Progress.runs()
	var list := []
	for id: String in runs:
		var entry: Dictionary = (runs[id] as Dictionary).duplicate()
		entry["id"] = id
		list.append(entry)
	list.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		return int(a.get("at", 0)) > int(b.get("at", 0)) if int(a.get("at", 0)) != int(b.get("at", 0)) else str(a["id"]) > str(b["id"]))
	return list


## The grade a run reached, in its own map's ranks (硅谷 L21, 北京 P21).
static func rank_text(entry: Dictionary) -> String:
	var map_id := str(entry.get("map", "sv"))
	var prefix: String = Maps.script_of(map_id).RANK_PREFIX if Maps.ORDER.has(map_id) else "L"
	return "%s%d" % [prefix, int(entry.get("level", 1))]


## When a run ended, in this device's time: 11-01 23:22.
static func date_text(entry: Dictionary) -> String:
	var bias_seconds := int(Time.get_time_zone_from_system().get("bias", 0)) * 60
	var moment := Time.get_datetime_dict_from_unix_time(int(entry.get("at", 0)) + bias_seconds)
	return "%02d-%02d %02d:%02d" % [moment["month"], moment["day"], moment["hour"], moment["minute"]]


## A damage source's name: a weapon's (evolved or not), else a passive's.
static func source_name(source: String, evolved: Array) -> String:
	if Upgrades.WEAPONS.has(source):
		return TranslationServer.translate(Upgrades.weapon_name(source, evolved.has(source)))
	return TranslationServer.translate(Upgrades.PASSIVES[source]["name"]) if Upgrades.PASSIVES.has(source) else source
