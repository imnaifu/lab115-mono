class_name Singapore
extends RefCounted
## The Singapore stage (新加坡, .38) as data, under the same names as BayArea and the rest so City,
## Traffic and the rest draw and move through it the same way. Nothing here draws.
##
## Squeezed onto the grid at the size every map has (every landmark within about 30 seconds'
## walk): the run starts at one-north among the e-commerce campuses, with the university to the
## west and the HDB heartlands round them; east are Chinatown, Lau Pa Sat and the CBD, with Clarke
## Quay and Little India up north and Marina Bay, a bay of water bridged twice, past the CBD, the
## Merlion on its west shore and Marina Bay Sands, the supertrees and (squeezed in) Jewel on its
## east. South is a strip of beach and then the sea; Sentosa is an island out in it, joined by one
## bridge that carries the road and the Sentosa line. Two expressways run north and south, with
## ride-hailing cars on them.
##
## Open ground since .77, as 硅谷 since .52 (the user: 其余地图参考硅谷，改的空旷点): a square of land
## round the start (BOUNDS) with no sea and no bay, the districts still where they were (the
## coast's blocks the ones north of them), and the only buildings the five check-in spots, big
## tech's campuses (the user: 每个地图的打卡点能不能更像大厂一点): Shopay in the middle, then TikTak,
## Grub, DBB and Lazado on the corners. (Until .76: the sea, Sentosa and Marina Bay, rows of
## buildings on every street, and the city's landmarks to check in at.)

const NAME := "新加坡"
## A little harder than 西雅图, the same two stars (BayArea.STARS); 班加罗尔 is still to come
## between it and 北京 (Maps.ROUTE).
const STARS := 2
const DIFFICULTY := {"hp": 1.19, "damage": 1.13, "spawn": 1.09}
## The American giants' Asia-Pacific offices' levels: L1, L2…
const RANK_PREFIX := "L"
## Its four bosses, at 2:00, 4:00, 6:00 and 8:00 (.45, BossKits): 表格（定点）、亚太区优化（远程）、空降老板（近战）、老板画咖椰吐司（定点 + 远程）.
const BOSSES := ["forms", "apac_cut", "parachute_boss", "kaya_boss"]
## The regular enemies, redrawn for Singapore (Game.spawn_enemy swaps them in): 蚊子, 壁虎, Grub
## 外卖单, 跨时区对齐会, 中元节饿鬼, COE 拥车证, 榴莲, each as strong as the one it replaces.
## The crowd and its rings are Silicon Valley's on every map (.41, the user's call: only the
## bosses are the map's own; .36-.40 swapped the seven regular enemies and the rings for local
## ones, whose types stay in Spawner.ENEMY_TYPES unused).
const MOB_SWAPS := {}
## The Bug outbreak is the hawker centre at lunch: every seat round you reserved with tissues.
const RING_SWAPS := {}
## The map's weather (MapEvents): 热浪 (out in the heat you lose health; cool air-conditioned spots appear round you).
const MAP_EVENT := {"id": "heat", "at": 300.0, "seconds": 20.0, "text": "热浪来了！外面待着会掉血，躲进冷气里",
	"name": "热浪", "hint": "躲进蓝色冷气圈，外面会掉血"}
## The district whose office blocks line a company campus wherever it stands (City._place_row).
const CAMPUS_DISTRICT := "onenorth"
## The map (.77), as BayArea.BOUNDS: a square 2300 out every way from the start. Outside it counts
## as water (is_water, water_rects), so everything stays inside, and City draws it as the edge.
const BOUNDS := Rect2(-2020.0, -2120.0, 4600.0, 4600.0)
## Only the check-in spots stand, and trees don't block (City).
const OPEN_GROUND := true
## The named part of the world (the minimap showed it until .44): the map itself since .77.
const OVERVIEW := BOUNDS
## Spelled out rather than City.BLOCK, to keep the classes' constants acyclic (as in BayArea).
const BLOCK_SIZE := Vector2(560.0, 400.0)
## Two expressways, by block column; `north` / `south` are where the green signs point.
const FREEWAYS := {
	1: {"number": "CTE", "shield": "shield_sg", "from_row": -12, "north": "Ang Mo Kio", "south": "Chinatown"},
	3: {"number": "KPE", "shield": "shield_sg", "from_row": -12, "north": "Punggol", "south": "Marina"},
}
## The MRT, beside one-north's road (over the bridge to Sentosa, where it ended, until .77).
const RAILWAY_COLUMN := 0
const RAILWAY_FROM_ROW := -12
const RAILWAY_TO_ROW := 1000
## What drives the expressways and the railway (Traffic): ride-hailing cars and taxis, and the MRT.
const VEHICLES := ["grub_top", "grub_top", "car_top"]
const TRAIN := "mrt_top"
## No salt ponds and no airport here.
const SALT_POND_FROM_ROW := 1000
const RUNWAYS: Array[Vector2i] = []

