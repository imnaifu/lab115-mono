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
## A job's own weapon levels up along one of two directions each time (Upgrades.BRANCHES, the
## player picks): how many of its upgrades went each way. Its stats come from these, not from
## `level` (which is still 1 + both, for the cards, the slots and evolving). Other weapons leave
## both at 0.
var branch_a := 0
var branch_b := 0
## Set once it has evolved (Upgrades.EVOLUTIONS): each weapon reads it to attack its evolved way.
var evolved := false

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


## `branch` ("a" or "b") for a job's own weapon, "" for the others.
func level_up(branch: String = "") -> void:
	level += 1
	if branch == "a":
		branch_a += 1
	elif branch == "b":
		branch_b += 1
	_on_level_changed()


func _on_level_changed() -> void:
	pass


func evolve() -> void:
	evolved = true
	_on_evolved()


func _on_evolved() -> void:
	pass


## What the damage in this weapon's tables is multiplied by: the player's damage bonus and what
## their job does for this weapon (专精, 多开实验; Player.weapon_multiplier).
func damage_scale() -> float:
	return player.might * player.weapon_multiplier(id)


## Looks up the current level's value in a per-level stat table.
func stat(table: Array) -> Variant:
	return table[mini(level, table.size()) - 1]


func spawn_projectile(size: float, velocity: Vector2, damage: float, pierce: int, lifetime: float) -> Projectile:
	var projectile := Projectile.new()
	projectile.setup(game, id, art, size, player.position, velocity, damage * damage_scale(), pierce, lifetime)
	game.effect_layer.add_child(projectile)
	return projectile
