class_name London
extends RefCounted
## The London stage (伦敦, .37) as data, under the same names as BayArea, Seattle and Beijing so
## City, Traffic, the minimap and the rest draw and move through it the same way. Nothing here
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

const NAME := "伦敦"
## 955: nine to five, five days, the hours the "955 不加班" list of employers is named after. The
## one map out of its working week's order (Maps.ORDER, the user's call): it comes second, after
## 硅谷, and is exactly as hard, so new players still start in 硅谷.
const HOURS := "955"
const DIFFICULTY := {"hp": 1.0, "damage": 1.0, "spawn": 1.0}
## The civil service's grades: G1, G2…
const RANK_PREFIX := "G"
## Local bosses in place of Silicon Valley's, slot for slot (each as strong as the one it
## replaces; Spawner._plan_events): 下午茶, 冗余通知, 周五 Pub 时间, GDPR 合规官, Cookie 弹窗,
## 跨时区会议, 欧盟罚单, and the three every map has its own of since .36: 地铁信号故障, 委员会
## (falling apart into 小委员会), 老板递司康.
const BOSS_SWAPS := {
	"techdebt_elite": "tea_time", "layoff": "redundancy", "deadline": "pub_time", "investor": "gdpr",
	"ai": "cookie_popup", "scope_change": "timezone_call", "incident": "eu_fine",
	"server_elite": "signal_failure", "spaghetti": "committee", "pie_boss": "scone_boss",
}
## The regular enemies, redrawn for London (Game.spawn_enemy swaps them in): 鸽子, 茶包, 签证材料,
## Pub 社交局, 伦敦塔幽灵, 合规流程, 双层巴士, each as strong as the one it replaces.
const MOB_SWAPS := {
	"ping": "pigeon", "bug": "teabag", "mail": "visa_form", "meeting": "pub_invite",
	"ghost": "tower_ghost", "techdebt": "compliance", "server": "double_decker",
}
## The Bug outbreak is a queue here: a ring of patient Britons.
const RING_SWAPS := {"bug": {"type": "queue_brit", "text": "排队！英国人把你围成了一圈"},
	"ping": {"type": "pigeon", "text": "鸽子群来了！"}, "ghost": {"type": "tower_ghost", "text": "伦敦塔幽灵合围！"}}
const FINALE_LINE := "最后的考验：老板递司康 + Cookie 弹窗"
## The map's own guest boss and event (BayArea.GUEST_BOSS says how): 监控探头 (a camera beam sweeps
## round it; stay in it a moment and it snaps you) and 伦敦大雾 (you only see round yourself, and
## the crowd slows down in it).
const GUEST_BOSS := {"type": "cctv", "at": 330.0}
const MAP_EVENT := {"id": "fog", "at": 280.0, "seconds": 20.0, "text": "伦敦起大雾了！看不远，怪也走得慢",
	"name": "伦敦大雾", "hint": "只看得清身边，怪也走得慢"}
## The district whose office blocks line a company campus wherever it stands (City._place_row).
const CAMPUS_DISTRICT := "kx"
## The named part of the world for the minimap, in world pixels: from Baker Street to Canary
## Wharf, from Camden to Greenwich.
const OVERVIEW := Rect2(-1500.0, -1000.0, 4100.0, 3000.0)
## Spelled out rather than City.BLOCK, to keep the classes' constants acyclic (as in BayArea).
const BLOCK_SIZE := Vector2(560.0, 400.0)
## The Thames: the water across RIVER_ROW between RIVER_TOP and RIVER_BOTTOM, with land along
## either bank under the embankment roads. Every odd column's street crosses it on a bridge;
## the rest stop at the water.
const RIVER_ROW := 2
const RIVER_TOP := RIVER_ROW * 400.0 + 110.0
const RIVER_BOTTOM := RIVER_ROW * 400.0 + 290.0
## How far a bridge reaches either side of its street's centre: past the sidewalks, and the sand
## City draws round the water (12) still clear of them. A freeway's is wider, and the railway's
## bridge carries the track east of its street too (City.RAILWAY_OFFSET 44 + RAILWAY_HALF 9).
const BRIDGE_HALF := 40.0
const FREEWAY_BRIDGE_HALF := 56.0
const RAILWAY_BRIDGE_EAST := 70.0
## Two A-roads, by block column, on bridges of their own; `north` / `south` are where the green
## signs point. Baker Street really is the A41, Tower Bridge Road the A100.
const FREEWAYS := {
	-3: {"number": "A41", "shield": "shield_uk", "from_row": -12, "north": "Watford", "south": "Marble Arch"},
	3: {"number": "A100", "shield": "shield_uk", "from_row": -12, "north": "The City", "south": "Old Kent Rd"},
}
## The Tube, beside City Rd and over London Bridge.
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

