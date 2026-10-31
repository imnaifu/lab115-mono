class_name Upgrades
extends RefCounted
## The level-up pool: what can be offered next, the copy shown on each card, and applying a
## pick. Weapon card text describes the step to that level; keep it in sync with the stat
## tables in scripts/weapons/ (each entry's `behavior` names the script it runs on).

const MAX_LEVEL := 5
## Passives a run can hold, like the six weapon slots: once six are picked, only those level up.
const MAX_PASSIVES := 6
const BASE_CHOICES := 3
## Most cards a level-up shows: the three, plus luck's one now and then. (猎头电话 added up to two
## more until .35, when the user had it taken out: few took it, it did little.)
const MAX_CHOICES := 4
## New-weapon cards every run's first level-ups always include (two, then one). In the live data,
## first-time players who filled up on passives were left with one weapon and died at 2–4
## minutes, while those who took weapons early lived; the novel passives made that trap worse.
const NEW_WEAPONS_GUARANTEED := [2, 1]
## New weapons are marked 推荐 (recommended) until the player carries this many.
const RECOMMEND_UNTIL_WEAPONS := 3
## The level-ups at which the job's own weapon always comes up, its pair of direction cards plus
## the rest rolled as usual (Hades' hammer, Deep Rock's overclocks): left to the weighted pool it
## came up at 7% of level-ups in the live data, 2-4 times in a whole run, and was taken every
## time. Four to begin with, as many as it had upgrades; .35 added 20 and 25 when each direction
## got its own four (eight in all; the rest come up in between, as before).
const JOB_WEAPON_LEVELS := [3, 6, 10, 15, 20, 25]

## Card rarity (白 / 绿 / 蓝 / 紫 / 橙): every weapon and passive card rolls one, and the rarer it is
## the more its step gives, the level still going up by one. `scale` multiplies a stat passive's
## step (stat_step: 冰美式 +10% common, +12% green); `weapon_bonus` adds to that weapon's own
## damage for good (Weapon.damage_bonus); a table perk (Perks: 股票期权, 背锅侠…) reads its
## numbers off per-level tables instead, so it jumps `extra_levels` more and only rolls 普通, 史诗
## (+1) and 传说 (+2): whole levels can't be split finer, and that way a rarer card still always
## gives more, about as much more on average as a stat passive's. `weight` is the chance in percent with no
## luck (Player.luck, see luck_factor). Frequent and modest on purpose: about half the cards have
## a colour, none of them swings a run on its own. .33 took the rarer tiers down a little at the
## user's ask (was 45 / 32 / 15 / 6 / 2): epic and legendary also level table perks up faster.
const RARITIES := [
	{"id": "common", "name": "普通", "weight": 65.0, "scale": 1.0, "weapon_bonus": 0.0, "extra_levels": 0},
	{"id": "uncommon", "name": "优秀", "weight": 24.0, "scale": 1.15, "weapon_bonus": 0.04, "extra_levels": 0},
	{"id": "rare", "name": "稀有", "weight": 8.0, "scale": 1.3, "weapon_bonus": 0.08, "extra_levels": 0},
	{"id": "epic", "name": "史诗", "weight": 2.5, "scale": 1.6, "weapon_bonus": 0.12, "extra_levels": 1},
	{"id": "legendary", "name": "传说", "weight": 0.5, "scale": 2.0, "weapon_bonus": 0.2, "extra_levels": 2},
]
## The passives that add a number, by how much at common rarity (percent for the multipliers);
## the card text has it as %s. The rest are table perks.
const STAT_STEPS := {"might": 10.0, "armor": 1.0, "vitality": 20.0, "swiftness": 8.0, "haste": 8.0,
	"magnet": 30.0, "regen": 0.3, "luck": 20.0}
## What a scaled step is rounded to (1 unless listed), so cards show clean numbers and give exactly
## what they show: 冰美式 ×1.15 is +12%, not +11.5%, and 工位绿植's 0.345 is 0.35, not a 0.3 that
## reads the same as a common card.
const STEP_SNAP := {"armor": 0.1, "regen": 0.05}

