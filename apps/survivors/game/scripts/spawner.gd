class_name Spawner
extends RefCounted
## Decides what spawns and when: a steady trickle whose mix shifts over the run, plus
## scripted events at fixed times: enemy rings closing in, the map's weather, and the map's four
## bosses (BossKits.SLOT_AT).

const MAX_ALIVE := 260
## Phones run the same GDScript through WebAssembly on a slower CPU, so the crowd is capped
## lower there to keep the frame rate up.
const MAX_ALIVE_MOBILE := 200
const RING_RADIUS := 210.0
## The first minutes spawn fewer enemies than the curve says (60% at the start, back to the full
## rate by 3:00), so the lone starting weapon isn't swamped before the first upgrades land.
const EASE_IN_SECONDS := 180.0
const EASE_IN_START := 0.6
## How much tougher every enemy gets a minute (.40: 0.2 until then; the user wanted it harder
## after .39 made it much easier). The first minute's Bug still takes two of a job weapon's 7s.
const HP_PER_MINUTE := 0.25
## From LATE_FROM_MINUTE on, each minute spawns LATE_SPAWN_PER_MINUTE more of the rate on top (.53,
## the user: 后期难度调高一点, then 不操作怪物生命，改成怪物数量), 1.95x by the ten-minute mark. Sized
## by the balance formula (DESIGN.md 2.8) for a new player who plays well to win about 5%: it was
## measured on enemy health (3.5x / 4.75x / 6x at 10:00 won 48% / 20% / 8%) and wants 6.8x, taken
## here as the same total health a minute coming in more enemies (6.8 / 3.5 = 1.94), unmeasured.
const LATE_FROM_MINUTE := 5.0
const LATE_SPAWN_PER_MINUTE := 0.19

