class_name Effects
extends RefCounted
## Short-lived visual feedback: damage numbers, hit sparks, dust, death puffs and pops,
## lightning strikes, blast rings, the melee weapons' lashes and stabs, paper scraps, and short
## callouts over the world. (The PRD roll's swing is drawn by SwingWeapon itself, as it follows
## the player.)

const MAX_DAMAGE_NUMBERS := 40
## Hits at least this hard get a bigger, yellow number.
const BIG_HIT := 30.0
## Kills popping at once; past that a kill only puffs (a bomb going off in a crowd).
const MAX_DEATH_POPS := 24
const DEATH_POP_GROUP := "death_pop"

static var _number_settings: LabelSettings
static var _big_number_settings: LabelSettings
static var _fade_ramp: Gradient
static var _dot: GradientTexture2D


static func damage_number(game: Game, at: Vector2, amount: float) -> void:
	# Capped because the aura and lightning can land dozens of hits per second.
	if game.number_layer.get_child_count() >= MAX_DAMAGE_NUMBERS:
		return
	if _number_settings == null:
		_number_settings = _number_style(10, Color.WHITE)
		_big_number_settings = _number_style(13, Art.YELLOW)
	var big := amount >= BIG_HIT
	var label := Label.new()
	label.text = str(roundi(amount))
	label.label_settings = _big_number_settings if big else _number_settings
	# Digits never need translating; skip the lookup for the dozens spawned per second.
	label.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.size = Vector2(32, 18 if big else 14)
	label.position = at + Vector2(randf_range(-4, 4) - 16, -22)
	# Pops in oversized and settles, so a hit lands with a beat instead of a label appearing.
	label.pivot_offset = label.size / 2.0
	label.scale = Vector2.ONE * (1.8 if big else 1.5)
	game.number_layer.add_child(label)
	var tween := label.create_tween()
	tween.tween_property(label, "scale", Vector2.ONE, 0.1).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_BACK)
	tween.parallel().tween_property(label, "position:y", label.position.y - 10.0, 0.45) \
		.set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_QUAD)
	tween.parallel().tween_property(label, "modulate:a", 0.0, 0.2).set_delay(0.25)
	tween.tween_callback(label.queue_free)


static func _number_style(size: int, color: Color) -> LabelSettings:
	var settings := LabelSettings.new()
	settings.font = Art.display_font(900)
	settings.font_size = size
	settings.font_color = color
	settings.outline_size = 4
	settings.outline_color = Art.INK
	return settings


## A white star where a hit landed, bigger for a heavy one.
static func spark(game: Game, at: Vector2, big: bool) -> void:
	_bursts(game).add(Bursts.SPARK, at, randf() * TAU, 1.4 if big else 1.0)


## A little cloud of dust kicked up behind something knocked along `direction`.
static func dust(game: Game, at: Vector2, direction: Vector2) -> void:
	_bursts(game).add(Bursts.DUST, at, direction.angle(), 1.0)


## Speed lines thrown out along `direction` from a heavy impact (a train).
static func streaks(game: Game, at: Vector2, direction: Vector2) -> void:
	_bursts(game).add(Bursts.STREAKS, at, direction.angle(), 1.0)


## The game's one node drawing every spark, dust cloud and streak: hits come dozens a second,
## too many for a node each.
static func _bursts(game: Game) -> Bursts:
	var layer := game.effect_layer.get_node_or_null(^"Bursts") as Bursts
	if layer == null:
		layer = Bursts.new()
		layer.name = "Bursts"
		game.effect_layer.add_child(layer)
	return layer