## `type` is the attack type (Jobs.TYPES); `job` marks a weapon only that job can carry (its
## starting weapon), which levels up by BRANCHES instead, so `levels` only describes it. Ordered
## by type, so the pause screen lists them in a stable order.
const WEAPONS := {
	"enter": {"name": "回车键", "art": "enter_key", "behavior": "aimed", "type": "shoot", "job": "coder",
		"levels": ["自动敲向最近的敌人"]},
	"screensaver": {"name": "屏保", "art": "screensaver", "behavior": "bounce", "type": "shoot",
		"levels": ["logo 一直在屏幕里弹来弹去，穿透一切；撞进屏幕角落会炸一圈", "伤害 +4", "多一个 logo，飞得更快", "伤害 +4", "多一个 logo，伤害 +6，飞得更快"]},
	"copy": {"name": "复制粘贴", "art": "paper", "behavior": "facing", "type": "shoot",
		"levels": ["朝面向的方向连发文件，能穿过敌人", "伤害 +4", "多粘贴一份", "伤害 +4", "多粘贴一份，伤害 +7，穿透 +1"]},
	"keyboard": {"name": "机械键盘", "art": "keyboard", "behavior": "toss", "type": "shoot",
		"levels": ["往上一抛，落下砸穿一切", "多抛一把", "伤害 +10", "多抛一把", "伤害 +10，键盘变大"]},
	"email": {"name": "邮件抄送", "art": "email_cc", "behavior": "ricochet", "type": "shoot",
		"levels": ["朝最近的怪发邮件，在怪之间弹射，抄送 3 个人", "多抄送 1 个", "伤害 +5", "多发一封，多抄送 1 个", "伤害 +6，多抄送 1 个"]},
	"prd": {"name": "PRD 卷筒", "art": "prd_roll", "behavior": "swing", "type": "melee", "job": "pm",
		"levels": ["朝最近的怪抡一扇形，扇形里的怪都挨打"]},
	"poke": {"name": "数位笔", "art": "stylus", "behavior": "poke", "type": "melee", "job": "designer",
		"levels": ["朝最近的怪戳一下，只打最前面的一只；没怪也照戳"]},
	"guides": {"name": "坐标轴", "art": "axes", "behavior": "guides", "type": "area", "job": "data_scientist",
		"levels": ["以你为中心拉出横竖两条贯穿全屏的坐标轴，轴上的怪持续掉血"]},
	"pen": {"name": "钢笔工具", "art": "pen_tool", "behavior": "trail", "type": "area",
		"levels": ["走过的地方留下一条线，碰到的怪持续掉血", "伤害 +2，线更粗、留得更久", "伤害 +2，线更粗、留得更久", "伤害 +2，线更粗、留得更久", "伤害 +4，线粗一半、留 3 秒"]},
	"wifi": {"name": "Wi-Fi 信号", "art": "wifi", "behavior": "aura", "type": "area",
		"levels": ["持续伤害身边的敌人", "信号范围变大", "伤害 +5", "信号范围变大", "伤害 +9，范围更大"]},
	"cloud": {"name": "云端部署", "art": "cloud", "behavior": "strike", "type": "area",
		"levels": ["从云上劈中身边一大圈里的敌人", "多劈一道", "伤害 +8", "多劈一道，范围变大", "多劈一道，伤害 +12"]},
	"meeting_room": {"name": "拉会", "art": "meeting_room", "behavior": "zone", "type": "area",
		"levels": ["往怪最多的地方拉个会：圈里的怪变慢、持续掉血", "伤害 +2，会议室更大", "同时多开一个会", "伤害 +2，会议室更大", "再多开一个会，伤害 +3，会议室更大"]},
	"firewall": {"name": "防火墙", "art": "firewall", "behavior": "orbit", "type": "summon", "job": "ops",
		"levels": ["一面墙护着你：身边有怪就飞过去撞开，先打离你最近的"]},
	"drone": {"name": "无人机", "art": "drone", "behavior": "bomber", "type": "summon",
		"levels": ["飞到怪最多的地方扔炸弹，炸一片", "多一架无人机", "伤害 +4，炸得更大", "多一架无人机", "多一架，伤害 +5，炸得更大"]},
	"outsource": {"name": "外包团队", "art": "outsourcing", "behavior": "squad", "type": "summon",
		"levels": ["招 2 个外包站在你身边，附近的怪会先去打他们；被打倒几秒后重新招人", "多招 1 个", "更抗揍，伤害 +3", "多招 1 个", "多招 1 个，更抗揍，伤害 +3"]},
}

