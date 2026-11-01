extends SceneTree
## Writes everything the 官网 shows (tools/build_site.py) as JSON: the jobs, weapons, passives,
## every enemy by the bestiary's groups, the boss affixes, the maps and their landmarks, the
## achievements and a run's schedule; the player's stats, card rarity, luck, drops and the
## year-end bonus, the XP curve and how a run gets harder; read straight from the game's own tables
## and formulas, so the site says what the game does. Art is named, not included: build_site.py
## reads assets/art/ itself.
##
##   godot --headless --path . -s tools/dump_compendium.gd -- /tmp/compendium.json

const HUD_SCRIPT := "res://scripts/ui/hud.gd"
## The luck values the site's luck table shows: none, one 锦鲤, and on up to about what a run can
## reach (锦鲤 maxed and every luck landmark checked in at).
const LUCK_SHOWN := [0.0, 20.0, 50.0, 100.0, 200.0]
## How far the site's XP curve goes.
const XP_LEVELS := 50


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
		"achievements": _achievements(),
		"events": _events(),
		"stats": _stats(),
		"rarities": _rarities(),
		"luck": _luck(),
		"drops": {"heal_chance": Game.HEAL_DROP_CHANCE, "heal_amount": Game.HEAL_AMOUNT,
			"magnet_chance": Game.MAGNET_DROP_CHANCE, "magnet_from_level": Game.MAGNET_FROM_LEVEL,
			"max_pickups": Game.MAX_PICKUPS, "affix_luck": Game.AFFIX_LUCK, "chests": Game.FUNDING_ROUNDS},
		"xp": _xp(),
		"job_weapon_levels": Upgrades.JOB_WEAPON_LEVELS,
		"pacing": _pacing(),
		# As [key, name] pairs: JSON.stringify sorts a dictionary's keys, and these go most telling first.
		"weapon_stat_names": Upgrades.WEAPON_STAT_NAMES.keys().map(func(key: String) -> Array: return [key, Upgrades.WEAPON_STAT_NAMES[key]]),
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
				"bonus": _bonus_text(stamp["bonus"]), "kind": stamp["bonus"][0]})
		var guest: String = map.GUEST_BOSS["type"]
		maps.append({"id": id, "name": map.NAME, "hours": map.HOURS, "difficulty": map.DIFFICULTY,
			"rank_prefix": map.RANK_PREFIX, "districts": districts, "stamps": stamps,
			"event": {"name": map.MAP_EVENT.get("name", ""), "text": map.MAP_EVENT.get("text", ""), "hint": map.MAP_EVENT.get("hint", "")},
			"guest_boss": {"id": guest, "name": Spawner.ENEMY_TYPES[guest]["name"]},
			# "" keeps the written schedule's own finale line (硅谷's).
			"finale": map.FINALE_LINE if map.FINALE_LINE != "" else _finale_line()})
	return maps


## The finale's line in Spawner.EVENTS, as written.
func _finale_line() -> String:
	for event: Dictionary in Spawner.EVENTS:
		if event["at"] == Spawner.FINALE_AT and event.has("text"):
			return event["text"]
	return ""


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


## The ones the 收藏 page shows (Achievements.shown: not a switched-off feature's), each with how
## many players have it as the page words it.
func _achievements() -> Array:
	var achievements := []
	for entry: Dictionary in Achievements.shown():
		var item := entry.duplicate()
		item["rate"] = Achievements.rate_text(entry["id"])
		achievements.append(item)
	return achievements


## The player's stats (what the pause screen lists) at the start of a run, before the job's own
## health, armour and speed, and with every landmark on every map checked in at, both read off a
## Player as Stamps.apply_bonus leaves it, so the totals compound the way the game does.
func _stats() -> Dictionary:
	var fresh := Player.new()
	var stamped := Player.new()
	for map_id: String in Maps.ORDER:
		for stamp_id: String in Maps.script_of(map_id).STAMPS:
			Stamps.apply_bonus(stamped, stamp_id)
	var stats := {"start": _player_stats(fresh), "all_stamps": _player_stats(stamped),
		"invuln_seconds": Player.INVULN_SECONDS, "passive_steps": Upgrades.STAT_STEPS}
	fresh.free()
	stamped.free()
	return stats


