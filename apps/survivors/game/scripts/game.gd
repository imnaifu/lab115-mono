class_name Game
extends Node2D
## One run of the game. Builds the world, drives enemies and pickups every frame, and tracks
## XP, level-ups and the win/lose state. Weapons and UI reach shared state through here.

signal inventory_changed
## `lucky`: luck added a card to these (Upgrades.lucky_card).
signal level_up_offered(choices: Array, lucky: bool)
signal run_ended(victory: bool)
signal announced(text: String)
signal chest_opened(funding_round: Dictionary, items: Array, odds: Array[float])
## A boss is starting one of its moves (Enemy.ABILITIES); the HUD explains how to dodge it.
signal boss_move(ability: String)

## CHEST is a boss's year-end bonus being opened (the chest dialog in Hud).
enum State { TITLE, PLAYING, PAUSED, LEVEL_UP, CHEST, ENDED }

const RUN_SECONDS := 600.0
## Logical view sizes; project.godot's viewport size is the landscape one.
const LANDSCAPE_VIEW := Vector2i(640, 360)
const PORTRAIT_VIEW := Vector2i(360, 640)
## Enemies appear this far outside the screen edge, enough to hide the biggest boss.
const SPAWN_MARGIN := 40.0
const GRID_CELL := 32.0
## Query rects are padded by this so large enemies whose centre sits in a neighbouring cell
## are still found.
const MAX_ENEMY_RADIUS := 16.0
## Enemies left this far behind are moved back in front of the player so pressure never drops.
const RELOCATE_DISTANCE := 560.0
## An enemy that starts going round a building keeps to the flow field this long. "Straight is
## fine" only means some grid path runs straight there, not that the direct line is clear;
## without this, one rounding a corner flipped between the two every frame and stood still.
const DETOUR_HOLD_SECONDS := 0.6
const MAX_PICKUPS := 400
const HEAL_DROP_CHANCE := 0.012
## XP for the first level-ups, cheaper than the curve in xp_to_next() (5, 11, 17, 23) so a new run
## gets its first upgrades quickly; from level 5 on the curve applies.
const EARLY_LEVEL_XP := [3, 7, 13, 20]
const MAGNET_DROP_CHANCE := 0.004
## An investor killed spills this many extra stars of this value round it: 撤资, the reward
## for getting through its aura.
const PULL_OUT_STARS := 8
const PULL_OUT_STAR_VALUE := 3
## An AI's clone appears this far from the player.
const CLONE_DISTANCE := 110.0
## A boss's year-end bonus (年终奖, a chest) opens on a performance rating, which decides how many
## free upgrades come out (Vampire Survivors' chests: 1, 3 or 5 items). A rare 绩效 S is the
## jackpot moment. The ids are the data's (Telemetry `chests`) from when these were funding rounds
## (天使轮 / A 轮 / IPO), kept so runs before and after compare.
## Each affix on the boss that dropped a chest makes its 绩效 A and S this much likelier.
const AFFIX_LUCK := 1.5
const FUNDING_ROUNDS := [
	{"id": "angel", "name": "绩效 B", "items": 1, "weight": 75.0},
	{"id": "series_a", "name": "绩效 A", "items": 3, "weight": 20.0},
	{"id": "ipo", "name": "绩效 S", "items": 5, "weight": 5.0},
]
## Melee feel: a beat of hit-stop when a melee weapon lands on a boss (at most every
## HITSTOP_GAP), a small shake when one swing catches a crowd of SHAKE_CROWD or more.
const HITSTOP_SECONDS := 0.04
const HITSTOP_GAP := 0.3
const HITSTOP_SPEED := 0.05
const SHAKE_CROWD := 5
## A boss going down: a longer beat of hit-stop, a ring and a shake.
const BOSS_KILL_HITSTOP := 0.08
## Hits pushing at least this hard kick up dust behind what they hit.
const DUST_PUSH := 120.0
## Every job talks trash (Jobs "lines") when its own weapon lands a hit, at most this often.
const TAUNT_GAP := 3.0

## Set by restart() so "play again" skips the title screen; static so it survives the reload.
static var skip_title := false

## True while the game is drawn turned a quarter turn to fill an upright phone.
var screen_turned := false

var state := State.TITLE
var elapsed := 0.0
var kills := 0
var level := 1
var xp := 0
var queued_level_ups := 0
var current_choices: Array = []
## Total damage dealt per weapon id, for the end-of-run ranking.
var damage_by_source := {}
## Runs this device had played before this one (Settings' runs_played as the scene loaded).
var runs_before := 0
## Whether the player has moved yet this run; the HUD shows how to until they do.
var has_moved := false
## Year-end bonuses picked up while another was open, opened once it closes: each one's lowest
## rating (an index into FUNDING_ROUNDS) and its boss's affix count (see _open_chest).
var _waiting_chests: Array[Vector2i] = []
## Investors out this frame, whose auras shield the crowd round them (Enemy "aura").
var _aura_sources: Array[Enemy] = []

