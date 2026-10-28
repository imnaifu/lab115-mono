class_name Traffic
extends RefCounted
## Scenery that moves: robotaxis driving both ways down the freeways and Caltrain running north
## up its track. Nothing collides with them. Positions are a pure function of time (vehicle k
## of a lane is at k * spacing, plus its own fixed jitter, moved on by speed * time), so there is
## no state to keep beyond a pool of sprites reused for whatever is on screen.

const CAR_SPEED := 95.0
const CAR_SPACING := 260.0
const CAR_JITTER := 90.0
const CAR_SIZE := 26.0
## Lanes either side of the centre line: southbound on the west half, northbound on the east.
const LANE_OFFSET := 17.0
const TRAIN_SPEED := 240.0
## One train every this many pixels of track, so about every 15 seconds at any one spot.
const TRAIN_SPACING := 3600.0
const TRAIN_LENGTH := 150.0
const MARGIN := 120.0

var _city: City
var _layer: Node2D
var _time := 0.0
var _cars: Array[Sprite2D] = []
var _trains: Array[Sprite2D] = []


func _init(city: City, layer: Node2D) -> void:
	_city = city
	_layer = layer


func tick(delta: float, view: Rect2) -> void:
	_time += delta
	var area := view.grow(MARGIN)
	var car_spots: Array = []
	for column: int in BayArea.FREEWAYS:
		var x := column * City.BLOCK.x
		if x < area.position.x - City.FREEWAY_HALF or x > area.end.x + City.FREEWAY_HALF:
			continue
		var freeway: Dictionary = BayArea.FREEWAYS[column]
		var start_y := maxf(area.position.y, freeway["from_row"] * City.BLOCK.y)
		for northbound in [true, false]:
			var shift := -_time * CAR_SPEED if northbound else _time * CAR_SPEED
			for at_y in _along(start_y, area.end.y, CAR_SPACING, shift, CAR_JITTER, column * 2 + (1 if northbound else 0)):
				var spot := Vector2(x + (LANE_OFFSET if northbound else -LANE_OFFSET), at_y)
				if not BayArea.is_water(spot):
					car_spots.append([spot, northbound])
	_show(_cars, car_spots, "car_top", CAR_SIZE)

	var train_spots: Array = []
	var track_x := BayArea.RAILWAY_COLUMN * City.BLOCK.x + City.RAILWAY_OFFSET
	if track_x > area.position.x and track_x < area.end.x:
		var start_y := maxf(area.position.y, BayArea.RAILWAY_FROM_ROW * City.BLOCK.y)
		for at_y in _along(start_y - TRAIN_LENGTH, area.end.y + TRAIN_LENGTH, TRAIN_SPACING, -_time * TRAIN_SPEED, 0.0, 99):
			train_spots.append([Vector2(track_x, at_y), true])
	_show(_trains, train_spots, "train_top", TRAIN_LENGTH)


## The positions between from_y and to_y of vehicles spaced `spacing` apart along a lane that
## has moved by `shift`, each nudged by its own fixed jitter.
func _along(from_y: float, to_y: float, spacing: float, shift: float, jitter: float, lane: int) -> Array:
	var spots: Array = []
	var first := floori((from_y - shift - jitter) / spacing)
	var last := ceili((to_y - shift + jitter) / spacing)
	for index in range(first, last + 1):
		var nudge := 0.0
		if jitter > 0.0:
			nudge = (_city.noise(index, lane, 21) - 0.5) * 2.0 * jitter
		var at_y := index * spacing + nudge + shift
		if at_y >= from_y and at_y <= to_y:
			spots.append(at_y)
	return spots


## Places the pool's sprites on the spots, growing the pool as needed and hiding the rest.
func _show(pool: Array[Sprite2D], spots: Array, art: String, size: float) -> void:
	while pool.size() < spots.size():
		var sprite := Art.sprite(art, size)
		_layer.add_child(sprite)
		pool.append(sprite)
	for i in pool.size():
		var sprite := pool[i]
		sprite.visible = i < spots.size()
		if sprite.visible:
			sprite.position = spots[i][0]
			# The art faces north; southbound traffic is turned round.
			sprite.rotation = 0.0 if spots[i][1] else PI
