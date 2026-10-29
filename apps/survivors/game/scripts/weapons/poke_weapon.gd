class_name PokeWeapon
extends Weapon
## Pokes at the nearest enemy in reach, or the way the player faces with none there: it pokes
## whether or not anything is around (the user's call), each poke going through everything along a
## long narrow line. (Silicon Valley: 数位笔, the designer's stylus.) Hades' Eternal Spear's jabs;
## the stapler and the network cable were folded into it. Facing alone missed nearly everything:
## players run away from the crowd, so the bot's designer poked at empty air and died at 1:33.
## 多点触控 (evolved with 人脉名片): twelve directions at once, every line a fifth longer.
##
## The designer's own weapon, so it levels up along two directions (Upgrades.BRANCHES): 更多方向
## pokes more ways at once (front, then back, then the four sides and in between), 更多次数 pokes
## more times each round. Either way each upgrade also hits harder. It starts as one poke one way.

const COOLDOWN := 1.0
const POKE_GAP := 0.09
const BASE_DAMAGE := 12.0
const DAMAGE_PER_UPGRADE := 3.0
const LENGTH := 80.0
const WIDTH := 10.0
## Directions at once by upgrades to 更多方向, spread evenly round the first.
const DIRECTIONS := [1, 2, 4, 6, 8]
const KNOCKBACK := 40.0
## Aims at the nearest enemy this close.
const AIM_RANGE := 120.0
const EVOLVED_DIRECTIONS := 12
const EVOLVED_LENGTH := 1.2

var _pokes_left := 0
var _poke_left := 0.0


## The pokes with `more_ways` upgrades to 更多方向 and `more_times` to 更多次数 (the cards' numbers
## too): `count` directions, `times` pokes a round.
static func branch_stats(more_ways: int, more_times: int) -> Dictionary:
	return {"damage": BASE_DAMAGE + DAMAGE_PER_UPGRADE * (more_ways + more_times),
		"count": DIRECTIONS[mini(more_ways, DIRECTIONS.size() - 1)], "times": 1 + more_times}


func cooldown() -> float:
	return COOLDOWN


## A round starts whether or not there is anything to hit.
func fire() -> bool:
	_pokes_left = branch_stats(branch_a, branch_b)["times"]
	_poke_left = 0.0
	return true


func _process(delta: float) -> void:
	super(delta)
	if _pokes_left <= 0:
		return
	_poke_left -= delta
	if _poke_left <= 0.0:
		_poke_left = POKE_GAP
		_pokes_left -= 1
		_poke_all_ways()


## One poke every way at once, the first at the nearest enemy (or straight ahead).
func _poke_all_ways() -> void:
	var stats := branch_stats(branch_a, branch_b)
	var ways: int = EVOLVED_DIRECTIONS if evolved else stats["count"]
	var length := LENGTH * (EVOLVED_LENGTH if evolved else 1.0)
	var damage: float = stats["damage"] * damage_scale()
	var hits := 0
	var hit_boss := false
	var target := game.nearest_enemy(player.position, AIM_RANGE)
	var aim := player.facing if target == null else (target.position - player.position).normalized()
	for i in ways:
		var direction := aim.rotated(TAU * i / ways)
		for enemy in game.query_enemies(player.position + direction * length / 2.0, length / 2.0 + WIDTH):
			var offset := enemy.position - player.position
			var along := offset.dot(direction)
			if along < -enemy.radius or along > length + enemy.radius:
				continue
			if absf(offset.dot(direction.orthogonal())) > WIDTH / 2.0 + enemy.radius:
				continue
			game.damage_enemy(enemy, damage, direction * KNOCKBACK, id)
			hits += 1
			hit_boss = hit_boss or enemy.is_elite
		Effects.lash(game, player.position, direction, length, WIDTH)
	game.melee_impact(hits, hit_boss)
