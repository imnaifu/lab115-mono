extends SceneTree
## Writes everything the 官网 shows (tools/build_site.py) as JSON: the jobs, weapons, passives,
## every enemy by the bestiary's groups (a boss with its attacks and lines), the maps and their
## landmarks, the achievements and a run's schedule; the player's stats, card rarity, luck, drops,
## the year-end bonus and 培训, the XP curve and how a run gets harder; read straight from the game's own tables
## and formulas, so the site says what the game does. Art is named, not included: build_site.py
## reads assets/art/ itself.
##
##   godot --headless --path . -s tools/dump_compendium.gd -- /tmp/compendium.json

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
	# A save of its own in memory: the 培训 totals are worked out by buying in it (_train_fully),
	# and nothing here should read or write whoever's save is on this machine.
	Progress.to_disk = false
	Progress.reset()
	var data := {
		"version": Telemetry.VERSION,
		"run_seconds": Game.RUN_SECONDS,
		"jobs": _jobs(),
		"weapon_types": _weapon_types(),
		"weapons": _weapons(),
		"passives": _passives(),
		"enemy_groups": _enemy_groups(),
		"maps": _maps(),
		"coming_soon": Maps.COMING_SOON,
		"achievements": _achievements(),
		"events": _events(),
		"stats": _stats(),
		"rarities": _rarities(),
		"luck": _luck(),
		"drops": {"heal_amount": Game.HEAL_AMOUNT,
			"magnet_chance": Game.MAGNET_DROP_CHANCE, "magnet_from_level": Game.MAGNET_FROM_LEVEL,
			"max_pickups": Game.MAX_PICKUPS, "chests": Game.FUNDING_ROUNDS,
			"revive": {"hp": Game.REVIVE_HP, "invuln": Game.REVIVE_INVULN}},
		"training": _training(),
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


func _enemy_groups() -> Array:
	var groups := []
	for group: Dictionary in Bestiary.GROUPS:
		var enemies := []
		for id: String in group["ids"]:
			var type: Dictionary = Spawner.ENEMY_TYPES[id]
			# A boss's attacks (BossKits): kind, name and how to dodge.
			var moves := BossKits.describe(id) if BossKits.has(id) else []
			var slot := BossKits.slot_of(id)
			enemies.append({"id": id, "name": type["name"], "art": type["art"], "elite": type.get("elite", false),
				"hp": type["hp"], "speed": type["speed"], "damage": type["damage"], "xp": type["xp"],
				"ghostly": type.get("ghostly", false), "note": Bestiary.NOTES.get(id, ""),
				"maps": Array(Bestiary.maps_of(id)), "moves": moves, "at": BossKits.SLOT_AT[slot] if slot >= 0 else -1.0,
				"lines": BossKits.KITS[id]["lines"] if BossKits.has(id) else {}})
		groups.append({"name": group["name"], "enemies": enemies})
	return groups


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
		var bosses := []
		for slot in (map.BOSSES as Array).size():
			var boss_id: String = map.BOSSES[slot]
			bosses.append({"id": boss_id, "name": Spawner.ENEMY_TYPES[boss_id]["name"], "art": Spawner.ENEMY_TYPES[boss_id]["art"],
				"at": BossKits.SLOT_AT[slot]})
		maps.append({"id": id, "name": map.NAME, "hours": map.HOURS, "difficulty": map.DIFFICULTY,
			"rank_prefix": map.RANK_PREFIX, "districts": districts, "stamps": stamps,
			"event": {"name": map.MAP_EVENT.get("name", ""), "text": map.MAP_EVENT.get("text", ""), "hint": map.MAP_EVENT.get("hint", "")},
			"bosses": bosses, "finale": bosses[-1]["name"]})
	return maps


## A landmark's bonus as the 打卡 page words it (Stamps.BONUSES).
func _bonus_text(bonus: Array) -> String:
	var kind: String = bonus[0]
	var amount: float = bonus[1]
	var shown: Variant = amount if Stamps.PLAIN_BONUSES.has(kind) else roundi(amount * 100.0)
	if kind == "regen":
		shown = str(amount)
	return Stamps.BONUSES[kind] % shown


## A run's schedule: the rings (Spawner.EVENTS) and the four bosses' times (each map's own bosses).
func _events() -> Array:
	var events := []
	for event: Dictionary in Spawner.EVENTS:
		if event.has("text"):
			events.append({"at": event["at"], "kind": event["kind"], "text": event["text"]})
	for slot in BossKits.SLOT_AT.size():
		events.append({"at": BossKits.SLOT_AT[slot], "kind": "elite", "text": "最后一战" if slot == BossKits.SLOT_AT.size() - 1 else "boss"})
	events.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return a["at"] < b["at"])
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
## health, armour and speed: fresh, with every landmark on every map checked in at, and with every
## 培训 rank bought, each read off a Player as Stamps.apply_bonus / Training.apply leave it, so the
## totals compound the way the game does.
func _stats() -> Dictionary:
	var fresh := Player.new()
	var stamped := Player.new()
	for map_id: String in Maps.ORDER:
		for stamp_id: String in Maps.script_of(map_id).STAMPS:
			Stamps.apply_bonus(stamped, stamp_id)
	var trained := Player.new()
	_train_fully()
	Training.apply(trained)
	var stats := {"start": _player_stats(fresh), "all_stamps": _player_stats(stamped),
		"all_training": _player_stats(trained), "invuln_seconds": Player.INVULN_SECONDS,
		"passive_steps": Upgrades.STAT_STEPS}
	fresh.free()
	stamped.free()
	trained.free()
	return stats


