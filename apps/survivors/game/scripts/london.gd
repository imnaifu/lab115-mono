class_name London
extends RefCounted
## The London stage (伦敦, .37) as data, under the same names as BayArea, Seattle and Beijing so
## City, Traffic and the rest draw and move through it the same way. Nothing here
## draws.
##
## Squeezed onto the grid at the size the maps have had since .34 (every landmark within about 30
## seconds' walk): the run starts at King's Cross among the AI labs, with Goggle's landscraper
## just north and the station just east; Camden and Baker Street are north-west, the British
## Museum south. The Thames runs east and west right across the map one row further south, as
## water with a bridge on every other street (the river is the map's one obstacle, where the other
## maps have a coast or a lake): Big Ben and the palace on the north bank, the Eye, the Shard and
## Tower Bridge on the south bank, the City and Canary Wharf east of the start, Greenwich across
## the river from them. The Tube runs north and south over London Bridge, two A-roads cross on
## their own bridges, and black cabs and buses drive them.
##
## Open ground since .77, as 硅谷 since .52 (the user: 其余地图参考硅谷，改的空旷点): a square of land
## round the start (BOUNDS) with no river, the districts still where they were (the Thames' row is
## the south bank's), and the only buildings the five check-in spots, big tech's campuses (the
## user: 每个地图的打卡点能不能更像大厂一点): DeepMine in the middle, then Goggle's landscraper,
## Revolout, Barcleys and Deliverhoo on the corners. (Until .76: the Thames with a bridge on every
## other street, rows of buildings on every street, and the city's landmarks to check in at.)

const NAME := "伦敦"
## Second (Maps.ORDER, the user's call) and exactly as hard as 硅谷, so one star too
## (BayArea.STARS); new players still start in 硅谷.
const STARS := 1
const DIFFICULTY := {"hp": 1.0, "damage": 1.0, "spawn": 1.0}
## The civil service's grades: G1, G2…
const RANK_PREFIX := "G"
## Its four bosses, at 2:00, 4:00, 6:00 and 8:00 (.45, BossKits): 委员会（定点）、冗余通知（近战）、GDPR 合规官（远程）、老板递司康（近战 + 定点）.
const BOSSES := ["committee", "redundancy", "gdpr", "scone_boss"]
## The regular enemies, redrawn for London (Game.spawn_enemy swaps them in): 鸽子, 茶包, 签证材料,
## Pub 社交局, 伦敦塔幽灵, 合规流程, 双层巴士, each as strong as the one it replaces.
## The crowd and its rings are Silicon Valley's on every map (.41, the user's call: only the
## bosses are the map's own; .36-.40 swapped the seven regular enemies and the rings for local
## ones, whose types stay in Spawner.ENEMY_TYPES unused).
const MOB_SWAPS := {}
## The Bug outbreak is a queue here: a ring of patient Britons.
const RING_SWAPS := {}
## The map's weather (MapEvents): 伦敦大雾 (you only see round yourself, and the crowd slows down in it).
const MAP_EVENT := {"id": "fog", "at": 300.0, "seconds": 20.0, "text": "伦敦起大雾了！看不远，怪也走得慢",
	"name": "伦敦大雾", "hint": "只看得清身边，怪也走得慢"}
