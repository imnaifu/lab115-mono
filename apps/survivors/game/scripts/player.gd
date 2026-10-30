class_name Player
extends Node2D
## The one you play, as one of the Jobs. Reads movement input, carries the weapons and the stats
## that passives modify, and takes contact damage from enemies (Game decides who is touching).

signal died

const HURT_RADIUS := 6.0
## How wide the player is to buildings and trees.
const BODY_RADIUS := 7.0
const INVULN_SECONDS := 0.5
const HIT_FLASH_SECONDS := 0.12
const SHAKE_SECONDS := 0.15
const SIZE := 30.0
const SQUASH := 0.06
## Starting pickup range, kept so cards can show what passives have added (the starting speed
## depends on the job: base_move_speed).
const BASE_PICKUP_RADIUS := 40.0
## The health bar under the player, tall enough to hold the HP number inside it.
const HP_BAR_SIZE := Vector2(38.0, 11.0)
const HP_FONT_SIZE := 8
## How tall the digits stand, as a share of the font size (Nunito's are 705-713 units of 1000):
## the HP is centred on that. Centred on the font's ascent and descent instead, it sat half a
## pixel low, touching the bar's bottom edge.
const DIGIT_HEIGHT := 0.71
## Flashes per second of the health bar at the low-health line and at almost nothing left.
const LOW_HP_FLASH_SLOW := 3.0
const LOW_HP_FLASH_FAST := 6.0
## After traffic shoves the player (Traffic), this long before it can again, so two cars in a row
## don't bat them about; and how fast the push dies away.
const SHOVE_COOLDOWN := 1.0
const SHOVE_DECAY := 8.0
## Taking a hit: the sprite is pressed flat for HURT_SQUASH_SECONDS and the screen's edges flash
## red for HURT_GLOW_SECONDS (Hud).
const HURT_SQUASH := 0.3
const HURT_SQUASH_SECONDS := 0.18
const HURT_GLOW_SECONDS := 0.3
## Shoved by traffic: leans over (up to TILT radians) and back upright.
const TILT := 0.5
const TILT_SECONDS := 0.4
## The ring filling over the player's head while checking in at a landmark (Stamps).
const CHECK_IN_RING_RADIUS := 9.0

var game: Game
var job := Jobs.DEFAULT
var max_hp := 100.0
var hp := 100.0
var base_move_speed := 62.0
var move_speed := 62.0
var pickup_radius := BASE_PICKUP_RADIUS
var armor := 0.0
var regen := 0.0
var might := 1.0
var cooldown_scale := 1.0
## 运气: makes rarer level-up cards and better year-end bonuses likelier (Upgrades.luck_factor).
## From the 锦鲤 passive and some landmarks' stamps.
var luck := 0.0
var velocity := Vector2.ZERO
var facing := Vector2.RIGHT
## Set by the smoke-test bot to steer without a keyboard; null means read real input.
var input_override: Variant = null
## The on-screen joystick's direction, set by the HUD while a finger (or mouse) drags.
var touch_direction := Vector2.ZERO
var weapons: Array[Weapon] = []

var _invuln_left := 0.0
var _shake_left := 0.0
var _walk_phase := 0.0
var _base_scale := 1.0
var _sprite: Sprite2D
var _camera: Camera2D
var _bar_track: StyleBoxFlat
var _bar_fill: StyleBoxFlat
var _bar_outline: StyleBoxFlat
## Standing still with the nap perk (Perks): healing, shown as a "Zz" over the head.
var _napping := false
## Seconds spent under the low-health line, for the health bar's flashing.
var _low_hp_clock := 0.0
## A push from traffic, added to the walk and dying away; no damage comes with it.
var _shove := Vector2.ZERO
## Carried along this frame by something outside the player (a boss's pull, the sandstorm's wind),
## pixels per second; used up by the next move.
var _drift := Vector2.ZERO
var _shove_cooldown := 0.0
var _hurt_left := 0.0
var _tilt_left := 0.0
var _tilt_way := 1.0
## How full the check-in ring was when last drawn, to redraw only while it changes.
var _check_in_drawn := 0.0
var _shake_strength := 2.0


func _ready() -> void:
	_sprite = Art.sprite(Jobs.data(job)["art"], SIZE)
	_base_scale = _sprite.scale.x
	add_child(_sprite)
	_camera = Camera2D.new()
	add_child(_camera)
	_camera.make_current()


## Takes on a job's build (health, armor, speed and look). Weapons are Game's to hand out.
func setup_job(job_id: String) -> void:
	job = job_id
	var job_data := Jobs.data(job_id)
	max_hp = job_data["hp"]
	hp = max_hp
	armor = job_data["armor"]
	base_move_speed = job_data["speed"]
	move_speed = base_move_speed
	if _sprite != null:
		_sprite.texture = Art.texture(job_data["art"])
		_base_scale = Art.scale_for(job_data["art"], SIZE)
		_sprite.scale = Vector2.ONE * _base_scale
	queue_redraw()