## Per district, as in BayArea.DISTRICTS. Plane trees everywhere; red phone boxes, pillar boxes
## and gas lamps on the pavements. `icon` is drawn by the district's name under the minimap.
const DISTRICTS := {
	"kx": {
		"name": "国王十字", "icon": "kings_cross",
		"ground": Color("dde9cf"),
		"structures": ["soco:office", "soco:midrise_bands", "soco:midrise_grid", "soco:office_block", "soco:commercial"],
		"gap": [36.0, 70.0], "brands": ["deepmine", "goggle", "revolout", "monzzo", "deliverhoo"],
		"brand_chance": 0.8, "tree": "plane_tree", "props": ["phone_box", "post_box", "gas_lamp", "bike"],
		"bushes": [2, 4], "lawn_trees": [0, 2], "park_chance": 0.15,
		"decor": [["tuft", 12.0], ["flower", 11.0], ["tuft", 12.0]],
	},
	"camden": {
		"name": "卡姆登", "icon": "camden_lock",
		"ground": Color("e6e2d0"),
		"structures": ["art:terrace_brick", "art:terrace_cream", "art:terrace_brick", "soco:shop_1", "soco:shop_2", "soco:small_3"],
		"gap": [36.0, 52.0], "brands": ["tesgo", "deliverhoo"], "brand_chance": 0.25, "tree": "plane_tree",
		"props": ["phone_box", "post_box", "gas_lamp"], "bushes": [1, 3], "lawn_trees": [0, 1], "park_chance": 0.15,
		"decor": [["tuft", 12.0], ["flower_pink", 11.0]],
	},
	"westend": {
		"name": "西区", "icon": "big_ben",
		"ground": Color("e3e8da"),
		"structures": ["art:terrace_cream", "art:terrace_cream", "soco:midrise_grid", "soco:commercial", "soco:shop_1", "soco:shop_2"],
		"gap": [36.0, 56.0], "brands": ["tesgo", "barcleys", "monzzo"], "brand_chance": 0.4, "tree": "plane_tree",
		"props": ["phone_box", "gas_lamp", "post_box"], "bushes": [1, 3], "lawn_trees": [0, 1], "park_chance": 0.2,
		"decor": [["flower", 11.0], ["tuft", 12.0]],
	},
	"city": {
		"name": "金融城", "icon": "gherkin",
		"ground": Color("e2e5e0"),
		"structures": ["soco:office_block", "soco:midrise_grid", "soco:midrise_bands", "soco:office", "soco:commercial"],
		"gap": [36.0, 60.0], "brands": ["barcleys", "hsbb", "revolout", "monzzo"], "brand_chance": 0.7,
		"tree": "plane_tree", "props": ["phone_box", "post_box", "gas_lamp"], "bushes": [1, 2], "lawn_trees": [0, 1],
		"park_chance": 0.08, "decor": [["tuft", 12.0]],
	},
	# The river's row: the embankments either side of the Thames, and the water between them.
	"thames": {
		"name": "泰晤士河", "icon": "tower_bridge",
		"ground": Color("e6e2d6"),
		"structures": [], "gap": [0.0, 0.0], "brands": [], "brand_chance": 0.0, "tree": "",
		"props": [], "bushes": [0, 0], "lawn_trees": [0, 0], "park_chance": 1.0,
		"decor": [["tuft", 12.0]],
	},
	"southbank": {
		"name": "南岸", "icon": "shard",
		"ground": Color("e0e8d4"),
		"structures": ["art:terrace_brick", "soco:small_1", "soco:small_2", "soco:shop_1", "soco:convenience_store", "soco:midrise_bands"],
		"gap": [36.0, 64.0], "brands": ["tesgo", "deliverhoo"], "brand_chance": 0.3, "tree": "plane_tree",
		"props": ["post_box", "phone_box", "bike"], "bushes": [2, 3], "lawn_trees": [0, 2], "park_chance": 0.2,
		"decor": [["tuft", 12.0], ["flower", 11.0]],
	},
	"greenwich": {
		"name": "格林尼治", "icon": "greenwich",
		"ground": Color("dcefc6"),
		"structures": ["art:terrace_brick", "soco:small_1", "soco:small_4"],
		"gap": [60.0, 140.0], "brands": [], "brand_chance": 0.0, "tree": "plane_tree",
		"props": ["gas_lamp"], "bushes": [2, 4], "lawn_trees": [2, 4], "park_chance": 0.5,
		"decor": [["flower", 11.0], ["tuft", 12.0], ["flower_pink", 11.0]],
	},
}

