class_name Projectile
extends Node2D
## A thrown weapon flying through the world, hitting each enemy at most once.

var game: Game
## Weapon id the damage is credited to (end-of-run damage ranking).
var source := ""
var velocity := Vector2.ZERO
var gravity := 0.0
var damage := 10.0
## How many enemies it can hit before disappearing; negative means unlimited.
var pierce := 1
var hit_radius := 5.0
var lifetime := 1.5
## Visual spin in radians per second.
var spin := 0.0
## Turn the art to face along the flight path (art drawn pointing up, i.e. along -Y).
var align_to_velocity := false
var knockback := 70.0

var _hit_ids := {}
var _sprite: Sprite2D


func setup(game_ref: Game, source_id: String, art_name: String, size: float, at: Vector2, initial_velocity: Vector2, hit_damage: float, max_hits: int, seconds: float) -> void:
	game = game_ref
	source = source_id
	position = at
	velocity = initial_velocity
	damage = hit_damage
	pierce = max_hits
	lifetime = seconds
	_sprite = Art.sprite(art_name, size)
	add_child(_sprite)
	_orient(0.0)


func set_visual_scale(factor: float) -> void:
	_sprite.scale *= factor


func _process(delta: float) -> void:
	lifetime -= delta
	if lifetime <= 0.0:
		queue_free()
		return
	velocity.y += gravity * delta
	position += velocity * delta
	_orient(delta)

	for enemy in game.query_enemies(position, hit_radius):
		var key := enemy.get_instance_id()
		if _hit_ids.has(key):
			continue
		_hit_ids[key] = true
		game.damage_enemy(enemy, damage, velocity.normalized() * knockback, source)
		if pierce > 0:
			pierce -= 1
			if pierce == 0:
				queue_free()
				return


func _orient(delta: float) -> void:
	if spin != 0.0:
		_sprite.rotation += spin * delta
	elif align_to_velocity:
		_sprite.rotation = velocity.angle() + PI / 2.0
