class_name City
extends Node2D
## The endless Bay Area around the player: a grid of roads with real street names, districts
## with their own buildings (BayArea), landmarks, parody company signs, and the Bay to the
## east. Everything is derived from a hash of the block (or cell) coordinates, so the layout
## never visibly repeats and is the same when you walk back.
##
## Ground, roads, salt ponds and water are flat, so this node draws them itself under
## everything. Buildings, trees, props and signs stand up, so they are spawned per block into
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


func _process(delta: float) -> void:
	var view_half := game.view_half()
	var cell := Vector2i((follow.position / DECOR_CELL).floor())
	if cell != _drawn_cell or view_half != _drawn_view:
		_drawn_cell = cell
		_drawn_view = view_half
		queue_redraw()
	_update_blocks(view_half)
	_fade_buildings(delta)


# --- Collision -----------------------------------------------------------------------------

## Where a round body of `radius` centred at `point` ends up once pushed out of buildings,
## trunks and the water. A push out of one rect can land in a neighbour (row houses touch),
## so it repeats until nothing moves.
func resolve(point: Vector2, radius: float) -> Vector2:
	var resolved := point
	for attempt in 3:
		var before := resolved
		resolved = _resolve_once(resolved, radius)
		if resolved == before:
			break
	return resolved


func _resolve_once(point: Vector2, radius: float) -> Vector2:
	var resolved := point
	if resolved.x > BayArea.WATER_X - radius:
		resolved.x = BayArea.WATER_X - radius
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
	return point.x > BayArea.WATER_X


## A centre already inside a rect (spawned there, or shoved in by the crowd) leaves through the
## nearer of its top and bottom. Never sideways: buildings in a row stand shoulder to shoulder,
## so a sideways exit could land inside the next one.
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
	var land_end := minf(area.end.x, BayArea.WATER_X)

	# Each district's ground colour, block by block.
	for block_x in range(first.x, last.x + 1):
		for block_y in range(first.y, last.y + 1):
			var district: Dictionary = BayArea.DISTRICTS[BayArea.district_of(Vector2i(block_x, block_y))]
			draw_rect(Rect2(Vector2(block_x, block_y) * BLOCK, BLOCK), district["ground"])

	_draw_salt_ponds(area)

	# Sidewalks first, then asphalt on top, so crossings join up cleanly. Roads stop at the water.
	for fill: Array in [[road_reach, PAVEMENT], [ROAD_HALF, ASPHALT]]:
		for row in range(first.y, last.y + 1):
			draw_rect(Rect2(area.position.x, row * BLOCK.y - fill[0], land_end - area.position.x, fill[0] * 2.0), fill[1])
		for column in range(first.x, last.x + 1):
			if column * BLOCK.x + fill[0] < BayArea.WATER_X:
				draw_rect(Rect2(column * BLOCK.x - fill[0], area.position.y, fill[0] * 2.0, area.size.y), fill[1])

	# Outlines and lane dashes, broken at every crossing.
	for row in range(first.y, last.y + 1):
		for column in range(first.x - 1, last.x + 1):
			var from := column * BLOCK.x + road_reach
			var to := minf((column + 1) * BLOCK.x - road_reach, BayArea.WATER_X)
			if from >= to:
				continue
			var y := row * BLOCK.y
			for edge in [-road_reach, -ROAD_HALF, ROAD_HALF, road_reach]:
				draw_line(Vector2(from, y + edge), Vector2(to, y + edge), Art.INK, 2.0)
			for x in range(int(from) + 10, int(to) - 20, 30):
				draw_rect(Rect2(x, y - 1.5, 15, 3), Color.WHITE)
	for column in range(first.x, last.x + 1):
		var x := column * BLOCK.x
		if x + road_reach >= BayArea.WATER_X:
			continue
		for row in range(first.y - 1, last.y + 1):
			var from := row * BLOCK.y + road_reach
			var to := (row + 1) * BLOCK.y - road_reach
			for edge in [-road_reach, -ROAD_HALF, ROAD_HALF, road_reach]:
				draw_line(Vector2(x + edge, from), Vector2(x + edge, to), Art.INK, 2.0)
			for y in range(int(from) + 10, int(to) - 20, 30):
				draw_rect(Rect2(x - 1.5, y, 3, 15), Color.WHITE)

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
			if _near_road(spot, road_reach + 8.0) or spot.x > BayArea.SHORE_COLUMN * BLOCK.x:
				continue
			var district: Dictionary = BayArea.DISTRICTS[BayArea.district_of(Vector2i((spot / BLOCK).floor()))]
			var choices: Array = district["decor"]
			# Reuse the roll to pick the variant so each cell needs one more hash at most.
			var decor: Array = choices[floori(roll / DECOR_CHANCE * choices.size())]
			var texture := Art.texture(decor[0])
			var height: float = decor[1]
			var draw_size := Vector2(texture.get_width(), texture.get_height()) * (height / texture.get_height())
			draw_texture_rect(texture, Rect2(spot - draw_size / 2.0, draw_size), false)


