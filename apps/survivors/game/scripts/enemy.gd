class_name Enemy
extends Node2D
## A monster that walks at the player (Game picks the way: straight, or around buildings).
## Game drives tick() rather than each enemy running its own _process, so crowd separation can
## use the grid Game rebuilt this frame.
##
## Some bosses have a move (Spawner.ENEMY_TYPES "ability"):
## - "charge": every few seconds it stops, shows the lane it is about to rush down, then rushes
##   down it. The wind-up is the player's cue to step aside.
## - "summon": every few seconds it calls a ring of minions around itself (meeting invites unless
##   the type names its own `summon_type` / `summon_count`).
## - "blink": stops, marks a spot just ahead of where the player is walking, then appears there.
## - "volley": stops, braces, then fires a ring of bullets outward.
## - "lob": throws pies at where the player is heading; each shows its landing spot until it lands.
## Every wind-up is drawn (lane, landing circle, bracing ring) so a move can always be dodged.

const FLASH_SECONDS := 0.08
## Modulate above 1 pushes the sprite toward white for the hit flash.
const FLASH_COLOR := Color(6, 6, 6)
## How far a hop squashes and stretches the sprite, as a fraction of its size.
const SQUASH := 0.08
const ABILITIES := ["charge", "summon", "blink", "volley", "lob"]
const CHARGE_EVERY := 3.5
const CHARGE_WINDUP := 0.8
const CHARGE_SECONDS := 0.6
const CHARGE_SPEED := 230.0
const SUMMON_EVERY := 4.5
const SUMMON_TYPE := "meeting"
const SUMMON_COUNT := 8
const SUMMON_RADIUS := 34.0
const BLINK_EVERY := 4.0
const BLINK_WINDUP := 0.75
## Where it lands: this far along the player's walk (seconds of their velocity), give or take.
const BLINK_LEAD_SECONDS := 0.5
const BLINK_SCATTER := 24.0
const VOLLEY_EVERY := 3.2
const VOLLEY_WINDUP := 0.6
const VOLLEY_SHOTS := 12
const VOLLEY_SPEED := 85.0
const VOLLEY_DAMAGE := 14.0
const LOB_EVERY := 3.0
const LOB_PIES := 3
const LOB_FLIGHT_SECONDS := 1.1
const LOB_LEAD_SECONDS := 0.6
const LOB_SPREAD := 34.0
const LOB_DAMAGE := 18.0
## Bosses shake off a stun (the stand-up perk) in this fraction of the time.
const BOSS_STUN_SCALE := 0.5
const STUN_TINT := Color(0.72, 0.84, 1.0)

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
## Seconds left standing still, stunned (the stand-up perk).
var stun_left := 0.0

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
var _summon_type := SUMMON_TYPE
var _summon_count := SUMMON_COUNT
var _blink_target := Vector2.ZERO
## Turns each volley half a gap, so standing in a gap only works once.
var _volley_turn := 0.0


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
	_summon_type = data.get("summon_type", SUMMON_TYPE)
	_summon_count = data.get("summon_count", SUMMON_COUNT)
	# Half a cycle in, so a boss shows its move soon after it walks on screen.
	_ability_left = _ability_every() * 0.5
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
	if stun_left > 0.0:
		# Stunned: no walking and no boss move (its timers wait too); knockback still applies.
		stun_left -= delta
		velocity = Vector2.ZERO
		if stun_left <= 0.0 and _flash_left <= 0.0:
			_sprite.modulate = _base_modulate
	elif ability != "":
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
			_sprite.modulate = _rest_modulate()


## The velocity to move with this frame once the boss move in progress has had its say: any
## wind-up stands still, a charge under way rushes along its locked lane.
func _use_ability(delta: float, direction: Vector2, velocity: Vector2) -> Vector2:
	if _charge_left > 0.0:
		_charge_left -= delta
		return _charge_direction * CHARGE_SPEED
	if _windup_left > 0.0:
		_windup_left -= delta
		# Redrawn every frame: the boss can still be shoved while it winds up, and the landing
		# circle is drawn relative to it.
		queue_redraw()
		if _windup_left <= 0.0:
			_finish_windup()
		return Vector2.ZERO
	_ability_left -= delta
	if _ability_left > 0.0:
		return velocity
	_ability_left = _ability_every()
	match ability:
		"charge":
			_windup_left = CHARGE_WINDUP
			_charge_direction = direction
			return Vector2.ZERO
		"summon":
			game.summon_around(self, _summon_type, _summon_count, SUMMON_RADIUS)
		"blink":
			var player := game.player
			var ahead := player.position + player.velocity * BLINK_LEAD_SECONDS
			_blink_target = game.city.resolve(ahead + Vector2.from_angle(randf() * TAU) * randf() * BLINK_SCATTER, radius)
			_windup_left = BLINK_WINDUP
			return Vector2.ZERO
		"volley":
			_windup_left = VOLLEY_WINDUP
			return Vector2.ZERO
		"lob":
			_throw_pies()
	return velocity


