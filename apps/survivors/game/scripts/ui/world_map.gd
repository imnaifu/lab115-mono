class_name WorldMap
extends Control
## The world map (.34, the user's call: Kingdom Rush's campaign map, to show the run of cities to
## work through): a map from India east across the Pacific and the Atlantic to Western Europe
## (assets/art/world_map.svg; .37 carried it on past the Atlantic so London is on it) with a flag
## on every city, a dashed route joining the playable ones in Maps.ORDER (easiest first), and grey
## pins for the cities still to come. A city that opens for the first time on this device has its
## leg of the route drawn in and its flag popped up (Settings "world_seen"). Tapping a flag selects
## it; the page round it (Hud._open_world_map) says what it is and starts it.

signal city_picked(id: String)

## Each city: latitude and longitude (east of Greenwich, 0-360; London, just west of it, is 359.9),
## its name, and which side of the pin its name tag goes. The playable ones are Maps.ORDER; the
## rest are Maps.COMING_SOON. `arc` is how far the leg of the route into it bows north, in art
## pixels (left out, it goes by the leg's length): 硅谷 to London and London back to 西雅图 cross
## the same stretch of map, so the second flies the polar way, over Greenland, well above the first.
const CITIES := {
	"sv": {"lat": 37.4, "lon": 237.9, "name": "硅谷", "tag": "below"},
	"ldn": {"lat": 51.5, "lon": 359.9, "name": "伦敦", "tag": "below", "arc": 36.0},
	"sea": {"lat": 47.6, "lon": 237.7, "name": "西雅图", "tag": "above", "arc": 100.0},
	"bj": {"lat": 39.9, "lon": 116.4, "name": "北京", "tag": "above"},
	"sz": {"lat": 22.5, "lon": 114.1, "name": "深圳", "tag": "right"},
	"sg": {"lat": 1.3, "lon": 103.8, "name": "新加坡", "tag": "right"},
	"blr": {"lat": 13.0, "lon": 77.6, "name": "班加罗尔", "tag": "right"},
}
## The map art's own size, and the projection it was drawn in (equirectangular, 65°E at the left
## edge east to 20°E a lap later): longitude WEST_LON at the left edge across LON_SPAN, latitude
## NORTH_LAT at the top down LAT_SPAN. Before .37 it was 640 wide, 60°E to 60°W, with no Europe.
const ART_SIZE := Vector2(840.0, 360.0)
const WEST_LON := 65.0
const LON_SPAN := 315.0
const NORTH_LAT := 70.0
const LAT_SPAN := 90.0
## A tap within this many pixels of a pin picks it; a press that moves further than DRAG_SLOP
## before it lets go is a drag, not a tap.
const PICK_RADIUS := 22.0
const DRAG_SLOP := 6.0
## Fitted whole into a tall page (a phone held upright), the map would be a thin strip with this
## much of the page's height or more left empty: there it fills the height instead and drags
## sideways (.37, once Europe made it wider), starting on the city picked. Sideways pages leave
## less than this empty and show the whole map.
const FILL_HEIGHT_WHEN := 0.45
const REVEAL_SECONDS := 1.2
const POP_SECONDS := 0.35
const DASH := 6.0
const LOCKED_GREY := Color("a9b3c4")

## The city the page shows (picked, or the map in use to begin with).
var selected := ""

var _texture: Texture2D
## Where the art is drawn inside this control, keeping its proportions.
var _art_rect := Rect2()
## Whether the map fills the height and drags sideways, how far it is slid left (pixels), and
## whether the player has dragged it (until then it keeps the city picked in the middle).
var _pannable := false
var _pan := 0.0
var _panned_by_hand := false
## A press on the map: where it started, and whether it has moved far enough to be a drag.
var _pressed := false
var _press_at := Vector2.ZERO
var _dragged := false
var _tags := {}
## The legs of the route still being drawn in: city id → seconds since its reveal started.
var _reveal := {}
var _clock := 0.0


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	clip_contents = true
	_texture = Art.texture("world_map")
	for id: String in CITIES:
		var tag := _make_tag(id)
		_tags[id] = tag
		add_child(tag)
	if selected == "":
		selected = Maps.current_id
	_start_reveals()
	resized.connect(_layout)
	_layout()