## One-off landmarks by block, as in BayArea.LANDMARKS.
const LANDMARKS := {
	# Where a run starts: the AI lab's campus round the first screen, a bank's beside it.
	Vector2i(0, 0): "brand_row:deepmine",
	Vector2i(-1, 0): "brand_row:monzzo",
	Vector2i(0, -1): "art:landscraper",
	Vector2i(1, 0): "art:kings_cross",
	Vector2i(1, -1): "brand_row:revolout",
	Vector2i(-1, -1): "art:camden_lock",
	Vector2i(-2, -1): "art:baker_street",
	Vector2i(0, 1): "art:british_museum",
	# On the north bank, looking out over the Thames.
	Vector2i(-1, 1): "art:big_ben",
	Vector2i(-2, 1): "art:buckingham",
	Vector2i(1, 1): "art:gherkin",
	Vector2i(2, 1): "brand_row:barcleys",
	Vector2i(3, 1): "art:canary_wharf",
	# On the south bank, the river behind them.
	Vector2i(-1, 2): "art:london_eye",
	Vector2i(1, 2): "art:shard",
	Vector2i(2, 2): "art:tower_bridge",
	Vector2i(2, 3): "art:greenwich",
}
const LAWN_LANDMARKS := {}
## Signs that belong to a landmark drawing.
const LANDMARK_BRANDS := {"kings_cross": "station", "camden_lock": "camden", "baker_street": "baker"}
## Tower Bridge's towers block, the deck between them is walked under (as the Golden Gate's).
const SOLID_SPANS := {"tower_bridge": [[0.22, 0.28], [0.72, 0.78]]}

## Landmarks to check in at (打卡), as in BayArea.STAMPS; ids start ldn_ so they never clash with
## another map's in the save. Their bonuses add up the same as the other maps'.
const STAMPS := {
	"ldn_kings_cross": {"art": "kings_cross", "block": Vector2i(1, 0), "name": "国王十字站", "note": "站台上有辆推车一半卡进了墙里", "bonus": ["speed", 0.02]},
	"ldn_landscraper": {"art": "landscraper", "block": Vector2i(0, -1), "name": "Goggle 躺楼", "note": "比摩天楼躺平了还长，楼顶是花园", "bonus": ["might", 0.02]},
	"ldn_museum": {"art": "british_museum", "block": Vector2i(0, 1), "name": "大英博物馆", "note": "里面全是别人家的宝贝", "bonus": ["magnet", 0.05]},
	"ldn_camden": {"art": "camden_lock", "block": Vector2i(-1, -1), "name": "卡姆登市场", "note": "屋顶上蹲着一只巨大的靴子", "bonus": ["luck", 10.0]},
	"ldn_baker": {"art": "baker_street", "block": Vector2i(-2, -1), "name": "贝克街 221B", "note": "大侦探的家，线索一个不漏", "bonus": ["magnet", 0.05]},
	"ldn_big_ben": {"art": "big_ben", "block": Vector2i(-1, 1), "name": "大本钟", "note": "五点一响，准时下班", "bonus": ["haste", 0.02]},
	"ldn_eye": {"art": "london_eye", "block": Vector2i(-1, 2), "name": "伦敦眼", "note": "转一圈半小时，正好摸个鱼", "bonus": ["luck", 10.0]},
	"ldn_palace": {"art": "buckingham", "block": Vector2i(-2, 1), "name": "白金汉宫", "note": "卫兵的帽子比人还高", "bonus": ["max_hp", 5.0]},
	"ldn_shard": {"art": "shard", "block": Vector2i(1, 2), "name": "碎片大厦", "note": "一块块玻璃拼出来的尖塔", "bonus": ["might", 0.02]},
	"ldn_gherkin": {"art": "gherkin", "block": Vector2i(1, 1), "name": "小黄瓜", "note": "金融城里最健康的一栋楼", "bonus": ["regen", 0.05]},
	"ldn_tower_bridge": {"art": "tower_bridge", "block": Vector2i(2, 2), "name": "伦敦塔桥", "note": "大船一来，桥面就竖起来", "bonus": ["max_hp", 5.0]},
	"ldn_canary": {"art": "canary_wharf", "block": Vector2i(3, 1), "name": "金丝雀码头", "note": "银行和金融科技的塔楼群", "bonus": ["might", 0.03]},
	"ldn_greenwich": {"art": "greenwich", "block": Vector2i(2, 3), "name": "格林尼治天文台", "note": "一脚东半球，一脚西半球", "bonus": ["haste", 0.02]},
}

## Parody companies, as in BayArea.BRANDS.
const BRANDS := {
	"deepmine": {"text": "DeepMine", "icon": "icon_pickaxe", "color": Color("2f6fb0")},
	"goggle": {"text": "Goggle", "icon": "icon_goggles", "color": Color("3f7fe0")},
	"revolout": {"text": "Revolout", "color": Color("2f3542")},
	"monzzo": {"text": "Monzzo", "color": Color("ff6a5c")},
	"deliverhoo": {"text": "Deliverhoo", "icon": "icon_kangaroo", "color": Color("1fb5a5")},
	"tesgo": {"text": "Tesgo", "color": Color("1f4fa3")},
	"barcleys": {"text": "Barcleys", "color": Color("2f9ad6")},
	"hsbb": {"text": "HSBB", "color": Color("d63a2f")},
	"station": {"text": "King's Cross", "color": Color("2f3542")},
	"camden": {"text": "Camden Lock", "color": Color("8c4fd6")},
	"baker": {"text": "221B", "color": Color("2f3542")},
}