## A weapon at full level evolves at the next year-end bonus while the player carries its passive
## (any level), Vampire Survivors style, while EVOLUTION_ON.
##
## Switched off from .27, to be redesigned: no chest evolves a weapon, no card says 配「X」可进化,
## and the achievement for one is hidden (Achievements.shown). The table and each weapon's evolved
## form stay, for that redesign and the bot's --evolve.
const EVOLUTION_ON := false
const EVOLUTIONS := {
	"enter": {"passive": "haste", "name": "Shift+Enter 批量提交", "text": "每轮朝屏幕里的敌人各敲一下"},
	# Its partner 猎头电话 is gone (.35); give it another when evolutions come back.
	"copy": {"passive": "headhunter", "name": "Ctrl+A 全选粘贴", "text": "朝 8 个方向一起粘贴"},
	"screensaver": {"passive": "armor", "name": "动态壁纸", "text": "每次碰到屏幕边缘都炸一圈"},
	"prd": {"passive": "standup", "name": "需求评审会", "text": "每次都抡满一圈，范围更大，定得更久"},
	"poke": {"passive": "magnet", "name": "多点触控", "text": "每次朝 12 个方向一起戳，线长 +20%"},
	"guides": {"passive": "open_source", "name": "实时看板", "text": "坐标轴不再消失，一直留到下一组画出来"},
	"pen": {"passive": "swiftness", "name": "矢量图层", "text": "线留两倍久；画个圈，圈里的怪受一次重击"},
	"wifi": {"passive": "regen", "name": "5G 基站", "text": "范围更大，打中怪就回一点血"},
	"cloud": {"passive": "might", "name": "多云多活", "text": "劈的道数翻倍，范围翻倍"},
	"firewall": {"passive": "armor", "name": "零信任", "text": "6 面墙，撞到的怪定住 0.4 秒"},
	"drone": {"passive": "cost_cut", "name": "集束轰炸", "text": "每颗炸弹落地再炸出 3 颗小炸弹"},
}

## A job's own weapon levels up along one of two directions each time, the player's pick: its
## level-up comes as a pair of cards, one per direction. `a` and `b` count up the weapon's
## branch_a / branch_b, each on its own up to BRANCH_MAX (.35, the user's call: until then four
## upgrades in all, in any mix, took it to MAX_LEVEL, so going all one way shut the other).
const BRANCH_MAX := 4
const BRANCHES := {
	"enter": {"a": {"name": "更多", "text": "每轮多敲一下"}, "b": {"name": "更大", "text": "按键变大，伤害 +4"}},
	"prd": {"a": {"name": "更长", "text": "抡得更远，伤害 +13"}, "b": {"name": "更宽", "text": "扇形更宽（四次到 180°），伤害 +13"}},
	"firewall": {"a": {"name": "更多", "text": "多一面墙"}, "b": {"name": "更硬", "text": "墙更大，伤害 +14"}},
	"guides": {"a": {"name": "更多网格线", "text": "横竖各多一条网格线"}, "b": {"name": "更粗更久", "text": "线更粗、留得更久，伤害 +1.5"}},
	"poke": {"a": {"name": "更多方向", "text": "多戳几个方向（前 → 前后 → 四向 → 六向 → 八向），伤害 +1"}, "b": {"name": "更多次数", "text": "一轮多戳一下，伤害 +1"}},
}