var rng := RandomNumberGenerator.new()
var player: Player
var enemies: Array[Enemy] = []
var pickups: Array[Pickup] = []
var spawner: Spawner
var upgrades: Upgrades
var city: City
var flow_field: FlowField
var telemetry: Telemetry
var perks: Perks
var hud: Hud
## Boss attacks in flight (HostileShot), ticked here.
var hostile_shots: Array[HostileShot] = []

var pickup_layer: Node2D
var entity_layer: Node2D
var effect_layer: Node2D
var number_layer: Node2D

var _enemy_grid := {}
var _corpses: Array[Enemy] = []
## Whether this device has been told that stars are XP (shown once, on the first drop ever).
var _star_hint_done := false
var _next_hitstop_msec := 0
## Run time (`elapsed`) before which the job's weapon keeps quiet.
var _next_taunt_at := 0.0
## Where the outsourced workers stand this frame (SquadWeapon sets it): enemies near one go for it
## instead of the player.
var decoys: Array[Vector2] = []
## What this run adds to 局外成长: landmarks checked in at, achievements earned.
var stamps: Stamps
var achievements: Achievements
## The map's own event while it runs (湾区地震, 沙尘暴; the Spawner starts it).
var map_events: MapEvents


func _ready() -> void:
	_register_input_actions()
	# A hit-stop cut short by the scene reloading would leave the game in slow motion.
	Engine.time_scale = 1.0
	Lang.setup()
	Tilt.setup()
	Cloud.setup()
	_star_hint_done = Settings.get_value("star_hint_shown", false)
	runs_before = Settings.get_value("runs_played", 0)
	rng.randomize()

	# The world is built from the map, so it is settled before anything else.
	Maps.use(Maps.saved())
	stamps = Stamps.new(self)
	achievements = Achievements.new(self)
	player = Player.new()
	player.game = self
	player.setup_job(Jobs.saved())
	player.died.connect(_on_player_died)
	# Mid-block, on the lawn in front of the first row of buildings rather than on a crossing.
	player.position = City.BLOCK * Vector2(0.5, 0.45)

	city = City.new()
	city.game = self
	city.follow = player
	city.seed_value = rng.randi()
	city.z_index = -10
	# Keeps streaming blocks while paused, so the title screen shows the town behind it.
	city.process_mode = Node.PROCESS_MODE_ALWAYS
	flow_field = FlowField.new(city)

	pickup_layer = _add_layer(-5)
	entity_layer = _add_layer(0)
	entity_layer.y_sort_enabled = true
	effect_layer = _add_layer(10)
	number_layer = _add_layer(20)
	map_events = MapEvents.new()
	map_events.game = self
	add_child(map_events)
	entity_layer.add_child(player)
	add_child(city)
	var boss_pointers := BossPointers.new()
	boss_pointers.game = self
	number_layer.add_child(boss_pointers)

	upgrades = Upgrades.new(self)
	spawner = Spawner.new(self)
	telemetry = Telemetry.new(self)
	perks = Perks.new(self)
	player.add_weapon(Upgrades.create_weapon(Jobs.data(player.job)["weapon"]))

	hud = Hud.new()
	hud.game = self
	add_child(hud)
	inventory_changed.emit()
	apply_orientation()
	get_tree().root.size_changed.connect(apply_orientation)

	if skip_title:
		skip_title = false
		state = State.PLAYING
		_on_run_started()
	else:
		get_tree().paused = true
		Sound.music("title")
		telemetry.on_title_shown()


func _process(delta: float) -> void:
	if state != State.PLAYING:
		return
	elapsed += delta
	if elapsed >= RUN_SECONDS:
		_end_run(true)
		return
	if not has_moved and player.velocity.length_squared() > 1.0:
		has_moved = true
	spawner.tick(delta)
	telemetry.tick(delta)
	flow_field.update(delta, player.position)
	_rebuild_grid()
	_tick_enemies(delta)
	_tick_hostile_shots(delta)
	perks.tick(delta)
	_tick_pickups(delta)
	_check_player_contact()
	stamps.tick(delta)
	achievements.tick(delta)


func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT:
		set_paused(true)


## Half the visible world, in logical pixels (the camera has no zoom). A turned screen shows the
## world sideways, so its width and height swap.
func view_half() -> Vector2:
	var size := get_viewport().get_visible_rect().size
	if screen_turned:
		size = Vector2(size.y, size.x)
	return size / 2.0


