class_name City
extends Node2D
## The Bay Area around the player: a grid of roads with real street names, districts with
## their own buildings (BayArea), landmarks, parody company signs, the freeways and Caltrain,
## and the water round the peninsula (the Golden Gate, the Pacific and the Bay). Everything is derived from a hash of the block (or cell) coordinates, so the layout
## never visibly repeats and is the same when you walk back.
##
## Ground, roads, rails, salt ponds, the runway and water are flat, so this node draws them
## itself under everything. Buildings, trees, props and signs stand up, so they are spawned per block into
## Game's y-sorted entity layer, where the player walks behind or in front of them.
##
## The base of each building, tree trunks and the water are solid: resolve() pushes a body out
## of them. Only a building's base blocks, so you can walk behind the rest of it (it fades
## while you do). Solids are filed in a coarse grid so each body checks only the few near it.

## soco-st drawings are 1080px canvases; one scale for all keeps their relative sizes.
const BUILDING_SCALE := 0.22

const BLOCK := Vector2(560.0, 400.0)
const ROAD_HALF := 18.0
const SIDEWALK := 8.0
const ASPHALT := Color("c9cdd3")
const PAVEMENT := Color("eef0e8")
const WATER := Color("8fcbe8")
const SAND := Color("f3e5b5")
const SALT_PONDS := [Color("f2a7b8"), Color("f5c28a"), Color("c98a6a"), Color("b8dca0")]
## Freeways are wider and darker than streets, with a double yellow line down the middle.
const FREEWAY_HALF := 34.0
const FREEWAY_ASPHALT := Color("b4b9c1")
const FREEWAY_YELLOW := Color("f2c230")
## The railway beside its street: two rails on sleepers, this far east of the street's centre.
const RAILWAY_OFFSET := 44.0
const RAILWAY_HALF := 9.0
const SLEEPER := Color("a0785a")
const RAIL := Color("6b7280")
## Painted route shields on the freeway, one per block.
const SHIELD_SIZE := 22.0
## The airport's runway, across the middle of its block.
const RUNWAY_HALF := 26.0
const RUNWAY := Color("8e949e")
## The sand between land and water.
const SAND_EDGE := 12.0
## The campus signs on the lawn are the rooftop signs this much bigger.
const CAMPUS_SIGN_SCALE := 1.9

const DECOR_CELL := 32.0
const DECOR_CHANCE := 0.07

## A building the player stands behind fades to this alpha so they never lose sight of it.
const BEHIND_ALPHA := 0.4
## Blocks are kept around the view with this margin, so tall buildings rooted below the screen
## still show their tops.
const BLOCK_MARGIN := 220.0
## Our drawings have a little air around the shape; trim it off their solid rect.
const ART_INSET := 0.08
## How deep a building's solid base is, whatever its height: the strip along its front wall.
## Everything above it is scenery you can walk behind.
const FOOTPRINT_DEPTH := 24.0
## Solid rects are filed in cells of this size, padded by the biggest body radius, so a lookup
## needs only the cell the body's centre is in.
const SOLID_CELL := 64.0
const SOLID_PAD := 20.0
const TRUNK := Vector2(8.0, 7.0)

var game: Game
var follow: Node2D
var seed_value := 0

var _drawn_cell := Vector2i(1 << 30, 0)
var _drawn_view := Vector2.ZERO
var _block_range := Rect2i()
## block -> {"nodes": [...], "solids": [Rect2...], "fading": [[node, drawn rect]...]}
var _blocks := {}
var _fading: Array = []
var _solid_cells := {}
var _missing_warned := false
var _traffic: Traffic


func _process(delta: float) -> void:
	var view_half := game.view_half()
	var cell := Vector2i((follow.position / DECOR_CELL).floor())
	if cell != _drawn_cell or view_half != _drawn_view:
		_drawn_cell = cell
		_drawn_view = view_half
		queue_redraw()
	_update_blocks(view_half)
	_fade_buildings(delta)
	if _traffic == null:
		_traffic = Traffic.new(self, game.entity_layer)
	_traffic.tick(delta, Rect2(follow.position - view_half, view_half * 2.0))


# --- Collision -----------------------------------------------------------------------------

## Where a round body of `radius` centred at `point` ends up once pushed out of buildings,
## trunks and the water. A push out of one rect can land in a neighbour (a trunk beside a
## building), so it repeats until nothing moves.
func resolve(point: Vector2, radius: float) -> Vector2:
	var resolved := point
	for attempt in 3:
		var before := resolved
		resolved = _resolve_once(resolved, radius)
		if resolved == before:
			break
	return resolved


