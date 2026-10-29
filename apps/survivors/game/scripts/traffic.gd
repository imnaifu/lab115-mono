class_name Traffic
extends RefCounted
## Robotaxis driving both ways down the freeways and Caltrain running north up its track.
## Positions are a pure function of time (vehicle k of a lane is at k * spacing, plus its own
## fixed jitter, moved on by speed * time), so there is no state to keep beyond a pool of
## sprites reused for whatever is on screen.
##
## They bump into things but never hurt them: the player and enemies they run into are pushed
## out sideways, off the lane (pushed along it, a player would be carried off faster than they can
## walk). Bosses don't budge (their knockback resistance). A train coming makes its track flash
## first, so being hit by one is never a surprise.
##
## A bump shows: dust off whatever was hit, enemies spinning off the road, the player leaning
## over, a car rocking for a moment, speed lines off a train, and now and then a 砰.

const CAR_SPEED := 95.0
## Halved (from 260) when cars started bumping into things, so crossing a freeway is a matter of
## timing rather than luck.
const CAR_SPACING := 520.0
const CAR_JITTER := 180.0
const CAR_SIZE := 26.0
## The car's footprint either side of its centre: across the lane and along it.
const CAR_HALF := Vector2(8.0, 13.0)
const TRAIN_HALF_WIDTH := 10.0
## Sideways pushes: enemies get a good shove; the player less, to stay in control.
const CAR_PUSH_ENEMY := 220.0
const TRAIN_PUSH_ENEMY := 320.0
const CAR_PUSH_PLAYER := 140.0
const TRAIN_PUSH_PLAYER := 200.0
## An enemy is shoved at most once this often by any one vehicle passing over it.
const ENEMY_SHOVE_GAP := 0.4
## The track flashes for this long before a train comes on screen.
const TRAIN_WARNING_SECONDS := 1.5
## A 砰 at most this often, so a car ploughing through a crowd says it once.
const BANG_GAP := 0.6
## A train hitting something this close to the player shakes the screen.
const TRAIN_SHAKE_REACH := 160.0
## A car that hit something rocks (up to WOBBLE radians) for this long.
const WOBBLE := 0.2
const WOBBLE_SECONDS := 0.35
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
## Enemy instance id -> when traffic last shoved it.
var _shoved_at := {}
## A car (lane, its place along the lane) -> when it last hit something, for its rocking.
var _hit_at := {}
var _last_bang := -INF
var _warning: TrackWarning


func _init(city: City, layer: Node2D) -> void:
	_city = city
	_layer = layer
	_warning = TrackWarning.new()
	# On the ground, under everyone in the entity layer, above the city.
	_warning.z_index = -3
	_layer.add_child(_warning)


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
					# Where it sits along the lane with the drive taken out names the car for good.
					car_spots.append([spot, northbound, Vector2i(column * 2 + (1 if northbound else 0), roundi(at_y - shift))])
	_show(_cars, car_spots, "car_top", CAR_SIZE)

	var train_spots: Array = []
	var track_x := BayArea.RAILWAY_COLUMN * City.BLOCK.x + City.RAILWAY_OFFSET
	var warn := false
	if track_x > area.position.x and track_x < area.end.x:
		var start_y := maxf(area.position.y, BayArea.RAILWAY_FROM_ROW * City.BLOCK.y)
		for at_y in _along(start_y - TRAIN_LENGTH, area.end.y + TRAIN_LENGTH, TRAIN_SPACING, -_time * TRAIN_SPEED, 0.0, 99):
			train_spots.append([Vector2(track_x, at_y), true])
		# A train still below the screen (they run north) and due within the warning time.
		var due_reach := view.end.y + TRAIN_LENGTH / 2.0 + TRAIN_SPEED * TRAIN_WARNING_SECONDS
		for at_y in _along(view.end.y, due_reach, TRAIN_SPACING, -_time * TRAIN_SPEED, 0.0, 99):
			warn = warn or at_y - TRAIN_LENGTH / 2.0 > view.end.y
	_show(_trains, train_spots, "train_top", TRAIN_LENGTH)
	_warning.show_on(warn, track_x, view, _time)

	var game := _city.game
	if game != null and game.state == Game.State.PLAYING:
		for spot: Array in car_spots:
			if _bump(game, spot[0], CAR_HALF, CAR_PUSH_ENEMY, CAR_PUSH_PLAYER, false):
				_hit_at[spot[2]] = _time
		for spot: Array in train_spots:
			_bump(game, spot[0], Vector2(TRAIN_HALF_WIDTH, TRAIN_LENGTH / 2.0), TRAIN_PUSH_ENEMY, TRAIN_PUSH_PLAYER, true)
		# Forget enemies not shoved and cars not rocking for a while, so the tables don't grow
		# over a run.
		if _shoved_at.size() > 200:
			for key in _shoved_at.keys():
				if _time - _shoved_at[key] > ENEMY_SHOVE_GAP:
					_shoved_at.erase(key)
		if _hit_at.size() > 50:
			for key in _hit_at.keys():
				if _time - _hit_at[key] > WOBBLE_SECONDS:
					_hit_at.erase(key)