## Seconds between boss moves, stretched or shortened by the difficulty.
func _ability_every() -> float:
	var every := SUMMON_EVERY
	match ability:
		"charge":
			every = CHARGE_EVERY
		"blink":
			every = BLINK_EVERY
		"volley":
			every = VOLLEY_EVERY
		"lob":
			every = LOB_EVERY
	return every * Difficulty.value("ability_every")


func _finish_windup() -> void:
	match ability:
		"charge":
			_charge_left = CHARGE_SECONDS
		"blink":
			Effects.poof(game, position, color)
			position = _blink_target
			Effects.poof(game, position, color)
		"volley":
			_volley_turn = 0.5 - _volley_turn
			for i in VOLLEY_SHOTS:
				var heading := Vector2.from_angle(TAU * (i + _volley_turn) / VOLLEY_SHOTS)
				game.fire_bullet(position + heading * radius, heading * VOLLEY_SPEED, VOLLEY_DAMAGE, type_name)
			Sound.play("zap")
	queue_redraw()


## One pie at where the player is heading and the rest to either side of it.
func _throw_pies() -> void:
	var player := game.player
	var aim := player.position + player.velocity * LOB_LEAD_SECONDS
	var side := (aim - position).normalized().orthogonal()
	for i in LOB_PIES:
		var offset := side * (i - (LOB_PIES - 1) / 2.0) * LOB_SPREAD
		game.lob_pie(position + Vector2(0, -radius), aim + offset, LOB_FLIGHT_SECONDS, LOB_DAMAGE, type_name)


## Stops it in place for a while (bosses for less), tinted so it reads as frozen.
func stun(seconds: float) -> void:
	stun_left = maxf(stun_left, seconds * (BOSS_STUN_SCALE if is_elite else 1.0))
	if _flash_left <= 0.0:
		_sprite.modulate = _rest_modulate()


func _rest_modulate() -> Color:
	return _base_modulate * STUN_TINT if stun_left > 0.0 else _base_modulate


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
		match ability:
			"charge":
				# The lane the charge will cover, so the player sees where not to stand.
				draw_set_transform(Vector2.ZERO, _charge_direction.angle())
				var lane := Rect2(0.0, -radius - 4.0, CHARGE_SPEED * CHARGE_SECONDS + radius, (radius + 4.0) * 2.0)
				draw_rect(lane, Color(Art.RED, 0.18))
				draw_rect(lane, Color(Art.RED, 0.6), false, 1.5)
				draw_set_transform(Vector2.ZERO)
			"blink":
				# Where it will appear, filling in as the moment comes.
				var landing := _blink_target - position
				var progress := 1.0 - _windup_left / BLINK_WINDUP
				draw_circle(landing, radius + 6.0, Color(Art.RED, 0.15))
				draw_circle(landing, (radius + 6.0) * progress, Color(Art.RED, 0.2))
				draw_arc(landing, radius + 6.0, 0.0, TAU, 32, Color(Art.RED, 0.7), 1.5, true)
			"volley":
				# A ring tightening onto the boss: the volley goes off when it closes.
				var closing := _windup_left / VOLLEY_WINDUP
				draw_arc(Vector2.ZERO, radius + 4.0 + 16.0 * closing, 0.0, TAU, 32, Color(Art.RED, 0.8 - 0.4 * closing), 2.0, true)
	var width := _size * 0.7
	var bar := Rect2(-width / 2.0, -_size / 2.0 - 8.0, width, 5.0)
	draw_rect(bar.grow(1.0), Art.INK)
	draw_rect(bar, Color.WHITE)
	draw_rect(Rect2(bar.position, Vector2(width * maxf(0.0, hp) / max_hp, bar.size.y)), Art.RED)