## Cities open now that this device hasn't seen open: their leg of the route and their flag
## come in one after the other, then they count as seen.
func _start_reveals() -> void:
	var seen: Array = Settings.get_value("world_seen", [])
	var delay := 0.0
	for id: String in Maps.ORDER:
		if Maps.unlocked(id) and not seen.has(id):
			_reveal[id] = -delay
			delay += REVEAL_SECONDS * 0.6
			seen.append(id)
	if not _reveal.is_empty():
		Settings.set_value("world_seen", seen)


func _process(delta: float) -> void:
	_clock += delta
	for id: String in _reveal.keys():
		_reveal[id] += delta
		if _reveal[id] >= REVEAL_SECONDS + POP_SECONDS:
			_reveal.erase(id)
	for id: String in _tags:
		(_tags[id] as Control).modulate.a = _pop(id)
	queue_redraw()


## A city's place in this control, from its latitude and longitude.
func city_position(id: String) -> Vector2:
	var city: Dictionary = CITIES[id]
	var art := Vector2((city["lon"] - WEST_LON) / LON_SPAN * ART_SIZE.x, (NORTH_LAT - city["lat"]) / LAT_SPAN * ART_SIZE.y)
	return _art_rect.position + art * (_art_rect.size.x / ART_SIZE.x)


func _layout() -> void:
	var fit := minf(size.x / ART_SIZE.x, size.y / ART_SIZE.y)
	_pannable = size.y - ART_SIZE.y * fit > size.y * FILL_HEIGHT_WHEN
	if _pannable:
		fit = size.y / ART_SIZE.y
	var drawn := ART_SIZE * fit
	if not _pannable:
		_art_rect = Rect2((size - drawn) / 2.0, drawn)
	else:
		if not _panned_by_hand:
			# The city picked in the middle, at whatever size the page has settled to.
			_art_rect = Rect2(Vector2.ZERO, drawn)
			_pan = city_position(selected).x - size.x / 2.0
		_pan = clampf(_pan, 0.0, maxf(drawn.x - size.x, 0.0))
		_art_rect = Rect2(Vector2(-_pan, 0.0), drawn)
	_place_tags()


## Each city's name tag beside its pin (CITIES `tag` says which side), kept inside the map's edges
## while its pin is on screen.
func _place_tags() -> void:
	for id: String in _tags:
		var tag: Control = _tags[id]
		var tag_size := tag.get_combined_minimum_size()
		var at := city_position(id)
		match CITIES[id]["tag"]:
			"above":
				tag.position = at + Vector2(-tag_size.x / 2.0, -tag_size.y - 22.0)
			"right":
				tag.position = at + Vector2(10.0, -tag_size.y / 2.0)
			_:
				tag.position = at + Vector2(-tag_size.x / 2.0, 8.0)
		if at.x >= 0.0 and at.x <= size.x:
			tag.position = tag.position.clamp(Vector2.ZERO, (size - tag_size).max(Vector2.ZERO))
		tag.size = tag_size


## The name tag under (or over) a pin: 西雅图 · 975, or 深圳 · 即将开放.
func _make_tag(id: String) -> Control:
	var playable := Maps.ORDER.has(id)
	var text := tr(CITIES[id]["name"])
	text += " · " + (Maps.script_of(id).HOURS if playable else tr("即将开放"))
	var open := playable and Maps.unlocked(id)
	var tag := UiKit.tag(text, Art.PAPER if open else Art.PAPER_SUNK, Art.INK if open else Art.INK_MUTED, 1, 10)
	tag.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return tag


## A tap picks the city under it; a drag slides the map when it is wider than the page. Mouse
## events only: a phone's touches come as mouse events too (emulate_mouse_from_touch, on by
## default), and handling both would slide the map twice as far.
func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			_pressed = true
			_dragged = false
			_press_at = event.position
		elif _pressed:
			_pressed = false
			if not _dragged:
				_pick(event.position)
		accept_event()
	elif event is InputEventMouseMotion and _pressed:
		if event.position.distance_to(_press_at) > DRAG_SLOP:
			_dragged = true
		if _dragged and _pannable:
			_panned_by_hand = true
			_pan -= event.relative.x
			_layout()
		accept_event()


func _pick(at: Vector2) -> void:
	var best := ""
	var best_distance := PICK_RADIUS
	for id: String in CITIES:
		var distance := city_position(id).distance_to(at)
		if distance <= best_distance:
			best = id
			best_distance = distance
	if best != "":
		selected = best
		city_picked.emit(best)


## How far a city's flag has popped up (0 hidden, 1 standing): only while it is being revealed.
func _pop(id: String) -> float:
	if not _reveal.has(id):
		return 1.0
	return clampf((_reveal[id] - REVEAL_SECONDS) / POP_SECONDS, 0.0, 1.0)


