class_name HostileShot
extends Node2D
## A boss's bullet in flight (RangedAttack): an alarm bullet flying until it hits the player, a
## building or runs out; a homing one turns towards the player as it goes. Game ticks them and
## owns the list; `done` tells Game to drop one. (Until .44 a boss could also lob pies.)

const BULLET_RADIUS := 4.5
const BULLET_SECONDS := 3.5

var damage := 10.0
## The enemy type that threw it, recorded as what hurt the player (Telemetry).
var thrower := ""
## How it landed, for the result screen's cause of death (the attack's form, RangedAttack).
var how := "bullet"
var radius := BULLET_RADIUS
var done := false

var _velocity := Vector2.ZERO
var _seconds_left := BULLET_SECONDS
## Radians a second a homing bullet turns towards the player; 0 flies straight.
var _turn := 0.0


func setup_bullet(at: Vector2, velocity: Vector2, hit_damage: float, thrower_type: String, hit_how := "bullet",
		turn := 0.0, seconds := BULLET_SECONDS) -> void:
	position = at
	_velocity = velocity
	damage = hit_damage
	thrower = thrower_type
	how = hit_how
	_turn = turn
	_seconds_left = seconds


func tick(delta: float, game: Game) -> void:
	if _turn > 0.0:
		var wanted := (game.player.position - position).angle()
		var heading := _velocity.angle()
		_velocity = _velocity.rotated(clampf(angle_difference(heading, wanted), -_turn * delta, _turn * delta))
	position += _velocity * delta
	_seconds_left -= delta
	# Walls stop bullets, so ducking behind a building is a way out.
	if _seconds_left <= 0.0 or game.city.resolve(position, 1.0) != position:
		done = true
	elif _hits(game.player, radius):
		game.hurt_player(damage, thrower, how)
		done = true


func _hits(player: Player, reach: float) -> bool:
	var hit_distance := reach + Player.HURT_RADIUS
	return position.distance_squared_to(player.position) <= hit_distance * hit_distance


func _draw() -> void:
	draw_circle(Vector2.ZERO, radius + 1.0, Art.INK)
	draw_circle(Vector2.ZERO, radius - 0.2, Art.RED)
	draw_circle(Vector2.ZERO, 1.6, Color.WHITE)
