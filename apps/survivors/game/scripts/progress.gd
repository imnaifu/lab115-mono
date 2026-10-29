class_name Progress
extends RefCounted
## What carries over from run to run (局外成长): landmarks checked in at (Stamps), achievements
## (Achievements) and the running totals some achievements count. Saved to user://progress.cfg
## next to the settings, which the web build keeps in the browser's IndexedDB: clearing the
## site's data loses it (a save code to carry it across devices is for later).
##
## Stamps and achievements are saved the moment they're earned, so closing the page mid-run
## keeps them; the totals are saved when a run ends.

const PATH := "user://progress.cfg"

## False keeps everything in memory only: the smoke test's runs mustn't fill the player's save.
static var to_disk := true

static var _config: ConfigFile


static func has_stamp(id: String) -> bool:
	return _load().has_section_key("stamps", id)


static func stamp_ids() -> PackedStringArray:
	return _keys("stamps")


static func add_stamp(id: String) -> void:
	_load().set_value("stamps", id, int(Time.get_unix_time_from_system()))
	_save()


static func has_achievement(id: String) -> bool:
	return _load().has_section_key("achievements", id)


static func achievement_ids() -> PackedStringArray:
	return _keys("achievements")


static func add_achievement(id: String) -> void:
	_load().set_value("achievements", id, int(Time.get_unix_time_from_system()))
	_save()


## A running total or set (`kills`, `runs`, `bosses`, `wins`), or `default` before the first.
static func stat(key: String, default: Variant) -> Variant:
	return _load().get_value("stats", key, default)


## Changes a total without saving: Achievements saves them all together when a run ends.
static func set_stat(key: String, value: Variant) -> void:
	_load().set_value("stats", key, value)


static func save() -> void:
	_save()


## Forgets everything (the smoke test starting clean).
static func reset() -> void:
	_config = ConfigFile.new()


static func _keys(section: String) -> PackedStringArray:
	var config := _load()
	return config.get_section_keys(section) if config.has_section(section) else PackedStringArray()


static func _save() -> void:
	if to_disk:
		_config.save(PATH)


static func _load() -> ConfigFile:
	if _config == null:
		_config = ConfigFile.new()
		# Missing on a first launch, and always when kept in memory.
		if to_disk:
			_config.load(PATH)
	return _config
