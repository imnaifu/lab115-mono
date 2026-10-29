class_name Upgrades
extends RefCounted
## The level-up pool: what can be offered next, the copy shown on each card, and applying a
## pick. Weapon card text describes the step to that level; keep it in sync with the stat
## tables in scripts/weapons/ (each entry's `behavior` names the script it runs on).

const MAX_LEVEL := 5
## Passives a run can hold, like the six weapon slots: once six are picked, only those level up.
const MAX_PASSIVES := 6
const BASE_CHOICES := 3
## New-weapon cards every run's first level-ups always include (two, then one). In the live data,
## first-time players who filled up on passives were left with one weapon and died at 2–4
## minutes, while those who took weapons early lived; the novel passives made that trap worse.
const NEW_WEAPONS_GUARANTEED := [2, 1]
## New weapons are marked 推荐 (recommended) until the player carries this many.
const RECOMMEND_UNTIL_WEAPONS := 3

## `type` is the attack type (Jobs.TYPES); `job` marks a weapon only that job can carry (its
## starting weapon), which levels up by BRANCHES instead, so `levels` only describes it. Ordered
## by type, so the pause screen lists them in a stable order.
const WEAPONS := {
	"enter": {"name": "回车键", "art": "enter_key", "behavior": "aimed", "type": "shoot", "job": "coder",
		"levels": ["自动敲向最近的敌人"]},
	"screensaver": {"name": "屏保", "art": "screensaver", "behavior": "bounce", "type": "shoot",
		"levels": ["logo 一直在屏幕里弹来弹去，穿透一切；撞进屏幕角落会炸一圈", "伤害 +4", "多一个 logo，飞得更快", "伤害 +4", "多一个 logo，伤害 +6，飞得更快"]},
	"copy": {"name": "复制粘贴", "art": "paper", "behavior": "facing", "type": "shoot",
		"levels": ["朝面向的方向连发文件，能穿过敌人", "伤害 +4", "多粘贴一份", "伤害 +4", "多粘贴一份，出手更快，穿透 +1"]},
	"keyboard": {"name": "机械键盘", "art": "keyboard", "behavior": "toss", "type": "shoot",
		"levels": ["往上一抛，落下砸穿一切", "多抛一把", "伤害 +10", "多抛一把", "伤害 +10，键盘变大"]},
	"email": {"name": "邮件抄送", "art": "email_cc", "behavior": "ricochet", "type": "shoot",
		"levels": ["朝最近的怪发邮件，在怪之间弹射，抄送 3 个人", "多抄送 1 个", "伤害 +3，发得更勤", "多发一封，多抄送 1 个", "伤害 +3，多抄送 1 个，发得更勤"]},
	"prd": {"name": "PRD 卷筒", "art": "prd_roll", "behavior": "swing", "type": "melee", "job": "pm",
		"levels": ["朝最近的怪抡一扇形，把一片怪打退；升过两次后打中会定住一下"]},
	"poke": {"name": "数位笔", "art": "stylus", "behavior": "poke", "type": "melee", "job": "designer",
		"levels": ["朝面朝的方向戳一下，戳穿一条线；没怪也照戳"]},
	"guides": {"name": "坐标轴", "art": "axes", "behavior": "guides", "type": "area", "job": "data_scientist",
		"levels": ["以你为中心拉出横竖两条贯穿全屏的坐标轴，轴上的怪持续掉血"]},
	"pen": {"name": "钢笔工具", "art": "pen_tool", "behavior": "trail", "type": "area",
		"levels": ["走过的地方留下一条线，碰到的怪持续掉血", "伤害 +2，线更粗、留得更久", "伤害 +2，线更粗、留得更久", "伤害 +2，线更粗、留得更久", "伤害 +4，线粗一半、留 3 秒"]},
	"wifi": {"name": "Wi-Fi 信号", "art": "wifi", "behavior": "aura", "type": "area",
		"levels": ["持续伤害身边的敌人", "信号范围变大", "伤害 +3，频率更高", "信号范围变大", "伤害 +4，范围更大，频率更高"]},
	"cloud": {"name": "云端部署", "art": "cloud", "behavior": "strike", "type": "area",
		"levels": ["从云上劈中屏幕里的敌人", "多劈一道", "伤害 +6，冷却更短", "多劈一道，范围变大", "多劈一道，伤害 +6，冷却更短"]},
	"meeting_room": {"name": "拉会", "art": "meeting_room", "behavior": "zone", "type": "area",
		"levels": ["往怪最多的地方拉个会：圈里的怪变慢、持续掉血", "伤害 +2，会议室更大", "同时多开一个会", "伤害 +2，会议室更大", "再多开一个会，伤害 +3，会议室更大"]},
	"firewall": {"name": "防火墙", "art": "firewall", "behavior": "orbit", "type": "summon", "job": "ops",
		"levels": ["一面墙护着你：身边有怪就飞过去撞开，先打离你最近的"]},
	"drone": {"name": "无人机", "art": "drone", "behavior": "seek", "type": "summon",
		"levels": ["飞出去追着附近的敌人撞", "多一架无人机", "伤害 +4，飞得更快", "多一架无人机", "多一架，伤害 +4，飞得更快"]},
	"outsource": {"name": "外包团队", "art": "outsourcing", "behavior": "squad", "type": "summon",
		"levels": ["招 2 个外包，自己找怪打；被打倒几秒后重新招人", "多招 1 个", "伤害 +3，更抗揍", "多招 1 个", "多招 1 个，伤害 +3，更抗揍"]},
}

