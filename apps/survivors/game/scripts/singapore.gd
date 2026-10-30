class_name Singapore
extends RefCounted
## The Singapore stage (新加坡, .38) as data, under the same names as BayArea and the rest so City,
## Traffic, the minimap and the rest draw and move through it the same way. Nothing here draws.
##
## Squeezed onto the grid at the size every map has (every landmark within about 30 seconds'
## walk): the run starts at one-north among the e-commerce campuses, with the university to the
## west and the HDB heartlands round them; east are Chinatown, Lau Pa Sat and the CBD, with Clarke
## Quay and Little India up north and Marina Bay, a bay of water bridged twice, past the CBD, the
## Merlion on its west shore and Marina Bay Sands, the supertrees and (squeezed in) Jewel on its
## east. South is a strip of beach and then the sea; Sentosa is an island out in it, joined by one
## bridge that carries the road and the Sentosa line. Two expressways run north and south, with
## ride-hailing cars on them.

const NAME := "新加坡"
## 985: nine to eight, five days, and the late calls with headquarters on top. Between 西雅图's
## 975 and 北京's 996 (Maps.ORDER), with 深圳 and 班加罗尔 still to come between it and 北京.
const HOURS := "985"
const DIFFICULTY := {"hp": 1.19, "damage": 1.13, "spawn": 1.09}
## The American giants' Asia-Pacific offices' levels: L1, L2…
const RANK_PREFIX := "L"
## Local bosses in place of Silicon Valley's, slot for slot (each as strong as the one it
## replaces; Spawner._plan_events): 房租, 午后雷暴, 亚太区优化, EP 到期, 出海公司, 家族办公室, 表格
## (falling apart into 小表格), 空降老板, 罚款通知, 老板画咖椰吐司.
const BOSS_SWAPS := {
	"techdebt_elite": "rent", "layoff": "apac_cut", "deadline": "ep_expiry", "investor": "family_office",
	"ai": "going_overseas", "scope_change": "parachute_boss", "incident": "fine_notice",
	"server_elite": "thunderstorm", "spaghetti": "forms", "pie_boss": "kaya_boss",
}
## The regular enemies, redrawn for Singapore (Game.spawn_enemy swaps them in): 蚊子, 壁虎, Grub
## 外卖单, 跨时区对齐会, 中元节饿鬼, COE 拥车证, 榴莲, each as strong as the one it replaces.
const MOB_SWAPS := {
	"ping": "mosquito", "bug": "gecko", "mail": "grub_order", "meeting": "align_call",
	"ghost": "hungry_ghost", "techdebt": "coe", "server": "durian",
}
## The Bug outbreak is the hawker centre at lunch: every seat round you reserved with tissues.
const RING_SWAPS := {"bug": {"type": "tissue_chope", "text": "纸巾占座！一圈座位全被占了"},
	"ping": {"type": "mosquito", "text": "蚊子群来了！"}, "ghost": {"type": "hungry_ghost", "text": "中元节饿鬼合围！"}}
const FINALE_LINE := "最后的考验：老板画咖椰吐司 + 出海公司"
## The map's own guest boss and event (BayArea.GUEST_BOSS says how): 罚款执法官 (a red light over
## the player: still walking when it's lit gets you fined) and 热浪 (out in the heat you lose
## health; cool air-conditioned spots appear round you).
const GUEST_BOSS := {"type": "fine_officer", "at": 330.0}
const MAP_EVENT := {"id": "heat", "at": 290.0, "seconds": 20.0, "text": "热浪来了！外面待着会掉血，躲进冷气里",
	"name": "热浪", "hint": "躲进蓝色冷气圈，外面会掉血"}
