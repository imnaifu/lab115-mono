class_name Achievements
extends RefCounted
## 成就: goals across runs, kept for good (Progress). For now they are badges with a banner when
## earned; the plan is for some to unlock new maps.
##
## One of these follows a run: tick() checks what can be seen any time (minutes survived,
## kills, weapons carried, landmarks checked in at), the on_* calls what happens at a moment, and
## finish() what only the end tells (a win) and adds the run to the running totals.

## Shown in this order on the 成就 page, grouped, each with its picture. `goal` marks the ones
## counted up across runs (progress() says how far along).
const LIST := [
	{"id": "first_day", "art": "coffee", "group": "生存", "name": "第一天上班", "text": "打完第一局"},
	{"id": "probation", "art": "stock_options", "group": "生存", "name": "转正", "text": "一局撑过 5 分钟"},
	{"id": "ipo", "art": "bell", "group": "生存", "name": "敲钟上市", "text": "撑满 10 分钟通关"},
	{"id": "close_call", "art": "heart", "group": "生存", "name": "极限上市", "text": "剩不到 10 点血通关"},
	{"id": "untouched", "art": "firewall", "group": "生存", "name": "毫发无损", "text": "开局 3 分钟一滴血没掉"},
	{"id": "thousand", "art": "skull", "group": "战斗", "name": "千人斩", "text": "一局打死 1000 个怪"},
	{"id": "ten_thousand", "art": "skull", "group": "战斗", "name": "万人斩", "text": "累计打死 10000 个怪", "goal": 10000},
	{"id": "first_boss", "art": "moneybag", "group": "战斗", "name": "初战告捷", "text": "打掉第一个 boss"},
	{"id": "all_bosses", "art": "ai_boss", "group": "战斗", "name": "boss 图鉴", "text": "10 种 boss 全都打掉过", "goal": 10},
	{"id": "first_evolve", "art": "star_gold", "group": "战斗", "name": "技术升级", "text": "第一次进化武器"},
	{"id": "full_kit", "art": "keyboard", "group": "战斗", "name": "全栈", "text": "一局带满 6 把武器"},
	{"id": "win_coder", "art": "coder", "group": "职业", "name": "程序员敲钟", "text": "用程序员通关", "job": "coder"},
	{"id": "win_pm", "art": "pm", "group": "职业", "name": "产品经理敲钟", "text": "用产品经理通关", "job": "pm"},
	{"id": "win_designer", "art": "designer", "group": "职业", "name": "设计师敲钟", "text": "用设计师通关", "job": "designer"},
	{"id": "win_ops", "art": "ops", "group": "职业", "name": "运维敲钟", "text": "用运维通关", "job": "ops"},
	{"id": "win_data_scientist", "art": "data_scientist", "group": "职业", "name": "数据科学家敲钟", "text": "用数据科学家通关", "job": "data_scientist"},
	{"id": "stamps_5", "art": "stanford_tower", "group": "打卡", "name": "网红打卡", "text": "打卡 5 个地标", "goal": 5},
	{"id": "stamps_all", "art": "golden_gate", "group": "打卡", "name": "湾区通", "text": "硅谷 13 个地标全部打卡", "goal": 13},
	{"id": "train_hit", "art": "caltrain", "group": "彩蛋", "name": "赶上了 Caltrain", "text": "被 Caltrain 撞飞一次"},
]
const GROUPS := ["生存", "战斗", "职业", "打卡", "彩蛋"]
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
var _finished := false


func _init(game: Game) -> void:
	_game = game


static func data(id: String) -> Dictionary:
	for entry: Dictionary in LIST:
		if entry["id"] == id:
			return entry
	return {}


## The enemy types that count as bosses for the 图鉴.
static func boss_types() -> PackedStringArray:
	var types := PackedStringArray()
	for type_id: String in Spawner.ENEMY_TYPES:
		if Spawner.ENEMY_TYPES[type_id].get("elite", false):
			types.append(type_id)
	return types


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
		"stamps_5", "stamps_all":
			done = _stamps_done()
	return [mini(done, entry["goal"]), entry["goal"]]


static func _stamps_done() -> int:
	var count := 0
	for id in Progress.stamp_ids():
		if BayArea.STAMPS.has(id):
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
	var stamped := _stamps_done()
	if stamped >= data("stamps_5")["goal"]:
		_unlock("stamps_5")
	if stamped >= BayArea.STAMPS.size():
		_unlock("stamps_all")


## The player lost health (not just touched while still flashing from the last hit).
func on_hurt() -> void:
	_hurt = true


func on_boss_killed(type_id: String) -> void:
	_bosses[type_id] = true
	_unlock("first_boss")
	if _all_bosses().size() >= boss_types().size():
		_unlock("all_bosses")


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
	Progress.set_stat("runs", Progress.stat("runs", 0) + 1)
	Progress.set_stat("kills", Progress.stat("kills", 0) + _game.kills)
	Progress.set_stat("bosses", Array(_all_bosses()))
	if victory:
		var wins: Dictionary = Progress.stat("wins", {})
		wins[_game.player.job] = wins.get(_game.player.job, 0) + 1
		Progress.set_stat("wins", wins)
	Progress.save()


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
