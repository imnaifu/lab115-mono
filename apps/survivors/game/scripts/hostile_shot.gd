class_name HostileShot
extends Node2D
## A boss attack in flight (Enemy "volley" and "lob"): an alarm bullet flying straight until it
## hits the player, a building or runs out, or a pie lobbed at a spot, which only hurts where
## it lands and shows that spot's shadow, filling in, while it is in the air. Game ticks them
## and owns the list; `done` tells Game to drop one.

enum Kind { BULLET, LOB }

const BULLET_RADIUS := 4.5
const BULLET_SECONDS := 3.5
## The splash where a pie lands; the shadow shows exactly this.
const LOB_RADIUS := 16.0
const LOB_HEIGHT := 46.0
const PIE_SIZE := 16.0

var kind := Kind.BULLET
var damage := 10.0
## The enemy type that threw it, recorded as what hurt the player (Telemetry).
var thrower := ""
var done := false

var _velocity := Vector2.ZERO
var _seconds_left := BULLET_SECONDS
var _from := Vector2.ZERO
var _flight := 1.0
var _flown := 0.0
var _pie: Sprite2D


func setup_bullet(at: Vector2, velocity: Vector2, hit_damage: float, thrower_type: String) -> void:
	kind = Kind.BULLET
	position = at
	_velocity = velocity
	damage = hit_damage
	thrower = thrower_type


## The node sits on the landing spot (where the shadow is drawn); the pie sprite flies to it.
func setup_lob(from: Vector2, to: Vector2, seconds: float, hit_damage: float, thrower_type: String) -> void:
	kind = Kind.LOB
	position = to
	_from = from
	_flight = seconds
	damage = hit_damage
	thrower = thrower_type
	_pie = Art.sprite("pie", PIE_SIZE)
	add_child(_pie)
	_place_pie()


func tick(delta: float, game: Game) -> void:
	match kind:
		Kind.BULLET:
			position += _velocity * delta
			_seconds_left -= delta
			# Walls stop bullets, so ducking behind a building is a way out.
			if _seconds_left <= 0.0 or game.city.resolve(position, 1.0) != position:
				done = true
			elif _hits(game.player, BULLET_RADIUS):
				game.hurt_player(damage, thrower, "bullet")
				done = true
		Kind.LOB:
			_flown += delta
			if _flown >= _flight:
				if _hits(game.player, LOB_RADIUS):
					game.hurt_player(damage, thrower, "pie")
				Effects.poof(game, position, Color("f2c46b"))
				done = true
			else:
				_place_pie()
				queue_redraw()


func _hits(player: Player, reach: float) -> bool:
	var hit_distance := reach + Player.HURT_RADIUS
	return position.distance_squared_to(player.position) <= hit_distance * hit_distance


## Along a straight line from thrower to target, lifted by an arc that peaks halfway.
func _place_pie() -> void:
	var progress := _flown / _flight
	_pie.position = _from.lerp(position, progress) - position + Vector2(0.0, -sin(progress * PI) * LOB_HEIGHT)
	_pie.rotation = progress * TAU


func _draw() -> void:
	match kind:
		Kind.BULLET:
			draw_circle(Vector2.ZERO, BULLET_RADIUS + 1.0, Art.INK)
			draw_circle(Vector2.ZERO, BULLET_RADIUS - 0.2, Art.RED)
			draw_circle(Vector2.ZERO, 1.6, Color.WHITE)
		Kind.LOB:
			var progress := _flown / _flight
			draw_circle(Vector2.ZERO, LOB_RADIUS, Color(Art.RED, 0.12))
			draw_circle(Vector2.ZERO, LOB_RADIUS * progress, Color(Art.INK, 0.18))
			draw_arc(Vector2.ZERO, LOB_RADIUS, 0.0, TAU, 32, Color(Art.RED, 0.6), 1.5, true)
