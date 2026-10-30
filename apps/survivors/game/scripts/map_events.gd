class_name MapEvents
extends Node2D
## Each map's own event (the map's MAP_EVENT, which the Spawner starts at its time, .26):
## - "quake" (硅谷 湾区地震): for a while debris crashes down round the player (the screen shook all
##   the while until .34; the user found it hard on the eyes, so it no longer does),
##   each piece marked by a red circle a moment before it lands; it hurts whatever it lands on,
##   the crowd included, so dodging it can clear the way.
## - "sandstorm" (北京 沙尘暴): for a while a wind blows everyone east (the crowd harder than the
##   player) and the screen turns sandy.
## - "rain" (西雅图 下雨, .34): for a while it rains, and puddles open up round the player; anyone
##   standing in one is slowed (the crowd more than the player), so leading the crowd through
##   them pays. They dry up a few seconds after the rain stops.
## - "fog" (伦敦 大雾, .37): for a while a fog rolls in; only a ring round the player stays clear
##   (and the fog thins rather than hides, so a boss's warnings still show through), and the
##   crowd, as lost in it as the player, walks slower.
## - "heat" (新加坡 热浪, .38): for a while it's sweltering; out in the open the player loses a
##   little health every second, and a few cool air-conditioned spots (a convenience store's
##   doorway, a mall's) open round them, where they don't. The spots move on every few seconds,
##   so the player can't settle in one while the crowd closes round.
## Drawn in the world over the enemies (the debris, the sand, the rain), under the HUD; puddles
## and cool spots on the ground under everyone.

const QUAKE_STRIKE_GAP := 0.35
const QUAKE_WARNING := 1.0
const QUAKE_RADIUS := 26.0
## Debris lands within this of the player.
const QUAKE_REACH := 220.0
const QUAKE_DAMAGE := 12.0
const QUAKE_CROWD_DAMAGE := 40.0
const QUAKE_DROP := 120.0
const SAND_WIND := Vector2(0.99, 0.14)
## Pixels per second: the player is blown less than they walk (56-71).
const SAND_PLAYER_SPEED := 28.0
const SAND_CROWD_SPEED := 40.0
const SAND_TINT := Color(0.86, 0.72, 0.42, 0.3)
const RAIN_PUDDLE_GAP := 0.45
## Puddles open within this of the player, at most RAIN_MAX_PUDDLES at once (the oldest goes).
const RAIN_REACH := 230.0
const RAIN_PUDDLE_RADIUS := [26.0, 42.0]
const RAIN_MAX_PUDDLES := 18
## Seconds a new puddle takes to spread, and puddles take to dry once the rain stops.
const RAIN_SPREAD := 0.6
const RAIN_DRY := 3.0
## In a puddle: the player loses this share of their walking speed; the crowd walks at this
## share of theirs (bosses shrug off half of it, Enemy.slow).
const RAIN_PLAYER_SLOW := 0.35
const RAIN_CROWD_SLOW := 0.5
const RAIN_TINT := Color(0.32, 0.42, 0.58, 0.22)
## The fog: clear within FOG_CLEAR of the player, thickening over FOG_SOFT to FOG_ALPHA beyond;
## the crowd walks at FOG_CROWD_SLOW of its speed while it lasts (bosses shrug off half, Enemy.slow).
const FOG_CLEAR := 100.0
const FOG_SOFT := 80.0
const FOG_ALPHA := 0.82
const FOG_COLOR := Color(0.8, 0.82, 0.85)
const FOG_CROWD_SLOW := 0.75
## Seconds the fog takes to roll in and to lift.
const FOG_FADE := 1.5
## The heat: HEAT_DAMAGE every HEAT_TICK seconds outside a cool spot (times the map's damage, less
## armour, like any hit); HEAT_SPOTS cool spots of HEAT_SPOT_RADIUS at a time, each opening
## HEAT_SPOT_REACH from the player and lasting HEAT_SPOT_LIFE (fading in and out over
## HEAT_SPOT_FADE), then another opens elsewhere.
const HEAT_TICK := 1.0
const HEAT_DAMAGE := 3.0
const HEAT_SPOTS := 3
const HEAT_SPOT_RADIUS := 44.0
const HEAT_SPOT_REACH := [110.0, 210.0]
const HEAT_SPOT_LIFE := 7.0
const HEAT_SPOT_FADE := 0.6
const HEAT_TINT := Color(1.0, 0.55, 0.2, 0.16)
const COOL := Color("8fd3ff")
const PUDDLE := Color("7fa8c9")
const DEBRIS := Color("8a909c")

