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
##   zero it goes berserk. Killed in time, its year-end bonus is at least a 绩效 A (Game).
## - "clones": flickers, then a see-through copy of it appears near the player; copies break at
##   any hit, hit half as hard, give nothing, and fade (or go with the original).
## - "aura": a gold ring round it in which ordinary enemies take half damage (Game); killed, it
##   spills extra stars.
## - "pull" (硅谷's RTO 返岗令, .26): stops, rings itself with arrows pointing in, then for a while
##   drags the player and the crowd round it towards itself; walking away still gets away.
## - "squeeze" (北京's 末位淘汰, .26): rings the spot the player stands on and closes the ring over a
##   couple of seconds; still inside when it closes, the player is hit.
## - "hoard" (西雅图's 节俭, .34): always on, a gold ring round it; stars lying inside drift into it
##   and it keeps them (the count over its head, Game moves them); killed, it spills them all.
## - "sweep" (伦敦's 监控探头, .37): stops and shows where its camera beam starts and which way it
##   will turn, then swings the beam (a cone) past the player; staying in the beam for a moment
##   gets the player snapped (hit once per sweep). Stepping out across it, or out of its reach,
##   is safe.
## - "redlight" (新加坡's 罚款执法官, .38): a pedestrian light over the player's head turns amber,
##   then red for a moment; still walking (by their own steering, not pushed) while it's red, the
##   player is fined (hit once). Letting go and standing still is safe.
## Every wind-up is drawn (lane, landing circle, bracing ring, filling circle, flicker) so a move
## can always be dodged; the HUD says how the first time each comes up in a run.
##
## From .21 a boss can have more than one timed move (`moves`: its own, plus extras the Spawner
## draws each run) and picks one at random each time its timer runs out, never the same twice in
## a row when it has a choice; the gap between moves varies by MOVE_JITTER either way. Its own
## always-on move (countdown, aura, hoard) keeps running alongside. It can also carry affixes
## (AFFIXES, drawn by the Spawner): 996, 加厚, 急了, 自愈, 甩锅.

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
const ABILITIES := ["charge", "summon", "blink", "volley", "lob", "quake", "countdown", "clones", "aura", "hoard"]
## The moves that work on a timer; countdown, aura and hoard are always on.
const TIMED_MOVES := ["charge", "summon", "blink", "volley", "lob", "quake", "clones", "pull", "squeeze", "sweep", "redlight"]
## The gap between one boss's moves is its move's own, times a random factor this far either way.
const MOVE_JITTER := 0.25
## Affixes a boss can carry, by id, with what the HUD calls them: 996 (faster, moves more often),
## 加厚 (more health, bigger), 急了 (under half health: red, faster, moves more often), 自愈 (heals
## when left alone a while), 甩锅 (flings small copies of itself as it dies).
const AFFIXES := {"996": "996", "thick": "加厚", "angry": "急了", "heal": "自愈", "blame": "甩锅"}
const HASTY_SPEED := 1.3
const HASTY_GAP := 0.8
const THICK_HP := 1.5
const THICK_SIZE := 1.2
const ANGRY_AT := 0.5
const ANGRY_SPEED := 1.4
const ANGRY_GAP := 0.7
const ANGRY_TINT := Color(1.0, 0.62, 0.62)
const HEAL_AFTER := 3.0
## Of its maximum health, per second.
const HEAL_RATE := 0.03
const BLAME_PIECES := 3
## Each piece's health, as a share of the boss's maximum.
const BLAME_HP := 0.15
const BLAME_SIZE := 0.6
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
const PULL_EVERY := 5.0
const PULL_WINDUP := 0.6
const PULL_SECONDS := 1.5
const PULL_RADIUS := 150.0
## Towards the boss, pixels per second: less than the player walks (56-71), so walking away wins.
const PULL_PLAYER_SPEED := 40.0
const PULL_CROWD_SPEED := 60.0
const SQUEEZE_EVERY := 5.5
const SQUEEZE_SECONDS := 2.0
const SQUEEZE_RADIUS := 64.0
const SQUEEZE_DAMAGE := 20.0
const COUNTDOWN_SECONDS := 25.0
## Speed at the end of the countdown, then berserk speed and damage, as multiples of its own.
## Berserk it is still slower than the player: BOSS_MAX_SPEED caps it, so kiting gets away.
const COUNTDOWN_SPEEDUP := 1.25
const BERSERK_SPEED := 1.4
## Bosses catch up faster than the crowd walks (.35, the user's call: they hung back behind it, so
## the weapons only ever hit the small fry). A boss's own speed (22-40) maps onto
## BOSS_SPEED_FLOOR and up, BOSS_SPEED_SPREAD of each point over SLOWEST_BOSS_SPEED, so the slow
## ones are still the slower bosses: 46-50.5, against the crowd's 26-44. From .39 that is only its
## catch-up speed: within CATCH_UP_NEAR of the player it walks at its own speed again (what .35
## had everywhere cost the test bot about a minute of each run, as a boss on its heels could hardly
## be shaken off), blending into the catch-up speed by CATCH_UP_FAR. However much it speeds up
## (996, 急了, a countdown), it walks no faster than BOSS_MAX_SPEED, under the slowest job's 60.
const BOSS_SPEED_FLOOR := 46.0
const SLOWEST_BOSS_SPEED := 22.0
const BOSS_SPEED_SPREAD := 0.25
const BOSS_MAX_SPEED := 54.0
## See hit_radius.
const BIG_ART := 40.0
const HIT_SHARE := 0.36
const CATCH_UP_NEAR := 130.0
const CATCH_UP_FAR := 170.0
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
## A hoarder's reach and how fast the stars inside it drift in (slower than the player walks, so
## grabbing them first is a race the player can win).
const HOARD_RADIUS := 110.0
const HOARD_PULL := 60.0
## The camera's sweep: it braces for SWEEP_WINDUP showing the beam's first heading, then turns it
## through SWEEP_TURN over SWEEP_SECONDS, centred on where the player stood. The beam is a cone
## SWEEP_WIDTH wide out to SWEEP_RANGE; SWEEP_EXPOSE seconds in it without a break and the player
## is snapped for SWEEP_DAMAGE. The beam crosses a standing player in about 0.41 s (34° at
## 82.5°/s), longer than SWEEP_EXPOSE, so standing still is caught; walking across it against its
## turn gets through in under 0.33 s anywhere in its reach, walking along with it doesn't.
const SWEEP_EVERY := 5.5
const SWEEP_WINDUP := 0.7
const SWEEP_SECONDS := 2.0
const SWEEP_TURN := 165.0 * PI / 180.0
const SWEEP_WIDTH := 34.0 * PI / 180.0
const SWEEP_RANGE := 170.0
const SWEEP_EXPOSE := 0.33
const SWEEP_DAMAGE := 20.0
const SWEEP_BEAM := Color(1.0, 0.93, 0.55)
## The red light: amber for REDLIGHT_WINDUP (time to let go), then red for REDLIGHT_SECONDS; the
## player steering faster than REDLIGHT_MOVE while it's red is fined REDLIGHT_DAMAGE, once.
const REDLIGHT_EVERY := 6.0
const REDLIGHT_WINDUP := 1.0
const REDLIGHT_SECONDS := 1.2
const REDLIGHT_MOVE := 6.0
const REDLIGHT_DAMAGE := 16.0
const AMBER := Color("f0a35e")
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
## How far from its centre the player's attacks reach it. The crowd's is its body (`radius`); a
## drawing BIG_ART tall or more (bosses, their clones and splits) is much bigger than its body, so
## its reach is HIT_SHARE of the drawing (.39: a paper or a keyboard crossing a boss's top half
## went through without hitting). The body still decides touching the player and the crowd.
var hit_radius := 6.0
var is_elite := false
## Ghosts drift through the crowd instead of being pushed apart by it.
var ghostly := false
var knockback_resist := 0.0
var dead := false
## Colour of the puff left behind on death.
var color := Color.WHITE
var ability := ""
## The timed moves it picks from (its own first, if it has one), and its affixes (AFFIXES ids).
var moves := PackedStringArray()
var affixes := PackedStringArray()
var game: Game
## Seconds left of following the flow field around a building, once it started to (Game).
var detour_left := 0.0
## Seconds left standing still, stunned (the stand-up perk).
var stun_left := 0.0
## Seconds left walking at `slow_scale` of its speed (a meeting room, 拉会).
var slow_left := 0.0
var slow_scale := 1.0
## A Deadline whose countdown ran out.
var berserk := false
## Inside an investor's aura this frame (Game sets it): takes less damage, tinted gold.
var shielded := false
## On an AI's clone: the AI it came from. Clones also have `life_left` ticking down to 0, at
## which Game removes them; -1 for everything else.
var clone_of: Enemy = null
var life_left := -1.0

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
## Seconds until the next boss move.
var _ability_left := 0.0
var _windup_left := 0.0
var _charge_left := 0.0
var _charge_direction := Vector2.ZERO
var _summon_type := SUMMON_TYPE
var _summon_count := SUMMON_COUNT
var _blink_target := Vector2.ZERO
var _pull_left := 0.0
## A sweep: seconds of it left, the beam's first heading and which way it turns (1 or -1), how
## long the player has been in the beam without a break, and whether this sweep has snapped them.
var _sweep_left := 0.0
var _sweep_from := 0.0
var _sweep_way := 1.0
var _exposed := 0.0
var _snapped := false
## A red light: seconds of red left, and whether it has fined the player yet.
var _red_left := 0.0
var _fined := false
## Where the closing ring of a squeeze is, in the world (it stays put while the player moves).
var _squeeze_at := Vector2.ZERO
## Turns each volley half a gap, so standing in a gap only works once.
var _volley_turn := 0.0
var _countdown_left := 0.0
## A boss's speed when far from the player (BOSS_SPEED_FLOOR); 0 for everything else.
var _catch_up_speed := 0.0
var _base_speed := 0.0
var _base_damage := 0.0
## Whether this boss's always-on move (countdown, aura, hoard) has been reported to the HUD yet.
var _announced := false
## The XP a hoarder has taken in so far (Game adds to it and spills it when it dies).
var hoarded := 0
## The timed move under way (or last used), out of `moves`.
var _move := ""
## The gap between moves is multiplied by this (996, 急了).
var _gap_scale := 1.0
var _angry := false
## Seconds since it was last hit (自愈), and until the next green puff while healing.
var _since_hit := 0.0
var _heal_puff_left := 0.0


