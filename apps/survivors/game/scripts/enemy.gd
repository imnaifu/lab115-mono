class_name Enemy
extends Node2D
## A monster that walks at the player (Game picks the way: straight, or around buildings).
## Game drives tick() rather than each enemy running its own _process, so crowd separation can
## use the grid Game rebuilt this frame.
##
## Bosses (.45, the user's design; BossKits) have a fixed loop: walk at the player for
## BossKits.WALK_SECONDS (counted while on screen), then one attack, then walk again; the last
## boss of a map has two attacks and takes them in turn. Nothing is random. Each attack is one of
## three kinds (MeleeAttack, PlacedAttack, RangedAttack); its red shapes are drawn on the boss's
## telegraph canvas, above the crowd. At BossKits.PHASE_TWO_AT the last boss stands for a moment,
## can't be hurt, says its line, and from then on its attacks reach further (BossAttack.boost).
## A boss says its lines in a bubble over its head: arriving, attacking, at its second phase.
## (Until .44 bosses drew moves and affixes at random each run; the user wanted them simple.)

const FLASH_SECONDS := 0.08
## Modulate above 1 pushes the sprite toward white for the hit flash.
const FLASH_COLOR := Color(6, 6, 6)
## How far a hop squashes and stretches the sprite, as a fraction of its size.
const SQUASH := 0.08
## A hit presses the sprite in along the blow (by up to HIT_SQUASH of its size), and it springs
## back a little past its shape before settling; harder pushes squash more, bosses less.
const HIT_SQUASH := 0.25
const HIT_SQUASH_SECONDS := 0.16
## A push this hard counts as a full-strength blow for the squash.
const HIT_SQUASH_FULL_PUSH := 140.0
## Knocked off a lane by a car or a train: once round in this long.
const SPIN_SECONDS := 0.45
## Bosses catch up faster than the crowd walks (.35, the user's call: they hung back behind it, so
## the weapons only ever hit the small fry). A boss's own speed (22-40) maps onto
## BOSS_SPEED_FLOOR and up, BOSS_SPEED_SPREAD of each point over SLOWEST_BOSS_SPEED, so the slow
## ones are still the slower bosses: 46-50.5, against the crowd's 25-48 (26-50 until .65). From .39 that is only its
## catch-up speed: within CATCH_UP_NEAR of the player it walks at its own speed again (what .35
## had everywhere cost the test bot about a minute of each run, as a boss on its heels could hardly
## be shaken off), blending into the catch-up speed by CATCH_UP_FAR. It walks no faster than
## BOSS_MAX_SPEED, under the slowest job's 60.
const BOSS_SPEED_FLOOR := 46.0
const SLOWEST_BOSS_SPEED := 22.0
const BOSS_SPEED_SPREAD := 0.25
const BOSS_MAX_SPEED := 54.0
## See hit_radius.
const BIG_ART := 40.0
const HIT_SHARE := 0.36
const CATCH_UP_NEAR := 130.0
const CATCH_UP_FAR := 170.0
## Bosses shake off a stun (the stand-up perk) in this fraction of the time.
const BOSS_STUN_SCALE := 0.5
const STUN_TINT := Color(0.72, 0.84, 1.0)
## Above the crowd (0) and under the effects (10): a red shape is never hidden under the crowd.
const TELEGRAPH_Z := 5
const BUBBLE_FONT := 10