## A weapon at full level evolves at the next funding bag while the player carries its passive
## (any level), Vampire Survivors style.
const EVOLUTIONS := {
	"enter": {"passive": "haste", "name": "Shift+Enter 批量提交", "text": "每轮朝屏幕里的敌人各敲一下"},
	"copy": {"passive": "headhunter", "name": "Ctrl+A 全选粘贴", "text": "朝 8 个方向一起粘贴"},
	"screensaver": {"passive": "armor", "name": "动态壁纸", "text": "每次碰到屏幕边缘都炸一圈"},
	"prd": {"passive": "standup", "name": "需求评审会", "text": "每次都抡满一圈，范围更大，定得更久"},
	"poke": {"passive": "magnet", "name": "多点触控", "text": "每次朝 12 个方向一起戳，线长 +20%"},
	"guides": {"passive": "open_source", "name": "实时看板", "text": "坐标轴不再消失，一直留到下一组画出来"},
	"pen": {"passive": "swiftness", "name": "矢量图层", "text": "线留两倍久；画个圈，圈里的怪受一次重击"},
	"wifi": {"passive": "regen", "name": "5G 基站", "text": "范围更大，打中怪就回一点血"},
	"cloud": {"passive": "might", "name": "多云多活", "text": "劈的道数翻倍，范围翻倍"},
	"firewall": {"passive": "armor", "name": "零信任", "text": "6 面墙，撞到的怪定住 0.4 秒"},
	"drone": {"passive": "cost_cut", "name": "无人车车队", "text": "换成横冲直撞的无人车，伤害更高，撞飞"},
}

## A job's own weapon levels up along one of two directions each time, the player's pick: its
## level-up comes as a pair of cards, one per direction. `a` and `b` count up the weapon's
## branch_a / branch_b; four upgrades in all, in any mix, still take it to MAX_LEVEL.
const BRANCHES := {
	"enter": {"a": {"name": "更多", "text": "每轮多敲一下"}, "b": {"name": "更大", "text": "按键变大，伤害 +6，穿透 +1"}},
	"prd": {"a": {"name": "更长", "text": "抡得更远，伤害 +6，出手更快"}, "b": {"name": "更宽", "text": "扇形更宽（四次就是一整圈），伤害 +6，出手更快"}},
	"firewall": {"a": {"name": "更多", "text": "多一面墙"}, "b": {"name": "更硬", "text": "墙更大，伤害 +7，推得更远"}},
	"guides": {"a": {"name": "更多网格线", "text": "横竖各多一条网格线"}, "b": {"name": "更粗更久", "text": "线更粗、留得更久，伤害 +2"}},
	"poke": {"a": {"name": "更多方向", "text": "多戳几个方向（前 → 前后 → 四向 → 六向 → 八向），伤害 +3"}, "b": {"name": "更多次数", "text": "一轮多戳一下，伤害 +3"}},
}