## `size` is the art's frame height in logical pixels, `radius` the body used for hits and
## crowd spacing, `color` the puff left behind on death. Radii are smaller than the art on
## purpose: they are the balance the game was tuned with, and crowds overlapping a little reads
## fine with these drawings. `elite` marks bosses (health bar, the boss bar at the top of the
## screen, a chest when killed; what each does is BossKits').
## Radii stay at or under Game.MAX_ENEMY_RADIUS.
const ENEMY_TYPES := {
	"ping": {"name": "消息红点", "art": "ping", "size": 22.0, "color": Color("ff5d5d"),
		"hp": 4.0, "speed": 50.0, "damage": 5.0, "xp": 1, "radius": 5.0, "wobble": 30.0},
	"bug": {"name": "Bug", "art": "bug", "size": 24.0, "color": Color("ff5d5d"),
		"hp": 8.0, "speed": 38.0, "damage": 6.0, "xp": 1, "radius": 6.0},
	"mail": {"name": "未读邮件", "art": "mail", "size": 24.0, "color": Color("fff7e0"),
		"hp": 14.0, "speed": 44.0, "damage": 8.0, "xp": 2, "radius": 6.0},
	"meeting": {"name": "会议邀请", "art": "meeting", "size": 26.0, "color": Color("5b9cff"),
		"hp": 26.0, "speed": 30.0, "damage": 9.0, "xp": 3, "radius": 6.0},
	"ghost": {"name": "404 幽灵", "art": "ghost404", "size": 26.0, "color": Color("eef1f6"),
		"hp": 18.0, "speed": 40.0, "damage": 10.0, "xp": 3, "radius": 6.0, "ghostly": true},
	"techdebt": {"name": "技术债", "art": "techdebt", "size": 28.0, "color": Color("ffd36b"),
		"hp": 45.0, "speed": 34.0, "damage": 12.0, "xp": 4, "radius": 6.0, "knockback_resist": 0.5},
	"server": {"name": "宕机服务器", "art": "server", "size": 38.0, "color": Color("a9b3c4"),
		"hp": 140.0, "speed": 26.0, "damage": 18.0, "xp": 10, "radius": 10.0, "knockback_resist": 0.8},
	# 西二旗's rush hour (Beijing.RING_SWAPS): a crowd of commuters in place of the Bug outbreak,
	# a little quicker than bugs and as frail.
	"commuter": {"name": "早高峰打工人", "art": "commuter", "size": 24.0, "color": Color("9aa5b8"),
		"hp": 8.0, "speed": 44.0, "damage": 6.0, "xp": 1, "radius": 6.0},
	# Same-day delivery (Seattle.RING_SWAPS): a ring of parcels in place of the Bug outbreak, as frail.
	"parcel": {"name": "Prime 包裹", "art": "parcel", "size": 24.0, "color": Color("d4b483"),
		"hp": 8.0, "speed": 44.0, "damage": 6.0, "xp": 1, "radius": 6.0},
	# Each map's own crowd (the map's MOB_SWAPS, .36, the user's call): the seven regular enemies
	# redrawn for the map, built and as strong as the ones they stand in for (Game.spawn_enemy
	# swaps them in, so waves and rings use them). Since .41 every map has 硅谷's crowd again (the
	# user's call: the crowd is the same everywhere, only the bosses are the map's own); these stay
	# in the table, unused.
	# 北京.
	"dingding": {"name": "盯盯消息", "art": "dingding", "size": 22.0, "color": Color("5b9cff"),
		"hp": 4.0, "speed": 50.0, "damage": 5.0, "xp": 1, "radius": 5.0, "wobble": 30.0},
	"small_req": {"name": "小需求", "art": "small_req", "size": 24.0, "color": Color("ffd25e"),
		"hp": 8.0, "speed": 38.0, "damage": 6.0, "xp": 1, "radius": 6.0},
	"daily_report": {"name": "日报", "art": "daily_report", "size": 24.0, "color": Color("fff7e0"),
		"hp": 14.0, "speed": 44.0, "damage": 8.0, "xp": 2, "radius": 6.0},
	"group_chat": {"name": "拉个群", "art": "group_chat", "size": 26.0, "color": Color("6cc25a"),
		"hp": 26.0, "speed": 30.0, "damage": 9.0, "xp": 3, "radius": 6.0},
	"read_no_reply": {"name": "已读不回", "art": "read_no_reply", "size": 26.0, "color": Color("eef1f6"),
		"hp": 18.0, "speed": 40.0, "damage": 10.0, "xp": 3, "radius": 6.0, "ghostly": true},
	"kpi": {"name": "KPI", "art": "kpi", "size": 28.0, "color": Color("ff5d5d"),
		"hp": 45.0, "speed": 34.0, "damage": 12.0, "xp": 4, "radius": 6.0, "knockback_resist": 0.5},
	"traffic_flood": {"name": "流量洪峰", "art": "traffic_flood", "size": 38.0, "color": Color("5b9cff"),
		"hp": 140.0, "speed": 26.0, "damage": 18.0, "xp": 10, "radius": 10.0, "knockback_resist": 0.8},
	# 西雅图.
	"at_here": {"name": "@here", "art": "at_here", "size": 22.0, "color": Color("7b68d9"),
		"hp": 4.0, "speed": 50.0, "damage": 5.0, "xp": 1, "radius": 5.0, "wobble": 30.0},
	"sev3_ticket": {"name": "Sev-3 工单", "art": "sev3_ticket", "size": 24.0, "color": Color("f7c948"),
		"hp": 8.0, "speed": 38.0, "damage": 6.0, "xp": 1, "radius": 6.0},
	"code_review": {"name": "CR 请求", "art": "code_review", "size": 24.0, "color": Color("fff7e0"),
		"hp": 14.0, "speed": 44.0, "damage": 8.0, "xp": 2, "radius": 6.0},
	"one_on_one": {"name": "1:1", "art": "one_on_one", "size": 26.0, "color": Color("bcdcf2"),
		"hp": 26.0, "speed": 30.0, "damage": 9.0, "xp": 3, "radius": 6.0},
	"night_page": {"name": "半夜 Page", "art": "night_page", "size": 26.0, "color": Color("eef1f6"),
		"hp": 18.0, "speed": 40.0, "damage": 10.0, "xp": 3, "radius": 6.0, "ghostly": true},
	"six_pager": {"name": "六页纸", "art": "six_pager", "size": 28.0, "color": Color("faf7f0"),
		"hp": 45.0, "speed": 34.0, "damage": 12.0, "xp": 4, "radius": 6.0, "knockback_resist": 0.5},
	"cloud_bill": {"name": "AWS 账单", "art": "cloud_bill", "size": 38.0, "color": Color("ffd25e"),
		"hp": 140.0, "speed": 26.0, "damage": 18.0, "xp": 10, "radius": 10.0, "knockback_resist": 0.8},
	# 伦敦 (.37): its crowd and its queue ring.
	"pigeon": {"name": "鸽子", "art": "pigeon", "size": 22.0, "color": Color("a9b3c4"),
		"hp": 4.0, "speed": 50.0, "damage": 5.0, "xp": 1, "radius": 5.0, "wobble": 30.0},
	"teabag": {"name": "茶包", "art": "teabag", "size": 24.0, "color": Color("c98d5a"),
		"hp": 8.0, "speed": 38.0, "damage": 6.0, "xp": 1, "radius": 6.0},
	"visa_form": {"name": "签证材料", "art": "visa_form", "size": 24.0, "color": Color("fff7e0"),
		"hp": 14.0, "speed": 44.0, "damage": 8.0, "xp": 2, "radius": 6.0},
	"pub_invite": {"name": "Pub 社交局", "art": "pub_invite", "size": 26.0, "color": Color("ffd25e"),
		"hp": 26.0, "speed": 30.0, "damage": 9.0, "xp": 3, "radius": 6.0},
	"tower_ghost": {"name": "伦敦塔幽灵", "art": "tower_ghost", "size": 26.0, "color": Color("eef1f6"),
		"hp": 18.0, "speed": 40.0, "damage": 10.0, "xp": 3, "radius": 6.0, "ghostly": true},
	"compliance": {"name": "合规流程", "art": "compliance", "size": 28.0, "color": Color("d6d9de"),
		"hp": 45.0, "speed": 34.0, "damage": 12.0, "xp": 4, "radius": 6.0, "knockback_resist": 0.5},
	"double_decker": {"name": "双层巴士", "art": "double_decker", "size": 38.0, "color": Color("d94b5c"),
		"hp": 140.0, "speed": 26.0, "damage": 18.0, "xp": 10, "radius": 10.0, "knockback_resist": 0.8},
	# The queue (London.RING_SWAPS): a ring of Britons in place of the Bug outbreak, as frail.
	"queue_brit": {"name": "排队的英国人", "art": "queue_brit", "size": 24.0, "color": Color("8a909c"),
		"hp": 8.0, "speed": 44.0, "damage": 6.0, "xp": 1, "radius": 6.0},
	# 新加坡 (.38): its crowd and its tissue ring.
	"mosquito": {"name": "蚊子", "art": "mosquito", "size": 22.0, "color": Color("8a909c"),
		"hp": 4.0, "speed": 50.0, "damage": 5.0, "xp": 1, "radius": 5.0, "wobble": 30.0},
	"gecko": {"name": "壁虎", "art": "gecko", "size": 24.0, "color": Color("c9d6a3"),
		"hp": 8.0, "speed": 38.0, "damage": 6.0, "xp": 1, "radius": 6.0},
	"grub_order": {"name": "Grub 外卖单", "art": "grub_order", "size": 24.0, "color": Color("6cc25a"),
		"hp": 14.0, "speed": 44.0, "damage": 8.0, "xp": 2, "radius": 6.0},
	"align_call": {"name": "跨时区对齐会", "art": "align_call", "size": 26.0, "color": Color("bcdcf2"),
		"hp": 26.0, "speed": 30.0, "damage": 9.0, "xp": 3, "radius": 6.0},
	"hungry_ghost": {"name": "中元节饿鬼", "art": "hungry_ghost", "size": 26.0, "color": Color("eef1f6"),
		"hp": 18.0, "speed": 40.0, "damage": 10.0, "xp": 3, "radius": 6.0, "ghostly": true},
	"coe": {"name": "COE 拥车证", "art": "coe", "size": 28.0, "color": Color("fff7e0"),
		"hp": 45.0, "speed": 34.0, "damage": 12.0, "xp": 4, "radius": 6.0, "knockback_resist": 0.5},
	"durian": {"name": "榴莲", "art": "durian", "size": 38.0, "color": Color("c6d94a"),
		"hp": 140.0, "speed": 26.0, "damage": 18.0, "xp": 10, "radius": 10.0, "knockback_resist": 0.8},
	# The hawker centre at lunch (Singapore.RING_SWAPS): a ring of tissue packets, as frail as bugs.
	"tissue_chope": {"name": "纸巾占座", "art": "tissue_chope", "size": 24.0, "color": Color("faf7f0"),
		"hp": 8.0, "speed": 44.0, "damage": 6.0, "xp": 1, "radius": 6.0},
	# The bosses (.45, BossKits: their attacks and lines), four a map in the order they come (each map's
	# BOSSES), as strong as their slot (BossKits.SLOT_STATS): health before the minute's and the map's
	# multipliers, contact damage before the map's, stars. Until .44 there were 10 to 12 a run, from a
	# shared schedule with each map's stand-ins, drawing moves and affixes at random.
	# 硅谷.
	"deadline": {"name": "Deadline", "art": "deadline", "size": 50.0, "color": Color("ff5d5d"),
		"hp": 600.0, "speed": 30.0, "damage": 12.0, "xp": 30, "radius": 14.0, "knockback_resist": 1.0, "elite": true},
	"server_elite": {"name": "主库宕机", "art": "db_down", "size": 54.0, "color": Color("a9b3c4"),
		"hp": 1400.0, "speed": 30.0, "damage": 20.0, "xp": 60, "radius": 13.0, "knockback_resist": 1.0, "elite": true},
	"ai": {"name": "AI 大模型", "art": "ai_boss", "size": 64.0, "color": Color("8c7cf0"),
		"hp": 2200.0, "speed": 32.0, "damage": 24.0, "xp": 90, "radius": 16.0, "knockback_resist": 1.0, "elite": true},
	"pie_boss": {"name": "老板画饼", "art": "pie_boss", "size": 58.0, "color": Color("f2c46b"),
		"hp": 3000.0, "speed": 30.0, "damage": 26.0, "xp": 100, "radius": 15.0, "knockback_resist": 1.0, "elite": true},
	# 伦敦.
	"committee": {"name": "委员会", "art": "committee", "size": 60.0, "color": Color("a9b3c4"),
		"hp": 600.0, "speed": 30.0, "damage": 12.0, "xp": 30, "radius": 15.0, "knockback_resist": 1.0, "elite": true},
	"redundancy": {"name": "冗余通知", "art": "redundancy", "size": 54.0, "color": Color("d4b483"),
		"hp": 1400.0, "speed": 30.0, "damage": 20.0, "xp": 60, "radius": 14.0, "knockback_resist": 1.0, "elite": true},
	"gdpr": {"name": "GDPR 合规官", "art": "gdpr", "size": 58.0, "color": Color("5b9cff"),
		"hp": 2200.0, "speed": 32.0, "damage": 24.0, "xp": 90, "radius": 15.0, "knockback_resist": 1.0, "elite": true},
	"scone_boss": {"name": "老板递司康", "art": "scone_boss", "size": 58.0, "color": Color("f2c46b"),
		"hp": 3000.0, "speed": 30.0, "damage": 26.0, "xp": 100, "radius": 15.0, "knockback_resist": 1.0, "elite": true},
	# 西雅图.
	"monolith": {"name": "巨石应用", "art": "monolith", "size": 60.0, "color": Color("8a909c"),
		"hp": 600.0, "speed": 30.0, "damage": 12.0, "xp": 30, "radius": 15.0, "knockback_resist": 1.0, "elite": true},
	"meeting_spam": {"name": "连环会", "art": "meeting_spam", "size": 54.0, "color": Color("b8a8f0"),
		"hp": 1400.0, "speed": 30.0, "damage": 20.0, "xp": 60, "radius": 14.0, "knockback_resist": 1.0, "elite": true},
	"pip": {"name": "PIP 绩效改进", "art": "pip", "size": 54.0, "color": Color("ffc2cf"),
		"hp": 2200.0, "speed": 32.0, "damage": 24.0, "xp": 90, "radius": 14.0, "knockback_resist": 1.0, "elite": true},
	"all_hands": {"name": "全员大会", "art": "all_hands", "size": 58.0, "color": Color("f2c46b"),
		"hp": 3000.0, "speed": 30.0, "damage": 26.0, "xp": 100, "radius": 15.0, "knockback_resist": 1.0, "elite": true},
	# 新加坡.
	"forms": {"name": "表格", "art": "forms", "size": 60.0, "color": Color("fff7e0"),
		"hp": 600.0, "speed": 30.0, "damage": 12.0, "xp": 30, "radius": 15.0, "knockback_resist": 1.0, "elite": true},
	"apac_cut": {"name": "亚太区优化", "art": "apac_cut", "size": 54.0, "color": Color("ffc2cf"),
		"hp": 1400.0, "speed": 30.0, "damage": 20.0, "xp": 60, "radius": 14.0, "knockback_resist": 1.0, "elite": true},
	"parachute_boss": {"name": "空降老板", "art": "parachute_boss", "size": 52.0, "color": Color("d9d1f2"),
		"hp": 2200.0, "speed": 32.0, "damage": 24.0, "xp": 90, "radius": 14.0, "knockback_resist": 1.0, "elite": true},
	"kaya_boss": {"name": "老板画咖椰吐司", "art": "kaya_boss", "size": 58.0, "color": Color("f2c46b"),
		"hp": 3000.0, "speed": 30.0, "damage": 26.0, "xp": 100, "radius": 15.0, "knockback_resist": 1.0, "elite": true},
	# 北京.
	"juanwang": {"name": "卷王", "art": "juanwang", "size": 58.0, "color": Color("ffd36b"),
		"hp": 600.0, "speed": 30.0, "damage": 12.0, "xp": 30, "radius": 15.0, "knockback_resist": 1.0, "elite": true},
	"ppt": {"name": "述职 PPT", "art": "ppt", "size": 54.0, "color": Color("f0a35e"),
		"hp": 1400.0, "speed": 30.0, "damage": 20.0, "xp": 60, "radius": 14.0, "knockback_resist": 1.0, "elite": true},
	"elimination": {"name": "末位淘汰", "art": "elimination", "size": 58.0, "color": Color("d64545"),
		"hp": 2200.0, "speed": 32.0, "damage": 24.0, "xp": 90, "radius": 15.0, "knockback_resist": 1.0, "elite": true},
	"annual_party": {"name": "年会讲话", "art": "annual_party", "size": 58.0, "color": Color("ff5d5d"),
		"hp": 3000.0, "speed": 30.0, "damage": 26.0, "xp": 100, "radius": 15.0, "knockback_resist": 1.0, "elite": true},
}
## A boss due while this many are still out waits until one is down. Players who keep up
## never see the wait; it stops a player who has fallen behind from being buried under bosses
## (the live data's deaths had four or five alive at once).
const MAX_BOSSES_OUT := 3

