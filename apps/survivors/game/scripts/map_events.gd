class_name MapEvents
extends Node2D
## Each map's own event (the map's MAP_EVENT, which the Spawner starts at its time, .26):
## - "quake" (硅谷 湾区地震): for a while the screen shakes and debris crashes down round the player,
##   each piece marked by a red circle a moment before it lands; it hurts whatever it lands on,
##   the crowd included, so dodging it can clear the way.
## - "sandstorm" (北京 沙尘暴): for a while a wind blows everyone east (the crowd harder than the
##   player) and the screen turns sandy.
## Drawn in the world over the enemies (the debris, the sand), under the HUD.

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
const DEBRIS := Color("8a909c")

var game: Game

var _id := ""
var _left := 0.0
var _seconds := 0.0
## Debris on its way down: where it lands, seconds until it does.
var _strikes: Array[Vector2] = []
var _strike_left := PackedFloat32Array()
var _next_strike := 0.0
var _shake_left := 0.0
var _clock := 0.0


func _init() -> void:
	# Over the entities and the hit effects, under the damage numbers.
	z_index = 15


## Starts the map's event `id`, lasting `seconds`.
func start(id: String, seconds: float) -> void:
	_id = id
	_left = seconds
	_seconds = seconds
	_next_strike = 0.0


func active() -> bool:
	return _left > 0.0 or not _strikes.is_empty()


func _process(delta: float) -> void:
	if game.state != Game.State.PLAYING or not active():
		if not active():
			queue_redraw()
		return
	_clock += delta
	_left -= delta
	match _id:
		"quake":
			_tick_quake(delta)
		"sandstorm":
			if _left > 0.0:
				_blow(delta)
	queue_redraw()


func _tick_quake(delta: float) -> void:
	if _left > 0.0:
		_shake_left -= delta
		if _shake_left <= 0.0:
			_shake_left = 0.2
			game.player.shake(0.25, 1.5)
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
