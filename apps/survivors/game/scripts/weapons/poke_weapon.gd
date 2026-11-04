class_name PokeWeapon
extends Weapon
## Pokes at the nearest enemy in reach, or the way the player faces with none there: it pokes
## whether or not anything is around (the user's call), each poke hitting every enemy along a
## long narrow line (.84; only the first one on it before). (Silicon Valley: 抽样, the data scientist's sampling needle, from .49: always
## taking the nearest is convenience sampling. Until then it was drawn as the designer's stylus,
## called 数位笔 while the designer carried it, .14-.40, and 埋点 after.) Hades' Eternal Spear's
## jabs; the stapler and the network cable were folded into it. Facing alone missed nearly
## everything: players run away from the crowd, so the bot's designer poked at empty air and died
## at 1:33.
## 全量数据 (evolved with 人脉名片): eight directions at once, every line a fifth longer (twelve until
## .84, when the pokes began to pierce).
##
## The data scientist's own weapon, so it levels up along two directions (Upgrades.BRANCHES):
## 分层抽样 pokes more ways at once (one more each time, up to five, spread evenly), 加大样本量
## pokes more times each round. Either way each upgrade also hits harder. It starts as one poke one
## way.
##
## Each poke is drawn as the needle jabbing from the player's side while a purple drop flies off its
## tip to the enemy it hit, or the end of the line, and lands there as a few data points (Jab). It
## was a pink pen flicking ink until .49, the designer's look left on the data scientist.
##
## A poke went through everything on its line and pushed it back (40) until .39: the user's call
## for every job's own weapon was no piercing, knockback or stun, so the jobs differ only in how
## they deal damage. Piercing a whole line made this the strongest job by far. .84 (the user: 数据改成
## 穿透伤害，然后方向升级减少，1=>2=>3=>4 这样最多四个; then 12345): it pierces again, without the
## push, and the directions go 1, 2, 3, 4, 5 (1, 2, 4, 6, 8 before) with the damage set again for it.

## .74 (the user: 回车和抽样成长伤害加高；抽样改成 +2，频率调整下，略低一点): +2 a level (+1 before) and a
## round every 0.72 s (0.68): one target a jab, it fell behind the weapons that hit a crowd late
## (about 375 damage a second alone at 8:00, now about 490).
const COOLDOWN := 0.72
const POKE_GAP := 0.09
## 7 a hit at level 1 (.39, the user's call): an opening Bug (8 health, 10.4 in Beijing, up to 13
## by 1:00) takes two hits on every map. Growth and pace come from the balance fit (DESIGN.md 2.2).
const BASE_DAMAGE := 7.0
const DAMAGE_PER_UPGRADE := 2.0
const LENGTH := 80.0
const WIDTH := 10.0
## Directions at once by upgrades to 分层抽样, spread evenly round the first.
const DIRECTIONS := [1, 2, 3, 4, 5]
## Aims at the nearest enemy this close.
const AIM_RANGE := 120.0
const EVOLVED_DIRECTIONS := 8
const EVOLVED_LENGTH := 1.2

var _pokes_left := 0
## Hits whose drop landed since the last frame, felt together (Game.melee_impact).
var _landed := 0
var _landed_boss := false
var _poke_left := 0.0


## The pokes with `more_ways` upgrades to 分层抽样 and `more_times` to 加大样本量 (the cards' numbers
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
	if _landed > 0:
		game.melee_impact(_landed, _landed_boss)
		_landed = 0
		_landed_boss = false
	if _pokes_left <= 0:
		return
	_poke_left -= delta
	if _poke_left <= 0.0:
		_poke_left = POKE_GAP
		_pokes_left -= 1
		_poke_all_ways()