func _resolve_once(point: Vector2, radius: float) -> Vector2:
	var resolved := _out_of_water(point, radius)
	var bucket = _solid_cells.get(Vector2i((resolved / SOLID_CELL).floor()))
	if bucket == null:
		return resolved
	for rect: Rect2 in bucket:
		var closest := resolved.clamp(rect.position, rect.end)
		var offset := resolved - closest
		var distance_sq := offset.length_squared()
		if distance_sq >= radius * radius:
			continue
		if distance_sq > 0.0001:
			resolved = closest + offset / sqrt(distance_sq) * radius
		else:
			resolved = _leave_vertically(rect, resolved, radius)
	return resolved


func is_water(point: Vector2) -> bool:
	return BayArea.is_water(point)


## Pushes a body off the water: out through the nearest shore, whichever way that is.
func _out_of_water(point: Vector2, radius: float) -> Vector2:
	var reach := Rect2(point - Vector2(radius, radius), Vector2(radius, radius) * 2.0)
	if not (BayArea.is_water(reach.position) or BayArea.is_water(reach.end) \
			or BayArea.is_water(Vector2(reach.position.x, reach.end.y)) or BayArea.is_water(Vector2(reach.end.x, reach.position.y)) \
			or BayArea.is_water(point)):
		return point
	var resolved := point
	for water: Rect2 in BayArea.water_rects(reach.grow(BayArea.BLOCK_SIZE.x)):
		var closest := resolved.clamp(water.position, water.end)
		var offset := resolved - closest
		var distance_sq := offset.length_squared()
		if distance_sq >= radius * radius:
			continue
		if distance_sq > 0.0001:
			resolved = closest + offset / sqrt(distance_sq) * radius
		else:
			# Inside: out through the nearest edge.
			var exits := [Vector2(water.position.x - radius, resolved.y), Vector2(water.end.x + radius, resolved.y),
				Vector2(resolved.x, water.position.y - radius), Vector2(resolved.x, water.end.y + radius)]
			var best: Vector2 = exits[0]
			for exit: Vector2 in exits:
				if exit.distance_squared_to(resolved) < best.distance_squared_to(resolved):
					best = exit
			resolved = best
	return resolved


## Every solid rect (building bases, tree trunks) of the loaded blocks that touches `area`,
## for FlowField to mark as walls. The water isn't among them; see BayArea.water_rects.
func solids_in(area: Rect2) -> Array[Rect2]:
	var found: Array[Rect2] = []
	for content: Dictionary in _blocks.values():
		for rect: Rect2 in content["solids"]:
			if rect.intersects(area):
				found.append(rect)
	return found


## A centre already inside a rect (spawned there, or shoved in by the crowd) leaves through the
## nearer of its top and bottom. Never sideways: buildings in a row stand side by side, so a
## sideways exit is the likeliest to land inside the next one.
func _leave_vertically(rect: Rect2, point: Vector2, radius: float) -> Vector2:
	if point.y - rect.position.y < rect.end.y - point.y:
		return Vector2(point.x, rect.position.y - radius)
	return Vector2(point.x, rect.end.y + radius)


func _file_solid(rect: Rect2, add: bool) -> void:
	var padded := rect.grow(SOLID_PAD)
	var first := Vector2i((padded.position / SOLID_CELL).floor())
	var last := Vector2i((padded.end / SOLID_CELL).floor())
	for cell_x in range(first.x, last.x + 1):
		for cell_y in range(first.y, last.y + 1):
			var cell := Vector2i(cell_x, cell_y)
			if add:
				if not _solid_cells.has(cell):
					_solid_cells[cell] = []
				_solid_cells[cell].append(rect)
			elif _solid_cells.has(cell):
				_solid_cells[cell].erase(rect)
				if _solid_cells[cell].is_empty():
					_solid_cells.erase(cell)


# --- Flat ground ---------------------------------------------------------------------------