## The district whose office blocks line a company campus wherever it stands (City._place_row).
const CAMPUS_DISTRICT := "kx"
## The map (.77), as BayArea.BOUNDS: a square 2300 out every way from the start. Outside it counts
## as water (is_water, water_rects), so everything stays inside, and City draws it as the edge.
const BOUNDS := Rect2(-2020.0, -2120.0, 4600.0, 4600.0)
## Only the check-in spots stand, and trees don't block (City).
const OPEN_GROUND := true
## The named part of the world (the minimap showed it until .44): the map itself since .77.
const OVERVIEW := BOUNDS
## Spelled out rather than City.BLOCK, to keep the classes' constants acyclic (as in BayArea).
const BLOCK_SIZE := Vector2(560.0, 400.0)
## Rows at or past SOUTH_ROW are south of the river (the Thames ran along it until .77).
const SOUTH_ROW := 2
## Two A-roads, by block column (on bridges of their own until .77); `north` / `south` are where the green
## signs point. Baker Street really is the A41, Tower Bridge Road the A100.
const FREEWAYS := {
	-3: {"number": "A41", "shield": "shield_uk", "from_row": -12, "north": "Watford", "south": "Marble Arch"},
	3: {"number": "A100", "shield": "shield_uk", "from_row": -12, "north": "The City", "south": "Old Kent Rd"},
}
## The Tube, beside City Rd (over London Bridge until .77).
const RAILWAY_COLUMN := 1
const RAILWAY_FROM_ROW := -12
## The railway runs on south for ever (Singapore's ends on Sentosa).
const RAILWAY_TO_ROW := 1000
## What drives the A-roads and the railway (Traffic): black cabs and buses, and the Tube.
const VEHICLES := ["cab_top", "bus_top"]
const TRAIN := "tube_top"
## No salt ponds and no airport here.
const SALT_POND_FROM_ROW := 1000
const RUNWAYS: Array[Vector2i] = []

## Per district, as in BayArea.DISTRICTS. Since .77 (open ground) at most a bush and a tree a
## block; the river's row is the south bank's. Plane trees everywhere; red phone boxes, pillar boxes
## and gas lamps on the pavements. `icon` is drawn by the district's name in the HUD.
const DISTRICTS := {
	"kx": {
		"name": "国王十字", "icon": "kings_cross",
		"ground": Color("dde9cf"),
		"structures": ["soco:office", "soco:midrise_bands", "soco:midrise_grid", "soco:office_block", "soco:commercial"],
		"gap": [36.0, 70.0], "brands": ["deepmine", "goggle", "revolout", "monzzo", "deliverhoo"],
		"brand_chance": 0.8, "tree": "plane_tree", "props": ["phone_box", "post_box", "gas_lamp", "bike"],
		"bushes": [0, 1], "lawn_trees": [0, 1], "park_chance": 0.15,
		"decor": [["tuft", 12.0], ["flower", 11.0], ["tuft", 12.0]],
	},
	"camden": {
		"name": "卡姆登", "icon": "camden_lock",
		"ground": Color("e6e2d0"),
		"structures": ["art:terrace_brick", "art:terrace_cream", "art:terrace_brick", "soco:shop_1", "soco:shop_2", "soco:small_3"],
		"gap": [36.0, 52.0], "brands": ["tesgo", "deliverhoo"], "brand_chance": 0.25, "tree": "plane_tree",
		"props": ["phone_box", "post_box", "gas_lamp"], "bushes": [0, 1], "lawn_trees": [0, 1], "park_chance": 0.15,
		"decor": [["tuft", 12.0], ["flower_pink", 11.0]],
	},
	"westend": {
		"name": "西区", "icon": "big_ben",
		"ground": Color("e3e8da"),
		"structures": ["art:terrace_cream", "art:terrace_cream", "soco:midrise_grid", "soco:commercial", "soco:shop_1", "soco:shop_2"],
		"gap": [36.0, 56.0], "brands": ["tesgo", "barcleys", "monzzo"], "brand_chance": 0.4, "tree": "plane_tree",
		"props": ["phone_box", "gas_lamp", "post_box"], "bushes": [0, 1], "lawn_trees": [0, 1], "park_chance": 0.2,
		"decor": [["flower", 11.0], ["tuft", 12.0]],
	},
	"city": {
		"name": "金融城", "icon": "gherkin",
		"ground": Color("e2e5e0"),
		"structures": ["soco:office_block", "soco:midrise_grid", "soco:midrise_bands", "soco:office", "soco:commercial"],
		"gap": [36.0, 60.0], "brands": ["barcleys", "hsbb", "revolout", "monzzo"], "brand_chance": 0.7,
		"tree": "plane_tree", "props": ["phone_box", "post_box", "gas_lamp"], "bushes": [0, 1], "lawn_trees": [0, 1],
		"park_chance": 0.08, "decor": [["tuft", 12.0]],
	},
	# The river's row: the embankments either side of the Thames, and the water between them.
	"southbank": {
		"name": "南岸", "icon": "shard",
		"ground": Color("e0e8d4"),
		"structures": ["art:terrace_brick", "soco:small_1", "soco:small_2", "soco:shop_1", "soco:convenience_store", "soco:midrise_bands"],
		"gap": [36.0, 64.0], "brands": ["tesgo", "deliverhoo"], "brand_chance": 0.3, "tree": "plane_tree",
		"props": ["post_box", "phone_box", "bike"], "bushes": [0, 1], "lawn_trees": [0, 1], "park_chance": 0.2,
		"decor": [["tuft", 12.0], ["flower", 11.0]],
	},
	"greenwich": {
		"name": "格林尼治", "icon": "greenwich",
		"ground": Color("dcefc6"),
		"structures": ["art:terrace_brick", "soco:small_1", "soco:small_4"],
		"gap": [60.0, 140.0], "brands": [], "brand_chance": 0.0, "tree": "plane_tree",
		"props": ["gas_lamp"], "bushes": [0, 1], "lawn_trees": [0, 1], "park_chance": 0.5,
		"decor": [["flower", 11.0], ["tuft", 12.0], ["flower_pink", 11.0]],
	},
}

