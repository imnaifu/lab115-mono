class_name Achievements
extends RefCounted
## 成就: goals across runs, kept for good (Progress). For now they are badges with a banner when
## earned; the plan is for some to unlock new maps.
##
## One of these follows a run: tick() checks what can be seen any time (minutes survived,
## kills, weapons carried, landmarks checked in at), the on_* calls what happens at a moment, and
## finish() what only the end tells (a win) and adds the run to the running totals.

## Shown in this order on the 成就 page, grouped, each with its picture and its tier (TIERS, set
## by hand from how hard it is, not from the live rates, so a tier doesn't shift as they come in).
## `goal` marks the ones counted up across runs (progress() says how far along).
const LIST := [
	{"id": "first_day", "tier": "bronze", "art": "coffee", "group": "生存", "name": "第一天上班", "text": "打完第一局"},
	{"id": "probation", "tier": "bronze", "art": "stock_options", "group": "生存", "name": "转正", "text": "一局撑过 5 分钟"},
	{"id": "ipo", "tier": "silver", "art": "bell", "group": "生存", "name": "敲钟上市", "text": "撑满 10 分钟通关"},
	{"id": "win_seattle", "tier": "gold", "art": "space_needle", "group": "生存", "name": "太空针敲钟", "text": "在西雅图地图通关"},
	{"id": "win_beijing", "tier": "gold", "art": "subway_13", "group": "生存", "name": "后厂村敲钟", "text": "在北京地图通关"},
	{"id": "close_call", "tier": "gold", "art": "heart", "group": "生存", "name": "极限上市", "text": "剩不到 10 点血通关"},
	{"id": "untouched", "tier": "silver", "art": "firewall", "group": "生存", "name": "毫发无损", "text": "开局 3 分钟一滴血没掉"},
	{"id": "thousand", "tier": "silver", "art": "skull", "group": "战斗", "name": "千人斩", "text": "一局打死 1000 个怪"},
	{"id": "ten_thousand", "tier": "platinum", "art": "skull", "group": "战斗", "name": "万人斩", "text": "累计打死 10000 个怪", "goal": 10000},
	{"id": "first_boss", "tier": "bronze", "art": "chest", "group": "战斗", "name": "初战告捷", "text": "打掉第一个 boss"},
	{"id": "all_bosses", "tier": "silver", "art": "ai_boss", "group": "战斗", "name": "boss 克星", "text": "打掉过 10 种 boss", "goal": 10},
	{"id": "bestiary_all", "tier": "platinum", "art": "bug", "group": "战斗", "name": "全图鉴", "text": "图鉴里的怪全都遇到过", "goal": 56},
	{"id": "first_evolve", "tier": "bronze", "art": "star_gold", "group": "战斗", "name": "技术升级", "text": "第一次进化武器"},
	{"id": "full_kit", "tier": "silver", "art": "keyboard", "group": "战斗", "name": "全栈", "text": "一局带满 6 把武器"},
	{"id": "win_coder", "tier": "gold", "art": "coder", "group": "职业", "name": "程序员敲钟", "text": "用程序员通关", "job": "coder"},
	{"id": "win_pm", "tier": "gold", "art": "pm", "group": "职业", "name": "产品经理敲钟", "text": "用产品经理通关", "job": "pm"},
	{"id": "win_designer", "tier": "gold", "art": "designer", "group": "职业", "name": "设计师敲钟", "text": "用设计师通关", "job": "designer"},
	{"id": "win_ops", "tier": "gold", "art": "ops", "group": "职业", "name": "运维敲钟", "text": "用运维通关", "job": "ops"},
	{"id": "win_data_scientist", "tier": "gold", "art": "data_scientist", "group": "职业", "name": "数据科学家敲钟", "text": "用数据科学家通关", "job": "data_scientist"},
	{"id": "stamps_5", "tier": "bronze", "art": "stanford_tower", "group": "打卡", "name": "网红打卡", "text": "打卡 5 个地标", "goal": 5},
	{"id": "stamps_all", "tier": "gold", "art": "golden_gate", "group": "打卡", "name": "湾区通", "text": "硅谷 13 个地标全部打卡", "goal": 13},
	{"id": "sea_stamps_all", "tier": "gold", "art": "great_wheel", "group": "打卡", "name": "西雅图通", "text": "西雅图 13 个地标全部打卡", "goal": 13},
	{"id": "bj_stamps_all", "tier": "platinum", "art": "summer_palace", "group": "打卡", "name": "京城通", "text": "北京 13 个地标全部打卡", "goal": 13},
	{"id": "train_hit", "tier": "bronze", "art": "caltrain", "group": "彩蛋", "name": "赶上了 Caltrain", "text": "被 Caltrain 或 13 号线撞飞一次"},
]
const GROUPS := ["生存", "战斗", "职业", "打卡", "彩蛋"]
## Achievement tiers (.31, the user's call: like trophies), hardest first, with their colours.
const TIERS := {
	"platinum": {"name": "白金", "color": Color("6c8ebf")},
	"gold": {"name": "黄金", "color": Color("d49a12")},
	"silver": {"name": "白银", "color": Color("8a909c")},
	"bronze": {"name": "青铜", "color": Color("b8733a")},
}
## The 成就 page says how many players have each (rate()): from the live data (AchievementRates,
## written by tools/achievement_rates.py at each release) once it holds MIN_PLAYERS players; until
## then these estimates, in percent, judged from how hard each is (the user's call: hardcoded is
## fine to start with). Under RARE it reads 稀有.
const MIN_PLAYERS := 30
const RARE := 0.1
const ESTIMATED_RATES := {
	"first_day": 100.0, "probation": 45.0, "ipo": 15.0, "win_seattle": 5.0, "win_beijing": 3.0, "close_call": 4.0, "untouched": 8.0,
	"thousand": 20.0, "ten_thousand": 2.0, "first_boss": 80.0, "all_bosses": 10.0, "bestiary_all": 1.0,
	"first_evolve": 25.0, "full_kit": 30.0,
	"win_coder": 8.0, "win_pm": 6.0, "win_designer": 5.0, "win_ops": 5.0, "win_data_scientist": 4.0,
	"stamps_5": 35.0, "stamps_all": 5.0, "sea_stamps_all": 2.0, "bj_stamps_all": 1.0, "train_hit": 40.0,
}
const SURVIVE_SECONDS := 300.0
const UNTOUCHED_SECONDS := 180.0
const KILLS_IN_A_RUN := 1000
const CLOSE_CALL_HP := 10.0
## Seconds between the checks tick() makes.
const CHECK_GAP := 0.5

