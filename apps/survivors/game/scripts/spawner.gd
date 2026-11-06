class_name Spawner
extends RefCounted
## Decides what spawns and when: a steady trickle whose mix shifts over the run, plus
## scripted events at fixed times: enemy rings closing in, the map's weather, and the map's four
## bosses (BossKits.SLOT_AT).

## The most enemies out at once; past it the trickle waits (the scripted rings still come). The
## same on every device from 66 (the user: 手机电脑都最多 200); until then a computer allowed 260
## and phones 200 (WebAssembly on a phone's slower CPU needs the smaller crowd).
const MAX_ALIVE := 200
const RING_RADIUS := 210.0
## The first minutes spawn fewer enemies than the curve says (60% at the start, back to the full
## rate by 3:00), so the lone starting weapon isn't swamped before the first upgrades land.
const EASE_IN_SECONDS := 180.0
const EASE_IN_START := 0.6
## How much tougher every enemy gets a minute (.40: 0.2 until then; the user wanted it harder
## after .39 made it much easier). The first minute's Bug still takes two of a job weapon's 7s.
const HP_PER_MINUTE := 0.25
## How much the spawn rate grows a minute (spawns a second): EARLY_GROWTH up to LATE_FROM_MINUTE,
## LATE_GROWTH after (66, the user: 后期怪有点过分多了，稍微减一点; 0.55 all the way until then).
## Only a little less spawned (7:00 -4%, 10:00 -8%), but late in a run more come than the player
## kills, so the crowd that piles up shrinks by more than that.
const EARLY_GROWTH := 0.55
const LATE_GROWTH := 0.45
const LATE_FROM_MINUTE := 5.0
## The fewest spawns a second, before the map's multiple (66, the user: 每秒刷怪从 1/1s 开始，不要
## 0.5): the eased-in curve starts at 0.48 and passes 1 only at about 1:00, so the first minute
## is held at 1 a second and the rest of the curve is unchanged.
const MIN_RATE := 1.0