## One-off landmarks by block, as in BayArea.LANDMARKS: since .77 only the check-in spots, where
## BayArea has its (the middle one the block south of the start, the rest near the corners).
const LANDMARKS := {
	Vector2i(0, 1): "brand_row:deepmine",
	Vector2i(-3, -5): "art:landscraper",
	Vector2i(3, -5): "brand_row:revolout",
	Vector2i(3, 4): "brand_row:barcleys",
	Vector2i(-3, 4): "brand_row:deliverhoo",
}
## The campuses' logo statues on the lawn (tools/make_logo_statues.py).
const LAWN_LANDMARKS := {
	Vector2i(0, 1): "statue_pickaxe",
	Vector2i(3, -5): "statue_card",
	Vector2i(3, 4): "statue_bank",
	Vector2i(-3, 4): "statue_kangaroo",
}
## Signs that belong to a landmark drawing: Goggle's on its landscraper.
const LANDMARK_BRANDS := {"landscraper": "goggle"}
const SOLID_SPANS := {}

## Landmarks to check in at (打卡), as in BayArea.STAMPS, in the order they open (the middle one,
## then the corners clockwise from the north-west); ids start ldn_ so they never clash with
## another map's in the save. The ids are the save's, so they stay when a spot changes (.77:
## ldn_kings_cross is DeepMine, ldn_museum Goggle, ldn_tower_bridge Revolout, ldn_canary Barcleys,
## ldn_big_ben Deliverhoo; until then 国王十字站, 大英博物馆, 伦敦塔桥, 金丝雀码头, 大本钟).
const STAMPS := {
	"ldn_kings_cross": {"art": "icon_pickaxe", "block": Vector2i(0, 1), "name": "DeepMine", "note": "AI 实验室，下棋没输过", "bonus": ["luck", 10.0]},
	"ldn_museum": {"art": "landscraper", "block": Vector2i(-3, -5), "name": "Goggle 地景楼", "note": "躺平的摩天楼，楼顶是花园", "bonus": ["magnet", 0.05]},
	"ldn_tower_bridge": {"art": "icon_card", "block": Vector2i(3, -5), "name": "Revolout 总部", "note": "一张卡走遍全世界", "bonus": ["max_hp", 5.0]},
	"ldn_canary": {"art": "icon_bank", "block": Vector2i(3, 4), "name": "Barcleys 大楼", "note": "老银行，柱子比人多", "bonus": ["might", 0.02]},
	"ldn_big_ben": {"art": "icon_kangaroo", "block": Vector2i(-3, 4), "name": "Deliverhoo 总部", "note": "门口停满了外卖电驴", "bonus": ["haste", 0.02]},
}

