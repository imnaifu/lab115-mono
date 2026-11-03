class_name Maps
extends RefCounted
## The maps a run can be played on: 硅谷 (BayArea), from .20 北京 (Beijing), from .34 西雅图
## (Seattle), from .37 伦敦 (London), from .38 新加坡 (Singapore). Each is a script of constants and static functions under the same names; `current`
## is the one this run is on, and City, Traffic and the rest ask it rather than a map
## by name. (Calling through a script held in a variable costs no more than calling it by name.)
##
## Maps get harder down ORDER (each map's DIFFICULTY, shown as STARS from .60; until then by
## working week, 965 to 996, at the user's call): 硅谷 and 伦敦 one star, 西雅图 and 新加坡 two,
## 北京 three; the one to come (班加罗尔) goes in before 北京. (深圳 was planned too; the user took
## it off the route in .45.) 伦敦 is second and as hard as 硅谷, so 硅谷 stays the first map new
## players see.
## The title screen's map picker (ui/map_list.gd; .38–.59 an airport departures board, .34–.37 a
## world map like Kingdom Rush's campaign) lists them in that order and opens them one by one: a
## map opens once the one before it has been won.

const ORDER := ["sv", "ldn", "sea", "sg", "bj"]
## Open from the first run, whatever unlocked() says: all of them for now (.34), at the user's call
## (the one-by-one rule is in, but every map stays open while they are being tested). 北京 has
## been open from the start since .25.
const OPEN_FROM_START := ["sv", "ldn", "sea", "sg", "bj"]
## Cities still to come, listed in the map picker as 敬请期待 (WorldMap.CITIES has their names).
const COMING_SOON := ["blr"]
## The whole route, easiest first (.38, for the map picker, MapList): the playable maps (ORDER)
## with the cities still to come in their places.
const ROUTE := ["sv", "ldn", "sea", "sg", "blr", "bj"]

static var current: GDScript = BayArea
static var current_id := "sv"
## The smoke test plays any map without earning it first.
static var unlock_all := false
## The balance bot's extra multipliers on top of the map's DIFFICULTY (tests/balance_bot.gd: e.g.
## {"hp": 1.4} to measure what 40% more enemy health does); empty in the game.
static var test_scale := {}


## The map's DIFFICULTY multiplier `key` (hp, damage, spawn), with the balance bot's test_scale.
static func difficulty(key: String) -> float:
	return float(current.DIFFICULTY[key]) * float(test_scale.get(key, 1.0))


static func script_of(id: String) -> GDScript:
	match id:
		"bj":
			return Beijing
		"sea":
			return Seattle
		"ldn":
			return London
		"sg":
			return Singapore
	return BayArea


## Makes `id` the map the world is built from (before City is).
static func use(id: String) -> void:
	current_id = id if ORDER.has(id) else "sv"
	current = script_of(current_id)


## The map picked last on this device, if it is still open to it; else 硅谷.
static func saved() -> String:
	var id: String = Settings.get_value("map", "sv")
	return id if ORDER.has(id) and unlocked(id) else "sv"


## Open: listed in OPEN_FROM_START, or the map before it in ORDER has been won (the first map is
## always open).
static func unlocked(id: String) -> bool:
	var index := ORDER.find(id)
	if index < 0:
		return false
	if index == 0 or OPEN_FROM_START.has(id) or unlock_all:
		return true
	return cleared(ORDER[index - 1])


## Won at least once on the map `id`. Wins are counted per map from .34 (`map_wins`, merged per
## map with the cloud save); before that only "any win" (the ipo achievement, so 硅谷, the only map
## then open to everyone) and 北京's own win achievement were kept, so those count too.
static func cleared(id: String) -> bool:
	if int((Progress.stat("map_wins", {}) as Dictionary).get(id, 0)) > 0:
		return true
	match id:
		"sv":
			return Progress.has_achievement("ipo")
		"bj":
			return Progress.has_achievement("win_beijing")
	return false


## What opens a locked map, for the world map and the 打卡 page.
static func unlock_hint(id: String) -> String:
	var index := ORDER.find(id)
	if index <= 0:
		return ""
	return TranslationServer.translate("在%s通关一次解锁") % TranslationServer.translate(script_of(ORDER[index - 1]).NAME)


## Landmarks checked in at on the map `id`.
static func stamps_on(id: String) -> int:
	var stamps: Dictionary = script_of(id).STAMPS
	var count := 0
	for stamp_id in Progress.stamp_ids():
		if stamps.has(stamp_id):
			count += 1
	return count


## A landmark's entry on whichever map it stands on (its bonus follows the player everywhere);
## empty for an id no map has.
static func stamp(id: String) -> Dictionary:
	for map_id: String in ORDER:
		var stamps: Dictionary = script_of(map_id).STAMPS
		if stamps.has(id):
			return stamps[id]
	return {}


## The job grade a run's level reads as on the current map: L1, L2… on 硅谷, P1, P2… on 北京. Since
## .33 every level-up is a promotion and the grade is all the game shows (the user dropped the
## separate level; before, a grade covered 10 levels and read "L4 · 12").
static func rank_of(level: int) -> String:
	return "%s%d" % [current.RANK_PREFIX, level]


## The map's name with its stars, for the title screen's map button: 北京 ★★★ (.60; until then its
## working week, 北京 · 996).
static func label_of(id: String) -> String:
	var map := script_of(id)
	return "%s %s" % [TranslationServer.translate(map.NAME), "★".repeat(map.STARS)]


## Every map's landmarks, all told.
static func stamp_count() -> int:
	var count := 0
	for map_id: String in ORDER:
		count += (script_of(map_id).STAMPS as Dictionary).size()
	return count
