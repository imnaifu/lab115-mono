class_name Seattle
extends RefCounted
## The Seattle stage (西雅图, .34) as data, under the same names as BayArea and Beijing so City,
## Traffic, the minimap and the rest draw and move through it the same way. Nothing here draws.
##
## Squeezed onto the grid at the size the user asked for in .34 (every landmark within about 30
## seconds' walk): the run starts in South Lake Union among Amazin's offices, with the Space Needle
## to the north-west and Lake Union just north; downtown runs south to Pike Place, the waterfront
## wheel and the library, then SoDo's stadium, with Mount Rainier on the skyline. West is Elliott
## Bay; north past Lake Union are Fremont's troll, Gas Works Park and the university; east is Lake
## Washington, crossed only by the 520 and I-90 floating bridges to the Eastside (Microhard,
## Bellevue). I-5 runs north and south east of downtown, the light rail along the waterfront.

const NAME := "西雅图"
## Between 硅谷's 965 and 北京's 996 (BayArea.HOURS says how this works): 9 to 7, five days, and
## on-call on top.
const HOURS := "975"
const DIFFICULTY := {"hp": 1.15, "damage": 1.1, "spawn": 1.07}
## Amazin's levels, like Silicon Valley's: L1, L2…
const RANK_PREFIX := "L"
## Local bosses in place of Silicon Valley's, slot for slot (each as strong as the one it
## replaces; Spawner._plan_events): Day 1, PIP, Prime Day, Bar Raiser, Copilot, 部门重组, 连环会,
## and from .36 the three every map used to share too: us-east-1 宕机, 巨石应用 (falling apart into
## 微服务), 全员大会.
const BOSS_SWAPS := {
	"techdebt_elite": "day1", "layoff": "pip", "deadline": "prime_day", "investor": "bar_raiser",
	"ai": "copilot", "scope_change": "reorg", "incident": "meeting_spam",
	"server_elite": "us_east_1", "spaghetti": "monolith", "pie_boss": "all_hands",
}
## The regular enemies, redrawn for Seattle (.36; Game.spawn_enemy swaps them in): @here, Sev-3
## 工单, CR 请求, 1:1, 半夜 Page, 六页纸, AWS 账单, each as strong as the one it replaces.
const MOB_SWAPS := {
	"ping": "at_here", "bug": "sev3_ticket", "mail": "code_review", "meeting": "one_on_one",
	"ghost": "night_page", "techdebt": "six_pager", "server": "cloud_bill",
}
## The Bug outbreak is a same-day delivery here: a ring of parcels.
const RING_SWAPS := {"bug": {"type": "parcel", "text": "Prime 当日达！包裹把你围住了"},
	"ping": {"type": "at_here", "text": "@here 轰炸！"}, "ghost": {"type": "night_page", "text": "半夜 Page 合围！"}}
const FINALE_LINE := "最后的考验：全员大会 + Copilot"
## The map's own guest boss and event (BayArea.GUEST_BOSS says how): 节俭 (Frugality, it hoovers
## up the stars lying round and keeps them until it is down) and 下雨 (puddles that slow everyone).
const GUEST_BOSS := {"type": "frugality", "at": 330.0}
const MAP_EVENT := {"id": "rain", "at": 285.0, "seconds": 20.0, "text": "西雅图又下雨了！水坑里走不快",
	"name": "下雨", "hint": "水坑里走不快，把怪引进去"}