## Phones play in portrait by default, like the genre's mobile hits (Vampire Survivors and
## Survivor.io both default to it: one thumb steers, the phone stays upright), and the layout
## simply follows how the phone is held. A phone whose player picked landscape in Settings
## draws the game turned a quarter turn while upright, so it plays sideways even with rotation
## lock on. Computers are always landscape; a window taller than wide gets that letterboxed.
## Otherwise a longer screen sees more of the world (aspect "expand").
func apply_orientation() -> void:
	var window := get_window()
	var upright := window.size.y > window.size.x
	var handheld := Device.is_handheld()
	var turned := handheld and upright and Device.prefers_landscape()
	# An upright phone uses the tall base size whether it shows the portrait layout or the turned
	# landscape one (whose layout swaps it back).
	var scale_size := PORTRAIT_VIEW if handheld and upright else LANDSCAPE_VIEW
	var aspect := Window.CONTENT_SCALE_ASPECT_KEEP if upright and not handheld else Window.CONTENT_SCALE_ASPECT_EXPAND
	if window.content_scale_size != scale_size:
		window.content_scale_size = scale_size
	if window.content_scale_aspect != aspect:
		window.content_scale_aspect = aspect
	screen_turned = turned
	player.set_screen_turned(turned)
	Tilt.set_screen_turned(turned)
	# After the content scale change has resized the visible rect.
	hud.call_deferred("fit_screen", turned)


# --- Enemies -------------------------------------------------------------------------------

func spawn_enemy(type_name: String, at: Vector2) -> Enemy:
	var enemy := Enemy.new()
	enemy.setup(type_name, Spawner.ENEMY_TYPES[type_name], spawner.hp_scale())
	enemy.game = self
	enemy.position = at if enemy.ghostly else city.resolve(at, enemy.radius)
	entity_layer.add_child(enemy)
	enemies.append(enemy)
	telemetry.on_enemy_spawned(enemy)
	achievements.on_spawned(type_name)
	return enemy


## A boss calling minions: `count` of `type_name` in a ring around it, as far as the crowd cap
## allows.
func summon_around(boss: Enemy, type_name: String, count: int, radius: float) -> void:
	for i in mini(count, spawner.max_alive - enemies.size()):
		spawn_enemy(type_name, boss.position + Vector2.from_angle(TAU * i / count) * radius)
	Effects.poof(self, boss.position, boss.color)


## A boss's bullet (Enemy "volley").
func fire_bullet(at: Vector2, velocity: Vector2, damage: float, thrower: String) -> void:
	var shot := HostileShot.new()
	shot.setup_bullet(at, velocity, damage, thrower)
	effect_layer.add_child(shot)
	hostile_shots.append(shot)


## A boss's pie, thrown from `from` to land on `to` (Enemy "lob").
func lob_pie(from: Vector2, to: Vector2, seconds: float, damage: float, thrower: String) -> void:
	var shot := HostileShot.new()
	shot.setup_lob(from, city.resolve(to, 1.0), seconds, damage, thrower)
	effect_layer.add_child(shot)
	hostile_shots.append(shot)


## Damage to the player from anything: contact, a bullet, a pie. `by` is the enemy type, kept
## as what last hurt them (Telemetry's killer), and `how` the way it landed: "contact",
## "charge", "bullet" or "pie" (the result screen's cause of death).
func hurt_player(amount: float, by: String, how: String = "contact") -> void:
	telemetry.last_hurt_by = by
	telemetry.last_hurt_how = how
	var hp_before := player.hp
	player.take_damage(amount)
	if player.hp < hp_before:
		achievements.on_hurt()


## All living enemies whose body overlaps the circle.
func query_enemies(center: Vector2, radius: float) -> Array[Enemy]:
	var found: Array[Enemy] = []
	var reach := radius + MAX_ENEMY_RADIUS
	var min_cell := _cell_of(center - Vector2(reach, reach))
	var max_cell := _cell_of(center + Vector2(reach, reach))
	for cell_x in range(min_cell.x, max_cell.x + 1):
		for cell_y in range(min_cell.y, max_cell.y + 1):
			var bucket = _enemy_grid.get(Vector2i(cell_x, cell_y))
			if bucket == null:
				continue
			for enemy: Enemy in bucket:
				if enemy.dead:
					continue
				var hit_distance := radius + enemy.radius
				if enemy.position.distance_squared_to(center) <= hit_distance * hit_distance:
					found.append(enemy)
	return found


func nearest_enemy(from: Vector2, max_distance: float) -> Enemy:
	var best: Enemy = null
	var best_distance_sq := max_distance * max_distance
	for enemy in enemies:
		if enemy.dead:
			continue
		var distance_sq := enemy.position.distance_squared_to(from)
		if distance_sq < best_distance_sq:
			best_distance_sq = distance_sq
			best = enemy
	return best


func visible_enemies() -> Array[Enemy]:
	var visible: Array[Enemy] = []
	var half := view_half()
	for enemy in enemies:
		var offset := (enemy.position - player.position).abs()
		if not enemy.dead and offset.x < half.x and offset.y < half.y:
			visible.append(enemy)
	return visible


func random_visible_enemies(count: int) -> Array[Enemy]:
	var visible := visible_enemies()
	visible.shuffle()
	return visible.slice(0, count)