var type_name := ""
var max_hp := 10.0
var hp := 10.0
var speed := 40.0
var damage := 5.0
var xp_value := 1
var radius := 6.0
## How far from its centre the player's attacks reach it. The crowd's is its body (`radius`); a
## drawing BIG_ART tall or more (bosses) is much bigger than its body, so its reach is HIT_SHARE of
## the drawing (.39: a paper or a keyboard crossing a boss's top half went through without
## hitting). The body still decides touching the player and the crowd.
var hit_radius := 6.0
var is_elite := false
## Ghosts drift through the crowd instead of being pushed apart by it.
var ghostly := false
var knockback_resist := 0.0
var dead := false
## Colour of the puff left behind on death.
var color := Color.WHITE
var game: Game
## Seconds left of following the flow field around a building, once it started to (Game).
var detour_left := 0.0
## Seconds left standing still, stunned (the stand-up perk).
var stun_left := 0.0
## Seconds left walking at `slow_scale` of its speed (a meeting room, 拉会).
var slow_left := 0.0
var slow_scale := 1.0
## A boss bracing for an attack shudders in place (BossAttack sets it).
var bracing := false
## How high a leaping boss is off the ground (MeleeAttack); up there it touches nobody.
var lift := 0.0
## The last boss past BossKits.PHASE_TWO_AT.
var phase_two := false

var _knockback := Vector2.ZERO
var _hit_squash_left := 0.0
var _hit_squash := 0.0
var _hit_axis := Vector2.DOWN
var _spin_left := 0.0
var _spin_way := 1.0
var _wobble := 0.0
var _phase := 0.0
var _flash_left := 0.0
var _base_modulate := Color.WHITE
var _base_scale := 1.0
var _size := 24.0
var _sprite: Sprite2D
var _catch_up_speed := 0.0

## A boss's attacks (BossKits), the one under way, whose turn is next, and the walking left
## before it; how many times each has been used (for its lines).
var _attacks: Array[BossAttack] = []
var _attack: BossAttack = null
var _next_attack := 0
var _walk_left := 0.0
var _uses: Array[int] = []
## Where its red shapes are drawn (TELEGRAPH_Z), made once it is in the game.
var _canvas: Node2D
## Standing still and untouchable before its second phase.
var _guard_left := 0.0
var _arrived := false
## The bubble over its head and how long it stays.
var _line := ""
var _line_left := 0.0


func setup(type_id: String, data: Dictionary, hp_scale: float) -> void:
	type_name = type_id
	max_hp = data["hp"] * hp_scale
	hp = max_hp
	var own_speed: float = data["speed"]
	is_elite = data.get("elite", false)
	if is_elite:
		# No jitter for a boss: nothing about one is random.
		speed = own_speed
		_catch_up_speed = BOSS_SPEED_FLOOR + (own_speed - SLOWEST_BOSS_SPEED) * BOSS_SPEED_SPREAD
	else:
		# Small per-enemy speed jitter keeps a crowd from marching in lockstep.
		speed = own_speed * randf_range(0.9, 1.1)
	# Harder maps hit harder (Maps.current.DIFFICULTY), its attacks too (_hits).
	damage = data["damage"] * Maps.current.DIFFICULTY["damage"]
	xp_value = data["xp"]
	radius = data["radius"]
	color = data["color"]
	ghostly = data.get("ghostly", false)
	knockback_resist = data.get("knockback_resist", 0.0)
	_wobble = data.get("wobble", 0.0)
	_phase = randf() * TAU
	if ghostly:
		_base_modulate = Color(1, 1, 1, 0.8)
	if BossKits.has(type_id):
		_attacks = BossKits.create_attacks(type_id, self)
		_uses.resize(_attacks.size())
		_uses.fill(0)
		_walk_left = BossKits.WALK_SECONDS

	_size = data["size"]
	hit_radius = maxf(radius, _size * HIT_SHARE) if _size >= BIG_ART else radius
	_sprite = Art.sprite(data["art"], _size)
	_base_scale = _sprite.scale.x
	_sprite.modulate = _base_modulate
	add_child(_sprite)


## A boss's walking speed this frame: its own close to the player, at least its catch-up speed
## far away, never over BOSS_MAX_SPEED.
func _boss_walk_speed() -> float:
	var far := 0.0
	if game != null:
		far = smoothstep(CATCH_UP_NEAR, CATCH_UP_FAR, position.distance_to(game.player.position))
	return minf(lerpf(speed, maxf(speed, _catch_up_speed), far), BOSS_MAX_SPEED)


