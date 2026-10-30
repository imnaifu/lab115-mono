class_name BayArea
extends RefCounted
## The Silicon Valley stage as data: which district each city block belongs to, what stands
## there, the landmarks, the street names and the parody company signs. City reads it and
## draws; nothing here draws.
##
## Shaped like the real peninsula: the run starts mid-peninsula (Palo Alto / Mountain View),
## San Francisco is up north at its narrow tip, with the Golden Gate's water past its north
## shore, the Pacific off its west side and the Bay off its east side; going south the land
## widens, the hills and Sand Hill Road lie to the west with the ocean beyond them, the Bay
## widens to the east and ends at San Jose, which goes on south (and east, round the Bay's end)
## for ever. US-101 runs down the Bay side, I-280 down the hills side, Caltrain beside Alma St.
##
## One of the maps (Maps); Beijing has the same names, so whatever reads Maps.current works on
## either.

const NAME := "硅谷"
## The working week the map is known for; maps get harder the longer it is (Maps.ORDER), and
## DIFFICULTY says how much: enemy health, contact and move damage, and the spawn rate, as
## multiples. 硅谷 is the 965 baseline.
const HOURS := "965"
const DIFFICULTY := {"hp": 1.0, "damage": 1.0, "spawn": 1.0}
## The job grades the run's level reads as (Maps.rank_of): Google-style here, L1, L2…
const RANK_PREFIX := "L"
## Bosses and enemy rings swapped for local ones (see Beijing); none here, the schedule in
## Spawner.EVENTS is this map's own. FINALE_LINE "" keeps the finale's own line.
const BOSS_SWAPS := {}
const RING_SWAPS := {}
const FINALE_LINE := ""
## The map's own (.26): a guest boss with a move no other boss has, on top of the schedule, and an
## event (MapEvents): 硅谷's are RTO 返岗令 (it pulls you in) and 湾区地震 (debris crashing down).
const GUEST_BOSS := {"type": "rto", "at": 330.0}
const MAP_EVENT := {"id": "quake", "at": 270.0, "seconds": 20.0, "text": "湾区地震！小心头顶掉下来的碎块"}
## The district whose office blocks line a company campus wherever it stands (City._place_row).
const CAMPUS_DISTRICT := "peninsula"
## The named part of the world for the minimap, in world pixels: from the Pacific to across the
## Bay, and from the Golden Gate's water to south of San Jose.
const OVERVIEW := Rect2(-2800.0, -3300.0, 5600.0, 6300.0)

## Block rows at or above / below these are San Francisco / San Jose; columns at or before
## HILLS_COLUMN are the hills. (560 x 400 below is City.BLOCK, spelled out to keep the two
## classes' constants acyclic.)
const SF_ROW := -3
const SJ_ROW := 3
const HILLS_COLUMN := -3
const BLOCK_SIZE := Vector2(560.0, 400.0)
## The coast, row by row (west_shore_column / east_shore_column): land runs from the west shore
## road to the east shore road plus SHORE_STRIP on either side (a beach to the west, salt ponds
## or a waterfront to the east); past that is water, which nothing but ghosts crosses.
const SHORE_STRIP := 200.0
## North of San Francisco's north shore road (Lombard St), past a strip of shore, is the water
## of the Golden Gate.
const NORTH_SHORE_ROW := -7
const NORTH_WATER_Y := NORTH_SHORE_ROW * 400.0 - SHORE_STRIP
## Rows within this of a road are the road (with its sidewalks and a margin): a row's own
## coast applies only between them, and a road is water only where both rows it divides are,
## so a road along a stretch of coast is never half under water.
const ROAD_BAND := 40.0
## The freeways and the railway, by block column, and the first row they run from; `north` /
## `south` are where the green signs point.
const FREEWAYS := {2: {"number": "101", "shield": "shield_us", "from_row": -1, "north": "San Francisco", "south": "San Jose"},
	-2: {"number": "280", "shield": "shield_interstate", "from_row": -2, "north": "San Francisco", "south": "San Jose"}}