const PASSIVES := {
	"might": {"name": "冰美式", "art": "coffee", "text": "所有伤害 +%s%%"},
	"armor": {"name": "降噪耳机", "art": "headphones", "text": "受到的伤害 -%s"},
	"vitality": {"name": "撸铁", "art": "dumbbell", "text": "最大生命 +%s，并回复 %s"},
	"swiftness": {"name": "电动滑板", "art": "scooter", "text": "移动速度 +%s%%"},
	"haste": {"name": "双屏显示器", "art": "monitors", "text": "武器冷却 -%s%%"},
	"magnet": {"name": "人脉名片", "art": "card", "text": "拾取范围 +%s%%"},
	"regen": {"name": "工位绿植", "art": "plant", "text": "每秒回复 %s 生命"},
	"luck": {"name": "锦鲤", "art": "koi", "text": "运气 +%s：升级时可能多一张卡，卡和年终奖更容易出好的"},
	# The rest act rather than add a number; Perks runs them. `max` caps one below MAX_LEVEL.
	"stock": {"name": "股票期权", "art": "stock_options", "text": "每撑过 1 分钟，伤害再 +2%（越早拿越赚）"},
	"scapegoat": {"name": "背锅侠", "art": "scapegoat", "text": "挨打时把锅甩出去，炸伤身边的怪"},
	"cost_cut": {"name": "降本增效", "art": "cost_cut", "text": "打死的怪有几率爆炸，还能连环炸"},
	"open_source": {"name": "开源项目", "art": "turret", "text": "打死怪有几率留下小炮台，自动打怪 8 秒"},
	"standup": {"name": "站会", "art": "standup", "text": "每隔一阵开站会，震开并定住身边的怪"},
	"nap": {"name": "午休", "art": "nap", "text": "站着不动 1 秒后，快速回血"},
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
		"bomber":
			weapon = BomberWeapon.new()
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


## The cards for the level-up to `for_level`. At JOB_WEAPON_LEVELS the job's own weapon's pair of
## direction cards comes first, marked `milestone`, and the rest are rolled as usual without it.
func roll_choices(count: int, for_level: int = 0) -> Array:
	var guaranteed: int = NEW_WEAPONS_GUARANTEED[_offers] if _offers < NEW_WEAPONS_GUARANTEED.size() else 0
	_offers += 1
	var job_pair := _job_pair_due(for_level)
	var picked := _roll(count - job_pair.size(), guaranteed, "" if job_pair.is_empty() else job_pair[0]["id"])
	if not job_pair.is_empty():
		picked = job_pair + picked
	var carried := _game.player.weapons.size()
	for choice: Dictionary in picked:
		if choice["kind"] == "weapon" and choice["level"] == 1 and carried < RECOMMEND_UNTIL_WEAPONS:
			choice["recommended"] = true
		if choice["kind"] in ["weapon", "passive"]:
			_set_rarity(choice)
	return picked


## The job's own weapon's two direction cards, marked `milestone`, when `for_level` is one of
## JOB_WEAPON_LEVELS and it still has upgrades to go; otherwise none.
func _job_pair_due(for_level: int) -> Array:
	if not JOB_WEAPON_LEVELS.has(for_level):
		return []
	var weapon_id: String = Jobs.data(_game.player.job)["weapon"]
	var weapon := _game.player.get_weapon(weapon_id)
	if weapon == null or not BRANCHES.has(weapon_id) or weapon_maxed(weapon):
		return []
	# Both directions, or the one still open once the other is full.
	var pair := []
	for branch: String in open_branches(weapon):
		pair.append(_branch_choice(weapon_id, branch))
	for card: Dictionary in pair:
		card["milestone"] = true
	return pair


## How much likelier `luck` makes a tier past the first: each point 1% per tier, compounding
## (luck 50: green ×1.5, blue ×2.25, purple ×3.4, orange ×5.1), so it lifts the rare end most.
## Card rarity (RARITIES) and the year-end bonus's 绩效 (Game.FUNDING_ROUNDS) both use it.
static func luck_factor(luck: float, tier: int) -> float:
	return pow(1.0 + maxf(luck, 0.0) / 100.0, tier)


## Rolls `choice`'s rarity by the player's luck and words the card for it. A table perk only rolls
## 普通 or tiers that add levels, and only those whose extra levels still fit under its cap, so a
## rarer card always gives more.
func _set_rarity(choice: Dictionary) -> void:
	var table_perk := _is_table_perk(choice)
	var room: int = choice["max"] - choice["level"] if table_perk else 99
	var weights := PackedFloat32Array()
	for tier in RARITIES.size():
		var extra: int = RARITIES[tier]["extra_levels"]
		var fits := extra <= room and (tier == 0 or extra > 0 or not table_perk)
		weights.append(RARITIES[tier]["weight"] * luck_factor(_game.player.luck, tier) if fits else 0.0)
	var rarity := _game.rng.rand_weighted(weights)
	choice["rarity"] = rarity
	if _is_table_perk(choice):
		choice["to_level"] = choice["level"] + RARITIES[rarity]["extra_levels"]
	elif choice["kind"] == "passive":
		choice["text"] = passive_text(choice["id"], rarity)


static func _is_table_perk(choice: Dictionary) -> bool:
	return choice["kind"] == "passive" and not STAT_STEPS.has(choice["id"])


## A stat passive's step at a rarity (STAT_STEPS times its `scale`, rounded by STEP_SNAP).
static func stat_step(passive_id: String, rarity: int) -> float:
	return snappedf(STAT_STEPS[passive_id] * RARITIES[rarity]["scale"], STEP_SNAP.get(passive_id, 1.0))


## A stat passive's card text with its step at that rarity: 「所有伤害 +12%」. Translated.
static func passive_text(passive_id: String, rarity: int) -> String:
	var text := TranslationServer.translate(PASSIVES[passive_id]["text"])
	var amount := _amount_text(stat_step(passive_id, rarity))
	var amounts: Array = []
	for i in text.count("%s"):
		amounts.append(amount)
	return text % amounts


## A step or total as a card shows it: 12, 1.2, 0.35 (two decimals at most, no trailing zeros).
static func _amount_text(value: float) -> String:
	return str(roundi(value)) if is_equal_approx(value, roundf(value)) else String.num(value, 2)


## What a card's rarity adds that its text doesn't say, translated: a weapon's own damage bonus,
## a table perk's extra levels. Empty at common, and for stat passives (their text has it).
static func rarity_line(choice: Dictionary) -> String:
	var rarity: Dictionary = RARITIES[choice.get("rarity", 0)]
	if choice["kind"] == "weapon" and rarity["weapon_bonus"] > 0.0:
		return TranslationServer.translate("本武器伤害 +%d%%") % roundi(rarity["weapon_bonus"] * 100.0)
	if _is_table_perk(choice) and rarity["extra_levels"] > 0:
		return TranslationServer.translate("直接升到 Lv %d") % choice["to_level"]
	return ""


## A year-end bonus's upgrades (Game.FUNDING_ROUNDS), applied at once, each with a rarity rolled
## like a card's. Like Vampire Survivors' chests they level up what the player already carries;
## only once all of that is at its cap do new things come out.
##
## A weapon ready to evolve (EVOLUTIONS) evolves first, as one of the chest's items.
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
			if not weapon_maxed(weapon):
				# A job's own weapon goes up one of its open directions, picked at random.
				var open := open_branches(weapon) if BRANCHES.has(weapon.id) else []
				carried.append(_branch_choice(weapon.id, open[_game.rng.randi() % open.size()]) if BRANCHES.has(weapon.id) \
					else _choice("weapon", weapon.id, weapon.level + 1))
		for passive_id: String in passive_levels:
			if passive_levels[passive_id] < max_level("passive", passive_id):
				carried.append(_choice("passive", passive_id, passive_levels[passive_id] + 1))
		var item: Dictionary = carried[_game.rng.randi() % carried.size()] if not carried.is_empty() else _roll(1, 0)[0]
		if item["kind"] in ["weapon", "passive"]:
			_set_rarity(item)
		apply(item)
		items.append(item)
	return items


## Weapons at full level, not evolved yet, whose passive the player carries.
func evolvable() -> Array[Weapon]:
	var ready: Array[Weapon] = []
	if not EVOLUTION_ON:
		return ready
	for weapon in _game.player.weapons:
		if weapon.evolved or not weapon_maxed(weapon) or not EVOLUTIONS.has(weapon.id):
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
## (as many as there are), leaving out `skip_pair`'s pair (already on the table). The fallback
## card when the pool is empty.
func _roll(count: int, new_weapons: int, skip_pair: String = "") -> Array:
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
		elif not weapon_maxed(weapon) and weapon_id != skip_pair:
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
	if count <= 0:
		return picked
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
	var forced := picked.size()
	while picked.size() < count and not pool.is_empty():
		var index := _game.rng.rand_weighted(weights)
		var entry: Dictionary = pool[index]
		pool.remove_at(index)
		weights.remove_at(index)
		if entry["kind"] != "pair":
			picked.append(entry)
			continue
		# Drawn for the last card, a pair takes the place of the last drawn card instead of being
		# left out (half of one would be no choice; leaving it out made it rarer still). With one
		# direction full, it is a single card.
		var open := open_branches(_game.player.get_weapon(entry["id"]))
		if picked.size() + open.size() > count and picked.size() > forced:
			picked.pop_back()
		if picked.size() + open.size() <= count:
			for branch: String in open:
				picked.append(_branch_choice(entry["id"], branch))
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


## How many cards a level-up offers: three, plus one now and then from luck (`lucky`, see
## lucky_card), at most MAX_CHOICES.
func choice_count(lucky: bool = false) -> int:
	return mini(BASE_CHOICES + (1 if lucky else 0), MAX_CHOICES)


## Whether luck adds a card to this level-up (Vampire Survivors' fourth option): the one thing luck
## does that shows at once, so 锦鲤 doesn't feel like a card spent on nothing.
func lucky_card() -> bool:
	return _game.rng.randf() < extra_card_chance(_game.player.luck)


## 1 - 1/(1 + luck/100), Vampire Survivors' formula: luck 10 gives 9%, 20 gives 17%, 50 gives 33%,
## 100 gives 50%, never quite every time.
static func extra_card_chance(luck: float) -> float:
	return 1.0 - 1.0 / (1.0 + maxf(luck, 0.0) / 100.0)


static func max_level(kind: String, choice_id: String) -> int:
	if kind == "passive":
		return PASSIVES[choice_id].get("max", MAX_LEVEL)
	return MAX_LEVEL


func apply(choice: Dictionary) -> void:
	var player := _game.player
	var rarity: Dictionary = RARITIES[choice.get("rarity", 0)]
	match choice["kind"]:
		"weapon":
			var weapon := player.get_weapon(choice["id"])
			if weapon == null:
				weapon = create_weapon(choice["id"])
				player.add_weapon(weapon)
			else:
				weapon.level_up(choice.get("branch", ""))
			weapon.damage_bonus += rarity["weapon_bonus"]
		"passive":
			var current: int = passive_levels.get(choice["id"], 0)
			if STAT_STEPS.has(choice["id"]):
				passive_levels[choice["id"]] = current + 1
				_apply_passive(choice["id"], choice.get("rarity", 0))
			else:
				passive_levels[choice["id"]] = mini(current + 1 + rarity["extra_levels"], max_level("passive", choice["id"]))
		"heal":
			player.heal(30.0)


## A stat passive's step at the card's rarity (stat_step).
func _apply_passive(passive_id: String, rarity: int = 0) -> void:
	var player := _game.player
	var step := stat_step(passive_id, rarity)
	match passive_id:
		"might":
			player.might += step / 100.0
		"armor":
			player.armor += step
		"vitality":
			player.max_hp += step
			player.heal(step)
		"swiftness":
			player.move_speed *= 1.0 + step / 100.0
		"haste":
			player.cooldown_scale *= 1.0 - step / 100.0
		"magnet":
			player.pickup_radius *= 1.0 + step / 100.0
		"regen":
			player.regen += step
		"luck":
			player.luck += step


## What a card changes, in numbers ("伤害 14 → 18 · 数量 1 → 2"), already translated: a weapon's
## stats that change at that level (just its damage for a new one), a passive's total before and
## after. Damage and gaps include the player's current bonuses, so they match the numbers that
## pop up in play; a weapon's damage also its own bonus from rarer cards, this one's included.
func numbers(choice: Dictionary) -> String:
	var next_level: int = choice["level"]
	match choice["kind"]:
		"weapon":
			var weapon_id: String = choice["id"]
			var after: Dictionary
			var before: Dictionary
			var carried := _game.player.get_weapon(weapon_id)
			var bonus_before := carried.damage_bonus if carried != null else 0.0
			var bonus_after: float = bonus_before + RARITIES[choice.get("rarity", 0)]["weapon_bonus"]
			if choice.has("branch"):
				var weapon := _game.player.get_weapon(weapon_id)
				var more_a := 1 if choice["branch"] == "a" else 0
				before = branch_stats(weapon_id, weapon.branch_a, weapon.branch_b)
				after = branch_stats(weapon_id, weapon.branch_a + more_a, weapon.branch_b + 1 - more_a)
			else:
				# A job's own weapon has no level tables; its numbers before any upgrade stand in (it
				# is only ever a new card if it was taken away, as tests do).
				after = branch_stats(weapon_id, 0, 0) if BRANCHES.has(weapon_id) else weapon_stats(weapon_id, next_level)
				if next_level == 1:
					return _step("伤害", "", _shown_stat("damage", after["damage"], bonus_after))
				before = weapon_stats(weapon_id, next_level - 1)
			var parts := PackedStringArray()
			for stat_key: String in WEAPON_STAT_NAMES:
				# A rarer card raises the damage even at a level whose table damage stays put.
				var changed: bool = after.has(stat_key) and (after[stat_key] != before[stat_key] or (stat_key == "damage" and bonus_after != bonus_before))
				if changed and parts.size() < MAX_STATS_SHOWN:
					parts.append(_step(WEAPON_STAT_NAMES[stat_key], _shown_stat(stat_key, before[stat_key], bonus_before), _shown_stat(stat_key, after[stat_key], bonus_after)))
			# Where the weapon goes from full level, so players learn evolutions exist.
			if EVOLUTION_ON and next_level == MAX_LEVEL and EVOLUTIONS.has(weapon_id):
				var passive_name: String = PASSIVES[EVOLUTIONS[weapon_id]["passive"]]["name"]
				parts.append(tr("配「%s」可进化") % tr(passive_name))
			return " · ".join(parts)
		"passive":
			return _passive_numbers(choice["id"], choice.get("to_level", next_level), choice.get("rarity", 0))
	return ""


## A weapon's numbers at a level, read from its script's own tables so cards can't drift from
## what the weapon does. `cooldown` is seconds between attacks, `size` a scale.
static func weapon_stats(weapon_id: String, weapon_level: int) -> Dictionary:
	var i := weapon_level - 1
	match WEAPONS[weapon_id]["behavior"]:
		"facing":
			return {"damage": FacingWeapon.DAMAGE[i], "count": FacingWeapon.COUNT[i], "pierce": FacingWeapon.PIERCE[i], "cooldown": FacingWeapon.COOLDOWN[i]}
		"bomber":
			return {"damage": BomberWeapon.DAMAGE[i], "count": BomberWeapon.COUNT[i], "radius": BomberWeapon.BLAST_RADIUS[i]}
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


## A weapon stat as a card shows it; damage with the player's bonus and the weapon's own.
func _shown_stat(stat_key: String, value: Variant, damage_bonus: float) -> String:
	var player := _game.player
	match stat_key:
		"damage":
			return str(roundi(value * player.might * (1.0 + damage_bonus)))
		"cooldown":
			return tr("%s 秒") % _short_float(value * player.cooldown_scale)
		"size":
			return "×%s" % _short_float(value)
		"arc":
			return "%d°" % roundi(value)
		"duration":
			return tr("%s 秒") % _short_float(value)
	return str(roundi(value))


## A passive's total before and after a card: a stat passive's step at the card's rarity, a table
## perk from the level it is at to `next_level` (more than one up on a rarer card).
func _passive_numbers(passive_id: String, next_level: int, rarity: int = 0) -> String:
	var player := _game.player
	var current: int = passive_levels.get(passive_id, 0)
	var step := stat_step(passive_id, rarity) if STAT_STEPS.has(passive_id) else 0.0
	match passive_id:
		"might":
			return _step("伤害", "+%d%%" % roundi((player.might - 1.0) * 100.0), "+%d%%" % roundi((player.might - 1.0 + step / 100.0) * 100.0))
		"armor":
			return _step("护甲", _amount_text(player.armor), _amount_text(player.armor + step))
		"vitality":
			return _step("生命上限", str(roundi(player.max_hp)), str(roundi(player.max_hp + step)))
		"swiftness":
			return _step("移速", _percent_over(player.move_speed / player.base_move_speed), _percent_over(player.move_speed * (1.0 + step / 100.0) / player.base_move_speed))
		"haste":
			return _step("冷却", "-%d%%" % roundi((1.0 - player.cooldown_scale) * 100.0), "-%d%%" % roundi((1.0 - player.cooldown_scale * (1.0 - step / 100.0)) * 100.0))
		"magnet":
			return _step("拾取", _percent_over(player.pickup_radius / Player.BASE_PICKUP_RADIUS), _percent_over(player.pickup_radius * (1.0 + step / 100.0) / Player.BASE_PICKUP_RADIUS))
		"regen":
			return _step("回血", tr("%s/秒") % _amount_text(player.regen), tr("%s/秒") % _amount_text(player.regen + step))
		"luck":
			return _step("运气", _amount_text(player.luck), _amount_text(player.luck + step))
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


## A job weapon's card for one direction: its name and text, `branch` for apply(), and
## `branch_level`, the level that direction goes to (the card's dots and the chest's "Lv").
func _branch_choice(weapon_id: String, branch: String) -> Dictionary:
	var weapon := _game.player.get_weapon(weapon_id)
	var direction: Dictionary = BRANCHES[weapon_id][branch]
	var choice := _choice("weapon", weapon_id, weapon.level + 1)
	choice["branch"] = branch
	choice["branch_level"] = branch_level(weapon, branch) + 1
	choice["branch_name"] = direction["name"]
	choice["text"] = direction["text"]
	return choice


## A job weapon's upgrades so far one way (`branch` "a" or "b").
static func branch_level(weapon: Weapon, branch: String) -> int:
	return weapon.branch_a if branch == "a" else weapon.branch_b


## A job weapon's directions with upgrades still to go.
static func open_branches(weapon: Weapon) -> Array:
	var open := []
	for branch: String in ["a", "b"]:
		if branch_level(weapon, branch) < BRANCH_MAX:
			open.append(branch)
	return open


## Nothing left to level up: a job weapon full both ways, any other at MAX_LEVEL.
static func weapon_maxed(weapon: Weapon) -> bool:
	if BRANCHES.has(weapon.id):
		return open_branches(weapon).is_empty()
	return weapon.level >= MAX_LEVEL


## A weapon's level as the slots and the pause screen write it: "Lv 3", or a job weapon's two
## directions, "Lv 2 · 3" (`compact` for the slot's badge: "2|3").
static func level_text(weapon: Weapon, compact: bool = false) -> String:
	if BRANCHES.has(weapon.id):
		return ("%d|%d" if compact else "Lv %d · %d") % [weapon.branch_a, weapon.branch_b]
	return str(weapon.level) if compact else "Lv %d" % weapon.level


## A card. Weapon cards also carry their `type` (the card's type tag).
func _choice(kind: String, choice_id: String, next_level: int) -> Dictionary:
	var table: Dictionary = WEAPONS[choice_id] if kind == "weapon" else PASSIVES[choice_id]
	var text: String = table["levels"][mini(next_level, table["levels"].size()) - 1] if kind == "weapon" \
		else passive_text(choice_id, 0) if STAT_STEPS.has(choice_id) else table["text"]
	var choice := {"kind": kind, "id": choice_id, "level": next_level, "max": max_level(kind, choice_id),
		"name": table["name"], "art": table["art"], "text": text}
	if kind == "weapon":
		choice["type"] = table["type"]
	return choice