const PASSIVES := {
	"might": {"name": "冰美式", "art": "coffee", "text": "所有伤害 +10%"},
	"armor": {"name": "降噪耳机", "art": "headphones", "text": "受到的伤害 -1"},
	"vitality": {"name": "撸铁", "art": "dumbbell", "text": "最大生命 +20，并回复 20"},
	"swiftness": {"name": "电动滑板", "art": "scooter", "text": "移动速度 +8%"},
	"haste": {"name": "双屏显示器", "art": "monitors", "text": "武器冷却 -8%"},
	"magnet": {"name": "人脉名片", "art": "card", "text": "拾取范围 +30%"},
	"regen": {"name": "工位绿植", "art": "plant", "text": "每秒回复 0.3 生命"},
	# The rest act rather than add a number; Perks runs them. `max` caps one below MAX_LEVEL.
	"stock": {"name": "股票期权", "art": "stock_options", "text": "每撑过 1 分钟，伤害再 +2%（越早拿越赚）"},
	"scapegoat": {"name": "背锅侠", "art": "scapegoat", "text": "挨打时把锅甩出去，炸伤身边的怪"},
	"cost_cut": {"name": "降本增效", "art": "cost_cut", "text": "打死的怪有几率爆炸，还能连环炸"},
	"open_source": {"name": "开源项目", "art": "turret", "text": "打死怪有几率留下小炮台，自动打怪 8 秒"},
	"standup": {"name": "站会", "art": "standup", "text": "每隔一阵开站会，震开并定住身边的怪"},
	"nap": {"name": "午休", "art": "nap", "text": "站着不动 1 秒后，快速回血"},
	"headhunter": {"name": "猎头电话", "art": "headhunter", "text": "升级时多 1 个选项", "max": 2},
}

## The names the weapon stats go by on cards, most telling first; a card shows at most
## MAX_STATS_SHOWN of the ones that change (its text already sums up the step), so five narrow
## cards side by side still fit.
const WEAPON_STAT_NAMES := {"damage": "伤害", "count": "数量", "pierce": "穿透", "radius": "范围",
	"range": "长度", "arc": "角度", "times": "次数", "speed": "速度", "size": "大小", "duration": "持续", "cooldown": "间隔"}
const MAX_STATS_SHOWN := 2

## Offered only when everything else is maxed out.
const FALLBACK := {"kind": "heal", "id": "heal", "level": 0, "name": "摸鱼一会儿", "art": "boba", "text": "回复 30 生命"}

var passive_levels := {}
var _game: Game
## Level-ups offered so far this run (for NEW_WEAPONS_GUARANTEED).
var _offers := 0


func _init(game: Game) -> void:
	_game = game


static func create_weapon(weapon_id: String) -> Weapon:
	var entry: Dictionary = WEAPONS[weapon_id]
	var weapon: Weapon
	match entry["behavior"]:
		"aimed":
			weapon = AimedWeapon.new()
		"facing":
			weapon = FacingWeapon.new()
		"seek":
			weapon = SeekerWeapon.new()
		"strike":
			weapon = StrikeWeapon.new()
		"toss":
			weapon = TossWeapon.new()
		"aura":
			weapon = AuraWeapon.new()
		"swing":
			weapon = SwingWeapon.new()
		"trail":
			weapon = TrailWeapon.new()
		"orbit":
			weapon = OrbitWeapon.new()
		"bounce":
			weapon = BounceWeapon.new()
		"guides":
			weapon = GuideWeapon.new()
		"poke":
			weapon = PokeWeapon.new()
		"zone":
			weapon = ZoneWeapon.new()
		"squad":
			weapon = SquadWeapon.new()
		"ricochet":
			weapon = RicochetWeapon.new()
		_:
			push_error("Unknown weapon behavior: %s" % entry["behavior"])
			return null
	weapon.id = weapon_id
	weapon.art = entry["art"]
	return weapon


## The cards for a level-up.
func roll_choices(count: int) -> Array:
	var guaranteed: int = NEW_WEAPONS_GUARANTEED[_offers] if _offers < NEW_WEAPONS_GUARANTEED.size() else 0
	_offers += 1
	var picked := _roll(count, guaranteed)
	var carried := _game.player.weapons.size()
	for choice: Dictionary in picked:
		if choice["kind"] == "weapon" and choice["level"] == 1 and carried < RECOMMEND_UNTIL_WEAPONS:
			choice["recommended"] = true
	return picked


