class_name BomberWeapon
extends Weapon
## Drones that fly out over the thickest crowd on screen, drop a bomb on it (its shadow shows where
## it lands) and fly on to the next; they never ram anything. Since .35 a drone follows the enemy
## in the middle of that crowd rather than flying to where it stood, and drops where it will be
## when the bomb lands (the user: by the time a bomb went off the crowd had walked on). (Silicon Valley: 无人机.) Vampire
## Survivors' Peachone and Ebony Wings, birds dropping bombs. They used to chase enemies and ram
## them, which the ops' guard wall and the outsourced workers did too. 集束轰炸 (evolved with
## 降本增效): every bomb throws out three smaller ones round where it lands.

const COUNT := [1, 2, 2, 3, 4]
## A quarter down in .35 (was 16, 16, 22, 22, 28) once the bombs started landing: in bot runs its
## share of the damage went from about 7% to 24%, the user asked for it a little weaker.
const DAMAGE := [12.0, 12.0, 16.0, 16.0, 21.0]
const BLAST_RADIUS := [26.0, 26.0, 30.0, 30.0, 36.0]
## Was 180 until .35, slow enough for the crowd to walk out from under the bomb.
const SPEED := 260.0
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
## The falling bomb: how far above its landing spot it is let go (drawn up the screen, like the
## drone's height), and its size.
const DROP_HEIGHT := 16.0
const BOMB_RADIUS := 3.5


class Drone:
	var sprite: Sprite2D
	var position := Vector2.ZERO
	## Where it is flying to drop its bomb, or null while it reloads by the player.
	var goal: Variant = null
	## The enemy it is after (the middle of the crowd it picked), followed until the drop.
	var target: Enemy = null
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
## The falling bombs and where they will land, over the crowd so it can't hide them (.39: only the
## shadow under the crowd showed, its red outline lost in a thick one).
var _sky: Node2D


func _init() -> void:
	# Above the enemies.
	z_index = 5


func _ready() -> void:
	# The bombs' shadows, on the ground in world space under the crowd.
	_floor = Node2D.new()
	_floor.z_index = -3
	_floor.draw.connect(_draw_shadows)
	game.add_child(_floor)
	_sky = Node2D.new()
	_sky.z_index = z_index - 1
	_sky.draw.connect(_draw_falling)
	game.add_child(_sky)


## The shadows live on the game, not under the weapon: they go with it.
func _exit_tree() -> void:
	if is_instance_valid(_floor):
		_floor.queue_free()
	if is_instance_valid(_sky):
		_sky.queue_free()


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
			drone.target = _busiest_enemy(radius)
		elif drone.goal != null and not _alive(drone.target):
			# Its enemy died on the way: the next crowd instead, or the spot it was heading for.
			var other := _busiest_enemy(radius)
			if other != null:
				drone.target = other
		if _alive(drone.target):
			drone.goal = _landing_spot(drone.target)
		var hover := player.position + Vector2.from_angle(_clock * 1.5 + TAU * i / _drones.size()) * HOVER_RADIUS + Vector2(0, -6)
		var heading: Vector2 = hover if drone.goal == null else drone.goal
		drone.position = drone.position.move_toward(heading, SPEED * delta)
		if drone.goal != null and drone.position.distance_to(drone.goal as Vector2) < 2.0:
			_drop(drone.goal, stat(DAMAGE) * damage_scale(), radius, false)
			drone.goal = null
			drone.target = null
			drone.reload_left = RELOAD * player.cooldown_scale
		drone.sprite.position = drone.position + Vector2(0, sin(_clock * 8.0 + i) * 1.5)
	for i in range(_bombs.size() - 1, -1, -1):
		var bomb := _bombs[i]
		bomb.fall_left -= delta
		if bomb.fall_left <= 0.0:
			_bombs.remove_at(i)
			_blast(bomb)
	_floor.queue_redraw()
	_sky.queue_redraw()


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


## The on-screen enemy with the most others within `radius` of it, clear of where the other
## drones are headed; null with nobody on screen.
func _busiest_enemy(radius: float) -> Enemy:
	var best: Enemy = null
	var best_count := 0
	for enemy in game.random_visible_enemies(CANDIDATES):
		var taken := false
		for other in _drones:
			if (_alive(other.target) and other.target == enemy) or (other.goal != null and (other.goal as Vector2).distance_to(enemy.position) < radius * 1.5):
				taken = true
				break
		if taken:
			continue
		var count := game.query_enemies(enemy.position, radius).size()
		if count > best_count:
			best_count = count
			best = enemy
	return best


## Untyped: a drone's target may have been freed since, which a typed argument rejects.
func _alive(enemy: Variant) -> bool:
	return is_instance_valid(enemy) and not (enemy as Enemy).dead


## Where `enemy` will be when a bomb dropped now lands: the crowd walks at the player, so ahead of
## it along that line by FALL_SECONDS of its walking.
func _landing_spot(enemy: Enemy) -> Vector2:
	var toward := player.position - enemy.position
	var lead := minf(enemy.speed * FALL_SECONDS, toward.length())
	return enemy.position + toward.normalized() * lead


## Each falling bomb's shadow, growing and darkening until it lands.
func _draw_shadows() -> void:
	for bomb in _bombs:
		var progress := 1.0 - bomb.fall_left / FALL_SECONDS
		_floor.draw_circle(bomb.at, bomb.radius * (0.4 + 0.6 * progress), Color(SHADOW, 0.12 + 0.18 * progress))


## Each falling bomb, dropping faster and faster onto its spot, and the reach of its blast.
func _draw_falling() -> void:
	for bomb in _bombs:
		var progress := 1.0 - bomb.fall_left / FALL_SECONDS
		_sky.draw_arc(bomb.at, bomb.radius, 0.0, TAU, 32, Color(Art.RED, 0.5 * progress), 1.5, true)
		var size := BOMB_RADIUS * (0.7 if bomb.small else 1.0)
		var at := bomb.at - Vector2(0.0, DROP_HEIGHT * (1.0 - progress * progress))
		_sky.draw_circle(at, size + 1.0, Art.INK)
		_sky.draw_circle(at, size, SHADOW)
		_sky.draw_circle(at + Vector2(-size * 0.35, -size * 0.35), size * 0.3, Color(1, 1, 1, 0.7))