const RAILWAY_COLUMN := -1
const RAILWAY_FROM_ROW := -6
## Salt ponds line the shore from this row south (further north is a waterfront).
const SALT_POND_FROM_ROW := -1
## Blocks given over to SFO's runway (City draws it; a parked plane stands on it).
const RUNWAYS: Array[Vector2i] = [Vector2i(0, -2)]

## Per district: the `name` the minimap shows; ground colour; `structures` to line the streets with ("soco:<file>" for a
## soco-st building, "art:<svg>" for one of ours); the gap between them (at least 36, so the
## biggest boss, 32 across, still squeezes through a row instead of walking round it); which parody
## `brands` get rooftop signs and how often; the street `tree`; sidewalk `props`; how many
## bushes and trees dot the lawn; how often a block is a park; and the flat `decor`.
const DISTRICTS := {
	"peninsula": {
		"name": "硅谷",
		"ground": Color("dcefc6"),
		"structures": ["soco:office", "soco:midrise_bands", "soco:midrise_grid", "soco:commercial",
			"soco:small_1", "soco:small_2", "soco:small_3", "soco:small_4", "soco:office_block"],
		"gap": [36.0, 70.0], "brands": ["pear", "goggle", "beta", "envy", "linkedout", "nutflix"],
		"brand_chance": 0.85, "tree": "palm", "props": ["bike", "bike_campus", "cone"],
		"bushes": [2, 4], "lawn_trees": [0, 2], "park_chance": 0.2,
		"decor": [["flower", 11.0], ["poppy", 11.0], ["tuft", 12.0], ["tuft", 12.0]],
	},
	"sf": {
		"name": "旧金山",
		"ground": Color("e3e8da"),
		"structures": ["art:victorian_blue", "art:victorian_pink", "art:victorian_yellow",
			"art:victorian_mint", "art:victorian_blue", "art:victorian_pink", "soco:midrise_grid", "soco:small_3"],
		"gap": [36.0, 48.0], "brands": [], "brand_chance": 0.0, "tree": "",
		"props": ["robotaxi", "cable_car", "robotaxi"],
		"bushes": [1, 3], "lawn_trees": [0, 1], "park_chance": 0.15,
		"decor": [["tuft", 12.0], ["flower_pink", 11.0]],
	},
	"sj": {
		"name": "圣何塞",
		"ground": Color("e6eec6"),
		"structures": ["art:mission_house", "art:mission_house", "art:mission_house", "soco:supermarket",
			"soco:convenience_store", "soco:shop_1", "soco:shop_2"],
		"gap": [36.0, 64.0], "brands": ["envy", "nutflix", "pear"], "brand_chance": 0.4, "tree": "palm",
		"props": ["cone", "bike"], "bushes": [2, 4], "lawn_trees": [1, 2], "park_chance": 0.15,
		"decor": [["poppy", 11.0], ["tuft", 12.0], ["flower", 11.0]],
	},
	"hills": {
		"name": "山区",
		"ground": Color("f0dc9a"),
		"structures": ["soco:small_1", "soco:small_2", "soco:small_4"],
		"gap": [120.0, 220.0], "brands": ["sandhill"], "brand_chance": 1.0, "tree": "redwood",
		"props": [], "bushes": [1, 2], "lawn_trees": [3, 6], "park_chance": 0.4,
		"decor": [["poppy", 11.0], ["poppy", 11.0], ["tuft", 12.0]],
	},
	# The sand between the roads and the Pacific, and north of San Francisco's north shore.
	"beach": {
		"name": "海滩",
		"ground": Color("f3e5b5"),
		"structures": [], "gap": [0.0, 0.0], "brands": [], "brand_chance": 0.0, "tree": "",
		"props": [], "bushes": [0, 0], "lawn_trees": [0, 0], "park_chance": 1.0,
		"decor": [["tuft", 12.0]],
	},
	"bay": {
		"name": "海湾",
		"ground": Color("e9e4c6"),
		"structures": [], "gap": [0.0, 0.0], "brands": [], "brand_chance": 0.0, "tree": "",
		"props": [], "bushes": [0, 0], "lawn_trees": [0, 0], "park_chance": 1.0,
		"decor": [["tuft", 12.0]],
	},
}