func setup(type_id: String, data: Dictionary, hp_scale: float) -> void:
	type_name = type_id
	max_hp = data["hp"] * hp_scale
	hp = max_hp
	# Small per-enemy speed jitter keeps a crowd from marching in lockstep; a boss's is smaller, so
	# its catch-up speed never drops back to the crowd's pace.
	var own_speed: float = data["speed"]
	if data.get("elite", false):
		var jitter := randf_range(0.97, 1.03)
		speed = own_speed * jitter
		_catch_up_speed = (BOSS_SPEED_FLOOR + (own_speed - SLOWEST_BOSS_SPEED) * BOSS_SPEED_SPREAD) * jitter
	else:
		speed = own_speed * randf_range(0.9, 1.1)
	# Harder maps hit harder (Maps.current.DIFFICULTY), its moves too (_hits).
	damage = data["damage"] * Maps.current.DIFFICULTY["damage"]
	xp_value = data["xp"]
	radius = data["radius"]
	color = data["color"]
	is_elite = data.get("elite", false)
	ghostly = data.get("ghostly", false)
	knockback_resist = data.get("knockback_resist", 0.0)
	_wobble = data.get("wobble", 0.0)
	ability = data.get("ability", "")
	if TIMED_MOVES.has(ability):
		moves.append(ability)
	_summon_type = data.get("summon_type", SUMMON_TYPE)
	_summon_count = data.get("summon_count", SUMMON_COUNT)
	# Half a cycle in, so a boss shows its move soon after it walks on screen.
	_ability_left = (_move_every(moves[0]) if not moves.is_empty() else SUMMON_EVERY) * 0.5
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
	hit_radius = maxf(radius, _size * HIT_SHARE) if _size >= BIG_ART else radius
	_sprite = Art.sprite(data["art"], _size)
	_base_scale = _sprite.scale.x
	_sprite.modulate = _base_modulate
	add_child(_sprite)