func _process(delta: float) -> void:
	var direction: Vector2
	if input_override != null:
		direction = input_override
	else:
		var keys := Input.get_vector("move_left", "move_right", "move_up", "move_down")
		direction = (keys + touch_direction + Tilt.direction()).limit_length(1.0)
	velocity = direction * move_speed
	position = game.city.resolve(position + (velocity + _shove + _drift) * delta, BODY_RADIUS)
	_drift = Vector2.ZERO
	_shove = _shove.lerp(Vector2.ZERO, minf(1.0, SHOVE_DECAY * delta))
	_shove_cooldown = maxf(0.0, _shove_cooldown - delta)

	if direction.length_squared() > 0.01:
		facing = direction.normalized()
		if absf(direction.x) > 0.01:
			_sprite.flip_h = direction.x < 0.0
		_walk_phase += delta * 14.0
		var hop := absf(sin(_walk_phase))
		_sprite.position.y = -hop * 2.0
		var squash := (hop - 0.5) * 2.0 * SQUASH
		_sprite.scale = Vector2(_base_scale * (1.0 - squash), _base_scale * (1.0 + squash))
	else:
		_sprite.position.y = 0.0
		_sprite.scale = Vector2.ONE * _base_scale
	_sprite.scale *= _hurt_shape(delta)
	_sprite.rotation = _tilt_angle(delta)

	if regen > 0.0 and hp < max_hp:
		heal(regen * delta)

	_invuln_left = maxf(0.0, _invuln_left - delta)
	var blinking := _invuln_left > 0.0 and fmod(_invuln_left, 0.1) < 0.05
	_sprite.modulate = Color(1, 0.45, 0.45) if _invuln_left > INVULN_SECONDS - HIT_FLASH_SECONDS \
		else Color(1, 1, 1, 0.5 if blinking else 1.0)

	if _shake_left > 0.0:
		_shake_left -= delta
		var reach := _shake_strength
		_camera.offset = Vector2(randf_range(-reach, reach), randf_range(-reach, reach)) if _shake_left > 0.0 else Vector2.ZERO

	# The bar flashes while health is low, so it has to be redrawn every frame then.
	if hp > 0.0 and hp / max_hp < Hud.LOW_HP_RATIO:
		_low_hp_clock += delta
		queue_redraw()
	if game.stamps.progress() != _check_in_drawn:
		queue_redraw()


## The health bar's fill: green when full, yellow at half, red at the low-health line (the one
## the screen's red edges and the heartbeat start at), and under it flashing against the white
## track, faster the lower it gets.
func _hp_fill_color(ratio: float) -> Color:
	if ratio >= 0.5:
		return Art.YELLOW.lerp(Art.GREEN, (ratio - 0.5) / 0.5)
	if ratio >= Hud.LOW_HP_RATIO:
		return Art.HP_RED.lerp(Art.YELLOW, (ratio - Hud.LOW_HP_RATIO) / (0.5 - Hud.LOW_HP_RATIO))
	var flashes_per_second := lerpf(LOW_HP_FLASH_FAST, LOW_HP_FLASH_SLOW, ratio / Hud.LOW_HP_RATIO)
	return Art.HP_RED if fmod(_low_hp_clock * flashes_per_second, 1.0) < 0.6 else Art.PAPER


func _draw() -> void:
	# A pill like the HUD's: white track, a fill coloured by how much health is left, an ink
	# outline over both, and the HP as it is now inside it (just the current value: the bar
	# already shows how full it is). Ink reads on the green, yellow, red and white alike, so the
	# digits need no outline.
	var bar := Rect2(-HP_BAR_SIZE.x / 2.0, SIZE / 2.0 + 2.0, HP_BAR_SIZE.x, HP_BAR_SIZE.y)
	if _bar_track == null:
		_bar_track = _pill_style(Art.PAPER, 0)
		_bar_fill = _pill_style(Art.HP_RED, 0)
		_bar_outline = _pill_style(Color.TRANSPARENT, 2)
		_bar_outline.draw_center = false
	draw_style_box(_bar_track, bar)
	var ratio := clampf(hp / max_hp, 0.0, 1.0)
	var fill_width := bar.size.x * ratio
	_bar_fill.bg_color = _hp_fill_color(ratio)
	if fill_width > 0.0:
		# Never thinner than it is tall, so the rounded ends stay round as it runs out.
		draw_style_box(_bar_fill, Rect2(bar.position, Vector2(maxf(fill_width, bar.size.y), bar.size.y)))
	draw_style_box(_bar_outline, bar)
	var text := str(ceili(hp))
	var font := Art.display_font(900)
	var width := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, HP_FONT_SIZE).x
	var baseline := Vector2(-width / 2.0, bar.get_center().y + HP_FONT_SIZE * DIGIT_HEIGHT / 2.0)
	draw_string(font, baseline, text, HORIZONTAL_ALIGNMENT_LEFT, -1, HP_FONT_SIZE, Art.INK)
	# Checking in at a landmark: a ring over the head filling up, a red stamp's colour.
	_check_in_drawn = game.stamps.progress()
	if _check_in_drawn > 0.0:
		var ring_at := Vector2(0.0, -SIZE * 0.5 - CHECK_IN_RING_RADIUS - 4.0)
		draw_circle(ring_at, CHECK_IN_RING_RADIUS + 2.0, Art.PAPER)
		draw_arc(ring_at, CHECK_IN_RING_RADIUS, -PI / 2.0, -PI / 2.0 + TAU * _check_in_drawn, 32, Art.HP_RED, 3.0, true)
		draw_arc(ring_at, CHECK_IN_RING_RADIUS + 2.0, 0.0, TAU, 32, Art.INK, 1.5, true)
	if _napping:
		draw_string_outline(font, Vector2(SIZE * 0.2, -SIZE * 0.45), "Zz", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, 4, Art.PAPER)
		draw_string(font, Vector2(SIZE * 0.2, -SIZE * 0.45), "Zz", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Art.BLUE)


