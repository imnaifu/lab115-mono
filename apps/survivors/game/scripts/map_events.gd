class_name MapEvents
extends Node2D
## Each map's own event (the map's MAP_EVENT, which the Spawner starts at its time, .26):
## - "quake" (硅谷 湾区地震): for a while debris crashes down round the player (the screen shook all
##   the while until .34; the user found it hard on the eyes, so it no longer does),
##   each piece marked by a red circle a moment before it lands; it hurts whatever it lands on,
##   the crowd included, so dodging it can clear the way.
## - "sandstorm" (北京 沙尘暴): for a while a wind blows everyone east, the player, the crowd and the
##   bosses alike (.92, the user: 改成对用户和怪一样的影响; the crowd 40 and the bosses 20 before,
##   against the player's 28), and the screen turns sandy.
## - "rain" (西雅图 下雨, .34): for a while it rains, and puddles open up round the player; anyone
##   standing in one is slowed, the player, the crowd and the bosses alike (.92; the crowd walked at
##   50% and the bosses at 75% before, the player at 65%), so leading the crowd through them still
##   pays. They dry up a few seconds after the rain stops.
## - "fog" (伦敦 大雾, .37): for a while a fog rolls in; only a ring round the player stays clear,
##   and the crowd, as lost in it as the player, walks slower. Since .88 (the user: 大雾没什么用;
##   picked 雾真的挡住) the fog hides what is in it, the crowd showing only as blurred shadows,
##   and it lies under a boss's red warnings, which stay in full view; until then it only paled
##   everything over (0.82) from 100 out, so it changed little.
## - "heat" (新加坡 热浪, .38): for a while it's sweltering, and patches of scorching tarmac open
##   up all over the map at once, laid at random each run and staying put, each warming up for a
##   moment (shown, harmless) before it burns whoever stands on it, the player and the crowd
##   alike, until the heat ends (the user: 发热地面不会消失，直到热浪结束; 不是身边，是全图固定;
##   about six a screen, random each run), so leading the crowd over them pays. .92 (the
##   user: 热浪重新设计; picked 烫脚的地面): until then the player alone lost health anywhere
##   outside a few cool air-conditioned spots that moved on every few seconds, and the crowd was
##   untouched.
## Drawn in the world over the enemies (the debris, the sand, the rain), under the HUD; puddles
## and cool spots on the ground under everyone.

