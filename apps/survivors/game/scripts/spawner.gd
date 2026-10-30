class_name Spawner
extends RefCounted
## Decides what spawns and when: a steady trickle whose mix shifts over the run, plus
## scripted events (enemy rings closing in, a boss every minute) at fixed times.

const MAX_ALIVE := 260
## Phones run the same GDScript through WebAssembly on a slower CPU, so the crowd is capped
## lower there to keep the frame rate up.
const MAX_ALIVE_MOBILE := 200
const RING_RADIUS := 210.0
## The first minutes spawn fewer enemies than the curve says (60% at the start, back to the full
## rate by 3:00), so the lone starting weapon isn't swamped before the first upgrades land.
const EASE_IN_SECONDS := 180.0
const EASE_IN_START := 0.6

## `size` is the art's frame height in logical pixels, `radius` the body used for hits and
## crowd spacing, `color` the puff left behind on death. Radii are smaller than the art on
## purpose: they are the balance the game was tuned with, and crowds overlapping a little reads
## fine with these drawings. `elite` marks bosses (health bar, the boss bar at the top of the
## screen, a chest when killed); `ability` is a boss move Enemy knows (see Enemy.ABILITIES).
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
	# The early bosses: bigger, tougher versions of regular enemies, for the first minutes, drawn
	# apart from them since .31 (they shared the 技术债 / 宕机服务器 pictures, the user said not to). They
	# hit no harder than the regular enemies of their time and walk slower than the player:
	# hitting harder, they killed the test bot at 2:00 more often than anything else. Every boss
	# but the first has a move of its own (Enemy.ABILITIES); the first is only big.
	"techdebt_elite": {"name": "祖传技术债", "art": "techdebt_boss", "size": 46.0, "color": Color("ffd36b"),
		"hp": 360.0, "speed": 28.0, "damage": 9.0, "xp": 20, "radius": 11.0, "knockback_resist": 0.9, "elite": true},
	"server_elite": {"name": "主库宕机", "art": "db_down", "size": 54.0, "color": Color("a9b3c4"),
		"hp": 630.0, "speed": 24.0, "damage": 11.0, "xp": 30, "radius": 13.0, "knockback_resist": 1.0, "elite": true,
		"ability": "quake"},
	# Boss health and damage were raised by 40% / 25% after the first full run on the live site
	# ended at full health with all twelve bosses down.
	"layoff": {"name": "裁员通知", "art": "layoff", "size": 54.0, "color": Color("ffc2cf"),
		"hp": 1400.0, "speed": 32.0, "damage": 22.0, "xp": 60, "radius": 14.0, "knockback_resist": 1.0, "elite": true,
		"ability": "charge"},
	"deadline": {"name": "Deadline", "art": "deadline", "size": 50.0, "color": Color("ff5d5d"),
		"hp": 1260.0, "speed": 36.0, "damage": 31.0, "xp": 60, "radius": 14.0, "knockback_resist": 1.0, "elite": true,
		"ability": "countdown"},
	"ai": {"name": "AI 大模型", "art": "ai_boss", "size": 64.0, "color": Color("8c7cf0"),
		"hp": 2240.0, "speed": 40.0, "damage": 38.0, "xp": 100, "radius": 16.0, "knockback_resist": 1.0, "elite": true,
		"ability": "clones"},
	# The AI's see-through copy: breaks at any hit, hits half as hard, gives nothing ("phantom").
	"ai_clone": {"name": "AI 幻觉", "art": "ai_boss", "size": 54.0, "color": Color("8c7cf0"),
		"hp": 1.0, "speed": 40.0, "damage": 19.0, "xp": 0, "radius": 13.0, "knockback_resist": 0.6, "phantom": true},
	# 15% less health than before its aura: the aura makes the crowd round it harder to clear.
	"investor": {"name": "投资人", "art": "investor", "size": 58.0, "color": Color("bcdcf2"),
		"hp": 1666.0, "speed": 30.0, "damage": 30.0, "xp": 90, "radius": 15.0, "knockback_resist": 1.0, "elite": true,
		"ability": "aura"},
	# The late bosses, one new move each. Spaghetti code keeps leaking bugs and, killed, falls
	# apart into smaller piles (`splits_into`), which don't split again.
	"spaghetti": {"name": "屎山代码", "art": "spaghetti", "size": 60.0, "color": Color("c98d5a"),
		"hp": 2200.0, "speed": 22.0, "damage": 26.0, "xp": 80, "radius": 15.0, "knockback_resist": 1.0, "elite": true,
		"ability": "summon", "summon_type": "bug", "summon_count": 6,
		"splits_into": "spaghetti_small", "split_count": 3},
	"spaghetti_small": {"name": "小屎山", "art": "spaghetti_small", "size": 30.0, "color": Color("c98d5a"),
		"hp": 260.0, "speed": 34.0, "damage": 14.0, "xp": 8, "radius": 9.0, "knockback_resist": 0.6},
	"scope_change": {"name": "需求变更", "art": "scope_change", "size": 52.0, "color": Color("d9d1f2"),
		"hp": 1700.0, "speed": 34.0, "damage": 28.0, "xp": 70, "radius": 14.0, "knockback_resist": 1.0, "elite": true,
		"ability": "blink"},
	"incident": {"name": "P0 线上事故", "art": "incident", "size": 54.0, "color": Color("ff5d5d"),
		"hp": 1600.0, "speed": 30.0, "damage": 26.0, "xp": 70, "radius": 14.0, "knockback_resist": 1.0, "elite": true,
		"ability": "volley"},
	"pie_boss": {"name": "老板画饼", "art": "pie_boss", "size": 58.0, "color": Color("f2c46b"),
		"hp": 1900.0, "speed": 28.0, "damage": 24.0, "xp": 80, "radius": 15.0, "knockback_resist": 1.0, "elite": true,
		"ability": "lob"},
	# 北京's own (Beijing.BOSS_SWAPS), each in the slot of the Silicon Valley boss it replaces,
	# built like it and as strong (the health, damage and stars below are its; Spawner takes them
	# from the slot anyway). `arrival` is its line when it comes on; `berserk_line`, `on_time_line`
	# and `death_line` stand in for Deadline's and the investor's.
	"weekly_report": {"name": "周报", "art": "weekly_report", "size": 46.0, "color": Color("bcdcf2"),
		"hp": 360.0, "speed": 28.0, "damage": 9.0, "xp": 20, "radius": 11.0, "knockback_resist": 0.9, "elite": true,
		"arrival": "精英怪：周报！"},
	"midlife": {"name": "35 岁危机", "art": "midlife", "size": 54.0, "color": Color("ffd9b8"),
		"hp": 1400.0, "speed": 32.0, "damage": 22.0, "xp": 60, "radius": 14.0, "knockback_resist": 1.0, "elite": true,
		"ability": "charge", "arrival": "首领出现：35 岁危机"},
	"fubao": {"name": "福报 996", "art": "fubao", "size": 50.0, "color": Color("ff5d5d"),
		"hp": 1260.0, "speed": 36.0, "damage": 31.0, "xp": 60, "radius": 14.0, "knockback_resist": 1.0, "elite": true,
		"ability": "countdown", "arrival": "福报 996 来了！",
		"berserk_line": "到点了还没下班！它开始加班暴走", "on_time_line": "准点下班！年终奖保底绩效 A"},
	"juanwang": {"name": "卷王", "art": "juanwang", "size": 58.0, "color": Color("ffd36b"),
		"hp": 1666.0, "speed": 30.0, "damage": 30.0, "xp": 90, "radius": 15.0, "knockback_resist": 1.0, "elite": true,
		"ability": "aura", "arrival": "首领出现：卷王", "death_line": "卷王倒了！掉了一地经验"},
	"baimo": {"name": "百模大战", "art": "baimo", "size": 64.0, "color": Color("5fb3a8"),
		"hp": 2240.0, "speed": 40.0, "damage": 38.0, "xp": 100, "radius": 16.0, "knockback_resist": 1.0, "elite": true,
		"ability": "clones", "clone_type": "baimo_clone", "arrival": "首领出现：百模大战"},
	"baimo_clone": {"name": "又一个大模型", "art": "baimo", "size": 54.0, "color": Color("5fb3a8"),
		"hp": 1.0, "speed": 40.0, "damage": 19.0, "xp": 0, "radius": 13.0, "knockback_resist": 0.6, "phantom": true},
	"inspection": {"name": "领导视察", "art": "inspection", "size": 52.0, "color": Color("3b4a6b"),
		"hp": 1700.0, "speed": 34.0, "damage": 28.0, "xp": 70, "radius": 14.0, "knockback_resist": 1.0, "elite": true,
		"ability": "blink", "arrival": "领导视察！"},
	"ppt": {"name": "述职 PPT", "art": "ppt", "size": 54.0, "color": Color("f0a35e"),
		"hp": 1600.0, "speed": 30.0, "damage": 26.0, "xp": 70, "radius": 14.0, "knockback_resist": 1.0, "elite": true,
		"ability": "volley", "arrival": "述职 PPT！"},
	# 西二旗's rush hour (Beijing.RING_SWAPS): a crowd of commuters in place of the Bug outbreak,
	# a little quicker than bugs and as frail.
	"commuter": {"name": "早高峰打工人", "art": "commuter", "size": 24.0, "color": Color("9aa5b8"),
		"hp": 8.0, "speed": 44.0, "damage": 6.0, "xp": 1, "radius": 6.0},
	# 西雅图's own (Seattle.BOSS_SWAPS, .34), slot for slot as 北京's are.
	"day1": {"name": "Day 1", "art": "day1", "size": 46.0, "color": Color("ffd36b"),
		"hp": 360.0, "speed": 28.0, "damage": 9.0, "xp": 20, "radius": 11.0, "knockback_resist": 0.9, "elite": true,
		"arrival": "精英怪：Day 1！永远是第一天"},
	"pip": {"name": "PIP 绩效改进", "art": "pip", "size": 54.0, "color": Color("ffc2cf"),
		"hp": 1400.0, "speed": 32.0, "damage": 22.0, "xp": 60, "radius": 14.0, "knockback_resist": 1.0, "elite": true,
		"ability": "charge", "arrival": "首领出现：PIP 绩效改进计划"},
	"prime_day": {"name": "Prime Day", "art": "prime_day", "size": 50.0, "color": Color("ff5d5d"),
		"hp": 1260.0, "speed": 36.0, "damage": 31.0, "xp": 60, "radius": 14.0, "knockback_resist": 1.0, "elite": true,
		"ability": "countdown", "arrival": "Prime Day 大促来了！",
		"berserk_line": "大促零点到了！它开始暴走", "on_time_line": "大促前搞定！年终奖保底绩效 A"},
	"bar_raiser": {"name": "Bar Raiser", "art": "bar_raiser", "size": 58.0, "color": Color("bcdcf2"),
		"hp": 1666.0, "speed": 30.0, "damage": 30.0, "xp": 90, "radius": 15.0, "knockback_resist": 1.0, "elite": true,
		"ability": "aura", "arrival": "首领出现：Bar Raiser 面试官", "death_line": "Bar Raiser 放水了！掉了一地经验"},
	"copilot": {"name": "Copilot", "art": "copilot", "size": 64.0, "color": Color("5fb3d6"),
		"hp": 2240.0, "speed": 40.0, "damage": 38.0, "xp": 100, "radius": 16.0, "knockback_resist": 1.0, "elite": true,
		"ability": "clones", "clone_type": "copilot_clone", "arrival": "首领出现：Copilot"},
	"copilot_clone": {"name": "又一个 Copilot", "art": "copilot", "size": 54.0, "color": Color("5fb3d6"),
		"hp": 1.0, "speed": 40.0, "damage": 19.0, "xp": 0, "radius": 13.0, "knockback_resist": 0.6, "phantom": true},
	"reorg": {"name": "部门重组", "art": "reorg", "size": 52.0, "color": Color("d9d1f2"),
		"hp": 1700.0, "speed": 34.0, "damage": 28.0, "xp": 70, "radius": 14.0, "knockback_resist": 1.0, "elite": true,
		"ability": "blink", "arrival": "部门重组！"},
	"meeting_spam": {"name": "连环会", "art": "meeting_spam", "size": 54.0, "color": Color("b8a8f0"),
		"hp": 1600.0, "speed": 30.0, "damage": 26.0, "xp": 70, "radius": 14.0, "knockback_resist": 1.0, "elite": true,
		"ability": "volley", "arrival": "连环会邀请轰炸！"},
	# Same-day delivery (Seattle.RING_SWAPS): a ring of parcels in place of the Bug outbreak, as frail.
	"parcel": {"name": "Prime 包裹", "art": "parcel", "size": 24.0, "color": Color("d4b483"),
		"hp": 8.0, "speed": 44.0, "damage": 6.0, "xp": 1, "radius": 6.0},
	# Each map's guest boss (the map's GUEST_BOSS, .26), on top of the schedule at 5:30, with a move
	# of its own (Enemy "pull", "squeeze", "hoard"); built and as strong as the 6:00 boss.
	"rto": {"name": "RTO 返岗令", "art": "rto", "size": 58.0, "color": Color("5b9cff"),
		"hp": 1666.0, "speed": 30.0, "damage": 30.0, "xp": 90, "radius": 15.0, "knockback_resist": 1.0, "elite": true,
		"ability": "pull", "arrival": "特邀嘉宾：RTO 返岗令！"},
	"elimination": {"name": "末位淘汰", "art": "elimination", "size": 58.0, "color": Color("d64545"),
		"hp": 1666.0, "speed": 30.0, "damage": 30.0, "xp": 90, "radius": 15.0, "knockback_resist": 1.0, "elite": true,
		"ability": "squeeze", "arrival": "特邀嘉宾：末位淘汰！"},
	"frugality": {"name": "节俭", "art": "frugality", "size": 58.0, "color": Color("f6c6cf"),
		"hp": 1666.0, "speed": 30.0, "damage": 30.0, "xp": 90, "radius": 15.0, "knockback_resist": 1.0, "elite": true,
		"ability": "hoard", "arrival": "特邀嘉宾：节俭！它会吸走地上的星星", "death_line": "节俭倒了！攒的经验全吐出来了"},
	# Each map's own crowd (the map's MOB_SWAPS, .36, the user's call): the seven regular enemies
	# redrawn for the map, built and as strong as the ones they stand in for (Game.spawn_enemy
	# swaps them in, so waves, rings and summons all use them), and its own versions of the three
	# bosses every map shared (BOSS_SWAPS, slot for slot like the rest).
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
	"sale_618": {"name": "618 大促", "art": "sale_618", "size": 54.0, "color": Color("ff5d5d"),
		"hp": 630.0, "speed": 24.0, "damage": 11.0, "xp": 30, "radius": 13.0, "knockback_resist": 1.0, "elite": true,
		"ability": "quake", "arrival": "精英怪：618 大促！"},
	"zhongtai": {"name": "大中台", "art": "zhongtai", "size": 60.0, "color": Color("a9b3c4"),
		"hp": 2200.0, "speed": 22.0, "damage": 26.0, "xp": 80, "radius": 15.0, "knockback_resist": 1.0, "elite": true,
		"ability": "summon", "summon_type": "bug", "summon_count": 6,
		"splits_into": "zhongtai_small", "split_count": 3, "arrival": "首领出现：大中台"},
	"zhongtai_small": {"name": "小中台", "art": "zhongtai_small", "size": 30.0, "color": Color("a9b3c4"),
		"hp": 260.0, "speed": 34.0, "damage": 14.0, "xp": 8, "radius": 9.0, "knockback_resist": 0.6},
	"annual_party": {"name": "年会讲话", "art": "annual_party", "size": 58.0, "color": Color("ff5d5d"),
		"hp": 1900.0, "speed": 28.0, "damage": 24.0, "xp": 80, "radius": 15.0, "knockback_resist": 1.0, "elite": true,
		"ability": "lob", "arrival": "年会讲话！"},
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
	"us_east_1": {"name": "us-east-1 宕机", "art": "us_east_1", "size": 54.0, "color": Color("a9b3c4"),
		"hp": 630.0, "speed": 24.0, "damage": 11.0, "xp": 30, "radius": 13.0, "knockback_resist": 1.0, "elite": true,
		"ability": "quake", "arrival": "精英怪：us-east-1 宕机！"},
	"monolith": {"name": "巨石应用", "art": "monolith", "size": 60.0, "color": Color("8a909c"),
		"hp": 2200.0, "speed": 22.0, "damage": 26.0, "xp": 80, "radius": 15.0, "knockback_resist": 1.0, "elite": true,
		"ability": "summon", "summon_type": "bug", "summon_count": 6,
		"splits_into": "microservice", "split_count": 3, "arrival": "首领出现：巨石应用"},
	"microservice": {"name": "微服务", "art": "microservice", "size": 30.0, "color": Color("bcdcf2"),
		"hp": 260.0, "speed": 34.0, "damage": 14.0, "xp": 8, "radius": 9.0, "knockback_resist": 0.6},
	"all_hands": {"name": "全员大会", "art": "all_hands", "size": 58.0, "color": Color("f2c46b"),
		"hp": 1900.0, "speed": 28.0, "damage": 24.0, "xp": 80, "radius": 15.0, "knockback_resist": 1.0, "elite": true,
		"ability": "lob", "arrival": "全员大会！"},
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