## A melee weapon just hit `hits` enemies, a boss among them if `hit_boss`.
func melee_impact(hits: int, hit_boss: bool) -> void:
	if hits >= SHAKE_CROWD:
		player.shake(0.08, 1.5)
	if hit_boss:
		hitstop(HITSTOP_SECONDS)


## Nearly freezes the game for `seconds` (at most once every HITSTOP_GAP).
func hitstop(seconds: float) -> void:
	if Time.get_ticks_msec() < _next_hitstop_msec:
		return
	_next_hitstop_msec = Time.get_ticks_msec() + roundi(HITSTOP_GAP * 1000.0)
	Engine.time_scale = HITSTOP_SPEED
	# Counted in real time: game time hardly moves meanwhile. Bound to Engine rather than to the
	# game, so a scene reloaded in between can't leave the game slowed down.
	get_tree().create_timer(seconds, true, false, true).timeout.connect(Engine.set.bind(&"time_scale", 1.0))


## `silent` skips the hit sound, for damage that ticks constantly (the Wi-Fi field) and would
## otherwise patter non-stop; kills still pop.
func damage_enemy(enemy: Enemy, amount: float, push: Vector2 = Vector2.ZERO, source: String = "", silent: bool = false) -> void:
	if enemy.dead:
		return
	if enemy.shielded:
		amount *= Enemy.AURA_SHIELD
	enemy.take_hit(amount, push)
	damage_by_source[source] = damage_by_source.get(source, 0.0) + amount
	Effects.damage_number(self, enemy.position, amount)
	# No spark for the constant ticks (the Wi-Fi field, the axes), which would cover the crowd.
	if not silent:
		# On the side the blow came from.
		var contact := -push.normalized() * enemy.radius * 0.6 if push != Vector2.ZERO \
			else Vector2(randf_range(-3.0, 3.0), randf_range(-3.0, 3.0))
		Effects.spark(self, enemy.position + contact, amount >= Effects.BIG_HIT)
	if push.length() >= DUST_PUSH and enemy.knockback_resist < 0.9:
		Effects.dust(self, enemy.position, push)
	if source == Jobs.data(player.job)["weapon"]:
		_taunt()
	if enemy.hp <= 0.0:
		_kill(enemy)
	elif not silent:
		Sound.play("hit")


## A line of the job's trash talk over the player (TAUNT_GAP apart at most).
func _taunt() -> void:
	if elapsed < _next_taunt_at:
		return
	_next_taunt_at = elapsed + TAUNT_GAP
	var lines: Array = Jobs.data(player.job)["lines"]
	Effects.callout(self, player.position + Vector2(0.0, -10.0), tr(lines[randi() % lines.size()]), Art.PAPER)


## A point just outside the visible screen in the given direction from the player, or, if
## that is water, the first of the opposite and the two sideways directions that is land:
## nothing walks out of the sea.
func offscreen_point(direction: Vector2) -> Vector2:
	var half := view_half() + Vector2(SPAWN_MARGIN, SPAWN_MARGIN)
	var first_try := Vector2.ZERO
	for heading in [direction, -direction, direction.orthogonal(), -direction.orthogonal()]:
		var scale_x := half.x / absf(heading.x) if absf(heading.x) > 0.001 else INF
		var scale_y := half.y / absf(heading.y) if absf(heading.y) > 0.001 else INF
		var point: Vector2 = player.position + heading * minf(scale_x, scale_y)
		if not city.is_water(point):
			return point
		if first_try == Vector2.ZERO:
			first_try = point
	return first_try


## Random spawn direction, biased toward where the player is walking so they run into enemies
## instead of outpacing them.
func random_direction() -> Vector2:
	if player.velocity.length_squared() > 1.0 and rng.randf() < 0.4:
		return Vector2.from_angle(player.velocity.angle() + rng.randf_range(-0.8, 0.8))
	return Vector2.from_angle(rng.randf() * TAU)


## The map's event coming on (the Spawner, at the map's MAP_EVENT time): it runs, and says so.
func start_map_event(event: Dictionary) -> void:
	map_events.start(event["id"], event["seconds"])


func announce(text: String) -> void:
	announced.emit(text)


