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
##
## Each poke is drawn as the pen itself shooting out along the line, nib first, leaving a stroke of
## ink behind it (a plain white bar didn't read as a pen).

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
		var jab := Jab.new()
		jab.setup(art, direction, length)
		add_child(jab)
	game.melee_impact(hits, hit_boss)


## One poke as drawn: the pen darting out along `direction` to `reach`, nib first, then fading,
## with a short streak of ink behind it (a stroke all the way from the player read as a laser).
## Over the hit puffs, so the pen itself stays in view. A child of the weapon, so it moves with
## the player.
class Jab:
	extends Node2D

	const OUT_SECONDS := 0.08
	const FADE_SECONDS := 0.14
	const PEN_SIZE := 30.0
	const STREAK := 34.0
	## stylus.svg draws the pen turned 45°, its nib at the bottom left.
	const PEN_ART_ANGLE := deg_to_rad(135.0)
	const INK := Color("ff5d9e")

	var _direction := Vector2.RIGHT
	var _reach := 80.0
	var _age := 0.0
	var _pen: Sprite2D

	func setup(art: String, direction: Vector2, reach: float) -> void:
		_direction = direction
		_reach = reach
		# Over the enemies and the hit puffs (effect layer, z 10), under the damage numbers (20).
		z_index = 12
		_pen = Art.sprite(art, PEN_SIZE)
		_pen.rotation = direction.angle() - PEN_ART_ANGLE
		add_child(_pen)
		_place_pen()

	func _process(delta: float) -> void:
		_age += delta
		if _age >= OUT_SECONDS + FADE_SECONDS:
			queue_free()
			return
		if _age > OUT_SECONDS:
			modulate.a = 1.0 - (_age - OUT_SECONDS) / FADE_SECONDS
		_place_pen()
		queue_redraw()

	## Where the nib is now: shooting out fast, easing into full reach.
	func _nib() -> Vector2:
		return _direction * _reach * ease(minf(_age / OUT_SECONDS, 1.0), 0.4)

	## The pen sits back from the nib by about a third of its size, so the nib leads.
	func _place_pen() -> void:
		_pen.position = _nib() - _direction * PEN_SIZE * 0.3

	func _draw() -> void:
		var nib := _nib()
		var tail := nib - _direction * minf(STREAK, nib.length())
		if nib.distance_to(tail) < 2.0:
			return
		draw_line(tail, nib, Art.INK, 3.5, true)
		draw_line(tail, nib, INK, 1.8, true)