## `direction` is the unit vector to walk along this frame (Game._heading).
func tick(delta: float, direction: Vector2, separation: Vector2) -> void:
	var velocity := direction * (_boss_walk_speed() if is_elite else speed)
	if _wobble > 0.0:
		velocity += direction.orthogonal() * sin(_phase * 0.7) * _wobble
	if slow_left > 0.0:
		slow_left -= delta
		velocity *= slow_scale
	if not _attacks.is_empty():
		_tick_kit(delta)
	if stun_left > 0.0:
		# Stunned: no walking and no attack (its timers wait too; shapes already down still go
		# off); knockback still applies.
		stun_left -= delta
		velocity = Vector2.ZERO
		if stun_left <= 0.0 and _flash_left <= 0.0:
			_sprite.modulate = _base_modulate
	elif not _attacks.is_empty():
		velocity = _use_attacks(delta, velocity)
	position += (velocity + _knockback) * delta + separation * 0.3
	_knockback = _knockback.lerp(Vector2.ZERO, minf(1.0, 10.0 * delta))

	_phase += delta * 10.0
	var body_scale := Vector2.ONE * _base_scale
	if ghostly:
		_sprite.position.y = sin(_phase * 0.3) * 2.0
	elif bracing or _guard_left > 0.0:
		# Shudders in place while bracing for an attack.
		_sprite.position = Vector2(sin(_phase * 6.0) * 1.5, 0.0)
	else:
		# Hop: up while stretched, landing squashed. Bigger enemies hop slower and lower.
		var hop := absf(sin(_phase * 16.0 / _size * 1.5))
		_sprite.position = Vector2(0.0, -hop * 2.0)
		var squash := (hop - 0.5) * 2.0 * SQUASH
		body_scale = Vector2(_base_scale * (1.0 - squash), _base_scale * (1.0 + squash))
	_sprite.position.y -= lift
	_sprite.scale = body_scale * _hit_shape(delta)
	_sprite.rotation = _spin_angle(delta)
	if absf(direction.x) > 0.2:
		_sprite.flip_h = direction.x < 0.0

	if _flash_left > 0.0:
		_flash_left -= delta
		if _flash_left <= 0.0:
			_sprite.modulate = _rest_modulate()


## Every frame for a boss, stunned or not: its shapes on the ground, its lines, its second phase.
func _tick_kit(delta: float) -> void:
	if _canvas == null:
		_canvas = Node2D.new()
		_canvas.z_index = TELEGRAPH_Z
		_canvas.draw.connect(_draw_telegraphs)
		game.add_child(_canvas)
	for attack in _attacks:
		attack.background(delta)
	_canvas.queue_redraw()
	queue_redraw()
	if _line_left > 0.0:
		_line_left -= delta
	if not _arrived and _on_screen():
		_arrived = true
		say(_lines().get("arrive", ""))
	if not phase_two and _attacks.size() > 1 and game.elapsed >= BossKits.PHASE_TWO_AT:
		_enter_phase_two()


## The velocity to move with this frame: walking until its next attack is due, standing (or
## rushing, or leaping) while one is under way.
func _use_attacks(delta: float, velocity: Vector2) -> Vector2:
	if _guard_left > 0.0:
		_guard_left -= delta
		return Vector2.ZERO
	if _attack != null:
		if _attack.busy():
			return _attack.tick(delta)
		_attack = null
		bracing = false
		lift = 0.0
	# Only while it is on screen, so it never attacks from where the player can't see it.
	if _on_screen():
		_walk_left -= delta
	if _walk_left > 0.0:
		return velocity
	_walk_left = BossKits.WALK_SECONDS
	var turn := _next_attack
	_next_attack = (_next_attack + 1) % _attacks.size()
	_attack = _attacks[turn]
	_attack.start()
	_uses[turn] += 1
	# Its line for this attack the first time, then every ATTACK_LINE_EVERY-th.
	var attack_lines: Array = _lines().get("attack", [])
	if turn < attack_lines.size() and (_uses[turn] - 1) % BossKits.ATTACK_LINE_EVERY == 0:
		say(attack_lines[turn])
	game.boss_move.emit(_attack.form())
	return Vector2.ZERO if _attack.busy() else velocity