## Scripted moments, sorted by time: a boss every minute (bosses rather than an ever bigger
## crowd are what the run escalates with), and rings of regular enemies in between. An event
## without `text` arrives silently alongside the one before it. From 7:00 each boss is a new
## one with its own move, rather than repeats of the earlier ones.
const EVENTS := [
	{"at": 60.0, "kind": "elite", "type": "techdebt_elite", "count": 1, "text": "精英怪：祖传技术债！"},
	{"at": 90.0, "kind": "ring", "type": "ping", "count": 16, "text": "消息轰炸！"},
	{"at": 120.0, "kind": "elite", "type": "server_elite", "count": 1, "text": "精英怪：主库宕机！"},
	{"at": 180.0, "kind": "elite", "type": "layoff", "count": 1, "text": "首领出现：裁员通知"},
	{"at": 210.0, "kind": "ring", "type": "bug", "count": 30, "text": "Bug 大爆发！"},
	{"at": 240.0, "kind": "elite", "type": "deadline", "count": 1, "text": "Deadline 逼近！"},
	{"at": 300.0, "kind": "elite", "type": "ai", "count": 1, "text": "首领出现：AI 大模型"},
	{"at": 360.0, "kind": "elite", "type": "investor", "count": 1, "text": "首领出现：投资人"},
	{"at": 390.0, "kind": "ring", "type": "ghost", "count": 30, "text": "404 幽灵合围！"},
	{"at": 420.0, "kind": "elite", "type": "spaghetti", "count": 1, "text": "首领出现：屎山代码"},
	{"at": 450.0, "kind": "elite", "type": "scope_change", "count": 1, "text": "需求变更！"},
	{"at": 480.0, "kind": "elite", "type": "incident", "count": 1, "text": "P0 线上事故！"},
	{"at": 510.0, "kind": "ring", "type": "ping", "count": 48, "text": "消息轰炸 ×2！"},
	{"at": 540.0, "kind": "elite", "type": "pie_boss", "count": 1, "text": "最后的考验：老板画饼 + AI 大模型"},
	# The AI again, with 15% less health: alongside the pie boss, its clones make the finale hard
	# enough already.
	{"at": 540.0, "kind": "elite", "type": "ai", "count": 1, "hp_scale": 0.85},
]