const QUAKE_STRIKE_GAP := 0.35
const QUAKE_WARNING := 1.0
const QUAKE_RADIUS := 26.0
## Debris lands within this of the player.
const QUAKE_REACH := 220.0
const QUAKE_DAMAGE := 12.0
const QUAKE_CROWD_DAMAGE := 40.0
const QUAKE_DROP := 120.0
const SAND_WIND := Vector2(0.99, 0.14)
## Pixels per second: the player is blown less than they walk (56-71).
## Everyone alike since .92.
const SAND_SPEED := 28.0
const SAND_TINT := Color(0.86, 0.72, 0.42, 0.3)
const RAIN_PUDDLE_GAP := 0.45
## Puddles open within this of the player, at most RAIN_MAX_PUDDLES at once (the oldest goes).
const RAIN_REACH := 230.0
const RAIN_PUDDLE_RADIUS := [26.0, 42.0]
const RAIN_MAX_PUDDLES := 18
## Seconds a new puddle takes to spread, and puddles take to dry once the rain stops.
const RAIN_SPREAD := 0.6
const RAIN_DRY := 3.0
## In a puddle: the player loses this share of their walking speed; the crowd walks at this
## share of theirs (bosses shrug off half of it, Enemy.slow).
## The share of speed a puddle takes, from everyone alike since .92. 0.2 since .99 (the user:
## 下雨的减速太多了，不用减速那么多; 0.35 until then).
const RAIN_SLOW := 0.2
const RAIN_TINT := Color(0.32, 0.42, 0.58, 0.22)
## The fog: clear within FOG_CLEAR of the player, thickening over FOG_SOFT to FOG_ALPHA beyond;
## the crowd walks at FOG_CROWD_SLOW of its speed while it lasts (bosses shrug off half, Enemy.slow).
const FOG_CLEAR := 80.0
const FOG_SOFT := 60.0
const FOG_ALPHA := 0.97
## A shadow for each enemy in the fog, its body this much wider, this dark at most.
const FOG_SHADOW_SCALE := 1.6
const FOG_SHADOW_ALPHA := 0.35
const FOG_COLOR := Color(0.8, 0.82, 0.85)
const FOG_CROWD_SLOW := 0.75
## Seconds the fog takes to roll in and to lift.
const FOG_FADE := 1.5
## The heat: as it starts, hot patches (radius HEAT_PATCH_RADIUS) are laid at random over the whole
## map, HEAT_PER_SCREEN to every HEAT_SCREEN of it; they warm up for HEAT_WARM (drawn, harmless:
## time to step off) and then burn until the heat ends, all fading together over HEAT_FADE after.
## While it burns, everyone on it loses HEAT_DAMAGE every HEAT_TICK: the player times the map's damage, less armour,
## like any hit; the crowd and the bosses the same amount (not in the damage ranking).
const HEAT_PATCH_RADIUS := [30.0, 45.0]
## About six on a landscape screen (the viewport, 640 by 360): some 340 over a 3600 map, about a
## third of the ground.
const HEAT_PER_SCREEN := 6.0
const HEAT_SCREEN := Vector2(640.0, 360.0)
const HEAT_WARM := 0.8
const HEAT_FADE := 0.5
const HEAT_TICK := 0.5
const HEAT_DAMAGE := 3.0
const HEAT_ORANGE := Color("ff8a3d")
const HEAT_TINT := Color(1.0, 0.55, 0.2, 0.16)
const PUDDLE := Color("7fa8c9")
const DEBRIS := Color("8a909c")

var game: Game

var _id := ""
var _left := 0.0
var _seconds := 0.0
## Debris on its way down: where it lands, seconds until it does.
var _strikes: Array[Vector2] = []
var _strike_left := PackedFloat32Array()
var _next_strike := 0.0
var _clock := 0.0
## Puddles: where, full size, and age (negative once drying: seconds left).
var _puddles: Array[Vector2] = []
var _puddle_radius := PackedFloat32Array()
var _puddle_age := PackedFloat32Array()
var _next_puddle := 0.0
## Hot patches in the heat: where, how big, how long each has been open; the next burn tick.
var _hot_patches: Array[Vector2] = []
var _hot_radius: Array[float] = []
var _hot_age: Array[float] = []
var _heat_tick := 0.0
## The puddles are drawn on the ground, under the crowd, unlike the rest of this node.
var _ground: Node2D
## The fog, over the crowd but under a boss's warnings (Enemy.TELEGRAPH_Z), so hiding the crowd
## never hides what is about to hit the player.
var _fog: Node2D


func _init() -> void:
	# Over the entities and the hit effects, under the damage numbers.
	z_index = 15
	_ground = Node2D.new()
	# Relative to this node's 15: -4 overall, on the ground like a meeting room.
	_ground.z_index = -19
	_ground.draw.connect(_draw_ground)
	add_child(_ground)
	_fog = Node2D.new()
	# Relative to this node's 15: just under the warnings overall.
	_fog.z_index = Enemy.TELEGRAPH_Z - 1 - z_index
	_fog.draw.connect(_draw_fog_layer)
	add_child(_fog)


## Starts the map's event `id`, lasting `seconds`.
func start(id: String, seconds: float) -> void:
	_id = id
	_left = seconds
	_seconds = seconds
	_next_strike = 0.0
	_heat_tick = HEAT_TICK
	_hot_patches.clear()
	_hot_radius.clear()
	_hot_age.clear()


## Seconds the weather itself has left (0 once over, even while debris or puddles linger): the
## HUD keeps the event's name on screen this long.
func weather_left() -> float:
	return maxf(_left, 0.0)


func active() -> bool:
	return _left > 0.0 or not _strikes.is_empty() or not _puddles.is_empty() or not _hot_patches.is_empty()


