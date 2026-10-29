class_name SwingWeapon
extends Weapon
## A swing round the front of the player: everything inside the arc is hurt and knocked well back,
## and from its second upgrade on also stunned for a moment. (Silicon Valley: PRD 卷筒, the spec
## rolled up and swung.) Halls of Torment's sword, HoloCure's scythe. 需求评审会 (evolved with
## 站会): every swing a full circle, at least EVOLVED_RADIUS wide, that stuns longer.
##
## The product manager's own weapon, so it levels up along two directions (Upgrades.BRANCHES):
## 更长 reaches further, 更宽 widens the arc (four of those go all the way round). Either way each
## upgrade also hits harder and swings a little sooner.
##
## The swing is drawn as the roll itself sweeping through the arc (a bare white flash read as
## nothing in particular), what it hits sheds scraps of paper, and now and then the product
## manager says one of their lines.

const BASE_DAMAGE := 20.0
const DAMAGE_PER_UPGRADE := 6.0
## 90° to start with (narrowed from 120° at the user's request, so a swing reads as aimed).
const BASE_ARC_DEGREES := 90.0
const ARC_PER_WIDER := 67.5
const BASE_RADIUS := 50.0
const RADIUS_PER_LONGER := 8.0
const BASE_COOLDOWN := 1.0
const COOLDOWN_PER_UPGRADE := 0.05
## By level (1 + upgrades either way).
const STUN := [0.0, 0.0, 0.3, 0.3, 0.5]
const KNOCKBACK := 140.0
## Swings at the nearest enemy this close, otherwise the way the player faces.
const AIM_RANGE := 70.0
const EVOLVED_RADIUS := 80.0
const EVOLVED_STUN := 0.6
## Enemies per swing that shed paper scraps, so a swing through a crowd doesn't spawn dozens.
const SCRAPS_PER_SWING := 4
## A line at most this often, and only on a swing that hit something.
const LINE_GAP := 2.5
const LINES := ["改个需求", "这个很简单", "明天能上吗", "加个按钮", "对齐一下", "用户要的", "先上线再说"]

var _line_left := 0.0


## What the swing is with `longer` upgrades to 更长 and `wider` to 更宽 (the cards' numbers too).
static func branch_stats(longer: int, wider: int) -> Dictionary:
	var upgrades := longer + wider
	return {"damage": BASE_DAMAGE + DAMAGE_PER_UPGRADE * upgrades, "radius": BASE_RADIUS + RADIUS_PER_LONGER * longer,
		"arc": minf(360.0, BASE_ARC_DEGREES + ARC_PER_WIDER * wider), "cooldown": BASE_COOLDOWN - COOLDOWN_PER_UPGRADE * upgrades}


func cooldown() -> float:
	return branch_stats(branch_a, branch_b)["cooldown"]


func fire() -> bool:
	var stats := branch_stats(branch_a, branch_b)
	var radius: float = maxf(EVOLVED_RADIUS, stats["radius"]) if evolved else stats["radius"]
	var arc: float = TAU if evolved or stats["arc"] >= 360.0 else deg_to_rad(stats["arc"])
	var stun: float = EVOLVED_STUN if evolved else stat(STUN)
	var target := game.nearest_enemy(player.position, AIM_RANGE)
	var aim := player.facing if target == null else (target.position - player.position).normalized()
	var damage: float = stats["damage"] * damage_scale()
	var hits := 0
	var hit_boss := false
	for enemy in game.query_enemies(player.position, radius):
		var offset := enemy.position - player.position
		# Outside the arc only counts once it is clear of the player: one pressed against them is
		# hit whichever way the swing goes.
		if arc < TAU and offset.length() > enemy.radius + Player.HURT_RADIUS and absf(aim.angle_to(offset)) > arc / 2.0:
			continue
		if hits < SCRAPS_PER_SWING:
			Effects.scraps(game, enemy.position)
		game.damage_enemy(enemy, damage, offset.normalized() * KNOCKBACK, id)
		if stun > 0.0:
			enemy.stun(stun)
		hits += 1
		hit_boss = hit_boss or enemy.is_elite
	var sweep := Sweep.new()
	sweep.setup(art, aim.angle(), arc, radius)
	add_child(sweep)
	if hits > 0 and _line_left <= 0.0:
		_line_left = LINE_GAP
		Effects.callout(game, player.position + Vector2(0.0, -10.0), tr(LINES[game.rng.randi() % LINES.size()]), Art.PAPER)
	game.melee_impact(hits, hit_boss)
	return true


