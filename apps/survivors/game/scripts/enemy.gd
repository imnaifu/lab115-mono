class_name Enemy
extends Node2D
## A monster that walks at the player (Game picks the way: straight, or around buildings).
## Game drives tick() rather than each enemy running its own _process, so crowd separation can
## use the grid Game rebuilt this frame.
##
## Some bosses have a move (Spawner.ENEMY_TYPES "ability"):
## - "charge": every few seconds it stops, shows the lane it is about to rush down, then rushes
##   down it. The wind-up is the player's cue to step aside.
## - "summon": every few seconds it calls a ring of meeting invites around itself.

const FLASH_SECONDS := 0.08
## Modulate above 1 pushes the sprite toward white for the hit flash.
const FLASH_COLOR := Color(6, 6, 6)
## How far a hop squashes and stretches the sprite, as a fraction of its size.
const SQUASH := 0.08
const ABILITIES := ["charge", "summon"]
const CHARGE_EVERY := 3.5
const CHARGE_WINDUP := 0.8
const CHARGE_SECONDS := 0.6
const CHARGE_SPEED := 230.0
const SUMMON_EVERY := 4.5
const SUMMON_TYPE := "meeting"
const SUMMON_COUNT := 8
const SUMMON_RADIUS := 34.0

var type_name := ""
var max_hp := 10.0
var hp := 10.0
var speed := 40.0
var damage := 5.0
var xp_value := 1
var radius := 6.0
var is_elite := false
## Ghosts drift through the crowd instead of being pushed apart by it.
var ghostly := false
var knockback_resist := 0.0
var dead := false
## Colour of the puff left behind on death.
var color := Color.WHITE
var ability := ""
var game: Game
## Seconds left of following the flow field around a building, once it started to (Game).
var detour_left := 0.0

var _knockback := Vector2.ZERO
var _wobble := 0.0
var _phase := 0.0
var _flash_left := 0.0
var _base_modulate := Color.WHITE
var _base_scale := 1.0
var _size := 24.0
var _sprite: Sprite2D
## Seconds until the next boss move.
var _ability_left := 0.0
var _windup_left := 0.0
var _charge_left := 0.0
var _charge_direction := Vector2.ZERO


func setup(type_id: String, data: Dictionary, hp_scale: float) -> void:
	type_name = type_id
	max_hp = data["hp"] * hp_scale
	hp = max_hp
	# Small per-enemy speed jitter keeps a crowd from marching in lockstep.
	speed = data["speed"] * randf_range(0.9, 1.1)
	damage = data["damage"]
	xp_value = data["xp"]
	radius = data["radius"]
	color = data["color"]
	is_elite = data.get("elite", false)
	ghostly = data.get("ghostly", false)
	knockback_resist = data.get("knockback_resist", 0.0)
	_wobble = data.get("wobble", 0.0)
	ability = data.get("ability", "")
	# Half a cycle in, so a boss shows its move soon after it walks on screen.
	_ability_left = (CHARGE_EVERY if ability == "charge" else SUMMON_EVERY) * 0.5
	_phase = randf() * TAU
	if ghostly:
		_base_modulate = Color(1, 1, 1, 0.8)

	_size = data["size"]
	_sprite = Art.sprite(data["art"], _size)
	_base_scale = _sprite.scale.x
	_sprite.modulate = _base_modulate
	add_child(_sprite)


## `direction` is the unit vector to walk along this frame (Game._heading).
func tick(delta: float, direction: Vector2, separation: Vector2) -> void:
	var velocity := direction * speed
	if _wobble > 0.0:
		velocity += direction.orthogonal() * sin(_phase * 0.7) * _wobble
	if ability != "":
		velocity = _use_ability(delta, direction, velocity)
	position += (velocity + _knockback) * delta + separation * 0.3
	_knockback = _knockback.lerp(Vector2.ZERO, minf(1.0, 10.0 * delta))

	_phase += delta * 10.0
	if ghostly:
		_sprite.position.y = sin(_phase * 0.3) * 2.0
	elif _windup_left > 0.0:
		# Shudders in place while winding up a charge.
		_sprite.position = Vector2(sin(_phase * 6.0) * 1.5, 0.0)
	else:
		# Hop: up while stretched, landing squashed. Bigger enemies hop slower and lower.
		var hop := absf(sin(_phase * 16.0 / _size * 1.5))
		_sprite.position = Vector2(0.0, -hop * 2.0)
		var squash := (hop - 0.5) * 2.0 * SQUASH
		_sprite.scale = Vector2(_base_scale * (1.0 - squash), _base_scale * (1.0 + squash))
	if absf(direction.x) > 0.2:
		_sprite.flip_h = direction.x < 0.0

	if _flash_left > 0.0:
		_flash_left -= delta
		if _flash_left <= 0.0:
			_sprite.modulate = _base_modulate


## The velocity to move with this frame once the boss move in progress has had its say: a
## charge winding up stands still, a charge under way rushes along its locked lane.
func _use_ability(delta: float, direction: Vector2, velocity: Vector2) -> Vector2:
	if _charge_left > 0.0:
		_charge_left -= delta
		return _charge_direction * CHARGE_SPEED
	if _windup_left > 0.0:
		_windup_left -= delta
		if _windup_left <= 0.0:
			_charge_left = CHARGE_SECONDS
			queue_redraw()
		return Vector2.ZERO
	_ability_left -= delta
	if _ability_left > 0.0:
		return velocity
	match ability:
		"charge":
			_ability_left = CHARGE_EVERY
			_windup_left = CHARGE_WINDUP
			_charge_direction = direction
			queue_redraw()
			return Vector2.ZERO
		"summon":
			_ability_left = SUMMON_EVERY
			game.summon_around(self, SUMMON_TYPE, SUMMON_COUNT, SUMMON_RADIUS)
	return velocity


func take_hit(amount: float, push: Vector2) -> void:
	hp -= amount
	_knockback += push * (1.0 - knockback_resist)
	_flash_left = FLASH_SECONDS
	_sprite.modulate = FLASH_COLOR
	if is_elite:
		queue_redraw()


func _draw() -> void:
	if not is_elite:
		return
	if _windup_left > 0.0:
		# The lane the charge will cover, so the player sees where not to stand.
		draw_set_transform(Vector2.ZERO, _charge_direction.angle())
		var lane := Rect2(0.0, -radius - 4.0, CHARGE_SPEED * CHARGE_SECONDS + radius, (radius + 4.0) * 2.0)
		draw_rect(lane, Color(Art.RED, 0.18))
		draw_rect(lane, Color(Art.RED, 0.6), false, 1.5)
		draw_set_transform(Vector2.ZERO)
	var width := _size * 0.7
	var bar := Rect2(-width / 2.0, -_size / 2.0 - 8.0, width, 5.0)
	draw_rect(bar.grow(1.0), Art.INK)
	draw_rect(bar, Color.WHITE)
	draw_rect(Rect2(bar.position, Vector2(width * maxf(0.0, hp) / max_hp, bar.size.y)), Art.RED)