## Real road names, roughly where they run, as in BayArea. Across the river's row an odd
## column's street is its bridge (BRIDGES); anything off the tables is one of the everyday names
## every English town has (COMMON_NAMES).
const NORTH_SOUTH := {
	-4: "Edgware Rd", -3: "Baker St", -2: "Regent St", -1: "Tottenham Court Rd", 0: "Gray's Inn Rd",
	1: "City Rd", 2: "Bishopsgate", 3: "Tower Bridge Rd", 4: "Commercial Rd", 5: "Westferry Rd",
}
const BRIDGES := {
	-5: "Chelsea Bridge", -3: "Vauxhall Bridge", -1: "Westminster Bridge", 1: "London Bridge",
	3: "Tower Bridge", 5: "QEII Bridge",
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
	"bike": 22.0, "phone_box": 36.0, "post_box": 24.0, "gas_lamp": 40.0,
}


static func district_of(block: Vector2i) -> String:
	if block.y == RIVER_ROW:
		return "thames"
	if block.y > RIVER_ROW:
		return "greenwich" if block.x >= 2 else "southbank"
	if block.y <= -2 or (block.y == -1 and block.x <= -1):
		return "camden"
	if block.x <= -1:
		return "westend"
	if block.x >= 2 or (block.x == 1 and block.y >= 1):
		return "city"
	return "kx"


static func north_south_name(column: int, row: int = 0) -> String:
	if row == RIVER_ROW and _bridge_at(column):
		return BRIDGES.get(column, "Thames Bridge")
	return NORTH_SOUTH.get(column, COMMON_NAMES[posmod(column * 5 + 3, COMMON_NAMES.size())])


static func east_west_name(row: int) -> String:
	return EAST_WEST.get(row, COMMON_NAMES[posmod(row * 7 + 1, COMMON_NAMES.size())])


## No coast at all: City asks, for the salt ponds and the beach.
static func east_shore_column(_row: int) -> Variant:
	return null


static func east_water_x(_row: int) -> float:
	return INF


## Whether the street of `column` crosses the Thames on a bridge.
static func _bridge_at(column: int) -> bool:
	return posmod(column, 2) == 1


## How far a bridge reaches west and east of its street's centre line.
static func _bridge_reach(column: int) -> Vector2:
	var half := FREEWAY_BRIDGE_HALF if FREEWAYS.has(column) else BRIDGE_HALF
	return Vector2(half, maxf(half, RAILWAY_BRIDGE_EAST) if column == RAILWAY_COLUMN else half)


static func is_water(point: Vector2) -> bool:
	if point.y <= RIVER_TOP or point.y >= RIVER_BOTTOM:
		return false
	var column := roundi(point.x / BLOCK_SIZE.x)
	if not _bridge_at(column):
		return true
	var reach := _bridge_reach(column)
	var offset := point.x - column * BLOCK_SIZE.x
	return offset <= -reach.x or offset >= reach.y


## The water inside `area` as rects (together exactly is_water): the river's band, cut at each
## bridge.
static func water_rects(area: Rect2) -> Array[Rect2]:
	var rects: Array[Rect2] = []
	var band := Rect2(area.position.x, RIVER_TOP, area.size.x, RIVER_BOTTOM - RIVER_TOP).intersection(area)
	if not band.has_area():
		return rects
	var from_x := band.position.x
	for column in range(floori(band.position.x / BLOCK_SIZE.x), ceili(band.end.x / BLOCK_SIZE.x) + 1):
		if not _bridge_at(column):
			continue
		var reach := _bridge_reach(column)
		var west := column * BLOCK_SIZE.x - reach.x
		var east := column * BLOCK_SIZE.x + reach.y
		if east <= band.position.x:
			continue
		if west >= band.end.x:
			break
		if west > from_x:
			rects.append(Rect2(from_x, band.position.y, west - from_x, band.size.y))
		from_x = maxf(from_x, east)
	if from_x < band.end.x:
		rects.append(Rect2(from_x, band.position.y, band.end.x - from_x, band.size.y))
	return rects


static func freeway_at(column: int, row: int) -> Dictionary:
	var freeway: Dictionary = FREEWAYS.get(column, {})
	if freeway.is_empty() or row < freeway["from_row"]:
		return {}
	return freeway


static func has_railway(row: int) -> bool:
	return row >= RAILWAY_FROM_ROW
