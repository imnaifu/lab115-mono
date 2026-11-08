class_name Seattle
extends RefCounted
## The Seattle stage (西雅图, .34) as data, under the same names as BayArea and Beijing so City,
## Traffic and the rest draw and move through it the same way. Nothing here draws.
##
## Squeezed onto the grid at the size the user asked for in .34 (every landmark within about 30
## seconds' walk): the run starts in South Lake Union among Amazin's offices, with the Space Needle
## to the north-west and Lake Union just north; downtown runs south to Pike Place, the waterfront
## wheel and the library, then SoDo's stadium, with Mount Rainier on the skyline. West is Elliott
## Bay; north past Lake Union are Fremont's troll, Gas Works Park and the university; east is Lake
## Washington, crossed only by the 520 and I-90 floating bridges to the Eastside (Microhard,
## Bellevue). I-5 runs north and south east of downtown, the light rail along the waterfront.
##
## Open ground since .77, as 硅谷 since .52 (the user: 其余地图参考硅谷，改的空旷点): a square of land
## round the start (BOUNDS) with no bay and no lakes, the districts still where they were, and
## the only buildings the five check-in spots (the user: 打卡点设计，只放总部在这个城市的，其余的还是
## 用城市标志): Amazin's spheres, its headquarters, in the middle, and the Space Needle, the Fremont
## Troll, Mount Rainier and Pike Place on the corners. (Until .76: the bay to the west, Lake Union
## and Lake Washington with its floating bridges, and rows of buildings on every street.)

const NAME := "西雅图"
## Between 硅谷 and 北京 (BayArea.STARS says how this works).
const STARS := 2
const DIFFICULTY := {"hp": 1.15, "damage": 1.1, "spawn": 1.07}
## Amazin's levels, like Silicon Valley's: L1, L2…
const RANK_PREFIX := "L"
## Its four bosses, at 2:00, 4:00, 6:00 and 8:00 (.45, BossKits): 巨石应用（近战）、连环会（远程）、PIP 绩效改进（定点）、全员大会（近战 + 远程）.
const BOSSES := ["monolith", "meeting_spam", "pip", "all_hands"]
## The regular enemies, redrawn for Seattle (.36; Game.spawn_enemy swaps them in): @here, Sev-3
## 工单, CR 请求, 1:1, 半夜 Page, 六页纸, AWS 账单, each as strong as the one it replaces.
## The crowd and its rings are Silicon Valley's on every map (.41, the user's call: only the
## bosses are the map's own; .36-.40 swapped the seven regular enemies and the rings for local
## ones, whose types stay in Spawner.ENEMY_TYPES unused).
const MOB_SWAPS := {}
## The Bug outbreak is a same-day delivery here: a ring of parcels.
const RING_SWAPS := {}
## The map's weather (MapEvents): 下雨 (puddles that slow everyone).
const MAP_EVENT := {"id": "rain", "at": 300.0, "seconds": 20.0, "text": "下雨了！水坑里走不快",
	"name": "下雨", "hint": "水坑里走不快，把怪引进去"}
## The district whose office blocks line a company campus wherever it stands (City._place_row).
const CAMPUS_DISTRICT := "slu"
## The map (.77), as BayArea.BOUNDS: a square 1800 out every way from the start (2300 .77–.85). Outside it counts
## as water (is_water, water_rects), so everything stays inside, and City draws it as the edge.
const BOUNDS := Rect2(-1520.0, -1620.0, 3600.0, 3600.0)
## Only the check-in spots stand, and trees don't block (City).
const OPEN_GROUND := true
## The named part of the world (the minimap showed it until .44): the map itself since .77.
const OVERVIEW := BOUNDS
## Spelled out rather than City.BLOCK, to keep the classes' constants acyclic (as in BayArea).
const BLOCK_SIZE := Vector2(560.0, 400.0)
## Block rows at or above NORTH_ROW are north of Lake Union, at or below DOWNTOWN_ROW downtown,
## at or below SODO_ROW SoDo; columns at or past EASTSIDE_COLUMN are the Eastside (across Lake
## Washington until .77).
const NORTH_ROW := -2
const DOWNTOWN_ROW := 1
const SODO_ROW := 3
const EASTSIDE_COLUMN := 3
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