## A funding bag's upgrades (Game.FUNDING_ROUNDS), applied at once. Like Vampire Survivors'
## chests they level up what the player already carries; only once all of that is at its cap do
## new things come out.
##
## A weapon ready to evolve (EVOLUTIONS) evolves first, as one of the bag's items.
func open_chest(count: int) -> Array:
	var items: Array = []
	var ready := evolvable()
	if not ready.is_empty():
		var weapon: Weapon = ready[0]
		weapon.evolve()
		items.append(_evolution_item(weapon.id))
		count -= 1
	for i in count:
		var carried: Array = []
		for weapon in _game.player.weapons:
			if weapon.level < MAX_LEVEL:
				# A job's own weapon goes up one of its two directions, picked at random.
				carried.append(_branch_choice(weapon.id, "a" if _game.rng.randf() < 0.5 else "b") if BRANCHES.has(weapon.id) \
					else _choice("weapon", weapon.id, weapon.level + 1))
		for passive_id: String in passive_levels:
			if passive_levels[passive_id] < max_level("passive", passive_id):
				carried.append(_choice("passive", passive_id, passive_levels[passive_id] + 1))
		var item: Dictionary = carried[_game.rng.randi() % carried.size()] if not carried.is_empty() else _roll(1, 0)[0]
		apply(item)
		items.append(item)
	return items


## Weapons at full level, not evolved yet, whose passive the player carries.
func evolvable() -> Array[Weapon]:
	var ready: Array[Weapon] = []
	for weapon in _game.player.weapons:
		if weapon.evolved or weapon.level < MAX_LEVEL or not EVOLUTIONS.has(weapon.id):
			continue
		if passive_levels.has(EVOLUTIONS[weapon.id]["passive"]):
			ready.append(weapon)
	return ready


func _evolution_item(weapon_id: String) -> Dictionary:
	var evolution: Dictionary = EVOLUTIONS[weapon_id]
	return {"kind": "evolve", "id": weapon_id, "level": MAX_LEVEL, "max": MAX_LEVEL,
		"name": evolution["name"], "art": WEAPONS[weapon_id]["art"], "text": evolution["text"]}


## The weapons a job can ever carry: every shared one plus its own.
static func weapons_for(job: String) -> Array[String]:
	var ids: Array[String] = []
	for weapon_id: String in WEAPONS:
		var owner: String = WEAPONS[weapon_id].get("job", "")
		if owner == "" or owner == job:
			ids.append(weapon_id)
	return ids


## A weapon's name, its evolved one once it has evolved.
static func weapon_name(weapon_id: String, is_evolved: bool) -> String:
	return EVOLUTIONS[weapon_id]["name"] if is_evolved and EVOLUTIONS.has(weapon_id) else WEAPONS[weapon_id]["name"]


## Whether the player's weapon with this id has evolved.
func is_evolved(weapon_id: String) -> bool:
	var weapon := _game.player.get_weapon(weapon_id)
	return weapon != null and weapon.evolved


## `count` cards from the weighted pool, the first `new_weapons` of them weapons not yet carried
## (as many as there are). The fallback card when the pool is empty.
func _roll(count: int, new_weapons: int) -> Array:
	var pool: Array = []
	var weights := PackedFloat32Array()
	var player := _game.player
	var slots_left := player.weapons.size() < Jobs.MAX_WEAPONS
	for weapon_id in weapons_for(player.job):
		var weapon := player.get_weapon(weapon_id)
		if weapon == null:
			if slots_left:
				pool.append(_choice("weapon", weapon_id, 1))
				weights.append(2.0)
		elif weapon.level < MAX_LEVEL:
			# Upgrading what you already carry is favoured so builds come together. The job's own
			# weapon stands in as one entry and comes out as its pair of direction cards.
			pool.append({"kind": "pair", "id": weapon_id} if BRANCHES.has(weapon_id) else _choice("weapon", weapon_id, weapon.level + 1))
			weights.append(3.0)
	var passive_slots_full := passive_levels.size() >= MAX_PASSIVES
	for passive_id: String in PASSIVES:
		var current: int = passive_levels.get(passive_id, 0)
		if current == 0 and passive_slots_full:
			continue
		if current < max_level("passive", passive_id):
			pool.append(_choice("passive", passive_id, current + 1))
			weights.append(2.0)

	var picked: Array = []
	for i in mini(new_weapons, count):
		var fresh: Array[int] = []
		var fresh_weights := PackedFloat32Array()
		for index in pool.size():
			if pool[index]["kind"] == "weapon" and pool[index]["level"] == 1:
				fresh.append(index)
				fresh_weights.append(weights[index])
		if fresh.is_empty():
			break
		var index := fresh[_game.rng.rand_weighted(fresh_weights)]
		picked.append(pool[index])
		pool.remove_at(index)
		weights.remove_at(index)
	while picked.size() < count and not pool.is_empty():
		var index := _game.rng.rand_weighted(weights)
		var entry: Dictionary = pool[index]
		pool.remove_at(index)
		weights.remove_at(index)
		if entry["kind"] != "pair":
			picked.append(entry)
		elif picked.size() + 2 <= count:
			picked.append(_branch_choice(entry["id"], "a"))
			picked.append(_branch_choice(entry["id"], "b"))
		# A pair drawn for the last card is left out: half of one would be no choice.
	if picked.is_empty():
		picked.append(FALLBACK)
	# The guaranteed weapons shouldn't always sit in the first slots; a pair stays side by side.
	_shuffle(picked)
	_pair_up(picked)
	return picked


