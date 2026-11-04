class_name Beijing
extends RefCounted
## The Beijing stage (北京西二旗) as data, under the same names as BayArea so City, Traffic, the
## the HUD and the rest draw and move through it the same way (Maps.current is one or the other).
## Nothing here draws.
##
## Haidian's tech belt, squeezed onto the grid: the run starts at 西二旗 among the campuses of
## 后厂村 (白度, 大米, 嘀嘀, 网异); north are 回龙观's tower blocks; south past the fifth ring road
## the universities and 五道口 / 中关村; south-west the Summer Palace on the shore of 昆明湖, with
## the Western Hills beyond; south-east the Olympic park and the Bird's Nest. Line 13 runs north
## and south past 西二旗 station, the G7 and G6 expressways either side. There is no sea: the city
## goes on every way, and the only water is the lake.
##
## Open ground since .77, as 硅谷 since .52 (the user: 其余地图参考硅谷，改的空旷点): a square of land
## round the start (BOUNDS) with no lake, the districts still where they were, and the only
## buildings the five check-in spots (the user: 打卡点设计，只放总部在这个城市的，其余的还是用城市标志):
## 白度's headquarters in the middle, and 颐和园, 清华园, 鸟巢 and 中关村 on the corners. (Until .76:
## 昆明湖 and rows of buildings on every street.)

const NAME := "北京"
## The hardest of the maps (BayArea.STARS says how this works).
const STARS := 3
const DIFFICULTY := {"hp": 1.3, "damage": 1.2, "spawn": 1.15}
## Job grades Alibaba-style, P1, P2…
const RANK_PREFIX := "P"
## Its four bosses, at 2:00, 4:00, 6:00 and 8:00 (.45, BossKits): 卷王（远程）、述职 PPT（定点）、末位淘汰（近战）、年会讲话（近战 + 定点）.
const BOSSES := ["juanwang", "ppt", "elimination", "annual_party"]
## The regular enemies, redrawn for Beijing (.36; Game.spawn_enemy swaps them in): 盯盯消息, 小需求,
## 日报, 拉个群, 已读不回, KPI, 流量洪峰, each as strong as the one it replaces.
## The crowd and its rings are Silicon Valley's on every map (.41, the user's call: only the
## bosses are the map's own; .36-.40 swapped the seven regular enemies and the rings for local
## ones, whose types stay in Spawner.ENEMY_TYPES unused).
const MOB_SWAPS := {}
## The Bug outbreak is 西二旗's rush hour here.
const RING_SWAPS := {}
## The map's weather (MapEvents): 沙尘暴 (a wind blowing everyone east).
const MAP_EVENT := {"id": "sandstorm", "at": 300.0, "seconds": 20.0, "text": "沙尘暴来了！风往东刮，站稳了",
	"name": "沙尘暴", "hint": "风往东刮，逆风走慢"}
## The district whose office blocks line a company campus wherever it stands (City._place_row).
const CAMPUS_DISTRICT := "houchang"
## The map (.77), as BayArea.BOUNDS: a square 1800 out every way from the start (2300 .77–.85). Outside it counts
## as water (is_water, water_rects), so everything stays inside, and City draws it as the edge.
## (The named part of the world was 5600 x 4400 until .76, pulled in from 8400 x 6400 in .34.)
const BOUNDS := Rect2(-1520.0, -1620.0, 3600.0, 3600.0)
## Only the check-in spots stand, and trees don't block (City).
const OPEN_GROUND := true
## The named part of the world (the minimap showed it until .44): the map itself since .77.
const OVERVIEW := BOUNDS
## Spelled out rather than City.BLOCK, to keep the classes' constants acyclic (as in BayArea).
const BLOCK_SIZE := Vector2(560.0, 400.0)
## Block rows at or above / below these are 回龙观 / the universities; columns at or before
## WEST_HILLS_COLUMN are the Western Hills.
const HUILONGGUAN_ROW := -2
const HAIDIAN_ROW := 2
const WEST_HILLS_COLUMN := -3
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

