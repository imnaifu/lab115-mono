class_name FlowField
extends RefCounted
## Which way to walk around the buildings to reach the player.
##
## A square of CELL-sized cells centred on the player is flooded outward from the player's
## cell (breadth-first, four directions), so every reachable cell knows how many steps it is
## from the player going around walls. Where that count equals the plain grid distance, a
## straight walk gets there and the field stays out of the way; where it is longer, something
## is in between, and heading() points down the steps instead, around the building.
##
## The flood is rebuilt a few times a second and spread over several frames (BUILD_BUDGET
## cells each), so no frame pays for all of it; lookups use the last finished flood.

const CELL := 16.0
## Cells per side. 72 * 16 = 1152 px: a little over the circle enemies are kept within
## (Game.RELOCATE_DISTANCE is 560 from the player).
const SPAN := 72
## Walls are padded by this when marking cells blocked, so a cell is open only where an
## ordinary enemy fits. Bosses are a little wider, and lean on wall sliding for the rest.
const CLEARANCE := 7.0
const REBUILD_SECONDS := 0.25
const BUILD_BUDGET := 2000
const UNREACHED := 1 << 30
## A route this many steps longer than the plain grid distance means a wall is in the way.
const DETOUR_SLACK := 1

const NEIGHBOURS := [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1),
	Vector2i(1, 1), Vector2i(1, -1), Vector2i(-1, 1), Vector2i(-1, -1)]

var _city: City
## The finished flood that lookups read.
var _steps := PackedInt32Array()
var _origin := Vector2i.ZERO
var _target_cell := Vector2i.ZERO
var _has_field := false
## The flood being built.
var _next_steps := PackedInt32Array()
var _next_blocked := PackedByteArray()
var _next_origin := Vector2i.ZERO
var _next_target_cell := Vector2i.ZERO
var _queue := PackedInt32Array()
var _queue_head := 0
var _queue_tail := 0
var _building := false
var _since_build := INF


func _init(city: City) -> void:
	_city = city
	_steps.resize(SPAN * SPAN)
	_next_steps.resize(SPAN * SPAN)
	_next_blocked.resize(SPAN * SPAN)


func update(delta: float, target: Vector2) -> void:
	_since_build += delta
	if not _building and _since_build >= REBUILD_SECONDS:
		_since_build = 0.0
		_start_build(target)
	if _building:
		_continue_build()


## The way to walk from `from` around whatever stands between it and the player, or ZERO when
## walking straight is fine (or `from` is outside the field). `keep_going` skips the
## straight-is-fine check, for a body already on its way round (see Game.DETOUR_HOLD_SECONDS).
func heading(from: Vector2, keep_going := false) -> Vector2:
	if not _has_field:
		return Vector2.ZERO
	var cell := Vector2i((from / CELL).floor())
	var local := cell - _origin
	if local.x < 1 or local.y < 1 or local.x >= SPAN - 1 or local.y >= SPAN - 1:
		return Vector2.ZERO
	# Most enemies most of the time have nothing in the way: answer those from their own cell
	# without looking at the neighbours, since this runs for every enemy every frame.
	var straight := absi(cell.x - _target_cell.x) + absi(cell.y - _target_cell.y)
	var own_steps := _steps[local.y * SPAN + local.x]
	if not keep_going and own_steps <= straight + DETOUR_SLACK:
		return Vector2.ZERO
	# A body pressed against a wall can sit in a padded (blocked) cell with no count of its own;
	# its best neighbour's count plus one stands in.
	var best := Vector2i.ZERO
	var best_steps := UNREACHED
	for offset: Vector2i in NEIGHBOURS:
		var neighbour := local + offset
		var neighbour_steps := _steps[neighbour.y * SPAN + neighbour.x]
		# A diagonal step only when both cells beside it are open, so nothing cuts a corner.
		if offset.x != 0 and offset.y != 0 and (_steps[local.y * SPAN + neighbour.x] == UNREACHED \
				or _steps[neighbour.y * SPAN + local.x] == UNREACHED):
			continue
		if neighbour_steps < best_steps:
			best_steps = neighbour_steps
			best = neighbour
	if best_steps == UNREACHED:
		return Vector2.ZERO
	if not keep_going and mini(own_steps, best_steps + 1) <= straight + DETOUR_SLACK:
		return Vector2.ZERO
	var toward := (Vector2(best + _origin) + Vector2(0.5, 0.5)) * CELL
	return (toward - from).normalized()


func _start_build(target: Vector2) -> void:
	_next_target_cell = Vector2i((target / CELL).floor())
	_next_origin = _next_target_cell - Vector2i(SPAN / 2, SPAN / 2)
	_next_steps.fill(UNREACHED)
	_next_blocked.fill(0)
	var area := Rect2(Vector2(_next_origin) * CELL, Vector2(SPAN, SPAN) * CELL)
	for solid: Rect2 in _city.solids_in(area.grow(CLEARANCE)):
		_mark_blocked(solid.grow(CLEARANCE))
	# The water round the peninsula is a wall too.
	for water: Rect2 in BayArea.water_rects(area.grow(CLEARANCE)):
		_mark_blocked(water.grow(CLEARANCE))
	# The outer ring stays blocked, which saves a bounds check per step of the flood.
	for i in SPAN:
		_next_blocked[i] = 1
		_next_blocked[(SPAN - 1) * SPAN + i] = 1
		_next_blocked[i * SPAN] = 1
		_next_blocked[i * SPAN + SPAN - 1] = 1
	var start := (_next_target_cell.y - _next_origin.y) * SPAN + (_next_target_cell.x - _next_origin.x)
	# The player's own cell counts as open even when padding covers it (standing by a wall).
	_next_blocked[start] = 0
	_next_steps[start] = 0
	_queue.resize(SPAN * SPAN)
	_queue[0] = start
	_queue_head = 0
	_queue_tail = 1
	_building = true


func _continue_build() -> void:
	var processed := 0
	while _queue_head < _queue_tail and processed < BUILD_BUDGET:
		var index := _queue[_queue_head]
		_queue_head += 1
		processed += 1
		var next_step := _next_steps[index] + 1
		# Spelled out rather than looped over an array: this is the hot loop of the flood.
		_visit(index + 1, next_step)
		_visit(index - 1, next_step)
		_visit(index + SPAN, next_step)
		_visit(index - SPAN, next_step)
	if _queue_head < _queue_tail:
		return
	# Done: swap the finished flood in for lookups.
	var finished := _steps
	_steps = _next_steps
	_next_steps = finished
	_origin = _next_origin
	_target_cell = _next_target_cell
	_has_field = true
	_building = false


func _visit(index: int, steps: int) -> void:
	if _next_blocked[index] == 0 and _next_steps[index] == UNREACHED:
		_next_steps[index] = steps
		_queue[_queue_tail] = index
		_queue_tail += 1


func _mark_blocked(rect: Rect2) -> void:
	# Cells whose centre lies inside the padded rect.
	var first := Vector2i(((rect.position / CELL) - Vector2(0.5, 0.5)).ceil()) - _next_origin
	var last := Vector2i(((rect.end / CELL) - Vector2(0.5, 0.5)).floor()) - _next_origin
	for row in range(maxi(first.y, 0), mini(last.y, SPAN - 1) + 1):
		for column in range(maxi(first.x, 0), mini(last.x, SPAN - 1) + 1):
			_next_blocked[row * SPAN + column] = 1