func _kill(enemy: Enemy) -> void:
	enemy.dead = true
	kills += 1
	achievements.on_killed(enemy.type_name)
	enemies.erase(enemy)
	telemetry.on_enemy_killed(enemy)
	if enemy.is_elite:
		Sound.boss_down()
	else:
		Sound.play("kill")
	Effects.poof(self, enemy.position, enemy.color)
	Effects.death_pop(self, enemy.body_sprite(), enemy.position, enemy.is_elite)
	if enemy.is_elite:
		achievements.on_boss_killed(enemy.type_name)
		if enemy.has_affix("blame"):
			_fling_scapegoats(enemy)
		Effects.ring(self, enemy.position, enemy.radius * 4.0, enemy.color)
		player.shake(0.25, 3.0)
		hitstop(BOSS_KILL_HITSTOP)
	# An AI's clones go with it; clones themselves give nothing.
	var star: Pickup = null
	if enemy.xp_value > 0:
		star = _drop_xp(enemy.position, enemy.xp_value)
	perks.on_kill(enemy)
	match enemy.ability:
		"clones":
			for clone in enemies.duplicate():
				if clone.clone_of == enemy:
					_remove_quietly(clone)
		"aura":
			for i in PULL_OUT_STARS:
				_drop_xp(enemy.position + Vector2.from_angle(TAU * i / PULL_OUT_STARS) * 28.0, PULL_OUT_STAR_VALUE)
			announce(Spawner.ENEMY_TYPES[enemy.type_name].get("death_line", "撤资了！掉了一地经验"))
	var data: Dictionary = Spawner.ENEMY_TYPES[enemy.type_name]
	# Splits regardless of the crowd cap: the pieces are the rest of the boss fight.
	if data.has("splits_into"):
		var pieces: int = data["split_count"]
		for i in pieces:
			spawn_enemy(data["splits_into"], enemy.position + Vector2.from_angle(TAU * i / pieces) * enemy.radius)
	if not _star_hint_done and star != null:
		_star_hint_done = true
		Settings.set_value("star_hint_shown", true)
		announce("捡星星升级！走近就会自动吸过来")
		# The live data had a first-time player stay at level 1 for 30 seconds: a toast at the top
		# wasn't enough to send them to the star.
		star.point_at()
	if enemy.is_elite:
		# A Deadline met in time pays: its chest is at least a 绩效 A (按时交付).
		var lowest_round := 0
		if enemy.met_deadline():
			lowest_round = 1
			announce(Spawner.ENEMY_TYPES[enemy.type_name].get("on_time_line", "按时交付！年终奖保底绩效 A"))
		var chest := _drop(Pickup.Kind.BONUS, enemy.position + Vector2(12, 0), lowest_round)
		chest.affixes = enemy.affixes.size()
		_drop(Pickup.Kind.HEAL, enemy.position + Vector2(-12, 0), 1)
		_drop(Pickup.Kind.MAGNET, enemy.position + Vector2(0, 12), 1)
	else:
		var roll := rng.randf()
		if roll < HEAL_DROP_CHANCE:
			_drop(Pickup.Kind.HEAL, enemy.position + Vector2(6, 0), 1)
		elif roll < HEAL_DROP_CHANCE + MAGNET_DROP_CHANCE:
			_drop(Pickup.Kind.MAGNET, enemy.position + Vector2(6, 0), 1)
	# Freed only once the grid no longer references it (next rebuild); until then queries skip
	# it via `dead`. Freeing now would leave a dangling entry for anything that queries before
	# the next rebuild.
	enemy.visible = false
	_corpses.append(enemy)


func _rebuild_grid() -> void:
	for corpse in _corpses:
		corpse.queue_free()
	_corpses.clear()
	_enemy_grid.clear()
	for enemy in enemies:
		var cell := _cell_of(enemy.position)
		if _enemy_grid.has(cell):
			_enemy_grid[cell].append(enemy)
		else:
			_enemy_grid[cell] = [enemy]


## 甩锅: a boss carrying it flings Enemy.BLAME_PIECES small copies of itself as it dies; they have
## no moves and aren't bosses.
func _fling_scapegoats(boss: Enemy) -> void:
	for i in Enemy.BLAME_PIECES:
		var heading := Vector2.from_angle(TAU * i / Enemy.BLAME_PIECES + rng.randf())
		var piece := Enemy.new()
		piece.setup(boss.type_name, Spawner.ENEMY_TYPES[boss.type_name], 1.0)
		piece.game = self
		piece.make_scapegoat(boss.max_hp * Enemy.BLAME_HP)
		piece.position = city.resolve(boss.position + heading * boss.radius * 1.5, piece.radius)
		entity_layer.add_child(piece)
		enemies.append(piece)
		piece.shove(heading * 160.0, true)
	Effects.callout(self, boss.position, tr("甩锅！"), Art.BOSS_RED, 15)


## Takes an enemy off the field with nothing to show for it: a clone fading or going with its AI.
func _remove_quietly(enemy: Enemy) -> void:
	if enemy.dead:
		return
	enemy.dead = true
	enemies.erase(enemy)
	Effects.poof(self, enemy.position, enemy.color)
	enemy.visible = false
	_corpses.append(enemy)


## A see-through copy of an AI near the player (Enemy "clones").
func spawn_clone(boss: Enemy) -> void:
	if clones_of(boss) >= Enemy.MAX_CLONES:
		return
	var spot := player.position + Vector2.from_angle(rng.randf() * TAU) * CLONE_DISTANCE
	var clone := spawn_enemy(Spawner.ENEMY_TYPES[boss.type_name].get("clone_type", "ai_clone"), spot)
	clone.clone_of = boss
	Effects.poof(self, clone.position, clone.color)


