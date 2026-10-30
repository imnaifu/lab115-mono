class_name WorldMap
extends Control
## The world as the boarding pass shows it (.38): the leg of the route into one city, from the
## city before it on Maps.ROUTE, over the stretch of map between them (assets/art/world_map.svg),
## with a little plane flying it. .34–.37 this was the whole world-map page, a flag on every city
## like Kingdom Rush's campaign; the user picked an airport departures board instead (Departures),
## and the map stayed on as this strip. CITIES is also where each city's place, code and icon live.

## Each city: latitude and longitude (east of Greenwich, 0-360; London, just west of it, is 359.9),
## its name, its three-letter code for the departures board, and the landmark that stands for it
## there ("" until it has one drawn). The cities still to come (Maps.COMING_SOON) also carry the
## working week and grade they will have. `arc` is how far the leg of the route into the city bows
## north, in art pixels (left out, it goes by the leg's length): 硅谷 to London and London back to
## 西雅图 cross the same stretch of map, so the second flies the polar way, over Greenland.
const CITIES := {
	"sv": {"lat": 37.4, "lon": 237.9, "name": "硅谷", "code": "SFO", "icon": "golden_gate"},
	"ldn": {"lat": 51.5, "lon": 359.9, "name": "伦敦", "code": "LON", "icon": "big_ben", "arc": 36.0},
	"sea": {"lat": 47.6, "lon": 237.7, "name": "西雅图", "code": "SEA", "icon": "space_needle", "arc": 100.0},
	"sg": {"lat": 1.3, "lon": 103.8, "name": "新加坡", "code": "SIN", "icon": "merlion"},
	"sz": {"lat": 22.5, "lon": 114.1, "name": "深圳", "code": "SZX", "icon": "", "hours": "大小周", "rank": "T"},
	"blr": {"lat": 13.0, "lon": 77.6, "name": "班加罗尔", "code": "BLR", "icon": "", "hours": "70h", "rank": "SDE"},
	"bj": {"lat": 39.9, "lon": 116.4, "name": "北京", "code": "PEK", "icon": "summer_palace"},
}
## The map art's own size, and the projection it was drawn in (equirectangular, 65°E at the left
## edge east to 20°E a lap later): longitude WEST_LON at the left edge across LON_SPAN, latitude
## NORTH_LAT at the top down LAT_SPAN. Before .37 it was 640 wide, 60°E to 60°W, with no Europe.
const ART_SIZE := Vector2(840.0, 360.0)
const WEST_LON := 65.0
const LON_SPAN := 315.0
const NORTH_LAT := 70.0
const LAT_SPAN := 90.0
const SEA := Color("cfe6f5")
## Room round the leg on screen (more above, for the destination's flag), and the least of the
## map shown, in art pixels: a short hop (or the first city, flown to from nowhere) isn't blown
## up to fill the strip.
const PAD := 12.0
const PAD_TOP := 20.0
const LEAST_SPAN := Vector2(150.0, 54.0)
## Seconds the plane takes over the leg, and its size on screen.
const FLIGHT_SECONDS := 2.6
const PLANE_SIZE := 16.0
const DASH := 6.0

## The leg shown: into `to`, from `from` ("" for the first city on the route).
var from := ""
var to := ""

var _texture: Texture2D
## Where the art is drawn inside this control, and its scale.
var _art_rect := Rect2()
var _fit := 1.0
var _clock := 0.0


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	clip_contents = true
	_texture = Art.texture("world_map")
	resized.connect(_layout)
	_layout()


func _process(delta: float) -> void:
	_clock += delta
	queue_redraw()


## A city's place on the map art, from its latitude and longitude.
static func art_position(id: String) -> Vector2:
	var city: Dictionary = CITIES[id]
	return Vector2((city["lon"] - WEST_LON) / LON_SPAN * ART_SIZE.x, (NORTH_LAT - city["lat"]) / LAT_SPAN * ART_SIZE.y)


## How far the leg into `to_id` bows north, in art pixels: the city's own `arc`, or a quarter of
## a long hop's length (up to 70).
static func bulge(from_art: Vector2, to_art: Vector2, to_id: String) -> float:
	if CITIES[to_id].has("arc"):
		return CITIES[to_id]["arc"]
	var length := from_art.distance_to(to_art)
	return minf(length * 0.25, 70.0) if length > 80.0 else 0.0