## One poke every way at once, the first at the nearest enemy (or straight ahead). Each way finds
## every enemy on its line, which runs from the tip (Jab.HOLD out) to the poke's length, and hurts
## them when the drop lands at its end (Jab.FLY_SECONDS later). Until .84 it hurt only the first one
## on the line, when the drop landed on it. Until .39 the line started at the player's centre, so one enemy pressed against the
## player was the first on most of the ways at once, hit by pokes drawn pointing elsewhere; and the
## damage came the moment of the poke, a tenth of a second before the drop got there.
func _poke_all_ways() -> void:
	var stats := branch_stats(branch_a, branch_b)
	var ways: int = EVOLVED_DIRECTIONS if evolved else stats["count"]
	var length := LENGTH * (EVOLVED_LENGTH if evolved else 1.0)
	var damage: float = stats["damage"] * damage_scale()
	var target := game.nearest_enemy(player.position, AIM_RANGE)
	var aim := player.facing if target == null else (target.position - player.position).normalized()
	for i in ways:
		var direction := aim.rotated(TAU * i / ways)
		var on_line: Array = []
		for enemy in game.query_enemies(player.position + direction * length / 2.0, length / 2.0 + WIDTH):
			var offset := enemy.position - player.position
			var along := offset.dot(direction)
			# Its body has to reach the line, from the tip to the end.
			var nearest := direction * clampf(along, Jab.HOLD, length)
			if offset.distance_to(nearest) > WIDTH / 2.0 + enemy.hit_radius:
				continue
			on_line.append(enemy)
		var jab := Jab.new()
		# Through everything on it, so the drop always flies the whole line.
		jab.setup(art, player.position, direction, length)
		if not on_line.is_empty():
			jab.landed.connect(_land.bind(on_line, damage))
		add_child(jab)


## The drop of a poke got to the end of its line: everything that was on it (`targets`) is hurt
## now, if still there. Untyped because an enemy freed while the drop flew is a freed Object, which
## an `Enemy`-typed value rejected before this check could run: an engine error each time,
## thousands a run (.43).
func _land(targets: Array, damage: float) -> void:
	for target: Variant in targets:
		if not is_instance_valid(target):
			continue
		var enemy: Enemy = target
		if enemy.dead:
			continue
		game.damage_enemy(enemy, damage, Vector2.ZERO, id)
		_landed += 1
		_landed_boss = _landed_boss or enemy.is_elite


## One poke as drawn: the needle, held at the player's side, jabs a little way out and back while
## a purple drop flies off its tip out to `reach` (the enemy it hits, or where the poke ends) and
## lands there as a few data points, then fades. The pen this was drawn as until .49 used to fly the
## whole reach itself and fade out over there, too far from the player (the user's words); a stroke
## all the way from the player before that read as a laser. Over the hit puffs, so the needle and
## the drop stay in view. A child of the weapon, so the needle moves with the player; the drop is
## left in the world where it flew off (Drop), so where it lands stays on the enemy it hit (.39: it
## slid off with the player).
class Jab:
	extends Node2D

	const OUT_SECONDS := 0.08
	const BACK_SECONDS := 0.12
	const NEEDLE_FADE_SECONDS := 0.08
	## The drop's flight out to the reach, then its data points fading there.
	const FLY_SECONDS := 0.1
	const POINTS_SECONDS := 0.16
	const NEEDLE_SIZE := 26.0
	## Where the needle is held, out from the player's centre, and how far a jab pushes it.
	const HOLD := 16.0
	const THRUST := 10.0
	const DROP_LENGTH := 16.0
	const DROP_WIDTH := 5.0
	## sample_needle.svg draws the needle turned 45°, its tip at the bottom left.
	const ART_ANGLE := deg_to_rad(135.0)
	## The data scientist's purple, as on its shirt and in the needle's barrel (the pen's ink was
	## pink, ff5d9e, until .49).
	const SAMPLE_COLOR := Color("8c7cf0")
	## The data points where a drop lands: across the poke (side), along it, and radius. A loose
	## cluster, like a few dots on a scatter plot; the ink splatted as a blot and two specks.
	const POINTS := [[-4.0, -2.0, 2.6], [1.5, 3.0, 2.3], [5.0, -1.5, 2.0]]

	## The drop got to the end of its flight (FLY_SECONDS): where the poke's enemy is hurt.
	signal landed

	var _direction := Vector2.RIGHT
	var _reach := 80.0
	var _age := 0.0
	var _needle: Sprite2D
	var _drop: Drop

	## `origin` is the player's position in the world at the poke.
	func setup(art: String, origin: Vector2, direction: Vector2, reach: float) -> void:
		_direction = direction
		_reach = reach
		# Over the enemies and the hit puffs (effect layer, z 10), under the damage numbers (20).
		z_index = 12
		_needle = Art.sprite(art, NEEDLE_SIZE)
		_needle.rotation = direction.angle() - ART_ANGLE
		add_child(_needle)
		_drop = Drop.new()
		_drop.top_level = true
		_drop.position = origin
		_drop.jab = self
		add_child(_drop)
		_place_needle()

	func _process(delta: float) -> void:
		_age += delta
		var needle_done := OUT_SECONDS + BACK_SECONDS + NEEDLE_FADE_SECONDS
		if _age >= maxf(needle_done, FLY_SECONDS + POINTS_SECONDS):
			queue_free()
			return
		if _age >= FLY_SECONDS and _age - delta < FLY_SECONDS:
			landed.emit()
		_needle.modulate.a = 1.0 - clampf((_age - OUT_SECONDS - BACK_SECONDS) / NEEDLE_FADE_SECONDS, 0.0, 1.0)
		_place_needle()
		_drop.queue_redraw()

	## How far past where it's held the needle is: quickly out, then back.
	func _thrust() -> float:
		if _age < OUT_SECONDS:
			return THRUST * ease(_age / OUT_SECONDS, 0.4)
		return THRUST * (1.0 - minf((_age - OUT_SECONDS) / BACK_SECONDS, 1.0))

	func _tip() -> Vector2:
		return _direction * (HOLD + _thrust())

	## The needle sits back from its tip by about a third of its size, so the tip leads.
	func _place_needle() -> void:
		_needle.position = _tip() - _direction * NEEDLE_SIZE * 0.3