signal unlocked(id: String)

## Earned this run, in order (the result screen and the run's data).
var new_ids := PackedStringArray()

var _game: Game
var _check_left := 0.0
var _hurt := false
## Boss types killed this run, added to the saved set when it ends.
var _bosses := {}
## For the 怪物图鉴 (Bestiary): types met and killed this run, boss affixes met.
var _seen := {}
var _kills_by_type := {}
var _affixes_seen := {}
var _finished := false


func _init(game: Game) -> void:
	_game = game


static func data(id: String) -> Dictionary:
	for entry: Dictionary in LIST:
		if entry["id"] == id:
			return entry
	return {}


## The achievements in play, as the 成就 page lists and counts them: LIST without those for a
## feature that is switched off (技术升级 while Upgrades.EVOLUTION_ON is false). One already
## earned stays in the save, just out of the list and the count.
static func shown() -> Array:
	return LIST.filter(func(entry: Dictionary) -> bool: return Upgrades.EVOLUTION_ON or entry["id"] != "first_evolve")


## How many of shown() this device has earned.
static func earned_count() -> int:
	return shown().filter(func(entry: Dictionary) -> bool: return Progress.has_achievement(entry["id"])).size()


## The tier's name and colour for `id`.
static func tier_of(id: String) -> Dictionary:
	return TIERS[data(id)["tier"]]


## Per tier, hardest first: [tier id, earned, shown] (the 成就 page's line at the top).
static func tier_counts() -> Array:
	var counts := []
	for tier: String in TIERS:
		var of_tier := shown().filter(func(entry: Dictionary) -> bool: return entry["tier"] == tier)
		var earned := of_tier.filter(func(entry: Dictionary) -> bool: return Progress.has_achievement(entry["id"])).size()
		counts.append([tier, earned, of_tier.size()])
	return counts


## The share of players who have earned `id`, 0 to 1 (see ESTIMATED_RATES).
static func rate(id: String) -> float:
	if AchievementRates.PLAYERS >= MIN_PLAYERS:
		return float(AchievementRates.UNLOCKS.get(id, 0)) / AchievementRates.PLAYERS
	return ESTIMATED_RATES.get(id, 0.0) / 100.0


## How it reads on the 成就 page: 12% 的玩家达成, 稀有 under RARE.
static func rate_text(id: String) -> String:
	var share := rate(id)
	var line: String = TranslationServer.translate("不到 1% 的玩家达成") if share < 0.01 \
		else TranslationServer.translate("%d%% 的玩家达成") % roundi(share * 100.0)
	return TranslationServer.translate("稀有 · ") + line if share < RARE else line


## How far along a counted achievement is, as [done, goal], from what's saved (a run in progress
## adds its share when it ends). [0, 0] for the others.
static func progress(id: String) -> Array:
	var entry := data(id)
	if not entry.has("goal"):
		return [0, 0]
	var done := 0
	match id:
		"ten_thousand":
			done = Progress.stat("kills", 0)
		"all_bosses":
			done = (Progress.stat("bosses", []) as Array).size()
		"bestiary_all":
			done = Bestiary.seen_count()
		"stamps_5":
			done = _stamps_done()
		"stamps_all":
			done = Maps.stamps_on("sv")
		"sea_stamps_all":
			done = Maps.stamps_on("sea")
		"bj_stamps_all":
			done = Maps.stamps_on("bj")
	return [mini(done, entry["goal"]), entry["goal"]]