## A boss's walking speed this frame: its own (with whatever sped it up) close to the player, at
## least its catch-up speed far away, never over BOSS_MAX_SPEED.
func _boss_walk_speed() -> float:
	var far := 0.0
	if game != null:
		far = smoothstep(CATCH_UP_NEAR, CATCH_UP_FAR, position.distance_to(game.player.position))
	return minf(lerpf(speed, maxf(speed, _catch_up_speed), far), BOSS_MAX_SPEED)


## `direction` is the unit vector to walk along this frame (Game._heading).
func tick(delta: float, direction: Vector2, separation: Vector2) -> void:
	if life_left > 0.0:
		life_left = maxf(0.0, life_left - delta)
	var velocity := direction * (_boss_walk_speed() if is_elite else speed)
	if _wobble > 0.0:
		velocity += direction.orthogonal() * sin(_phase * 0.7) * _wobble
	if slow_left > 0.0:
		slow_left -= delta
		velocity *= slow_scale
	if stun_left > 0.0:
		# Stunned: no walking and no boss move (its timers wait too); knockback still applies.
		stun_left -= delta
		velocity = Vector2.ZERO
		if stun_left <= 0.0 and _flash_left <= 0.0:
			_sprite.modulate = _base_modulate
	elif ability != "" or not moves.is_empty():
		velocity = _use_ability(delta, direction, velocity)
	if not affixes.is_empty():
		_tick_affixes(delta)
	position += (velocity + _knockback) * delta + separation * 0.3
	_knockback = _knockback.lerp(Vector2.ZERO, minf(1.0, 10.0 * delta))

	_phase += delta * 10.0
	var body_scale := Vector2.ONE * _base_scale
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
		body_scale = Vector2(_base_scale * (1.0 - squash), _base_scale * (1.0 + squash))
	_sprite.scale = body_scale * _hit_shape(delta)
	_sprite.rotation = _spin_angle(delta)
	if absf(direction.x) > 0.2:
		_sprite.flip_h = direction.x < 0.0

	if _flash_left > 0.0:
		_flash_left -= delta
		if _flash_left <= 0.0:
			_sprite.modulate = _rest_modulate()