## A poke's drop, left in the world where it flew off: racing out from the tip, then the data points
## where it landed (the poke's Jab drives it).
class Drop:
	extends Node2D

	var jab: Jab

	func _draw() -> void:
		var direction := jab._direction
		var reach := jab._reach
		var age := jab._age
		var side := direction.orthogonal()
		if age < Jab.FLY_SECONDS:
			# The drop, pointed at its front and round at its back, racing out from the tip.
			# Starts off the tip, or at the enemy when that is closer.
			var from := minf(Jab.HOLD + Jab.THRUST, reach)
			var head := direction * lerpf(from, reach, ease(age / Jab.FLY_SECONDS, 0.4))
			var length := minf(Jab.DROP_LENGTH, head.length() - from)
			# Just off the tip it is too short to draw: a flat triangle won't triangulate.
			if length < 4.0:
				return
			var tail := head - direction * length
			var drop := PackedVector2Array([head, tail + side * Jab.DROP_WIDTH / 2.0, tail - side * Jab.DROP_WIDTH / 2.0])
			draw_circle(tail, Jab.DROP_WIDTH / 2.0 + 1.0, Art.INK)
			draw_colored_polygon(drop, Art.INK)
			draw_circle(tail, Jab.DROP_WIDTH / 2.0 - 0.5, Jab.SAMPLE_COLOR)
			var inner := PackedVector2Array([head - direction * 2.0, tail + side * (Jab.DROP_WIDTH / 2.0 - 1.2), tail - side * (Jab.DROP_WIDTH / 2.0 - 1.2)])
			draw_colored_polygon(inner, Jab.SAMPLE_COLOR)
			return
		# Where the poke ends: a few data points, fading.
		var fade := 1.0 - clampf((age - Jab.FLY_SECONDS) / Jab.POINTS_SECONDS, 0.0, 1.0)
		var at := direction * reach
		for point: Array in Jab.POINTS:
			var spot: Vector2 = at + side * point[0] + direction * point[1]
			draw_circle(spot, point[2] + 1.0, Color(Art.INK, fade))
			draw_circle(spot, point[2], Color(Jab.SAMPLE_COLOR, fade))