## 9:00: it stops what it is doing, can't be hurt for a moment, and its attacks grow.
func _enter_phase_two() -> void:
	phase_two = true
	_guard_left = BossKits.PHASE_TWO_GUARD
	if _attack != null:
		_attack.clear()
		_attack = null
	bracing = false
	lift = 0.0
	var boosts: Array = BossKits.KITS[type_name].get("phase2", [])
	for i in mini(boosts.size(), _attacks.size()):
		_attacks[i].boost(boosts[i])
	say(_lines().get("phase2", ""))
	Effects.ring(game, position, radius * 4.0, Art.BOSS_RED)
	Sound.play("alarm")
	game.announce(tr("%s 进入二阶段！") % tr(Spawner.ENEMY_TYPES[type_name]["name"]))


## Can't be hurt (Game.damage_enemy): bracing for its second phase.
func guarded() -> bool:
	return _guard_left > 0.0


## A line in the bubble over its head.
func say(line: String) -> void:
	if line == "":
		return
	_line = line
	_line_left = BossKits.LINE_SECONDS


func _lines() -> Dictionary:
	return BossKits.KITS[type_name]["lines"] if BossKits.has(type_name) else {}


## What it says having killed the player, for the result screen; "" for the crowd.
func kill_line() -> String:
	return _lines().get("kill", "")


## Gone (Game._kill): whatever it left on the ground goes with it.
func release() -> void:
	for attack in _attacks:
		attack.clear()
	_attack = null
	if is_instance_valid(_canvas):
		_canvas.queue_free()
	_canvas = null


func _exit_tree() -> void:
	if is_instance_valid(_canvas):
		_canvas.queue_free()


func _on_screen() -> bool:
	var offset := (position - game.player.position).abs()
	var half := game.view_half()
	return offset.x <= half.x and offset.y <= half.y


func _draw_telegraphs() -> void:
	for attack in _attacks:
		attack.draw(_canvas)


## Rushing down a lane (a dash), for the result screen's cause of death.
func is_charging() -> bool:
	return _attack is MeleeAttack and (_attack as MeleeAttack).dashing()


## Its name, for the HUD's boss bar.
func display_name() -> String:
	return tr(Spawner.ENEMY_TYPES[type_name]["name"])


## Thrown by something other than a hit: a car or a train, which send it spinning (`spin`)
## unless it's too heavy to move much.
func shove(push: Vector2, spin: bool = false) -> void:
	_knockback += push * (1.0 - knockback_resist)
	if spin and knockback_resist < 0.9:
		_spin_left = SPIN_SECONDS
		_spin_way = -1.0 if push.x < 0.0 else 1.0


## The sprite as drawn this frame, for the death pop to copy.
func body_sprite() -> Sprite2D:
	return _sprite


## Stops it in place for a while, tinted so it reads as frozen. Bosses for `boss_share` of it:
## less by default; the whole time for a 午休 (Game.NAP_SECONDS, the user: 包括 boss).
func stun(seconds: float, boss_share := BOSS_STUN_SCALE) -> void:
	stun_left = maxf(stun_left, seconds * (boss_share if is_elite else 1.0))
	if _flash_left <= 0.0:
		_sprite.modulate = _rest_modulate()


## Walks at `scale` of its speed for a while; bosses shrug off half the slowdown. Kept up by
## whatever slows it calling again while it stays inside.
func slow(scale: float, seconds: float) -> void:
	slow_scale = 1.0 - (1.0 - scale) * (0.5 if is_elite else 1.0)
	slow_left = maxf(slow_left, seconds)