func _draw() -> void:
	var area := Rect2(follow.position - _drawn_view, _drawn_view * 2.0).grow(DECOR_CELL * 2.0)
	var first := Vector2i((area.position / BLOCK).floor())
	var last := Vector2i((area.end / BLOCK).floor())
	var road_reach := ROAD_HALF + SIDEWALK

	# Each district's ground colour, block by block.
	for block_x in range(first.x, last.x + 1):
		for block_y in range(first.y, last.y + 1):
			var district: Dictionary = BayArea.DISTRICTS[BayArea.district_of(Vector2i(block_x, block_y))]
			draw_rect(Rect2(Vector2(block_x, block_y) * BLOCK, BLOCK), district["ground"])

	_draw_salt_ponds(area, first.y, last.y)
	_draw_runways(first, last)

	# Sidewalks first, then asphalt on top, so crossings join up cleanly. Roads run everywhere;
	# the water is drawn over them afterwards.
	for fill: Array in [[road_reach, PAVEMENT], [ROAD_HALF, ASPHALT]]:
		for row in range(first.y, last.y + 1):
			draw_rect(Rect2(area.position.x, row * BLOCK.y - fill[0], area.size.x, fill[0] * 2.0), fill[1])
		for column in range(first.x, last.x + 1):
			draw_rect(Rect2(column * BLOCK.x - fill[0], area.position.y, fill[0] * 2.0, area.size.y), fill[1])

	# Outlines and lane dashes, broken at every crossing.
	for row in range(first.y, last.y + 1):
		for column in range(first.x - 1, last.x + 1):
			var from := column * BLOCK.x + _road_reach_at(column, row)
			var to := (column + 1) * BLOCK.x - _road_reach_at(column + 1, row)
			if from >= to:
				continue
			var y := row * BLOCK.y
			for edge in [-road_reach, -ROAD_HALF, ROAD_HALF, road_reach]:
				draw_line(Vector2(from, y + edge), Vector2(to, y + edge), Art.INK, 2.0)
			for x in range(int(from) + 10, int(to) - 20, 30):
				draw_rect(Rect2(x, y - 1.5, 15, 3), Color.WHITE)
	for column in range(first.x, last.x + 1):
		var x := column * BLOCK.x
		for row in range(first.y - 1, last.y + 1):
			var from := row * BLOCK.y + road_reach
			var to := (row + 1) * BLOCK.y - road_reach
			var freeway := BayArea.freeway_at(column, row)
			if freeway.is_empty():
				for edge in [-road_reach, -ROAD_HALF, ROAD_HALF, road_reach]:
					draw_line(Vector2(x + edge, from), Vector2(x + edge, to), Art.INK, 2.0)
				for y in range(int(from) + 10, int(to) - 20, 30):
					draw_rect(Rect2(x - 1.5, y, 3, 15), Color.WHITE)
			else:
				_draw_freeway(x, row, freeway)
			if column == BayArea.RAILWAY_COLUMN and BayArea.has_railway(row):
				_draw_railway(x + RAILWAY_OFFSET, row * BLOCK.y + road_reach, (row + 1) * BLOCK.y - road_reach)

	_draw_water(area)

	# Flowers and grass on the lawns.
	var first_cell := Vector2i((area.position / DECOR_CELL).floor())
	var last_cell := Vector2i((area.end / DECOR_CELL).ceil())
	for cell_x in range(first_cell.x, last_cell.x + 1):
		for cell_y in range(first_cell.y, last_cell.y + 1):
			var roll := _noise(cell_x, cell_y, 1)
			if roll >= DECOR_CHANCE:
				continue
			var spot := (Vector2(cell_x, cell_y) + Vector2(_noise(cell_x, cell_y, 2), _noise(cell_x, cell_y, 3))) * DECOR_CELL
			var block := Vector2i((spot / BLOCK).floor())
			if _near_road(spot, road_reach + 8.0) or BayArea.district_of(block) == "bay" or BayArea.is_water(spot) \
					or (BayArea.RUNWAYS.has(block) and absf(spot.y - (block.y + 0.5) * BLOCK.y) < RUNWAY_HALF + 8.0):
				continue
			var district: Dictionary = BayArea.DISTRICTS[BayArea.district_of(block)]
			var choices: Array = district["decor"]
			# Reuse the roll to pick the variant so each cell needs one more hash at most.
			var decor: Array = choices[floori(roll / DECOR_CHANCE * choices.size())]
			var texture := Art.texture(decor[0])
			var height: float = decor[1]
			var draw_size := Vector2(texture.get_width(), texture.get_height()) * (height / texture.get_height())
			draw_texture_rect(texture, Rect2(spot - draw_size / 2.0, draw_size), false)


## How far a north-south road's surface reaches either side of its centre line on a row (a
## freeway's further), so the east-west road markings stop at its edge.
func _road_reach_at(column: int, row: int) -> float:
	return FREEWAY_HALF + SIDEWALK if not BayArea.freeway_at(column, row).is_empty() else ROAD_HALF + SIDEWALK


