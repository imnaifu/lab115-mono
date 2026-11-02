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
## reach, Player.MAX_LUCK (.60).
const LUCK_SHOWN := [0.0, 20.0, 50.0, 100.0, 170.0]
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
		"luck": _luck(), "max_luck": Player.MAX_LUCK,
		"drops": {"heal_amount": Game.HEAL_AMOUNT,
			"magnet_chance": Game.MAGNET_DROP_CHANCE, "magnet_from_level": Game.MAGNET_FROM_LEVEL,
			"nap_chance": Game.NAP_DROP_CHANCE, "nap_from_level": Game.NAP_FROM_LEVEL, "nap_seconds": Game.NAP_SECONDS,
			"red_packet_chance": Game.RED_PACKET_DROP_CHANCE, "red_packet_salary": Game.RED_PACKET_SALARY,
			"rare_drop_gap": Game.RARE_DROP_GAP,
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
			var by_branch := {"a": [], "b": []}
			for level in range(0, Upgrades.BRANCH_MAX + 1):
				by_branch["a"].append(Upgrades.branch_stats(id, level, 0))
				by_branch["b"].append(Upgrades.branch_stats(id, 0, level))
			entry["branch_levels"] = by_branch
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
			"stat": Upgrades.STAT_STEPS.has(id), "max": Upgrades.max_level("passive", id),
			"levels": _stat_levels(id) if Upgrades.STAT_STEPS.has(id) else [], "table": "" if Upgrades.STAT_STEPS.has(id) else _perk_levels(id)})
	return passives