## The velocity to move with this frame once the boss move in progress has had its say: any
## wind-up stands still, a charge under way rushes along its locked lane.
func _use_ability(delta: float, direction: Vector2, velocity: Vector2) -> Vector2:
	# The always-on moves, which have no wind-up, alongside any timed ones.
	match ability:
		"countdown":
			_tick_countdown(delta)
		"aura", "hoard":
			_announce()
			queue_redraw()
	if moves.is_empty():
		return velocity
	if _charge_left > 0.0:
		_charge_left -= delta
		return _charge_direction * CHARGE_SPEED
	if _pull_left > 0.0:
		_pull_left -= delta
		_drag_in(delta)
		queue_redraw()
		return Vector2.ZERO
	if _sweep_left > 0.0:
		_sweep_left -= delta
		_watch(delta)
		queue_redraw()
		return Vector2.ZERO
	if _red_left > 0.0:
		_red_left -= delta
		_check_red()
		queue_redraw()
		return Vector2.ZERO
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
	_move = _next_move()
	_ability_left = _move_every(_move) * _gap_scale * game.rng.randf_range(1.0 - MOVE_JITTER, 1.0 + MOVE_JITTER)
	game.boss_move.emit(_move)
	match _move:
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
		"pull":
			_windup_left = PULL_WINDUP
			return Vector2.ZERO
		"squeeze":
			_squeeze_at = game.player.position
			_windup_left = SQUEEZE_SECONDS
			return Vector2.ZERO
		"sweep":
			# Starts off to one side of the player and turns through them.
			_sweep_way = 1.0 if game.rng.randf() < 0.5 else -1.0
			_sweep_from = (game.player.position - position).angle() - _sweep_way * SWEEP_TURN / 2.0
			_windup_left = SWEEP_WINDUP
			return Vector2.ZERO
		"redlight":
			_windup_left = REDLIGHT_WINDUP
			return Vector2.ZERO
	return velocity


