class_name BossAttack
extends RefCounted
## One of a boss's attacks (BossKits, .45): MeleeAttack, PlacedAttack or RangedAttack, each its
## shapes set by `config`. Enemy drives it: start() when it is the boss's turn, tick() every
## frame while busy() (the boss stands, or moves by what tick returns), background() every frame
## regardless (shapes on the ground keep counting down), and draw() on the boss's telegraph canvas,
## in world space, above the crowd so a red shape is never hidden under it.
##
## Red shapes are Zones: shown from the moment they are placed, filling in until they go off
## (`fuse`), then hurting the player if they are inside (by the player's hurt radius, so the line
## drawn is the line that counts) and flashing. A 定点 shape (PlacedAttack, `bomb`) is bombed: for its
## last FALL_SECONDS a bomb drops onto each of its impacts() with its shadow growing under it, and
## it goes off in explosions (Effects.explosion) that stay inside the shape (.46, the user: 红色圆圈完了
## 要有轰炸的动画效果; it only flashed before). How it looks only: what it hurts is unchanged.

## How long a shape that went off stays lit.
const FLASH_SECONDS := 0.18
const FILL := 0.13
const FILL_GROWING := 0.22
const EDGE := 0.85
## A bomb's fall onto a 定点 shape: how long before it goes off, from how high, with a streak this
## long above it.
const FALL_SECONDS := 0.3
const FALL_HEIGHT := 140.0
const FALL_STREAK := 26.0
## The most bombs along one long band (an X's arm, BossKits "cross").
const BOMBS_PER_BAND := 5
## A blast this close to the player (past its own reach) shakes the view.
const SHAKE_REACH := 40.0


class Zone:
	## "circle", "rect" (`half` extents along and across `angle`) or "fan" (`radius`, `spread` wide
	## around `angle`).
	var shape := "circle"
	var center := Vector2.ZERO
	var radius := 0.0
	var half := Vector2.ZERO
	var angle := 0.0
	var spread := 0.0
	var fuse := 1.0
	var left := 1.0
	var damage := 0.0
	## A drawn-only shape (a dash's lane: the boss's body is what hits, MeleeAttack).
	var armed := true
	## A lane fills from its start along `angle`, not out from the middle.
	var fills_along := false
	## A 定点 shape, bombed as it goes off (set by PlacedAttack).
	var bomb := false
	var flash_left := 0.0

	func progress() -> float:
		return clampf(1.0 - left / fuse, 0.0, 1.0)


var enemy: Enemy
## The attack's numbers (BossKits), its second phase's merged in (boost).
var config: Dictionary
var game: Game:
	get:
		return enemy.game
var zones: Array[Zone] = []


func start() -> void:
	pass


func busy() -> bool:
	return false


## Each frame while busy: the boss's velocity (ZERO to stand still).
func tick(_delta: float) -> Vector2:
	return Vector2.ZERO


## Each frame, busy or not: shapes counting down and going off.
func background(delta: float) -> void:
	for i in range(zones.size() - 1, -1, -1):
		var zone := zones[i]
		if zone.flash_left > 0.0:
			zone.flash_left -= delta
			if zone.flash_left <= 0.0:
				zones.remove_at(i)
			continue
		zone.left -= delta
		if zone.left <= 0.0:
			_go_off(zone)


## The second phase (BossKits.PHASE_TWO_AT): bigger, wider, more.
func boost(overrides: Dictionary) -> void:
	config.merge(overrides, true)


## The boss went down: whatever it left on the ground goes with it.
func clear() -> void:
	zones.clear()


func form() -> String:
	return config["form"]


func player() -> Player:
	return game.player


## Hurts the player by `amount` scaled for the map, credited to this boss.
func hurt(amount: float) -> void:
	game.hurt_player(Enemy._hits(amount), enemy.type_name, config["form"])


func add_zone(zone: Zone) -> Zone:
	zone.left = zone.fuse
	if zone.damage <= 0.0:
		zone.damage = config.get("damage", 0.0)
	zones.append(zone)
	return zone


func circle(at: Vector2, radius: float, fuse: float) -> Zone:
	var zone := Zone.new()
	zone.center = at
	zone.radius = radius
	zone.fuse = fuse
	return add_zone(zone)


func rect(at: Vector2, half: Vector2, angle: float, fuse: float) -> Zone:
	var zone := Zone.new()
	zone.shape = "rect"
	zone.center = at
	zone.half = half
	zone.angle = angle
	zone.fuse = fuse
	return add_zone(zone)


func _go_off(zone: Zone) -> void:
	zone.flash_left = FLASH_SECONDS
	if zone.armed and inside(zone, player().position):
		hurt(zone.damage)
	if zone.shape == "circle":
		Effects.ring(game, zone.center, zone.radius, Art.BOSS_RED)
	if zone.bomb:
		var shake := false
		for impact: Dictionary in impacts(zone):
			Effects.explosion(game, impact["at"], impact["radius"])
			shake = shake or player().position.distance_to(impact["at"]) <= impact["radius"] + SHAKE_REACH
		if shake:
			player().shake(0.15, 2.0)
	went_off(zone)


## A subclass's say when one of its shapes goes off.
func went_off(_zone: Zone) -> void:
	pass