## Mix of the steady trickle by run time; each entry applies until its `until` second.
## The opening is slow bugs only; pings, fast and weaving, join once the player has a level or two.
const WAVES := [
	{"until": 30.0, "mix": {"bug": 1}},
	{"until": 60.0, "mix": {"ping": 3, "bug": 2}},
	{"until": 150.0, "mix": {"ping": 2, "bug": 3, "mail": 2}},
	{"until": 240.0, "mix": {"bug": 1, "mail": 3, "meeting": 2, "ghost": 1}},
	{"until": 330.0, "mix": {"mail": 2, "meeting": 2, "ghost": 2, "techdebt": 2}},
	{"until": 450.0, "mix": {"meeting": 2, "ghost": 2, "techdebt": 3, "server": 1}},
	{"until": 600.0, "mix": {"mail": 2, "ghost": 2, "techdebt": 3, "server": 2}},
]

## The rings of regular enemies, sorted by time (each map may swap in its own, RING_SWAPS). The
## bosses (the map's BOSSES at BossKits.SLOT_AT) and the weather (MAP_EVENT) join them per run.
const EVENTS := [
	{"at": 90.0, "kind": "ring", "type": "ping", "count": 16, "text": "消息轰炸！"},
	{"at": 210.0, "kind": "ring", "type": "bug", "count": 30, "text": "Bug 大爆发！"},
	{"at": 390.0, "kind": "ring", "type": "ghost", "count": 30, "text": "404 幽灵合围！"},
	{"at": 510.0, "kind": "ring", "type": "ping", "count": 48, "text": "消息轰炸 ×2！"},
]

