class_name PokeWeapon
extends Weapon
## Pokes at the nearest enemy in reach, or the way the player faces with none there: it pokes
## whether or not anything is around (the user's call), each poke hitting the first enemy along a
## long narrow line. (Silicon Valley: 数位笔, the designer's stylus.) Hades' Eternal Spear's jabs;
## the stapler and the network cable were folded into it. Facing alone missed nearly everything:
## players run away from the crowd, so the bot's designer poked at empty air and died at 1:33.
## 多点触控 (evolved with 人脉名片): twelve directions at once, every line a fifth longer.
##
## The designer's own weapon, so it levels up along two directions (Upgrades.BRANCHES): 更多方向
## pokes more ways at once (front, then back, then the four sides and in between), 更多次数 pokes
## more times each round. Either way each upgrade also hits harder. It starts as one poke one way.
##
## Each poke is drawn as the pen jabbing from the player's side while a drop of ink flicks off its
## nib to the enemy it hit, or the end of the line, and splats there (Jab).
##
## A poke went through everything on its line and pushed it back (40) until .39: the user's call
## for every job's own weapon was no piercing, knockback or stun, so the jobs differ only in how
## they deal damage. Piercing a whole line made this the strongest job by far.

const COOLDOWN := 0.68
const POKE_GAP := 0.09
## 7 a hit at level 1 (.39, the user's call): an opening Bug (8 health, 10.4 in Beijing, up to 12.5
## by 1:00) takes two hits on every map. Growth and pace come from the balance fit (DESIGN.md 2.2).
const BASE_DAMAGE := 7.0
const DAMAGE_PER_UPGRADE := 1.0
const LENGTH := 80.0
const WIDTH := 10.0
## Directions at once by upgrades to 更多方向, spread evenly round the first.
const DIRECTIONS := [1, 2, 4, 6, 8]
## Aims at the nearest enemy this close.
const AIM_RANGE := 120.0
const EVOLVED_DIRECTIONS := 12
const EVOLVED_LENGTH := 1.2

var _pokes_left := 0
## Hits whose ink landed since the last frame, felt together (Game.melee_impact).
var _landed := 0
var _landed_boss := false
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
## the first enemy on its line, which runs from the nib (Jab.HOLD out) to the poke's length, and
## hurts it when the ink lands on it (Jab.FLY_SECONDS later), so the hit is seen where and when it
## happens. Until .39 the line started at the player's centre, so one enemy pressed against the
## player was the first on most of the ways at once, hit by pokes drawn pointing elsewhere; and the
## damage came the moment of the poke, a tenth of a second before the ink got there.
func _poke_all_ways() -> void:
	var stats := branch_stats(branch_a, branch_b)
	var ways: int = EVOLVED_DIRECTIONS if evolved else stats["count"]
	var length := LENGTH * (EVOLVED_LENGTH if evolved else 1.0)
	var damage: float = stats["damage"] * damage_scale()
	var target := game.nearest_enemy(player.position, AIM_RANGE)
	var aim := player.facing if target == null else (target.position - player.position).normalized()
	for i in ways:
		var direction := aim.rotated(TAU * i / ways)
		var first: Enemy = null
		var first_along := INF
		for enemy in game.query_enemies(player.position + direction * length / 2.0, length / 2.0 + WIDTH):
			var offset := enemy.position - player.position
			var along := offset.dot(direction)
			# Its body has to reach the line, from the nib to the end.
			var nearest := direction * clampf(along, Jab.HOLD, length)
			if offset.distance_to(nearest) > WIDTH / 2.0 + enemy.hit_radius:
				continue
			if along < first_along:
				first_along = along
				first = enemy
		var jab := Jab.new()
		jab.setup(art, player.position, direction, clampf(first_along, 0.0, length) if first != null else length)
		if first != null:
			jab.landed.connect(_land.bind(first, damage))
		add_child(jab)


## The ink of a poke got to `enemy`: it is hurt now, if still there.
func _land(enemy: Enemy, damage: float) -> void:
	if not is_instance_valid(enemy) or enemy.dead:
		return
	game.damage_enemy(enemy, damage, Vector2.ZERO, id)
	_landed += 1
	_landed_boss = _landed_boss or enemy.is_elite


