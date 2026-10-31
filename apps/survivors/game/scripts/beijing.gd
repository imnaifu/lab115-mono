class_name Beijing
extends RefCounted
## The Beijing stage (北京西二旗) as data, under the same names as BayArea so City, Traffic, the
## minimap and the rest draw and move through it the same way (Maps.current is one or the other).
## Nothing here draws.
##
## Haidian's tech belt, squeezed onto the grid: the run starts at 西二旗 among the campuses of
## 后厂村 (白度, 大米, 嘀嘀, 网异); north are 回龙观's tower blocks; south past the fifth ring road
## the universities and 五道口 / 中关村; south-west the Summer Palace on the shore of 昆明湖, with
## the Western Hills beyond; south-east the Olympic park and the Bird's Nest. Line 13 runs north
## and south past 西二旗 station, the G7 and G6 expressways either side. There is no sea: the city
## goes on every way, and the only water is the lake.

const NAME := "北京"
## 996: the longest week of the maps, so the hardest (BayArea.HOURS says how this works).
const HOURS := "996"
const DIFFICULTY := {"hp": 1.3, "damage": 1.2, "spawn": 1.15}
## Job grades Alibaba-style, P1, P2…
const RANK_PREFIX := "P"
## Local bosses in place of Silicon Valley's, slot for slot (each as strong as the one it
## replaces; Spawner._plan_events): 周报, 35 岁危机, 福报 996, 卷王, 百模大战, 领导视察, 述职 PPT,
## and from .36 the three every map used to share too: 618 大促, 大中台 (falling apart into 小中台),
## 年会讲话.
const BOSS_SWAPS := {
	"techdebt_elite": "weekly_report", "layoff": "midlife", "deadline": "fubao", "investor": "juanwang",
	"ai": "baimo", "scope_change": "inspection", "incident": "ppt",
	"server_elite": "sale_618", "spaghetti": "zhongtai", "pie_boss": "annual_party",
}
## The regular enemies, redrawn for Beijing (.36; Game.spawn_enemy swaps them in): 盯盯消息, 小需求,
## 日报, 拉个群, 已读不回, KPI, 流量洪峰, each as strong as the one it replaces.
const MOB_SWAPS := {
	"ping": "dingding", "bug": "small_req", "mail": "daily_report", "meeting": "group_chat",
	"ghost": "read_no_reply", "techdebt": "kpi", "server": "traffic_flood",
}
## The Bug outbreak is 西二旗's rush hour here.
const RING_SWAPS := {"bug": {"type": "commuter", "text": "西二旗早高峰！"},
	"ping": {"type": "dingding", "text": "盯盯轰炸！"}, "ghost": {"type": "read_no_reply", "text": "已读不回合围！"}}
const FINALE_LINE := "最后的考验：年会讲话 + 百模大战"
## The map's own guest boss and event (BayArea.GUEST_BOSS says how): 末位淘汰 (a ring closing on
## you) and 沙尘暴 (a wind blowing everyone east).
const GUEST_BOSS := {"type": "elimination", "at": 330.0}
const MAP_EVENT := {"id": "sandstorm", "at": 300.0, "seconds": 20.0, "text": "沙尘暴来了！风往东刮，站稳了",
	"name": "沙尘暴", "hint": "风往东刮，逆风走慢"}
## The district whose office blocks line a company campus wherever it stands (City._place_row).
const CAMPUS_DISTRICT := "houchang"
## The named part of the world for the minimap, in world pixels. Pulled in to about half in .34
## (it was 8400 x 6400), at the user's ask after Vampire Survivors: every landmark is within about
## 30 seconds' walk of the start.
const OVERVIEW := Rect2(-2800.0, -2000.0, 5600.0, 4400.0)
## Spelled out rather than City.BLOCK, to keep the classes' constants acyclic (as in BayArea).
const BLOCK_SIZE := Vector2(560.0, 400.0)
## Block rows at or above / below these are 回龙观 / the universities; columns at or before
## WEST_HILLS_COLUMN are the Western Hills.
const HUILONGGUAN_ROW := -2
const HAIDIAN_ROW := 2
const WEST_HILLS_COLUMN := -4
## 昆明湖: the blocks it fills (their district is the lake) and the water itself, a margin short of
## the roads round it, so a lakeside road runs all the way round.
const LAKE_BLOCKS: Array[Vector2i] = [Vector2i(-3, 3), Vector2i(-2, 3), Vector2i(-3, 4), Vector2i(-2, 4)]
const LAKES: Array[Rect2] = [Rect2(-1620.0, 1270.0, 1000.0, 660.0)]
## The expressways and Line 13 by block column, from far north on; `north` / `south` are where the
## green signs point.
const FREEWAYS := {
	-2: {"number": "G7", "shield": "shield_cn", "from_row": -12, "north": "张家口", "south": "北五环"},
	3: {"number": "G6", "shield": "shield_cn", "from_row": -12, "north": "延庆", "south": "德胜门"},
}
const RAILWAY_COLUMN := 1
const RAILWAY_FROM_ROW := -12
## The railway runs on south for ever (Singapore's ends on Sentosa).
const RAILWAY_TO_ROW := 1000
## No salt ponds and no airport here.
const SALT_POND_FROM_ROW := 1000
const RUNWAYS: Array[Vector2i] = []
## What drives the freeways and the railway (Traffic, .37): cars, and Line 13.
const VEHICLES := ["car_top"]
const TRAIN := "train_top"

