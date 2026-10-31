class_name ZoneWeapon
extends Weapon
## Meetings called where the crowd is thickest: for a few seconds everything inside the room
## walks slower and keeps taking damage. (Silicon Valley: 拉会.) Vampire Survivors' Santa Water,
## with a slow.

## Meetings running at once.
const COUNT := [1, 1, 2, 2, 3]
## Per tick, every TICK seconds. Halved from the first draft, which dealt 22-41% of all damage in
## the bot's full runs, whatever the job: an area that slows and hits everything in it.
const DAMAGE := [3.0, 4.0, 4.0, 5.0, 7.0]
const RADIUS := [36.0, 40.0, 44.0, 48.0, 54.0]
const LIFETIME := 3.0
## A room fades in over this long, and starts working once it has (.39: it used to slow and hurt
## from the first frame, while still almost invisible).
const FADE_IN := 1.0 / 6.0
const TICK := 0.5
## Speed left to an enemy inside (40% slower).
const SLOW := 0.6
const COOLDOWN := 4.0
## Spots sampled when looking for the thickest crowd.
const CANDIDATES := 10
const ICON_SIZE := 18.0
const COLOR := Color("5b9cff")


class Room:
	var center := Vector2.ZERO
	var life := LIFETIME
	var tick_left := 0.0


var _rooms: Array[Room] = []
var _floor: Node2D


func _ready() -> void:
	# Drawn on the ground in world space, under the crowd it holds.
	_floor = Node2D.new()
	_floor.z_index = -4
	_floor.draw.connect(_draw_rooms)
	game.add_child(_floor)


## The ground drawing lives on the game, not under the weapon: it goes with the weapon (a job
## switched on the title screen drops its weapon).
func _exit_tree() -> void:
	if is_instance_valid(_floor):
		_floor.queue_free()


func cooldown() -> float:
	return COOLDOWN


func fire() -> bool:
	var placed := false
	var radius: float = stat(RADIUS)
	while _rooms.size() < stat(COUNT):
		var spot: Variant = _busiest_spot(radius)
		if spot == null:
			break
		var room := Room.new()
		room.center = spot
		_rooms.append(room)
		placed = true
	return placed


func _process(delta: float) -> void:
	super(delta)
	var radius: float = stat(RADIUS)
	var damage: float = stat(DAMAGE) * damage_scale()
	for i in range(_rooms.size() - 1, -1, -1):
		var room := _rooms[i]
		room.life -= delta
		if room.life <= 0.0:
			_rooms.remove_at(i)
			continue
		if LIFETIME - room.life < FADE_IN:
			continue
		room.tick_left -= delta
		var tick := room.tick_left <= 0.0
		if tick:
			room.tick_left = TICK * player.cooldown_scale
		for enemy in game.query_enemies(room.center, radius):
			enemy.slow(SLOW, 0.15)
			if tick:
				game.damage_enemy(enemy, damage, Vector2.ZERO, id, true)
	_floor.queue_redraw()


## The on-screen spot with the most enemies within `radius`, away from rooms already open; null
## with nobody on screen.
func _busiest_spot(radius: float) -> Variant:
	var best: Variant = null
	var best_count := 0
	for enemy in game.random_visible_enemies(CANDIDATES):
		var taken := false
		for room in _rooms:
			if room.center.distance_to(enemy.position) < radius * 1.5:
				taken = true
				break
		if taken:
			continue
		var count := game.query_enemies(enemy.position, radius).size()
		if count > best_count:
			best_count = count
			best = enemy.position
	return best


func _draw_rooms() -> void:
	var radius: float = stat(RADIUS)
	var icon := Art.texture(art)
	for room in _rooms:
		# Fades in quickly and out over its last half second.
		var alpha := clampf(minf((LIFETIME - room.life) / FADE_IN, room.life * 2.0), 0.0, 1.0)
		_floor.draw_circle(room.center, radius, Color(COLOR, 0.16 * alpha))
		_floor.draw_arc(room.center, radius, 0.0, TAU, 48, Color(Art.INK, 0.6 * alpha), 2.0, true)
		var icon_rect := Rect2(room.center - Vector2(ICON_SIZE, ICON_SIZE) / 2.0, Vector2(ICON_SIZE, ICON_SIZE))
		_floor.draw_texture_rect(icon, icon_rect, false, Color(1, 1, 1, 0.8 * alpha))
