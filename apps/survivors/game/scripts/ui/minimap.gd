class_name Minimap
extends Control
## The peninsula at a glance, top right of the HUD: San Francisco up north, San Jose down south,
## the hills to the west and the Bay to the east (the one edge you can't walk past), with the
## player, what the screen shows, and any bosses on it.
##
## It always shows the whole of the named map (OVERVIEW). The city goes on past that; a player
## who walks off its edge makes the map zoom out to take them in too, rather than slide the
## named part off the map.

## The named part of the world, in world pixels: from the far side of the hills to past the
## Bay's shore, and from north of the Golden Gate (Lombard St) to south of San Jose.
const OVERVIEW := Rect2(-2240.0, -2800.0, 4480.0, 5200.0)
## The map keeps OVERVIEW's proportions.
const MAP_SIZE := Vector2(60.0, 70.0)
## Bolder than the districts' ground colours, which are pale on purpose and blur together at
## this size: the design's pastel fills, one per district.
const DISTRICT_COLORS := {
	"peninsula": Art.FILL_MINT, "sf": Art.FILL_LILAC, "sj": Art.BRAND_SOFT,
	"hills": Color("f0dc9a"), "bay": City.SAND,
}
const INSET := 3.0
## Room kept around a player outside OVERVIEW, as a fraction of OVERVIEW's size.
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
	_frame.border_color = Art.LINE_STRONG
	_frame.set_border_width_all(1)
	_frame.set_corner_radius_all(8)
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
			var ground: Color = DISTRICT_COLORS[BayArea.district_of(block)]
			_fill(map, window, Rect2(Vector2(block) * City.BLOCK, City.BLOCK), ground)
	# The water, which is what "the end of the map" is.
	_fill(map, window, Rect2(BayArea.WATER_X, window.position.y, window.end.x - BayArea.WATER_X, window.size.y), City.WATER)
	# Roads: a thin white line along every block edge, like a street map, stopping at the water.
	var road := Color(Art.PAPER, 0.8)
	var land_end := minf(window.end.x, BayArea.WATER_X)
	var show_roads := City.BLOCK.x * map_scale.x >= MIN_BLOCK_PIXELS_FOR_ROADS
	for row in range(first.y, last.y + 2):
		var y := map.position.y + (row * City.BLOCK.y - window.position.y) * map_scale.y
		if show_roads and y > map.position.y and y < map.end.y:
			draw_line(Vector2(map.position.x, y), Vector2(map.position.x + (land_end - window.position.x) * map_scale.x, y), road, 1.0)
	for column in range(first.x, last.x + 2):
		var world_x := column * City.BLOCK.x
		var x := map.position.x + (world_x - window.position.x) * map_scale.x
		if show_roads and world_x < BayArea.WATER_X and x > map.position.x and x < map.end.x:
			draw_line(Vector2(x, map.position.y), Vector2(x, map.end.y), road, 1.0)

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


## OVERVIEW, grown to take in a player who walked past its edge, and widened on its short
## side to keep the map's proportions.
func _window() -> Rect2:
	var margin := OVERVIEW.size * FOLLOW_MARGIN
	var window := OVERVIEW.merge(Rect2(game.player.position - margin, margin * 2.0))
	var aspect := MAP_SIZE.x / MAP_SIZE.y
	if window.size.x < window.size.y * aspect:
		var extra := window.size.y * aspect - window.size.x
		window = window.grow_individual(extra / 2.0, 0.0, extra / 2.0, 0.0)
	else:
		var extra := window.size.x / aspect - window.size.y
		window = window.grow_individual(0.0, extra / 2.0, 0.0, extra / 2.0)
	return window


func _to_map(map: Rect2, window: Rect2, world: Vector2) -> Vector2:
	return map.position + (world - window.position) * (map.size / window.size)


## Fills the part of a world rect that falls on the map.
func _fill(map: Rect2, window: Rect2, world: Rect2, color: Color) -> void:
	if world.size.x <= 0.0 or world.size.y <= 0.0:
		return
	var on_map := Rect2(_to_map(map, window, world.position), world.size * (map.size / window.size)).intersection(map)
	if on_map.has_area():
		draw_rect(on_map, color)
