class_name TrailWeapon
extends Weapon
## A line left behind wherever the player walks: enemies touching it are hurt every TICK seconds
## while it lasts, and standing still draws nothing. (Silicon Valley: 钢笔工具, the designer's pen
## tool.) 矢量图层 (evolved with 电动滑板): the line lasts twice as long, and closing a loop hits
## everything inside it once, hard.

## Enemies chase slower than the player runs, so the line has to last long enough for them to
## reach it: at 1.5 seconds (the first draft) the bot's designer killed 9 enemies in a minute.
const DAMAGE := [8.0, 10.0, 12.0, 14.0, 18.0]
const WIDTH := [12.0, 14.0, 16.0, 18.0, 26.0]
const LIFETIME := [2.5, 2.8, 3.1, 3.4, 4.0]
const TICK := 0.3
## A new point every this many pixels walked; under the narrowest line's width, so the circles
## hits are checked in leave no gaps.
const SPACING := 6.0
const LOOP_DAMAGE := 60.0
## The newest point this close to one at least LOOP_MIN_POINTS older closes a loop.
const LOOP_SNAP := 10.0
const LOOP_MIN_POINTS := 14
const COLOR := Color("ff8fa0")

var _points := PackedVector2Array()
var _born := PackedFloat32Array()
var _clock := 0.0
var _tick_left := 0.0


func _init() -> void:
	# On the ground under everyone, like the Wi-Fi field.
	z_index = -1


func _process(delta: float) -> void:
	_clock += delta
	var life: float = stat(LIFETIME) * (2.0 if evolved else 1.0)
	while not _born.is_empty() and _clock - _born[0] > life:
		_points.remove_at(0)
		_born.remove_at(0)
	var moving := player.velocity.length_squared() > 1.0
	if moving and (_points.is_empty() or player.position.distance_to(_points[_points.size() - 1]) >= SPACING):
		_points.append(player.position)
		_born.append(_clock)
		if evolved:
			_close_loop()
	_tick_left -= delta
	if _tick_left <= 0.0:
		_tick_left = TICK * player.cooldown_scale
		_hurt_along_line()
	queue_redraw()


func _hurt_along_line() -> void:
	var damage: float = stat(DAMAGE) * damage_scale()
	var half_width: float = stat(WIDTH) / 2.0
	var hit := {}
	for point in _points:
		for enemy in game.query_enemies(point, half_width):
			var key := enemy.get_instance_id()
			if hit.has(key):
				continue
			hit[key] = true
			game.damage_enemy(enemy, damage, Vector2.ZERO, id, true)


## Evolved: the newest point meeting an older one closes a loop; everything inside takes one
## heavy hit, and the loop's line is used up so it can't close again.
func _close_loop() -> void:
	var newest := _points[_points.size() - 1]
	for i in _points.size() - LOOP_MIN_POINTS:
		if _points[i].distance_to(newest) > LOOP_SNAP:
			continue
		var outline := _points.slice(i)
		var bounds := Rect2(outline[0], Vector2.ZERO)
		for point in outline:
			bounds = bounds.expand(point)
		var damage := LOOP_DAMAGE * damage_scale()
		for enemy in game.query_enemies(bounds.get_center(), bounds.size.length() / 2.0):
			if Geometry2D.is_point_in_polygon(enemy.position, outline):
				game.damage_enemy(enemy, damage, Vector2.ZERO, id)
		Effects.ring(game, bounds.get_center(), maxf(bounds.size.x, bounds.size.y) / 2.0, COLOR)
		_points = _points.slice(_points.size() - 1)
		_born = _born.slice(_born.size() - 1)
		return


func _draw() -> void:
	if _points.size() < 2:
		return
	var width: float = stat(WIDTH)
	var life: float = stat(LIFETIME) * (2.0 if evolved else 1.0)
	var line := PackedVector2Array()
	var fill := PackedColorArray()
	var edge := PackedColorArray()
	for i in _points.size():
		line.append(_points[i] - global_position)
		# Fades out over its last third.
		var fade := clampf((life - (_clock - _born[i])) / (life / 3.0), 0.0, 1.0)
		fill.append(Color(COLOR, 0.6 * fade))
		edge.append(Color(Art.INK, 0.5 * fade))
	draw_polyline_colors(line, edge, width + 3.0, true)
	draw_polyline_colors(line, fill, width, true)