## Landmarks checked in at on every map.
static func _stamps_done() -> int:
	var count := 0
	for id in Progress.stamp_ids():
		if not Maps.stamp(id).is_empty():
			count += 1
	return count


func tick(delta: float) -> void:
	_check_left -= delta
	if _check_left > 0.0:
		return
	_check_left = CHECK_GAP
	var player := _game.player
	if _game.elapsed >= SURVIVE_SECONDS:
		_unlock("probation")
	if _game.elapsed >= UNTOUCHED_SECONDS and not _hurt:
		_unlock("untouched")
	if _game.kills >= KILLS_IN_A_RUN:
		_unlock("thousand")
	if Progress.stat("kills", 0) + _game.kills >= data("ten_thousand")["goal"]:
		_unlock("ten_thousand")
	if player.weapons.size() >= Jobs.MAX_WEAPONS:
		_unlock("full_kit")
	for weapon in player.weapons:
		if weapon.evolved:
			_unlock("first_evolve")
	if _stamps_done() >= data("stamps_5")["goal"]:
		_unlock("stamps_5")
	if Maps.stamps_on("sv") >= BayArea.STAMPS.size():
		_unlock("stamps_all")
	if Maps.stamps_on("sea") >= Seattle.STAMPS.size():
		_unlock("sea_stamps_all")
	if Maps.stamps_on("bj") >= Beijing.STAMPS.size():
		_unlock("bj_stamps_all")
	if _all_seen().size() >= Bestiary.ids().size():
		_unlock("bestiary_all")


## The player lost health (not just touched while still flashing from the last hit).
func on_hurt() -> void:
	_hurt = true


func on_boss_killed(type_id: String) -> void:
	_bosses[type_id] = true
	_unlock("first_boss")
	if _all_bosses().size() >= data("all_bosses")["goal"]:
		_unlock("all_bosses")


## An enemy turned up (Game.spawn_enemy): it goes in the 图鉴.
func on_spawned(type_id: String) -> void:
	_seen[type_id] = true


func on_killed(type_id: String) -> void:
	_kills_by_type[type_id] = _kills_by_type.get(type_id, 0) + 1


func on_affixes(affixes: Array) -> void:
	for affix: String in affixes:
		_affixes_seen[affix] = true


func on_train_hit() -> void:
	_unlock("train_hit")


## The run is over (won, lost or given up): the end-only achievements, then the run's kills,
## bosses and win go into the totals. Only once, however the run ended.
func finish(victory: bool) -> void:
	if _finished:
		return
	_finished = true
	_unlock("first_day")
	if victory:
		_unlock("ipo")
		if _game.player.hp <= CLOSE_CALL_HP:
			_unlock("close_call")
		_unlock("win_" + _game.player.job)
		if Maps.current_id == "bj":
			_unlock("win_beijing")
		elif Maps.current_id == "sea":
			_unlock("win_seattle")
	Progress.set_stat("runs", Progress.stat("runs", 0) + 1)
	Progress.set_stat("kills", Progress.stat("kills", 0) + _game.kills)
	Progress.set_stat("bosses", Array(_all_bosses()))
	Progress.set_stat("seen", Array(_all_seen()))
	var kills_by_type: Dictionary = Progress.stat("kills_by_type", {})
	for type_id: String in _kills_by_type:
		kills_by_type[type_id] = kills_by_type.get(type_id, 0) + _kills_by_type[type_id]
	Progress.set_stat("kills_by_type", kills_by_type)
	var affixes_seen := PackedStringArray(Progress.stat("affixes_seen", []))
	for affix: String in _affixes_seen:
		if not affixes_seen.has(affix):
			affixes_seen.append(affix)
	Progress.set_stat("affixes_seen", Array(affixes_seen))
	if victory:
		var wins: Dictionary = Progress.stat("wins", {})
		wins[_game.player.job] = wins.get(_game.player.job, 0) + 1
		Progress.set_stat("wins", wins)
		# Per map too (.34): a win opens the next map on the world map (Maps.unlocked).
		var map_wins: Dictionary = Progress.stat("map_wins", {})
		map_wins[Maps.current_id] = int(map_wins.get(Maps.current_id, 0)) + 1
		Progress.set_stat("map_wins", map_wins)
	Progress.save()


## Enemy types met in any run so far, this one included.
func _all_seen() -> PackedStringArray:
	var all := PackedStringArray(Progress.stat("seen", []))
	for type_id: String in _seen:
		if not all.has(type_id):
			all.append(type_id)
	return all


## Boss types killed in any run so far, this one included.
func _all_bosses() -> PackedStringArray:
	var all := PackedStringArray(Progress.stat("bosses", []))
	for type_id: String in _bosses:
		if not all.has(type_id):
			all.append(type_id)
	return all


func _unlock(id: String) -> void:
	if Progress.has_achievement(id) or data(id).is_empty():
		return
	Progress.add_achievement(id)
	new_ids.append(id)
	unlocked.emit(id)