## Per district, as in BayArea.DISTRICTS.
const DISTRICTS := {
	"houchang": {
		"name": "后厂村", "icon": "icon_paw",
		"ground": Color("e2edcc"),
		"structures": ["soco:office", "soco:midrise_bands", "soco:midrise_grid", "soco:office_block", "soco:commercial"],
		"gap": [36.0, 70.0], "brands": ["baidu", "xiaomi", "netease", "didi", "kuaishou"],
		"brand_chance": 0.85, "tree": "poplar", "props": ["shared_bike", "shared_bike", "delivery_ebike", "robotaxi"],
		"bushes": [2, 4], "lawn_trees": [0, 2], "park_chance": 0.15,
		"decor": [["flower", 11.0], ["tuft", 12.0], ["tuft", 12.0]],
	},
	"huilongguan": {
		"name": "回龙观", "icon": "tower_block",
		"ground": Color("e6e6d6"),
		"structures": ["art:tower_block", "soco:midrise_grid", "art:tower_block", "soco:midrise_bands",
			"soco:convenience_store", "soco:supermarket"],
		"gap": [36.0, 56.0], "brands": [], "brand_chance": 0.0, "tree": "poplar",
		"props": ["shared_bike", "jianbing_cart", "delivery_ebike"], "bushes": [1, 3], "lawn_trees": [0, 1], "park_chance": 0.1,
		"decor": [["tuft", 12.0], ["flower", 11.0]],
	},
	"haidian": {
		"name": "海淀", "icon": "tsinghua_gate",
		"ground": Color("e3ecd0"),
		"structures": ["soco:small_1", "soco:small_2", "soco:small_3", "soco:shop_1", "soco:shop_2",
			"soco:commercial", "soco:convenience_store"],
		"gap": [36.0, 64.0], "brands": ["bytedance", "jd"], "brand_chance": 0.3, "tree": "poplar",
		"props": ["shared_bike", "jianbing_cart", "delivery_ebike", "bike"], "bushes": [2, 4], "lawn_trees": [1, 2], "park_chance": 0.2,
		"decor": [["flower", 11.0], ["tuft", 12.0], ["flower_pink", 11.0]],
	},
	"yiheyuan": {
		"name": "颐和园", "icon": "summer_palace",
		"ground": Color("d8ecc0"),
		"structures": ["soco:small_1", "soco:small_3"],
		"gap": [90.0, 160.0], "brands": [], "brand_chance": 0.0, "tree": "poplar",
		"props": [], "bushes": [2, 4], "lawn_trees": [2, 4], "park_chance": 0.7,
		"decor": [["flower", 11.0], ["flower_pink", 11.0], ["tuft", 12.0]],
	},
	"xishan": {
		"name": "西山", "icon": "redwood",
		"ground": Color("f0dc9a"),
		"structures": ["soco:small_1", "soco:small_4"],
		"gap": [120.0, 220.0], "brands": [], "brand_chance": 0.0, "tree": "redwood",
		"props": [], "bushes": [1, 2], "lawn_trees": [3, 6], "park_chance": 0.4,
		"decor": [["poppy", 11.0], ["tuft", 12.0]],
	},
	"aoyun": {
		"name": "奥林匹克公园", "icon": "birds_nest",
		"ground": Color("d6eec0"),
		"structures": [], "gap": [0.0, 0.0], "brands": [], "brand_chance": 0.0, "tree": "poplar",
		"props": [], "bushes": [2, 4], "lawn_trees": [1, 3], "park_chance": 1.0,
		"decor": [["flower", 11.0], ["tuft", 12.0]],
	},
	"lake": {
		"name": "昆明湖", "icon": "koi",
		"ground": Color("e9e4c6"),
		"structures": [], "gap": [0.0, 0.0], "brands": [], "brand_chance": 0.0, "tree": "",
		"props": [], "bushes": [0, 0], "lawn_trees": [0, 0], "park_chance": 1.0,
		"decor": [["tuft", 12.0]],
	},
}