func clones_of(boss: Enemy) -> int:
	var count := 0
	for enemy in enemies:
		if enemy.clone_of == boss and not enemy.dead:
			count += 1
	return count


func _tick_enemies(delta: float) -> void:
	var target := player.position
	var relocate_sq := RELOCATE_DISTANCE * RELOCATE_DISTANCE
	_aura_sources.clear()
	for enemy in enemies:
		if enemy.ability == "aura" and not enemy.dead:
			_aura_sources.append(enemy)
	var aura_reach := Enemy.AURA_RADIUS * Enemy.AURA_RADIUS
	var expired: Array[Enemy] = []
	for enemy in enemies:
		if not enemy.is_elite:
			var inside := false
			for source in _aura_sources:
				if source.position.distance_squared_to(enemy.position) <= aura_reach:
					inside = true
					break
			enemy.set_shielded(inside)
		var separation := Vector2.ZERO if enemy.ghostly else _separation(enemy)
		# Ghosts drift through walls; everyone else takes the way round when one is in the way.
		var around := Vector2.ZERO
		if not enemy.ghostly:
			around = flow_field.heading(enemy.position)
			if around != Vector2.ZERO:
				enemy.detour_left = DETOUR_HOLD_SECONDS
			elif enemy.detour_left > 0.0:
				enemy.detour_left -= delta
				around = flow_field.heading(enemy.position, true)
		var heading := around if around != Vector2.ZERO else (target - enemy.position).normalized()
		# A decoy close by draws it off the player (they stand right by the player, so no walls to
		# go round in between).
		var lure: Variant = _lure_for(enemy)
		if lure != null:
			heading = ((lure as Vector2) - enemy.position).normalized()
		enemy.tick(delta, heading, separation)
		if not enemy.ghostly:
			_keep_out_of_walls(enemy, target if lure == null else lure as Vector2, delta, around == Vector2.ZERO or lure != null)
		if enemy.position.distance_squared_to(target) > relocate_sq:
			var fresh_spot := offscreen_point(random_direction())
			enemy.position = fresh_spot if enemy.ghostly else city.resolve(fresh_spot, enemy.radius)
		if enemy.expired():
			expired.append(enemy)
	for enemy in expired:
		_remove_quietly(enemy)


## The closest decoy within SquadWeapon.LURE_RADIUS of the enemy, or null; bosses ignore them.
func _lure_for(enemy: Enemy) -> Variant:
	if decoys.is_empty() or enemy.is_elite:
		return null
	var best: Variant = null
	var best_distance := SquadWeapon.LURE_RADIUS * SquadWeapon.LURE_RADIUS
	for decoy in decoys:
		var distance := decoy.distance_squared_to(enemy.position)
		if distance < best_distance:
			best_distance = distance
			best = decoy
	return best


## Pushes an enemy out of buildings and the water. One walking straight that presses against a
## wall (a trunk, a building's corner) also slides along it toward the player's side; one
## already taking the flow field's way round needs no slide, which would only fight it.
func _keep_out_of_walls(enemy: Enemy, target: Vector2, delta: float, slide: bool) -> void:
	var resolved := city.resolve(enemy.position, enemy.radius)
	var push := resolved - enemy.position
	if slide and push.length_squared() > 0.0001:
		var along := push.orthogonal().normalized()
		if along.dot(target - resolved) < 0.0:
			along = -along
		resolved = city.resolve(resolved + along * enemy.speed * delta * 0.8, enemy.radius)
	enemy.position = resolved


## Position correction that pushes overlapping enemies apart, so crowds spread into a blob
## instead of stacking on one pixel.
func _separation(enemy: Enemy) -> Vector2:
	var push := Vector2.ZERO
	var cell := _cell_of(enemy.position)
	for cell_x in range(cell.x - 1, cell.x + 2):
		for cell_y in range(cell.y - 1, cell.y + 2):
			var bucket = _enemy_grid.get(Vector2i(cell_x, cell_y))
			if bucket == null:
				continue
			for other: Enemy in bucket:
				if other == enemy or other.ghostly:
					continue
				var offset := enemy.position - other.position
				var min_distance := enemy.radius + other.radius
				var distance_sq := offset.length_squared()
				if distance_sq < min_distance * min_distance and distance_sq > 0.0001:
					var distance := sqrt(distance_sq)
					push += offset / distance * (min_distance - distance)
	return push


func _tick_hostile_shots(delta: float) -> void:
	for i in range(hostile_shots.size() - 1, -1, -1):
		var shot := hostile_shots[i]
		shot.tick(delta, self)
		if shot.done:
			shot.queue_free()
			hostile_shots.remove_at(i)


func _check_player_contact() -> void:
	var strongest: Enemy = null
	for enemy in query_enemies(player.position, Player.HURT_RADIUS):
		if strongest == null or enemy.damage > strongest.damage:
			strongest = enemy
	if strongest != null:
		hurt_player(strongest.damage, strongest.type_name, "charge" if strongest.is_charging() else "contact")