## A killed enemy's last beat: a copy of it flashes white and swells back into its own colours,
## then squashes flat into the ground and fades, so a kill reads as more than the sprite blinking
## out. (Left white throughout, a few kills together read as a cloud.) A boss takes longer.
static func death_pop(game: Game, sprite: Sprite2D, at: Vector2, boss: bool) -> void:
	if game.get_tree().get_node_count_in_group(DEATH_POP_GROUP) >= MAX_DEATH_POPS:
		return
	var corpse := Sprite2D.new()
	corpse.texture = sprite.texture
	corpse.flip_h = sprite.flip_h
	corpse.offset = sprite.offset
	corpse.position = at + sprite.position
	corpse.scale = sprite.scale
	corpse.modulate = Enemy.FLASH_COLOR
	corpse.add_to_group(DEATH_POP_GROUP)
	game.effect_layer.add_child(corpse)
	var base := sprite.scale
	var swell := 1.5 if boss else 1.3
	var seconds := 0.3 if boss else 0.15
	# Squashed towards its feet rather than its middle, as if pressed into the ground.
	var feet := corpse.position.y + sprite.texture.get_height() * base.y / 2.0
	var tween := corpse.create_tween()
	tween.tween_property(corpse, "scale", base * swell, seconds * 0.35).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_QUAD)
	tween.parallel().tween_property(corpse, "modulate", Color.WHITE, seconds * 0.35)
	tween.tween_property(corpse, "scale", Vector2(base.x * swell * 1.2, 0.0), seconds * 0.65).set_ease(Tween.EASE_IN).set_trans(Tween.TRANS_QUAD)
	tween.parallel().tween_property(corpse, "position:y", feet, seconds * 0.65).set_ease(Tween.EASE_IN).set_trans(Tween.TRANS_QUAD)
	tween.parallel().tween_property(corpse, "modulate", Color(1, 1, 1, 0), seconds * 0.65)
	tween.tween_callback(corpse.queue_free)


static func poof(game: Game, at: Vector2, color: Color) -> void:
	if _fade_ramp == null:
		_fade_ramp = Gradient.new()
		_fade_ramp.set_color(0, Color.WHITE)
		_fade_ramp.set_color(1, Color(1, 1, 1, 0))
	var particles := CPUParticles2D.new()
	particles.position = at
	particles.texture = _dot_texture()
	particles.one_shot = true
	particles.amount = 8
	particles.lifetime = 0.35
	particles.explosiveness = 1.0
	particles.spread = 180.0
	particles.gravity = Vector2.ZERO
	particles.initial_velocity_min = 25.0
	particles.initial_velocity_max = 60.0
	particles.damping_min = 80.0
	particles.damping_max = 120.0
	particles.scale_amount_min = 0.25
	particles.scale_amount_max = 0.45
	particles.color = color
	particles.color_ramp = _fade_ramp
	particles.finished.connect(particles.queue_free)
	game.effect_layer.add_child(particles)
	particles.emitting = true


## A cloud pops up above the target and drops a bolt on it.
static func lightning(game: Game, target: Vector2, cloud_art: String) -> void:
	var top := target + Vector2(randf_range(-10, 10), -70)
	var cloud := Art.sprite(cloud_art, 26.0)
	cloud.position = top
	game.effect_layer.add_child(cloud)

	var points := PackedVector2Array([top + Vector2(0, 6)])
	var point := points[0]
	# Jagged segments down to the target.
	for step in 5:
		point = point.lerp(target, 1.0 / (5 - step)) + Vector2(randf_range(-6, 6), 0)
		points.append(point)
	points[points.size() - 1] = target
	# A dark stroke under a yellow one gives the bolt the same outline as the drawings.
	var outline := _bolt_line(points, 5.0, Art.INK)
	var core := _bolt_line(points, 2.5, Art.YELLOW)
	game.effect_layer.add_child(outline)
	game.effect_layer.add_child(core)

	for node: CanvasItem in [cloud, outline, core]:
		var tween := node.create_tween()
		tween.tween_interval(0.12)
		tween.tween_property(node, "modulate:a", 0.0, 0.2)
		tween.tween_callback(node.queue_free)
	poof(game, target, Art.YELLOW)


## A blast's reach: a ring at `radius` from the first frame, fading, with a fainter wave running
## out to it, so the player sees how far one reached the moment it hits (the perks' blasts, bombs,
## the screensaver's corner, boss shockwaves). Until .39 the ring grew out from a third of the
## radius as it faded, so a blast that hurt everything at once showed only its middle when it hit.
static func ring(game: Game, at: Vector2, radius: float, color: Color) -> void:
	var blast := BlastRing.new()
	blast.position = at
	blast.radius = radius
	blast.color = color
	game.effect_layer.add_child(blast)


## A lash or stab: a white bar from `at` along `direction`, `length` long and `width` wide.
static func lash(game: Game, at: Vector2, direction: Vector2, length: float, width: float) -> void:
	var swing := Swoosh.new()
	swing.position = at
	swing.angle = direction.angle()
	swing.reach = length
	swing.width = width
	game.effect_layer.add_child(swing)


## A few torn bits of paper flying off something hit with the PRD roll: white with an ink edge,
## so they show on the lawn as well as the road (a puff of white dots wouldn't).
static func scraps(game: Game, at: Vector2) -> void:
	var burst := PaperScraps.new()
	burst.position = at
	game.effect_layer.add_child(burst)