## A pull under way: the player and the crowd within PULL_RADIUS drift towards it this frame.
## Bosses aren't dragged, nor the crowd right on top of it.
func _drag_in(delta: float) -> void:
	var player := game.player
	var to_me := position - player.position
	if to_me.length() < PULL_RADIUS and to_me.length() > radius:
		player.drift(to_me.normalized() * PULL_PLAYER_SPEED)
	for enemy in game.query_enemies(position, PULL_RADIUS, false):
		var offset := position - enemy.position
		if enemy != self and not enemy.is_elite and offset.length() > radius + enemy.radius:
			enemy.position += offset.normalized() * PULL_CROWD_SPEED * delta


## A sweep under way: the player in the beam for SWEEP_EXPOSE without a break is snapped, once.
func _watch(delta: float) -> void:
	if _snapped:
		return
	var offset := game.player.position - position
	var beam := _sweep_heading()
	var inside := offset.length() <= SWEEP_RANGE + Player.HURT_RADIUS \
		and absf(angle_difference(beam, offset.angle())) <= SWEEP_WIDTH / 2.0
	_exposed = _exposed + delta if inside else 0.0
	if _exposed >= SWEEP_EXPOSE:
		_snapped = true
		Effects.ring(game, game.player.position, 24.0, SWEEP_BEAM)
		Effects.callout(game, game.player.position + Vector2(0.0, -20.0), tr("咔嚓！"), Art.BOSS_RED, 15)
		game.hurt_player(_hits(SWEEP_DAMAGE), type_name, "sweep")


## The light is red: the player still walking (their own steering) is fined, once.
func _check_red() -> void:
	if _fined or game.player.velocity.length() <= REDLIGHT_MOVE:
		return
	_fined = true
	Effects.callout(game, game.player.position + Vector2(0.0, -20.0), tr("罚款！"), Art.BOSS_RED, 15)
	game.hurt_player(_hits(REDLIGHT_DAMAGE), type_name, "redlight")


## Where the beam points now: its first heading while bracing, then turning through the sweep.
func _sweep_heading() -> float:
	var turned := 1.0 - _sweep_left / SWEEP_SECONDS if _sweep_left > 0.0 else 0.0
	return _sweep_from + _sweep_way * SWEEP_TURN * turned


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
		game.announce(Spawner.ENEMY_TYPES[type_name].get("berserk_line", "Deadline 到了！它暴走了"))


## Scales its health, full: a boss coming back later in a run a little weaker (Spawner EVENTS).
func scale_hp(factor: float) -> void:
	max_hp *= factor
	hp = max_hp


## A Deadline killed before its countdown ran out (its chest is at least a 绩效 A).
func met_deadline() -> bool:
	return ability == "countdown" and not berserk


## A clone whose time is up, for Game to take away.
func expired() -> bool:
	return life_left == 0.0


## A boss in a slot of the run's schedule made as strong as that slot's original boss (Spawner):
## its health, contact damage and stars, whichever boss it is.
func take_strength(data: Dictionary, hp_scale: float) -> void:
	max_hp = data["hp"] * hp_scale
	hp = max_hp
	damage = data["damage"] * Maps.current.DIFFICULTY["damage"]
	_base_damage = damage
	xp_value = data["xp"]


## Extra timed moves for this run, on top of its own.
func add_moves(extra: Array) -> void:
	for move: String in extra:
		if not moves.has(move):
			moves.append(move)


func add_affixes(list: Array) -> void:
	for affix: String in list:
		affixes.append(affix)
		match affix:
			"996":
				speed *= HASTY_SPEED
				_base_speed *= HASTY_SPEED
				_gap_scale *= HASTY_GAP
			"thick":
				max_hp *= THICK_HP
				hp = max_hp
				_grow(THICK_SIZE)


func has_affix(affix: String) -> bool:
	return affixes.has(affix)


## Its name with its affixes, for the HUD: 裁员通知 · 996 · 甩锅.
func display_name() -> String:
	var parts := PackedStringArray([tr(Spawner.ENEMY_TYPES[type_name]["name"])])
	for affix in affixes:
		parts.append(tr(AFFIXES[affix]))
	return " · ".join(parts)