## A freeway's block-long segment: wider, darker asphalt carried over the crossings at either
## end (it reads as an overpass), white lane dashes either side of a double yellow line, and
## the route shield painted on each carriageway.
func _draw_freeway(x: float, row: int, freeway: Dictionary) -> void:
	var top := row * BLOCK.y
	var bottom := (row + 1) * BLOCK.y
	var reach := FREEWAY_HALF + SIDEWALK
	draw_rect(Rect2(x - reach, top - ROAD_HALF, reach * 2.0, BLOCK.y + ROAD_HALF * 2.0), PAVEMENT)
	draw_rect(Rect2(x - FREEWAY_HALF, top - ROAD_HALF, FREEWAY_HALF * 2.0, BLOCK.y + ROAD_HALF * 2.0), FREEWAY_ASPHALT)
	var edge_from := top + ROAD_HALF + SIDEWALK
	var edge_to := bottom - ROAD_HALF - SIDEWALK
	for edge in [-reach, -FREEWAY_HALF, FREEWAY_HALF, reach]:
		draw_line(Vector2(x + edge, edge_from), Vector2(x + edge, edge_to), Art.INK, 2.0)
	for side in [-2.5, 2.5]:
		draw_line(Vector2(x + side, top - ROAD_HALF), Vector2(x + side, bottom + ROAD_HALF), FREEWAY_YELLOW, 2.0)
	for lane in [-FREEWAY_HALF / 2.0, FREEWAY_HALF / 2.0]:
		for y in range(int(edge_from) + 10, int(edge_to) - 20, 30):
			draw_rect(Rect2(x + lane - 1.5, y, 3, 15), Color.WHITE)
	var middle := (edge_from + edge_to) / 2.0
	for lane in [-FREEWAY_HALF / 2.0, FREEWAY_HALF / 2.0]:
		_draw_shield(Vector2(x + lane, middle), freeway)


func _draw_shield(center: Vector2, freeway: Dictionary) -> void:
	var texture := Art.texture(freeway["shield"])
	draw_texture_rect(texture, Rect2(center - Vector2.ONE * SHIELD_SIZE / 2.0, Vector2.ONE * SHIELD_SIZE), false)
	var font := Art.display_font(800)
	var text: String = freeway["number"]
	var font_size := 9
	var width := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
	var color := Art.INK if freeway["shield"] == "shield_us" else Color.WHITE
	draw_string(font, center + Vector2(-width / 2.0, 5.0), text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, color)


## Caltrain's track between two crossings: sleepers, then two rails over them.
func _draw_railway(x: float, from: float, to: float) -> void:
	draw_rect(Rect2(x - RAILWAY_HALF - 3.0, from, (RAILWAY_HALF + 3.0) * 2.0, to - from), Color(Art.INK, 0.12))
	for y in range(int(from) + 3, int(to), 9):
		draw_rect(Rect2(x - RAILWAY_HALF - 2.0, y, (RAILWAY_HALF + 2.0) * 2.0, 3.0), SLEEPER)
	for side in [-RAILWAY_HALF + 2.0, RAILWAY_HALF - 2.0]:
		draw_line(Vector2(x + side, from), Vector2(x + side, to), RAIL, 2.0)


## SFO's runway (BayArea.RUNWAYS): a long grey strip across its block with a dashed centre
## line, threshold bars at both ends and the runway number.
func _draw_runways(first: Vector2i, last: Vector2i) -> void:
	for block: Vector2i in BayArea.RUNWAYS:
		if block.x < first.x or block.x > last.x or block.y < first.y or block.y > last.y:
			continue
		var origin := Vector2(block) * BLOCK
		var runway := Rect2(origin.x + ROAD_HALF + SIDEWALK + 10.0, origin.y + BLOCK.y / 2.0 - RUNWAY_HALF,
			BLOCK.x - (ROAD_HALF + SIDEWALK + 10.0) * 2.0, RUNWAY_HALF * 2.0)
		draw_rect(runway.grow(2.0), Art.INK)
		draw_rect(runway, RUNWAY)
		var middle := runway.get_center().y
		for x in range(int(runway.position.x) + 50, int(runway.end.x) - 50, 28):
			draw_rect(Rect2(x, middle - 1.5, 16, 3), Color.WHITE)
		for end_x in [runway.position.x + 8.0, runway.end.x - 32.0]:
			for i in 5:
				draw_rect(Rect2(end_x, runway.position.y + 5.0 + i * 9.6, 24, 5), Color.WHITE)
		var font := Art.display_font(800)
		draw_string(font, Vector2(runway.position.x + 38.0, middle + 6.0), "28R", HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color.WHITE)
		draw_string(font, Vector2(runway.end.x - 70.0, middle + 6.0), "10L", HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color.WHITE)