func _enemy_groups() -> Array:
	var groups := []
	for group: Dictionary in Bestiary.GROUPS:
		var enemies := []
		for id: String in group["ids"]:
			var type: Dictionary = Spawner.ENEMY_TYPES[id]
			var slot := BossKits.slot_of(id)
			var entry := {"id": id, "name": type["name"], "art": type["art"], "elite": type.get("elite", false),
				"hp": type["hp"], "speed": type["speed"], "damage": type["damage"], "xp": type["xp"],
				"ghostly": type.get("ghostly", false), "note": Bestiary.NOTES.get(id, ""),
				"maps": Array(Bestiary.maps_of(id)), "moves": [], "at": BossKits.SLOT_AT[slot] if slot >= 0 else -1.0,
				"lines": BossKits.KITS[id]["lines"] if BossKits.has(id) else {}}
			if BossKits.has(id):
				_add_boss_numbers(entry, id, slot)
			enemies.append(entry)
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
		maps.append({"id": id, "name": map.NAME, "stars": map.STARS, "max_stars": MapList.MAX_STARS, "difficulty": map.DIFFICULTY,
			"rank_prefix": map.RANK_PREFIX, "districts": districts, "stamps": stamps,
			"event": {"name": map.MAP_EVENT.get("name", ""), "text": map.MAP_EVENT.get("text", ""), "hint": map.MAP_EVENT.get("hint", ""),
				"at": map.MAP_EVENT.get("at", 0.0), "seconds": map.MAP_EVENT.get("seconds", 0.0),
				"detail": _event_detail(map.MAP_EVENT.get("id", ""), map.DIFFICULTY["damage"])},
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
		"hp_per_minute": Spawner.HP_PER_MINUTE, "max_alive": Spawner.MAX_ALIVE,
		"max_bosses_out": Spawner.MAX_BOSSES_OUT}



# --- The 官网's numbers in words (.50, the user: 网站上的设计啥的都再详细一点，比如定点 boss 的攻击有
# 多少个圈). The wording lives here rather than in the game's scripts, so the game's subset font
# doesn't grow for text only the site shows; every number is read off the game's own data. ------

## The second-phase keys (BossKits "phase2") as the site words them: a label before the number, a
## unit after; "half" is shown doubled, a square's side.
const PHASE_KEYS := {
	"radius": ["半径 ", ""], "width": ["宽 ", ""], "length": ["长 ", ""], "half": ["边长 ", ""], "spacing": ["离中间 ", ""],
	"rings": ["", " 圈"], "arms": ["", " 个方向"], "count": ["", " 个"], "angle": ["", "°"], "cell": ["每格 ", ""],
}


## A boss's strength on its own map (BossKits.SLOT_STATS through ENEMY_TYPES): health as it comes in
## (the minute's and the map's multipliers, Spawner.hp_scale_at), contact damage (the map's), and
## each attack in numbers, its hits at the map's damage (Enemy._hits).
func _add_boss_numbers(entry: Dictionary, id: String, slot: int) -> void:
	# Its map by its BOSSES (entry["maps"] holds names, and Maps.script_of falls back to 硅谷 on those).
	var difficulty := {"hp": 1.0, "damage": 1.0}
	for map_id: String in Maps.ORDER:
		if (Maps.script_of(map_id).BOSSES as Array).has(id):
			difficulty = Maps.script_of(map_id).DIFFICULTY
	var at: float = BossKits.SLOT_AT[slot] if slot >= 0 else 0.0
	entry["hp_then"] = entry["hp"] * Spawner.hp_scale_at(at, difficulty["hp"])
	entry["contact"] = entry["damage"] * difficulty["damage"]
	entry["map_damage"] = difficulty["damage"]
	entry["walk_seconds"] = BossKits.WALK_SECONDS
	entry["phase_two_at"] = BossKits.PHASE_TWO_AT
	var kit: Dictionary = BossKits.KITS[id]
	var phase_two: Array = kit.get("phase2", [])
	var moves := BossKits.describe(id)
	for index in moves.size():
		var config: Dictionary = kit["attacks"][index]
		moves[index]["detail"] = _attack_detail(config, difficulty["damage"])
		if index < phase_two.size():
			moves[index]["phase2"] = _phase_two_text(config, phase_two[index])
	entry["moves"] = moves


## One attack in numbers (the attack scripts in scripts/bosses/ say what each key does): shape and
## size, timing, hits times `damage_scale`. Distances are in game pixels (the player walks 56-71 a
## second).
func _attack_detail(config: Dictionary, damage_scale: float) -> String:
	var hit := _hit(config["damage"] * damage_scale)
	var warn := _num(config.get("warn", 0.0))
	var fuse := _num(config.get("fuse", 0.0))
	match config["form"]:
		"dash":
			return "身前一条红带对准你（宽 %s、长 %s），%s 秒后顺着红带冲过去，撞到 %s；前面有楼就只冲到楼前" % [
				_num(config["width"]), _num(config["length"]), warn, hit]
		"sweep":
			return "朝你出一个红色扇形（半径 %s、%s°），%s 秒后扫一下，%s" % [_num(config["radius"]), _num(config["angle"]), warn, hit]
		"leap":
			return "跳向你站的地方，落点红圈半径 %s，%s 秒后落地，%s" % [_num(config["radius"]), warn, hit]
		"slam":
			return "脚下一圈红圈（半径 %s），%s 秒后砸地，%s，圈里的人被震出去" % [_num(config["radius"]), warn, hit]
		"chain":
			return "每 %s 秒在你脚下落一个红圈（半径 %s），一共 %d 个，各 %s 秒后炸，每个 %s" % [
				_num(config["every"]), _num(config["radius"]), config["count"], fuse, hit]
		"bigcircle":
			return "你脚下一个大红圈（半径 %s），%s 秒后砸下，%s" % [_num(config["radius"]), fuse, hit]
		"bigsquare":
			return "你脚下一个大红块（边长 %s），%s 秒后拍下，%s" % [_num(config["half"] * 2.0), fuse, hit]
		"lead":
			var size: Variant = config.get("size", null)
			var shape := "红框（%s×%s）" % [_num(size.x), _num(size.y)] if size is Vector2 else "红圈（半径 %s）" % _num(config["radius"])
			if int(config["count"]) <= 1:
				return "在你 %s 秒后会走到的地方落一个%s，%s 秒后砸下，%s" % [_num(config["ahead"]), shape, fuse, hit]
			return "每 %s 秒在你 %s 秒后会走到的地方落一个%s，一共 %d 个，各 %s 秒后砸下，每个 %s" % [
				_num(config["every"]), _num(config["ahead"]), shape, config["count"], fuse, hit]
		"cross":
			return "以你为中心落两条交叉的斜红带（宽 %s、长 %s），%s 秒后落下，%s" % [_num(config["width"]), _num(config["length"]), fuse, hit]
		"plus":
			return "你脚下和上下左右各一个红圈（半径 %s，离中间 %s），一共 5 个，%s 秒后砸下，每个 %s" % [
				_num(config["radius"]), _num(config["spacing"]), fuse, hit]
		"checker":
			return "以你为中心 3×3 的格子（每格 %s），中间和四个角 5 格变红，%s 秒后落下，每格 %s" % [_num(config["cell"]), fuse, hit]
		"aimed":
			return "细红线锁定你 %s 秒，然后顺着红线连射 %d 发（每 %s 秒一发，速度 %s），每发 %s" % [
				warn, config["count"], _num(config["every"]), _num(config["speed"]), hit]
		"spread":
			return "%d 条细红线扇形排开（相邻隔 %s°），%s 秒后每条线射一发（速度 %s），每发 %s" % [
				config["count"], _num(config["step"]), warn, _num(config["speed"]), hit]
		"ring":
			if int(config["rings"]) <= 1:
				return "蓄力 %s 秒，朝四周射一圈 %d 发（有一发正对你，速度 %s），每发 %s" % [warn, config["count"], _num(config["speed"]), hit]
			return "蓄力 %s 秒，朝四周射 %d 圈，每圈 %d 发、隔 %s 秒，后一圈错开半格（第一圈有一发正对你，速度 %s），每发 %s" % [
				warn, config["rings"], config["count"], _num(config["every"]), _num(config["speed"]), hit]
		"spiral":
			var shots := ceili(float(config["seconds"]) / float(config["every"]))
			var arms := int(config["arms"])
			var throw := "甩一发" if arms <= 1 else "朝 %d 个方向各甩一发" % arms
			return "蓄力 %s 秒，原地顺时针转一圈（%s 秒），每 %s 秒%s，从正对你开始，一共 %d 发（速度 %s），每发 %s" % [
				warn, _num(config["seconds"]), _num(config["every"]), throw, shots * arms, _num(config["speed"]), hit]
		"homing":
			return "蓄力 %s 秒，每 %s 秒放一颗追踪弹，一共 %d 颗（速度 %s，每秒最多拐 %s°，%s 秒后消失），每颗 %s" % [
				warn, _num(config["every"]), config["count"], _num(config["speed"]), _num(config["turn"]), _num(config["life"]), hit]
	push_warning("dump: no site wording for boss attack form %s" % config["form"])
	return ""


## What a second phase changes, from and to: 「半径 60 → 80」「1 → 2 圈」.
func _phase_two_text(config: Dictionary, overrides: Dictionary) -> String:
	var changes: Array[String] = []
	for key: String in overrides:
		var label: Array = PHASE_KEYS.get(key, [key + " ", ""])
		var scale := 2.0 if key == "half" else 1.0
		changes.append("%s%s → %s%s" % [label[0], _num(float(config[key]) * scale), _num(float(overrides[key]) * scale), label[1]])
	return "、".join(changes)


## A stat passive at each level, at 普通 rarity: what that many cards add up to on a fresh Player
## (Upgrades.apply_stat, the game's own stacking: damage adds, speeds and ranges multiply).
func _stat_levels(id: String) -> Array:
	var player := Player.new()
	var before := _player_stats(player)
	var totals := []
	for level in Upgrades.max_level("passive", id):
		Upgrades.apply_stat(player, id, Upgrades.stat_step(id, 0))
		var after := _player_stats(player)
		match id:
			"might":
				totals.append("+%s%%" % _num((after["might"] - before["might"]) * 100.0, 1))
			"armor":
				totals.append("-%s" % _num(after["armor"] - before["armor"], 1))
			"vitality":
				totals.append("+%s" % _num(after["max_hp"] - before["max_hp"], 1))
			"swiftness":
				totals.append("+%s%%" % _num((after["move_speed"] / before["move_speed"] - 1.0) * 100.0, 1))
			"haste":
				totals.append("-%s%%" % _num((1.0 - after["cooldown_scale"] / before["cooldown_scale"]) * 100.0, 1))
			"magnet":
				totals.append("+%s%%" % _num((after["pickup_radius"] / before["pickup_radius"] - 1.0) * 100.0, 1))
			"regen":
				totals.append("%s/秒" % _num(after["regen"] - before["regen"], 1))
			"luck":
				totals.append("+%s" % _num(after["luck"] - before["luck"], 1))
	player.free()
	return totals


## A perk at every level, from Perks' tables, in one line: what changes by level as a list
## (「5% / 8% / 11% / 14% / 18%」), the rest once.
func _perk_levels(id: String) -> String:
	var levels := range(Upgrades.max_level("passive", id))
	match id:
		"stock":
			return "每撑过 %s 秒，伤害再 +%s" % [_num(Perks.VESTING_SECONDS),
				_by_level(levels.map(func(index: int) -> String: return _percent(Perks.VESTING_MIGHT * (index + 1))))]
		"scapegoat":
			return "挨一下打，把这下伤害的 ×%s 炸给身边 %s 内的怪" % [_by_level(_numbers(Perks.SCAPEGOAT_MULTIPLIER)), _num(Perks.SCAPEGOAT_RADIUS)]
		"cost_cut":
			return "打死的怪 %s 几率爆炸，伤害 %s（半径 %s），炸死的也能再炸" % [
				_by_level(Perks.BLAST_CHANCE.map(_percent)), _by_level(_numbers(Perks.BLAST_DAMAGE)), _num(Perks.BLAST_RADIUS)]
		"open_source":
			return "打死怪 %s 几率留下小炮台：存在 %s 秒，每 %s 秒朝 %s 内的怪打一发（伤害 %s），最多同时 %d 个" % [
				_by_level(Perks.TURRET_CHANCE.map(_percent)), _num(Perks.TURRET_SECONDS), _num(Turret.FIRE_EVERY), _num(Turret.RANGE),
				_num(Turret.SHOT_DAMAGE), Perks.MAX_TURRETS]
		"standup":
			return "每 %s 秒开一次：身边 %s 内的怪受 %s 伤害，被震开、定住 %s 秒" % [
				_by_level(_numbers(Perks.STANDUP_EVERY)), _num(Perks.STANDUP_RADIUS), _by_level(_numbers(Perks.STANDUP_DAMAGE)), _num(Perks.STANDUP_STUN)]
	push_warning("dump: no site wording for perk %s" % id)
	return ""


func _numbers(values: Array) -> Array:
	return values.map(func(value: float) -> String: return _num(value))


func _by_level(values: Array) -> String:
	return " / ".join(values)


## A map's event in numbers (MapEvents' constants), its hits at the map's damage.
func _event_detail(id: String, damage_scale: float) -> String:
	match id:
		"quake":
			return "每 %s 秒在你身边 %s 内落一块碎块，落点先出红圈（半径 %s）%s 秒；砸中你 %s，砸中怪 %s" % [
				_num(MapEvents.QUAKE_STRIKE_GAP), _num(MapEvents.QUAKE_REACH), _num(MapEvents.QUAKE_RADIUS), _num(MapEvents.QUAKE_WARNING),
				_hit(MapEvents.QUAKE_DAMAGE * damage_scale), _hit(MapEvents.QUAKE_CROWD_DAMAGE)]
		"sandstorm":
			# Against the jobs' own walking speeds, so the wind reads as something to lean into.
			var speeds := Jobs.ORDER.map(func(job_id: String) -> float: return Jobs.data(job_id)["speed"])
			return "风一直往东刮：把你每秒吹走 %s（你自己每秒走 %s–%s），小怪每秒 %s，boss 减半" % [
				_num(MapEvents.SAND_PLAYER_SPEED), _num(speeds.min()), _num(speeds.max()), _num(MapEvents.SAND_CROWD_SPEED)]
		"rain":
			return "每 %s 秒在你身边 %s 内开一个水坑（半径 %s–%s，最多同时 %d 个）；在水坑里你慢 %s，小怪慢 %s，boss 只慢一半那么多；雨停 %s 秒后水坑干" % [
				_num(MapEvents.RAIN_PUDDLE_GAP), _num(MapEvents.RAIN_REACH), _num(MapEvents.RAIN_PUDDLE_RADIUS[0]), _num(MapEvents.RAIN_PUDDLE_RADIUS[1]),
				MapEvents.RAIN_MAX_PUDDLES, _percent(MapEvents.RAIN_PLAYER_SLOW), _percent(1.0 - MapEvents.RAIN_CROWD_SLOW), _num(MapEvents.RAIN_DRY)]
		"fog":
			return "只有身边 %s 内看得清，再往外 %s 慢慢变浓（boss 的红色预警照样看得见）；小怪慢 %s，boss 只慢一半那么多；起雾、散雾各 %s 秒" % [
				_num(MapEvents.FOG_CLEAR), _num(MapEvents.FOG_SOFT), _percent(1.0 - MapEvents.FOG_CROWD_SLOW), _num(MapEvents.FOG_FADE)]
		"heat":
			return "站在外面每 %s 秒掉 %s 血（护甲照减）；身边同时有 %d 个蓝色冷气圈（半径 %s，离你 %s–%s），站进去不掉，每个 %s 秒后换地方" % [
				_num(MapEvents.HEAT_TICK), _hit(MapEvents.HEAT_DAMAGE * damage_scale), MapEvents.HEAT_SPOTS, _num(MapEvents.HEAT_SPOT_RADIUS),
				_num(MapEvents.HEAT_SPOT_REACH[0]), _num(MapEvents.HEAT_SPOT_REACH[1]), _num(MapEvents.HEAT_SPOT_LIFE)]
	if id != "":
		push_warning("dump: no site wording for map event %s" % id)
	return ""


## A number as the site shows it: whole when it is, else up to `decimals` places without trailing
## zeros (0.35 s, 16.5). Damage goes through _hit, to one place (15 × 1.13 shows 17, not 16.95).
static func _num(value: float, decimals: int = 2) -> String:
	var rounded := snappedf(value, pow(10.0, -decimals))
	if is_equal_approx(rounded, roundf(rounded)):
		return str(roundi(rounded))
	return String.num(rounded, decimals).rstrip("0").rstrip(".")


static func _hit(value: float) -> String:
	return _num(value, 1)


static func _percent(share: float) -> String:
	return "%s%%" % _num(share * 100.0)
