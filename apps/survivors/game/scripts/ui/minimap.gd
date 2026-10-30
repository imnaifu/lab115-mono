class_name Minimap
extends Control
## The map at a glance, top right of the HUD: on 硅谷 San Francisco up north at its tip, San
## Jose down south, the hills and the Pacific to the west, the Bay to the east; on 北京 回龙观 up
## north, the universities down south, the lake to the south-west. The freeways and the railway,
## the player, what the screen shows, any bosses on it, and the landmarks to check in at (打卡):
## each its own little picture (.37; plain pins before), faded in a red ring until checked in at,
## then in full colour in a gold one.
##
## It always shows the whole of the named map (the map's OVERVIEW). The city goes on past that; a
## player who walks off its edge makes the map zoom out to take them in too, rather than slide
## the named part off the map.
## 硅谷's overview's proportions; another map's is widened to fit (_window).
const MAP_SIZE := Vector2(72.0, 81.0)
## Bolder than the districts' ground colours, which are pale on purpose and blur together at
## this size: the design's pastel fills, one per district.
const DISTRICT_COLORS := {
	"peninsula": Art.FILL_MINT, "sf": Art.FILL_LILAC, "sj": Art.BRAND_SOFT,
	"hills": Color("f0dc9a"), "bay": City.SAND, "beach": City.SAND,
	# 北京 (Beijing.DISTRICTS)
	"houchang": Art.FILL_MINT, "huilongguan": Art.FILL_PINK, "haidian": Art.FILL_LILAC,
	"yiheyuan": Color("cfe6b0"), "xishan": Color("f0dc9a"), "aoyun": Art.BRAND_SOFT, "lake": City.SAND,
	# 西雅图 (Seattle.DISTRICTS; its lakes' blocks are "lake" too)
	"slu": Art.FILL_MINT, "downtown": Art.FILL_LILAC, "sodo": Art.BRAND_SOFT, "north": Art.FILL_PINK,
	"eastside": Art.FILL_SKY, "sound": City.SAND,
	# 伦敦 (London.DISTRICTS; the river's row is "thames")
	"kx": Art.FILL_MINT, "camden": Art.FILL_PINK, "westend": Art.FILL_LILAC, "city": Art.FILL_SKY,
	"thames": City.SAND, "southbank": Art.BRAND_SOFT, "greenwich": Color("cfe6b0"),
}
## A landmark's picture on the map, and the ring round it: about a block across at the usual zoom,
## so neighbouring landmarks don't cover each other.
const LANDMARK_ICON := 7.0
const LANDMARK_RING := 4.6
const FREEWAY_COLOR := Color("f2c230")
const INSET := 3.0
## Room kept around a player outside the overview, as a fraction of its size.
const FOLLOW_MARGIN := 0.06
## Below this many map pixels per block the street lines would smear into a grey wash, so
## they are left out (only when zoomed far out).
const MIN_BLOCK_PIXELS_FOR_ROADS := 3.0

var game: Game

var _frame := StyleBoxFlat.new()


func _ready() -> void:
	custom_minimum_size = MAP_SIZE + Vector2.ONE * INSET * 2.0
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_frame.bg_color = Color(Art.PAPER, 0.0)
	_frame.border_color = Art.INK
	_frame.set_border_width_all(2)
	_frame.set_corner_radius_all(10)
	_frame.anti_aliasing = true


func _process(_delta: float) -> void:
	queue_redraw()