## One-off landmarks by block, as in BayArea.LANDMARKS.
const LANDMARKS := {
	# Where a run starts: a campus round the first screen, not a park that happened to roll.
	Vector2i(0, 0): "brand_row:kuaishou",
	Vector2i(1, 0): "art:subway_13",
	Vector2i(-1, 0): "brand_row:baidu",
	Vector2i(2, -1): "brand_row:xiaomi",
	Vector2i(-2, -1): "brand_row:didi",
	Vector2i(-1, -1): "brand_row:netease",
	Vector2i(0, -3): "art:tower_block",
	Vector2i(1, 2): "brand_row:wudaokou",
	Vector2i(0, 3): "art:tsinghua_gate",
	Vector2i(-1, 3): "art:boya_pagoda",
	Vector2i(0, 4): "brand_row:zgc",
	Vector2i(1, 4): "brand_row:bytedance",
	# On the lake's north shore, looking out over 昆明湖, as 佛香阁 does from 万寿山.
	Vector2i(-3, 2): "art:summer_palace",
	Vector2i(2, 3): "art:birds_nest",
}
const LAWN_LANDMARKS := {}
## Signs that belong to a landmark drawing.
const LANDMARK_BRANDS := {"subway_13": "station", "tsinghua_gate": "tsinghua"}
const SOLID_SPANS := {}

## Landmarks to check in at (打卡), as in BayArea.STAMPS; ids start bj_ so they never clash with
## another map's in the save.
const STAMPS := {
	"bj_xierqi": {"art": "subway_13", "block": Vector2i(1, 0), "name": "西二旗地铁站", "note": "早高峰进站要排半小时", "bonus": ["speed", 0.02]},
	"bj_baidu": {"art": "icon_paw", "block": Vector2i(-1, 0), "name": "白度科技园", "note": "门口的熊掌老远就看得见", "bonus": ["might", 0.02]},
	"bj_netease": {"art": "mail", "block": Vector2i(-1, -1), "name": "网异大厦", "note": "猪厂，食堂出了名的好吃", "bonus": ["max_hp", 5.0]},
	"bj_xiaomi": {"art": "icon_rice", "block": Vector2i(2, -1), "name": "大米科技园", "note": "为加班而生", "bonus": ["magnet", 0.05]},
	"bj_didi": {"art": "robotaxi", "block": Vector2i(-2, -1), "name": "嘀嘀总部", "note": "下班叫车排第 200 位", "bonus": ["luck", 10.0]},
	"bj_huilongguan": {"art": "tower_block", "block": Vector2i(0, -3), "name": "回龙观", "note": "睡城：通勤两小时，睡觉六小时", "bonus": ["regen", 0.05]},
	"bj_wudaokou": {"art": "boba", "block": Vector2i(1, 2), "name": "五道口", "note": "宇宙中心，奶茶店比人多", "bonus": ["haste", 0.02]},
	"bj_tsinghua": {"art": "tsinghua_gate", "block": Vector2i(0, 3), "name": "清华园", "note": "二校门前的游客比学生多", "bonus": ["might", 0.02]},
	"bj_peking": {"art": "boya_pagoda", "block": Vector2i(-1, 3), "name": "博雅塔", "note": "北大未名湖边的塔", "bonus": ["haste", 0.02]},
	"bj_zhongguancun": {"art": "monitors", "block": Vector2i(0, 4), "name": "中关村", "note": "攒电脑、找投资，都来这儿", "bonus": ["magnet", 0.05]},
	"bj_bytedance": {"art": "icon_note", "block": Vector2i(1, 4), "name": "字节跳跳", "note": "大力出奇迹", "bonus": ["max_hp", 5.0]},
	"bj_yiheyuan": {"art": "summer_palace", "block": Vector2i(-3, 2), "name": "颐和园", "note": "佛香阁下就是昆明湖", "bonus": ["luck", 10.0]},
	"bj_birds_nest": {"art": "birds_nest", "block": Vector2i(2, 3), "name": "鸟巢", "note": "一路往东南，去看鸟巢", "bonus": ["might", 0.03]},
}