## The district whose office blocks line a company campus wherever it stands (City._place_row).
const CAMPUS_DISTRICT := "onenorth"
## The named part of the world for the minimap, in world pixels: from the university to Jewel,
## from Little India to Sentosa.
const OVERVIEW := Rect2(-1300.0, -1100.0, 4200.0, 3200.0)
## Spelled out rather than City.BLOCK, to keep the classes' constants acyclic (as in BayArea).
const BLOCK_SIZE := Vector2(560.0, 400.0)
## The coast: the road along the shore runs at the top of COAST_ROW, a beach below it, and past
## SEA_Y the sea (south for ever), but for Sentosa (ISLAND) and the bridge out to it (BRIDGE,
## along column 0's road, wide enough for the railway beside it).
const COAST_ROW := 3
const SEA_Y := COAST_ROW * 400.0 + 160.0
const ISLAND := Rect2(-480.0, 1500.0, 1000.0, 460.0)
const BRIDGE := Rect2(-40.0, SEA_Y, 110.0, 1500.0 - SEA_Y)
## The blocks Sentosa stands on (its district).
const ISLAND_BLOCKS: Array[Vector2i] = [Vector2i(-1, 3), Vector2i(0, 3), Vector2i(-1, 4), Vector2i(0, 4)]
## Marina Bay: water down BAY_COLUMN's blocks from just below row 1's road to the sea, crossed by
## row 2's road (the Helix Bridge) and the coast road (the barrage).
const BAY_COLUMN := 2
const BAY := Rect2(1160.0, 440.0, 464.0, SEA_Y - 440.0)
const BAY_BRIDGES: Array[Vector2] = [Vector2(760.0, 840.0), Vector2(1160.0, 1240.0)]
## Two expressways, by block column; `north` / `south` are where the green signs point.
const FREEWAYS := {
	1: {"number": "CTE", "shield": "shield_sg", "from_row": -12, "north": "Ang Mo Kio", "south": "Chinatown"},
	3: {"number": "KPE", "shield": "shield_sg", "from_row": -12, "north": "Punggol", "south": "Marina"},
}
## The MRT, beside one-north's road and over the bridge to Sentosa, where it ends.
const RAILWAY_COLUMN := 0
const RAILWAY_FROM_ROW := -12
const RAILWAY_TO_ROW := 3
## What drives the expressways and the railway (Traffic): ride-hailing cars and taxis, and the MRT.
const VEHICLES := ["grub_top", "grub_top", "car_top"]
const TRAIN := "mrt_top"
## No salt ponds and no airport here.
const SALT_POND_FROM_ROW := 1000
const RUNWAYS: Array[Vector2i] = []

## Per district, as in BayArea.DISTRICTS. Rain trees; durian signs, orchids and hawker stalls on
## the pavements. `icon` is drawn by the district's name under the minimap.
const DISTRICTS := {
	"onenorth": {
		"name": "纬壹科技城", "icon": "one_north",
		"ground": Color("d7ecd0"),
		"structures": ["soco:office", "soco:midrise_bands", "soco:midrise_grid", "soco:office_block", "soco:commercial"],
		"gap": [36.0, 70.0], "brands": ["shopay", "grub", "tiktak", "razzer"],
		"brand_chance": 0.85, "tree": "rain_tree", "props": ["durian_sign", "orchid_pot", "bike"],
		"bushes": [2, 4], "lawn_trees": [0, 2], "park_chance": 0.15,
		"decor": [["tuft", 12.0], ["flower", 11.0], ["tuft", 12.0]],
	},
	"hdb": {
		"name": "组屋区", "icon": "hdb_block",
		"ground": Color("dfeccd"),
		"structures": ["art:hdb_block", "art:hdb_block", "soco:shop_1", "soco:convenience_store"],
		"gap": [40.0, 70.0], "brands": ["lazado"], "brand_chance": 0.3, "tree": "rain_tree",
		"props": ["hawker_stall", "bike", "durian_sign"], "bushes": [2, 4], "lawn_trees": [1, 2], "park_chance": 0.15,
		"decor": [["flower_pink", 11.0], ["tuft", 12.0]],
	},
	"heritage": {
		"name": "老城区", "icon": "chinatown",
		"ground": Color("ece4d2"),
		"structures": ["art:shophouse_teal", "art:shophouse_pink", "art:shophouse_teal", "art:shophouse_pink", "soco:shop_2"],
		"gap": [36.0, 44.0], "brands": [], "brand_chance": 0.0, "tree": "rain_tree",
		"props": ["hawker_stall", "orchid_pot"], "bushes": [1, 2], "lawn_trees": [0, 1], "park_chance": 0.1,
		"decor": [["flower_pink", 11.0], ["tuft", 12.0]],
	},
	"cbd": {
		"name": "中央商务区", "icon": "raffles_place",
		"ground": Color("e2e7dc"),
		"structures": ["soco:office_block", "soco:midrise_grid", "soco:midrise_bands", "soco:office", "soco:commercial"],
		"gap": [36.0, 60.0], "brands": ["dbb", "tiktak", "lazado", "shopay"], "brand_chance": 0.6,
		"tree": "rain_tree", "props": ["orchid_pot", "durian_sign", "hawker_stall"], "bushes": [1, 2], "lawn_trees": [0, 1],
		"park_chance": 0.1, "decor": [["tuft", 12.0], ["flower", 11.0]],
	},
	"east": {
		"name": "东部", "icon": "jewel",
		"ground": Color("dcefc6"),
		"structures": ["art:hdb_block", "soco:small_1", "soco:small_2", "soco:supermarket"],
		"gap": [40.0, 90.0], "brands": ["grub"], "brand_chance": 0.2, "tree": "rain_tree",
		"props": ["bike", "orchid_pot"], "bushes": [2, 4], "lawn_trees": [1, 3], "park_chance": 0.3,
		"decor": [["flower", 11.0], ["tuft", 12.0], ["flower_pink", 11.0]],
	},
	# Marina Bay's column: the water, and the promenades either side of it.
	"marina": {
		"name": "滨海湾", "icon": "mbs",
		"ground": Color("e6e2d6"),
		"structures": [], "gap": [0.0, 0.0], "brands": [], "brand_chance": 0.0, "tree": "",
		"props": [], "bushes": [0, 0], "lawn_trees": [0, 0], "park_chance": 1.0,
		"decor": [["tuft", 12.0]],
	},
	# The beach along the coast road, and the sea past it.
	"coast": {
		"name": "海滨", "icon": "merlion",
		"ground": Color("f3e5b5"),
		"structures": [], "gap": [0.0, 0.0], "brands": [], "brand_chance": 0.0, "tree": "",
		"props": [], "bushes": [0, 0], "lawn_trees": [0, 0], "park_chance": 1.0,
		"decor": [["tuft", 12.0]],
	},
	# Sentosa: beach and palms (on the landmark; trees dotted on its blocks could land in the sea).
	"sentosa": {
		"name": "圣淘沙", "icon": "sentosa_beach",
		"ground": Color("f3e5b5"),
		"structures": [], "gap": [0.0, 0.0], "brands": [], "brand_chance": 0.0, "tree": "",
		"props": [], "bushes": [0, 0], "lawn_trees": [0, 0], "park_chance": 1.0,
		"decor": [["flower", 11.0], ["tuft", 12.0]],
	},
}