## A word or two popping up over the world and drifting up (屏保 hitting a corner, every job's
## trash talk, a car's 砰).
static func callout(game: Game, at: Vector2, text: String, color: Color, size: int = 13) -> void:
	var label := Label.new()
	label.text = text
	var settings := LabelSettings.new()
	settings.font = Art.display_font(900)
	settings.font_size = size
	settings.font_color = color
	settings.outline_size = 5
	settings.outline_color = Art.INK
	label.label_settings = settings
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.size = Vector2(120, 18)
	label.position = at + Vector2(-60, -30)
	game.number_layer.add_child(label)
	var tween := label.create_tween()
	tween.tween_property(label, "position:y", label.position.y - 16.0, 0.8).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_QUAD)
	tween.parallel().tween_property(label, "modulate:a", 0.0, 0.3).set_delay(0.5)
	tween.tween_callback(label.queue_free)


## Hit sparks, dust clouds and impact streaks, all drawn by this one node: each is a kind, a
## spot, an angle, a size and an age.
class Bursts:
	extends Node2D

	const SPARK := 0
	const DUST := 1
	const STREAKS := 2
	const LIFETIMES := [0.12, 0.35, 0.22]
	## The oldest go first past this many, so a bomb in a crowd can't pile up hundreds.
	const MAX_BURSTS := 80
	const DUST_COLOR := Color("d9d2c3")

	var _kinds := PackedInt32Array()
	var _spots := PackedVector2Array()
	var _angles := PackedFloat32Array()
	var _sizes := PackedFloat32Array()
	var _ages := PackedFloat32Array()
	## Whether anything was drawn last frame, so the last one fading still clears.
	var _drawn := false

	func add(kind: int, at: Vector2, angle: float, size: float) -> void:
		if _kinds.size() >= MAX_BURSTS:
			_remove(0)
		_kinds.append(kind)
		_spots.append(at)
		_angles.append(angle)
		_sizes.append(size)
		_ages.append(0.0)

	func _process(delta: float) -> void:
		for i in range(_kinds.size() - 1, -1, -1):
			_ages[i] += delta
			if _ages[i] >= LIFETIMES[_kinds[i]]:
				_remove(i)
		if _drawn or not _kinds.is_empty():
			queue_redraw()
		_drawn = not _kinds.is_empty()

	func _remove(index: int) -> void:
		_kinds.remove_at(index)
		_spots.remove_at(index)
		_angles.remove_at(index)
		_sizes.remove_at(index)
		_ages.remove_at(index)

	func _draw() -> void:
		for i in _kinds.size():
			var progress: float = _ages[i] / LIFETIMES[_kinds[i]]
			match _kinds[i]:
				SPARK:
					_draw_spark(_spots[i], _angles[i], _sizes[i], progress)
				DUST:
					_draw_dust(_spots[i], _angles[i], progress)
				STREAKS:
					_draw_streaks(_spots[i], _angles[i], progress)

	## A four-pointed star, inked like the drawings, growing a little as it fades.
	func _draw_spark(at: Vector2, angle: float, size: float, progress: float) -> void:
		var reach := 7.0 * size * (0.8 + 0.5 * progress)
		var star := PackedVector2Array()
		for point in 8:
			var length := reach if point % 2 == 0 else reach * 0.3
			star.append(at + Vector2.from_angle(angle + TAU * point / 8.0) * length)
		var alpha := 1.0 - progress * progress
		draw_colored_polygon(star, Color(1, 1, 1, alpha))
		star.append(star[0])
		draw_polyline(star, Color(Art.INK, alpha), 1.2, true)

	## Three soft puffs behind whatever was knocked, drifting back and spreading.
	func _draw_dust(at: Vector2, angle: float, progress: float) -> void:
		for puff in 3:
			var heading := Vector2.from_angle(angle + PI + (puff - 1) * 0.7)
			var center := at + heading * (4.0 + 10.0 * progress) + Vector2(0.0, 4.0)
			draw_circle(center, 2.5 + 3.0 * progress, Color(DUST_COLOR, 0.8 * (1.0 - progress)))

	## Three inked lines fanned out along the impact, racing outwards and shrinking.
	func _draw_streaks(at: Vector2, angle: float, progress: float) -> void:
		for line in 3:
			var heading := Vector2.from_angle(angle + (line - 1) * 0.35)
			var start := at + heading * (8.0 + 26.0 * progress)
			var finish := start + heading * 16.0 * (1.0 - progress)
			draw_line(start, finish, Art.INK, 4.0, true)
			draw_line(start, finish, Art.PAPER, 2.0, true)