var max_alive := MAX_ALIVE

var _game: Game
var _spawn_budget := 0.0
var _next_event := 0
## Events whose time has come but that haven't gone out yet (a boss held by MAX_BOSSES_OUT).
var _due_events: Array[Dictionary] = []
## This run's schedule, in time order: the same every run on a map.
var _events: Array[Dictionary] = []


func _init(game: Game) -> void:
	_game = game
	if OS.has_feature("mobile") or OS.has_feature("web_android") or OS.has_feature("web_ios"):
		max_alive = MAX_ALIVE_MOBILE
	_events = _plan_events()


## Spawns per second: about 0.5 at the start (eased in, see EASE_IN_SECONDS), about 6.3 by the
## ten-minute mark before the late push (LATE_SPAWN_PER_MINUTE), 12.3 with it. Kept lower than the
## crowd the game first had (9 a second by the end) until .53, since the bosses carry more of the
## pressure.
func spawn_rate() -> float:
	return rate_at(_game.elapsed, Maps.current.DIFFICULTY["spawn"])


## spawn_rate() `seconds` into a run on a map spawning `map_spawn` times as many (static so the
## 官网 can chart it).
static func rate_at(seconds: float, map_spawn: float) -> float:
	var ease_in := lerpf(EASE_IN_START, 1.0, minf(seconds / EASE_IN_SECONDS, 1.0))
	var late := 1.0 + maxf(seconds / 60.0 - LATE_FROM_MINUTE, 0.0) * LATE_SPAWN_PER_MINUTE
	return (0.8 + seconds / 60.0 * 0.55) * ease_in * late * map_spawn