func _process(delta: float) -> void:
	if game.state != Game.State.PLAYING or not active():
		if not active():
			queue_redraw()
			# Clears the last puddles off the ground once the event is over, and the last of the fog.
			_ground.queue_redraw()
			_fog.queue_redraw()
		return
	_clock += delta
	_left -= delta
	match _id:
		"quake":
			_tick_quake(delta)
		"sandstorm":
			if _left > 0.0:
				_blow(delta)
		"rain":
			_tick_rain(delta)
			_ground.queue_redraw()
		"fog":
			if _left > 0.0:
				for enemy in game.enemies:
					if not enemy.dead:
						enemy.slow(FOG_CROWD_SLOW, 0.2)
			# Every frame, and once more after it lifts so the last of it is wiped.
			_fog.queue_redraw()
		"heat":
			_tick_heat(delta)
			_ground.queue_redraw()
	queue_redraw()


func _tick_quake(delta: float) -> void:
	if _left > 0.0:
		_next_strike -= delta
		if _next_strike <= 0.0:
			_next_strike = QUAKE_STRIKE_GAP
			var offset := Vector2.from_angle(game.rng.randf() * TAU) * sqrt(game.rng.randf()) * QUAKE_REACH
			var at := game.player.position + offset
			if not game.city.is_water(at):
				_strikes.append(at)
				_strike_left.append(QUAKE_WARNING)
	for i in range(_strikes.size() - 1, -1, -1):
		_strike_left[i] -= delta
		if _strike_left[i] <= 0.0:
			_land(_strikes[i])
			_strikes.remove_at(i)
			_strike_left.remove_at(i)


func _land(at: Vector2) -> void:
	Effects.poof(game, at, DEBRIS)
	Effects.dust(game, at, Vector2.UP)
	if game.player.position.distance_to(at) <= QUAKE_RADIUS + Player.HURT_RADIUS:
		game.hurt_player(QUAKE_DAMAGE * Maps.difficulty("damage"), "quake_debris", "debris")
	for enemy in game.query_enemies(at, QUAKE_RADIUS):
		game.damage_enemy(enemy, QUAKE_CROWD_DAMAGE, (enemy.position - at).normalized() * 60.0, "quake_debris", true)


func _tick_rain(delta: float) -> void:
	if _left > 0.0:
		_next_puddle -= delta
		if _next_puddle <= 0.0:
			_next_puddle = RAIN_PUDDLE_GAP
			var at := game.player.position + Vector2.from_angle(game.rng.randf() * TAU) * sqrt(game.rng.randf()) * RAIN_REACH
			if not game.city.is_water(at):
				if _puddles.size() >= RAIN_MAX_PUDDLES:
					_puddles.remove_at(0)
					_puddle_radius.remove_at(0)
					_puddle_age.remove_at(0)
				_puddles.append(at)
				_puddle_radius.append(game.rng.randf_range(RAIN_PUDDLE_RADIUS[0], RAIN_PUDDLE_RADIUS[1]))
				_puddle_age.append(0.0)
	for i in range(_puddles.size() - 1, -1, -1):
		if _left > 0.0:
			_puddle_age[i] += delta
		else:
			# Rain over: each starts drying (a countdown, kept negative), then goes.
			_puddle_age[i] = -RAIN_DRY if _puddle_age[i] >= 0.0 else _puddle_age[i] + delta
			if _puddle_age[i] >= 0.0:
				_puddles.remove_at(i)
				_puddle_radius.remove_at(i)
				_puddle_age.remove_at(i)
				continue
		var reach := _puddle_reach(i)
		if game.player.position.distance_to(_puddles[i]) <= reach:
			game.player.drift(-game.player.velocity * RAIN_SLOW)
		for enemy in game.query_enemies(_puddles[i], reach, false):
			enemy.slow(1.0 - RAIN_SLOW, 0.2, true)