func _player_stats(player: Player) -> Dictionary:
	return {"max_hp": player.max_hp, "armor": player.armor, "move_speed": player.move_speed, "might": player.might,
		"cooldown_scale": player.cooldown_scale, "pickup_radius": player.pickup_radius, "regen": player.regen, "luck": player.luck}


## Card rarities (Upgrades.RARITIES) with the colours the cards wear (Art.RARITY_*).
func _rarities() -> Array:
	var rarities := []
	for tier in Upgrades.RARITIES.size():
		var rarity: Dictionary = Upgrades.RARITIES[tier].duplicate()
		rarity["edge"] = Art.RARITY_EDGE[tier].to_html(false)
		rarity["fill"] = Art.RARITY_FILL[tier].to_html(false)
		rarity["ink"] = Art.RARITY_INK[tier].to_html(false)
		rarities.append(rarity)
	return rarities


## What luck does at each of LUCK_SHOWN: the chance of each card rarity, of an extra card, and of
## each year-end bonus rating from a boss without affixes, by the game's own luck_factor.
func _luck() -> Array:
	var rows := []
	for luck: float in LUCK_SHOWN:
		var card_weights := []
		for tier in Upgrades.RARITIES.size():
			card_weights.append(Upgrades.RARITIES[tier]["weight"] * Upgrades.luck_factor(luck, tier))
		var chest_weights := []
		for index in Game.FUNDING_ROUNDS.size():
			chest_weights.append(Game.FUNDING_ROUNDS[index]["weight"] * Upgrades.luck_factor(luck, index))
		rows.append({"luck": luck, "cards": _shares(card_weights), "chest": _shares(chest_weights),
			"extra_card": Upgrades.extra_card_chance(luck)})
	return rows


func _shares(weights: Array) -> Array:
	var total := 0.0
	for weight: float in weights:
		total += weight
	return weights.map(func(weight: float) -> float: return weight / total)


## XP from each level to the next (Game.xp_needed), from level 1.
func _xp() -> Array:
	var needed := []
	for level in range(1, XP_LEVELS + 1):
		needed.append(Game.xp_needed(level))
	return needed


## How a run gets harder, on the base map (each map then multiplies by its DIFFICULTY): spawns a
## second and enemy health by the minute, the trickle's mix (Spawner.WAVES), the bosses' slots as
## written (each slot's strength, whichever boss the shuffle puts there) and how they are shaken up.
func _pacing() -> Dictionary:
	var minutes := []
	for minute in range(0, int(Game.RUN_SECONDS / 60.0) + 1):
		minutes.append({"minute": minute, "rate": Spawner.rate_at(minute * 60.0, 1.0), "hp": Spawner.hp_scale_at(minute * 60.0, 1.0)})
	var waves := []
	for wave: Dictionary in Spawner.WAVES:
		var mix := []
		for id: String in wave["mix"]:
			mix.append({"id": id, "name": Spawner.ENEMY_TYPES[id]["name"], "art": Spawner.ENEMY_TYPES[id]["art"], "weight": wave["mix"][id]})
		waves.append({"until": wave["until"], "mix": mix})
	var slots := []
	for event: Dictionary in Spawner.EVENTS:
		if event["kind"] != "elite":
			continue
		var type: Dictionary = Spawner.ENEMY_TYPES[event["type"]]
		var hp: float = type["hp"] * event.get("hp_scale", 1.0)
		slots.append({"at": event["at"], "id": event["type"], "name": type["name"], "art": type["art"], "hp": hp,
			"hp_then": hp * Spawner.hp_scale_at(event["at"], 1.0), "damage": type["damage"], "xp": type["xp"]})
	return {"minutes": minutes, "waves": waves, "boss_slots": slots, "boss_tiers": Spawner.BOSS_TIERS,
		"rolls": Spawner.ROLLS, "finale_at": Spawner.FINALE_AT, "jitter": Spawner.ARRIVAL_JITTER,
		"hp_per_minute": Spawner.HP_PER_MINUTE, "max_alive": Spawner.MAX_ALIVE, "max_alive_mobile": Spawner.MAX_ALIVE_MOBILE,
		"max_bosses_out": Spawner.MAX_BOSSES_OUT}