## Enemy HP multiplier so late enemies keep up with upgraded weapons: 1 + HP_PER_MINUTE a minute
## (3.5x by the ten-minute mark), times the map's (Maps: longer working weeks are harder).
func hp_scale() -> float:
	return hp_scale_at(_game.elapsed, Maps.current.DIFFICULTY["hp"])


## hp_scale() `seconds` into a run on a map whose enemies have `map_hp` times the health.
static func hp_scale_at(seconds: float, map_hp: float) -> float:
	return (1.0 + seconds / 60.0 * HP_PER_MINUTE) * map_hp


func tick(delta: float) -> void:
	while _next_event < _events.size() and _game.elapsed >= _events[_next_event]["at"]:
		_due_events.append(_events[_next_event])
		_next_event += 1
	_release_due_events()

	_spawn_budget += spawn_rate() * delta
	while _spawn_budget >= 1.0:
		_spawn_budget -= 1.0
		if _game.enemies.size() >= max_alive:
			_spawn_budget = 0.0
			break
		_game.spawn_enemy(_pick_type(), _game.offscreen_point(_game.random_direction()))


## 测试模式 (TestMode): a run started at `seconds` skips everything planned before then (those
## bosses would have come and gone). Returns how many bosses that skipped, for their year-end
## bonus upgrades.
func skip_to(seconds: float) -> int:
	var bosses := 0
	while _next_event < _events.size() and _events[_next_event]["at"] < seconds:
		if _events[_next_event]["kind"] == "elite":
			bosses += 1
		_next_event += 1
	return bosses