func _cell_of(point: Vector2) -> Vector2i:
	return Vector2i(floori(point.x / GRID_CELL), floori(point.y / GRID_CELL))


# --- Pickups & XP --------------------------------------------------------------------------

## The new star, or null when the XP went into one already on the ground.
func _drop_xp(at: Vector2, value: int) -> Pickup:
	if pickups.size() >= MAX_PICKUPS:
		# Fold the XP into an existing star instead of piling up nodes in long runs.
		for attempt in 8:
			var existing := pickups[rng.randi() % pickups.size()]
			if existing.kind == Pickup.Kind.XP:
				existing.add_value(value)
				return null
	return _drop(Pickup.Kind.XP, at, value)


func _drop(kind: Pickup.Kind, at: Vector2, value: int) -> Pickup:
	var pickup := Pickup.new()
	pickup.setup(kind, value)
	pickup.position = at + Vector2(rng.randf_range(-3, 3), rng.randf_range(-3, 3))
	pickup_layer.add_child(pickup)
	pickups.append(pickup)
	return pickup


func _tick_pickups(delta: float) -> void:
	for i in range(pickups.size() - 1, -1, -1):
		var pickup := pickups[i]
		if pickup.tick(delta, player):
			pickups.remove_at(i)
			_collect(pickup)
			pickup.queue_free()


func _collect(pickup: Pickup) -> void:
	match pickup.kind:
		Pickup.Kind.XP:
			Sound.xp()
			add_xp(pickup.value)
		Pickup.Kind.HEAL:
			Sound.play("heal")
			player.heal(30.0)
			announce("珍珠奶茶，回血 30！")
		Pickup.Kind.BONUS:
			_open_chest(pickup.value, pickup.affixes)
		Pickup.Kind.MAGNET:
			Sound.play("magnet")
			for other in pickups:
				if other.kind == Pickup.Kind.XP:
					other.attract()
			announce("磁铁！全图经验飞过来了")


func xp_to_next() -> int:
	if level <= EARLY_LEVEL_XP.size():
		return EARLY_LEVEL_XP[level - 1]
	return 5 + (level - 1) * 6 + maxi(0, level - 20) * 4


func add_xp(amount: int) -> void:
	xp += amount
	while xp >= xp_to_next():
		xp -= xp_to_next()
		level += 1
		queued_level_ups += 1
	_offer_level_up()


func _offer_level_up() -> void:
	if state != State.PLAYING or queued_level_ups <= 0:
		return
	var lucky := upgrades.lucky_card()
	# The level this offer is for: `level` has already counted every banked level-up.
	current_choices = upgrades.roll_choices(upgrades.choice_count(lucky), level - queued_level_ups + 1)
	# Only a card that really came out counts (a near-empty pool may not fill the extra slot).
	lucky = lucky and current_choices.size() > upgrades.choice_count()
	telemetry.on_offer(current_choices)
	if lucky:
		telemetry.on_lucky_card()
	state = State.LEVEL_UP
	get_tree().paused = true
	Sound.play("level_up")
	level_up_offered.emit(current_choices, lucky)


func choose_upgrade(index: int) -> void:
	if state != State.LEVEL_UP or index < 0 or index >= current_choices.size():
		return
	upgrades.apply(current_choices[index])
	telemetry.on_pick(current_choices[index])
	queued_level_ups -= 1
	Sound.play("pick")
	state = State.PLAYING
	get_tree().paused = false
	inventory_changed.emit()
	# Several level-ups can be banked at once (big gems, chests); offer them back to back.
	_offer_level_up()


# --- Year-end bonuses (boss chests) ------------------------------------------------------

## Rolls the rating (at least `lowest_round`, an index into FUNDING_ROUNDS; every rating past the
## first AFFIX_LUCK times likelier for each of `affixes`, the dropping boss's, and likelier still
## with the player's luck, as card rarity is), hands out its upgrades straight away and pauses
## while the HUD opens the chest. A second chest picked up meanwhile waits its turn.
func _open_chest(lowest_round: int = 0, affixes: int = 0) -> void:
	if state != State.PLAYING:
		_waiting_chests.append(Vector2i(lowest_round, affixes))
		return
	var weights := PackedFloat32Array()
	for index in FUNDING_ROUNDS.size():
		var weight: float = FUNDING_ROUNDS[index]["weight"]
		weights.append(weight * pow(AFFIX_LUCK, affixes if index > 0 else 0) * Upgrades.luck_factor(player.luck, index))
	var funding_round: Dictionary = FUNDING_ROUNDS[maxi(rng.rand_weighted(weights), lowest_round)]
	# This chest's real odds for the dialog: ratings under the floor count as the floor.
	var total := 0.0
	for weight in weights:
		total += weight
	var odds: Array[float] = []
	for index in FUNDING_ROUNDS.size():
		odds.append(0.0 if index < lowest_round else weights[index] / total * 100.0)
	for index in lowest_round:
		odds[lowest_round] += weights[index] / total * 100.0
	var items := upgrades.open_chest(funding_round["items"])
	telemetry.on_chest(funding_round["id"], items)
	state = State.CHEST
	get_tree().paused = true
	inventory_changed.emit()
	chest_opened.emit(funding_round, items, odds)