## A piece flung off a boss with 甩锅: a small copy with `piece_hp`, no moves, no affixes, not a boss.
func make_scapegoat(piece_hp: float) -> void:
	is_elite = false
	ability = ""
	moves = PackedStringArray()
	affixes = PackedStringArray()
	max_hp = piece_hp
	hp = piece_hp
	xp_value = maxi(1, xp_value / 10)
	damage *= 0.6
	# Light enough to be knocked about like the crowd, which a boss isn't.
	knockback_resist = 0.3
	_grow(BLAME_SIZE)


func _grow(factor: float) -> void:
	_base_scale *= factor
	_size *= factor
	radius *= factor
	hit_radius *= factor


## 急了 at half health, 自愈 after HEAL_AFTER seconds unhit.
func _tick_affixes(delta: float) -> void:
	_since_hit += delta
	if has_affix("angry") and not _angry and hp < max_hp * ANGRY_AT:
		_angry = true
		speed *= ANGRY_SPEED
		_base_speed *= ANGRY_SPEED
		_gap_scale *= ANGRY_GAP
		_base_modulate = _base_modulate * ANGRY_TINT
		if _flash_left <= 0.0:
			_sprite.modulate = _rest_modulate()
		Effects.callout(game, position, tr("急了！"), Art.BOSS_RED, 15)
	if has_affix("heal") and _since_hit >= HEAL_AFTER and hp < max_hp:
		hp = minf(max_hp, hp + max_hp * HEAL_RATE * delta)
		queue_redraw()
		_heal_puff_left -= delta
		if _heal_puff_left <= 0.0:
			_heal_puff_left = 0.5
			Effects.poof(game, position, Art.GREEN)


## Thrown by something other than a hit: the quake, or a car or a train, which send it spinning
## (`spin`) unless it's too heavy to move much.
func shove(push: Vector2, spin: bool = false) -> void:
	_knockback += push * (1.0 - knockback_resist)
	if spin and knockback_resist < 0.9:
		_spin_left = SPIN_SECONDS
		_spin_way = -1.0 if push.x < 0.0 else 1.0


## The sprite as drawn this frame, for the death pop to copy.
func body_sprite() -> Sprite2D:
	return _sprite


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


## One of its timed moves at random, not the last one again when it has another.
func _next_move() -> String:
	if moves.size() == 1:
		return moves[0]
	var choices := Array(moves)
	choices.erase(_move)
	return choices[game.rng.randi() % choices.size()]


func _move_every(move: String) -> float:
	match move:
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
		"pull":
			return PULL_EVERY
		"squeeze":
			return SQUEEZE_EVERY
		"sweep":
			return SWEEP_EVERY
		"redlight":
			return REDLIGHT_EVERY
	return SUMMON_EVERY


func _finish_windup() -> void:
	match _move:
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
				game.fire_bullet(position + heading * radius, heading * VOLLEY_SPEED, _hits(VOLLEY_DAMAGE), type_name)
			Sound.play("boss_fire")
		"quake":
			_quake()
		"clones":
			game.spawn_clone(self)
		"pull":
			_pull_left = PULL_SECONDS
		"squeeze":
			Effects.ring(game, _squeeze_at, SQUEEZE_RADIUS, Art.BOSS_RED)
			if game.player.position.distance_to(_squeeze_at) <= SQUEEZE_RADIUS:
				game.hurt_player(_hits(SQUEEZE_DAMAGE), type_name, "squeeze")
		"sweep":
			_sweep_left = SWEEP_SECONDS
			_exposed = 0.0
			_snapped = false
		"redlight":
			_red_left = REDLIGHT_SECONDS
			_fined = false
	queue_redraw()


func _quake() -> void:
	Effects.ring(game, position, QUAKE_RADIUS, Art.BOSS_RED)
	Sound.play("quake")
	var player := game.player
	var offset := player.position - position
	if offset.length() <= QUAKE_RADIUS + Player.HURT_RADIUS:
		game.hurt_player(_hits(QUAKE_DAMAGE), type_name, "quake")
		player.position = game.city.resolve(player.position + offset.normalized() * QUAKE_SHOVE, Player.BODY_RADIUS)
	for enemy in game.query_enemies(position, QUAKE_RADIUS, false):
		if enemy != self and not enemy.is_elite:
			enemy.shove((enemy.position - position).normalized() * QUAKE_CROWD_PUSH)