## Parody companies, as in BayArea.BRANDS.
const BRANDS := {
	"deepmine": {"text": "DeepMine", "icon": "icon_pickaxe", "color": Color("2f6fb0")},
	"goggle": {"text": "Goggle", "icon": "icon_goggles", "color": Color("3f7fe0")},
	"revolout": {"text": "Revolout", "icon": "icon_card", "color": Color("2f3542")},
	"monzzo": {"text": "Monzzo", "color": Color("ff6a5c")},
	"deliverhoo": {"text": "Deliverhoo", "icon": "icon_kangaroo", "color": Color("1fb5a5")},
	"tesgo": {"text": "Tesgo", "color": Color("1f4fa3")},
	"barcleys": {"text": "Barcleys", "icon": "icon_bank", "color": Color("2f9ad6")},
	"hsbb": {"text": "HSBB", "color": Color("d63a2f")},
	"station": {"text": "King's Cross", "color": Color("2f3542")},
	"camden": {"text": "Camden Lock", "color": Color("8c4fd6")},
	"baker": {"text": "221B", "color": Color("2f3542")},
}

## Real road names, roughly where they run, as in BayArea; anything off the tables is one of the
## everyday names every English town has (COMMON_NAMES). (Until .77 an odd column's street was
## its bridge across the river's row.)
const NORTH_SOUTH := {
	-4: "Edgware Rd", -3: "Baker St", -2: "Regent St", -1: "Tottenham Court Rd", 0: "Gray's Inn Rd",
	1: "City Rd", 2: "Bishopsgate", 3: "Tower Bridge Rd", 4: "Commercial Rd", 5: "Westferry Rd",
}
const EAST_WEST := {
	-3: "Prince of Wales Rd", -2: "Parkway", -1: "Pentonville Rd", 0: "Euston Rd", 1: "High Holborn",
	2: "Victoria Embankment", 3: "South Bank", 4: "Old Kent Rd", 5: "Walworth Rd",
}
const COMMON_NAMES := ["High St", "Church Rd", "Station Rd", "Park Rd", "Victoria Rd", "Green Lane",
	"Manor Rd", "Queen's Rd", "King St", "Mill Lane", "New Rd", "Albert Rd"]

## Height in logical pixels of each drawing used here, as in BayArea.HEIGHTS.
const HEIGHTS := {
	"kings_cross": 80.0, "landscraper": 70.0, "british_museum": 90.0, "camden_lock": 80.0,
	"baker_street": 80.0, "big_ben": 190.0, "london_eye": 160.0, "buckingham": 80.0, "shard": 200.0,
	"gherkin": 150.0, "tower_bridge": 150.0, "canary_wharf": 180.0, "greenwich": 80.0,
	"terrace_brick": 74.0, "terrace_cream": 74.0,
	"plane_tree": 84.0, "bush": 23.0,
	"statue_pickaxe": 76.0, "statue_card": 76.0, "statue_bank": 76.0, "statue_kangaroo": 76.0,
	"bike": 22.0, "phone_box": 36.0, "post_box": 24.0, "gas_lamp": 40.0,
}


static func district_of(block: Vector2i) -> String:
	if block.y >= SOUTH_ROW:
		return "greenwich" if block.x >= 2 else "southbank"
	if block.y <= -2 or (block.y == -1 and block.x <= -1):
		return "camden"
	if block.x <= -1:
		return "westend"
	if block.x >= 2 or (block.x == 1 and block.y >= 1):
		return "city"
	return "kx"


static func north_south_name(column: int, _row: int = 0) -> String:
	return NORTH_SOUTH.get(column, COMMON_NAMES[posmod(column * 5 + 3, COMMON_NAMES.size())])


static func east_west_name(row: int) -> String:
	return EAST_WEST.get(row, COMMON_NAMES[posmod(row * 7 + 1, COMMON_NAMES.size())])


## No coast at all: City asks, for the salt ponds and the beach.
static func east_shore_column(_row: int) -> Variant:
	return null


static func east_water_x(_row: int) -> float:
	return INF


## Off the map counts as water (.77, as BayArea): there is no river, only the edge.
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