## Per district, as in BayArea.DISTRICTS. Since .77 (open ground) at most a bush and a tree a
## block; the lake's blocks are 颐和园's.
const DISTRICTS := {
	"houchang": {
		"name": "后厂村", "icon": "icon_paw",
		"ground": Color("e2edcc"),
		"structures": ["soco:office", "soco:midrise_bands", "soco:midrise_grid", "soco:office_block", "soco:commercial"],
		"gap": [36.0, 70.0], "brands": ["baidu", "xiaomi", "netease", "didi", "kuaishou"],
		"brand_chance": 0.85, "tree": "poplar", "props": ["shared_bike", "shared_bike", "delivery_ebike", "robotaxi"],
		"bushes": [0, 1], "lawn_trees": [0, 1], "park_chance": 0.15,
		"decor": [["flower", 11.0], ["tuft", 12.0], ["tuft", 12.0]],
	},
	"huilongguan": {
		"name": "回龙观", "icon": "tower_block",
		"ground": Color("e6e6d6"),
		"structures": ["art:tower_block", "soco:midrise_grid", "art:tower_block", "soco:midrise_bands",
			"soco:convenience_store", "soco:supermarket"],
		"gap": [36.0, 56.0], "brands": [], "brand_chance": 0.0, "tree": "poplar",
		"props": ["shared_bike", "jianbing_cart", "delivery_ebike"], "bushes": [0, 1], "lawn_trees": [0, 1], "park_chance": 0.1,
		"decor": [["tuft", 12.0], ["flower", 11.0]],
	},
	"haidian": {
		"name": "海淀", "icon": "tsinghua_gate",
		"ground": Color("e3ecd0"),
		"structures": ["soco:small_1", "soco:small_2", "soco:small_3", "soco:shop_1", "soco:shop_2",
			"soco:commercial", "soco:convenience_store"],
		"gap": [36.0, 64.0], "brands": ["bytedance", "jd"], "brand_chance": 0.3, "tree": "poplar",
		"props": ["shared_bike", "jianbing_cart", "delivery_ebike", "bike"], "bushes": [0, 1], "lawn_trees": [0, 1], "park_chance": 0.2,
		"decor": [["flower", 11.0], ["tuft", 12.0], ["flower_pink", 11.0]],
	},
	"yiheyuan": {
		"name": "颐和园", "icon": "summer_palace",
		"ground": Color("d8ecc0"),
		"structures": ["soco:small_1", "soco:small_3"],
		"gap": [90.0, 160.0], "brands": [], "brand_chance": 0.0, "tree": "poplar",
		"props": [], "bushes": [0, 1], "lawn_trees": [0, 1], "park_chance": 0.7,
		"decor": [["flower", 11.0], ["flower_pink", 11.0], ["tuft", 12.0]],
	},
	"xishan": {
		"name": "西山", "icon": "redwood",
		"ground": Color("f0dc9a"),
		"structures": ["soco:small_1", "soco:small_4"],
		"gap": [120.0, 220.0], "brands": [], "brand_chance": 0.0, "tree": "redwood",
		"props": [], "bushes": [0, 1], "lawn_trees": [0, 1], "park_chance": 0.4,
		"decor": [["poppy", 11.0], ["tuft", 12.0]],
	},
	"aoyun": {
		"name": "奥林匹克公园", "icon": "birds_nest",
		"ground": Color("d6eec0"),
		"structures": [], "gap": [0.0, 0.0], "brands": [], "brand_chance": 0.0, "tree": "poplar",
		"props": [], "bushes": [0, 1], "lawn_trees": [0, 1], "park_chance": 1.0,
		"decor": [["flower", 11.0], ["tuft", 12.0]],
	},

}

## One-off landmarks by block, as in BayArea.LANDMARKS: since .77 only the check-in spots, where
## BayArea has its (the middle one the block south of the start, the rest near the corners).
## 中关村 is one tower with its sign (City.HQ_STRUCTURE), as a headquarters is.
const LANDMARKS := {
	Vector2i(0, 1): "hq:baidu",
	Vector2i(-2, -3): "art:summer_palace",
	Vector2i(2, -3): "art:tsinghua_gate",
	Vector2i(2, 3): "art:birds_nest",
	Vector2i(-2, 3): "hq:zgc",
}
## 白度's paw on a plinth in front of its tower (tools/make_logo_statues.py).
const LAWN_LANDMARKS := {Vector2i(0, 1): "statue_paw"}
## Signs that belong to a landmark drawing.
const LANDMARK_BRANDS := {"tsinghua_gate": "tsinghua"}
const SOLID_SPANS := {}

## Landmarks to check in at (打卡), as in BayArea.STAMPS, in the order they open (the middle one,
## then the corners clockwise from the north-west); ids start bj_ so they never clash with
## another map's in the save. The ids are the save's, so they stay when a spot changes (.77:
## bj_xierqi is 白度's headquarters, 西二旗地铁站 until then).
const STAMPS := {
	"bj_xierqi": {"art": "icon_paw", "block": Vector2i(0, 1), "name": "白度总部", "note": "门口的熊掌老远就看得见", "bonus": ["luck", 10.0]},
	"bj_yiheyuan": {"art": "summer_palace", "block": Vector2i(-2, -3), "name": "颐和园", "note": "佛香阁立在万寿山上", "bonus": ["max_hp", 5.0]},
	"bj_tsinghua": {"art": "tsinghua_gate", "block": Vector2i(2, -3), "name": "清华园", "note": "二校门前的游客比学生多", "bonus": ["haste", 0.02]},
	"bj_birds_nest": {"art": "birds_nest", "block": Vector2i(2, 3), "name": "鸟巢", "note": "一路往东南，去看鸟巢", "bonus": ["might", 0.02]},
	"bj_zhongguancun": {"art": "monitors", "block": Vector2i(-2, 3), "name": "中关村", "note": "攒电脑、找投资，都来这儿", "bonus": ["magnet", 0.05]},
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
	"statue_paw": 76.0,
	"bike": 22.0, "cone": 14.0, "robotaxi": 24.0, "shared_bike": 22.0, "jianbing_cart": 30.0, "delivery_ebike": 26.0,
}


static func district_of(block: Vector2i) -> String:
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


## Off the map counts as water (.77, as BayArea): there is no water, only the edge.
static func is_water(point: Vector2) -> bool:
	return not BOUNDS.has_point(point)


## What of `area` lies off the map, as BayArea.water_rects.
static func water_rects(area: Rect2) -> Array[Rect2]:
	return BayArea.water_rects_outside(BOUNDS, area)


static func freeway_at(column: int, row: int) -> Dictionary:
	var freeway: Dictionary = FREEWAYS.get(column, {})
	if freeway.is_empty() or row < freeway["from_row"]:
		return {}
	return freeway


static func has_railway(row: int) -> bool:
	return row >= RAILWAY_FROM_ROW
