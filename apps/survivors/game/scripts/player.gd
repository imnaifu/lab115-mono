class_name Player
extends Node2D
## The programmer. Reads movement input, carries the weapons and the stats that passives
## modify, and takes contact damage from enemies (Game decides who is touching).

signal died

const HURT_RADIUS := 6.0
## How wide the player is to buildings and trees.
const BODY_RADIUS := 7.0
const INVULN_SECONDS := 0.5
const HIT_FLASH_SECONDS := 0.12
const SHAKE_SECONDS := 0.15
const SIZE := 30.0
const SQUASH := 0.06
## Starting values, kept so the pause screen can show what passives have added.
const BASE_MOVE_SPEED := 62.0
const BASE_PICKUP_RADIUS := 40.0
## The health bar under the player, tall enough to hold the HP number inside it.
const HP_BAR_SIZE := Vector2(38.0, 11.0)
const HP_FONT_SIZE := 8

var game: Game
var max_hp := 100.0
var hp := 100.0
var move_speed := BASE_MOVE_SPEED
var pickup_radius := BASE_PICKUP_RADIUS
var armor := 0.0
var regen := 0.0
var might := 1.0
var cooldown_scale := 1.0
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


func _ready() -> void:
	_sprite = Art.sprite("coder", SIZE)
	_base_scale = _sprite.scale.x
	add_child(_sprite)
	_camera = Camera2D.new()
	add_child(_camera)
	_camera.make_current()


func _process(delta: float) -> void:
	var direction: Vector2
	if input_override != null:
		direction = input_override
	else:
		var keys := Input.get_vector("move_left", "move_right", "move_up", "move_down")
		direction = (keys + touch_direction + Tilt.direction()).limit_length(1.0)
	velocity = direction * move_speed
	position = game.city.resolve(position + velocity * delta, BODY_RADIUS)

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

	if regen > 0.0 and hp < max_hp:
		heal(regen * delta)

	_invuln_left = maxf(0.0, _invuln_left - delta)
	var blinking := _invuln_left > 0.0 and fmod(_invuln_left, 0.1) < 0.05
	_sprite.modulate = Color(1, 0.45, 0.45) if _invuln_left > INVULN_SECONDS - HIT_FLASH_SECONDS \
		else Color(1, 1, 1, 0.5 if blinking else 1.0)

	if _shake_left > 0.0:
		_shake_left -= delta
		_camera.offset = Vector2(randf_range(-2, 2), randf_range(-2, 2)) if _shake_left > 0.0 else Vector2.ZERO


func _draw() -> void:
	# A pill like the HUD's: white track, red fill, an ink outline over both, and the HP as it is
	# now inside it (just the current value: the bar already shows how full it is). Ink reads on
	# both the red and the white, so the digits need no outline.
	var bar := Rect2(-HP_BAR_SIZE.x / 2.0, SIZE / 2.0 + 2.0, HP_BAR_SIZE.x, HP_BAR_SIZE.y)
	if _bar_track == null:
		_bar_track = _pill_style(Art.PAPER, 0)
		_bar_fill = _pill_style(Art.HP_RED, 0)
		_bar_outline = _pill_style(Color.TRANSPARENT, 2)
		_bar_outline.draw_center = false
	draw_style_box(_bar_track, bar)
	var fill_width := bar.size.x * clampf(hp / max_hp, 0.0, 1.0)
	if fill_width > 0.0:
		# Never thinner than it is tall, so the rounded ends stay round as it runs out.
		draw_style_box(_bar_fill, Rect2(bar.position, Vector2(maxf(fill_width, bar.size.y), bar.size.y)))
	draw_style_box(_bar_outline, bar)
	var text := str(ceili(hp))
	var font := Art.display_font(900)
	var width := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, HP_FONT_SIZE).x
	var baseline := Vector2(-width / 2.0, bar.get_center().y + (font.get_ascent(HP_FONT_SIZE) - font.get_descent(HP_FONT_SIZE)) / 2.0)
	draw_string(font, baseline, text, HORIZONTAL_ALIGNMENT_LEFT, -1, HP_FONT_SIZE, Art.INK)
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
	Sound.play("hurt")
	_shake_left = SHAKE_SECONDS
	queue_redraw()
	game.perks.on_hurt(lost)
	if hp <= 0.0:
		died.emit()


func set_napping(value: bool) -> void:
	if value != _napping:
		_napping = value
		queue_redraw()


func heal(amount: float) -> void:
	hp = minf(max_hp, hp + amount)
	queue_redraw()
