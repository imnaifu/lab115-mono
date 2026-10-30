class_name Maps
extends RefCounted
## The maps a run can be played on: 硅谷 (BayArea) and, from .20, 北京 (Beijing). Each is a
## script of constants and static functions under the same names; `current` is the one this run
## is on, and City, Traffic, the minimap and the rest ask it rather than a map by name. (Calling
## through a script held in a variable costs no more than calling it by name.)
##
## 硅谷 is open from the start. 北京 opens once any run has been won, or once enough of Silicon
## Valley's landmarks have been checked in at: the achievements and check-ins are the keys.
##
## Maps get harder the longer their working week (each map's HOURS and DIFFICULTY, at the user's
## call): 硅谷 965 first and easiest, 北京 996 the hardest; those to come (Singapore, Seattle,
## Bangalore, Shenzhen / Hangzhou's 大小周) go in between by their hours, ORDER kept in that order.

const ORDER := ["sv", "bj"]
## Open from the first run: 北京 too from .25, at the user's call (to play it straight away). A map
## not listed here opens by the rule in unlocked(), which is what 北京 needed before (a win, or
## BEIJING_STAMPS_TO_UNLOCK check-ins in 硅谷); kept for the maps to come.
const OPEN_FROM_START := ["sv", "bj"]
const BEIJING_STAMPS_TO_UNLOCK := 8

static var current: GDScript = BayArea
static var current_id := "sv"
## The smoke test plays any map without earning it first.
static var unlock_all := false


static func script_of(id: String) -> GDScript:
	return Beijing if id == "bj" else BayArea


## Makes `id` the map the world is built from (before City is).
static func use(id: String) -> void:
	current_id = id if ORDER.has(id) else "sv"
	current = script_of(current_id)


## The map picked last on this device, if it is still open to it; else 硅谷.
static func saved() -> String:
	var id: String = Settings.get_value("map", "sv")
	return id if ORDER.has(id) and unlocked(id) else "sv"


static func unlocked(id: String) -> bool:
	if OPEN_FROM_START.has(id) or unlock_all:
		return true
	return Progress.has_achievement("ipo") or stamps_on("sv") >= BEIJING_STAMPS_TO_UNLOCK


## What opens a locked map, for the title screen and the 打卡 page.
static func unlock_hint(id: String) -> String:
	if id == "bj":
		return TranslationServer.translate("通关一次，或在硅谷打卡 %d 个地标，解锁北京") % BEIJING_STAMPS_TO_UNLOCK
	return ""


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