## The hit squash this frame, as a scale on the sprite: pressed in along the blow and bulging
## across it, springing back a little past round, then settling.
func _hit_shape(delta: float) -> Vector2:
	if _hit_squash_left <= 0.0:
		return Vector2.ONE
	_hit_squash_left = maxf(0.0, _hit_squash_left - delta)
	var progress := 1.0 - _hit_squash_left / HIT_SQUASH_SECONDS
	var amount := _hit_squash * cos(progress * PI * 1.5) * (1.0 - progress)
	var along := _hit_axis.abs()
	return Vector2(1.0 - amount * along.x + amount * 0.6 * along.y, 1.0 - amount * along.y + amount * 0.6 * along.x)


## How far round a spin off the road has turned it: fast off the bump, slowing to upright.
func _spin_angle(delta: float) -> float:
	if _spin_left <= 0.0:
		return 0.0
	_spin_left = maxf(0.0, _spin_left - delta)
	var progress := 1.0 - _spin_left / SPIN_SECONDS
	return _spin_way * TAU * (1.0 - pow(1.0 - progress, 2.0))


## An attack's damage on this map (Maps.current.DIFFICULTY).
static func _hits(amount: float) -> float:
	return amount * Maps.current.DIFFICULTY["damage"]


func _rest_modulate() -> Color:
	return _base_modulate * STUN_TINT if stun_left > 0.0 else _base_modulate


func take_hit(amount: float, push: Vector2) -> void:
	hp -= amount
	_knockback += push * (1.0 - knockback_resist)
	_flash_left = FLASH_SECONDS
	_sprite.modulate = FLASH_COLOR
	_hit_squash_left = HIT_SQUASH_SECONDS
	# A pushless hit (lightning, an aura) presses down from above.
	_hit_axis = push.normalized() if push != Vector2.ZERO else Vector2.DOWN
	_hit_squash = HIT_SQUASH * clampf(push.length() / HIT_SQUASH_FULL_PUSH, 0.5, 1.0) * (1.0 - 0.6 * knockback_resist)
	if is_elite:
		queue_redraw()


func _draw() -> void:
	if not is_elite:
		return
	var top := -_size / 2.0 - lift
	var width := _size * 0.7
	var bar := Rect2(-width / 2.0, top - 8.0, width, 5.0)
	draw_rect(bar.grow(1.0), Art.INK)
	draw_rect(bar, Color.WHITE)
	# Deep red from its second phase on.
	draw_rect(Rect2(bar.position, Vector2(width * maxf(0.0, hp) / max_hp, bar.size.y)), Art.BOSS_RED if phase_two else Art.RED)
	if _guard_left > 0.0:
		draw_arc(Vector2(0.0, -lift), radius + 10.0, 0.0, TAU, 32, Color(Art.BOSS_RED, 0.8), 3.0, true)
	if _line_left > 0.0:
		_draw_bubble(tr(_line), Vector2(0.0, top - 14.0), minf(_line_left / 0.3, 1.0))


## A speech bubble with its tail at `tail`, fading by `alpha`.
func _draw_bubble(text: String, tail: Vector2, alpha: float) -> void:
	var font := Art.display_font(800)
	var text_width := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, BUBBLE_FONT).x
	var box := Rect2(tail.x - text_width / 2.0 - 5.0, tail.y - 15.0, text_width + 10.0, 15.0)
	var paper := Color(Art.PAPER, alpha)
	var ink := Color(Art.INK, alpha)
	draw_colored_polygon(PackedVector2Array([tail + Vector2(-4.0, -1.0), tail + Vector2(4.0, -1.0), tail + Vector2(0.0, 4.0)]), ink)
	draw_rect(box.grow(1.0), ink)
	draw_rect(box, paper)
	draw_string(font, Vector2(box.position.x + 5.0, box.end.y - 4.0), text, HORIZONTAL_ALIGNMENT_LEFT, -1, BUBBLE_FONT, ink)
