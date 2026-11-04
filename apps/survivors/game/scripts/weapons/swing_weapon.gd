class_name SwingWeapon
extends Weapon
## A swing round the front of the player: everything the beam sweeps over is hurt as it gets
## there. The product manager's 激光笔, the laser pointer from every review meeting (.62, the user:
## keep the swing, change the weapon; until then 「PRD 卷筒」, the spec rolled up and swung).
## Halls of Torment's sword, HoloCure's scythe. 需求评审会 (evolved with 站会): every swing a full
## circle, at least EVOLVED_RADIUS wide, that stuns.
##
## It no longer knocks back (140) or, from its second upgrade on, stuns (0.3-0.5 s): .39, the
## user's call for every job's own weapon, so the jobs differ only in how they deal damage.
##
## The product manager's own weapon, so it levels up along two directions (Upgrades.BRANCHES):
## 更长 reaches further, 更宽 widens the arc (four of those make a half circle). Either way each
## upgrade also hits harder; none swings sooner (.39: only 双屏显示器 speeds weapons up).
##
## The swing is drawn as the beam itself sweeping through the arc (a bare white flash read as
## nothing in particular), what it hits sparks, and now and then the product manager says one of
## their lines.

## 7 a hit at level 1 (.39, the user's call): an opening Bug (8 health, 10.4 in Beijing, up to 13
## by 1:00) takes two hits on every map. Growth and pace come from the balance fit (DESIGN.md 2.2).
const BASE_DAMAGE := 7.0
## 10 an upgrade from 66 (the user: PM 武器有点强了，改弱点; 13 until then): about a fifth less at
## every level past the first (59 → 47 after four, 111 → 87 at full).
## .74 (the user: 有穿透的武器数值调低点……激光笔初始伤害不动，成长伤害降低；可以不要降那么多，改成
## 范围/长度调整): a swing catches everything in its arc, so in a late crowd it outdid every other
## job's weapon (about 930 damage a second alone at 8:00 against the programmer's 360). Now +6 a
## level (+10 before), and each 更长 / 更宽 adds half what it did: +4 reach (+8), +15° (+22.5°, so
## four make 150° rather than a half circle). About 500 a second at full level at 8:00.
const DAMAGE_PER_UPGRADE := 6.0
## 60° to start with from .86 (the user: 范围调小一点, 60度开始: a longer, narrower beam), so four
## 更宽 reach 120°; 90° until .85 (narrowed from 120° at the user's request, so a swing reads as aimed).
const BASE_ARC_DEGREES := 60.0
## Four 更宽 reached MAX_ARC_DEGREES, a half circle, .35–.73 (the user's call; it went all the
## way round, 67.5° a time, which left nothing to aim); 150° since .74, MAX_ARC_DEGREES kept as a cap.
const ARC_PER_WIDER := 15.0
const MAX_ARC_DEGREES := 180.0
## 60 from .86 (the user: PM 的初始攻击距离加一点; 每次更长 +5): it reaches further, the product
## manager being among the weakest jobs; 50 and +4 a 更长 until then. Full 更长 reaches 80.
const BASE_RADIUS := 60.0
const RADIUS_PER_LONGER := 5.0
const COOLDOWN := 0.85
## Swings at the nearest enemy this close, otherwise the way the player faces.
const AIM_RANGE := 70.0
const EVOLVED_RADIUS := 80.0
const EVOLVED_STUN := 0.6
## Enemies per swing that spark, so a swing through a crowd doesn't spawn dozens.
## (The product manager's lines moved to Jobs with every other job's, said by Game._taunt.)
const SPARKS_PER_SWING := 4


## What the swing is with `longer` upgrades to 更长 and `wider` to 更宽 (the cards' numbers too).
static func branch_stats(longer: int, wider: int) -> Dictionary:
	var upgrades := longer + wider
	return {"damage": BASE_DAMAGE + DAMAGE_PER_UPGRADE * upgrades, "radius": BASE_RADIUS + RADIUS_PER_LONGER * longer,
		"arc": minf(MAX_ARC_DEGREES, BASE_ARC_DEGREES + ARC_PER_WIDER * wider)}