## Moves a weapon's second direction card right after its first.
func _pair_up(cards: Array) -> void:
	for i in cards.size():
		if cards[i].get("branch", "") != "a":
			continue
		for j in cards.size():
			if j != i and cards[j]["id"] == cards[i]["id"] and cards[j].get("branch", "") == "b":
				var partner = cards[j]
				cards.remove_at(j)
				cards.insert(i + 1 if j > i else i, partner)
				return


func _shuffle(items: Array) -> void:
	for i in range(items.size() - 1, 0, -1):
		var other := _game.rng.randi_range(0, i)
		var held = items[i]
		items[i] = items[other]
		items[other] = held


## How many cards a level-up offers: three, plus one per level of the headhunter perk.
func choice_count() -> int:
	return BASE_CHOICES + passive_levels.get("headhunter", 0)


static func max_level(kind: String, choice_id: String) -> int:
	if kind == "passive":
		return PASSIVES[choice_id].get("max", MAX_LEVEL)
	return MAX_LEVEL


func apply(choice: Dictionary) -> void:
	var player := _game.player
	match choice["kind"]:
		"weapon":
			var weapon := player.get_weapon(choice["id"])
			if weapon == null:
				player.add_weapon(create_weapon(choice["id"]))
			else:
				weapon.level_up(choice.get("branch", ""))
		"passive":
			passive_levels[choice["id"]] = passive_levels.get(choice["id"], 0) + 1
			_apply_passive(choice["id"])
		"heal":
			player.heal(30.0)


func _apply_passive(passive_id: String) -> void:
	var player := _game.player
	match passive_id:
		"might":
			player.might += 0.1
		"armor":
			player.armor += 1.0
		"vitality":
			player.max_hp += 20.0
			player.heal(20.0)
		"swiftness":
			player.move_speed *= 1.08
		"haste":
			player.cooldown_scale *= 0.92
		"magnet":
			player.pickup_radius *= 1.3
		"regen":
			player.regen += 0.3


## What a card changes, in numbers ("伤害 14 → 18 · 数量 1 → 2"), already translated: a weapon's
## stats that change at that level (just its damage for a new one), a passive's total before and
## after. Damage and gaps include the player's current bonuses, so they match the numbers that
## pop up in play.
func numbers(choice: Dictionary) -> String:
	var next_level: int = choice["level"]
	match choice["kind"]:
		"weapon":
			var weapon_id: String = choice["id"]
			var after: Dictionary
			var before: Dictionary
			if choice.has("branch"):
				var weapon := _game.player.get_weapon(weapon_id)
				var more_a := 1 if choice["branch"] == "a" else 0
				before = branch_stats(weapon_id, weapon.branch_a, weapon.branch_b)
				after = branch_stats(weapon_id, weapon.branch_a + more_a, weapon.branch_b + 1 - more_a)
			else:
				after = weapon_stats(weapon_id, next_level)
				if next_level == 1:
					return _step("伤害", "", _shown_stat("damage", after["damage"], weapon_id))
				before = weapon_stats(weapon_id, next_level - 1)
			var parts := PackedStringArray()
			for stat_key: String in WEAPON_STAT_NAMES:
				if after.has(stat_key) and after[stat_key] != before[stat_key] and parts.size() < MAX_STATS_SHOWN:
					parts.append(_step(WEAPON_STAT_NAMES[stat_key], _shown_stat(stat_key, before[stat_key], weapon_id), _shown_stat(stat_key, after[stat_key], weapon_id)))
			# Where the weapon goes from full level, so players learn evolutions exist.
			if next_level == MAX_LEVEL and EVOLUTIONS.has(weapon_id):
				var passive_name: String = PASSIVES[EVOLUTIONS[weapon_id]["passive"]]["name"]
				parts.append(tr("配「%s」可进化") % tr(passive_name))
			return " · ".join(parts)
		"passive":
			return _passive_numbers(choice["id"], next_level)
	return ""