## `size` is the art's frame height in logical pixels, `radius` the body used for hits and
## crowd spacing, `color` the puff left behind on death. Radii are smaller than the art on
## purpose: they are the balance the game was tuned with, and crowds overlapping a little reads
## fine with these drawings. `elite` marks bosses (health bar, the boss bar at the top of the
## screen, a year-end bonus opening when killed; what each does is BossKits').
## Radii stay at or under Game.MAX_ENEMY_RADIUS. Regular enemies walk about 5% slower since .65 (the
## user: 小怪的移速慢一点点): 50 / 46 / 44 / 40 / 38 / 34 / 30 / 26 became 48 / 44 / 42 / 38 / 36 /
## 32 / 29 / 25; bosses kept theirs.
## .97 (the user: 游戏整体怪血量加多，移动速度变慢，营造一种一直有怪追的感觉; boss 不用): every regular
## enemy's `hp` ×1.3 and `speed` ×0.8, rounded (红点 4 → 5 / 48 → 38, 未读邮件 14 → 18 / 42 → 34,
## 宕机服务器 140 → 182 / 25 → 20); the bosses (`elite`) as they were. By the balance formula
## (DESIGN.md 2.8) the health alone takes a fresh player's 硅谷 clear from about 50% to 24%; the
## slower crowd gives some back, by how much the formula can't say (no term for enemy speed).
const ENEMY_TYPES := {
	"ping": {"name": "消息红点", "art": "ping", "size": 22.0, "color": Color("ff5d5d"),
		"hp": 5.0, "speed": 38.0, "damage": 5.0, "xp": 1, "radius": 5.0, "wobble": 30.0},
	"bug": {"name": "Bug", "art": "bug", "size": 24.0, "color": Color("ff5d5d"),
		"hp": 10.0, "speed": 29.0, "damage": 6.0, "xp": 1, "radius": 6.0},
	"mail": {"name": "未读邮件", "art": "mail", "size": 24.0, "color": Color("fff7e0"),
		"hp": 18.0, "speed": 34.0, "damage": 8.0, "xp": 2, "radius": 6.0},
	"meeting": {"name": "会议邀请", "art": "meeting", "size": 26.0, "color": Color("5b9cff"),
		"hp": 34.0, "speed": 23.0, "damage": 9.0, "xp": 3, "radius": 6.0},
	"ghost": {"name": "404 幽灵", "art": "ghost404", "size": 26.0, "color": Color("eef1f6"),
		"hp": 23.0, "speed": 30.0, "damage": 10.0, "xp": 3, "radius": 6.0, "ghostly": true},
	"techdebt": {"name": "技术债", "art": "techdebt", "size": 28.0, "color": Color("ffd36b"),
		"hp": 58.0, "speed": 26.0, "damage": 12.0, "xp": 4, "radius": 6.0, "knockback_resist": 0.5},
	"server": {"name": "宕机服务器", "art": "server", "size": 38.0, "color": Color("a9b3c4"),
		"hp": 182.0, "speed": 20.0, "damage": 18.0, "xp": 10, "radius": 10.0, "knockback_resist": 0.8},
	# 西二旗's rush hour (Beijing.RING_SWAPS): a crowd of commuters in place of the Bug outbreak,
	# a little quicker than bugs and as frail.
	"commuter": {"name": "早高峰打工人", "art": "commuter", "size": 24.0, "color": Color("9aa5b8"),
		"hp": 10.0, "speed": 34.0, "damage": 6.0, "xp": 1, "radius": 6.0},
	# Same-day delivery (Seattle.RING_SWAPS): a ring of parcels in place of the Bug outbreak, as frail.
	"parcel": {"name": "Prime 包裹", "art": "parcel", "size": 24.0, "color": Color("d4b483"),
		"hp": 10.0, "speed": 34.0, "damage": 6.0, "xp": 1, "radius": 6.0},
	# Each map's own crowd (the map's MOB_SWAPS, .36, the user's call): the seven regular enemies
	# redrawn for the map, built and as strong as the ones they stand in for (Game.spawn_enemy
	# swaps them in, so waves and rings use them). Since .41 every map has 硅谷's crowd again (the
	# user's call: the crowd is the same everywhere, only the bosses are the map's own); these stay
	# in the table, unused.
	# 北京.
	"dingding": {"name": "盯盯消息", "art": "dingding", "size": 22.0, "color": Color("5b9cff"),
		"hp": 5.0, "speed": 38.0, "damage": 5.0, "xp": 1, "radius": 5.0, "wobble": 30.0},
	# Three of the old local crowd back in every map's mix from .57 (the user: 加更多小怪类型，不用技能，
	# 只要数值), each with numbers of its own between the seven's: 小需求 quick fodder (a bug's
	# health and damage, a ping's speed), KPI quick and sturdy mid-run, 流量洪峰 a heavy between 技术债
	# and 宕机服务器. (Until .40 they were Beijing's stand-ins, the numbers of the ones they replaced.)
	"small_req": {"name": "小需求", "art": "small_req", "size": 24.0, "color": Color("ffd25e"),
		"hp": 13.0, "speed": 38.0, "damage": 6.0, "xp": 1, "radius": 6.0},
	"daily_report": {"name": "日报", "art": "daily_report", "size": 24.0, "color": Color("fff7e0"),
		"hp": 18.0, "speed": 34.0, "damage": 8.0, "xp": 2, "radius": 6.0},
	"group_chat": {"name": "拉个群", "art": "group_chat", "size": 26.0, "color": Color("6cc25a"),
		"hp": 34.0, "speed": 23.0, "damage": 9.0, "xp": 3, "radius": 6.0},
	"read_no_reply": {"name": "已读不回", "art": "read_no_reply", "size": 26.0, "color": Color("eef1f6"),
		"hp": 23.0, "speed": 30.0, "damage": 10.0, "xp": 3, "radius": 6.0, "ghostly": true},
	"kpi": {"name": "KPI", "art": "kpi", "size": 28.0, "color": Color("ff5d5d"),
		"hp": 39.0, "speed": 35.0, "damage": 10.0, "xp": 3, "radius": 6.0, "knockback_resist": 0.5},
	"traffic_flood": {"name": "流量洪峰", "art": "traffic_flood", "size": 38.0, "color": Color("5b9cff"),
		"hp": 117.0, "speed": 26.0, "damage": 15.0, "xp": 6, "radius": 9.0, "knockback_resist": 0.6},
	# 西雅图.
	"at_here": {"name": "@here", "art": "at_here", "size": 22.0, "color": Color("7b68d9"),
		"hp": 5.0, "speed": 38.0, "damage": 5.0, "xp": 1, "radius": 5.0, "wobble": 30.0},
	"sev3_ticket": {"name": "Sev-3 工单", "art": "sev3_ticket", "size": 24.0, "color": Color("f7c948"),
		"hp": 10.0, "speed": 29.0, "damage": 6.0, "xp": 1, "radius": 6.0},
	"code_review": {"name": "CR 请求", "art": "code_review", "size": 24.0, "color": Color("fff7e0"),
		"hp": 18.0, "speed": 34.0, "damage": 8.0, "xp": 2, "radius": 6.0},
	"one_on_one": {"name": "1:1", "art": "one_on_one", "size": 26.0, "color": Color("bcdcf2"),
		"hp": 34.0, "speed": 23.0, "damage": 9.0, "xp": 3, "radius": 6.0},
	"night_page": {"name": "半夜 Page", "art": "night_page", "size": 26.0, "color": Color("eef1f6"),
		"hp": 23.0, "speed": 30.0, "damage": 10.0, "xp": 3, "radius": 6.0, "ghostly": true},
	"six_pager": {"name": "六页纸", "art": "six_pager", "size": 28.0, "color": Color("faf7f0"),
		"hp": 58.0, "speed": 26.0, "damage": 12.0, "xp": 4, "radius": 6.0, "knockback_resist": 0.5},
	"cloud_bill": {"name": "AWS 账单", "art": "cloud_bill", "size": 38.0, "color": Color("ffd25e"),
		"hp": 182.0, "speed": 20.0, "damage": 18.0, "xp": 10, "radius": 10.0, "knockback_resist": 0.8},
	# 伦敦 (.37): its crowd and its queue ring.
	"pigeon": {"name": "鸽子", "art": "pigeon", "size": 22.0, "color": Color("a9b3c4"),
		"hp": 5.0, "speed": 38.0, "damage": 5.0, "xp": 1, "radius": 5.0, "wobble": 30.0},
	"teabag": {"name": "茶包", "art": "teabag", "size": 24.0, "color": Color("c98d5a"),
		"hp": 10.0, "speed": 29.0, "damage": 6.0, "xp": 1, "radius": 6.0},
	"visa_form": {"name": "签证材料", "art": "visa_form", "size": 24.0, "color": Color("fff7e0"),
		"hp": 18.0, "speed": 34.0, "damage": 8.0, "xp": 2, "radius": 6.0},
	"pub_invite": {"name": "Pub 社交局", "art": "pub_invite", "size": 26.0, "color": Color("ffd25e"),
		"hp": 34.0, "speed": 23.0, "damage": 9.0, "xp": 3, "radius": 6.0},
	"tower_ghost": {"name": "伦敦塔幽灵", "art": "tower_ghost", "size": 26.0, "color": Color("eef1f6"),
		"hp": 23.0, "speed": 30.0, "damage": 10.0, "xp": 3, "radius": 6.0, "ghostly": true},
	"compliance": {"name": "合规流程", "art": "compliance", "size": 28.0, "color": Color("d6d9de"),
		"hp": 58.0, "speed": 26.0, "damage": 12.0, "xp": 4, "radius": 6.0, "knockback_resist": 0.5},
	"double_decker": {"name": "双层巴士", "art": "double_decker", "size": 38.0, "color": Color("d94b5c"),
		"hp": 182.0, "speed": 20.0, "damage": 18.0, "xp": 10, "radius": 10.0, "knockback_resist": 0.8},
	# The queue (London.RING_SWAPS): a ring of Britons in place of the Bug outbreak, as frail.
	"queue_brit": {"name": "排队的英国人", "art": "queue_brit", "size": 24.0, "color": Color("8a909c"),
		"hp": 10.0, "speed": 34.0, "damage": 6.0, "xp": 1, "radius": 6.0},
	# 新加坡 (.38): its crowd and its tissue ring.
	"mosquito": {"name": "蚊子", "art": "mosquito", "size": 22.0, "color": Color("8a909c"),
		"hp": 5.0, "speed": 38.0, "damage": 5.0, "xp": 1, "radius": 5.0, "wobble": 30.0},
	"gecko": {"name": "壁虎", "art": "gecko", "size": 24.0, "color": Color("c9d6a3"),
		"hp": 10.0, "speed": 29.0, "damage": 6.0, "xp": 1, "radius": 6.0},
	"grub_order": {"name": "Grub 外卖单", "art": "grub_order", "size": 24.0, "color": Color("6cc25a"),
		"hp": 18.0, "speed": 34.0, "damage": 8.0, "xp": 2, "radius": 6.0},
	"align_call": {"name": "跨时区对齐会", "art": "align_call", "size": 26.0, "color": Color("bcdcf2"),
		"hp": 34.0, "speed": 23.0, "damage": 9.0, "xp": 3, "radius": 6.0},
	"hungry_ghost": {"name": "中元节饿鬼", "art": "hungry_ghost", "size": 26.0, "color": Color("eef1f6"),
		"hp": 23.0, "speed": 30.0, "damage": 10.0, "xp": 3, "radius": 6.0, "ghostly": true},
	"coe": {"name": "COE 拥车证", "art": "coe", "size": 28.0, "color": Color("fff7e0"),
		"hp": 58.0, "speed": 26.0, "damage": 12.0, "xp": 4, "radius": 6.0, "knockback_resist": 0.5},
	"durian": {"name": "榴莲", "art": "durian", "size": 38.0, "color": Color("c6d94a"),
		"hp": 182.0, "speed": 20.0, "damage": 18.0, "xp": 10, "radius": 10.0, "knockback_resist": 0.8},
	# The hawker centre at lunch (Singapore.RING_SWAPS): a ring of tissue packets, as frail as bugs.
	"tissue_chope": {"name": "纸巾占座", "art": "tissue_chope", "size": 24.0, "color": Color("faf7f0"),
		"hp": 10.0, "speed": 34.0, "damage": 6.0, "xp": 1, "radius": 6.0},
	# The bosses (.45, BossKits: their attacks and lines), four a map in the order they come (each map's
	# BOSSES), as strong as their slot (BossKits.SLOT_STATS, which the game doesn't read: the numbers
	# here are the ones that count, and the smoke test checks the two agree; .76 changed only the
	# slots' speeds, so the bosses kept walking 30-32 until .78): health before the minute's and the map's
	# multipliers, contact damage before the map's, stars. Until .44 there were 10 to 12 a run, from a
	# shared schedule with each map's stand-ins, drawing moves and affixes at random.
	# 硅谷.
	"deadline": {"name": "Deadline", "art": "deadline", "size": 50.0, "color": Color("ff5d5d"),
		"hp": 600.0, "speed": 42.0, "damage": 12.0, "xp": 30, "radius": 14.0, "knockback_resist": 1.0, "elite": true},
	"server_elite": {"name": "主库宕机", "art": "db_down", "size": 54.0, "color": Color("a9b3c4"),
		"hp": 1400.0, "speed": 42.0, "damage": 20.0, "xp": 60, "radius": 13.0, "knockback_resist": 1.0, "elite": true},
	"ai": {"name": "AI 大模型", "art": "ai_boss", "size": 64.0, "color": Color("8c7cf0"),
		"hp": 2200.0, "speed": 44.0, "damage": 24.0, "xp": 90, "radius": 16.0, "knockback_resist": 1.0, "elite": true},
	"pie_boss": {"name": "老板画饼", "art": "pie_boss", "size": 58.0, "color": Color("f2c46b"),
		"hp": 3000.0, "speed": 42.0, "damage": 26.0, "xp": 100, "radius": 15.0, "knockback_resist": 1.0, "elite": true},
	# 伦敦.
	"committee": {"name": "委员会", "art": "committee", "size": 60.0, "color": Color("a9b3c4"),
		"hp": 600.0, "speed": 42.0, "damage": 12.0, "xp": 30, "radius": 15.0, "knockback_resist": 1.0, "elite": true},
	"redundancy": {"name": "冗余通知", "art": "redundancy", "size": 54.0, "color": Color("d4b483"),
		"hp": 1400.0, "speed": 42.0, "damage": 20.0, "xp": 60, "radius": 14.0, "knockback_resist": 1.0, "elite": true},
	"gdpr": {"name": "GDPR 合规官", "art": "gdpr", "size": 58.0, "color": Color("5b9cff"),
		"hp": 2200.0, "speed": 44.0, "damage": 24.0, "xp": 90, "radius": 15.0, "knockback_resist": 1.0, "elite": true},
	"scone_boss": {"name": "老板递司康", "art": "scone_boss", "size": 58.0, "color": Color("f2c46b"),
		"hp": 3000.0, "speed": 42.0, "damage": 26.0, "xp": 100, "radius": 15.0, "knockback_resist": 1.0, "elite": true},
	# 西雅图.
	"monolith": {"name": "巨石应用", "art": "monolith", "size": 60.0, "color": Color("8a909c"),
		"hp": 600.0, "speed": 42.0, "damage": 12.0, "xp": 30, "radius": 15.0, "knockback_resist": 1.0, "elite": true},
	"meeting_spam": {"name": "连环会", "art": "meeting_spam", "size": 54.0, "color": Color("b8a8f0"),
		"hp": 1400.0, "speed": 42.0, "damage": 20.0, "xp": 60, "radius": 14.0, "knockback_resist": 1.0, "elite": true},
	"pip": {"name": "PIP 绩效改进", "art": "pip", "size": 54.0, "color": Color("ffc2cf"),
		"hp": 2200.0, "speed": 44.0, "damage": 24.0, "xp": 90, "radius": 14.0, "knockback_resist": 1.0, "elite": true},
	"all_hands": {"name": "全员大会", "art": "all_hands", "size": 58.0, "color": Color("f2c46b"),
		"hp": 3000.0, "speed": 42.0, "damage": 26.0, "xp": 100, "radius": 15.0, "knockback_resist": 1.0, "elite": true},
	# 新加坡.
	"forms": {"name": "表格", "art": "forms", "size": 60.0, "color": Color("fff7e0"),
		"hp": 600.0, "speed": 42.0, "damage": 12.0, "xp": 30, "radius": 15.0, "knockback_resist": 1.0, "elite": true},
	"apac_cut": {"name": "亚太区优化", "art": "apac_cut", "size": 54.0, "color": Color("ffc2cf"),
		"hp": 1400.0, "speed": 42.0, "damage": 20.0, "xp": 60, "radius": 14.0, "knockback_resist": 1.0, "elite": true},
	"parachute_boss": {"name": "空降老板", "art": "parachute_boss", "size": 52.0, "color": Color("d9d1f2"),
		"hp": 2200.0, "speed": 44.0, "damage": 24.0, "xp": 90, "radius": 14.0, "knockback_resist": 1.0, "elite": true},
	"kaya_boss": {"name": "老板画咖椰吐司", "art": "kaya_boss", "size": 58.0, "color": Color("f2c46b"),
		"hp": 3000.0, "speed": 42.0, "damage": 26.0, "xp": 100, "radius": 15.0, "knockback_resist": 1.0, "elite": true},
	# 北京.
	"juanwang": {"name": "卷王", "art": "juanwang", "size": 58.0, "color": Color("ffd36b"),
		"hp": 600.0, "speed": 42.0, "damage": 12.0, "xp": 30, "radius": 15.0, "knockback_resist": 1.0, "elite": true},
	"ppt": {"name": "述职 PPT", "art": "ppt", "size": 54.0, "color": Color("f0a35e"),
		"hp": 1400.0, "speed": 42.0, "damage": 20.0, "xp": 60, "radius": 14.0, "knockback_resist": 1.0, "elite": true},
	"elimination": {"name": "末位淘汰", "art": "elimination", "size": 58.0, "color": Color("d64545"),
		"hp": 2200.0, "speed": 44.0, "damage": 24.0, "xp": 90, "radius": 15.0, "knockback_resist": 1.0, "elite": true},
	"annual_party": {"name": "年会讲话", "art": "annual_party", "size": 58.0, "color": Color("ff5d5d"),
		"hp": 3000.0, "speed": 42.0, "damage": 26.0, "xp": 100, "radius": 15.0, "knockback_resist": 1.0, "elite": true},
}