func cooldown() -> float:
	return COOLDOWN


func fire() -> bool:
	var stats := branch_stats(branch_a, branch_b)
	var radius: float = maxf(EVOLVED_RADIUS, stats["radius"]) if evolved else stats["radius"]
	var arc: float = TAU if evolved or stats["arc"] >= 360.0 else deg_to_rad(stats["arc"])
	var target := game.nearest_enemy(player.position, AIM_RANGE)
	var aim := player.facing if target == null else (target.position - player.position).normalized()
	var sweep := Sweep.new()
	sweep.setup(aim.angle(), arc, radius)
	sweep.damage = stats["damage"] * damage_scale()
	sweep.stun = EVOLVED_STUN if evolved else 0.0
	sweep.swept_over.connect(_hit_swept.bind(sweep))
	add_child(sweep)
	return true


## Hurts what the beam went over this frame (`from` to `to`, radians into the swing), so a hit
## lands as the beam gets there and only inside the wedge as drawn: measured from where the player
## is now (the wedge moves with them), counting an enemy whose body reaches into the wedge, each
## enemy at most once a swing. Until .39 the whole arc was hit the moment the swing began, by
## where enemies' centres were, and an enemy pressed against the player was hit from any side,
## so hits didn't match the drawing (the user's report).
func _hit_swept(from: float, to: float, sweep: Sweep) -> void:
	var landed := 0
	var hit_boss := false
	for enemy in game.query_enemies(player.position, sweep.reach):
		var key := enemy.get_instance_id()
		if sweep.hit.has(key):
			continue
		var offset := enemy.position - player.position
		var distance := offset.length()
		# How far round the body pokes either side of its centre, as seen from the player.
		var spread := PI if distance <= enemy.hit_radius else asin(enemy.hit_radius / distance)
		var into := fposmod(offset.angle() - sweep.start, TAU)
		# A body straddling where the swing starts is measured from either side of the start.
		if not (_reaches(into, spread, from, to) or _reaches(into - TAU, spread, from, to)):
			continue
		sweep.hit[key] = true
		if sweep.hit.size() <= SPARKS_PER_SWING:
			Effects.spark(game, enemy.position, false)
		game.damage_enemy(enemy, sweep.damage, Vector2.ZERO, id)
		if sweep.stun > 0.0:
			enemy.stun(sweep.stun)
		landed += 1
		hit_boss = hit_boss or enemy.is_elite
	# The shake once the swing has gone through a crowd, the hitstop as it lands on a boss.
	var crowd := sweep.hit.size() >= Game.SHAKE_CROWD and sweep.hit.size() - landed < Game.SHAKE_CROWD
	if crowd or hit_boss:
		game.melee_impact(sweep.hit.size() if crowd else 0, hit_boss)


## Whether a body centred `into` radians into the swing, `spread` wide either side, overlaps the
## stretch from `from` to `to`.
static func _reaches(into: float, spread: float, from: float, to: float) -> bool:
	return into + spread >= from and into - spread <= to