## How much of the leg into `id` is drawn (1 once revealed, or for a city not being revealed).
func _leg(id: String) -> float:
	if not _reveal.has(id):
		return 1.0
	return clampf(_reveal[id] / REVEAL_SECONDS, 0.0, 1.0)


func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color("cfe6f5"))
	if _texture != null:
		draw_texture_rect(_texture, _art_rect, false)
	# The route, leg by leg in ORDER: solid ink into an open city, faint into a locked one.
	for i in range(1, Maps.ORDER.size()):
		var from_id: String = Maps.ORDER[i - 1]
		var to_id: String = Maps.ORDER[i]
		var open := Maps.unlocked(to_id)
		_draw_leg(city_position(from_id), city_position(to_id), _leg(to_id), Color(Art.INK, 0.85) if open else Color(Art.INK, 0.3),
			CITIES[to_id].get("arc", -1.0))
	for id: String in CITIES:
		_draw_pin(id)


## A dashed leg of the route. Long hops arc north (over the Pacific, the way the flights go);
## short ones are straight. `amount` is how much of it is drawn, for the reveal; `arc` (art pixels,
## CITIES) sets the bow instead when given.
func _draw_leg(from: Vector2, to: Vector2, amount: float, color: Color, arc := -1.0) -> void:
	if amount <= 0.0:
		return
	var bulge := minf(from.distance_to(to) * 0.25, 70.0) if from.distance_to(to) > 80.0 else 0.0
	if arc >= 0.0:
		bulge = arc * _art_rect.size.x / ART_SIZE.x
	var control := (from + to) / 2.0 + Vector2(0.0, -bulge)
	var points := PackedVector2Array()
	var steps := 48
	for step in roundi(steps * amount) + 1:
		var t := float(step) / steps
		points.append(from.lerp(control, t).lerp(control.lerp(to, t), t))
	# Dashes: every other stretch of DASH pixels along the curve.
	var walked := 0.0
	for i in range(1, points.size()):
		var a := points[i - 1]
		var b := points[i]
		var length := a.distance_to(b)
		var dash_on := fmod(walked, DASH * 2.0) < DASH
		if dash_on:
			draw_line(a, b, color, 2.0, true)
		walked += length


func _draw_pin(id: String) -> void:
	var at := city_position(id)
	var pop := _pop(id)
	if pop <= 0.0:
		return
	if not Maps.ORDER.has(id):
		# Still to come: a grey dot with a dashed ring.
		draw_circle(at, 4.0, LOCKED_GREY)
		draw_arc(at, 8.0, 0.0, TAU, 16, Color(LOCKED_GREY, 0.8), 1.2, true)
		return
	var open := Maps.unlocked(id)
	var current := id == Maps.current_id
	if id == selected:
		var pulse := 0.5 + 0.5 * sin(_clock * 4.0)
		draw_circle(at, 13.0 + 2.0 * pulse, Color(Art.PAPER, 0.55))
		draw_arc(at, 13.0 + 2.0 * pulse, 0.0, TAU, 32, Art.BRAND_DEEP, 2.0, true)
	draw_circle(at, 5.0, Color(Art.INK, 0.25))
	# The flag, rising as it pops: pole, then a pennant in the city's state colour.
	var height := 22.0 * pop
	var top := at + Vector2(0.0, -height)
	draw_line(at, top, Art.INK, 2.0, true)
	var colour := Art.BRAND if current else (Art.BLUE if open else LOCKED_GREY)
	var pennant := PackedVector2Array([top, top + Vector2(14.0, 4.0) * pop, top + Vector2(0.0, 9.0) * pop])
	draw_colored_polygon(pennant, colour)
	pennant.append(pennant[0])
	draw_polyline(pennant, Art.INK, 1.5, true)
	draw_circle(at, 3.0, Art.INK)
	if not open:
		_draw_lock(at + Vector2(10.0, -4.0))


## A small padlock beside a locked city's flag.
func _draw_lock(at: Vector2) -> void:
	draw_arc(at + Vector2(0.0, -3.0), 3.0, PI, TAU, 10, Art.INK, 1.6, true)
	var body := Rect2(at + Vector2(-4.5, -3.0), Vector2(9.0, 7.0))
	draw_rect(body, Art.BRAND)
	draw_rect(body, Art.INK, false, 1.4)