## Mix of the steady trickle by run time; each entry applies until its `until` second.
## The opening is pings only since .57 (the user: 刚开始出来的应该是红点，因为他血量最少): one hit
## of the starting weapons kills one (4 health; a bug's 8 takes two), so the first star comes
## sooner, and though they weave they are still slower than any job. Bugs join at 0:30 and take
## over. (Until .56 it was bugs only, pings joining at 0:30, for being fast and weaving.)
## .57 added 小需求 (from 1:00), KPI (2:30) and 流量洪峰 (5:30), weighted so each stretch's average
## health per enemy stays within 6% of what it was (and its stars about the same): more kinds,
## about the same difficulty.
const WAVES := [
	{"until": 30.0, "mix": {"ping": 1}},
	{"until": 60.0, "mix": {"bug": 3, "ping": 2}},
	{"until": 150.0, "mix": {"ping": 2, "small_req": 2, "bug": 3, "mail": 2}},
	{"until": 240.0, "mix": {"bug": 1, "small_req": 1, "mail": 3, "meeting": 2, "kpi": 1, "ghost": 1}},
	{"until": 330.0, "mix": {"mail": 2, "meeting": 2, "kpi": 2, "ghost": 2, "techdebt": 2}},
	{"until": 450.0, "mix": {"meeting": 2, "kpi": 1, "ghost": 2, "techdebt": 3, "traffic_flood": 1, "server": 1}},
	{"until": 600.0, "mix": {"mail": 2, "kpi": 2, "ghost": 2, "techdebt": 2, "traffic_flood": 1, "server": 2}},
]