## Height in logical pixels of each of our own structure drawings (soco-st buildings use
## City.BUILDING_SCALE instead), and of the props and trees.
const HEIGHTS := {
	"victorian_blue": 74.0, "victorian_pink": 74.0, "victorian_yellow": 74.0, "victorian_mint": 74.0,
	"mission_house": 50.0, "transamerica": 180.0, "sailsforce_tower": 196.0, "golden_gate": 170.0,
	"stanford_tower": 140.0, "pear_park": 62.0, "caltrain": 46.0,
	"palm": 58.0, "redwood": 92.0, "bush": 23.0,
	"bike": 22.0, "bike_campus": 22.0, "cone": 14.0, "robotaxi": 24.0, "cable_car": 30.0,
	"dino_skeleton": 64.0, "thumbs_up_sign": 58.0, "burger_shop": 58.0, "stadium": 150.0, "plane": 96.0,
}

## One-off landmarks by block, replacing that block's row of buildings. "brand_row:<brand>"
## is an ordinary row where every building carries that brand (a company campus).
const LANDMARKS := {
	Vector2i(-1, 0): "art:stanford_tower",
	Vector2i(0, 1): "art:caltrain",
	Vector2i(-1, -1): "brand_row:beta",
	Vector2i(0, -1): "brand_row:goggle",
	Vector2i(1, 2): "art:pear_park",
	Vector2i(1, -1): "brand_row:linkedout",
	Vector2i(0, 4): "brand_row:envy",
	Vector2i(-1, 3): "brand_row:nutflix",
	Vector2i(2, 0): "art:burger_shop",
	Vector2i(2, 3): "art:stadium",
	Vector2i(0, -4): "art:transamerica",
	Vector2i(-1, -5): "art:sailsforce_tower",
	# On the north shore, looking out over the Golden Gate's water.
	Vector2i(-2, -8): "art:golden_gate",
}
## Landmarks standing on a block's lawn, in front of its row of buildings: the campus mascots.
const LAWN_LANDMARKS := {Vector2i(0, -1): "dino_skeleton", Vector2i(-1, -1): "thumbs_up_sign"}
## The landmarks a player can check in at (打卡, Stamps), nearest the start first: its picture
## on the 打卡 page, the block it stands on (in LANDMARKS / LAWN_LANDMARKS), its name, a line about
## it, and the small bonus it gives for good once checked in at ([kind, amount], Stamps.BONUSES).
## All of them together come to about one passive at level 2.
const STAMPS := {
	"stanford_tower": {"art": "stanford_tower", "block": Vector2i(-1, 0), "name": "胡佛塔", "note": "斯坦福的钟塔，创业故事都从这儿开始", "bonus": ["haste", 0.02]},
	"caltrain": {"art": "caltrain", "block": Vector2i(0, 1), "name": "Caltrain 帕罗奥图站", "note": "赶不上这班就等下一班，小心别被撞", "bonus": ["luck", 10.0]},
	"goggle": {"art": "dino_skeleton", "block": Vector2i(0, -1), "name": "Goggle 园区", "note": "草坪上躺着一副恐龙骨架", "bonus": ["might", 0.02]},
	"beta": {"art": "thumbs_up_sign", "block": Vector2i(-1, -1), "name": "Beta 园区", "note": "门口立着巨大的点赞牌", "bonus": ["magnet", 0.05]},
	"linkedout": {"art": "card", "block": Vector2i(1, -1), "name": "LinkedOut 园区", "note": "人人都在看下一份工作", "bonus": ["luck", 10.0]},
	"burger_shop": {"art": "burger_shop", "block": Vector2i(2, 0), "name": "Out-N-In 汉堡", "note": "加班到半夜的宵夜", "bonus": ["max_hp", 5.0]},
	"pear_park": {"art": "pear_park", "block": Vector2i(1, 2), "name": "Pear 飞碟园区", "note": "一整圈玻璃的飞碟总部", "bonus": ["might", 0.02]},
	"nutflix": {"art": "icon_nut", "block": Vector2i(-1, 3), "name": "Nutflix 园区", "note": "下班回家接着刷", "bonus": ["regen", 0.05]},
	"envy": {"art": "icon_eye", "block": Vector2i(0, 4), "name": "Envy 园区", "note": "显卡又卖断货了", "bonus": ["haste", 0.02]},
	"stadium": {"art": "stadium", "block": Vector2i(2, 3), "name": "Levy's 球场", "note": "周末看球的地方", "bonus": ["speed", 0.02]},
	"transamerica": {"art": "transamerica", "block": Vector2i(0, -4), "name": "泛美金字塔", "note": "旧金山天际线上的尖塔", "bonus": ["magnet", 0.05]},
	"sailsforce_tower": {"art": "sailsforce_tower", "block": Vector2i(-1, -5), "name": "Sailsforce 大厦", "note": "旧金山最高的楼", "bonus": ["max_hp", 5.0]},
	"golden_gate": {"art": "golden_gate", "block": Vector2i(-2, -8), "name": "金门大桥", "note": "一路往北，走到陆地尽头", "bonus": ["might", 0.03]},
}
## Signs that belong to a landmark drawing.
const LANDMARK_BRANDS := {"pear_park": "pear", "sailsforce_tower": "sailsforce", "caltrain": "station",
	"burger_shop": "outnin", "stadium": "levys"}