## Parody companies, as in BayArea.BRANDS, each with an icon of its own (.39: 嘀嘀 a taxi, 网异 a
## netted globe, 慢手 a snail, 京西 a shopping cart; they were names alone); the places are names.
const BRANDS := {
	"baidu": {"text": "白度", "icon": "icon_paw", "color": Color("2f5fe0")},
	"xiaomi": {"text": "大米", "icon": "icon_rice", "color": Color("ff6a00")},
	"didi": {"text": "嘀嘀", "icon": "icon_taxi", "color": Color("f08a4b")},
	"netease": {"text": "网异", "icon": "icon_web", "color": Color("d63a2f")},
	"kuaishou": {"text": "慢手", "icon": "icon_snail", "color": Color("ff5000")},
	"bytedance": {"text": "字节跳跳", "icon": "icon_note", "color": Color("1f2a44")},
	"jd": {"text": "京西", "icon": "icon_cart", "color": Color("e1251b")},
	"wudaokou": {"text": "宇宙中心", "color": Color("8c7cf0")},
	"zgc": {"text": "中关村", "color": Color("2f6fb5")},
	"station": {"text": "西二旗", "color": Color("2f3542")},
	"tsinghua": {"text": "清华园", "color": Color("7a3ea0")},
}

## Real road names, roughly where they run, as in BayArea; anything off the table is a 规划路
## (the planned roads Beijing's maps still number).
const NORTH_SOUTH := {
	-5: "香山路", -4: "西山路", -3: "颐和园路", -2: "京新高速", -1: "软件园路",
	0: "开拓路", 1: "上地东路", 2: "安宁庄路", 3: "京藏高速", 4: "学院路", 5: "北辰西路", 6: "北辰东路",
}
const EAST_WEST := {
	-6: "回龙观东大街", -5: "龙域北街", -4: "育知路", -3: "北清路", -2: "西北旺东路", -1: "后厂村路",
	0: "西二旗大街", 1: "上地十街", 2: "北五环", 3: "清华西路", 4: "成府路", 5: "北四环", 6: "知春路",
	7: "北三环",
}

## Height in logical pixels of each drawing used here, as in BayArea.HEIGHTS.
const HEIGHTS := {
	"subway_13": 46.0, "tower_block": 170.0, "tsinghua_gate": 70.0, "boya_pagoda": 150.0,
	"summer_palace": 140.0, "birds_nest": 96.0,
	"poplar": 66.0, "redwood": 92.0, "bush": 23.0,
	"bike": 22.0, "cone": 14.0, "robotaxi": 24.0, "shared_bike": 22.0, "jianbing_cart": 30.0, "delivery_ebike": 26.0,
}


static func district_of(block: Vector2i) -> String:
	if LAKE_BLOCKS.has(block):
		return "lake"
	if block.x <= WEST_HILLS_COLUMN:
		return "xishan"
	if block.x <= -2 and block.y >= HAIDIAN_ROW:
		return "yiheyuan"
	if block.x >= 2 and block.y >= HAIDIAN_ROW + 1:
		return "aoyun"
	if block.y <= HUILONGGUAN_ROW:
		return "huilongguan"
	if block.y >= HAIDIAN_ROW:
		return "haidian"
	return "houchang"


static func north_south_name(column: int, _row: int = 0) -> String:
	return NORTH_SOUTH.get(column, "规划%d路" % (absi(column) * 10 + 1))


static func east_west_name(row: int) -> String:
	return EAST_WEST.get(row, "规划%d路" % (absi(row) * 10 + 2))


## No shore anywhere: the city goes on every way (City asks, for the salt ponds and the beach).
static func east_shore_column(_row: int) -> Variant:
	return null


static func east_water_x(_row: int) -> float:
	return INF


static func is_water(point: Vector2) -> bool:
	for lake in LAKES:
		if lake.has_point(point):
			return true
	return false


## The water inside `area` as rects: the part of each lake that falls in it.
static func water_rects(area: Rect2) -> Array[Rect2]:
	var rects: Array[Rect2] = []
	for lake in LAKES:
		var part := lake.intersection(area)
		if part.has_area():
			rects.append(part)
	return rects


static func freeway_at(column: int, row: int) -> Dictionary:
	var freeway: Dictionary = FREEWAYS.get(column, {})
	if freeway.is_empty() or row < freeway["from_row"]:
		return {}
	return freeway


static func has_railway(row: int) -> bool:
	return row >= RAILWAY_FROM_ROW