## Each run's schedule is EVENTS shaken up (.21, so bosses can't be learned by heart): the bosses
## of a tier swap slots, and one in another's slot comes as strong as the one written there (its
## health, damage and stars), so the run still gets harder just as steadily; arrivals shift by up
## to ARRIVAL_JITTER either way; and each boss draws extra moves and affixes (Enemy.AFFIXES) by
## its tier's ROLLS. The finale (FINALE_AT) keeps its time and its two bosses; the boss of pies
## draws like the last tier, the AI beside it nothing.
const BOSS_TIERS := [[60.0, 120.0, 180.0], [240.0, 300.0, 360.0], [420.0, 450.0, 480.0]]
const FINALE_AT := 540.0
const ARRIVAL_JITTER := 10.0
## Per tier, then for the finale's boss of pies: the moves extras are drawn from, the chances of a
## first and a second extra move, and of a first and a second affix. The first boss of all
## (BOSS_TIERS[0][0]) draws nothing: it's the first one a new player meets.
const ROLLS := [
	{"moves": ["charge", "quake", "summon"], "extra": [0.5, 0.0], "affix": [0.5, 0.0]},
	{"moves": ["charge", "quake", "summon", "blink", "lob"], "extra": [1.0, 0.0], "affix": [1.0, 0.0]},
	{"moves": ["charge", "quake", "summon", "blink", "lob", "volley"], "extra": [1.0, 0.5], "affix": [1.0, 0.5]},
	{"moves": ["charge", "quake", "summon", "blink", "volley"], "extra": [1.0, 0.0], "affix": [1.0, 0.0]},
]