## The South Bay's colourful salt ponds, between the shore road and the water.
func _draw_salt_ponds(area: Rect2) -> void:
	var from := BayArea.SHORE_COLUMN * BLOCK.x + ROAD_HALF + SIDEWALK + 10.0
	var to := BayArea.WATER_X - 14.0
	if area.end.x < from or area.position.x > to:
		return
	var pond_height := 90.0
	var first := floori(area.position.y / pond_height)
	var last := floori(area.end.y / pond_height)
	for index in range(first, last + 1):
		var top := index * pond_height
		# Leave the east-west roads clear where they run out to the shore.
		var middle := top + pond_height / 2.0
		if absf(middle - roundf(middle / BLOCK.y) * BLOCK.y) < ROAD_HALF + SIDEWALK + pond_height / 2.0:
			continue
		var pond := Rect2(from, top + 6.0, to - from, pond_height - 12.0)
		var color: Color = SALT_PONDS[floori(_noise(index, 0, 11) * SALT_PONDS.size())]
		draw_rect(pond.grow(2.0), Art.INK)
		draw_rect(pond, color)


func _draw_water(area: Rect2) -> void:
	if area.end.x < BayArea.WATER_X - 12.0:
		return
	draw_rect(Rect2(BayArea.WATER_X - 12.0, area.position.y, 12.0, area.size.y), SAND)
	var water := Rect2(BayArea.WATER_X, area.position.y, area.end.x - BayArea.WATER_X, area.size.y)
	draw_rect(water, WATER)
	draw_line(Vector2(BayArea.WATER_X, area.position.y), Vector2(BayArea.WATER_X, area.end.y), Art.INK, 2.0)
	# Little wave ticks scattered on a grid.
	var first := Vector2i((water.position / 48.0).floor())
	var last := Vector2i((water.end / 48.0).ceil())
	for cell_x in range(first.x, last.x + 1):
		for cell_y in range(first.y, last.y + 1):
			if _noise(cell_x, cell_y, 12) > 0.35:
				continue
			var at := Vector2(cell_x, cell_y) * 48.0 + Vector2(_noise(cell_x, cell_y, 13), _noise(cell_x, cell_y, 14)) * 30.0
			if at.x < BayArea.WATER_X + 8.0:
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