## The rings of regular enemies, sorted by time (each map may swap in its own, RING_SWAPS). The
## bosses (the map's BOSSES at BossKits.SLOT_AT) and the weather (MAP_EVENT) join them per run.
const EVENTS := [
	{"at": 90.0, "kind": "ring", "type": "ping", "count": 16, "text": "消息轰炸！"},
	{"at": 210.0, "kind": "ring", "type": "bug", "count": 30, "text": "Bug 大爆发！"},
	{"at": 390.0, "kind": "ring", "type": "ghost", "count": 30, "text": "404 幽灵合围！"},
	{"at": 510.0, "kind": "ring", "type": "ping", "count": 48, "text": "消息轰炸 ×2！"},
]

var _game: Game
var _spawn_budget := 0.0
var _next_event := 0
## This run's schedule, in time order: the same every run on a map.
var _events: Array[Dictionary] = []


func _init(game: Game) -> void:
	_game = game
	_events = _plan_events()


## Spawns per second: never under MIN_RATE (1 at the start, where the ease-in alone gave about
## 0.5 until 66; see EASE_IN_SECONDS), 3.55 by 5:00, then
## growing more slowly (LATE_GROWTH), 5.8 by the ten-minute mark. Kept lower than the crowd the
## game first had (9 a second by the end), since the bosses carry more of the pressure. .53–.58
## spawned more on top from 5:00 on (+19% a minute, 12.3 a second by 10:00); .59 took that out
## (the user: 这个逻辑去掉), partly because MAX_ALIVE likely cut much of it off late in a run anyway.
func spawn_rate() -> float:
	return rate_at(_game.elapsed, Maps.difficulty("spawn"))