## The HUD's "take it" button (and the smoke-test bot).
func close_chest() -> void:
	if state != State.CHEST:
		return
	state = State.PLAYING
	get_tree().paused = false
	if not _waiting_chests.is_empty():
		var waiting: Vector2i = _waiting_chests.pop_front()
		_open_chest(waiting.x, waiting.y)
		return
	# Level-ups earned while the chest was open (its stars, a kill landing as it opened).
	_offer_level_up()


# --- Run state -----------------------------------------------------------------------------

## Picks the job on the title screen: remembered for next time, and the player rebuilt as it
## (build, look, starting weapon).
func set_job(job_id: String) -> void:
	if state != State.TITLE or job_id == player.job:
		return
	Settings.set_value("job", job_id)
	for weapon in player.weapons:
		weapon.queue_free()
	player.weapons.clear()
	player.setup_job(job_id)
	player.add_weapon(Upgrades.create_weapon(Jobs.data(job_id)["weapon"]))
	inventory_changed.emit()


## The title screen's map picker: the city is built from the map, so the scene starts over on it
## (behind the title, which stays up).
func change_map(map_id: String) -> void:
	Settings.set_value("map", map_id)
	skip_title = false
	get_tree().reload_current_scene()


## The result screen's 换职业: back to the title screen to pick another job.
func change_job() -> void:
	achievements.finish(false)
	telemetry.finish("restart")
	skip_title = false
	get_tree().paused = false
	get_tree().reload_current_scene()


## Leaves the title screen.
func start_run() -> void:
	if state != State.TITLE:
		return
	state = State.PLAYING
	get_tree().paused = false
	_on_run_started()


## Zeroes the tilt to how the phone is held right now, and says so: without the hint, the first
## tilt player wonders why holding the phone at an angle doesn't send them running.
func _on_run_started() -> void:
	# Every landmark checked in at in earlier runs: after the job's own build, before the run's
	# data notes the player's numbers.
	Stamps.apply_all(player)
	telemetry.start()
	Sound.music("battle")
	Tilt.calibrate()
	if Tilt.enabled():
		announce("倾斜手机就能移动，前后以现在的角度为准")


func set_paused(value: bool) -> void:
	if value and state == State.PLAYING:
		state = State.PAUSED
		get_tree().paused = true
	elif not value and state == State.PAUSED:
		state = State.PLAYING
		get_tree().paused = false
		# The phone may be held differently after a break; re-zero the tilt.
		Tilt.calibrate()


func restart() -> void:
	# A run given up from the pause screen; after a death or a win it was already sent.
	achievements.finish(false)
	telemetry.finish("restart")
	skip_title = true
	get_tree().paused = false
	get_tree().reload_current_scene()


func _on_player_died() -> void:
	_end_run(false)


func _end_run(victory: bool) -> void:
	if state == State.ENDED:
		return
	state = State.ENDED
	get_tree().paused = true
	# Before the run's data goes out and the result screen is built: both list what it earned.
	achievements.finish(victory)
	telemetry.finish("win" if victory else "died")
	Sound.stop_music()
	Sound.play("win" if victory else "lose")
	run_ended.emit(victory)


func _add_layer(z: int) -> Node2D:
	var layer := Node2D.new()
	layer.z_index = z
	add_child(layer)
	return layer


static func _register_input_actions() -> void:
	var bindings := {
		"move_left": [KEY_A, KEY_LEFT],
		"move_right": [KEY_D, KEY_RIGHT],
		"move_up": [KEY_W, KEY_UP],
		"move_down": [KEY_S, KEY_DOWN],
	}
	var stick := {
		"move_left": [JOY_AXIS_LEFT_X, -1.0],
		"move_right": [JOY_AXIS_LEFT_X, 1.0],
		"move_up": [JOY_AXIS_LEFT_Y, -1.0],
		"move_down": [JOY_AXIS_LEFT_Y, 1.0],
	}
	for action: String in bindings:
		if InputMap.has_action(action):
			continue
		InputMap.add_action(action, 0.2)
		for keycode: Key in bindings[action]:
			var key_event := InputEventKey.new()
			# Physical keys so WASD stays in the same place on non-QWERTY layouts.
			key_event.physical_keycode = keycode
			InputMap.action_add_event(action, key_event)
		var motion := InputEventJoypadMotion.new()
		motion.axis = stick[action][0]
		motion.axis_value = stick[action][1]
		InputMap.action_add_event(action, motion)
