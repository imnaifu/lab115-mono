class_name BayArea
extends RefCounted
## The Silicon Valley stage as data: which district each city block belongs to, what stands
## there, the landmarks, the street names and the parody company signs. City reads it and
## draws; nothing here draws.
##
## Open ground since .52 (the user: 地图整体改空旷一点，只有打卡点的建筑；不要海，玩家哪里都能走，除非
## 到地图边界): a square of land round the start (BOUNDS) with no sea, where the only buildings are
## the five check-in landmarks (OPEN_GROUND), set out evenly on a ring round the start, and a
## tree here and there. The districts still run the way the real peninsula does: San Francisco to
## the north, San Jose to the south, the hills on the west edge; US-101 and I-280 run north-south,
## Caltrain beside Alma St. (Until .51 it was the peninsula itself, built up street after street,
## with the Golden Gate's water to the north, the Pacific to the west and the Bay to the east.)
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
## Its four bosses, at 2:00, 4:00, 6:00 and 8:00 (.45, BossKits): Deadline（近战）、主库宕机（定点）、AI 大模型（远程）、老板画饼（定点 + 远程）.
const BOSSES := ["deadline", "server_elite", "ai", "pie_boss"]
## Regular enemies swapped for the map's own (Game.spawn_enemy, .36); 硅谷 keeps the originals.
const MOB_SWAPS := {}
const RING_SWAPS := {}
## The map's weather (MapEvents): 湾区地震 (debris crashing down).
## `name` and `hint` stay on screen while it lasts (.34, the user's ask: say what the weather is).
const MAP_EVENT := {"id": "quake", "at": 270.0, "seconds": 20.0, "text": "湾区地震！小心头顶掉下来的碎块",
	"name": "湾区地震", "hint": "躲开地上的红圈"}
## The district whose office blocks line a company campus wherever it stands (City._place_row).
const CAMPUS_DISTRICT := "peninsula"
## The map (.52): a square 2300 out every way from the start (Game puts the player at
## City.BLOCK × (0.5, 0.45) = (280, 180)), about 500 past the check-in landmarks' ring. Outside it
## counts as water (is_water, water_rects), so the collision, the enemies' paths, the spawns, the
## cars and the weather all stay inside, and City draws it as the map's edge rather than as sea.
const BOUNDS := Rect2(-2020.0, -2120.0, 4600.0, 4600.0)
## Only the check-in landmarks stand (no rows of buildings), and trees don't block (City, .52).
const OPEN_GROUND := true
## The named part of the world (the minimap showed it until .44): the map itself since .52.
const OVERVIEW := BOUNDS

## Block rows at or above / below these are San Francisco / San Jose; columns at or before
## HILLS_COLUMN are the hills, the map's west edge. (560 x 400 below is City.BLOCK, spelled out to
## keep the two classes' constants acyclic.) .52 moved San Francisco's edge a row north and the
## hills' a column west, so the 胡佛塔 stands on the peninsula.
const SF_ROW := -3
const SJ_ROW := 2
const HILLS_COLUMN := -4
const BLOCK_SIZE := Vector2(560.0, 400.0)
## The freeways and the railway, by block column, and the first row they run from; `north` /
## `south` are where the green signs point.
const FREEWAYS := {2: {"number": "101", "shield": "shield_us", "from_row": -1, "north": "San Francisco", "south": "San Jose"},
	-2: {"number": "280", "shield": "shield_interstate", "from_row": -1, "north": "San Francisco", "south": "San Jose"}}
const RAILWAY_COLUMN := -1
const RAILWAY_FROM_ROW := -4
## The railway runs on south for ever (Singapore's ends on Sentosa).
const RAILWAY_TO_ROW := 1000
## Salt ponds lined the Bay shore from this row south until .52; with no Bay there are none
## (east_shore_column), but City still reads the row.
const SALT_POND_FROM_ROW := -1
## Blocks given over to an airport runway: SFO's until .52, none on open ground.
const RUNWAYS: Array[Vector2i] = []
## What drives the freeways and the railway (Traffic, .37): robotaxis and Caltrain.
const VEHICLES := ["car_top"]
const TRAIN := "train_top"

