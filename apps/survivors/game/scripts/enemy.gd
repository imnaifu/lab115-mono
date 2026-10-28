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
## - "quake": stops while a red circle fills in under it, then goes off: hurts and shoves the
##   player if inside, and shoves the crowd inside away too, so stepping out of it pays.
## - "countdown": a countdown over its head; it speeds up as it runs down, and still alive at
##   zero it goes berserk. Killed in time, its funding bag is at least a Series A (Game).
## - "clones": flickers, then a see-through copy of it appears near the player; copies break at
##   any hit, hit half as hard, give nothing, and fade (or go with the original).
## - "aura": a gold ring round it in which ordinary enemies take half damage (Game); killed, it
##   spills extra stars.
## Every wind-up is drawn (lane, landing circle, bracing ring, filling circle, flicker) so a move
## can always be dodged; the HUD says how the first time each comes up in a run.

const FLASH_SECONDS := 0.08
## Modulate above 1 pushes the sprite toward white for the hit flash.
const FLASH_COLOR := Color(6, 6, 6)
## How far a hop squashes and stretches the sprite, as a fraction of its size.
const SQUASH := 0.08
const ABILITIES := ["charge", "summon", "blink", "volley", "lob", "quake", "countdown", "clones", "aura"]
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
## The quake's numbers are mild on purpose: it is the first boss move a new player meets (2:00).
const QUAKE_EVERY := 6.0
const QUAKE_WINDUP := 1.2
const QUAKE_RADIUS := 70.0
const QUAKE_DAMAGE := 8.0
## How far the quake shoves the player, and how hard it throws the crowd inside outward.
const QUAKE_SHOVE := 40.0
const QUAKE_CROWD_PUSH := 220.0
const COUNTDOWN_SECONDS := 25.0
## Speed at the end of the countdown, then berserk speed and damage, as multiples of its own.
## Berserk it is still slower than the player (62), so kiting gets away.
const COUNTDOWN_SPEEDUP := 1.25
const BERSERK_SPEED := 1.4
const BERSERK_DAMAGE := 1.5
const COUNTDOWN_URGENT := 5.0
const CLONES_EVERY := 7.0
const CLONES_WINDUP := 0.8
const MAX_CLONES := 2
const CLONE_SECONDS := 8.0
const AURA_RADIUS := 90.0
## Damage taken by an ordinary enemy inside an aura, as a fraction.
const AURA_SHIELD := 0.5
const AURA_TINT := Color(1.0, 0.9, 0.5)
const PHANTOM_ALPHA := 0.55
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
## A Deadline whose countdown ran out.
var berserk := false
## Inside an investor's aura this frame (Game sets it): takes less damage, tinted gold.
var shielded := false
## On an AI's clone: the AI it came from. Clones also have `life_left` ticking down to 0, at
## which Game removes them; -1 for everything else.
var clone_of: Enemy = null
var life_left := -1.0

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
var _countdown_left := 0.0
var _base_speed := 0.0
var _base_damage := 0.0
## Whether this boss's always-on move (countdown, aura) has been reported to the HUD yet.
var _announced := false


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
	_countdown_left = COUNTDOWN_SECONDS
	_phase = randf() * TAU
	if ghostly:
		_base_modulate = Color(1, 1, 1, 0.8)
	if data.get("phantom", false):
		_base_modulate = Color(1, 1, 1, PHANTOM_ALPHA)
		life_left = CLONE_SECONDS

	_base_speed = speed
	_base_damage = damage
	_size = data["size"]
	_sprite = Art.sprite(data["art"], _size)
	_base_scale = _sprite.scale.x
	_sprite.modulate = _base_modulate
	add_child(_sprite)


## `direction` is the unit vector to walk along this frame (Game._heading).
func tick(delta: float, direction: Vector2, separation: Vector2) -> void:
	if life_left > 0.0:
		life_left = maxf(0.0, life_left - delta)
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
	# The always-on moves, which have no wind-up.
	match ability:
		"countdown":
			_tick_countdown(delta)
			return velocity
		"aura":
			_announce()
			queue_redraw()
			return velocity
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
	game.boss_move.emit(ability)
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
		"quake":
			_windup_left = QUAKE_WINDUP
			return Vector2.ZERO
		"clones":
			# Only so many at once; the turn is skipped rather than saved up.
			if game.clones_of(self) < MAX_CLONES:
				_windup_left = CLONES_WINDUP
				return Vector2.ZERO
	return velocity


## Tells the HUD about an always-on move once, when the boss first acts.
func _announce() -> void:
	if not _announced:
		_announced = true
		game.boss_move.emit(ability)


func _tick_countdown(delta: float) -> void:
	_announce()
	queue_redraw()
	if berserk:
		return
	_countdown_left -= delta
	speed = _base_speed * lerpf(1.0, COUNTDOWN_SPEEDUP, clampf(1.0 - _countdown_left / COUNTDOWN_SECONDS, 0.0, 1.0))
	if _countdown_left <= 0.0:
		berserk = true
		speed = _base_speed * BERSERK_SPEED
		damage = _base_damage * BERSERK_DAMAGE
		Sound.play("alarm")
		game.announce("Deadline 到了！它暴走了")


## Scales its health, full: a boss coming back later in a run a little weaker (Spawner EVENTS).
func scale_hp(factor: float) -> void:
	max_hp *= factor
	hp = max_hp


## A Deadline killed before its countdown ran out (its bag is at least a Series A).
func met_deadline() -> bool:
	return ability == "countdown" and not berserk