## The district whose office blocks line a company campus wherever it stands (City._place_row).
const CAMPUS_DISTRICT := "slu"
## The named part of the world for the minimap, in world pixels: from Elliott Bay to the Eastside,
## from the university to SoDo.
const OVERVIEW := Rect2(-1800.0, -2000.0, 4600.0, 4000.0)
## Spelled out rather than City.BLOCK, to keep the classes' constants acyclic (as in BayArea).
const BLOCK_SIZE := Vector2(560.0, 400.0)
## Block rows at or above NORTH_ROW are north of Lake Union, at or below DOWNTOWN_ROW downtown,
## at or below SODO_ROW SoDo; columns at or past EASTSIDE_COLUMN are across Lake Washington.
const NORTH_ROW := -2
const DOWNTOWN_ROW := 1
const SODO_ROW := 3
const EASTSIDE_COLUMN := 3
## Elliott Bay, as BayArea's Pacific: west of each row's shore road (west_shore_column) and a
## strip of waterfront is water. ROAD_BAND as in BayArea: a road is water only where both rows
## beside it are, so the waterfront road never goes half under.
const SHORE_STRIP := 200.0
const ROAD_BAND := 40.0
## Lake Union (one block north of the start) and Lake Washington (a column of blocks down the
## east side). The lakes stop short of the roads round them; Lake Washington is cut in three so
## that only the 520 (the road at y = -400) and I-90 (y = 400) cross it, as the floating bridges do.
const LAKE_BLOCKS: Array[Vector2i] = [
	Vector2i(0, -2), Vector2i(2, -4), Vector2i(2, -3), Vector2i(2, -2), Vector2i(2, -1),
	Vector2i(2, 0), Vector2i(2, 1), Vector2i(2, 2), Vector2i(2, 3),
]
const LAKES: Array[Rect2] = [
	Rect2(60.0, -740.0, 440.0, 280.0),
	Rect2(1180.0, -1540.0, 440.0, 1100.0),
	Rect2(1180.0, -360.0, 440.0, 720.0),
	Rect2(1180.0, 440.0, 440.0, 1100.0),
]
## I-5 east of downtown and I-405 down the Eastside, by block column; `north` / `south` are where
## the green signs point.
const FREEWAYS := {
	1: {"number": "5", "shield": "shield_interstate", "from_row": -12, "north": "Vancouver BC", "south": "Tacoma"},
	4: {"number": "405", "shield": "shield_interstate", "from_row": -12, "north": "Everett", "south": "Renton"},
}
## The light rail, along the waterfront road.
const RAILWAY_COLUMN := -1
const RAILWAY_FROM_ROW := -12
## The railway runs on south for ever (Singapore's ends on Sentosa).
const RAILWAY_TO_ROW := 1000
## No salt ponds and no airport here.
const SALT_POND_FROM_ROW := 1000
const RUNWAYS: Array[Vector2i] = []
## What drives the freeways and the railway (Traffic, .37): cars, and the light rail.
const VEHICLES := ["car_top"]
const TRAIN := "train_top"