## The South Bay's colourful salt ponds, between the shore road and the water, on the rows
## where the Bay still has them (not the waterfront of San Francisco and the airport).
func _draw_salt_ponds(area: Rect2, first_row: int, last_row: int) -> void:
	var pond_height := 90.0
	for row in range(first_row, last_row + 1):
		var column = BayArea.east_shore_column(row)
		if column == null or row < BayArea.SALT_POND_FROM_ROW:
			continue
		var from: float = column * BLOCK.x + ROAD_HALF + SIDEWALK + 10.0
		var to := BayArea.east_water_x(row) - 14.0
		if area.end.x < from or area.position.x > to:
			continue
		var row_top := row * BLOCK.y + ROAD_HALF + SIDEWALK + 6.0
		var row_bottom := (row + 1) * BLOCK.y - ROAD_HALF - SIDEWALK - 6.0
		var count := floori((row_bottom - row_top) / pond_height)
		for index in count:
			var top := row_top + index * (row_bottom - row_top) / count
			var pond := Rect2(from, top + 4.0, to - from, (row_bottom - row_top) / count - 8.0)
			var color: Color = SALT_PONDS[floori(_noise(row * 8 + index, 0, 11) * SALT_PONDS.size())]
			draw_rect(pond.grow(2.0), Art.INK)
			draw_rect(pond, color)


## The water round the peninsula. Drawn in three passes over all of it, so the shore gets a sand
## edge and an ink line while the seams between the water's rects don't show: sand grown out,
## then ink grown a little, then the water itself on top.
func _draw_water(area: Rect2) -> void:
	var rects := BayArea.water_rects(area.grow(SAND_EDGE + 2.0))
	if rects.is_empty():
		return
	for water: Rect2 in rects:
		draw_rect(water.grow(SAND_EDGE), SAND)
	for water: Rect2 in rects:
		draw_rect(water.grow(2.0), Art.INK)
	for water: Rect2 in rects:
		draw_rect(water, WATER)
	# Little wave ticks scattered on a grid.
	var first := Vector2i((area.position / 48.0).floor())
	var last := Vector2i((area.end / 48.0).ceil())
	for cell_x in range(first.x, last.x + 1):
		for cell_y in range(first.y, last.y + 1):
			if _noise(cell_x, cell_y, 12) > 0.35:
				continue
			var at := Vector2(cell_x, cell_y) * 48.0 + Vector2(_noise(cell_x, cell_y, 13), _noise(cell_x, cell_y, 14)) * 30.0
			if not (BayArea.is_water(at + Vector2(-8, -8)) and BayArea.is_water(at + Vector2(16, 8))):
				continue
			draw_arc(at, 5.0, PI * 1.15, PI * 1.85, 8, Color.WHITE, 1.6, true)
			draw_arc(at + Vector2(8, 0), 5.0, PI * 1.15, PI * 1.85, 8, Color.WHITE, 1.6, true)


func _near_road(point: Vector2, reach: float) -> bool:
	var off_x := absf(point.x - roundf(point.x / BLOCK.x) * BLOCK.x)
	var off_y := absf(point.y - roundf(point.y / BLOCK.y) * BLOCK.y)
	return off_x < reach or off_y < reach


# --- Standing things, per block ------------------------------------------------------------

func _update_blocks(view_half: Vector2) -> void:
	var area := Rect2(follow.position - view_half, view_half * 2.0).grow(BLOCK_MARGIN)
	var wanted := Rect2i(Vector2i((area.position / BLOCK).floor()), Vector2i.ZERO)
	wanted.end = Vector2i((area.end / BLOCK).floor()) + Vector2i.ONE
	if wanted == _block_range:
		return
	_block_range = wanted
	for block: Vector2i in _blocks.keys():
		if not wanted.has_point(block):
			_clear_block(_blocks[block])
			_blocks.erase(block)
	for block_x in range(wanted.position.x, wanted.end.x):
		for block_y in range(wanted.position.y, wanted.end.y):
			var block := Vector2i(block_x, block_y)
			if not _blocks.has(block):
				_blocks[block] = _populate(block)


func _clear_block(content: Dictionary) -> void:
	for node: Node2D in content["nodes"]:
		node.queue_free()
	for rect: Rect2 in content["solids"]:
		_file_solid(rect, false)
	for entry: Array in content["fading"]:
		_fading.erase(entry)


