class_name Maps
extends RefCounted
## The maps a run can be played on: 硅谷 (BayArea), from .20 北京 (Beijing), from .34 西雅图
## (Seattle). Each is a script of constants and static functions under the same names; `current`
## is the one this run is on, and City, Traffic, the minimap and the rest ask it rather than a map
## by name. (Calling through a script held in a variable costs no more than calling it by name.)
##
## Maps get harder the longer their working week (each map's HOURS and DIFFICULTY, at the user's
## call): 硅谷 965 first and easiest, 西雅图 975, 北京 996 the hardest; those to come (Singapore,
## Bangalore, Shenzhen / Hangzhou's 大小周) go in between by their hours, ORDER kept in that order.
## The title screen's world map (ui/world_map.gd) draws them as a route in that order and opens
## them one by one, like Kingdom Rush's campaign: a map opens once the one before it has been won.

const ORDER := ["sv", "sea", "bj"]
## Open from the first run, whatever unlocked() says: all of them for now (.34), at the user's call
## (the one-by-one rule is in, but every map stays open while they are being tested). 北京 has
## been open from the start since .25.
const OPEN_FROM_START := ["sv", "sea", "bj"]
## Cities still to come, drawn on the world map as "coming soon" pins (WorldMap.CITIES places them).
const COMING_SOON := ["sz", "sg", "blr"]

static var current: GDScript = BayArea
static var current_id := "sv"
## The smoke test plays any map without earning it first.
static var unlock_all := false


static func script_of(id: String) -> GDScript:
	match id:
		"bj":
			return Beijing
		"sea":
			return Seattle
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


## The map's name with its working week, for the map picker: 北京 · 996.
static func label_of(id: String) -> String:
	var map := script_of(id)
	return "%s · %s" % [TranslationServer.translate(map.NAME), map.HOURS]


## Every map's landmarks, all told.
static func stamp_count() -> int:
	var count := 0
	for map_id: String in ORDER:
		count += (script_of(map_id).STAMPS as Dictionary).size()
	return count