## The heat: hot patches laid over the whole map as it starts, each warming up and then burning
## until the heat ends; every HEAT_TICK whoever stands on a burning one is hurt. After the heat they
## fade out together over HEAT_FADE (_left runs on below 0 while the event is still active).
func _tick_heat(delta: float) -> void:
	for i in _hot_patches.size():
		_hot_age[i] += delta
	if _left <= -HEAT_FADE:
		_hot_patches.clear()
		_hot_radius.clear()
		_hot_age.clear()
		return
	if _left > 0.0 and _hot_patches.is_empty():
		_lay_hot_patches()
	_heat_tick -= delta
	if _heat_tick > 0.0:
		return
	_heat_tick = HEAT_TICK
	var player_burnt := false
	# Each enemy once a tick, however many burning patches it stands on.
	var burnt := {}
	for i in _hot_patches.size():
		if not _burning(i):
			continue
		if not player_burnt and game.player.position.distance_to(_hot_patches[i]) <= _hot_radius[i] + Player.HURT_RADIUS:
			player_burnt = true
		for enemy in game.query_enemies(_hot_patches[i], _hot_radius[i], false):
			if burnt.has(enemy.get_instance_id()):
				continue
			burnt[enemy.get_instance_id()] = true
			game.damage_enemy(enemy, HEAT_DAMAGE, Vector2.ZERO, "quake_debris")
	if player_burnt:
		game.hurt_player(HEAT_DAMAGE * Maps.difficulty("damage"), "heat", "heat")


## The heat's patches, at random over the map's land (Maps.current.BOUNDS), all at once.
func _lay_hot_patches() -> void:
	var bounds: Rect2 = Maps.current.BOUNDS
	var count := roundi(bounds.get_area() / (HEAT_SCREEN.x * HEAT_SCREEN.y) * HEAT_PER_SCREEN)
	for n in count:
		var at := bounds.get_center()
		# A few tries for a spot on land.
		for attempt in 8:
			at = bounds.position + Vector2(game.rng.randf(), game.rng.randf()) * bounds.size
			if not game.city.is_water(at):
				break
		_hot_patches.append(at)
		_hot_radius.append(game.rng.randf_range(HEAT_PATCH_RADIUS[0], HEAT_PATCH_RADIUS[1]))
		_hot_age.append(0.0)


## Whether hot patch `index` burns now: past its warming up, and the heat not over.
func _burning(index: int) -> bool:
	return _hot_age[index] >= HEAT_WARM and _left > 0.0


## A puddle's size now: spreading when new, shrinking as it dries.
func _puddle_reach(index: int) -> float:
	var age := _puddle_age[index]
	var scale := clampf(age / RAIN_SPREAD, 0.0, 1.0) if age >= 0.0 else clampf(-age / RAIN_DRY, 0.0, 1.0)
	return _puddle_radius[index] * scale


func _draw_ground() -> void:
	_draw_hot_patches()
	_draw_puddles()


## The hot patches: squashed like the puddles, lying on the ground. Warming up, a dashed orange
## ring filling in (harmless); burning, glowing orange-red with heat wavering off it; then fading.
func _draw_hot_patches() -> void:
	# Only those on screen: there are hundreds over the map.
	var half := game.view_half() + Vector2.ONE * HEAT_PATCH_RADIUS[1]
	var view := Rect2(game.player.position - half, half * 2.0)
	for i in _hot_patches.size():
		if not view.has_point(_hot_patches[i]):
			continue
		var age := _hot_age[i]
		var radius := _hot_radius[i]
		_ground.draw_set_transform(_hot_patches[i], 0.0, Vector2(1.0, 0.62))
		if age < HEAT_WARM:
			var warm := age / HEAT_WARM
			_ground.draw_circle(Vector2.ZERO, radius * warm, Color(HEAT_ORANGE, 0.18))
			for dash in 12:
				var from := TAU * dash / 12.0
				_ground.draw_arc(Vector2.ZERO, radius, from, from + 0.3, 4, Color(HEAT_ORANGE, 0.9), 2.0, true)
		else:
			# Full while the heat lasts, fading out after it.
			var strength := clampf((HEAT_FADE + _left) / HEAT_FADE, 0.0, 1.0)
			var flicker := 0.85 + 0.15 * sin(_clock * 9.0 + i)
			_ground.draw_circle(Vector2.ZERO, radius, Color(Art.BOSS_RED.lerp(HEAT_ORANGE, 0.5), 0.45 * strength * flicker))
			_ground.draw_circle(Vector2.ZERO, radius * 0.6, Color(HEAT_ORANGE.lightened(0.3), 0.5 * strength * flicker))
			_ground.draw_arc(Vector2.ZERO, radius, 0.0, TAU, 40, Color(Art.BOSS_RED, 0.8 * strength), 2.0, true)
		_ground.draw_set_transform(Vector2.ZERO)