## A clone whose time is up, for Game to take away.
func expired() -> bool:
	return life_left == 0.0


## Thrown by something other than a hit (the quake).
func shove(push: Vector2) -> void:
	_knockback += push * (1.0 - knockback_resist)


## Inside or out of an investor's aura this frame.
func set_shielded(inside: bool) -> void:
	if inside == shielded:
		return
	shielded = inside
	if _flash_left <= 0.0:
		_sprite.modulate = _rest_modulate()


## Rushing down its lane (the "charge" move), for the result screen's cause of death.
func is_charging() -> bool:
	return _charge_left > 0.0


func _ability_every() -> float:
	match ability:
		"charge":
			return CHARGE_EVERY
		"blink":
			return BLINK_EVERY
		"volley":
			return VOLLEY_EVERY
		"lob":
			return LOB_EVERY
		"quake":
			return QUAKE_EVERY
		"clones":
			return CLONES_EVERY
	return SUMMON_EVERY


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
		"quake":
			_quake()
		"clones":
			game.spawn_clone(self)
	queue_redraw()


func _quake() -> void:
	Effects.ring(game, position, QUAKE_RADIUS, Art.BOSS_RED)
	Sound.play("zap")
	var player := game.player
	var offset := player.position - position
	if offset.length() <= QUAKE_RADIUS + Player.HURT_RADIUS:
		game.hurt_player(QUAKE_DAMAGE, type_name, "quake")
		player.position = game.city.resolve(player.position + offset.normalized() * QUAKE_SHOVE, Player.BODY_RADIUS)
	for enemy in game.query_enemies(position, QUAKE_RADIUS):
		if enemy != self and not enemy.is_elite:
			enemy.shove((enemy.position - position).normalized() * QUAKE_CROWD_PUSH)


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
	var tint := _base_modulate * STUN_TINT if stun_left > 0.0 else _base_modulate
	return tint * AURA_TINT if shielded else tint


func take_hit(amount: float, push: Vector2) -> void:
	hp -= amount
	_knockback += push * (1.0 - knockback_resist)
	_flash_left = FLASH_SECONDS
	_sprite.modulate = FLASH_COLOR
	if is_elite:
		queue_redraw()


func _draw() -> void:
	if clone_of != null:
		# A question mark over a clone, so it reads as not quite the real thing.
		_draw_mark("?", Vector2(0.0, -_size / 2.0 - 2.0), 14, Art.LINK)
		return
	if not is_elite:
		return
	match ability:
		"aura":
			# The ring inside which its crowd takes half damage, under everything it covers.
			var glow := 0.08 + 0.04 * sin(_phase * 0.4)
			draw_circle(Vector2.ZERO, AURA_RADIUS, Color(Art.BRAND, glow))
			draw_arc(Vector2.ZERO, AURA_RADIUS, 0.0, TAU, 48, Color(Art.BRAND_DEEP, 0.7), 2.0, true)
		"countdown":
			if berserk:
				var pulse := 0.5 + 0.5 * sin(_phase * 1.2)
				draw_arc(Vector2.ZERO, radius + 8.0 + 3.0 * pulse, 0.0, TAU, 32, Color(Art.BOSS_RED, 0.5 + 0.4 * pulse), 3.0, true)
			var urgent := berserk or _countdown_left <= COUNTDOWN_URGENT
			var text := "!" if berserk else str(ceili(maxf(_countdown_left, 0.0)))
			var size_bump := 2 if urgent and fmod(_phase, 6.0) < 3.0 else 0
			_draw_mark(text, Vector2(0.0, -_size / 2.0 - 12.0), 16 + size_bump, Art.BOSS_RED if urgent else Art.INK)
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
			"quake":
				# The circle it will hit, filling in from the middle: it goes off when full.
				var filled := 1.0 - _windup_left / QUAKE_WINDUP
				draw_circle(Vector2.ZERO, QUAKE_RADIUS, Color(Art.BOSS_RED, 0.12))
				draw_circle(Vector2.ZERO, QUAKE_RADIUS * filled, Color(Art.BOSS_RED, 0.22))
				draw_arc(Vector2.ZERO, QUAKE_RADIUS, 0.0, TAU, 48, Color(Art.BOSS_RED, 0.8), 2.0, true)
			"clones":
				# Flickering rings while it makes up a copy.
				var flicker := fmod(_phase, 2.0) < 1.0
				draw_arc(Vector2.ZERO, radius + 6.0, 0.0, TAU, 32, Color(Art.LINK, 0.8 if flicker else 0.3), 2.0, true)
				draw_arc(Vector2.ZERO, radius + 12.0, 0.0, TAU, 32, Color(Art.LINK, 0.3 if flicker else 0.8), 1.5, true)
	var width := _size * 0.7
	var bar := Rect2(-width / 2.0, -_size / 2.0 - 8.0, width, 5.0)
	draw_rect(bar.grow(1.0), Art.INK)
	draw_rect(bar, Color.WHITE)
	draw_rect(Rect2(bar.position, Vector2(width * maxf(0.0, hp) / max_hp, bar.size.y)), Art.RED)


## A short line of text with a white edge, centred on `at` (the countdown, a clone's mark).
func _draw_mark(text: String, at: Vector2, font_size: int, color: Color) -> void:
	var font := Art.display_font(900)
	var width := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
	var baseline := at + Vector2(-width / 2.0, 0.0)
	draw_string_outline(font, baseline, text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, 5, Art.PAPER)
	draw_string(font, baseline, text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, color)