var game: Game

var _id := ""
var _left := 0.0
var _seconds := 0.0
## Debris on its way down: where it lands, seconds until it does.
var _strikes: Array[Vector2] = []
var _strike_left := PackedFloat32Array()
var _next_strike := 0.0
var _clock := 0.0
## Puddles: where, full size, and age (negative once drying: seconds left).
var _puddles: Array[Vector2] = []
var _puddle_radius := PackedFloat32Array()
var _puddle_age := PackedFloat32Array()
var _next_puddle := 0.0
## Cool spots in the heat: where, and how long each has been open; the next heat tick.
var _cool_spots: Array[Vector2] = []
var _cool_age := PackedFloat32Array()
var _heat_tick := 0.0
## The puddles are drawn on the ground, under the crowd, unlike the rest of this node.
var _ground: Node2D


func _init() -> void:
	# Over the entities and the hit effects, under the damage numbers.
	z_index = 15
	_ground = Node2D.new()
	# Relative to this node's 15: -4 overall, on the ground like a meeting room.
	_ground.z_index = -19
	_ground.draw.connect(_draw_ground)
	add_child(_ground)


## Starts the map's event `id`, lasting `seconds`.
func start(id: String, seconds: float) -> void:
	_id = id
	_left = seconds
	_seconds = seconds
	_next_strike = 0.0
	# The first tick of heat a moment after it starts, once the cool spots are there to reach.
	_heat_tick = HEAT_TICK * 1.5
	_cool_spots.clear()
	_cool_age.resize(0)


## Seconds the weather itself has left (0 once over, even while debris or puddles linger): the
## HUD keeps the event's name on screen this long.
func weather_left() -> float:
	return maxf(_left, 0.0)


func active() -> bool:
	return _left > 0.0 or not _strikes.is_empty() or not _puddles.is_empty() or not _cool_spots.is_empty()


func _process(delta: float) -> void:
	if game.state != Game.State.PLAYING or not active():
		if not active():
			queue_redraw()
			# Clears the last puddles off the ground once the event is over.
			_ground.queue_redraw()
		return
	_clock += delta
	_left -= delta
	match _id:
		"quake":
			_tick_quake(delta)
		"sandstorm":
			if _left > 0.0:
				_blow(delta)
		"rain":
			_tick_rain(delta)
			_ground.queue_redraw()
		"fog":
			if _left > 0.0:
				for enemy in game.enemies:
					if not enemy.dead:
						enemy.slow(FOG_CROWD_SLOW, 0.2)
		"heat":
			_tick_heat(delta)
			_ground.queue_redraw()
	queue_redraw()


func _tick_quake(delta: float) -> void:
	if _left > 0.0:
		_next_strike -= delta
		if _next_strike <= 0.0:
			_next_strike = QUAKE_STRIKE_GAP
			var offset := Vector2.from_angle(game.rng.randf() * TAU) * sqrt(game.rng.randf()) * QUAKE_REACH
			var at := game.player.position + offset
			if not game.city.is_water(at):
				_strikes.append(at)
				_strike_left.append(QUAKE_WARNING)
	for i in range(_strikes.size() - 1, -1, -1):
		_strike_left[i] -= delta
		if _strike_left[i] <= 0.0:
			_land(_strikes[i])
			_strikes.remove_at(i)
			_strike_left.remove_at(i)


func _land(at: Vector2) -> void:
	Effects.poof(game, at, DEBRIS)
	Effects.dust(game, at, Vector2.UP)
	if game.player.position.distance_to(at) <= QUAKE_RADIUS + Player.HURT_RADIUS:
		game.hurt_player(QUAKE_DAMAGE * Maps.current.DIFFICULTY["damage"], "quake_debris", "debris")
	for enemy in game.query_enemies(at, QUAKE_RADIUS):
		game.damage_enemy(enemy, QUAKE_CROWD_DAMAGE, (enemy.position - at).normalized() * 60.0, "quake_debris", true)


