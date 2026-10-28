class_name BayArea
extends RefCounted
## The Silicon Valley stage as data: which district each city block belongs to, what stands
## there, the landmarks, the street names and the parody company signs. City reads it and
## draws; nothing here draws.
##
## Laid out like the real peninsula: the run starts mid-peninsula (Palo Alto / Mountain View),
## San Francisco is up north, San Jose down south, the hills and Sand Hill Road to the west,
## and the Bay to the east, where the land ends in salt ponds and water.

## Block columns at or past this are the Bay shore; block rows at or above / below these are
## San Francisco / San Jose; columns at or before HILLS_COLUMN are the hills.
const SHORE_COLUMN := 3
const SF_ROW := -3
const SJ_ROW := 3
const HILLS_COLUMN := -3
## Where the water starts, a strip of salt ponds past the shore road. Nothing but ghosts goes
## past it. (560 is City.BLOCK.x, spelled out to keep the two classes' constants acyclic.)
const WATER_X := SHORE_COLUMN * 560.0 + 200.0

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
		"brand_chance": 0.5, "tree": "palm", "props": ["bike", "bike_campus", "cone"],
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
		"gap": [36.0, 64.0], "brands": ["envy", "nutflix"], "brand_chance": 0.25, "tree": "palm",
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
	Vector2i(0, -4): "art:transamerica",
	Vector2i(1, -4): "art:sailsforce_tower",
	Vector2i(0, -6): "art:golden_gate",
}
## Signs that belong to a landmark drawing.
const LANDMARK_BRANDS := {"pear_park": "pear", "sailsforce_tower": "sailsforce", "caltrain": "station"}
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
}

## Real street names, roughly where they run. North-south roads by block column, east-west
## roads by block row; anything off the table gets a numbered avenue.
const NORTH_SOUTH := {
	-4: "Skyline Blvd", -3: "Foothill Expy", -2: "I-280", -1: "Alma St", 0: "El Camino Real",
	1: "Middlefield Rd", 2: "US-101", 3: "Shoreline Blvd",
}
const EAST_WEST := {
	-7: "Lombard St", -6: "Marina Blvd", -5: "Haight St", -4: "Market St", -3: "Geary Blvd",
	-2: "Woodside Rd", -1: "Sand Hill Rd", 0: "University Ave", 1: "California Ave",
	2: "Castro St", 3: "Stevens Creek Blvd", 4: "Santa Clara St", 5: "Story Rd",
}


static func district_of(block: Vector2i) -> String:
	if block.x >= SHORE_COLUMN:
		return "bay"
	if block.y <= SF_ROW:
		return "sf"
	if block.y >= SJ_ROW:
		return "sj"
	if block.x <= HILLS_COLUMN:
		return "hills"
	return "peninsula"


static func north_south_name(column: int) -> String:
	return NORTH_SOUTH.get(column, "%s Ave" % _ordinal(absi(column)))


static func east_west_name(row: int) -> String:
	return EAST_WEST.get(row, "%s St" % _ordinal(absi(row)))


static func _ordinal(number: int) -> String:
	var suffix := "th"
	if number % 100 < 11 or number % 100 > 13:
		suffix = {1: "st", 2: "nd", 3: "rd"}.get(number % 10, "th")
	return "%d%s" % [number, suffix]
