class_name BomberWeapon
extends Weapon
## Drones that fly out over the thickest crowd on screen, drop a bomb on it (its shadow shows where
## it lands) and fly on to the next; they never ram anything. (Silicon Valley: 无人机.) Vampire
## Survivors' Peachone and Ebony Wings, birds dropping bombs. They used to chase enemies and ram
## them, which the ops' guard wall and the outsourced workers did too. 集束轰炸 (evolved with
## 降本增效): every bomb throws out three smaller ones round where it lands.

const COUNT := [1, 2, 2, 3, 4]
const DAMAGE := [16.0, 16.0, 22.0, 22.0, 28.0]
const BLAST_RADIUS := [26.0, 26.0, 30.0, 30.0, 36.0]
const SPEED := 180.0
## Seconds between one drone's bombs, before the player's cooldown multiplier.
const RELOAD := 1.6
const FALL_SECONDS := 0.35
const PUSH := 60.0
## Spots sampled when looking for the thickest crowd.
const CANDIDATES := 8
const HOVER_RADIUS := 22.0
const SIZE := 18.0
const EVOLVED_BOMBLETS := 3
const BOMBLET_SPREAD := 34.0
const BOMBLET_SHARE := 0.5
const SHADOW := Color(0.18, 0.2, 0.26)


class Drone:
	var sprite: Sprite2D
	var position := Vector2.ZERO
	## Where it is flying to drop its bomb, or null while it reloads by the player.
	var goal: Variant = null
	var reload_left := 0.0


class Bomb:
	var at := Vector2.ZERO
	var fall_left := FALL_SECONDS
	var damage := 0.0
	var radius := 0.0
	## Bomblets thrown out by an evolved bomb, which throw out none of their own.
	var small := false


var _drones: Array[Drone] = []
var _bombs: Array[Bomb] = []
var _clock := 0.0
var _floor: Node2D


func _init() -> void:
	# Above the enemies.
	z_index = 5


func _ready() -> void:
	# The bombs' shadows, on the ground in world space under the crowd.
	_floor = Node2D.new()
	_floor.z_index = -3
	_floor.draw.connect(_draw_shadows)
	game.add_child(_floor)


## The shadows live on the game, not under the weapon: they go with it.
func _exit_tree() -> void:
	if is_instance_valid(_floor):
		_floor.queue_free()


func _process(delta: float) -> void:
	_clock += delta
	while _drones.size() < stat(COUNT):
		var drone := Drone.new()
		drone.position = player.position
		drone.sprite = Art.sprite(art, SIZE)
		# Drones fly in world space; the weapon rides along on the player.
		drone.sprite.top_level = true
		drone.sprite.z_index = z_index
		add_child(drone.sprite)
		_drones.append(drone)
	var radius: float = stat(BLAST_RADIUS)
	for i in _drones.size():
		var drone := _drones[i]
		drone.reload_left -= delta
		if drone.goal == null and drone.reload_left <= 0.0:
			drone.goal = _busiest_spot(radius)
		var hover := player.position + Vector2.from_angle(_clock * 1.5 + TAU * i / _drones.size()) * HOVER_RADIUS + Vector2(0, -6)
		var heading: Vector2 = hover if drone.goal == null else drone.goal
		drone.position = drone.position.move_toward(heading, SPEED * delta)
		if drone.goal != null and drone.position.distance_to(drone.goal as Vector2) < 2.0:
			_drop(drone.goal, stat(DAMAGE) * damage_scale(), radius, false)
			drone.goal = null
			drone.reload_left = RELOAD * player.cooldown_scale
		drone.sprite.position = drone.position + Vector2(0, sin(_clock * 8.0 + i) * 1.5)
	for i in range(_bombs.size() - 1, -1, -1):
		var bomb := _bombs[i]
		bomb.fall_left -= delta
		if bomb.fall_left <= 0.0:
			_bombs.remove_at(i)
			_blast(bomb)
	_floor.queue_redraw()


func _drop(at: Vector2, damage: float, radius: float, small: bool) -> void:
	var bomb := Bomb.new()
	bomb.at = at
	bomb.damage = damage
	bomb.radius = radius
	bomb.small = small
	_bombs.append(bomb)


func _blast(bomb: Bomb) -> void:
	Effects.ring(game, bomb.at, bomb.radius, Art.YELLOW)
	Effects.poof(game, bomb.at, Art.YELLOW)
	for enemy in game.query_enemies(bomb.at, bomb.radius):
		game.damage_enemy(enemy, bomb.damage, (enemy.position - bomb.at).normalized() * PUSH, id, true)
	if evolved and not bomb.small:
		for k in EVOLVED_BOMBLETS:
			var offset := Vector2.from_angle(TAU * k / EVOLVED_BOMBLETS + _clock) * BOMBLET_SPREAD
			_drop(bomb.at + offset, bomb.damage * BOMBLET_SHARE, bomb.radius * 0.7, true)


## The on-screen spot with the most enemies within `radius`, clear of where the other drones are
## headed; null with nobody on screen.
func _busiest_spot(radius: float) -> Variant:
	var best: Variant = null
	var best_count := 0
	for enemy in game.random_visible_enemies(CANDIDATES):
		var taken := false
		for other in _drones:
			if other.goal != null and (other.goal as Vector2).distance_to(enemy.position) < radius * 1.5:
				taken = true
				break
		if taken:
			continue
		var count := game.query_enemies(enemy.position, radius).size()
		if count > best_count:
			best_count = count
			best = enemy.position
	return best


## Each falling bomb's shadow, growing and darkening until it lands.
func _draw_shadows() -> void:
	for bomb in _bombs:
		var progress := 1.0 - bomb.fall_left / FALL_SECONDS
		_floor.draw_circle(bomb.at, bomb.radius * (0.4 + 0.6 * progress), Color(SHADOW, 0.12 + 0.18 * progress))
		_floor.draw_arc(bomb.at, bomb.radius, 0.0, TAU, 32, Color(Art.RED, 0.5 * progress), 1.5, true)