## One swing as drawn: the laser pointer's beam, reaching from the player's side out to the
## swing's reach, sweeping from one end of the arc to the other (all the way round at full level)
## with a short green afterglow behind it that fades towards its tail, then fades out. The beam is
## what hits, as it gets there, so the drawing is the beam moving (.39, the user's report: a wedge
## over the whole arc, laid down at once and left there, read as the whole arc being hit at once
## while the hits came where the roll was). Green, not a laser pointer's usual red, since red on
## the ground is how a boss warns of an attack (.62). The afterglow lies on the ground under the
## crowd, the beam goes over it. A child of the weapon, so it moves with the player.
class Sweep:
	extends Node2D

	const SWEEP_SECONDS := 0.18
	const FADE_SECONDS := 0.12
	## How far out from the player the beam starts (the pointer in their hand).
	const HOLD := 10.0
	## How far round behind the beam its afterglow trails, in radians.
	const TRAIL := 0.6
	const LASER := Color("39d98a")
	const LASER_CORE := Color("eafff3")

	## Each frame the beam moves on: the stretch of the swing it covered, in radians from `start`.
	signal swept_over(from: float, to: float)

	## Where the swing starts (an angle) and how far out it reaches.
	var start := 0.0
	var reach := 50.0
	## What each enemy it goes over takes, set by the weapon; `hit` holds the ones already hit.
	var damage := 0.0
	var stun := 0.0
	var hit := {}
	var _arc := PI
	var _age := 0.0
	var _covered := 0.0
	## The beam, drawn along its own x axis and turned to the swing.
	var _beam: Beam

	func setup(middle: float, arc: float, swing_reach: float) -> void:
		start = middle - arc / 2.0
		_arc = arc
		reach = swing_reach
		# The afterglow on the ground under everyone, like the Wi-Fi field; the beam over the
		# enemies, like the drones (its z counts from this one's).
		z_index = -1
		_beam = Beam.new()
		_beam.z_index = 7
		_beam.reach = reach
		add_child(_beam)
		_place_beam()

	func _process(delta: float) -> void:
		_age += delta
		if _age >= SWEEP_SECONDS + FADE_SECONDS:
			queue_free()
			return
		if _age > SWEEP_SECONDS:
			modulate.a = 1.0 - (_age - SWEEP_SECONDS) / FADE_SECONDS
		var swept := _swept()
		if swept > _covered:
			swept_over.emit(_covered, swept)
			_covered = swept
		_place_beam()
		queue_redraw()

	## Fast out of the wind-up, easing into the end of the swing.
	func _swept() -> float:
		return _arc * ease(minf(_age / SWEEP_SECONDS, 1.0), 0.5)

	func _place_beam() -> void:
		_beam.rotation = start + _swept()

	func _draw() -> void:
		var swept := _swept()
		# Once the beam has stopped, the afterglow catches up with it as it fades.
		var trail := TRAIL
		if _age > SWEEP_SECONDS:
			trail *= 1.0 - (_age - SWEEP_SECONDS) / FADE_SECONDS
		var tail := maxf(0.0, swept - trail)
		if swept - tail < 0.02:
			return
		# A band from the beam's near end out to the reach, faint at the tail and strongest at the
		# beam; its rim lit the same way.
		var steps := maxi(3, ceili((swept - tail) / 0.08))
		var outer := PackedVector2Array()
		var inner := PackedVector2Array()
		var shades := PackedColorArray()
		var rim_shades := PackedColorArray()
		for i in steps + 1:
			var along := float(i) / steps
			var heading := Vector2.from_angle(start + tail + (swept - tail) * along)
			outer.append(heading * reach)
			inner.append(heading * HOLD)
			shades.append(Color(LASER, 0.3 * along))
			rim_shades.append(Color(LASER, 0.8 * along))
		var band := outer.duplicate()
		var band_shades := shades.duplicate()
		for i in range(steps, -1, -1):
			band.append(inner[i])
			band_shades.append(shades[i])
		draw_polygon(band, band_shades)
		draw_polyline_colors(outer, rim_shades, 2.0, true)


## The beam itself: a soft green glow round a bright core, from the pointer's end (Sweep.HOLD) out
## to the reach, with the dot it makes there.
class Beam:
	extends Node2D

	var reach := 50.0

	func _draw() -> void:
		var near := Vector2(Sweep.HOLD, 0.0)
		var far := Vector2(reach, 0.0)
		draw_line(near, far, Color(Sweep.LASER, 0.35), 7.0, true)
		draw_line(near, far, Sweep.LASER_CORE, 2.4, true)
		draw_circle(near, 2.0, Sweep.LASER)
		draw_circle(far, 3.6, Sweep.LASER)
		draw_circle(far, 1.6, Sweep.LASER_CORE)