## One poke as drawn: the pen, held at the player's side, jabs a little way out and back while a
## drop of ink flicks off its nib out to `reach` (the enemy it hits, or where the poke ends) and
## splats there, then fades. The pen used to fly the whole reach itself and fade out over there,
## too far from the player (the user's words); a stroke all the way from the player before that read
## as a laser. Over the hit puffs, so the pen and the ink stay in view. A child of the weapon, so
## the pen moves with the player; the ink is left in the world where it was flicked (Ink), so the
## splat stays on the enemy it hit (.39: it slid off with the player).
class Jab:
	extends Node2D

	const OUT_SECONDS := 0.08
	const BACK_SECONDS := 0.12
	const PEN_FADE_SECONDS := 0.08
	## The ink drop's flight out to the reach, then its splat fading there.
	const FLY_SECONDS := 0.1
	const SPLAT_SECONDS := 0.16
	const PEN_SIZE := 26.0
	## Where the pen is held, out from the player's centre, and how far a jab pushes it.
	const HOLD := 16.0
	const THRUST := 10.0
	const DROP_LENGTH := 16.0
	const DROP_WIDTH := 5.0
	## stylus.svg draws the pen turned 45°, its nib at the bottom left.
	const PEN_ART_ANGLE := deg_to_rad(135.0)
	const INK := Color("ff5d9e")

	## The ink got to the end of its flight (FLY_SECONDS): where the poke's enemy is hurt.
	signal landed

	var _direction := Vector2.RIGHT
	var _reach := 80.0
	var _age := 0.0
	var _pen: Sprite2D
	var _ink: Ink

	## `origin` is the player's position in the world at the poke.
	func setup(art: String, origin: Vector2, direction: Vector2, reach: float) -> void:
		_direction = direction
		_reach = reach
		# Over the enemies and the hit puffs (effect layer, z 10), under the damage numbers (20).
		z_index = 12
		_pen = Art.sprite(art, PEN_SIZE)
		_pen.rotation = direction.angle() - PEN_ART_ANGLE
		add_child(_pen)
		_ink = Ink.new()
		_ink.top_level = true
		_ink.position = origin
		_ink.jab = self
		add_child(_ink)
		_place_pen()

	func _process(delta: float) -> void:
		_age += delta
		var pen_done := OUT_SECONDS + BACK_SECONDS + PEN_FADE_SECONDS
		if _age >= maxf(pen_done, FLY_SECONDS + SPLAT_SECONDS):
			queue_free()
			return
		if _age >= FLY_SECONDS and _age - delta < FLY_SECONDS:
			landed.emit()
		_pen.modulate.a = 1.0 - clampf((_age - OUT_SECONDS - BACK_SECONDS) / PEN_FADE_SECONDS, 0.0, 1.0)
		_place_pen()
		_ink.queue_redraw()

	## How far past where it's held the pen is: quickly out, then back.
	func _thrust() -> float:
		if _age < OUT_SECONDS:
			return THRUST * ease(_age / OUT_SECONDS, 0.4)
		return THRUST * (1.0 - minf((_age - OUT_SECONDS) / BACK_SECONDS, 1.0))

	func _nib() -> Vector2:
		return _direction * (HOLD + _thrust())

	## The pen sits back from the nib by about a third of its size, so the nib leads.
	func _place_pen() -> void:
		_pen.position = _nib() - _direction * PEN_SIZE * 0.3


## A poke's ink, left in the world where it was flicked: the drop racing out from the nib, then the
## splat where it landed (the poke's Jab drives it).
class Ink:
	extends Node2D

	var jab: Jab

	func _draw() -> void:
		var direction := jab._direction
		var reach := jab._reach
		var age := jab._age
		var side := direction.orthogonal()
		if age < Jab.FLY_SECONDS:
			# The drop, pointed at its front and round at its back, racing out from the nib.
			# Starts off the nib, or at the enemy when that is closer.
			var from := minf(Jab.HOLD + Jab.THRUST, reach)
			var head := direction * lerpf(from, reach, ease(age / Jab.FLY_SECONDS, 0.4))
			var length := minf(Jab.DROP_LENGTH, head.length() - from)
			# Just off the nib it is too short to draw: a flat triangle won't triangulate.
			if length < 4.0:
				return
			var tail := head - direction * length
			var drop := PackedVector2Array([head, tail + side * Jab.DROP_WIDTH / 2.0, tail - side * Jab.DROP_WIDTH / 2.0])
			draw_circle(tail, Jab.DROP_WIDTH / 2.0 + 1.0, Art.INK)
			draw_colored_polygon(drop, Art.INK)
			draw_circle(tail, Jab.DROP_WIDTH / 2.0 - 0.5, Jab.INK)
			var inner := PackedVector2Array([head - direction * 2.0, tail + side * (Jab.DROP_WIDTH / 2.0 - 1.2), tail - side * (Jab.DROP_WIDTH / 2.0 - 1.2)])
			draw_colored_polygon(inner, Jab.INK)
			return
		# The splat where the poke ends: a blot and two specks, fading.
		var fade := 1.0 - clampf((age - Jab.FLY_SECONDS) / Jab.SPLAT_SECONDS, 0.0, 1.0)
		var at := direction * reach
		for speck: Array in [[Vector2.ZERO, 4.0], [side * 6.0 - direction * 2.0, 1.8], [-side * 5.0 + direction * 3.0, 1.5]]:
			draw_circle(at + speck[0], speck[1] + 1.0, Color(Art.INK, fade))
			draw_circle(at + speck[0], speck[1], Color(Jab.INK, fade))
