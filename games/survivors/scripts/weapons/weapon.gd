class_name Weapon
extends Node2D
## Base for auto-firing weapons. Lives as a child of the player; subclasses read their stats
## from per-level tables indexed by `level` and implement fire(). Weapons with continuous
## effects (orbiting drones, aura) override _process instead.
##
## Subclasses are named for how they attack, not what they look like: `id` and `art` come from
## Upgrades.WEAPONS, so a reskin only touches that table.

var id := ""
var art := ""
var game: Game
var player: Player
var level := 1

var _cooldown_left := 0.3


func _process(delta: float) -> void:
	_cooldown_left -= delta
	if _cooldown_left > 0.0:
		return
	# With nothing to shoot at, retry shortly instead of burning a whole cooldown.
	_cooldown_left = cooldown() * player.cooldown_scale if fire() else 0.15


## Seconds between shots before the player's cooldown multiplier.
func cooldown() -> float:
	return 1.0


## Shoots once. Returns false when there was nothing to shoot at.
func fire() -> bool:
	return true


func level_up() -> void:
	level += 1
	_on_level_changed()


func _on_level_changed() -> void:
	pass


## Looks up the current level's value in a per-level stat table.
func stat(table: Array) -> Variant:
	return table[mini(level, table.size()) - 1]


func spawn_projectile(size: float, velocity: Vector2, damage: float, pierce: int, lifetime: float) -> Projectile:
	var projectile := Projectile.new()
	projectile.setup(game, id, art, size, player.position, velocity, damage * player.might, pierce, lifetime)
	game.effect_layer.add_child(projectile)
	return projectile