## Where to stand to check in at the landmark on `block` (Stamps): at the foot of a landmark
## drawing, by a campus's mascot on the lawn, or else by its sign. Worked out the way _populate
## places them, without building the block (the minimap wants every one, near or not).
func stamp_spot(block: Vector2i) -> Vector2:
	var origin := Vector2(block) * BLOCK
	var lawn_top := origin.y + ROAD_HALF + SIDEWALK + 50.0
	if BayArea.LAWN_LANDMARKS.has(block):
		return Vector2(origin.x + BLOCK.x * 0.62, lawn_top + 90.0)
	if String(BayArea.LANDMARKS.get(block, "")).begins_with("brand_row:"):
		var inner_left := origin.x + _road_reach_at(block.x, block.y) + 14.0
		if block.x == BayArea.RAILWAY_COLUMN and BayArea.has_railway(block.y):
			inner_left += RAILWAY_OFFSET + RAILWAY_HALF
		return Vector2(inner_left + 70.0, lawn_top + 40.0)
	return Vector2(origin.x + BLOCK.x / 2.0, origin.y + BLOCK.y - ROAD_HALF - SIDEWALK - 2.0)


## Builds one block: a street sign at its corner, a row of buildings (or a landmark) along its
## bottom road with trees in the gaps and props on the sidewalk, and bushes and trees dotted
## over the lawn behind. Some blocks are parks with no buildings.
func _populate(block: Vector2i) -> Dictionary:
	var rng := RandomNumberGenerator.new()
	rng.seed = int(_noise(block.x, block.y, 7) * 2147483647.0) + seed_value
	var content := {"nodes": [], "solids": [], "fading": []}
	var district: Dictionary = BayArea.DISTRICTS[BayArea.district_of(block)]
	var origin := Vector2(block) * BLOCK
	var inner_left := origin.x + _road_reach_at(block.x, block.y) + 14.0
	if block.x == BayArea.RAILWAY_COLUMN and BayArea.has_railway(block.y):
		inner_left += RAILWAY_OFFSET + RAILWAY_HALF
	var inner_right := origin.x + BLOCK.x - _road_reach_at(block.x + 1, block.y) - 14.0
	var street_y := origin.y + BLOCK.y - ROAD_HALF - SIDEWALK - 2.0
	var lawn_top := origin.y + ROAD_HALF + SIDEWALK + 50.0
	var tallest := 0.0
	var is_park: bool = rng.randf() < district["park_chance"] or BayArea.RUNWAYS.has(block)

	var corner := origin + Vector2(_road_reach_at(block.x, block.y) + 6.0, ROAD_HALF + SIDEWALK + 34.0)
	if not BayArea.is_water(corner):
		var street_sign := StreetSign.new()
		street_sign.names = [BayArea.east_west_name(block.y), BayArea.north_south_name(block.x, block.y)]
		street_sign.position = corner
		content["nodes"].append(_place(street_sign))
	_place_freeway_sign(content, block)

	var landmark: String = BayArea.LANDMARKS.get(block, "")
	if landmark.begins_with("art:"):
		tallest = _place_landmark(content, landmark.trim_prefix("art:"), Vector2(origin.x + BLOCK.x / 2.0, street_y))
	elif landmark.begins_with("brand_row:"):
		tallest = _place_row(content, rng, district, inner_left, inner_right, street_y, landmark.trim_prefix("brand_row:"))
		_place_campus_sign(content, landmark.trim_prefix("brand_row:"), Vector2(inner_left + 70.0, lawn_top + 40.0))
	elif not is_park and inner_right > inner_left:
		tallest = _place_row(content, rng, district, inner_left, inner_right, street_y, "")
	var lawn_landmark: String = BayArea.LAWN_LANDMARKS.get(block, "")
	if lawn_landmark != "":
		_place_landmark(content, lawn_landmark, Vector2(origin.x + BLOCK.x * 0.62, lawn_top + 90.0))
	if BayArea.RUNWAYS.has(block):
		# Seen from above and lying flat on the runway, nose west like a plane lining up on 28R.
		var plane := Art.sprite("plane", BayArea.HEIGHTS["plane"])
		plane.position = origin + Vector2(BLOCK.x * 0.62, BLOCK.y / 2.0)
		plane.rotation = -PI / 2.0
		content["nodes"].append(_place(plane))

	var lawn_bottom := street_y - tallest - 12.0
	if lawn_bottom - lawn_top > 30.0 and inner_right > inner_left:
		for i in rng.randi_range(district["bushes"][0], district["bushes"][1]):
			var spot := Vector2(rng.randf_range(inner_left, inner_right), rng.randf_range(lawn_top, lawn_bottom))
			content["nodes"].append(_place_art("bush", BayArea.HEIGHTS["bush"], spot, true))
		var tree: String = district["tree"] if district["tree"] != "" else "palm"
		# Trees would hide a lawn landmark; bushes are low enough.
		var tree_count := 0 if BayArea.LAWN_LANDMARKS.has(block) else rng.randi_range(district["lawn_trees"][0], district["lawn_trees"][1])
		for i in tree_count:
			var spot := Vector2(rng.randf_range(inner_left, inner_right), rng.randf_range(lawn_top + 40.0, lawn_bottom))
			_place_tree(content, tree, spot)
	return content