## Per district, as in BayArea.DISTRICTS. Firs and rain-green lawns everywhere.
const DISTRICTS := {
	"slu": {
		"name": "南联合湖", "icon": "spheres",
		"ground": Color("dceccf"),
		"structures": ["soco:office", "soco:midrise_bands", "soco:midrise_grid", "soco:office_block", "soco:commercial"],
		"gap": [36.0, 70.0], "brands": ["amazin", "zillo", "expedio", "starbacks"],
		"brand_chance": 0.85, "tree": "redwood", "props": ["coffee_cart", "bike", "scooter", "cone"],
		"bushes": [2, 4], "lawn_trees": [0, 2], "park_chance": 0.15,
		"decor": [["tuft", 12.0], ["flower", 11.0], ["tuft", 12.0]],
	},
	"downtown": {
		"name": "市中心", "icon": "pike_place",
		"ground": Color("e2e7da"),
		"structures": ["soco:midrise_grid", "soco:office_block", "soco:midrise_bands", "soco:commercial",
			"soco:shop_1", "soco:shop_2"],
		"gap": [36.0, 56.0], "brands": ["starbacks", "zillo", "amazin"], "brand_chance": 0.4, "tree": "redwood",
		"props": ["coffee_cart", "bike", "robotaxi"], "bushes": [1, 3], "lawn_trees": [0, 1], "park_chance": 0.1,
		"decor": [["tuft", 12.0], ["flower_pink", 11.0]],
	},
	"sodo": {
		"name": "SoDo", "icon": "stadium",
		"ground": Color("e6e4d6"),
		"structures": ["soco:supermarket", "soco:commercial", "soco:convenience_store", "soco:shop_1"],
		"gap": [36.0, 70.0], "brands": ["starbacks", "costgo"], "brand_chance": 0.35, "tree": "poplar",
		"props": ["cone", "coffee_cart"], "bushes": [1, 3], "lawn_trees": [0, 1], "park_chance": 0.15,
		"decor": [["tuft", 12.0], ["flower", 11.0]],
	},
	"north": {
		"name": "弗里蒙特", "icon": "fremont_troll",
		"ground": Color("d9ebcb"),
		"structures": ["soco:small_1", "soco:small_2", "soco:small_3", "soco:small_4", "soco:shop_2"],
		"gap": [40.0, 72.0], "brands": [], "brand_chance": 0.0, "tree": "redwood",
		"props": ["bike", "bike", "coffee_cart"], "bushes": [2, 4], "lawn_trees": [1, 3], "park_chance": 0.25,
		"decor": [["flower", 11.0], ["tuft", 12.0], ["flower_pink", 11.0]],
	},
	"eastside": {
		"name": "贝尔维尤", "icon": "icon_window",
		"ground": Color("dfeccf"),
		"structures": ["soco:office", "soco:office_block", "soco:midrise_grid", "soco:midrise_bands", "soco:commercial"],
		"gap": [36.0, 70.0], "brands": ["microhard", "tmobble", "valv", "costgo"], "brand_chance": 0.8,
		"tree": "redwood", "props": ["robotaxi", "bike", "coffee_cart"], "bushes": [2, 4], "lawn_trees": [1, 2],
		"park_chance": 0.15, "decor": [["tuft", 12.0], ["flower", 11.0]],
	},
	# The waterfront strip between the shore road and Elliott Bay, and the lakes' blocks.
	"sound": {
		"name": "艾略特湾", "icon": "great_wheel",
		"ground": Color("e9e4c6"),
		"structures": [], "gap": [0.0, 0.0], "brands": [], "brand_chance": 0.0, "tree": "",
		"props": [], "bushes": [0, 0], "lawn_trees": [0, 0], "park_chance": 1.0,
		"decor": [["tuft", 12.0]],
	},
	"lake": {
		"name": "湖边", "icon": "gas_works",
		"ground": Color("dceccf"),
		"structures": [], "gap": [0.0, 0.0], "brands": [], "brand_chance": 0.0, "tree": "",
		"props": [], "bushes": [0, 0], "lawn_trees": [0, 0], "park_chance": 1.0,
		"decor": [["tuft", 12.0]],
	},
}

## One-off landmarks by block, as in BayArea.LANDMARKS.
const LANDMARKS := {
	# Where a run starts: Amazin's campus round the first screen.
	Vector2i(0, 0): "brand_row:amazin",
	Vector2i(0, -1): "brand_row:amazin",
	Vector2i(1, -1): "brand_row:zillo",
	Vector2i(-1, 0): "art:first_coffee",
	Vector2i(1, 0): "art:spheres",
	Vector2i(-1, -1): "art:space_needle",
	Vector2i(0, 1): "art:caltrain",
	Vector2i(-1, 1): "art:pike_place",
	# On the waterfront, the last block before Elliott Bay.
	Vector2i(-1, 2): "art:great_wheel",
	Vector2i(0, 2): "art:central_library",
	Vector2i(1, 2): "brand_row:expedio",
	Vector2i(0, 3): "art:stadium",
	Vector2i(1, 3): "art:mt_rainier",
	# On Lake Union's north shore.
	Vector2i(0, -3): "art:gas_works",
	Vector2i(-1, -3): "art:fremont_troll",
	Vector2i(1, -3): "art:uw_library",
	# Across Lake Washington.
	Vector2i(3, -1): "brand_row:valv",
	Vector2i(3, 0): "brand_row:microhard",
	Vector2i(3, 1): "brand_row:tmobble",
}
const LAWN_LANDMARKS := {}
## Signs that belong to a landmark drawing.
const LANDMARK_BRANDS := {"caltrain": "station", "pike_place": "pike", "first_coffee": "starbacks", "stadium": "lumens"}
const SOLID_SPANS := {}

