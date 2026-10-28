class_name AuraWeapon
extends Weapon
## A field around the player that keeps damaging and nudging back everything inside it.
## (Silicon Valley: Wi-Fi 信号 — drawn as signal rings rippling outward.)

## Starts a little wider than the player's own sprite; any smaller and only what is already
## biting them is in range.
## Raised after the live runs had it at 2-9% of all damage even at full level.
const RADIUS := [40.0, 46.0, 46.0, 54.0, 62.0]
const DAMAGE := [6.0, 6.0, 9.0, 9.0, 13.0]
const TICK_SECONDS := [0.6, 0.6, 0.5, 0.5, 0.4]
const RIPPLES := 3

var _tick_left := 0.0
var _ripple := 0.0


func _init() -> void:
	# Under the sprites but above the ground.
	z_index = -1


func _process(delta: float) -> void:
	_ripple = fmod(_ripple + delta * 0.6, 1.0)
	queue_redraw()
	_tick_left -= delta
	if _tick_left > 0.0:
		return
	_tick_left = stat(TICK_SECONDS) * player.cooldown_scale
	var damage: float = stat(DAMAGE) * player.might
	for enemy in game.query_enemies(player.position, stat(RADIUS)):
		game.damage_enemy(enemy, damage, (enemy.position - player.position).normalized() * 50.0, id, true)


func _draw() -> void:
	var radius: float = stat(RADIUS)
	draw_circle(Vector2.ZERO, radius, Color(Art.BLUE, 0.12))
	# Rings start at the centre and fade as they reach the edge, like a signal spreading.
	for i in RIPPLES:
		var progress := fmod(_ripple + float(i) / RIPPLES, 1.0)
		draw_arc(Vector2.ZERO, radius * progress, 0.0, TAU, 48, Color(Art.BLUE, 0.55 * (1.0 - progress)), 1.5, true)
	draw_arc(Vector2.ZERO, radius, 0.0, TAU, 64, Color(Art.BLUE, 0.6), 1.5, true)