## One-off landmarks by block, as in BayArea.LANDMARKS.
const LANDMARKS := {
	# Where a run starts: an e-commerce campus round the first screen, a ride-hailing one west.
	Vector2i(0, 0): "brand_row:shopay",
	Vector2i(-1, 1): "brand_row:grub",
	Vector2i(-1, -1): "brand_row:lazado",
	Vector2i(2, 0): "brand_row:dbb",
	Vector2i(1, -2): "brand_row:tiktak",
	Vector2i(0, -1): "art:one_north",
	Vector2i(-1, 0): "art:nus_hall",
	Vector2i(0, 1): "art:chinatown",
	Vector2i(1, 0): "art:lau_pa_sat",
	Vector2i(1, 1): "art:raffles_place",
	Vector2i(1, -1): "art:clarke_quay",
	Vector2i(2, -2): "art:little_india",
	# On the coast, looking out to sea, and across the water on Sentosa.
	Vector2i(0, 2): "art:mount_faber",
	Vector2i(0, 3): "art:sentosa_beach",
	# Round Marina Bay: the Merlion on its west shore, the rest on its east.
	Vector2i(1, 2): "art:merlion",
	Vector2i(3, 2): "art:mbs",
	Vector2i(3, 1): "art:supertrees",
	Vector2i(3, -1): "art:jewel",
}
const LAWN_LANDMARKS := {}
## Signs that belong to a landmark drawing.
const LANDMARK_BRANDS := {"one_north": "onenorth_sign", "lau_pa_sat": "lps"}
const SOLID_SPANS := {}