func _tick_rain(delta: float) -> void:
	if _left > 0.0:
		_next_puddle -= delta
		if _next_puddle <= 0.0:
			_next_puddle = RAIN_PUDDLE_GAP
			var at := game.player.position + Vector2.from_angle(game.rng.randf() * TAU) * sqrt(game.rng.randf()) * RAIN_REACH
			if not game.city.is_water(at):
				if _puddles.size() >= RAIN_MAX_PUDDLES:
					_puddles.remove_at(0)
					_puddle_radius.remove_at(0)
					_puddle_age.remove_at(0)
				_puddles.append(at)
				_puddle_radius.append(game.rng.randf_range(RAIN_PUDDLE_RADIUS[0], RAIN_PUDDLE_RADIUS[1]))
				_puddle_age.append(0.0)
	for i in range(_puddles.size() - 1, -1, -1):
		if _left > 0.0:
			_puddle_age[i] += delta
		else:
			# Rain over: each starts drying (a countdown, kept negative), then goes.
			_puddle_age[i] = -RAIN_DRY if _puddle_age[i] >= 0.0 else _puddle_age[i] + delta
			if _puddle_age[i] >= 0.0:
				_puddles.remove_at(i)
				_puddle_radius.remove_at(i)
				_puddle_age.remove_at(i)
				continue
		var reach := _puddle_reach(i)
		if game.player.position.distance_to(_puddles[i]) <= reach:
			game.player.drift(-game.player.velocity * RAIN_PLAYER_SLOW)
		for enemy in game.query_enemies(_puddles[i], reach):
			enemy.slow(RAIN_CROWD_SLOW, 0.2)


## The heat: cool spots kept up round the player while it lasts (each moving on when its time is
## up), and a little health lost every tick outside them. The spots go when the heat does.
func _tick_heat(delta: float) -> void:
	if _left <= 0.0:
		_cool_spots.clear()
		_cool_age.resize(0)
		return
	for i in range(_cool_spots.size() - 1, -1, -1):
		_cool_age[i] += delta
		if _cool_age[i] >= HEAT_SPOT_LIFE:
			_cool_spots.remove_at(i)
			_cool_age.remove_at(i)
	while _cool_spots.size() < HEAT_SPOTS:
		var at := game.player.position
		# A few tries for a spot on land.
		for attempt in 8:
			at = game.player.position + Vector2.from_angle(game.rng.randf() * TAU) * game.rng.randf_range(HEAT_SPOT_REACH[0], HEAT_SPOT_REACH[1])
			if not game.city.is_water(at):
				break
		# The first ones staggered (already partly through their time), so they don't all move on
		# at once; later ones start fresh.
		var head_start := HEAT_SPOT_LIFE * _cool_spots.size() / HEAT_SPOTS if _seconds - _left < 0.1 else 0.0
		_cool_spots.append(at)
		_cool_age.append(head_start)
	_heat_tick -= delta
	if _heat_tick > 0.0:
		return
	_heat_tick = HEAT_TICK
	for i in _cool_spots.size():
		if _cool_strength(i) > 0.0 and game.player.position.distance_to(_cool_spots[i]) <= HEAT_SPOT_RADIUS:
			return
	game.hurt_player(HEAT_DAMAGE * Maps.current.DIFFICULTY["damage"], "heat", "heat")


## How open a cool spot is (0 to 1): fading in when new, out before it moves on. The first ones
## come in open, however far through their time they start.
func _cool_strength(index: int) -> float:
	var age := _cool_age[index]
	var fading_in := age / HEAT_SPOT_FADE if age < HEAT_SPOT_FADE and _seconds - _left > HEAT_SPOT_FADE + 0.1 else 1.0
	return clampf(minf(fading_in, (HEAT_SPOT_LIFE - age) / HEAT_SPOT_FADE), 0.0, 1.0)


## A puddle's size now: spreading when new, shrinking as it dries.
func _puddle_reach(index: int) -> float:
	var age := _puddle_age[index]
	var scale := clampf(age / RAIN_SPREAD, 0.0, 1.0) if age >= 0.0 else clampf(-age / RAIN_DRY, 0.0, 1.0)
	return _puddle_radius[index] * scale