## One pie at where the player is heading and the rest to either side of it.
func _throw_pies() -> void:
	var player := game.player
	var aim := player.position + player.velocity * LOB_LEAD_SECONDS
	var side := (aim - position).normalized().orthogonal()
	for i in LOB_PIES:
		var offset := side * (i - (LOB_PIES - 1) / 2.0) * LOB_SPREAD
		game.lob_pie(position + Vector2(0, -radius), aim + offset, LOB_FLIGHT_SECONDS, _hits(LOB_DAMAGE), type_name)


## Stops it in place for a while (bosses for less), tinted so it reads as frozen.
func stun(seconds: float) -> void:
	stun_left = maxf(stun_left, seconds * (BOSS_STUN_SCALE if is_elite else 1.0))
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


## A move's damage on this map (Maps.current.DIFFICULTY).
static func _hits(amount: float) -> float:
	return amount * Maps.current.DIFFICULTY["damage"]


func _rest_modulate() -> Color:
	var tint := _base_modulate * STUN_TINT if stun_left > 0.0 else _base_modulate
	return tint * AURA_TINT if shielded else tint


func take_hit(amount: float, push: Vector2) -> void:
	hp -= amount
	_since_hit = 0.0
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
		"hoard":
			# Its reach, turning slowly like a vacuum's, and the stars it has taken so far.
			for i in 12:
				var from := _phase * 0.05 + TAU * i / 12.0
				draw_arc(Vector2.ZERO, HOARD_RADIUS, from, from + TAU / 24.0, 6, Color(Art.BRAND_DEEP, 0.75), 2.0, true)
			if hoarded > 0:
				_draw_mark("★%d" % hoarded, Vector2(0.0, -_size / 2.0 - 12.0), 14, Art.BRAND_DEEP)
		"countdown":
			if berserk:
				var pulse := 0.5 + 0.5 * sin(_phase * 1.2)
				draw_arc(Vector2.ZERO, radius + 8.0 + 3.0 * pulse, 0.0, TAU, 32, Color(Art.BOSS_RED, 0.5 + 0.4 * pulse), 3.0, true)
			var urgent := berserk or _countdown_left <= COUNTDOWN_URGENT
			var text := "!" if berserk else str(ceili(maxf(_countdown_left, 0.0)))
			var size_bump := 2 if urgent and fmod(_phase, 6.0) < 3.0 else 0
			_draw_mark(text, Vector2(0.0, -_size / 2.0 - 12.0), 16 + size_bump, Art.BOSS_RED if urgent else Art.INK)
	# The pull's ring of arrows, faint while it braces, solid while it drags.
	if _move == "pull" and (_pull_left > 0.0 or _windup_left > 0.0):
		_draw_pull(_pull_left > 0.0)
	if _move == "sweep" and (_sweep_left > 0.0 or _windup_left > 0.0):
		_draw_sweep(_sweep_left > 0.0)
	if _move == "redlight" and (_red_left > 0.0 or _windup_left > 0.0):
		_draw_light(_red_left > 0.0)
	if _windup_left > 0.0:
		match _move:
			"squeeze":
				# The ring round where the player stood, and inside it the one closing in: it
				# goes off when that reaches the middle.
				var spot := _squeeze_at - position
				draw_circle(spot, SQUEEZE_RADIUS, Color(Art.BOSS_RED, 0.12))
				draw_arc(spot, SQUEEZE_RADIUS, 0.0, TAU, 48, Color(Art.BOSS_RED, 0.8), 2.0, true)
				draw_arc(spot, SQUEEZE_RADIUS * _windup_left / SQUEEZE_SECONDS, 0.0, TAU, 48, Color(Art.BOSS_RED, 0.9), 3.0, true)
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


