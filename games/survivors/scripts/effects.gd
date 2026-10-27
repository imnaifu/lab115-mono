class_name Effects
extends RefCounted
## Short-lived visual feedback: damage numbers, death puffs and lightning strikes.

const MAX_DAMAGE_NUMBERS := 40

static var _number_settings: LabelSettings
static var _fade_ramp: Gradient
static var _dot: GradientTexture2D


static func damage_number(game: Game, at: Vector2, amount: float) -> void:
	# Capped because the aura and lightning can land dozens of hits per second.
	if game.number_layer.get_child_count() >= MAX_DAMAGE_NUMBERS:
		return
	if _number_settings == null:
		_number_settings = LabelSettings.new()
		_number_settings.font = Art.font()
		_number_settings.font_size = 10
		_number_settings.outline_size = 4
		_number_settings.outline_color = Art.INK
	var label := Label.new()
	label.text = str(roundi(amount))
	label.label_settings = _number_settings
	# Digits never need translating; skip the lookup for the dozens spawned per second.
	label.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.size = Vector2(32, 14)
	label.position = at + Vector2(randf_range(-4, 4) - 16, -22)
	game.number_layer.add_child(label)
	var tween := label.create_tween()
	tween.tween_property(label, "position:y", label.position.y - 10.0, 0.45) \
		.set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_QUAD)
	tween.parallel().tween_property(label, "modulate:a", 0.0, 0.2).set_delay(0.25)
	tween.tween_callback(label.queue_free)


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