## False keeps the schedule as written, unshaken (the smoke test, to compare with builds before .21).
static var shake_bosses := true

var max_alive := MAX_ALIVE

var _game: Game
var _spawn_budget := 0.0
var _next_event := 0
## Events whose time has come but that haven't gone out yet (a boss held by MAX_BOSSES_OUT).
var _due_events: Array[Dictionary] = []
## This run's schedule: EVENTS shaken up, in time order.
var _events: Array[Dictionary] = []


func _init(game: Game) -> void:
	_game = game
	if OS.has_feature("mobile") or OS.has_feature("web_android") or OS.has_feature("web_ios"):
		max_alive = MAX_ALIVE_MOBILE
	_events = _plan_events()


## Spawns per second: about 0.5 at the start (eased in, see EASE_IN_SECONDS), about 6.3 by the
## ten-minute mark. Kept lower than the crowd the game first had (9 a second by the end), since
## the bosses now carry more of the pressure.
func spawn_rate() -> float:
	var ease_in := lerpf(EASE_IN_START, 1.0, minf(_game.elapsed / EASE_IN_SECONDS, 1.0))
	return (0.8 + _game.elapsed / 60.0 * 0.55) * ease_in * Maps.current.DIFFICULTY["spawn"]


## Enemy HP multiplier so late enemies keep up with upgraded weapons: 3x by the ten-minute mark,
## times the map's (Maps: longer working weeks are harder).
func hp_scale() -> float:
	return (1.0 + _game.elapsed / 60.0 * 0.2) * Maps.current.DIFFICULTY["hp"]


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
## bosses would have come and gone). Returns how many bosses that skipped, for their chests.
func skip_to(seconds: float) -> int:
	var bosses := 0
	while _next_event < _events.size() and _events[_next_event]["at"] < seconds:
		if _events[_next_event]["kind"] == "elite":
			bosses += 1
		_next_event += 1
	return bosses