## Landmarks that are only partly solid, as [from, to] fractions of their width: the Golden
## Gate's towers block, the deck between them is walked under.
const SOLID_SPANS := {"golden_gate": [[0.22, 0.28], [0.72, 0.78]]}

## Parody companies: a name, an icon and a colour, close enough to recognise and drawn from
## scratch rather than borrowing anyone's logo.
const BRANDS := {
	"pear": {"text": "Pear", "icon": "icon_pear", "color": Color("6b7280")},
	"goggle": {"text": "Goggle", "icon": "icon_goggles", "color": Color("3f7fe0")},
	"beta": {"text": "Beta", "icon": "icon_infinity", "color": Color("3f7fe0")},
	"envy": {"text": "Envy", "icon": "icon_eye", "color": Color("4c9a2a")},
	"nutflix": {"text": "NUTFLIX", "icon": "icon_nut", "color": Color("d63a2f")},
	"linkedout": {"text": "Linked", "badge": "out", "color": Color("2f6fb5")},
	"sailsforce": {"text": "Sailsforce", "icon": "icon_sail", "color": Color("2f9ad6")},
	"sandhill": {"text": "Sand Hill Capital", "icon": "moneybag", "color": Color("8a6a2c")},
	"station": {"text": "Palo Alto", "color": Color("2f3542")},
	"outnin": {"text": "Out-N-In", "color": Color("d63a2f")},
	"levys": {"text": "Levy's Stadium", "color": Color("b8262b")},
}

## Real street names, roughly where they run. North-south roads by block column, east-west
## roads by block row; anything off the table gets a numbered avenue.
const NORTH_SOUTH := {
	-4: "Skyline Blvd", -3: "Foothill Expy", -2: "I-280", -1: "Alma St", 0: "El Camino Real",
	1: "Middlefield Rd", 2: "US-101", 3: "Shoreline Blvd",
}
## San Francisco's own north-south streets (the peninsula's roads don't run up there).
const NORTH_SOUTH_SF := {-2: "Sunset Blvd", -1: "Divisadero St", 0: "Van Ness Ave", 1: "Embarcadero"}
const EAST_WEST := {
	-7: "Lombard St", -6: "Marina Blvd", -5: "Haight St", -4: "Market St", -3: "Geary Blvd",
	-2: "Woodside Rd", -1: "Sand Hill Rd", 0: "University Ave", 1: "California Ave",
	2: "Castro St", 3: "Stevens Creek Blvd", 4: "Santa Clara St", 5: "Story Rd",
}


static func district_of(block: Vector2i) -> String:
	var east = east_shore_column(block.y)
	if east != null and block.x >= east:
		return "bay"
	if block.x < west_shore_column(block.y) or block.y < NORTH_SHORE_ROW:
		return "beach"
	if block.y <= SF_ROW:
		return "sf"
	if block.y >= SJ_ROW:
		return "sj"
	if block.x <= HILLS_COLUMN:
		return "hills"
	return "peninsula"


static func north_south_name(column: int, row: int = 0) -> String:
	if row <= SF_ROW and NORTH_SOUTH_SF.has(column):
		return NORTH_SOUTH_SF[column]
	return NORTH_SOUTH.get(column, "%s Ave" % _ordinal(absi(column)))


