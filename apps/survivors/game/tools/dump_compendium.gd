extends SceneTree
## Writes everything the 官网 shows (tools/build_site.py) as JSON: the jobs, weapons, passives,
## every enemy by the bestiary's groups, the boss affixes, the maps and their landmarks, the
## achievements and a run's schedule, read straight from the game's own tables, so the site says
## what the game does. Art is named, not included: build_site.py reads assets/art/ itself.
##
##   godot --headless --path . -s tools/dump_compendium.gd -- /tmp/compendium.json

const HUD_SCRIPT := "res://scripts/ui/hud.gd"


func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	if args.is_empty():
		printerr("usage: -- <out.json>")
		quit(1)
		return
	var hud: GDScript = load(HUD_SCRIPT)
	var data := {
		"version": Telemetry.VERSION,
		"run_seconds": Game.RUN_SECONDS,
		"jobs": _jobs(),
		"weapon_types": _weapon_types(),
		"weapons": _weapons(),
		"passives": _passives(),
		"enemy_groups": _enemy_groups(hud),
		"affixes": _affixes(hud),
		"maps": _maps(),
		"coming_soon": Maps.COMING_SOON,
		# The ones the 收藏 page shows (Achievements.shown: not a switched-off feature's).
		"achievements": Achievements.shown(),
		"events": _events(),
	}
	var file := FileAccess.open(args[0], FileAccess.WRITE)
	file.store_string(JSON.stringify(data, "\t"))
	file.close()
	print("wrote %s" % args[0])
	quit(0)


func _jobs() -> Array:
	var jobs := []
	for id: String in Jobs.ORDER:
		var job: Dictionary = Jobs.JOBS[id]
		jobs.append({"id": id, "name": job["name"], "art": job["art"], "weapon": job["weapon"], "hp": job["hp"],
			"armor": job["armor"], "speed": job["speed"], "pitch": job["pitch"], "lines": job["lines"]})
	return jobs


func _weapon_types() -> Dictionary:
	var types := {}
	for id: String in Jobs.TYPES:
		types[id] = {"name": Jobs.TYPES[id]["name"], "fill": Jobs.TYPES[id]["fill"].to_html(false), "ink": Jobs.TYPES[id]["ink"].to_html(false)}
	return types


func _weapons() -> Array:
	var weapons := []
	for id: String in Upgrades.WEAPONS:
		var weapon: Dictionary = Upgrades.WEAPONS[id]
		var entry := {"id": id, "name": weapon["name"], "art": weapon["art"], "type": weapon["type"],
			"job": weapon.get("job", ""), "levels": weapon["levels"]}
		if Upgrades.BRANCHES.has(id):
			entry["branches"] = Upgrades.BRANCHES[id]
			entry["base"] = Upgrades.branch_stats(id, 0, 0)
		else:
			var stats := []
			for level in range(1, Upgrades.MAX_LEVEL + 1):
				stats.append(Upgrades.weapon_stats(id, level))
			entry["stats"] = stats
		weapons.append(entry)
	return weapons


func _passives() -> Array:
	var passives := []
	for id: String in Upgrades.PASSIVES:
		var passive: Dictionary = Upgrades.PASSIVES[id]
		var text: String = passive["text"]
		if Upgrades.STAT_STEPS.has(id):
			# A stat passive's text takes its step (once or twice), as an ordinary card shows it.
			var step: float = Upgrades.STAT_STEPS[id]
			var shown := str(int(step)) if is_equal_approx(step, roundf(step)) else str(step)
			text = text.replace("%s", shown)
		passives.append({"id": id, "name": passive["name"], "art": passive["art"], "text": text.replace("%%", "%"),
			"stat": Upgrades.STAT_STEPS.has(id)})
	return passives


func _enemy_groups(hud: GDScript) -> Array:
	var hints: Dictionary = hud.BOSS_MOVE_HINTS
	# Which Silicon Valley enemy each map's own one stands in for (Maps' MOB_SWAPS, BOSS_SWAPS).
	var stands_for := {}
	for map_id: String in Maps.ORDER:
		var map := Maps.script_of(map_id)
		for from: String in map.MOB_SWAPS:
			stands_for[map.MOB_SWAPS[from]] = from
		for from: String in map.BOSS_SWAPS:
			stands_for[map.BOSS_SWAPS[from]] = from
	var groups := []
	for group: Dictionary in Bestiary.GROUPS:
		var enemies := []
		for id: String in group["ids"]:
			var type: Dictionary = Spawner.ENEMY_TYPES[id]
			var moves := []
			var ability: String = type.get("ability", "")
			if ability != "":
				moves.append({"id": ability, "hint": hints.get(ability, "")})
			enemies.append({"id": id, "name": type["name"], "art": type["art"], "elite": type.get("elite", false),
				"hp": type["hp"], "speed": type["speed"], "damage": type["damage"], "xp": type["xp"],
				"ghostly": type.get("ghostly", false), "note": Bestiary.NOTES.get(id, ""),
				"maps": Array(Bestiary.maps_of(id)), "moves": moves,
				"stands_for": Spawner.ENEMY_TYPES[stands_for[id]]["name"] if stands_for.has(id) else ""})
		groups.append({"name": group["name"], "enemies": enemies})
	return groups


func _affixes(hud: GDScript) -> Array:
	var affixes := []
	for id: String in Enemy.AFFIXES:
		affixes.append({"id": id, "name": Enemy.AFFIXES[id], "note": hud.AFFIX_NOTES.get(id, "")})
	return affixes


func _maps() -> Array:
	var maps := []
	for id: String in Maps.ORDER:
		var map := Maps.script_of(id)
		var districts := []
		for district: Dictionary in map.DISTRICTS.values():
			if district.has("name") and not districts.has(district["name"]):
				districts.append(district["name"])
		var stamps := []
		for stamp_id: String in map.STAMPS:
			var stamp: Dictionary = map.STAMPS[stamp_id]
			stamps.append({"id": stamp_id, "name": stamp["name"], "art": stamp["art"], "note": stamp.get("note", ""),
				"bonus": _bonus_text(stamp["bonus"])})
		var guest: String = map.GUEST_BOSS["type"]
		maps.append({"id": id, "name": map.NAME, "hours": map.HOURS, "difficulty": map.DIFFICULTY,
			"rank_prefix": map.RANK_PREFIX, "districts": districts, "stamps": stamps,
			"event": {"name": map.MAP_EVENT.get("name", ""), "text": map.MAP_EVENT.get("text", ""), "hint": map.MAP_EVENT.get("hint", "")},
			"guest_boss": {"id": guest, "name": Spawner.ENEMY_TYPES[guest]["name"]}, "finale": map.FINALE_LINE})
	return maps


## A landmark's bonus as the 打卡 page words it (Stamps.BONUSES).
func _bonus_text(bonus: Array) -> String:
	var kind: String = bonus[0]
	var amount: float = bonus[1]
	var shown: Variant = amount if Stamps.PLAIN_BONUSES.has(kind) else roundi(amount * 100.0)
	if kind == "regen":
		shown = str(amount)
	return Stamps.BONUSES[kind] % shown


## The run's written schedule (Spawner.EVENTS): bosses and rings by time, before each run's shuffle.
func _events() -> Array:
	var events := []
	for event: Dictionary in Spawner.EVENTS:
		if event.has("text"):
			events.append({"at": event["at"], "kind": event["kind"], "text": event["text"]})
	return events
