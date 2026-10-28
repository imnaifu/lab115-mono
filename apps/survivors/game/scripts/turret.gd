class_name Turret
extends Node2D
## The open-source perk's mini turret: left where an enemy died, it shoots at the nearest enemy
## in range for a few seconds, then packs up. Perks owns the list and frees finished ones.

const SIZE := 18.0
const RANGE := 140.0
const FIRE_EVERY := 0.45
const SHOT_SPEED := 220.0
const SHOT_SIZE := 8.0
const SHOT_DAMAGE := 8.0
const FADE_SECONDS := 0.4
const SOURCE := "open_source"

var game: Game
var seconds_left := 8.0

var _fire_left := 0.0
var _sprite: Sprite2D


func _ready() -> void:
	_sprite = Art.sprite("turret", SIZE)
	_sprite.position.y = -SIZE / 2.0
	add_child(_sprite)


## Called by Perks every frame of play. Returns false once it has packed up.
func tick(delta: float) -> bool:
	seconds_left -= delta
	if seconds_left <= 0.0:
		queue_free()
		return false
	# Fades out over its last moments, so it doesn't just vanish.
	_sprite.modulate.a = clampf(seconds_left / FADE_SECONDS, 0.0, 1.0)
	_fire_left -= delta
	if _fire_left > 0.0:
		return true
	var target := game.nearest_enemy(position, RANGE)
	if target == null:
		_fire_left = 0.15
		return true
	_fire_left = FIRE_EVERY
	var muzzle := position + Vector2(0.0, -SIZE * 0.6)
	var projectile := Projectile.new()
	projectile.setup(game, SOURCE, "turret_shot", SHOT_SIZE, muzzle, (target.position - muzzle).normalized() * SHOT_SPEED,
		SHOT_DAMAGE * game.player.might, 1, RANGE / SHOT_SPEED + 0.2)
	game.effect_layer.add_child(projectile)
	return true