static func east_west_name(row: int) -> String:
	return EAST_WEST.get(row, "%s St" % _ordinal(absi(row)))


static func _ordinal(number: int) -> String:
	var suffix := "th"
	if number % 100 < 11 or number % 100 > 13:
		suffix = {1: "st", 2: "nd", 3: "rd"}.get(number % 10, "th")
	return "%d%s" % [number, suffix]


## The block column whose road is the row's last before the Bay (null: no Bay on this row):
## close in at San Francisco and the airport, further out down the peninsula, and none from
## San Jose on, where the Bay has ended. Called for every body every frame, hence code not a
## table.
static func east_shore_column(row: int) -> Variant:
	if row <= -2:
		return 1
	if row == -1:
		return 2
	if row <= 1:
		return 3
	if row == 2:
		return 4
	return null


## The block column whose road is the row's last before the Pacific: San Francisco's Ocean
## Beach, then past the hills further south.
static func west_shore_column(row: int) -> int:
	return -2 if row <= SF_ROW else -4


## Where the row's water starts, east and west (INF / -INF: none that way).
static func east_water_x(row: int) -> float:
	var column = east_shore_column(row)
	return INF if column == null else column * BLOCK_SIZE.x + SHORE_STRIP


static func west_water_x(row: int) -> float:
	return west_shore_column(row) * BLOCK_SIZE.x - SHORE_STRIP


static func is_water(point: Vector2) -> bool:
	if point.y < NORTH_WATER_Y:
		return true
	var row := floori(point.y / BLOCK_SIZE.y)
	var within := point.y - row * BLOCK_SIZE.y
	var east := east_water_x(row)
	var west := west_water_x(row)
	# On a road: water only where the rows on both sides of it are.
	if within < ROAD_BAND:
		east = maxf(east, east_water_x(row - 1))
		west = minf(west, west_water_x(row - 1))
	elif within > BLOCK_SIZE.y - ROAD_BAND:
		east = maxf(east, east_water_x(row + 1))
		west = minf(west, west_water_x(row + 1))
	return point.x > east or point.x < west


## The water inside `area` as rects (adjacent ones touch; together they are exactly is_water):
## per row, the stretch between its roads, and per road, where both rows beside it are water.
static func water_rects(area: Rect2) -> Array[Rect2]:
	var rects: Array[Rect2] = []
	if area.position.y < NORTH_WATER_Y:
		rects.append(Rect2(area.position.x, area.position.y, area.size.x, NORTH_WATER_Y - area.position.y))
	var first := floori(maxf(area.position.y, NORTH_WATER_Y) / BLOCK_SIZE.y)
	var last := floori(area.end.y / BLOCK_SIZE.y)
	# One row past the last: its top road band reaches up into the area.
	for row in range(first, last + 2):
		var top := row * BLOCK_SIZE.y
		var bands := [
			[top + ROAD_BAND, top + BLOCK_SIZE.y - ROAD_BAND, east_water_x(row), west_water_x(row)],
			[top - ROAD_BAND, top + ROAD_BAND, maxf(east_water_x(row), east_water_x(row - 1)), minf(west_water_x(row), west_water_x(row - 1))],
		]
		for band: Array in bands:
			var from_y := maxf(band[0], maxf(area.position.y, NORTH_WATER_Y))
			var to_y := minf(band[1], area.end.y)
			if to_y <= from_y:
				continue
			if band[2] < area.end.x:
				var from_x := maxf(band[2], area.position.x)
				rects.append(Rect2(from_x, from_y, area.end.x - from_x, to_y - from_y))
			if band[3] > area.position.x:
				var to_x := minf(band[3], area.end.x)
				rects.append(Rect2(area.position.x, from_y, to_x - area.position.x, to_y - from_y))
	return rects


static func freeway_at(column: int, row: int) -> Dictionary:
	var freeway: Dictionary = FREEWAYS.get(column, {})
	if freeway.is_empty() or row < freeway["from_row"]:
		return {}
	return freeway


static func has_railway(row: int) -> bool:
	return row >= RAILWAY_FROM_ROW