## Per district, as in BayArea.DISTRICTS. Since .77 (open ground) at most a bush and a tree a
## block; Marina Bay, the coast and Sentosa are gone. Rain trees; durian signs, orchids and hawker stalls on
## the pavements. `icon` is drawn by the district's name in the HUD.
const DISTRICTS := {
	"onenorth": {
		"name": "纬壹科技城", "icon": "one_north",
		"ground": Color("d7ecd0"),
		"structures": ["soco:office", "soco:midrise_bands", "soco:midrise_grid", "soco:office_block", "soco:commercial"],
		"gap": [36.0, 70.0], "brands": ["shopay", "grub", "tiktak", "razzer"],
		"brand_chance": 0.85, "tree": "rain_tree", "props": ["durian_sign", "orchid_pot", "bike"],
		"bushes": [0, 1], "lawn_trees": [0, 1], "park_chance": 0.15,
		"decor": [["tuft", 12.0], ["flower", 11.0], ["tuft", 12.0]],
	},
	"hdb": {
		"name": "组屋区", "icon": "hdb_block",
		"ground": Color("dfeccd"),
		"structures": ["art:hdb_block", "art:hdb_block", "soco:shop_1", "soco:convenience_store"],
		"gap": [40.0, 70.0], "brands": ["lazado"], "brand_chance": 0.3, "tree": "rain_tree",
		"props": ["hawker_stall", "bike", "durian_sign"], "bushes": [0, 1], "lawn_trees": [0, 1], "park_chance": 0.15,
		"decor": [["flower_pink", 11.0], ["tuft", 12.0]],
	},
	"heritage": {
		"name": "老城区", "icon": "chinatown",
		"ground": Color("ece4d2"),
		"structures": ["art:shophouse_teal", "art:shophouse_pink", "art:shophouse_teal", "art:shophouse_pink", "soco:shop_2"],
		"gap": [36.0, 44.0], "brands": [], "brand_chance": 0.0, "tree": "rain_tree",
		"props": ["hawker_stall", "orchid_pot"], "bushes": [0, 1], "lawn_trees": [0, 1], "park_chance": 0.1,
		"decor": [["flower_pink", 11.0], ["tuft", 12.0]],
	},
	"cbd": {
		"name": "中央商务区", "icon": "raffles_place",
		"ground": Color("e2e7dc"),
		"structures": ["soco:office_block", "soco:midrise_grid", "soco:midrise_bands", "soco:office", "soco:commercial"],
		"gap": [36.0, 60.0], "brands": ["dbb", "tiktak", "lazado", "shopay"], "brand_chance": 0.6,
		"tree": "rain_tree", "props": ["orchid_pot", "durian_sign", "hawker_stall"], "bushes": [0, 1], "lawn_trees": [0, 1],
		"park_chance": 0.1, "decor": [["tuft", 12.0], ["flower", 11.0]],
	},
	"east": {
		"name": "东部", "icon": "jewel",
		"ground": Color("dcefc6"),
		"structures": ["art:hdb_block", "soco:small_1", "soco:small_2", "soco:supermarket"],
		"gap": [40.0, 90.0], "brands": ["grub"], "brand_chance": 0.2, "tree": "rain_tree",
		"props": ["bike", "orchid_pot"], "bushes": [0, 1], "lawn_trees": [0, 1], "park_chance": 0.3,
		"decor": [["flower", 11.0], ["tuft", 12.0], ["flower_pink", 11.0]],
	},
	# Marina Bay's column: the water, and the promenades either side of it.

}

## One-off landmarks by block, as in BayArea.LANDMARKS: since .77 only the check-in spots, where
## BayArea has its (the middle one the block south of the start, the rest near the corners).
const LANDMARKS := {
	Vector2i(0, 1): "brand_row:shopay",
	Vector2i(-3, -5): "brand_row:tiktak",
	Vector2i(3, -5): "brand_row:grub",
	Vector2i(3, 4): "brand_row:dbb",
	Vector2i(-3, 4): "brand_row:lazado",
}
## The campuses' logo statues on the lawn (tools/make_logo_statues.py).
const LAWN_LANDMARKS := {
	Vector2i(0, 1): "statue_bag",
	Vector2i(-3, -5): "statue_note",
	Vector2i(3, -5): "statue_ride",
	Vector2i(3, 4): "statue_coins",
	Vector2i(-3, 4): "statue_heart_box",
}
## Signs that belong to a landmark drawing.
const LANDMARK_BRANDS := {}
const SOLID_SPANS := {}