## spawn_rate() `seconds` into a run on a map spawning `map_spawn` times as many (static so the
## 官网 can chart it).
static func rate_at(seconds: float, map_spawn: float) -> float:
	var ease_in := lerpf(EASE_IN_START, 1.0, minf(seconds / EASE_IN_SECONDS, 1.0))
	var minutes := seconds / 60.0
	var grown := EARLY_GROWTH * minf(minutes, LATE_FROM_MINUTE) + LATE_GROWTH * maxf(minutes - LATE_FROM_MINUTE, 0.0)
	return maxf(MIN_RATE, (0.8 + grown) * ease_in) * map_spawn


## Enemy HP multiplier so late enemies keep up with upgraded weapons: 1 + HP_PER_MINUTE a minute
## (3.5x by the ten-minute mark), times the map's (Maps: longer working weeks are harder).
func hp_scale() -> float:
	return hp_scale_at(_game.elapsed, Maps.difficulty("hp"))


## hp_scale() `seconds` into a run on a map whose enemies have `map_hp` times the health.
static func hp_scale_at(seconds: float, map_hp: float) -> float:
	return (1.0 + seconds / 60.0 * HP_PER_MINUTE) * map_hp


func tick(delta: float) -> void:
	# Every event, bosses included, goes out on time. .3–.66 held a boss back while three were
	# out (MAX_BOSSES_OUT); .67 took that out (the user: 场上最多三个限制去掉).
	while _next_event < _events.size() and _game.elapsed >= _events[_next_event]["at"]:
		_run_event(_events[_next_event])
		_next_event += 1

	_spawn_budget += spawn_rate() * delta
	while _spawn_budget >= 1.0:
		_spawn_budget -= 1.0
		if _game.enemies.size() >= MAX_ALIVE:
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


## Seconds until the next boss is due, or -1 when none is left.
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