## Landmarks to check in at (打卡), as in BayArea.STAMPS; ids start sea_ so they never clash with
## another map's in the save. Their bonuses add up the same as the other maps'.
const STAMPS := {
	"sea_first_coffee": {"art": "first_coffee", "block": Vector2i(-1, 0), "name": "Starbacks 一号店", "note": "全世界排队最长的咖啡店", "bonus": ["haste", 0.02]},
	"sea_spheres": {"art": "spheres", "block": Vector2i(1, 0), "name": "Amazin' 球球", "note": "三个玻璃球，里面是热带雨林", "bonus": ["might", 0.02]},
	"sea_space_needle": {"art": "space_needle", "block": Vector2i(-1, -1), "name": "太空针塔", "note": "飞碟停在了塔尖上", "bonus": ["max_hp", 5.0]},
	"sea_westlake": {"art": "caltrain", "block": Vector2i(0, 1), "name": "Westlake 轻轨站", "note": "下雨天也准点，就是人多", "bonus": ["speed", 0.02]},
	"sea_pike": {"art": "pike_place", "block": Vector2i(-1, 1), "name": "派克市场", "note": "小心头顶飞过来的鱼", "bonus": ["magnet", 0.05]},
	"sea_great_wheel": {"art": "great_wheel", "block": Vector2i(-1, 2), "name": "海滨摩天轮", "note": "转一圈看遍艾略特湾", "bonus": ["luck", 10.0]},
	"sea_library": {"art": "central_library", "block": Vector2i(0, 2), "name": "中央图书馆", "note": "一栋斜着长的玻璃楼", "bonus": ["haste", 0.02]},
	"sea_gas_works": {"art": "gas_works", "block": Vector2i(0, -3), "name": "煤气厂公园", "note": "生锈的管子成了网红背景", "bonus": ["might", 0.02]},
	"sea_troll": {"art": "fremont_troll", "block": Vector2i(-1, -3), "name": "弗里蒙特巨魔", "note": "桥底下抓着一辆小车", "bonus": ["regen", 0.05]},
	"sea_uw": {"art": "uw_library", "block": Vector2i(1, -3), "name": "华盛顿大学", "note": "图书馆像霍格沃茨", "bonus": ["magnet", 0.05]},
	"sea_stadium": {"art": "stadium", "block": Vector2i(0, 3), "name": "Lumens 球场", "note": "全联盟最吵的主场", "bonus": ["max_hp", 5.0]},
	"sea_microhard": {"art": "icon_window", "block": Vector2i(3, 0), "name": "Microhard 园区", "note": "过了浮桥就是东区", "bonus": ["luck", 10.0]},
	"sea_rainier": {"art": "mt_rainier", "block": Vector2i(1, 3), "name": "雷尼尔雪山", "note": "天晴才看得见，一年没几天", "bonus": ["might", 0.03]},
}

## Parody companies, as in BayArea.BRANDS.
const BRANDS := {
	"amazin": {"text": "Amazin'", "icon": "icon_box_smile", "color": Color("e08a1e")},
	"microhard": {"text": "Microhard", "icon": "icon_window", "color": Color("2f6fb0")},
	"zillo": {"text": "Zillo", "color": Color("2f6fe0")},
	"expedio": {"text": "Expedio", "color": Color("1f4fa3")},
	"starbacks": {"text": "Starbacks", "color": Color("1e7a4f")},
	"tmobble": {"text": "T-Mobble", "color": Color("d6237f")},
	"valv": {"text": "Valv", "color": Color("2f3542")},
	"costgo": {"text": "Costgo", "color": Color("d63a2f")},
	"station": {"text": "Westlake", "color": Color("2f3542")},
	"pike": {"text": "Public Market", "color": Color("c8453a")},
	"lumens": {"text": "Lumens Field", "color": Color("2f5f3a")},
}

## Real road names, roughly where they run, as in BayArea; anything off the table is a numbered
## avenue or street.
const NORTH_SOUTH := {
	-2: "Western Ave", -1: "Alaskan Way", 0: "Westlake Ave", 1: "I-5", 2: "Lakeview Blvd",
	3: "Bellevue Way", 4: "I-405", 5: "156th Ave NE",
}
const EAST_WEST := {
	-4: "NE 45th St", -3: "N 34th St", -2: "Valley St", -1: "SR-520", 0: "Denny Way", 1: "I-90",
	2: "Pike St", 3: "Royal Brougham Way", 4: "S Holgate St",
}