## Per district: the `name` the HUD shows; ground colour; `structures` to line the streets with ("soco:<file>" for a
## soco-st building, "art:<svg>" for one of ours); the gap between them (at least 36, so the
## biggest boss, 32 across, still squeezes through a row instead of walking round it); which parody
## `brands` get rooftop signs and how often; the street `tree`; sidewalk `props`; how many
## bushes and trees dot the lawn; how often a block is a park; and the flat `decor`.
## Since .52 (OPEN_GROUND) only `ground`, `tree`, `bushes`, `lawn_trees` and `decor` show: there
## are no rows of buildings (the campus district's `structures` still make Goggle's), and each
## block gets at most one tree and one bush, a tree here and there as the user asked (零星).
const DISTRICTS := {
	"peninsula": {
		"name": "硅谷", "icon": "pear_park",
		"ground": Color("dcefc6"),
		"structures": ["soco:office", "soco:midrise_bands", "soco:midrise_grid", "soco:commercial",
			"soco:small_1", "soco:small_2", "soco:small_3", "soco:small_4", "soco:office_block"],
		"gap": [36.0, 70.0], "brands": ["pear", "goggle", "beta", "envy", "linkedout", "nutflix"],
		"brand_chance": 0.85, "tree": "palm", "props": ["bike", "bike_campus", "scooter", "cone"],
		"bushes": [0, 1], "lawn_trees": [0, 1], "park_chance": 0.2,
		"decor": [["flower", 11.0], ["poppy", 11.0], ["tuft", 12.0], ["tuft", 12.0]],
	},
	"sf": {
		"name": "旧金山", "icon": "cable_car",
		"ground": Color("e3e8da"),
		"structures": ["art:victorian_blue", "art:victorian_pink", "art:victorian_yellow",
			"art:victorian_mint", "art:victorian_blue", "art:victorian_pink", "soco:midrise_grid", "soco:small_3"],
		"gap": [36.0, 48.0], "brands": [], "brand_chance": 0.0, "tree": "",
		"props": ["robotaxi", "cable_car", "robotaxi"],
		"bushes": [0, 1], "lawn_trees": [0, 1], "park_chance": 0.15,
		"decor": [["tuft", 12.0], ["flower_pink", 11.0]],
	},
	"sj": {
		"name": "圣何塞", "icon": "mission_house",
		"ground": Color("e6eec6"),
		"structures": ["art:mission_house", "art:mission_house", "art:mission_house", "soco:supermarket",
			"soco:convenience_store", "soco:shop_1", "soco:shop_2"],
		"gap": [36.0, 64.0], "brands": ["envy", "nutflix", "pear"], "brand_chance": 0.4, "tree": "palm",
		"props": ["cone", "bike", "scooter"], "bushes": [0, 1], "lawn_trees": [0, 1], "park_chance": 0.15,
		"decor": [["poppy", 11.0], ["tuft", 12.0], ["flower", 11.0]],
	},
	"hills": {
		"name": "山区", "icon": "redwood",
		"ground": Color("f0dc9a"),
		"structures": ["soco:small_1", "soco:small_2", "soco:small_4"],
		"gap": [120.0, 220.0], "brands": ["sandhill"], "brand_chance": 1.0, "tree": "redwood",
		"props": [], "bushes": [0, 1], "lawn_trees": [0, 1], "park_chance": 0.4,
		"decor": [["poppy", 11.0], ["poppy", 11.0], ["tuft", 12.0]],
	},
}

## Height in logical pixels of each of our own structure drawings (soco-st buildings use
## City.BUILDING_SCALE instead), and of the props and trees.
const HEIGHTS := {
	"victorian_blue": 74.0, "victorian_pink": 74.0, "victorian_yellow": 74.0, "victorian_mint": 74.0,
	"mission_house": 50.0, "transamerica": 180.0, "sailsforce_tower": 196.0, "golden_gate": 170.0,
	"stanford_tower": 140.0, "pear_park": 62.0, "caltrain": 46.0,
	"palm": 58.0, "redwood": 92.0, "bush": 23.0,
	"bike": 22.0, "bike_campus": 22.0, "cone": 14.0, "robotaxi": 24.0, "cable_car": 30.0, "scooter": 24.0,
	"dino_skeleton": 64.0, "thumbs_up_sign": 58.0, "burger_shop": 58.0, "stadium": 150.0, "plane": 96.0,
}