## A weapon's numbers at a level, read from its script's own tables so cards can't drift from
## what the weapon does. `cooldown` is seconds between attacks, `size` a scale.
static func weapon_stats(weapon_id: String, weapon_level: int) -> Dictionary:
	var i := weapon_level - 1
	match WEAPONS[weapon_id]["behavior"]:
		"facing":
			return {"damage": FacingWeapon.DAMAGE[i], "count": FacingWeapon.COUNT[i], "pierce": FacingWeapon.PIERCE[i], "cooldown": FacingWeapon.COOLDOWN[i]}
		"seek":
			return {"damage": SeekerWeapon.DAMAGE[i], "count": SeekerWeapon.COUNT[i], "speed": SeekerWeapon.SPEED[i]}
		"strike":
			return {"damage": StrikeWeapon.DAMAGE[i], "count": StrikeWeapon.COUNT[i], "radius": StrikeWeapon.SPLASH_RADIUS[i], "cooldown": StrikeWeapon.COOLDOWN[i]}
		"toss":
			return {"damage": TossWeapon.DAMAGE[i], "count": TossWeapon.COUNT[i], "size": TossWeapon.SIZE[i]}
		"aura":
			return {"damage": AuraWeapon.DAMAGE[i], "radius": AuraWeapon.RADIUS[i], "cooldown": AuraWeapon.TICK_SECONDS[i]}
		"trail":
			return {"damage": TrailWeapon.DAMAGE[i], "size": TrailWeapon.WIDTH[i] / TrailWeapon.WIDTH[0]}
		"bounce":
			return {"damage": BounceWeapon.DAMAGE[i], "count": BounceWeapon.COUNT[i], "speed": BounceWeapon.SPEED[i]}
		"zone":
			return {"damage": ZoneWeapon.DAMAGE[i], "count": ZoneWeapon.COUNT[i], "radius": ZoneWeapon.RADIUS[i]}
		"squad":
			return {"damage": SquadWeapon.DAMAGE[i], "count": SquadWeapon.COUNT[i]}
		"ricochet":
			return {"damage": RicochetWeapon.DAMAGE[i], "count": RicochetWeapon.BOUNCES[i], "cooldown": RicochetWeapon.COOLDOWN[i]}
	return {}


## A job's own weapon's numbers after `a` and `b` upgrades in its two directions (BRANCHES).
static func branch_stats(weapon_id: String, a: int, b: int) -> Dictionary:
	match WEAPONS[weapon_id]["behavior"]:
		"aimed":
			return AimedWeapon.branch_stats(a, b)
		"swing":
			return SwingWeapon.branch_stats(a, b)
		"orbit":
			return OrbitWeapon.branch_stats(a, b)
		"guides":
			return GuideWeapon.branch_stats(a, b)
		"poke":
			return PokeWeapon.branch_stats(a, b)
	return {}


func _shown_stat(stat_key: String, value: Variant, weapon_id: String) -> String:
	var player := _game.player
	match stat_key:
		"damage":
			return str(roundi(value * player.might))
		"cooldown":
			return tr("%s 秒") % _short_float(value * player.cooldown_scale)
		"size":
			return "×%s" % _short_float(value)
		"arc":
			return "%d°" % roundi(value)
		"duration":
			return tr("%s 秒") % _short_float(value)
	return str(roundi(value))