func _draw_ground() -> void:
	_draw_cool_spots()
	_draw_puddles()


## The cool spots: pale blue rings on the ground, a snowflake in the middle, frost ticking round.
func _draw_cool_spots() -> void:
	var snowflake := Art.texture("icon_snowflake")
	for i in _cool_spots.size():
		var strength := _cool_strength(i)
		if strength <= 0.0:
			continue
		var at := _cool_spots[i]
		_ground.draw_set_transform(at, 0.0, Vector2(1.0, 0.62))
		_ground.draw_circle(Vector2.ZERO, HEAT_SPOT_RADIUS, Color(COOL, 0.4 * strength))
		_ground.draw_arc(Vector2.ZERO, HEAT_SPOT_RADIUS, 0.0, TAU, 40, Color(Art.LINK, 0.8 * strength), 2.0, true)
		for tick in 8:
			var from := _clock * 0.6 + TAU * tick / 8.0
			_ground.draw_arc(Vector2.ZERO, HEAT_SPOT_RADIUS - 6.0, from, from + 0.25, 4, Color(1, 1, 1, 0.8 * strength), 2.0, true)
		_ground.draw_set_transform(Vector2.ZERO)
		var icon_size := Vector2.ONE * 18.0
		_ground.draw_texture_rect(snowflake, Rect2(at - icon_size / 2.0, icon_size), false, Color(1, 1, 1, strength))


func _draw_puddles() -> void:
	for i in _puddles.size():
		var reach := _puddle_reach(i)
		if reach <= 1.0:
			continue
		var at := _puddles[i]
		_ground.draw_set_transform(at, 0.0, Vector2(1.0, 0.62))
		_ground.draw_circle(Vector2.ZERO, reach, Color(PUDDLE, 0.55))
		_ground.draw_arc(Vector2.ZERO, reach, 0.0, TAU, 32, Color(PUDDLE.darkened(0.25), 0.8), 1.5, true)
		# Rings spreading where drops land.
		if _left > 0.0:
			var ripple := fposmod(_clock * 0.8 + float(i) * 0.37, 1.0)
			_ground.draw_arc(Vector2(reach * 0.3, 0.0), reach * 0.5 * ripple, 0.0, TAU, 20, Color(1, 1, 1, 0.6 * (1.0 - ripple)), 1.2, true)
	_ground.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)


## The wind: the player carried a little, the crowd more (bosses half as much).
func _blow(delta: float) -> void:
	var wind := SAND_WIND.normalized()
	game.player.drift(wind * SAND_PLAYER_SPEED)
	for enemy in game.enemies:
		if not enemy.dead:
			enemy.position += wind * SAND_CROWD_SPEED * (0.5 if enemy.is_elite else 1.0) * delta