## Per district, as in BayArea.DISTRICTS. Firs and rain-green lawns everywhere. Since .77 (open
## ground) at most a bush and a tree a block; the bay strip and the lakes' blocks are gone.
const DISTRICTS := {
	"slu": {
		"name": "南联合湖", "icon": "spheres",
		"ground": Color("dceccf"),
		"structures": ["soco:office", "soco:midrise_bands", "soco:midrise_grid", "soco:office_block", "soco:commercial"],
		"gap": [36.0, 70.0], "brands": ["amazin", "zillo", "expedio", "starbacks"],
		"brand_chance": 0.85, "tree": "redwood", "props": ["coffee_cart", "bike", "scooter", "cone"],
		"bushes": [0, 1], "lawn_trees": [0, 1], "park_chance": 0.15,
		"decor": [["tuft", 12.0], ["flower", 11.0], ["tuft", 12.0]],
	},
	"downtown": {
		"name": "市中心", "icon": "pike_place",
		"ground": Color("e2e7da"),
		"structures": ["soco:midrise_grid", "soco:office_block", "soco:midrise_bands", "soco:commercial",
			"soco:shop_1", "soco:shop_2"],
		"gap": [36.0, 56.0], "brands": ["starbacks", "zillo", "amazin"], "brand_chance": 0.4, "tree": "redwood",
		"props": ["coffee_cart", "bike", "robotaxi"], "bushes": [0, 1], "lawn_trees": [0, 1], "park_chance": 0.1,
		"decor": [["tuft", 12.0], ["flower_pink", 11.0]],
	},
	"sodo": {
		"name": "SoDo", "icon": "stadium",
		"ground": Color("e6e4d6"),
		"structures": ["soco:supermarket", "soco:commercial", "soco:convenience_store", "soco:shop_1"],
		"gap": [36.0, 70.0], "brands": ["starbacks", "costgo"], "brand_chance": 0.35, "tree": "poplar",
		"props": ["cone", "coffee_cart"], "bushes": [0, 1], "lawn_trees": [0, 1], "park_chance": 0.15,
		"decor": [["tuft", 12.0], ["flower", 11.0]],
	},
	"north": {
		"name": "弗里蒙特", "icon": "fremont_troll",
		"ground": Color("d9ebcb"),
		"structures": ["soco:small_1", "soco:small_2", "soco:small_3", "soco:small_4", "soco:shop_2"],
		"gap": [40.0, 72.0], "brands": [], "brand_chance": 0.0, "tree": "redwood",
		"props": ["bike", "bike", "coffee_cart"], "bushes": [0, 1], "lawn_trees": [0, 1], "park_chance": 0.25,
		"decor": [["flower", 11.0], ["tuft", 12.0], ["flower_pink", 11.0]],
	},
	"eastside": {
		"name": "贝尔维尤", "icon": "icon_window",
		"ground": Color("dfeccf"),
		"structures": ["soco:office", "soco:office_block", "soco:midrise_grid", "soco:midrise_bands", "soco:commercial"],
		"gap": [36.0, 70.0], "brands": ["microhard", "tmobble", "valv", "costgo"], "brand_chance": 0.8,
		"tree": "redwood", "props": ["robotaxi", "bike", "coffee_cart"], "bushes": [0, 1], "lawn_trees": [0, 1],
		"park_chance": 0.15, "decor": [["tuft", 12.0], ["flower", 11.0]],
	},

}

## One-off landmarks by block, as in BayArea.LANDMARKS: since .77 only the check-in spots, where
## BayArea has its (the middle one the block south of the start, the rest near the corners).
const LANDMARKS := {
	Vector2i(0, 1): "art:spheres",
	Vector2i(-2, -3): "art:space_needle",
	Vector2i(2, -3): "art:fremont_troll",
	Vector2i(2, 3): "art:mt_rainier",
	Vector2i(-2, 3): "art:pike_place",
}
const LAWN_LANDMARKS := {}
## Signs that belong to a landmark drawing.
const LANDMARK_BRANDS := {"pike_place": "pike"}
const SOLID_SPANS := {}

## Landmarks to check in at (打卡), as in BayArea.STAMPS, in the order they open (the middle one,
## then the corners clockwise from the north-west); ids start sea_ so they never clash with
## another map's in the save. Their bonuses add up the same as the other maps'. The ids are the
## save's, so they stay when a spot changes (.77: sea_microhard is Mount Rainier; Microhard's
## headquarters is in Redmond, the user: 只放总部在这个城市的).
const STAMPS := {
	"sea_spheres": {"art": "spheres", "block": Vector2i(0, 1), "name": "Amazin' 球球", "note": "三个玻璃球，里面是热带雨林", "bonus": ["luck", 5.0]},
	"sea_space_needle": {"art": "space_needle", "block": Vector2i(-2, -3), "name": "太空针塔", "note": "飞碟停在了塔尖上", "bonus": ["max_hp", 10.0]},
	"sea_troll": {"art": "fremont_troll", "block": Vector2i(2, -3), "name": "弗里蒙特巨魔", "note": "桥底下抓着一辆小车", "bonus": ["haste", 0.03]},
	"sea_microhard": {"art": "mt_rainier", "block": Vector2i(2, 3), "name": "雷尼尔雪山", "note": "天晴才看得见，一年没几天", "bonus": ["might", 0.03]},
	"sea_pike": {"art": "pike_place", "block": Vector2i(-2, 3), "name": "派克市场", "note": "小心头顶飞过来的鱼", "bonus": ["magnet", 0.1]},
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


## No shore anywhere since .77 (City asks, for the salt ponds and the beach).
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