## 测试模式: the next planned boss, now; or, with `guest`, the map's guest boss (the planned one if
## it is still to come, else a fresh one).
func bring_boss(guest: bool = false) -> void:
	for index in range(_next_event, _events.size()):
		var event: Dictionary = _events[index]
		if event["kind"] == "elite" and event.get("guest", false) == guest:
			_events.remove_at(index)
			_run_event(event)
			return
	if guest:
		var type_id: String = Maps.current.GUEST_BOSS["type"]
		_run_event({"kind": "elite", "type": type_id, "count": 1, "text": ENEMY_TYPES[type_id]["arrival"]})


## Seconds until the next boss is due, or -1 when none is left. A boss already due but held
## back by MAX_BOSSES_OUT doesn't count: there is no time to show for it.
func seconds_to_next_boss() -> float:
	for index in range(_next_event, _events.size()):
		if _events[index]["kind"] == "elite":
			return _events[index]["at"] - _game.elapsed
	return -1.0


## The run's bosses as planned, for the run's data: seconds, type, "+" each extra move, "!" each
## affix, e.g. 62:layoff+quake!996!blame.
func boss_rolls() -> String:
	var parts := PackedStringArray()
	for event in _events:
		if event["kind"] != "elite":
			continue
		var roll := "%d:%s" % [roundi(event["at"]), event["type"]]
		for move: String in event.get("moves", []):
			roll += "+" + move
		for affix: String in event.get("affixes", []):
			roll += "!" + affix
		parts.append(roll)
	return ",".join(parts)


