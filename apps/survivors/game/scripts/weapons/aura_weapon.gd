class_name AuraWeapon
extends Weapon
## A field around the player that keeps damaging and nudging back everything inside it.
## (Silicon Valley: Wi-Fi 信号 — drawn as signal rings rippling outward.) 5G 基站 (evolved with
## 工位绿植): a wider field, and every pulse that catches someone heals the player a little.

## Starts a little wider than the player's own sprite; any smaller and only what is already
## biting them is in range.
## Raised after the live runs had it at 2-9% of all damage even at full level.
const RADIUS := [40.0, 46.0, 46.0, 54.0, 62.0]
const DAMAGE := [6.0, 6.0, 11.0, 11.0, 20.0]
## Upgrades never make it faster (.39, the user's call: only 双屏显示器 speeds weapons up); what
## the speed-ups gave went into damage instead, the same damage a second at every level.
const TICK_SECONDS := [0.6, 0.6, 0.6, 0.6, 0.6]
## How long the edge stays lit after a tick lands.
const FLASH_SECONDS := 0.15
const EVOLVED_EXTRA_RADIUS := 16.0
const EVOLVED_HEAL := 0.5

var _tick_left := 0.0
## The current tick's length, which the ripple runs over, and the edge's light after a tick.
var _period := 0.6
var _flash := 0.0


func _init() -> void:
	# Under the sprites but above the ground.
	z_index = -1


func _process(delta: float) -> void:
	_flash = maxf(0.0, _flash - delta / FLASH_SECONDS)
	queue_redraw()
	_tick_left -= delta
	if _tick_left > 0.0:
		return
	_period = stat(TICK_SECONDS) * player.cooldown_scale
	_tick_left = _period
	_flash = 1.0
	var damage: float = stat(DAMAGE) * damage_scale()
	var caught := game.query_enemies(player.position, _radius())
	for enemy in caught:
		game.damage_enemy(enemy, damage, (enemy.position - player.position).normalized() * 50.0, id, true)
	if evolved and not caught.is_empty():
		player.heal(EVOLVED_HEAL)


func _radius() -> float:
	return stat(RADIUS) + (EVOLVED_EXTRA_RADIUS if evolved else 0.0)


func _draw() -> void:
	var radius := _radius()
	draw_circle(Vector2.ZERO, radius, Color(Art.BLUE, 0.12))
	# One ripple a tick, from the centre out, reaching the edge as the tick hurts what is inside
	# and lighting the edge up (.39: three rings on a clock of their own reached the edge whenever,
	# out of step with the damage).
	var progress := clampf(1.0 - _tick_left / _period, 0.0, 1.0)
	draw_arc(Vector2.ZERO, radius * progress, 0.0, TAU, 48, Color(Art.BLUE, 0.15 + 0.4 * progress), 1.5, true)
	draw_arc(Vector2.ZERO, radius, 0.0, TAU, 64, Color(Art.BLUE, 0.6 + 0.4 * _flash), 1.5 + 1.5 * _flash, true)