## 培训 (Training) for the 官网: each stat's ranks, what one rank and the top give, the price of each
## rank before the tax, and what training everything costs bought rank by rank in table order.
func _training() -> Dictionary:
	var stats := []
	for entry: Dictionary in Training.STATS:
		var id: String = entry["id"]
		var prices := []
		for level in range(1, int(entry["ranks"]) + 1):
			prices.append(Training.price_at(id, level, 0))
		stats.append({"id": id, "name": entry["name"], "art": entry["art"], "ranks": entry["ranks"],
			"step_text": Training.amount_text(id, 1), "max_text": Training.amount_text(id, entry["ranks"]), "prices": prices})
	return {"stats": stats, "tax": Training.TAX, "full_cost": _train_fully(), "revive_price": Training.REVIVE_PRICE}


## Buys every 培训 rank in a throwaway save (kept in memory, never on disk) and says what it cost.
func _train_fully() -> int:
	Progress.to_disk = false
	Progress.reset()
	Progress.add_salary("dump", 100000000)
	var more := true
	# Rank by rank across the table, the way a player spreading their 工资 would.
	while more:
		more = false
		for entry: Dictionary in Training.STATS:
			more = Training.buy(entry["id"]) or more
	return 100000000 - Training.balance()


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


## What luck does at each of LUCK_SHOWN: the chance of each card rarity and of an extra card, by
## the game's own luck_factor. (Year-end bonus ratings don't move with it since .43.)
func _luck() -> Array:
	var rows := []
	for luck: float in LUCK_SHOWN:
		var card_weights := []
		for tier in Upgrades.RARITIES.size():
			card_weights.append(Upgrades.RARITIES[tier]["weight"] * Upgrades.luck_factor(luck, tier))
		rows.append({"luck": luck, "cards": _shares(card_weights), "extra_card": Upgrades.extra_card_chance(luck)})
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
## second and enemy health by the minute, the trickle's mix (Spawner.WAVES), and each boss slot's
## strength (BossKits.SLOT_STATS, whichever map's boss it is) and rhythm.
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
	for slot in BossKits.SLOT_AT.size():
		var at: float = BossKits.SLOT_AT[slot]
		var stats: Dictionary = BossKits.SLOT_STATS[slot]
		slots.append({"at": at, "hp": stats["hp"], "hp_then": stats["hp"] * Spawner.hp_scale_at(at, 1.0),
			"damage": stats["damage"], "xp": stats["xp"]})
	return {"minutes": minutes, "waves": waves, "boss_slots": slots, "walk_seconds": BossKits.WALK_SECONDS,
		"phase_two_at": BossKits.PHASE_TWO_AT,
		"hp_per_minute": Spawner.HP_PER_MINUTE, "max_alive": Spawner.MAX_ALIVE, "max_alive_mobile": Spawner.MAX_ALIVE_MOBILE,
		"max_bosses_out": Spawner.MAX_BOSSES_OUT}