## Fits the stretch of map round the leg (its ends, and the top of its arc) inside this control
## less its padding; the map carries on into the padding.
func _layout() -> void:
	if to == "" or size.x <= 0.0 or size.y <= 0.0:
		return
	var end := art_position(to)
	var box := Rect2(end, Vector2.ZERO)
	if from != "":
		var start := art_position(from)
		box = box.expand(start).expand((start + end) / 2.0 + Vector2(0.0, -bulge(start, end, to) / 2.0))
	var short := (LEAST_SPAN - box.size).max(Vector2.ZERO) / 2.0
	box = box.grow_individual(short.x, short.y, short.x, short.y)
	var inner := Rect2(Vector2(PAD, PAD_TOP), size - Vector2(PAD * 2.0, PAD_TOP + PAD))
	if inner.size.x <= 0.0 or inner.size.y <= 0.0:
		return
	# Widened on its short side to the room's own shape, so the map isn't stretched.
	var aspect := inner.size.x / inner.size.y
	if box.size.x < box.size.y * aspect:
		var extra := (box.size.y * aspect - box.size.x) / 2.0
		box = box.grow_individual(extra, 0.0, extra, 0.0)
	else:
		var extra := (box.size.x / aspect - box.size.y) / 2.0
		box = box.grow_individual(0.0, extra, 0.0, extra)
	_fit = inner.size.x / box.size.x
	_art_rect = Rect2(inner.position - box.position * _fit, ART_SIZE * _fit)


func _on_strip(art: Vector2) -> Vector2:
	return _art_rect.position + art * _fit


func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), SEA)
	if to == "" or _texture == null:
		return
	draw_texture_rect(_texture, _art_rect, false)
	var end := _on_strip(art_position(to))
	if from != "":
		var start := _on_strip(art_position(from))
		var control := (start + end) / 2.0 + Vector2(0.0, -bulge(art_position(from), art_position(to), to) * _fit)
		var points := PackedVector2Array()
		for step in 41:
			var t := step / 40.0
			points.append(start.lerp(control, t).lerp(control.lerp(end, t), t))
		_draw_dashes(points, Color(Art.INK, 0.8))
		draw_circle(start, 4.0, Art.PAPER)
		draw_arc(start, 4.0, 0.0, TAU, 16, Art.INK, 1.5, true)
		# The plane: along the curve, nose along it, taking off again once it lands.
		var t := fmod(_clock / FLIGHT_SECONDS, 1.0)
		var at := start.lerp(control, t).lerp(control.lerp(end, t), t)
		var heading := (control - start).lerp(end - control, t)
		var plane := Art.texture("plane")
		var plane_size := plane.get_size() * (PLANE_SIZE / maxf(plane.get_width(), plane.get_height()))
		# The plane art points north; turned to the heading.
		draw_set_transform(at, heading.angle() + PI / 2.0)
		draw_texture_rect(plane, Rect2(-plane_size / 2.0, plane_size), false)
		draw_set_transform(Vector2.ZERO)
	_draw_flag(end)


func _draw_dashes(points: PackedVector2Array, color: Color) -> void:
	var walked := 0.0
	for i in range(1, points.size()):
		var a := points[i - 1]
		var b := points[i]
		if fmod(walked, DASH * 2.0) < DASH:
			draw_line(a, b, color, 2.0, true)
		walked += a.distance_to(b)


## The destination's flag: a pole and a yellow pennant.
func _draw_flag(at: Vector2) -> void:
	draw_circle(at, 4.0, Color(Art.INK, 0.25))
	var top := at + Vector2(0.0, -20.0)
	draw_line(at, top, Art.INK, 2.0, true)
	var pennant := PackedVector2Array([top, top + Vector2(13.0, 4.0), top + Vector2(0.0, 8.0)])
	draw_colored_polygon(pennant, Art.BRAND)
	pennant.append(pennant[0])
	draw_polyline(pennant, Art.INK, 1.5, true)
	draw_circle(at, 3.0, Art.INK)