## Landmarks to check in at (打卡), as in BayArea.STAMPS; ids start sg_ so they never clash with
## another map's in the save. Their bonuses add up the same as the other maps'.
const STAMPS := {
	"sg_one_north": {"art": "one_north", "block": Vector2i(0, -1), "name": "纬壹科技城", "note": "几家大厂的亚太总部挤在一起", "bonus": ["haste", 0.02]},
	"sg_nus": {"art": "nus_hall", "block": Vector2i(-1, 0), "name": "国大", "note": "毕业了直接走到隔壁上班", "bonus": ["magnet", 0.05]},
	"sg_mount_faber": {"art": "mount_faber", "block": Vector2i(0, 2), "name": "花柏山", "note": "缆车从这里出发去圣淘沙", "bonus": ["might", 0.02]},
	"sg_sentosa": {"art": "sentosa_beach", "block": Vector2i(0, 3), "name": "圣淘沙", "note": "过了桥就是度假岛", "bonus": ["luck", 10.0]},
	"sg_merlion": {"art": "merlion", "block": Vector2i(1, 2), "name": "鱼尾狮", "note": "狮子头、鱼尾巴，嘴里一直在喷水", "bonus": ["might", 0.02]},
	"sg_mbs": {"art": "mbs", "block": Vector2i(3, 2), "name": "滨海湾金沙", "note": "三栋楼顶着一艘船", "bonus": ["max_hp", 5.0]},
	"sg_supertrees": {"art": "supertrees", "block": Vector2i(3, 1), "name": "超级树", "note": "钢筋做的树，晚上会发光", "bonus": ["regen", 0.05]},
	"sg_lau_pa_sat": {"art": "lau_pa_sat", "block": Vector2i(1, 0), "name": "老巴刹", "note": "写字楼中间的小贩中心，中午排长队", "bonus": ["max_hp", 5.0]},
	"sg_chinatown": {"art": "chinatown", "block": Vector2i(0, 1), "name": "牛车水", "note": "一排排的老店屋，挂满红灯笼", "bonus": ["magnet", 0.05]},
	"sg_clarke_quay": {"art": "clarke_quay", "block": Vector2i(1, -1), "name": "克拉码头", "note": "河边的彩色仓库，下班喝一杯", "bonus": ["speed", 0.02]},
	"sg_little_india": {"art": "little_india", "block": Vector2i(2, -2), "name": "小印度", "note": "全城颜色最多的一栋房子", "bonus": ["haste", 0.02]},
	"sg_raffles": {"art": "raffles_place", "block": Vector2i(1, 1), "name": "莱佛士坊", "note": "银行塔楼围着一块小草坪", "bonus": ["luck", 10.0]},
	"sg_jewel": {"art": "jewel", "block": Vector2i(3, -1), "name": "星耀樟宜", "note": "机场里有一道室内瀑布", "bonus": ["might", 0.03]},
}

## Parody companies, as in BayArea.BRANDS.
const BRANDS := {
	"shopay": {"text": "Shopay", "icon": "icon_bag", "color": Color("ee4d2d")},
	"grub": {"text": "Grub", "icon": "icon_ride", "color": Color("00a94f")},
	"tiktak": {"text": "TikTak", "icon": "icon_note", "color": Color("2f3542")},
	"lazado": {"text": "Lazado", "color": Color("1a2a8e")},
	"dbb": {"text": "DBB", "color": Color("d63a2f")},
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
	"bike": 22.0, "durian_sign": 30.0, "orchid_pot": 22.0, "hawker_stall": 30.0,
}


static func district_of(block: Vector2i) -> String:
	if block.y >= COAST_ROW:
		return "sentosa" if ISLAND_BLOCKS.has(block) else "coast"
	if block.x == BAY_COLUMN and block.y >= 1:
		return "marina"
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


static func is_water(point: Vector2) -> bool:
	if BAY.has_point(point):
		for band: Vector2 in BAY_BRIDGES:
			if point.y > band.x and point.y < band.y:
				return false
		return true
	if point.y <= SEA_Y:
		return false
	return not (ISLAND.has_point(point) or BRIDGE.has_point(point))


## The water inside `area` as rects (together exactly is_water): Marina Bay between its bridges,
## and the sea round Sentosa and its bridge.
static func water_rects(area: Rect2) -> Array[Rect2]:
	var far := 1.0e6
	var pieces: Array[Rect2] = []
	var from_y := BAY.position.y
	for band: Vector2 in BAY_BRIDGES:
		pieces.append(Rect2(BAY.position.x, from_y, BAY.size.x, band.x - from_y))
		from_y = band.y
	pieces.append(Rect2(BAY.position.x, from_y, BAY.size.x, BAY.end.y - from_y))
	# The sea: beside the bridge down to the island, beside the island, and past it.
	var island_top := ISLAND.position.y
	pieces.append(Rect2(-far, SEA_Y, BRIDGE.position.x + far, island_top - SEA_Y))
	pieces.append(Rect2(BRIDGE.end.x, SEA_Y, far, island_top - SEA_Y))
	pieces.append(Rect2(-far, island_top, ISLAND.position.x + far, ISLAND.size.y))
	pieces.append(Rect2(ISLAND.end.x, island_top, far, ISLAND.size.y))
	pieces.append(Rect2(-far, ISLAND.end.y, far * 2.0, far))
	var rects: Array[Rect2] = []
	for piece in pieces:
		var part := piece.intersection(area)
		if part.has_area():
			rects.append(part)
	return rects


static func freeway_at(column: int, row: int) -> Dictionary:
	var freeway: Dictionary = FREEWAYS.get(column, {})
	if freeway.is_empty() or row < freeway["from_row"]:
		return {}
	return freeway


static func has_railway(row: int) -> bool:
	return row >= RAILWAY_FROM_ROW and row <= RAILWAY_TO_ROW