## Arrows round it pointing in, creeping inwards, inside a ring the size of the pull.
func _draw_pull(dragging: bool) -> void:
	var alpha := 0.85 if dragging else 0.4
	draw_arc(Vector2.ZERO, PULL_RADIUS, 0.0, TAU, 64, Color(Art.LINK, alpha * 0.6), 2.0, true)
	var creep := fmod(_phase * 0.6, 1.0)
	for i in 10:
		var heading := Vector2.from_angle(TAU * i / 10.0 + 0.3)
		for step in 2:
			var reach := PULL_RADIUS * (0.9 - 0.35 * fmod(creep + step * 0.5, 1.0))
			var tip := heading * (reach - 10.0)
			var side := heading.orthogonal() * 6.0
			draw_polyline(PackedVector2Array([heading * reach + side, tip, heading * reach - side]), Color(Art.LINK, alpha), 2.5, true)


## The camera's beam: while it braces, a faint cone where it starts and a red arc with an arrowhead
## the way it will turn; while it sweeps, the cone lit up (red once it has snapped someone).
func _draw_sweep(sweeping: bool) -> void:
	var heading := _sweep_heading()
	var cone := PackedVector2Array([Vector2.ZERO])
	for step in 9:
		cone.append(Vector2.from_angle(heading - SWEEP_WIDTH / 2.0 + SWEEP_WIDTH * step / 8.0) * SWEEP_RANGE)
	var color := Art.BOSS_RED if _snapped else SWEEP_BEAM
	draw_colored_polygon(cone, Color(color, 0.32 if sweeping else 0.14))
	cone.append(Vector2.ZERO)
	draw_polyline(cone, Color(Art.BOSS_RED if _snapped else Art.BRAND_DEEP, 0.85 if sweeping else 0.5), 1.5, true)
	if not sweeping:
		# The way it will turn: an arc just outside its reach with an arrowhead at the far end.
		var from := _sweep_from
		var to := _sweep_from + _sweep_way * SWEEP_TURN
		draw_arc(Vector2.ZERO, SWEEP_RANGE + 8.0, minf(from, to), maxf(from, to), 32, Color(Art.BOSS_RED, 0.6), 2.0, true)
		var tip := Vector2.from_angle(to) * (SWEEP_RANGE + 8.0)
		var back := Vector2.from_angle(to - _sweep_way * 0.12) * (SWEEP_RANGE + 8.0)
		var side := (tip - back).orthogonal().normalized() * 5.0
		draw_colored_polygon(PackedVector2Array([tip + (tip - back).normalized() * 4.0, back + side, back - side]), Color(Art.BOSS_RED, 0.75))


## The pedestrian light over the player's head: amber, blinking faster as red comes, then red with
## 别动 under it (a red ring round the player too), crossed out once it has fined them.
func _draw_light(red: bool) -> void:
	var over := game.player.position - position + Vector2(0.0, -46.0)
	var housing := Rect2(over - Vector2(9.0, 16.0), Vector2(18.0, 32.0))
	draw_rect(housing.grow(2.0), Art.INK)
	draw_rect(housing, Color("3b4a6b"))
	var blink := red or fmod(_phase * (1.0 + 2.0 * (1.0 - _windup_left / REDLIGHT_WINDUP)), 2.0) < 1.2
	draw_circle(over + Vector2(0.0, -7.0), 6.0, Art.BOSS_RED if red else Color(Art.BOSS_RED, 0.25))
	draw_circle(over + Vector2(0.0, 7.0), 6.0, AMBER if (not red and blink) else Color(AMBER, 0.25))
	if red:
		var feet := game.player.position - position
		draw_arc(feet, 22.0, 0.0, TAU, 32, Color(Art.BOSS_RED, 0.85), 2.5, true)
		_draw_mark(tr("别动"), over + Vector2(0.0, 30.0), 13, Art.BOSS_RED)
		if _fined:
			draw_line(housing.position, housing.end, Art.PAPER, 2.0, true)


## A short line of text with a white edge, centred on `at` (the countdown, a clone's mark).
func _draw_mark(text: String, at: Vector2, font_size: int, color: Color) -> void:
	var font := Art.display_font(900)
	var width := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
	var baseline := at + Vector2(-width / 2.0, 0.0)
	draw_string_outline(font, baseline, text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, 5, Art.PAPER)
	draw_string(font, baseline, text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, color)
