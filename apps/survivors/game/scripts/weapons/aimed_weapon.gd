class_name AimedWeapon
extends Weapon
## A quick burst of shots, each aimed at whichever enemy is nearest when it leaves, or the way the
## player faces with none in range: it fires whether or not there is anything to hit (the user's
## call, for every job's own weapon).
## (Silicon Valley: 回车键.) Shift+Enter 批量提交 (evolved with 双屏显示器): every round sends one
## key at each enemy on screen instead, nearest first.
##
## The programmer's own weapon, so it levels up along two directions (Upgrades.BRANCHES): 更多
## adds a press to every burst, 更大 makes each key bigger, harder-hitting and piercing further.
## Two of each lands where the old level 5 was (3 keys of 24, piercing 3).

const BASE_DAMAGE := 12.0
const DAMAGE_PER_SIZE := 6.0
const SIZE_GROWTH := 0.25
const SPEED := 230.0
## Kept short so most kills, and their stars, land within walking distance.
const RANGE := 200.0
const BURST_GAP := 0.08
const SIZE := 14.0
const HIT_RADIUS := 5.0
## The most keys one evolved round sends.
const BATCH_MAX := 12

var _burst_left := 0
var _burst_timer := 0.0


## What the weapon does with `more` upgrades to 更多 and `bigger` to 更大 (the cards' numbers too).
static func branch_stats(more: int, bigger: int) -> Dictionary:
	return {"count": 1 + more, "damage": BASE_DAMAGE + DAMAGE_PER_SIZE * bigger, "pierce": 1 + bigger,
		"size": 1.0 + SIZE_GROWTH * bigger}


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
	if evolved:
		return _fire_batch()
	_burst_left = branch_stats(branch_a, branch_b)["count"]
	_burst_timer = 0.0
	return true


func _shoot_one() -> void:
	_burst_left -= 1
	_burst_timer = BURST_GAP
	var target := game.nearest_enemy(player.position, RANGE)
	var direction := player.facing if target == null else (target.position - player.position).normalized()
	_key(direction, 1.4)


func _fire_batch() -> bool:
	var targets := game.visible_enemies()
	if targets.is_empty():
		_key(player.facing, 1.6)
		return true
	targets.sort_custom(func(a: Enemy, b: Enemy) -> bool:
		return a.position.distance_squared_to(player.position) < b.position.distance_squared_to(player.position))
	for target: Enemy in targets.slice(0, BATCH_MAX):
		_key((target.position - player.position).normalized(), 1.6)
	return true


func _key(direction: Vector2, seconds: float) -> void:
	var stats := branch_stats(branch_a, branch_b)
	var size: float = stats["size"]
	var key := spawn_projectile(SIZE * size, direction * SPEED, stats["damage"], stats["pierce"], seconds)
	key.hit_radius = HIT_RADIUS * size