## 测试模式: the next planned boss, now.
func bring_boss() -> void:
	for index in range(_next_event, _events.size()):
		var event: Dictionary = _events[index]
		if event["kind"] == "elite":
			_events.remove_at(index)
			_run_event(event)
			return


## Seconds until the next boss is due, or -1 when none is left. A boss already due but held
## back by MAX_BOSSES_OUT doesn't count: there is no time to show for it.
func seconds_to_next_boss() -> float:
	for index in range(_next_event, _events.size()):
		if _events[index]["kind"] == "elite":
			return _events[index]["at"] - _game.elapsed
	return -1.0


## The run's bosses, for the run's data: seconds and type, e.g. 120:deadline,240:server_elite.
func boss_rolls() -> String:
	var parts := PackedStringArray()
	for event in _events:
		if event["kind"] == "elite":
			parts.append("%d:%s" % [roundi(event["at"]), event["type"]])
	return ",".join(parts)


## The map's schedule: the rings (its own in place of 硅谷's, RING_SWAPS), its weather and its four
## bosses, the last one's arrival worded as the final test.
func _plan_events() -> Array[Dictionary]:
	var events: Array[Dictionary] = []
	var rings: Dictionary = Maps.current.RING_SWAPS
	for written: Dictionary in EVENTS:
		var event := written.duplicate(true)
		if rings.has(event["type"]):
			# The 8:30 one repeats the 1:30 one twice over, and keeps saying so.
			var twice: bool = event.get("text", "").contains("×2")
			event["text"] = rings[event["type"]]["text"].trim_suffix("！") + " ×2！" if twice else rings[event["type"]]["text"]
			event["type"] = rings[event["type"]]["type"]
		events.append(event)
	var map_event: Dictionary = Maps.current.MAP_EVENT
	events.append({"at": map_event["at"], "kind": "map_event", "id": map_event["id"], "seconds": map_event["seconds"],
		"count": 0, "text": map_event["text"]})
	var bosses: Array = Maps.current.BOSSES
	for slot in bosses.size():
		events.append({"at": BossKits.SLOT_AT[slot], "kind": "elite", "type": bosses[slot], "count": 1,
			"text": "最后的考验：%s" if slot == bosses.size() - 1 else "首领出现：%s"})
	events.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return a["at"] < b["at"])
	return events


