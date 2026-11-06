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
##
## 返聘 (revives, .43) do get spent, so they're kept as two sets that only grow: each one earned
## (its own id) and each run that spent one (the run's id); what's left is the difference. A count
## of what's left would merge wrong (the larger of two devices' counts brings a spent one back),
## and a count of earned ones would lose one earned on each of two devices at once.
##
## 工资 and 培训 (.44) the same way: `salary` has an entry per year-end bonus that paid (its own id,
## the amount), `training` one per purchase or refund (Training plays them back). Neither entry
## ever changes once written, so merging is just gaining the other side's.
##
## 战绩 (66, RunHistory) are the one thing that goes: `runs` has an entry per run (its id, a
## summary that never changes), and only the newest RUNS_KEPT are kept, the rest dropped whenever
## one is added or two saves merge. Which ones are newest is the same on every device (by time,
## then id), so two devices merging still end up with the same list.

const PATH := "user://progress.cfg"
## Sections whose keys are ids with the time they were earned: merged by keeping the earliest.
const EARNED := ["stamps", "achievements", "revives", "revives_used"]
## How many 战绩 the save keeps (the user: 留最近 50 局).
const RUNS_KEPT := 50

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


## When `id` was earned (unix seconds; the earliest across devices), 0 if it wasn't.
static func achievement_time(id: String) -> int:
	return int(_load().get_value("achievements", id, 0))


static func add_achievement(id: String) -> void:
	_load().set_value("achievements", id, int(Time.get_unix_time_from_system()))
	_save()


## 返聘 saved up and not spent yet. Two devices spending the same one offline count as two spent.
static func revives_left() -> int:
	return maxi(0, _keys("revives").size() - _keys("revives_used").size())


## A 返聘, `id` its own: bought in 培训 since .44 (Training.buy_revive), from a 绩效 S year-end bonus in .43.
static func add_revive(id: String) -> void:
	_load().set_value("revives", id, int(Time.get_unix_time_from_system()))
	_save()


## One spent in the run `run_id` (a run spends one at most).
static func use_revive(run_id: String) -> void:
	_load().set_value("revives_used", run_id, int(Time.get_unix_time_from_system()))
	_save()


## Every bit of 工资 ever paid (Training takes what's been spent off it).
static func salary_total() -> int:
	var total := 0
	for id in _keys("salary"):
		total += int(_load().get_value("salary", id))
	return total


## Whether 工资 `id` was ever paid (an achievement's prize, `ach-<id>`, .96).
static func has_salary(id: String) -> bool:
	return _load().has_section_key("salary", id)


## 工资 from a year-end bonus, `id` its own (the run's id and the chest's number), saved at once.
static func add_salary(id: String, amount: int) -> void:
	_load().set_value("salary", id, amount)
	_save()


## Every 培训 purchase and refund: id -> [unix msec, "buy" / "refund", stat id, cost].
static func training_events() -> Dictionary:
	var events := {}
	for id in _keys("training"):
		events[id] = _load().get_value("training", id)
	return events


## A purchase or refund (`event` without its time, which is added), saved at once; returns its id.
## Its time is after every event already there, even within the same millisecond, so this device's
## events always play back in the order they happened (a refund then a purchase, not the other way).
static func add_training_event(event: Array) -> String:
	var now := int(Time.get_unix_time_from_system() * 1000.0)
	for earlier: Array in training_events().values():
		now = maxi(now, int(earlier[0]) + 1)
	var id := "%d-%08x" % [now, randi()]
	_load().set_value("training", id, [now] + event)
	_save()
	return id


## Every run kept for 战绩: run id -> its summary (RunHistory.record says what's in it).
static func runs() -> Dictionary:
	var kept := {}
	for id in _keys("runs"):
		kept[id] = _load().get_value("runs", id)
	return kept


## A run's summary, saved at once (dropping the oldest past RUNS_KEPT).
static func add_run(id: String, summary: Dictionary) -> void:
	_load().set_value("runs", id, summary)
	_prune_runs()
	_save()


## Drops all but the newest RUNS_KEPT runs: by their `at`, then by id, so every device picks the same.
static func _prune_runs() -> void:
	var ids := Array(_keys("runs"))
	if ids.size() <= RUNS_KEPT:
		return
	var config := _load()
	ids.sort_custom(func(a: String, b: String) -> bool:
		var at_a := int((config.get_value("runs", a) as Dictionary).get("at", 0))
		var at_b := int((config.get_value("runs", b) as Dictionary).get("at", 0))
		return at_a > at_b if at_a != at_b else a > b)
	for id: String in ids.slice(RUNS_KEPT):
		config.erase_section_key("runs", id)


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
	# Compared with what's there afterwards: runs the other side brings that are too old to keep
	# come and go again within the merge (_prune_runs), which isn't a change.
	var before := config.encode_to_text()
	for section in other.get_sections():
		for key in other.get_section_keys(section):
			var theirs: Variant = other.get_value(section, key)
			# Checked first: get_value takes a null default as none at all and logs an error.
			if not config.has_section_key(section, key):
				config.set_value(section, key, theirs)
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
	_prune_runs()
	var changed := config.encode_to_text() != before
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


## 重置进度 (.56): forgets everything kept here (landmarks, achievements, the bestiary, 工资 and 培训,
## 返聘, map wins, the totals) and saves the empty save. Not uploaded from here: Cloud.leave_account
## has taken the device off its account first, so that account keeps its copy, and Cloud.reconnect
## gives the device a fresh one to upload to.
static func clear_all() -> void:
	_config = ConfigFile.new()
	_save(false)


## `upload` false for a save that came from the cloud in the first place.
static func _save(upload: bool = true) -> void:
	# A test run (TestMode) keeps nothing: what it earns lasts only until the page closes.
	if TestMode.on:
		return
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