func _process(delta: float) -> void:
	super(delta)
	_line_left -= delta


## One swing as drawn: the rolled-up PRD sweeping from one end of the arc to the other (all the
## way round at full level), leaving behind it a paper-coloured wedge from the player's feet out
## to the swing's reach (exactly what it hits; a crescent out at the tip left the close-in part
## of the swing looking unhit), which then fades. The wedge lies on the ground under the crowd,
## the roll goes over it. A child of the weapon, so it moves with the player.
class Sweep:
	extends Node2D

	const SWEEP_SECONDS := 0.18
	const FADE_SECONDS := 0.12
	const ROLL_SIZE := 26.0
	const PAPER := Color("fff7e0")
	## prd_roll.svg draws the roll turned 35° up to the right, its curled end at the top right:
	## turned by heading minus this, the curled end points outward along the swing.
	const ROLL_ART_ANGLE := deg_to_rad(-35.0)

	var _start := 0.0
	var _arc := PI
	var _reach := 50.0
	var _age := 0.0
	var _roll: Sprite2D

	func setup(art: String, middle: float, arc: float, reach: float) -> void:
		_start = middle - arc / 2.0
		_arc = arc
		_reach = reach
		# The wedge on the ground under everyone, like the Wi-Fi field; the roll over the enemies,
		# like the drones (its z counts from this one's).
		z_index = -1
		_roll = Art.sprite(art, ROLL_SIZE)
		_roll.z_index = 7
		add_child(_roll)
		_place_roll()

	func _process(delta: float) -> void:
		_age += delta
		if _age >= SWEEP_SECONDS + FADE_SECONDS:
			queue_free()
			return
		if _age > SWEEP_SECONDS:
			modulate.a = 1.0 - (_age - SWEEP_SECONDS) / FADE_SECONDS
		_place_roll()
		queue_redraw()

	## Fast out of the wind-up, easing into the end of the swing.
	func _swept() -> float:
		return _arc * ease(minf(_age / SWEEP_SECONDS, 1.0), 0.5)

	## Held by one end, pointing out from the player along the swing.
	func _place_roll() -> void:
		var heading := _start + _swept()
		_roll.position = Vector2.from_angle(heading) * _reach * 0.7
		_roll.rotation = heading - ROLL_ART_ANGLE

	func _draw() -> void:
		var swept := _swept()
		if swept < 0.05:
			return
		# The swept part of the circle: a wedge from the centre, or a disc once it has gone round.
		var steps := maxi(6, ceili(swept / 0.12))
		var rim := PackedVector2Array()
		for i in steps + 1:
			rim.append(Vector2.from_angle(_start + swept * float(i) / steps) * _reach)
		var wedge := rim.duplicate()
		if swept < TAU - 0.01:
			wedge.append(Vector2.ZERO)
		else:
			# All the way round the rim's last point is its first again, which the polygon fill
			# rejects (triangulation fails on the repeated point).
			wedge.remove_at(wedge.size() - 1)
		draw_colored_polygon(wedge, Color(PAPER, 0.75))
		draw_polyline(rim, Art.INK, 2.0, true)
		if swept < TAU - 0.01:
			# Faint straight edges, so the wedge's two sides read too.
			var edge := Color(Art.INK, 0.35)
			draw_line(Vector2.ZERO, rim[0], edge, 1.0, true)
			draw_line(Vector2.ZERO, rim[rim.size() - 1], edge, 1.0, true)
