class_name SwingWeapon
extends Weapon
## A swing round the front of the player: everything inside the arc is hurt and knocked well back,
## from level 3 also stunned for a moment, and at level 5 it goes all the way round.
## (Silicon Valley: PRD 卷筒, the spec rolled up and swung.) Halls of Torment's sword, HoloCure's
## scythe. 需求评审会 (evolved with 站会): every swing a wider full circle that stuns longer.
##
## The swing is drawn as the roll itself sweeping through the arc (a bare white flash read as
## nothing in particular), what it hits sheds scraps of paper, and now and then the product
## manager says one of their lines.

const DAMAGE := [20.0, 26.0, 26.0, 34.0, 44.0]
const ARC_DEGREES := [120.0, 120.0, 150.0, 150.0, 360.0]
const RADIUS := [50.0, 50.0, 58.0, 58.0, 66.0]
const COOLDOWN := [1.0, 0.95, 0.9, 0.85, 0.8]
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


func cooldown() -> float:
	return stat(COOLDOWN)


func fire() -> bool:
	var radius: float = EVOLVED_RADIUS if evolved else stat(RADIUS)
	var arc: float = TAU if evolved else deg_to_rad(stat(ARC_DEGREES))
	var stun: float = EVOLVED_STUN if evolved else stat(STUN)
	var target := game.nearest_enemy(player.position, AIM_RANGE)
	var aim := player.facing if target == null else (target.position - player.position).normalized()
	var damage: float = stat(DAMAGE) * damage_scale()
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
## way round at full level), leaving a paper-coloured crescent behind it that then fades. A
## child of the weapon, so it moves with the player.
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
		# Over the enemies, like the drones.
		z_index = 6
		_roll = Art.sprite(art, ROLL_SIZE)
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
		# A crescent over what has been swept so far: thick in its middle, thin at both ends.
		var steps := maxi(6, ceili(swept / 0.12))
		var outer := PackedVector2Array()
		var inner := PackedVector2Array()
		for i in steps + 1:
			var along := float(i) / steps
			var heading := _start + swept * along
			outer.append(Vector2.from_angle(heading) * _reach)
			inner.append(Vector2.from_angle(heading) * lerpf(_reach, _reach * 0.55, sin(along * PI)))
		inner.reverse()
		draw_colored_polygon(outer + inner, Color(PAPER, 0.9))
		draw_polyline(outer, Art.INK, 2.0, true)