func _draw() -> void:
	if not active():
		return
	match _id:
		"quake":
			for i in _strikes.size():
				var progress := 1.0 - _strike_left[i] / QUAKE_WARNING
				var at := _strikes[i]
				draw_circle(at, QUAKE_RADIUS, Color(Art.BOSS_RED, 0.1 + 0.15 * progress))
				draw_arc(at, QUAKE_RADIUS, 0.0, TAU, 32, Color(Art.BOSS_RED, 0.8), 1.5, true)
				# The chunk falling onto its circle, its shadow growing under it.
				draw_circle(at, QUAKE_RADIUS * 0.6 * progress, Color(Art.INK, 0.15))
				var chunk := at + Vector2(0.0, -QUAKE_DROP * (1.0 - progress * progress))
				var rock := PackedVector2Array([chunk + Vector2(-9, -4), chunk + Vector2(-3, -10), chunk + Vector2(8, -7),
					chunk + Vector2(10, 3), chunk + Vector2(2, 9), chunk + Vector2(-8, 6)])
				draw_colored_polygon(rock, DEBRIS)
				rock.append(rock[0])
				draw_polyline(rock, Art.INK, 2.0, true)
		"sandstorm":
			if _left <= 0.0:
				return
			# Fades in and out over a second at either end.
			var strength := clampf(minf(_left, _seconds - _left), 0.0, 1.0)
			var half := game.view_half() * 1.6
			var view := Rect2(game.player.position - half, half * 2.0)
			draw_rect(view, Color(SAND_TINT, SAND_TINT.a * strength))
			# Streaks of sand racing along the wind.
			var wind := SAND_WIND.normalized()
			for i in 40:
				var scatter := float(i) * 37.13
				var x := fposmod(scatter * 53.7 + _clock * 260.0, view.size.x)
				var y := fposmod(scatter * 91.3 + _clock * 30.0, view.size.y)
				var from := view.position + Vector2(x, y)
				draw_line(from, from + wind * 18.0, Color(0.95, 0.85, 0.6, 0.6 * strength), 1.5, true)
		"fog":
			if _left <= 0.0:
				return
			_draw_fog(clampf(minf(_left, _seconds - _left) / FOG_FADE, 0.0, 1.0))
		"heat":
			if _left <= 0.0:
				return
			# A warm wash over the screen and shimmer rising off the ground.
			var strength := clampf(minf(_left, _seconds - _left), 0.0, 1.0)
			var half := game.view_half() * 1.6
			var view := Rect2(game.player.position - half, half * 2.0)
			draw_rect(view, Color(HEAT_TINT, HEAT_TINT.a * strength))
			for i in 24:
				var scatter := float(i) * 33.7
				var x := fposmod(scatter * 47.1, view.size.x)
				var y := fposmod(scatter * 77.3 - _clock * 40.0, view.size.y)
				var from := view.position + Vector2(x, y)
				var wave := PackedVector2Array()
				for step in 6:
					wave.append(from + Vector2(sin(_clock * 3.0 + step + i) * 3.0, -step * 5.0))
				draw_polyline(wave, Color(1.0, 0.85, 0.6, 0.45 * strength), 1.5, true)
		"rain":
			if _left <= 0.0:
				return
			var strength := clampf(minf(_left, _seconds - _left), 0.0, 1.0)
			var half := game.view_half() * 1.6
			var view := Rect2(game.player.position - half, half * 2.0)
			draw_rect(view, Color(RAIN_TINT, RAIN_TINT.a * strength))
			# Rain slanting down.
			var fall := Vector2(-0.25, 1.0).normalized()
			for i in 70:
				var scatter := float(i) * 29.71
				var x := fposmod(scatter * 61.3 - _clock * 90.0, view.size.x)
				var y := fposmod(scatter * 83.9 + _clock * 520.0, view.size.y)
				var from := view.position + Vector2(x, y)
				draw_line(from, from + fall * 12.0, Color(0.85, 0.92, 1.0, 0.55 * strength), 1.2, true)


## The fog over everything but a ring round the player: clear inside FOG_CLEAR, thickening across
## FOG_SOFT, then even out past the edges of the screen; a few slow wisps drifting through it.
## `strength` fades it in and out.
func _draw_fog(strength: float) -> void:
	var center := game.player.position
	var far := game.view_half().length() * 1.3
	var clear := Color(FOG_COLOR, 0.0)
	var thick := Color(FOG_COLOR, FOG_ALPHA * strength)
	var steps := 48
	for i in steps:
		var from := Vector2.from_angle(TAU * i / steps)
		var to := Vector2.from_angle(TAU * (i + 1) / steps)
		var inner := FOG_CLEAR
		var middle := FOG_CLEAR + FOG_SOFT
		draw_polygon(PackedVector2Array([center + from * inner, center + to * inner, center + to * middle, center + from * middle]),
			PackedColorArray([clear, clear, thick, thick]))
		draw_colored_polygon(PackedVector2Array([center + from * middle, center + to * middle, center + to * far, center + from * far]), thick)
	# Wisps: long pale strokes drifting east, in the thick of it.
	var half := game.view_half() * 1.2
	var view := Rect2(center - half, half * 2.0)
	for i in 14:
		var scatter := float(i) * 41.7
		var x := fposmod(scatter * 37.3 + _clock * 18.0, view.size.x)
		var y := fposmod(scatter * 71.9, view.size.y)
		var from := view.position + Vector2(x, y)
		if from.distance_to(center) < FOG_CLEAR + FOG_SOFT * 0.5:
			continue
		draw_line(from, from + Vector2(46.0, 0.0), Color(1, 1, 1, 0.45 * strength), 5.0, true)