## Height in logical pixels of each drawing used here, as in BayArea.HEIGHTS.
const HEIGHTS := {
	"space_needle": 190.0, "spheres": 84.0, "pike_place": 96.0, "first_coffee": 60.0,
	"great_wheel": 124.0, "central_library": 124.0, "fremont_troll": 76.0, "gas_works": 104.0,
	"uw_library": 104.0, "mt_rainier": 104.0, "caltrain": 46.0, "stadium": 150.0,
	"redwood": 92.0, "poplar": 66.0, "bush": 23.0,
	"bike": 22.0, "cone": 14.0, "robotaxi": 24.0, "scooter": 24.0, "coffee_cart": 28.0,
}


static func district_of(block: Vector2i) -> String:
	if LAKE_BLOCKS.has(block):
		return "lake"
	if block.x < west_shore_column(block.y):
		return "sound"
	if block.x >= EASTSIDE_COLUMN:
		return "eastside"
	if block.y <= NORTH_ROW:
		return "north"
	if block.y >= SODO_ROW:
		return "sodo"
	if block.y >= DOWNTOWN_ROW:
		return "downtown"
	return "slu"


static func north_south_name(column: int, _row: int = 0) -> String:
	return NORTH_SOUTH.get(column, "%s Ave" % _ordinal(absi(column)))


static func east_west_name(row: int) -> String:
	return EAST_WEST.get(row, "%s St" % _ordinal(absi(row)))


static func _ordinal(number: int) -> String:
	var suffix := "th"
	if number % 100 < 11 or number % 100 > 13:
		suffix = {1: "st", 2: "nd", 3: "rd"}.get(number % 10, "th")
	return "%d%s" % [number, suffix]


## The block column whose road is the row's last before Elliott Bay: further west north of Lake
## Union (Ballard), right at the waterfront road from South Lake Union south.
static func west_shore_column(row: int) -> int:
	return -2 if row <= NORTH_ROW else -1


static func west_water_x(row: int) -> float:
	return west_shore_column(row) * BLOCK_SIZE.x - SHORE_STRIP


## No shore to the east (the lakes are LAKES): City asks, for the salt ponds and the beach.
static func east_shore_column(_row: int) -> Variant:
	return null


static func east_water_x(_row: int) -> float:
	return INF


static func is_water(point: Vector2) -> bool:
	for lake in LAKES:
		if lake.has_point(point):
			return true
	var row := floori(point.y / BLOCK_SIZE.y)
	var within := point.y - row * BLOCK_SIZE.y
	var west := west_water_x(row)
	# On a road: water only where the rows on both sides of it are.
	if within < ROAD_BAND:
		west = minf(west, west_water_x(row - 1))
	elif within > BLOCK_SIZE.y - ROAD_BAND:
		west = minf(west, west_water_x(row + 1))
	return point.x < west


## The water inside `area` as rects (together exactly is_water): each lake's part of it, and per
## row the bay west of its shore, per road where both rows beside it are bay (as BayArea does).
static func water_rects(area: Rect2) -> Array[Rect2]:
	var rects: Array[Rect2] = []
	for lake in LAKES:
		var part := lake.intersection(area)
		if part.has_area():
			rects.append(part)
	var first := floori(area.position.y / BLOCK_SIZE.y)
	var last := floori(area.end.y / BLOCK_SIZE.y)
	# One row past the last: its top road band reaches up into the area.
	for row in range(first, last + 2):
		var top := row * BLOCK_SIZE.y
		var bands := [
			[top + ROAD_BAND, top + BLOCK_SIZE.y - ROAD_BAND, west_water_x(row)],
			[top - ROAD_BAND, top + ROAD_BAND, minf(west_water_x(row), west_water_x(row - 1))],
		]
		for band: Array in bands:
			var from_y := maxf(band[0], area.position.y)
			var to_y := minf(band[1], area.end.y)
			if to_y <= from_y or band[2] <= area.position.x:
				continue
			var to_x := minf(band[2], area.end.x)
			rects.append(Rect2(area.position.x, from_y, to_x - area.position.x, to_y - from_y))
	return rects


static func freeway_at(column: int, row: int) -> Dictionary:
	var freeway: Dictionary = FREEWAYS.get(column, {})
	if freeway.is_empty() or row < freeway["from_row"]:
		return {}
	return freeway


static func has_railway(row: int) -> bool:
	return row >= RAILWAY_FROM_ROW
