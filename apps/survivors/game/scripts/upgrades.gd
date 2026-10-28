class_name Upgrades
extends RefCounted
## The level-up pool: what can be offered next, the copy shown on each card, and applying a
## pick. Weapon card text describes the step to that level; keep it in sync with the stat
## tables in scripts/weapons/ (each entry's `behavior` names the script it runs on).

const MAX_LEVEL := 5
## Passives a run can hold, like the six weapon slots: once six are picked, only those level up.
const MAX_PASSIVES := 6
const BASE_CHOICES := 3

const WEAPONS := {
	"enter": {"name": "回车键", "art": "enter_key", "behavior": "aimed",
		"levels": ["自动敲向最近的敌人", "每轮多敲一下", "伤害 +6", "每轮多敲一下", "穿透 +2，伤害 +6"]},
	"copy": {"name": "复制粘贴", "art": "paper", "behavior": "facing",
		"levels": ["朝面向的方向连发文件，能穿过敌人", "伤害 +4", "多粘贴一份", "伤害 +4", "多粘贴一份，出手更快，穿透 +1"]},
	"drone": {"name": "无人机", "art": "drone", "behavior": "seek",
		"levels": ["飞出去追着附近的敌人撞", "多一架无人机", "伤害 +4，飞得更快", "多一架无人机", "多一架，伤害 +4，飞得更快"]},
	"cloud": {"name": "云端部署", "art": "cloud", "behavior": "strike",
		"levels": ["从云上劈中屏幕里的敌人", "多劈一道", "伤害 +6，冷却更短", "多劈一道，范围变大", "多劈一道，伤害 +6，冷却更短"]},
	"keyboard": {"name": "机械键盘", "art": "keyboard", "behavior": "toss",
		"levels": ["往上一抛，落下砸穿一切", "多抛一把", "伤害 +10", "多抛一把", "伤害 +10，键盘变大"]},
	"wifi": {"name": "Wi-Fi 信号", "art": "wifi", "behavior": "aura",
		"levels": ["持续伤害身边的敌人", "信号范围变大", "伤害 +3，频率更高", "信号范围变大", "伤害 +4，范围更大，频率更高"]},
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

## Offered only when everything else is maxed out.
const FALLBACK := {"kind": "heal", "id": "heal", "level": 0, "name": "摸鱼一会儿", "art": "boba", "text": "回复 30 生命"}

const STARTING_WEAPON := "enter"

var passive_levels := {}
var _game: Game


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
		_:
			push_error("Unknown weapon behavior: %s" % entry["behavior"])
			return null
	weapon.id = weapon_id
	weapon.art = entry["art"]
	return weapon


func roll_choices(count: int) -> Array:
	var pool: Array = []
	var weights := PackedFloat32Array()
	for weapon_id: String in WEAPONS:
		var weapon := _game.player.get_weapon(weapon_id)
		if weapon == null:
			pool.append(_choice("weapon", weapon_id, 1))
			weights.append(2.0)
		elif weapon.level < MAX_LEVEL:
			# Upgrading what you already carry is favoured so builds come together.
			pool.append(_choice("weapon", weapon_id, weapon.level + 1))
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
	while picked.size() < count and not pool.is_empty():
		var index := _game.rng.rand_weighted(weights)
		picked.append(pool[index])
		pool.remove_at(index)
		weights.remove_at(index)
	if picked.is_empty():
		picked.append(FALLBACK)
	return picked


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
				weapon.level_up()
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


func _choice(kind: String, choice_id: String, next_level: int) -> Dictionary:
	var table: Dictionary = WEAPONS[choice_id] if kind == "weapon" else PASSIVES[choice_id]
	var text: String = table["levels"][next_level - 1] if kind == "weapon" else table["text"]
	return {"kind": kind, "id": choice_id, "level": next_level, "max": max_level(kind, choice_id),
		"name": table["name"], "art": table["art"], "text": text}