func _draw() -> void:
	var outer := Rect2(Vector2.ZERO, size)
	draw_rect(outer.grow(-1.0), Art.PAPER)
	var map := outer.grow(-INSET)
	var window := _window()
	var map_scale := map.size / window.size

	# District grounds, block by block.
	var first := Vector2i((window.position / City.BLOCK).floor())
	var last := Vector2i((window.end / City.BLOCK).floor())
	for block_x in range(first.x, last.x + 1):
		for block_y in range(first.y, last.y + 1):
			var block := Vector2i(block_x, block_y)
			var ground: Color = DISTRICT_COLORS[Maps.current.district_of(block)]
			_fill(map, window, Rect2(Vector2(block) * City.BLOCK, City.BLOCK), ground)
	# Roads: a thin white line along every block edge, like a street map; the freeways bolder
	# and yellow, Caltrain a dark line beside Alma St. The water goes over them all.
	var road := Color(Art.PAPER, 0.8)
	if City.BLOCK.x * map_scale.x >= MIN_BLOCK_PIXELS_FOR_ROADS:
		for row in range(first.y, last.y + 2):
			var y := map.position.y + (row * City.BLOCK.y - window.position.y) * map_scale.y
			if y > map.position.y and y < map.end.y:
				draw_line(Vector2(map.position.x, y), Vector2(map.end.x, y), road, 1.0)
		for column in range(first.x, last.x + 2):
			var x := map.position.x + (column * City.BLOCK.x - window.position.x) * map_scale.x
			if x > map.position.x and x < map.end.x:
				draw_line(Vector2(x, map.position.y), Vector2(x, map.end.y), road, 1.0)
	for column: int in Maps.current.FREEWAYS:
		var from_y: float = Maps.current.FREEWAYS[column]["from_row"] * City.BLOCK.y
		_line(map, window, Vector2(column * City.BLOCK.x, from_y), Vector2(column * City.BLOCK.x, window.end.y), FREEWAY_COLOR, 2.0)
	var track_x: float = Maps.current.RAILWAY_COLUMN * City.BLOCK.x + City.RAILWAY_OFFSET
	_line(map, window, Vector2(track_x, Maps.current.RAILWAY_FROM_ROW * City.BLOCK.y), Vector2(track_x, window.end.y), Color(Art.INK, 0.6), 1.0)
	# The water, which is what "the end of the map" is.
	for water: Rect2 in Maps.current.water_rects(window):
		_fill(map, window, water, City.WATER)

	for id: String in Maps.current.STAMPS:
		var pin := _to_map(map, window, game.stamps.spot(id))
		if not map.has_point(pin):
			continue
		var stamped := Progress.has_stamp(id)
		draw_circle(pin, LANDMARK_RING, Art.PAPER)
		var picture := Art.texture(Maps.current.STAMPS[id]["art"])
		var fit := picture.get_size() * (LANDMARK_ICON / maxf(picture.get_width(), picture.get_height()))
		draw_texture_rect(picture, Rect2(pin - fit / 2.0, fit), false, Color.WHITE if stamped else Color(1, 1, 1, 0.55))
		draw_arc(pin, LANDMARK_RING, 0.0, TAU, 16, Art.BRAND_DEEP if stamped else Art.HP_RED, 1.2, true)

	# Bosses, then the player on top: what the screen shows, and a dot where they stand.
	for enemy in game.enemies:
		if enemy.is_elite and not enemy.dead:
			var at := _to_map(map, window, enemy.position)
			draw_circle(at, 2.6, Art.INK)
			draw_circle(at, 1.8, Art.RED)
	var view := Rect2(game.player.position - game.view_half(), game.view_half() * 2.0)
	var view_on_map := Rect2(_to_map(map, window, view.position), view.size * map_scale).intersection(map)
	draw_rect(view_on_map, Color(Art.INK, 0.55), false, 1.0)
	var player_at := _to_map(map, window, game.player.position)
	draw_circle(player_at, 3.0, Art.PAPER)
	draw_circle(player_at, 2.2, Art.INK)
	draw_style_box(_frame, outer)


## The map's overview, grown to take in a player who walked past its edge, and widened on its
## short side to keep the map's proportions.
func _window() -> Rect2:
	var overview: Rect2 = Maps.current.OVERVIEW
	var margin := overview.size * FOLLOW_MARGIN
	var window := overview.merge(Rect2(game.player.position - margin, margin * 2.0))
	var aspect := MAP_SIZE.x / MAP_SIZE.y
	if window.size.x < window.size.y * aspect:
		var extra := window.size.y * aspect - window.size.x
		window = window.grow_individual(extra / 2.0, 0.0, extra / 2.0, 0.0)
	else:
		var extra := window.size.x / aspect - window.size.y
		window = window.grow_individual(0.0, extra / 2.0, 0.0, extra / 2.0)
	return window


## A world-space line, clipped to the map.
func _line(map: Rect2, window: Rect2, from: Vector2, to: Vector2, color: Color, width: float) -> void:
	var start := _to_map(map, window, from)
	var end := _to_map(map, window, to)
	# Off the map altogether (clamping would drag it along the edge instead).
	if maxf(start.x, end.x) < map.position.x or minf(start.x, end.x) > map.end.x \
			or maxf(start.y, end.y) < map.position.y or minf(start.y, end.y) > map.end.y:
		return
	start = start.clamp(map.position, map.end)
	end = end.clamp(map.position, map.end)
	if start != end:
		draw_line(start, end, color, width)


func _to_map(map: Rect2, window: Rect2, world: Vector2) -> Vector2:
	return map.position + (world - window.position) * (map.size / window.size)


## Fills the part of a world rect that falls on the map.
func _fill(map: Rect2, window: Rect2, world: Rect2, color: Color) -> void:
	if world.size.x <= 0.0 or world.size.y <= 0.0:
		return
	var on_map := Rect2(_to_map(map, window, world.position), world.size * (map.size / window.size)).intersection(map)
	if on_map.has_area():
		draw_rect(on_map, color)
