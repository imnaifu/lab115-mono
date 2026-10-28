class_name Game
extends Node2D
## One run of the game. Builds the world, drives enemies and pickups every frame, and tracks
## XP, level-ups and the win/lose state. Weapons and UI reach shared state through here.

signal inventory_changed
signal level_up_offered(choices: Array)
signal run_ended(victory: bool)
signal announced(text: String)
signal chest_opened(funding_round: Dictionary, items: Array)

## CHEST is a boss's funding bag being opened (the slot machine in Hud).
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
## A boss's funding bag opens as a slot machine landing on a round, which decides how many free
## upgrades come out (Vampire Survivors' chests: 1, 3 or 5 items). Rare big rounds are the
## jackpot moment.
const FUNDING_ROUNDS := [
	{"id": "angel", "name": "天使轮", "items": 1, "weight": 75.0},
	{"id": "series_a", "name": "A 轮", "items": 3, "weight": 20.0},
	{"id": "ipo", "name": "IPO", "items": 5, "weight": 5.0},
]

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
## Funding bags picked up while another was open, opened once it closes.
var chests_waiting := 0

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


func _ready() -> void:
	_register_input_actions()
	Lang.setup()
	Tilt.setup()
	_star_hint_done = Settings.get_value("star_hint_shown", false)
	runs_before = Settings.get_value("runs_played", 0)
	rng.randomize()

	player = Player.new()
	player.game = self
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
	entity_layer.add_child(player)
	add_child(city)
	var boss_pointers := BossPointers.new()
	boss_pointers.game = self
	number_layer.add_child(boss_pointers)

	upgrades = Upgrades.new(self)
	spawner = Spawner.new(self)
	telemetry = Telemetry.new(self)
	perks = Perks.new(self)
	player.add_weapon(Upgrades.create_weapon(Upgrades.STARTING_WEAPON))

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
## as what last hurt them (Telemetry's killer).
func hurt_player(amount: float, by: String) -> void:
	telemetry.last_hurt_by = by
	player.take_damage(amount)


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


func random_visible_enemies(count: int) -> Array[Enemy]:
	var visible: Array[Enemy] = []
	var half := view_half()
	for enemy in enemies:
		var offset := (enemy.position - player.position).abs()
		if not enemy.dead and offset.x < half.x and offset.y < half.y:
			visible.append(enemy)
	visible.shuffle()
	return visible.slice(0, count)


## `silent` skips the hit sound, for damage that ticks constantly (the Wi-Fi field) and would
## otherwise patter non-stop; kills still pop.
func damage_enemy(enemy: Enemy, amount: float, push: Vector2 = Vector2.ZERO, source: String = "", silent: bool = false) -> void:
	if enemy.dead:
		return
	enemy.take_hit(amount, push)
	damage_by_source[source] = damage_by_source.get(source, 0.0) + amount
	Effects.damage_number(self, enemy.position, amount)
	if enemy.hp <= 0.0:
		_kill(enemy)
	elif not silent:
		Sound.play("hit")


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


func announce(text: String) -> void:
	announced.emit(text)


func _kill(enemy: Enemy) -> void:
	enemy.dead = true
	kills += 1
	enemies.erase(enemy)
	telemetry.on_enemy_killed(enemy)
	Sound.play("kill")
	Effects.poof(self, enemy.position, enemy.color)
	var star := _drop_xp(enemy.position, enemy.xp_value)
	perks.on_kill(enemy)
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
		_drop(Pickup.Kind.BONUS, enemy.position + Vector2(12, 0), 1)
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


func _tick_enemies(delta: float) -> void:
	var target := player.position
	var relocate_sq := RELOCATE_DISTANCE * RELOCATE_DISTANCE
	for enemy in enemies:
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
		enemy.tick(delta, heading, separation)
		if not enemy.ghostly:
			_keep_out_of_walls(enemy, target, delta, around == Vector2.ZERO)
		if enemy.position.distance_squared_to(target) > relocate_sq:
			var fresh_spot := offscreen_point(random_direction())
			enemy.position = fresh_spot if enemy.ghostly else city.resolve(fresh_spot, enemy.radius)


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
		hurt_player(strongest.damage, strongest.type_name)


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
			_open_chest()
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
	current_choices = upgrades.roll_choices(upgrades.choice_count())
	telemetry.on_offer(current_choices)
	state = State.LEVEL_UP
	get_tree().paused = true
	Sound.play("level_up")
	level_up_offered.emit(current_choices)


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


# --- Funding bags ------------------------------------------------------------------------

## Rolls the round, hands out its upgrades straight away and pauses while the HUD plays the slot
## machine. A second bag picked up meanwhile waits its turn.
func _open_chest() -> void:
	if state != State.PLAYING:
		chests_waiting += 1
		return
	var weights := PackedFloat32Array()
	for funding_round: Dictionary in FUNDING_ROUNDS:
		weights.append(funding_round["weight"])
	var funding_round: Dictionary = FUNDING_ROUNDS[rng.rand_weighted(weights)]
	var items := upgrades.open_chest(funding_round["items"])
	telemetry.on_chest(funding_round["id"])
	state = State.CHEST
	get_tree().paused = true
	inventory_changed.emit()
	chest_opened.emit(funding_round, items)


## The HUD's "take it" button (and the smoke-test bot).
func close_chest() -> void:
	if state != State.CHEST:
		return
	state = State.PLAYING
	get_tree().paused = false
	if chests_waiting > 0:
		chests_waiting -= 1
		_open_chest()
		return
	# Level-ups earned while the bag was open (its stars, a kill landing as it opened).
	_offer_level_up()


# --- Run state -----------------------------------------------------------------------------

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