func _plan_events() -> Array[Dictionary]:
	var events: Array[Dictionary] = []
	for event: Dictionary in EVENTS:
		events.append(event.duplicate(true))
	_localize(events)
	_add_map_own(events)
	if not shake_bosses:
		return events
	var rng := _game.rng
	# Each type's arrival line goes with it to its new slot.
	var lines := {}
	for event in events:
		if event["kind"] == "elite" and event.has("text") and event["at"] != FINALE_AT:
			lines[event["type"]] = event["text"]
	for tier in BOSS_TIERS.size():
		var slots: Array[Dictionary] = []
		for event in events:
			if event["kind"] == "elite" and (BOSS_TIERS[tier] as Array).has(event["at"]):
				slots.append(event)
		var types: Array = slots.map(func(slot: Dictionary) -> String: return slot["type"])
		# Fisher-Yates with the run's own generator.
		for i in range(types.size() - 1, 0, -1):
			var j := rng.randi_range(0, i)
			var held: String = types[i]
			types[i] = types[j]
			types[j] = held
		for i in slots.size():
			var slot := slots[i]
			var first_of_all: bool = slot["at"] == BOSS_TIERS[0][0]
			# A local boss is already as strong as the slot's own (_localize).
			slot["strength"] = slot.get("strength", slot["type"])
			slot["type"] = types[i]
			slot["text"] = lines[types[i]]
			slot["at"] += rng.randf_range(-ARRIVAL_JITTER, ARRIVAL_JITTER)
			if not first_of_all:
				_draw_rolls(slot, ROLLS[tier])
	for event in events:
		if event["kind"] == "elite" and event["at"] == FINALE_AT and event.has("text"):
			_draw_rolls(event, ROLLS[-1])
	events.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return a["at"] < b["at"])
	return events