static func _pill_style(color: Color, border: int) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = color
	style.border_color = Art.INK
	style.set_border_width_all(border)
	style.set_corner_radius_all(99)
	style.anti_aliasing = true
	return style


## Turns the camera a quarter turn while the game is drawn sideways on an upright phone
## (Game.apply_orientation), matching the HUD.
func set_screen_turned(turned: bool) -> void:
	_camera.ignore_rotation = not turned
	_camera.rotation = -PI / 2.0 if turned else 0.0


func add_weapon(weapon: Weapon) -> void:
	weapon.game = game
	weapon.player = self
	weapons.append(weapon)
	add_child(weapon)


func get_weapon(weapon_id: String) -> Weapon:
	for weapon in weapons:
		if weapon.id == weapon_id:
			return weapon
	return null


func take_damage(amount: float) -> void:
	if _invuln_left > 0.0 or hp <= 0.0:
		return
	var lost := minf(hp, maxf(1.0, amount - armor))
	hp -= lost
	_invuln_left = INVULN_SECONDS
	_hurt_left = HURT_GLOW_SECONDS
	Sound.play("hurt")
	shake(SHAKE_SECONDS, 2.0)
	queue_redraw()
	game.perks.on_hurt(lost)
	if hp <= 0.0:
		died.emit()


## Carried along at `carried` (pixels per second) for this frame, on top of walking: a boss's pull,
## the sandstorm's wind. Several add up.
func drift(carried: Vector2) -> void:
	_drift += carried


## Knocked aside by a car or a train: pushed, never hurt. Whether it took (not within
## SHOVE_COOLDOWN of the last one).
func shove(push: Vector2) -> bool:
	if _shove_cooldown > 0.0:
		return false
	_shove_cooldown = SHOVE_COOLDOWN
	_shove += push
	shake(0.12, 2.0)
	_tilt_left = TILT_SECONDS
	_tilt_way = -1.0 if push.x < 0.0 else 1.0
	return true


## How strongly the screen's edges flash red for a hit just taken: 1 right after it, down to 0.
func hurt_glow() -> float:
	return clampf(_hurt_left / HURT_GLOW_SECONDS, 0.0, 1.0)


## The hurt squash this frame, as a scale on the sprite: flattened, springing back a little
## past its shape, settling. Counts down the red edges' time too.
func _hurt_shape(delta: float) -> Vector2:
	if _hurt_left <= 0.0:
		return Vector2.ONE
	_hurt_left = maxf(0.0, _hurt_left - delta)
	var progress := (HURT_GLOW_SECONDS - _hurt_left) / HURT_SQUASH_SECONDS
	if progress >= 1.0:
		return Vector2.ONE
	var amount := HURT_SQUASH * cos(progress * PI * 1.5) * (1.0 - progress)
	return Vector2(1.0 + amount, 1.0 - amount)


## How far over a shove has tipped the player: out and back upright.
func _tilt_angle(delta: float) -> float:
	if _tilt_left <= 0.0:
		return 0.0
	_tilt_left = maxf(0.0, _tilt_left - delta)
	return _tilt_way * TILT * sin(PI * (1.0 - _tilt_left / TILT_SECONDS))


## Shakes the camera for a moment (`strength` pixels each way).
func shake(seconds: float, strength: float) -> void:
	if seconds >= _shake_left:
		_shake_strength = strength
	_shake_left = maxf(_shake_left, seconds)


func set_napping(value: bool) -> void:
	if value != _napping:
		_napping = value
		queue_redraw()


func heal(amount: float) -> void:
	hp = minf(max_hp, hp + amount)
	queue_redraw()