## Pushes the player and enemies overlapping a vehicle centred at `at` (its footprint `half`
## either side, the lane running north-south) out sideways, away from its centre line. Whether
## it shoved anything (a car that did rocks).
func _bump(game: Game, at: Vector2, half: Vector2, enemy_push: float, player_push: float, train: bool) -> bool:
	var hit := false
	var player := game.player
	if _overlaps(player.position, Player.BODY_RADIUS, at, half):
		var push := Vector2(_side(player.position.x, at.x) * player_push, 0.0)
		if player.shove(push):
			hit = true
			_impact(game, player.position, push, train)
			if train:
				game.achievements.on_train_hit()
	for enemy in game.query_enemies(at, half.length()):
		if not _overlaps(enemy.position, enemy.radius, at, half):
			continue
		var key := enemy.get_instance_id()
		if _time - _shoved_at.get(key, -INF) < ENEMY_SHOVE_GAP:
			continue
		_shoved_at[key] = _time
		var push := Vector2(_side(enemy.position.x, at.x) * enemy_push, 0.0)
		enemy.shove(push, true)
		hit = true
		_impact(game, enemy.position, push, train)
	return hit


## What a bump looks like where it landed: dust, speed lines off a train, now and then a 砰,
## and a shake when a train hits something near the player.
func _impact(game: Game, at: Vector2, push: Vector2, train: bool) -> void:
	Effects.dust(game, at, push)
	if train:
		Effects.streaks(game, at, push)
		if at.distance_to(game.player.position) < TRAIN_SHAKE_REACH:
			game.player.shake(0.15, 2.5)
	if _time - _last_bang >= BANG_GAP:
		_last_bang = _time
		Effects.callout(game, at, tr("砰！"), Art.YELLOW, 16 if train else 13)


static func _overlaps(point: Vector2, radius: float, at: Vector2, half: Vector2) -> bool:
	return absf(point.x - at.x) <= half.x + radius and absf(point.y - at.y) <= half.y + radius


## Which way out of the lane: away from the vehicle's centre line (right when dead on it).
static func _side(x: float, centre_x: float) -> float:
	return -1.0 if x < centre_x else 1.0


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
			if spots[i].size() > 2:
				sprite.rotation += _wobble(spots[i][2])


## How far a car that just hit something is rocked over, dying away over WOBBLE_SECONDS.
func _wobble(car: Vector2i) -> float:
	var since: float = _time - _hit_at.get(car, -INF)
	if since >= WOBBLE_SECONDS:
		return 0.0
	return sin(since * 45.0) * WOBBLE * (1.0 - since / WOBBLE_SECONDS)


## A red band pulsing over the stretch of track on screen while a train is on its way.
class TrackWarning:
	extends Node2D

	const COLOR := Color("ff5d5d")

	var _from := Vector2.ZERO
	var _to := Vector2.ZERO
	var _alpha := 0.0

	func show_on(warn: bool, track_x: float, view: Rect2, time: float) -> void:
		visible = warn
		if not warn:
			return
		_from = Vector2(track_x, view.position.y)
		_to = Vector2(track_x, view.end.y)
		_alpha = 0.25 + 0.2 * sin(time * 14.0)
		queue_redraw()

	func _draw() -> void:
		draw_line(_from, _to, Color(COLOR, _alpha), (City.RAILWAY_HALF + 4.0) * 2.0)