## A row of structures along the street, gaps between them, the district's tree in wide gaps,
## and a prop on the sidewalk now and then. Returns the tallest height, so the lawn behind
## knows where it ends.
func _place_row(content: Dictionary, rng: RandomNumberGenerator, district: Dictionary, left: float, right: float, street_y: float, forced_brand: String) -> float:
	var structures: Array = district["structures"]
	# A company campus is office blocks wherever it is, not a row of branded family homes.
	if forced_brand != "":
		structures = BayArea.DISTRICTS["peninsula"]["structures"]
	if structures.is_empty():
		return 0.0
	var tallest := 0.0
	var cursor := left + rng.randf_range(0.0, 20.0)
	while true:
		var spec: String = structures[rng.randi() % structures.size()]
		var texture := _structure_texture(spec)
		if texture == null:
			break
		var size := _structure_size(spec, texture)
		if cursor + size.x > right:
			break
		var brand := forced_brand
		var brands: Array = district["brands"]
		if brand == "" and not brands.is_empty() and spec.begins_with("soco:") and rng.randf() < district["brand_chance"]:
			brand = brands[rng.randi() % brands.size()]
		_place_structure(content, spec, texture, size, Vector2(cursor + size.x / 2.0, street_y), brand, [])
		tallest = maxf(tallest, size.y)
		var gap: float = rng.randf_range(district["gap"][0], district["gap"][1])
		if district["tree"] != "" and gap > 24.0 and rng.randf() < 0.7:
			# Not solid: a trunk in the middle of a gap split it into two slits nobody fit
			# through, walling off the whole row. You pass in front of or behind it instead.
			_place_tree(content, district["tree"], Vector2(cursor + size.x + gap / 2.0, street_y + 1.0), false)
		cursor += size.x + gap
	var props: Array = district["props"]
	if not props.is_empty() and rng.randf() < 0.5:
		var prop: String = props[rng.randi() % props.size()]
		var spot := Vector2(rng.randf_range(left, right), street_y + SIDEWALK + 2.0)
		content["nodes"].append(_place_art(prop, BayArea.HEIGHTS[prop], spot, true))
	return tallest


## A big standalone version of a company's sign on the lawn in front of its campus.
func _place_campus_sign(content: Dictionary, brand: String, feet: Vector2) -> void:
	var holder := Node2D.new()
	holder.position = feet
	var brand_sign := BrandSign.new()
	brand_sign.brand = BayArea.BRANDS[brand]
	brand_sign.scale = Vector2.ONE * CAMPUS_SIGN_SCALE
	holder.add_child(brand_sign)
	content["nodes"].append(_place(holder))


## A green overhead-style sign beside the freeway every other block, pointing each way.
func _place_freeway_sign(content: Dictionary, block: Vector2i) -> void:
	var freeway := BayArea.freeway_at(block.x, block.y)
	if freeway.is_empty() or posmod(block.y, 2) != 0:
		return
	# Below the street sign at the corner.
	var at := Vector2(block.x * BLOCK.x + FREEWAY_HALF + SIDEWALK + 44.0, block.y * BLOCK.y + 150.0)
	if BayArea.is_water(at):
		return
	var sign := FreewaySign.new()
	sign.number = freeway["number"]
	sign.north = posmod(block.y, 4) == 0
	sign.position = at
	content["nodes"].append(_place(sign))


func _place_landmark(content: Dictionary, art: String, feet: Vector2) -> float:
	var spec := "art:" + art
	var texture := _structure_texture(spec)
	var size := _structure_size(spec, texture)
	_place_structure(content, spec, texture, size, feet, BayArea.LANDMARK_BRANDS.get(art, ""), BayArea.SOLID_SPANS.get(art, []))
	return size.y


func _structure_texture(spec: String) -> Texture2D:
	var file_name := spec.get_slice(":", 1)
	if spec.begins_with("art:"):
		return Art.texture(file_name)
	if ResourceLoader.exists(Art.BUILDING_DIR + file_name + ".png"):
		return Art.building(file_name)
	if not _missing_warned:
		_missing_warned = true
		push_warning("soco-st buildings missing from assets/soco-st/ (tools/fetch_soco_st.sh re-downloads them)")
	return null


func _structure_size(spec: String, texture: Texture2D) -> Vector2:
	var natural := texture.get_size()
	if spec.begins_with("soco:"):
		return natural * BUILDING_SCALE
	return natural * (BayArea.HEIGHTS[spec.get_slice(":", 1)] / natural.y)