## Landmarks to check in at (打卡), as in BayArea.STAMPS, in the order they open (the middle one,
## then the corners clockwise from the north-west); ids start sg_ so they never clash with
## another map's in the save. The ids are the save's, so they stay when a spot changes (.77:
## sg_one_north is Shopay, sg_merlion TikTak, sg_jewel Grub, sg_mbs DBB, sg_sentosa Lazado; until
## then 纬壹科技城, 鱼尾狮, 星耀樟宜, 滨海湾金沙, 圣淘沙).
const STAMPS := {
	"sg_one_north": {"art": "icon_bag", "block": Vector2i(0, 1), "name": "Shopay 总部", "note": "大促一来，全楼通宵", "bonus": ["haste", 0.02]},
	"sg_merlion": {"art": "icon_note", "block": Vector2i(-3, -5), "name": "TikTak 亚太总部", "note": "上班刷视频算工作", "bonus": ["magnet", 0.05]},
	"sg_jewel": {"art": "icon_ride", "block": Vector2i(3, -5), "name": "Grub 总部", "note": "打车、外卖、钱包，一个 App 全包", "bonus": ["might", 0.02]},
	"sg_mbs": {"art": "icon_coins", "block": Vector2i(3, 4), "name": "DBB 银行", "note": "金库就在楼下", "bonus": ["max_hp", 5.0]},
	"sg_sentosa": {"art": "icon_heart_box", "block": Vector2i(-3, 4), "name": "Lazado 园区", "note": "快递盒堆成了山", "bonus": ["luck", 10.0]},
}

## Parody companies, as in BayArea.BRANDS.
const BRANDS := {
	"shopay": {"text": "Shopay", "icon": "icon_bag", "color": Color("ee4d2d")},
	"grub": {"text": "Grub", "icon": "icon_ride", "color": Color("00a94f")},
	"tiktak": {"text": "TikTak", "icon": "icon_note", "color": Color("2f3542")},
	"lazado": {"text": "Lazado", "icon": "icon_heart_box", "color": Color("1a2a8e")},
	"dbb": {"text": "DBB", "icon": "icon_coins", "color": Color("d63a2f")},
	"razzer": {"text": "Razzer", "color": Color("2f9e44")},
	"onenorth_sign": {"text": "one-north", "color": Color("2f3542")},
	"lps": {"text": "Lau Pa Sat", "color": Color("8a5a2b")},
}

## Real road names, roughly where they run, as in BayArea; anything off the tables is a numbered
## lorong (lane).
const NORTH_SOUTH := {
	-3: "Clementi Rd", -2: "Commonwealth Ave", -1: "Buona Vista Rd", 0: "one-north Gateway", 1: "CTE",
	2: "Collyer Quay", 3: "KPE", 4: "Tanjong Katong Rd", 5: "Changi Rd",
}
const EAST_WEST := {
	-3: "Upper Thomson Rd", -2: "Serangoon Rd", -1: "River Valley Rd", 0: "Orchard Rd", 1: "Cecil St",
	2: "Shenton Way", 3: "Sentosa Gateway", 4: "Siloso Rd",
}

## Height in logical pixels of each drawing used here, as in BayArea.HEIGHTS.
const HEIGHTS := {
	"one_north": 90.0, "nus_hall": 80.0, "mount_faber": 100.0, "sentosa_beach": 70.0, "merlion": 110.0,
	"mbs": 150.0, "supertrees": 140.0, "lau_pa_sat": 90.0, "chinatown": 80.0, "clarke_quay": 75.0,
	"little_india": 80.0, "raffles_place": 170.0, "jewel": 90.0,
	"hdb_block": 100.0, "shophouse_teal": 70.0, "shophouse_pink": 70.0,
	"rain_tree": 70.0, "bush": 23.0,
	"statue_bag": 76.0, "statue_note": 76.0, "statue_ride": 76.0, "statue_coins": 76.0, "statue_heart_box": 76.0,
	"bike": 22.0, "durian_sign": 30.0, "orchid_pot": 22.0, "hawker_stall": 30.0,
}


static func district_of(block: Vector2i) -> String:
	if block.x >= 3:
		return "east"
	if block.x >= 1:
		return "heritage" if block.y <= -2 else "cbd"
	if block.x == 0 and block.y >= 1:
		return "heritage"
	if block.x == 0 and block.y >= -1:
		return "onenorth"
	return "hdb"


static func north_south_name(column: int, _row: int = 0) -> String:
	return NORTH_SOUTH.get(column, "Lorong %d" % (absi(column) + 1))


static func east_west_name(row: int) -> String:
	return EAST_WEST.get(row, "Lorong %d" % (absi(row) + 10))


## No salt ponds: City asks, for the salt ponds and the beach.
static func east_shore_column(_row: int) -> Variant:
	return null


static func east_water_x(_row: int) -> float:
	return INF


## Off the map counts as water (.77, as BayArea): there is no sea, only the edge.
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
	return row >= RAILWAY_FROM_ROW and row <= RAILWAY_TO_ROW