## Whether the player standing at `point` is caught by `zone` (their hurt radius counts).
static func inside(zone: Zone, point: Vector2) -> bool:
	var reach := Player.HURT_RADIUS
	match zone.shape:
		"circle":
			return point.distance_to(zone.center) <= zone.radius + reach
		"rect":
			var local := (point - zone.center).rotated(-zone.angle)
			return absf(local.x) <= zone.half.x + reach and absf(local.y) <= zone.half.y + reach
		"fan":
			var offset := point - zone.center
			var distance := offset.length()
			if distance > zone.radius + reach:
				return false
			if distance <= reach:
				return true
			# The edge's slack is the hurt radius at that distance, as an angle.
			return absf(angle_difference(zone.angle, offset.angle())) <= zone.spread / 2.0 + asin(minf(reach / distance, 1.0))
	return false


## Where a bombed shape's bombs land (`at`) and how big each blows up (`radius`), inside the shape:
## one in the middle of a circle or a squarish box, a row along a long band (up to BOMBS_PER_BAND),
## each as wide as the band.
static func impacts(zone: Zone) -> Array[Dictionary]:
	if zone.shape != "rect":
		return [{"at": zone.center, "radius": zone.radius}]
	var long := maxf(zone.half.x, zone.half.y)
	var short := minf(zone.half.x, zone.half.y)
	var count := clampi(roundi(long / short), 1, BOMBS_PER_BAND)
	var along := Vector2.from_angle(zone.angle) if zone.half.x >= zone.half.y else Vector2.from_angle(zone.angle).orthogonal()
	var spots: Array[Dictionary] = []
	for i in count:
		spots.append({"at": zone.center + along * (-long + 2.0 * long * (i + 0.5) / count), "radius": minf(short, long / count)})
	return spots


## On the boss's telegraph canvas, in world space.
func draw(canvas: CanvasItem) -> void:
	for zone in zones:
		draw_zone(canvas, zone)


static func draw_zone(canvas: CanvasItem, zone: Zone) -> void:
	var red := Art.BOSS_RED
	var lit := zone.flash_left > 0.0
	var filled := 1.0 if lit else zone.progress()
	# A dash's lane stays lit for the whole rush (MeleeAttack), longer than FLASH_SECONDS.
	var inner := Color(red, 0.45 * minf(zone.flash_left / FLASH_SECONDS, 1.0)) if lit else Color(red, FILL_GROWING)
	match zone.shape:
		"circle":
			canvas.draw_circle(zone.center, zone.radius, Color(red, FILL))
			canvas.draw_circle(zone.center, zone.radius * filled, inner)
			canvas.draw_arc(zone.center, zone.radius, 0.0, TAU, 48, Color(red, EDGE), 2.0, true)
		"rect":
			canvas.draw_set_transform(zone.center, zone.angle)
			var whole := Rect2(-zone.half, zone.half * 2.0)
			canvas.draw_rect(whole, Color(red, FILL))
			var growing := Rect2(-zone.half, Vector2(zone.half.x * 2.0 * filled, zone.half.y * 2.0)) if zone.fills_along \
				else Rect2(-zone.half * filled, zone.half * 2.0 * filled)
			canvas.draw_rect(growing, inner)
			canvas.draw_rect(whole, Color(red, EDGE), false, 2.0)
			canvas.draw_set_transform(Vector2.ZERO)
		"fan":
			canvas.draw_colored_polygon(_fan_points(zone, zone.radius), Color(red, FILL))
			if filled > 0.02:
				canvas.draw_colored_polygon(_fan_points(zone, zone.radius * filled), inner)
			var edge := _fan_points(zone, zone.radius)
			edge.append(edge[0])
			canvas.draw_polyline(edge, Color(red, EDGE), 2.0, true)
	if zone.bomb and not lit and zone.left < FALL_SECONDS:
		_draw_falling(canvas, zone, 1.0 - zone.left / FALL_SECONDS)


## A bombed shape's bombs coming down, `drop` of the way (0 to 1): each one's shadow growing on the
## ground, and the bomb, inked like the art, falling onto it out of a white streak.
static func _draw_falling(canvas: CanvasItem, zone: Zone, drop: float) -> void:
	for impact: Dictionary in impacts(zone):
		var spot: Vector2 = impact["at"]
		var size: float = impact["radius"]
		canvas.draw_circle(spot, size * 0.5 * drop, Color(Art.INK, 0.3 * drop))
		var bomb := spot - Vector2(0.0, FALL_HEIGHT * (1.0 - drop * drop))
		canvas.draw_line(bomb - Vector2(0.0, FALL_STREAK), bomb, Color(Color.WHITE, 0.75), 3.0, true)
		canvas.draw_circle(bomb, 5.0, Art.INK)
		canvas.draw_circle(bomb, 3.5, Art.BOSS_RED)


static func _fan_points(zone: Zone, radius: float) -> PackedVector2Array:
	var points := PackedVector2Array([zone.center])
	var steps := 20
	for i in steps + 1:
		var heading := zone.angle - zone.spread / 2.0 + zone.spread * i / steps
		points.append(zone.center + Vector2.from_angle(heading) * radius)
	return points
