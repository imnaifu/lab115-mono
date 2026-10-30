class_name Progress
extends RefCounted
## What carries over from run to run (局外成长): landmarks checked in at (Stamps), achievements
## (Achievements) and the running totals some achievements count. Saved to user://progress.cfg
## next to the settings, which the web build keeps in the browser's IndexedDB: clearing the
## site's data loses it, so every save is also uploaded to the cloud save (Cloud), which a 存档码
## brings back on another device.
##
## Stamps and achievements are saved the moment they're earned, so closing the page mid-run
## keeps them; the totals are saved when a run ends.
##
## Two copies of the save (this device's and the cloud's, which another device may have added to)
## are merged rather than one picked (merge_text), and that only works because nothing in here
## ever goes down: a stamp or achievement keeps its earliest time, a set only gains members, a
## count only grows. Anything added later must follow the same rule. Counts from two devices
## merge to the larger, not the sum (counting per device is more than they're worth).

const PATH := "user://progress.cfg"
## Sections whose keys are ids with the time they were earned: merged by keeping the earliest.
const EARNED := ["stamps", "achievements"]

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


## The whole save as text, the form the cloud keeps it in (ConfigFile's own, so numbers stay
## integers and sets stay arrays, which JSON would blur).
static func to_text() -> String:
	return _load().encode_to_text()


## Folds another copy of the save (`text`, from to_text) into this one by the rules at the top,
## and saves when that changed anything. Keys and sections this version doesn't know are kept
## too, so an older build merging a newer one's save doesn't drop them. Returns whether it changed.
static func merge_text(text: String) -> bool:
	var other := ConfigFile.new()
	if text.is_empty() or other.parse(text) != OK:
		return false
	var config := _load()
	var changed := false
	for section in other.get_sections():
		for key in other.get_section_keys(section):
			var theirs: Variant = other.get_value(section, key)
			# Checked first: get_value takes a null default as none at all and logs an error.
			if not config.has_section_key(section, key):
				config.set_value(section, key, theirs)
				changed = true
				continue
			var mine: Variant = config.get_value(section, key)
			var merged: Variant
			if section in EARNED and (mine is int) and (theirs is int):
				merged = mini(mine, theirs)
			else:
				merged = _merge_value(mine, theirs)
			# Compared as text: arrays and dictionaries then compare by what's in them.
			if var_to_str(merged) != var_to_str(mine):
				config.set_value(section, key, merged)
				changed = true
	if changed:
		# Not uploaded from here: whoever merged is writing the result to the cloud already.
		_save(false)
	return changed


## A count keeps the larger, a set gains the other's members (in the order first seen), a table of
## counts merges per key; anything else keeps this device's value.
static func _merge_value(mine: Variant, theirs: Variant) -> Variant:
	if (mine is int or mine is float) and (theirs is int or theirs is float):
		return maxf(mine, theirs) if (mine is float or theirs is float) else maxi(mine, theirs)
	if mine is Array and theirs is Array:
		var union: Array = mine.duplicate()
		for item: Variant in theirs:
			if not union.has(item):
				union.append(item)
		return union
	if mine is Dictionary and theirs is Dictionary:
		var table: Dictionary = mine.duplicate()
		for key: Variant in theirs:
			table[key] = _merge_value(table[key], theirs[key]) if table.has(key) else theirs[key]
		return table
	return mine


static func _keys(section: String) -> PackedStringArray:
	var config := _load()
	return config.get_section_keys(section) if config.has_section(section) else PackedStringArray()


## `upload` false for a save that came from the cloud in the first place.
static func _save(upload: bool = true) -> void:
	if to_disk:
		_config.save(PATH)
	if upload:
		Cloud.save_changed()


static func _load() -> ConfigFile:
	if _config == null:
		_config = ConfigFile.new()
		# Missing on a first launch, and always when kept in memory.
		if to_disk:
			_config.load(PATH)
	return _config