## The map's guest boss and its event (the map's GUEST_BOSS, MAP_EVENT), off the tiers that get
## shuffled; the guest draws its extras like the middle tier's bosses (_plan_events).
func _add_map_own(events: Array[Dictionary]) -> void:
	var guest: Dictionary = Maps.current.GUEST_BOSS
	var type_id: String = guest["type"]
	var boss := {"at": guest["at"], "kind": "elite", "type": type_id, "count": 1, "text": ENEMY_TYPES[type_id]["arrival"], "guest": true}
	if shake_bosses:
		_draw_rolls(boss, ROLLS[1])
	events.append(boss)
	var map_event: Dictionary = Maps.current.MAP_EVENT
	events.append({"at": map_event["at"], "kind": "map_event", "id": map_event["id"], "seconds": map_event["seconds"],
		"count": 0, "text": map_event["text"]})
	events.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return a["at"] < b["at"])


## The map's own bosses and rings in place of Silicon Valley's (the map's BOSS_SWAPS, RING_SWAPS,
## FINALE_LINE): a local boss takes the slot, the strength of the boss it replaces and its own
## arrival line.
func _localize(events: Array[Dictionary]) -> void:
	var swaps: Dictionary = Maps.current.BOSS_SWAPS
	var rings: Dictionary = Maps.current.RING_SWAPS
	var finale_line: String = Maps.current.FINALE_LINE
	for event in events:
		if event["kind"] == "elite" and swaps.has(event["type"]):
			event["strength"] = event["type"]
			event["type"] = swaps[event["type"]]
			if event.has("text") and event["at"] != FINALE_AT:
				event["text"] = ENEMY_TYPES[event["type"]].get("arrival", event["text"])
		elif event["kind"] == "ring" and rings.has(event["type"]):
			# The 8:30 one repeats the 1:30 one twice over, and keeps saying so.
			var twice: bool = event.get("text", "").contains("×2")
			event["text"] = rings[event["type"]]["text"].trim_suffix("！") + " ×2！" if twice else rings[event["type"]]["text"]
			event["type"] = rings[event["type"]]["type"]
		if event["kind"] == "elite" and event["at"] == FINALE_AT and event.has("text") and finale_line != "":
			event["text"] = finale_line


## A boss's extra moves (none it already has) and affixes, by the chances in `roll`.
func _draw_rolls(event: Dictionary, roll: Dictionary) -> void:
	var rng := _game.rng
	var moves: Array = (roll["moves"] as Array).duplicate()
	moves.erase(ENEMY_TYPES[event["type"]].get("ability", ""))
	var extras: Array[String] = []
	for chance: float in roll["extra"]:
		if not moves.is_empty() and rng.randf() < chance:
			extras.append(moves.pop_at(rng.randi() % moves.size()))
	var affix_pool: Array = Enemy.AFFIXES.keys()
	var affixes: Array[String] = []
	for chance: float in roll["affix"]:
		if rng.randf() < chance:
			affixes.append(affix_pool.pop_at(rng.randi() % affix_pool.size()))
	event["moves"] = extras
	event["affixes"] = affixes


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
			var boss := _game.spawn_enemy(event["type"], _game.offscreen_point(_game.random_direction()))
			if event.has("strength"):
				boss.take_strength(ENEMY_TYPES[event["strength"]], hp_scale())
			boss.scale_hp(event.get("hp_scale", 1.0))
			boss.add_moves(event.get("moves", []))
			boss.add_affixes(event.get("affixes", []))
			_game.achievements.on_affixes(event.get("affixes", []))
	if event.has("text"):
		Sound.play("alarm")
		var line := tr(event["text"])
		var affixes: Array = event.get("affixes", [])
		if not affixes.is_empty():
			# The affixes said with the arrival: 首领出现：裁员通知（996 · 甩锅）.
			line += "（%s）" % " · ".join(affixes.map(func(affix: String) -> String: return tr(Enemy.AFFIXES[affix])))
		_game.announce(line)