## A lash or stab: drawn once, fading over SECONDS.
class Swoosh:
	extends Node2D

	const SECONDS := 0.15

	var angle := 0.0
	var reach := 50.0
	var width := 12.0
	var _age := 0.0

	func _process(delta: float) -> void:
		_age += delta
		if _age >= SECONDS:
			queue_free()
			return
		modulate.a = 1.0 - _age / SECONDS
		queue_redraw()

	func _draw() -> void:
		var along := Vector2.from_angle(angle)
		var side := along.orthogonal() * width / 2.0
		var tip := along * reach
		var bar := PackedVector2Array([side, tip + side * 0.4, tip - side * 0.4, -side])
		draw_colored_polygon(bar, Color(1, 1, 1, 0.85))
		bar.append(side)
		draw_polyline(bar, Art.INK, 2.0, true)


class PaperScraps:
	extends Node2D

	const SECONDS := 0.35
	const COUNT := 4
	const SPEED := 70.0

	var _age := 0.0
	var _headings := PackedFloat32Array()
	var _spins := PackedFloat32Array()

	func _ready() -> void:
		for i in COUNT:
			_headings.append(TAU * (i + randf() * 0.6) / COUNT)
			_spins.append(randf_range(-9.0, 9.0))

	func _process(delta: float) -> void:
		_age += delta
		if _age >= SECONDS:
			queue_free()
			return
		modulate.a = 1.0 - _age / SECONDS
		queue_redraw()

	func _draw() -> void:
		# Flung out fast, slowing down.
		var travel := SPEED * SECONDS * (1.0 - pow(1.0 - _age / SECONDS, 2.0))
		for i in COUNT:
			draw_set_transform(Vector2.from_angle(_headings[i]) * travel, _spins[i] * _age, Vector2.ONE)
			var scrap := Rect2(-3.0, -2.0, 6.0, 4.0)
			draw_rect(scrap, Art.PAPER)
			draw_rect(scrap, Art.INK, false, 1.0)
		draw_set_transform(Vector2.ZERO)


class BlastRing:
	extends Node2D

	const SECONDS := 0.3

	var radius := 40.0
	var color := Color.WHITE
	var _age := 0.0

	func _process(delta: float) -> void:
		_age += delta
		if _age >= SECONDS:
			queue_free()
			return
		queue_redraw()

	func _draw() -> void:
		var progress := _age / SECONDS
		var fade := 1.0 - progress
		draw_circle(Vector2.ZERO, radius, Color(color, 0.22 * fade))
		draw_arc(Vector2.ZERO, radius, 0.0, TAU, 40, Color(color, 0.9 * fade), 2.5, true)
		# The wave reaches the ring in the first 40% of the time, never past it.
		var wave := minf(progress / 0.4, 1.0)
		if wave < 1.0:
			draw_arc(Vector2.ZERO, radius * (0.4 + 0.6 * wave), 0.0, TAU, 40, Color(color, 0.5 * (1.0 - wave)), 2.0, true)


static func _bolt_line(points: PackedVector2Array, width: float, color: Color) -> Line2D:
	var line := Line2D.new()
	line.points = points
	line.width = width
	line.default_color = color
	line.joint_mode = Line2D.LINE_JOINT_ROUND
	line.begin_cap_mode = Line2D.LINE_CAP_ROUND
	line.end_cap_mode = Line2D.LINE_CAP_ROUND
	return line


## A soft-edged white disc for particles, so puffs are round dots instead of square pixels.
static func _dot_texture() -> GradientTexture2D:
	if _dot == null:
		var gradient := Gradient.new()
		gradient.offsets = PackedFloat32Array([0.0, 0.8, 1.0])
		gradient.colors = PackedColorArray([Color.WHITE, Color.WHITE, Color(1, 1, 1, 0)])
		_dot = GradientTexture2D.new()
		_dot.gradient = gradient
		_dot.fill = GradientTexture2D.FILL_RADIAL
		_dot.fill_from = Vector2(0.5, 0.5)
		_dot.fill_to = Vector2(1.0, 0.5)
		_dot.width = 16
		_dot.height = 16
	return _dot