func _draw_puddles() -> void:
	for i in _puddles.size():
		var reach := _puddle_reach(i)
		if reach <= 1.0:
			continue
		var at := _puddles[i]
		_ground.draw_set_transform(at, 0.0, Vector2(1.0, 0.62))
		_ground.draw_circle(Vector2.ZERO, reach, Color(PUDDLE, 0.55))
		_ground.draw_arc(Vector2.ZERO, reach, 0.0, TAU, 32, Color(PUDDLE.darkened(0.25), 0.8), 1.5, true)
		# Rings spreading where drops land.
		if _left > 0.0:
			var ripple := fposmod(_clock * 0.8 + float(i) * 0.37, 1.0)
			_ground.draw_arc(Vector2(reach * 0.3, 0.0), reach * 0.5 * ripple, 0.0, TAU, 20, Color(1, 1, 1, 0.6 * (1.0 - ripple)), 1.2, true)
	_ground.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)


## The wind: everyone carried alike (.92; the crowd more and the bosses half as much before).
func _blow(delta: float) -> void:
	var wind := SAND_WIND.normalized()
	game.player.drift(wind * SAND_SPEED)
	for enemy in game.enemies:
		if not enemy.dead:
			enemy.position += wind * SAND_SPEED * delta


func _draw() -> void:
	if not active():
		return
	match _id:
		"quake":
			for i in _strikes.size():
				var progress := 1.0 - _strike_left[i] / QUAKE_WARNING
				var at := _strikes[i]
				draw_circle(at, QUAKE_RADIUS, Color(Art.BOSS_RED, 0.1 + 0.15 * progress))
				draw_arc(at, QUAKE_RADIUS, 0.0, TAU, 32, Color(Art.BOSS_RED, 0.8), 1.5, true)
				# The chunk falling onto its circle, its shadow growing under it.
				draw_circle(at, QUAKE_RADIUS * 0.6 * progress, Color(Art.INK, 0.15))
				var chunk := at + Vector2(0.0, -QUAKE_DROP * (1.0 - progress * progress))
				var rock := PackedVector2Array([chunk + Vector2(-9, -4), chunk + Vector2(-3, -10), chunk + Vector2(8, -7),
					chunk + Vector2(10, 3), chunk + Vector2(2, 9), chunk + Vector2(-8, 6)])
				draw_colored_polygon(rock, DEBRIS)
				rock.append(rock[0])
				draw_polyline(rock, Art.INK, 2.0, true)
		"sandstorm":
			if _left <= 0.0:
				return
			# Fades in and out over a second at either end.
			var strength := clampf(minf(_left, _seconds - _left), 0.0, 1.0)
			var half := game.view_half() * 1.6
			var view := Rect2(game.player.position - half, half * 2.0)
			draw_rect(view, Color(SAND_TINT, SAND_TINT.a * strength))
			# Streaks of sand racing along the wind.
			var wind := SAND_WIND.normalized()
			for i in 40:
				var scatter := float(i) * 37.13
				var x := fposmod(scatter * 53.7 + _clock * 260.0, view.size.x)
				var y := fposmod(scatter * 91.3 + _clock * 30.0, view.size.y)
				var from := view.position + Vector2(x, y)
				draw_line(from, from + wind * 18.0, Color(0.95, 0.85, 0.6, 0.6 * strength), 1.5, true)
		"fog":
			# On its own layer (_fog), redrawn from _process.
			pass
		"heat":
			if _left <= 0.0:
				return
			# A warm wash over the screen and shimmer rising off the ground.
			var strength := clampf(minf(_left, _seconds - _left), 0.0, 1.0)
			var half := game.view_half() * 1.6
			var view := Rect2(game.player.position - half, half * 2.0)
			draw_rect(view, Color(HEAT_TINT, HEAT_TINT.a * strength))
			for i in 24:
				var scatter := float(i) * 33.7
				var x := fposmod(scatter * 47.1, view.size.x)
				var y := fposmod(scatter * 77.3 - _clock * 40.0, view.size.y)
				var from := view.position + Vector2(x, y)
				var wave := PackedVector2Array()
				for step in 6:
					wave.append(from + Vector2(sin(_clock * 3.0 + step + i) * 3.0, -step * 5.0))
				draw_polyline(wave, Color(1.0, 0.85, 0.6, 0.45 * strength), 1.5, true)
		"rain":
			if _left <= 0.0:
				return
			var strength := clampf(minf(_left, _seconds - _left), 0.0, 1.0)
			var half := game.view_half() * 1.6
			var view := Rect2(game.player.position - half, half * 2.0)
			draw_rect(view, Color(RAIN_TINT, RAIN_TINT.a * strength))
			# Rain slanting down.
			var fall := Vector2(-0.25, 1.0).normalized()
			for i in 70:
				var scatter := float(i) * 29.71
				var x := fposmod(scatter * 61.3 - _clock * 90.0, view.size.x)
				var y := fposmod(scatter * 83.9 + _clock * 520.0, view.size.y)
				var from := view.position + Vector2(x, y)
				draw_line(from, from + fall * 12.0, Color(0.85, 0.92, 1.0, 0.55 * strength), 1.2, true)