func _passive_numbers(passive_id: String, next_level: int) -> String:
	var player := _game.player
	var current := next_level - 1
	match passive_id:
		"might":
			return _step("伤害", "+%d%%" % roundi((player.might - 1.0) * 100.0), "+%d%%" % roundi((player.might - 0.9) * 100.0))
		"armor":
			return _step("护甲", str(roundi(player.armor)), str(roundi(player.armor + 1.0)))
		"vitality":
			return _step("生命上限", str(roundi(player.max_hp)), str(roundi(player.max_hp + 20.0)))
		"swiftness":
			return _step("移速", _percent_over(player.move_speed / player.base_move_speed), _percent_over(player.move_speed * 1.08 / player.base_move_speed))
		"haste":
			return _step("冷却", "-%d%%" % roundi((1.0 - player.cooldown_scale) * 100.0), "-%d%%" % roundi((1.0 - player.cooldown_scale * 0.92) * 100.0))
		"magnet":
			return _step("拾取", _percent_over(player.pickup_radius / Player.BASE_PICKUP_RADIUS), _percent_over(player.pickup_radius * 1.3 / Player.BASE_PICKUP_RADIUS))
		"regen":
			return _step("回血", tr("%s/秒") % _short_float(player.regen), tr("%s/秒") % _short_float(player.regen + 0.3))
		"stock":
			return _step("每分钟伤害", "+%d%%" % roundi(Perks.VESTING_MIGHT * current * 100.0), "+%d%%" % roundi(Perks.VESTING_MIGHT * next_level * 100.0))
		"scapegoat":
			return _perk_step("反伤", Perks.SCAPEGOAT_MULTIPLIER, current, next_level, "×%s")
		"cost_cut":
			return _perk_step("爆炸几率", Perks.BLAST_CHANCE, current, next_level, "%s%%", 100.0)
		"open_source":
			return _perk_step("炮台几率", Perks.TURRET_CHANCE, current, next_level, "%s%%", 100.0)
		"standup":
			return _perk_step("站会间隔", Perks.STANDUP_EVERY, current, next_level, tr("%s 秒"))
		"nap":
			return _perk_step("午休回血", Perks.NAP_REGEN, current, next_level, tr("%s/秒"))
		"headhunter":
			return _step("选项", str(BASE_CHOICES + current), str(BASE_CHOICES + next_level))
	return ""


## A perk's value from its per-level table, before and after; just the new value at level 1.
func _perk_step(stat_name: String, table: Array, current: int, next_level: int, value_format: String, scale: float = 1.0) -> String:
	var after: String = value_format % _short_float(table[next_level - 1] * scale)
	if current == 0:
		return _step(stat_name, "", after)
	return _step(stat_name, value_format % _short_float(table[current - 1] * scale), after)


## "name before → after", or "name after" with no before (or one of nothing, like "+0%").
func _step(stat_name: String, before: String, after: String) -> String:
	if before in ["", "0", "+0%", "-0%"]:
		return "%s %s" % [tr(stat_name), after]
	return "%s %s → %s" % [tr(stat_name), before, after]


## A multiplier over the base as "+8%".
static func _percent_over(ratio: float) -> String:
	return "+%d%%" % roundi((ratio - 1.0) * 100.0)


## 1.5 as "1.5", 2.0 as "2", rounded to one decimal.
static func _short_float(value: float) -> String:
	var rounded := snappedf(value, 0.1)
	return str(roundi(rounded)) if is_equal_approx(rounded, roundf(rounded)) else "%.1f" % rounded


## A job weapon's card for one direction: its name and text, `branch` for apply().
func _branch_choice(weapon_id: String, branch: String) -> Dictionary:
	var weapon := _game.player.get_weapon(weapon_id)
	var direction: Dictionary = BRANCHES[weapon_id][branch]
	var choice := _choice("weapon", weapon_id, weapon.level + 1)
	choice["branch"] = branch
	choice["branch_name"] = direction["name"]
	choice["text"] = direction["text"]
	return choice


## A card. Weapon cards also carry their `type` (the card's type tag).
func _choice(kind: String, choice_id: String, next_level: int) -> Dictionary:
	var table: Dictionary = WEAPONS[choice_id] if kind == "weapon" else PASSIVES[choice_id]
	var text: String = table["levels"][mini(next_level, table["levels"].size()) - 1] if kind == "weapon" else table["text"]
	var choice := {"kind": kind, "id": choice_id, "level": next_level, "max": max_level(kind, choice_id),
		"name": table["name"], "art": table["art"], "text": text}
	if kind == "weapon":
		choice["type"] = table["type"]
	return choice
