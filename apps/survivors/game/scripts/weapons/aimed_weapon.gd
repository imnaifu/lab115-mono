class_name AimedWeapon
extends Weapon
## A quick burst of shots, each aimed at whichever enemy is nearest when it leaves, or the way the
## player faces with none in range: it fires whether or not there is anything to hit (the user's
## call, for every job's own weapon).
## (Silicon Valley: 回车键.) Shift+Enter 批量提交 (evolved with 双屏显示器): every round sends one
## key at each enemy on screen instead, nearest first.
##
## The programmer's own weapon, so it levels up along two directions (Upgrades.BRANCHES): 更多
## adds a press to every burst, 更大 makes each key bigger and harder-hitting. It starts at two
## presses a burst, a burst every 0.48 s: a key no longer one-shots a Bug, and a key a second
## left the programmer far behind the other jobs.
##
## Every key hits one enemy and pushes nothing (.39, the user's call for every job's own weapon:
## no piercing, knockback or stun, so the jobs differ only in how they deal damage). 更大 added a
## pierce each before.

## 7 a hit at level 1 (.39, the user's call): an opening Bug (8 health, 10.4 in Beijing, up to 13
## by 1:00) takes two hits on every map. Growth and pace come from the balance fit (DESIGN.md 2.2).
const BASE_DAMAGE := 7.0
const DAMAGE_PER_SIZE := 4.0
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
	return {"count": 2 + more, "damage": BASE_DAMAGE + DAMAGE_PER_SIZE * bigger, "size": 1.0 + SIZE_GROWTH * bigger}


func cooldown() -> float:
	return 0.48


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
		# Long enough to get there: on a tall phone screen an enemy can be farther than 1.6 s of
		# flight, and the key used to vanish short of it.
		var offset := target.position - player.position
		_key(offset.normalized(), maxf(1.6, offset.length() / SPEED + 0.3))
	return true


func _key(direction: Vector2, seconds: float) -> void:
	var stats := branch_stats(branch_a, branch_b)
	var size: float = stats["size"]
	var key := spawn_projectile(SIZE * size, direction * SPEED, stats["damage"], 1, seconds)
	key.hit_radius = HIT_RADIUS * size
	key.knockback = 0.0