## Builds one block: a street sign at its corner, a row of buildings (or a landmark) along its
## bottom road with trees in the gaps and props on the sidewalk, and bushes and trees dotted
## over the lawn behind. Some blocks are parks with no buildings.
func _populate(block: Vector2i) -> Dictionary:
	var rng := RandomNumberGenerator.new()
	rng.seed = int(_noise(block.x, block.y, 7) * 2147483647.0) + seed_value
	var content := {"nodes": [], "solids": [], "fading": []}
	var district: Dictionary = BayArea.DISTRICTS[BayArea.district_of(block)]
	var origin := Vector2(block) * BLOCK
	var inner_left := origin.x + ROAD_HALF + SIDEWALK + 14.0
	var inner_right := minf(origin.x + BLOCK.x - ROAD_HALF - SIDEWALK - 14.0, BayArea.SHORE_COLUMN * BLOCK.x - 14.0)
	var street_y := origin.y + BLOCK.y - ROAD_HALF - SIDEWALK - 2.0
	var lawn_top := origin.y + ROAD_HALF + SIDEWALK + 50.0
	var tallest := 0.0
	var is_park: bool = rng.randf() < district["park_chance"]

	if origin.x + ROAD_HALF + SIDEWALK < BayArea.WATER_X:
		var street_sign := StreetSign.new()
		street_sign.names = [BayArea.east_west_name(block.y), BayArea.north_south_name(block.x)]
		street_sign.position = origin + Vector2(ROAD_HALF + SIDEWALK + 6.0, ROAD_HALF + SIDEWALK + 34.0)
		content["nodes"].append(_place(street_sign))

	var landmark: String = BayArea.LANDMARKS.get(block, "")
	if landmark.begins_with("art:"):
		tallest = _place_landmark(content, landmark.trim_prefix("art:"), Vector2(origin.x + BLOCK.x / 2.0, street_y))
	elif landmark.begins_with("brand_row:"):
		tallest = _place_row(content, rng, district, inner_left, inner_right, street_y, landmark.trim_prefix("brand_row:"))
	elif not is_park and inner_right > inner_left:
		tallest = _place_row(content, rng, district, inner_left, inner_right, street_y, "")

	var lawn_bottom := street_y - tallest - 12.0
	if lawn_bottom - lawn_top > 30.0 and inner_right > inner_left:
		for i in rng.randi_range(district["bushes"][0], district["bushes"][1]):
			var spot := Vector2(rng.randf_range(inner_left, inner_right), rng.randf_range(lawn_top, lawn_bottom))
			content["nodes"].append(_place_art("bush", BayArea.HEIGHTS["bush"], spot))
		var tree: String = district["tree"] if district["tree"] != "" else "palm"
		for i in rng.randi_range(district["lawn_trees"][0], district["lawn_trees"][1]):
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
			_place_tree(content, district["tree"], Vector2(cursor + size.x + gap / 2.0, street_y + 1.0))
		cursor += size.x + gap
	var props: Array = district["props"]
	if not props.is_empty() and rng.randf() < 0.5:
		var prop: String = props[rng.randi() % props.size()]
		var spot := Vector2(rng.randf_range(left, right), street_y + SIDEWALK + 2.0)
		content["nodes"].append(_place_art(prop, BayArea.HEIGHTS[prop], spot))
	return tallest


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
		push_warning("soco-st buildings missing: run tools/fetch_soco_st.sh")
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


## Trees are solid only at the trunk, so you can walk behind the crown.
func _place_tree(content: Dictionary, tree: String, feet: Vector2) -> void:
	content["nodes"].append(_place_art(tree, BayArea.HEIGHTS[tree], feet))
	var trunk := Rect2(feet.x - TRUNK.x / 2.0, feet.y - TRUNK.y, TRUNK.x, TRUNK.y)
	content["solids"].append(trunk)
	_file_solid(trunk, true)


## Places art standing on `feet` (bottom centre), in the y-sorted entity layer.
func _place_art(art_name: String, size: float, feet: Vector2) -> Sprite2D:
	var node := Art.sprite(art_name, size)
	node.offset = Vector2(0, -node.texture.get_height() / 2.0)
	node.position = feet
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


## Deterministic pseudo-random value in [0, 1) for integer coordinates (wraps on overflow).
func _noise(cell_x: int, cell_y: int, salt: int) -> float:
	var mixed := cell_x * 374761393 + cell_y * 668265263 + (seed_value + salt * 7919) * 2654435761
	mixed = (mixed ^ (mixed >> 13)) * 1274126177
	mixed = mixed ^ (mixed >> 16)
	return float(mixed & 0xFFFF) / 65536.0
