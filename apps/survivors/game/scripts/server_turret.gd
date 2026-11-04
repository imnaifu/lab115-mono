class_name ServerTurret
extends Node2D
## The ops' 大招 扩容 (.81, Ultimates): a server set down where the player stands. For SECONDS it
## lobs a shell every FIRE_EVERY at the nearest enemy within RANGE, which bursts BLAST_RADIUS
## round where it lands for its `damage` (the firewall's hit times Ultimates.TURRET_DAMAGE_SCALE).
## Nothing goes after it: the crowd walks to the player as ever. Game owns it (Game.turrets).

const SIZE := 38.0
const SECONDS := 20.0
const RANGE := 260.0
const FIRE_EVERY := 0.5
const SHELL_SECONDS := 0.3
const SHELL_SIZE := 12.0
const BLAST_RADIUS := 40.0
const FADE_SECONDS := 0.5
const SOURCE := "ultimate"

var game: Game
var damage := 30.0
var seconds_left := SECONDS

var _fire_left := 0.0
var _sprite: Sprite2D


func _ready() -> void:
	_sprite = Art.sprite("server_up", SIZE)
	_sprite.position.y = -SIZE / 2.0
	add_child(_sprite)


## Called by Game every frame of play. Returns false once it has gone.
func tick(delta: float) -> bool:
	seconds_left -= delta
	if seconds_left <= 0.0:
		queue_free()
		return false
	_sprite.modulate.a = clampf(seconds_left / FADE_SECONDS, 0.0, 1.0)
	_fire_left -= delta
	if _fire_left > 0.0:
		return true
	var target := game.nearest_enemy(position, RANGE)
	if target == null:
		return true
	_fire_left = FIRE_EVERY
	_lob(target.position)
	return true


## A shell arcs to `at` and bursts there.
func _lob(at: Vector2) -> void:
	var shell := Art.sprite("turret_shot", SHELL_SIZE)
	var from := position + Vector2(0.0, -SIZE * 0.8)
	shell.position = from
	game.effect_layer.add_child(shell)
	var tween := shell.create_tween()
	tween.tween_method(func(t: float) -> void:
		shell.position = from.lerp(at, t) + Vector2(0.0, -40.0 * sin(PI * t)), 0.0, 1.0, SHELL_SECONDS)
	tween.tween_callback(func() -> void:
		shell.queue_free()
		_burst(at))


func _burst(at: Vector2) -> void:
	if not is_instance_valid(game):
		return
	Effects.explosion(game, at, BLAST_RADIUS)
	for enemy in game.query_enemies(at, BLAST_RADIUS):
		game.damage_enemy(enemy, damage, (enemy.position - at).normalized() * 60.0, SOURCE, true)
