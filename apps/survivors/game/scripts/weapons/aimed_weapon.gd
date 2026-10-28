class_name AimedWeapon
extends Weapon
## A quick burst of shots, each aimed at whichever enemy is nearest when it leaves.
## (Silicon Valley: 回车键.)

const COUNT := [1, 2, 2, 3, 3]
const DAMAGE := [12.0, 12.0, 18.0, 18.0, 24.0]
const PIERCE := [1, 1, 1, 1, 3]
const SPEED := 230.0
## Kept short so most kills, and their stars, land within walking distance.
const RANGE := 200.0
const BURST_GAP := 0.08
const SIZE := 14.0

var _burst_left := 0
var _burst_timer := 0.0


func cooldown() -> float:
	return 1.1


func _process(delta: float) -> void:
	super(delta)
	if _burst_left <= 0:
		return
	_burst_timer -= delta
	if _burst_timer <= 0.0:
		_shoot_one()


func fire() -> bool:
	if game.nearest_enemy(player.position, RANGE) == null:
		return false
	_burst_left = stat(COUNT)
	_burst_timer = 0.0
	return true


func _shoot_one() -> void:
	_burst_left -= 1
	_burst_timer = BURST_GAP
	var target := game.nearest_enemy(player.position, RANGE)
	var direction := player.facing if target == null else (target.position - player.position).normalized()
	spawn_projectile(SIZE, direction * SPEED, stat(DAMAGE), stat(PIERCE), 1.4)