func _pick_type() -> String:
	var mix: Dictionary = WAVES[-1]["mix"]
	for wave: Dictionary in WAVES:
		if _game.elapsed < wave["until"]:
			mix = wave["mix"]
			break
	var names := mix.keys()
	var weights := PackedFloat32Array()
	for type_name in names:
		weights.append(mix[type_name])
	return names[_game.rng.rand_weighted(weights)]


## Sends out the due events in order, except that a boss waits while MAX_BOSSES_OUT are out;
## rings behind a waiting boss still go out on time.
func _release_due_events() -> void:
	var index := 0
	var bosses_out := -1
	while index < _due_events.size():
		var event := _due_events[index]
		if event["kind"] == "elite":
			if bosses_out < 0:
				bosses_out = _bosses_out()
			if bosses_out >= MAX_BOSSES_OUT:
				index += 1
				continue
			bosses_out += event["count"]
		_due_events.remove_at(index)
		_run_event(event)


func _bosses_out() -> int:
	var count := 0
	for enemy in _game.enemies:
		if enemy.is_elite and not enemy.dead:
			count += 1
	return count


func _run_event(event: Dictionary) -> void:
	if event["kind"] == "map_event":
		_game.start_map_event(event)
	var count: int = event["count"]
	for i in count:
		if event["kind"] == "ring":
			var direction := Vector2.from_angle(TAU * i / count)
			_game.spawn_enemy(event["type"], _game.player.position + direction * RING_RADIUS)
		else:
			# From where the player is heading, not a random side: nothing about a boss is random.
			_game.spawn_enemy(event["type"], _game.offscreen_point(_game.player.facing))
	if event.has("text"):
		Sound.play("alarm")
		var line := tr(event["text"])
		if event["kind"] == "elite":
			line = line % tr(ENEMY_TYPES[event["type"]]["name"])
		_game.announce(line)
