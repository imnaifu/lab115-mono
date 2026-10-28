class_name Game
extends Node2D
## One run of the game. Builds the world, drives enemies and pickups every frame, and tracks
## XP, level-ups and the win/lose state. Weapons and UI reach shared state through here.

signal inventory_changed
signal level_up_offered(choices: Array)
signal run_ended(victory: bool)
signal announced(text: String)

enum State { TITLE, PLAYING, PAUSED, LEVEL_UP, ENDED }

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
const MAX_PICKUPS := 400
const HEAL_DROP_CHANCE := 0.012
## XP for the first level-ups, cheaper than the curve in xp_to_next() (5, 11, 17, 23) so a new run
## gets its first upgrades quickly; from level 5 on the curve applies.
const EARLY_LEVEL_XP := [3, 7, 13, 20]
const MAGNET_DROP_CHANCE := 0.004

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

var rng := RandomNumberGenerator.new()
var player: Player
var enemies: Array[Enemy] = []
var pickups: Array[Pickup] = []
var spawner: Spawner
var upgrades: Upgrades
var city: City
var hud: Hud

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

	pickup_layer = _add_layer(-5)
	entity_layer = _add_layer(0)
	entity_layer.y_sort_enabled = true
	effect_layer = _add_layer(10)
	number_layer = _add_layer(20)
	entity_layer.add_child(player)
	add_child(city)

	upgrades = Upgrades.new(self)
	spawner = Spawner.new(self)
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


func _process(delta: float) -> void:
	if state != State.PLAYING:
		return
	elapsed += delta
	if elapsed >= RUN_SECONDS:
		_end_run(true)
		return
	spawner.tick(delta)
	_rebuild_grid()
	_tick_enemies(delta)
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
	enemy.position = at if enemy.ghostly else city.resolve(at, enemy.radius)
	entity_layer.add_child(enemy)
	enemies.append(enemy)
	return enemy


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


## A point just outside the visible screen in the given direction from the player.
func offscreen_point(direction: Vector2) -> Vector2:
	var half := view_half() + Vector2(SPAWN_MARGIN, SPAWN_MARGIN)
	var scale_x := half.x / absf(direction.x) if absf(direction.x) > 0.001 else INF
	var scale_y := half.y / absf(direction.y) if absf(direction.y) > 0.001 else INF
	var point := player.position + direction * minf(scale_x, scale_y)
	# Nothing walks out of the Bay: come from the land side instead.
	if city.is_water(point):
		point.x = player.position.x - (point.x - player.position.x)
	return point


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
	Sound.play("kill")
	Effects.poof(self, enemy.position, enemy.color)
	_drop_xp(enemy.position, enemy.xp_value)
	if not _star_hint_done:
		_star_hint_done = true
		Settings.set_value("star_hint_shown", true)
		announce("捡星星升级！走近就会自动吸过来")
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
		enemy.tick(delta, target, separation)
		if not enemy.ghostly:
			_keep_out_of_walls(enemy, target, delta)
		if enemy.position.distance_squared_to(target) > relocate_sq:
			var fresh_spot := offscreen_point(random_direction())
			enemy.position = fresh_spot if enemy.ghostly else city.resolve(fresh_spot, enemy.radius)


## Pushes an enemy out of buildings and the water. One pressed against a wall also slides along
## it toward the player's side, so crowds flow around buildings instead of piling up flat.
func _keep_out_of_walls(enemy: Enemy, target: Vector2, delta: float) -> void:
	var resolved := city.resolve(enemy.position, enemy.radius)
	var push := resolved - enemy.position
	if push.length_squared() > 0.0001:
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


func _check_player_contact() -> void:
	var strongest := 0.0
	for enemy in query_enemies(player.position, Player.HURT_RADIUS):
		strongest = maxf(strongest, enemy.damage)
	if strongest > 0.0:
		player.take_damage(strongest)


func _cell_of(point: Vector2) -> Vector2i:
	return Vector2i(floori(point.x / GRID_CELL), floori(point.y / GRID_CELL))


# --- Pickups & XP --------------------------------------------------------------------------

func _drop_xp(at: Vector2, value: int) -> void:
	if pickups.size() >= MAX_PICKUPS:
		# Fold the XP into an existing star instead of piling up nodes in long runs.
		for attempt in 8:
			var existing := pickups[rng.randi() % pickups.size()]
			if existing.kind == Pickup.Kind.XP:
				existing.add_value(value)
				return
	_drop(Pickup.Kind.XP, at, value)


func _drop(kind: Pickup.Kind, at: Vector2, value: int) -> void:
	var pickup := Pickup.new()
	pickup.setup(kind, value)
	pickup.position = at + Vector2(rng.randf_range(-3, 3), rng.randf_range(-3, 3))
	pickup_layer.add_child(pickup)
	pickups.append(pickup)


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
			# No sound of its own: the level-up it grants plays one straight away.
			queued_level_ups += 1
			announce("拿到融资！免费升级一次")
			_offer_level_up()
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
	current_choices = upgrades.roll_choices(3)
	state = State.LEVEL_UP
	get_tree().paused = true
	Sound.play("level_up")
	level_up_offered.emit(current_choices)


func choose_upgrade(index: int) -> void:
	if state != State.LEVEL_UP or index < 0 or index >= current_choices.size():
		return
	upgrades.apply(current_choices[index])
	queued_level_ups -= 1
	Sound.play("pick")
	state = State.PLAYING
	get_tree().paused = false
	inventory_changed.emit()
	# Several level-ups can be banked at once (big gems, chests); offer them back to back.
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
