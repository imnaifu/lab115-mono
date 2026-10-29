class_name PokeWeapon
extends Weapon
## Quick pokes all round: every round the player stabs toward the nearest enemy, then the opposite
## way, then (with more directions) to the sides, one after another, each poke going through
## everything along a long narrow line. (Silicon Valley: 埋点, planting tracking points
## everywhere.) Hades' Eternal Spear's jabs; the stapler and the network cable were folded into it.
## 全埋点 (evolved with 人脉名片): twelve directions, every line a fifth longer.
##
## The data scientist's own weapon, so it levels up along two directions (Upgrades.BRANCHES): 更长
## reaches further (with all four, the far half of each line hits 40% harder, Eternal Spear's
## Extending Jab), 更多方向 pokes more ways round. Either way each upgrade also hits harder.

const COOLDOWN := 1.0
const POKE_GAP := 0.07
const BASE_DAMAGE := 12.0
const DAMAGE_PER_UPGRADE := 3.0
const BASE_LENGTH := 70.0
const LENGTH_PER_LONGER := 15.0
const WIDTH := 10.0
## Directions per round by upgrades to 更多方向.
const DIRECTIONS := [2, 3, 4, 6, 8]
const FAR_BONUS := 1.4
const FAR_BONUS_LONGER := 4
const KNOCKBACK := 40.0
const EVOLVED_DIRECTIONS := 12
const EVOLVED_LENGTH := 1.2

## Headings still to poke this round, in order.
var _round: Array[float] = []
var _poke_left := 0.0


## The pokes with `longer` upgrades to 更长 and `more_ways` to 更多方向 (the cards' numbers too):
## `count` directions, `range` the line's length.
static func branch_stats(longer: int, more_ways: int) -> Dictionary:
	return {"damage": BASE_DAMAGE + DAMAGE_PER_UPGRADE * (longer + more_ways),
		"range": BASE_LENGTH + LENGTH_PER_LONGER * longer, "count": DIRECTIONS[mini(more_ways, DIRECTIONS.size() - 1)]}


func cooldown() -> float:
	return COOLDOWN


func fire() -> bool:
	var stats := branch_stats(branch_a, branch_b)
	var length: float = stats["range"] * (EVOLVED_LENGTH if evolved else 1.0)
	var target := game.nearest_enemy(player.position, length + 30.0)
	if target == null:
		return false
	var aim := (target.position - player.position).angle()
	var ways: int = EVOLVED_DIRECTIONS if evolved else stats["count"]
	_round.clear()
	for i in ways:
		# Back and forth: an even round goes front, back, then the sides in pairs.
		var k := (i / 2 + (ways / 2 if i % 2 == 1 else 0)) if ways % 2 == 0 else i
		_round.append(aim + TAU * k / ways)
	_poke_left = 0.0
	return true


func _process(delta: float) -> void:
	super(delta)
	if _round.is_empty():
		return
	_poke_left -= delta
	if _poke_left <= 0.0:
		_poke_left = POKE_GAP
		_poke(Vector2.from_angle(_round.pop_front()))


func _poke(direction: Vector2) -> void:
	var stats := branch_stats(branch_a, branch_b)
	var length: float = stats["range"] * (EVOLVED_LENGTH if evolved else 1.0)
	var damage: float = stats["damage"] * damage_scale()
	var far_bonus := branch_a >= FAR_BONUS_LONGER
	var hits := 0
	var hit_boss := false
	for enemy in game.query_enemies(player.position + direction * length / 2.0, length / 2.0 + WIDTH):
		var offset := enemy.position - player.position
		var along := offset.dot(direction)
		if along < -enemy.radius or along > length + enemy.radius:
			continue
		if absf(offset.dot(direction.orthogonal())) > WIDTH / 2.0 + enemy.radius:
			continue
		var far := far_bonus and along > length / 2.0
		game.damage_enemy(enemy, damage * (FAR_BONUS if far else 1.0), direction * KNOCKBACK, id)
		hits += 1
		hit_boss = hit_boss or enemy.is_elite
	Effects.lash(game, player.position, direction, length, WIDTH)
	game.melee_impact(hits, hit_boss)