## One-off landmarks by block, replacing that block's row of buildings. "brand_row:<brand>"
## is an ordinary row where every building carries that brand (a company campus).
## Since .52 the five stand evenly on a ring about 1800 out from the start (the user: 打卡点平均
## 分布), about 29 seconds' walk each and 34 between neighbours, as near a regular pentagon as the
## blocks allow (within 5°): 金门大桥 north, Goggle east-north-east, Levy's 球场 south-east, Pear
## south-west, 胡佛塔 west-north-west, roughly where they are in the real Bay Area. Sailsforce
## 大厦 gave way to Levy's 球场 (two in San Francisco left the south empty).
const LANDMARKS := {
	Vector2i(0, -5): "art:golden_gate",
	Vector2i(3, -1): "brand_row:goggle",
	Vector2i(2, 3): "art:stadium",
	Vector2i(-2, 3): "art:pear_park",
	Vector2i(-3, -2): "art:stanford_tower",
}
## Landmarks standing on a block's lawn, in front of its row of buildings: the campus mascots.
const LAWN_LANDMARKS := {Vector2i(3, -1): "dino_skeleton"}
## The landmarks a player can check in at (打卡, Stamps), clockwise from the north: its picture
## on the 打卡 page, the block it stands on (in LANDMARKS / LAWN_LANDMARKS), its name, a line about
## it, and the small bonus it gives for good once checked in at ([kind, amount], Stamps.BONUSES).
## Since .55 (the user's call) each gives 2% damage, 2% cooldown, +10 luck, 5% pickup range or +5
## health (3%, 3%, 20, 10%, 10 from .44); all five maps' together are about one passive card each.
const STAMPS := {
	"golden_gate": {"art": "golden_gate", "block": Vector2i(0, -5), "name": "金门大桥", "note": "一路往北，走到地图尽头", "bonus": ["might", 0.02]},
	"goggle": {"art": "dino_skeleton", "block": Vector2i(3, -1), "name": "Goggle 园区", "note": "草坪上躺着一副恐龙骨架", "bonus": ["luck", 10.0]},
	# Sailsforce 大厦's place and bonus until .52.
	"stadium": {"art": "stadium", "block": Vector2i(2, 3), "name": "Levy's 球场", "note": "周末看球的地方", "bonus": ["magnet", 0.05]},
	"pear_park": {"art": "pear_park", "block": Vector2i(-2, 3), "name": "Pear 飞碟园区", "note": "一整圈玻璃的飞碟总部", "bonus": ["max_hp", 5.0]},
	"stanford_tower": {"art": "stanford_tower", "block": Vector2i(-3, -2), "name": "胡佛塔", "note": "斯坦福的钟塔，创业故事都从这儿开始", "bonus": ["haste", 0.02]},
}
## Signs that belong to a landmark drawing.
const LANDMARK_BRANDS := {"pear_park": "pear", "stadium": "levys"}
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
	-3: "Skyline Blvd", -2: "I-280", -1: "Alma St", 0: "El Camino Real",
	1: "Middlefield Rd", 2: "US-101", 3: "Shoreline Blvd",
}
## San Francisco's own north-south streets (the peninsula's roads don't run up there).
const NORTH_SOUTH_SF := {-2: "Sunset Blvd", -1: "Divisadero St", 0: "Van Ness Ave", 1: "Embarcadero"}
const EAST_WEST := {
	-4: "Lombard St", -3: "Market St", -2: "Geary Blvd", -1: "Sand Hill Rd", 0: "University Ave",
	1: "California Ave", 2: "Castro St", 3: "Santa Clara St", 4: "Story Rd",
}


static func district_of(block: Vector2i) -> String:
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


## The block column whose road is the row's last before the Bay: none since .52 (no sea), so no
## salt ponds either (City).
static func east_shore_column(_row: int) -> Variant:
	return null


static func east_water_x(_row: int) -> float:
	return INF


## Off the map counts as water (.52): there is no sea, only the edge.
static func is_water(point: Vector2) -> bool:
	return not BOUNDS.has_point(point)


## What of `area` lies off the map, as up to four rects (together exactly is_water): the bands
## north and south of it full width, and west and east of it between them.
static func water_rects(area: Rect2) -> Array[Rect2]:
	var rects: Array[Rect2] = []
	if area.position.y < BOUNDS.position.y:
		rects.append(Rect2(area.position.x, area.position.y, area.size.x, minf(BOUNDS.position.y, area.end.y) - area.position.y))
	if area.end.y > BOUNDS.end.y:
		var south := maxf(BOUNDS.end.y, area.position.y)
		rects.append(Rect2(area.position.x, south, area.size.x, area.end.y - south))
	var top := maxf(area.position.y, BOUNDS.position.y)
	var bottom := minf(area.end.y, BOUNDS.end.y)
	if bottom > top:
		if area.position.x < BOUNDS.position.x:
			rects.append(Rect2(area.position.x, top, minf(BOUNDS.position.x, area.end.x) - area.position.x, bottom - top))
		if area.end.x > BOUNDS.end.x:
			var east := maxf(BOUNDS.end.x, area.position.x)
			rects.append(Rect2(east, top, area.end.x - east, bottom - top))
	return rects


static func freeway_at(column: int, row: int) -> Dictionary:
	var freeway: Dictionary = FREEWAYS.get(column, {})
	if freeway.is_empty() or row < freeway["from_row"]:
		return {}
	return freeway


static func has_railway(row: int) -> bool:
	return row >= RAILWAY_FROM_ROW