func _draw_fog_layer() -> void:
	if _id != "fog" or _left <= 0.0:
		return
	_draw_fog(clampf(minf(_left, _seconds - _left) / FOG_FADE, 0.0, 1.0))


## The fog over everything but a ring round the player: clear inside FOG_CLEAR, thickening across
## FOG_SOFT, then even out past the edges of the screen; a few slow wisps drifting through it.
## `strength` fades it in and out.
func _draw_fog(strength: float) -> void:
	var center := game.player.position
	var far := game.view_half().length() * 1.3
	var clear := Color(FOG_COLOR, 0.0)
	var thick := Color(FOG_COLOR, FOG_ALPHA * strength)
	var steps := 48
	for i in steps:
		var from := Vector2.from_angle(TAU * i / steps)
		var to := Vector2.from_angle(TAU * (i + 1) / steps)
		var inner := FOG_CLEAR
		var middle := FOG_CLEAR + FOG_SOFT
		_fog.draw_polygon(PackedVector2Array([center + from * inner, center + to * inner, center + to * middle, center + from * middle]),
			PackedColorArray([clear, clear, thick, thick]))
		_fog.draw_colored_polygon(PackedVector2Array([center + from * middle, center + to * middle, center + to * far, center + from * far]), thick)
	# Wisps: long pale strokes drifting east, in the thick of it.
	var half := game.view_half() * 1.2
	var view := Rect2(center - half, half * 2.0)
	for i in 14:
		var scatter := float(i) * 41.7
		var x := fposmod(scatter * 37.3 + _clock * 18.0, view.size.x)
		var y := fposmod(scatter * 71.9, view.size.y)
		var from := view.position + Vector2(x, y)
		if from.distance_to(center) < FOG_CLEAR + FOG_SOFT * 0.5:
			continue
		_fog.draw_line(from, from + Vector2(46.0, 0.0), Color(1, 1, 1, 0.45 * strength), 5.0, true)
	# The crowd in the fog: only a blurred shadow where each one is, darker the deeper in.
	for enemy in game.query_enemies(center, far, false):
		var distance := enemy.position.distance_to(center)
		var depth := clampf((distance - FOG_CLEAR) / FOG_SOFT, 0.0, 1.0)
		if depth <= 0.0:
			continue
		var shadow := Color(0.25, 0.27, 0.3, FOG_SHADOW_ALPHA * depth * strength)
		var reach := enemy.radius * FOG_SHADOW_SCALE
		_fog.draw_circle(enemy.position, reach, shadow)
		_fog.draw_circle(enemy.position, reach * 0.6, shadow)