## Puts a building or landmark down with its base centre at `feet`, makes its base solid (the
## whole width, or only the `solid_spans` fractions of it), and tops it with a brand sign if
## given.
func _place_structure(content: Dictionary, spec: String, texture: Texture2D, size: Vector2, feet: Vector2, brand: String, solid_spans: Array) -> void:
	var holder := Node2D.new()
	holder.position = feet
	var sprite := Sprite2D.new()
	sprite.texture = texture
	sprite.scale = Vector2.ONE * (size.y / texture.get_size().y)
	# Anchored at the bottom centre so y-sorting uses the building's base.
	sprite.offset = Vector2(0, -texture.get_size().y / 2.0)
	holder.add_child(sprite)
	if brand != "":
		var brand_sign := BrandSign.new()
		brand_sign.brand = BayArea.BRANDS[brand]
		brand_sign.position = Vector2(0, -size.y + 1.0)
		holder.add_child(brand_sign)
	content["nodes"].append(_place(holder))

	var drawn := Rect2(feet.x - size.x / 2.0, feet.y - size.y, size.x, size.y)
	var spans: Array = solid_spans if not solid_spans.is_empty() else [[0.0, 1.0]]
	var inset := ART_INSET if spec.begins_with("art:") else 0.0
	for span: Array in spans:
		var from: float = drawn.position.x + size.x * maxf(span[0], inset)
		var to: float = drawn.position.x + size.x * minf(span[1], 1.0 - inset)
		var depth := minf(FOOTPRINT_DEPTH, size.y)
		var solid := Rect2(from, drawn.end.y - depth, to - from, depth)
		content["solids"].append(solid)
		_file_solid(solid, true)
	var entry := [holder, drawn]
	content["fading"].append(entry)
	_fading.append(entry)


## Trees are solid only at the trunk, so you can walk behind the crown; street trees between
## buildings aren't solid at all (see _place_row).
func _place_tree(content: Dictionary, tree: String, feet: Vector2, solid := true) -> void:
	content["nodes"].append(_place_art(tree, BayArea.HEIGHTS[tree], feet, not solid))
	if not solid:
		return
	var trunk := Rect2(feet.x - TRUNK.x / 2.0, feet.y - TRUNK.y, TRUNK.x, TRUNK.y)
	content["solids"].append(trunk)
	_file_solid(trunk, true)


## Places art standing on `feet` (bottom centre), in the y-sorted entity layer. The layer sorts
## scenery by its base but the player and enemies by their centre, so art they can walk into
## (`walk_through`) sorts half a player higher, drawing unmoved: a player whose feet are past
## its base is in front. Solid trees keep their base, since a player touching the trunk from
## behind is only 14 px (trunk + body radius) above it and would pop in front of the crown.
func _place_art(art_name: String, size: float, feet: Vector2, walk_through := false) -> Sprite2D:
	var node := Art.sprite(art_name, size)
	var sort_lift := Player.SIZE / 2.0 if walk_through else 0.0
	# offset is in texture pixels, before the sprite's scale.
	node.offset = Vector2(0, -node.texture.get_height() / 2.0 + sort_lift / node.scale.y)
	node.position = feet - Vector2(0, sort_lift)
	_place(node)
	return node


func _place(node: Node2D) -> Node2D:
	game.entity_layer.add_child(node)
	return node


## Fades whatever the player is standing behind. Solids keep their centre out, but their
## sprite still tucks behind a roof they walk up to from the north.
func _fade_buildings(delta: float) -> void:
	var player_at := follow.position
	for entry: Array in _fading:
		var holder: Node2D = entry[0]
		var drawn: Rect2 = entry[1]
		var behind := player_at.y < drawn.end.y and player_at.y + Player.SIZE / 2.0 > drawn.position.y \
			and player_at.x > drawn.position.x and player_at.x < drawn.end.x
		holder.modulate.a = move_toward(holder.modulate.a, BEHIND_ALPHA if behind else 1.0, delta * 4.0)


## _noise for the moving scenery (Traffic).
func noise(cell_x: int, cell_y: int, salt: int) -> float:
	return _noise(cell_x, cell_y, salt)


## Deterministic pseudo-random value in [0, 1) for integer coordinates (wraps on overflow).
func _noise(cell_x: int, cell_y: int, salt: int) -> float:
	var mixed := cell_x * 374761393 + cell_y * 668265263 + (seed_value + salt * 7919) * 2654435761
	mixed = (mixed ^ (mixed >> 13)) * 1274126177
	mixed = mixed ^ (mixed >> 16)
	return float(mixed & 0xFFFF) / 65536.0
