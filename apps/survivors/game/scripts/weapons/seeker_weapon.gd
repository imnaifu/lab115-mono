class_name SeekerWeapon
extends Weapon
## Companions that fly off after enemies on their own: each picks one near the player, rams it,
## bounces off, and goes for the next; with nothing in reach they hover by the player.
## (Silicon Valley: 无人机.) The Wi-Fi field guards the player's own spot; these clear out
## enemies a little way off, so the two don't do the same job. 无人车车队 (evolved with 降本增效):
## robotaxis instead, bigger, harder-hitting and knocking what they ram far back.

const COUNT := [1, 2, 2, 3, 4]
const DAMAGE := [9.0, 9.0, 13.0, 13.0, 17.0]
const SPEED := [150.0, 150.0, 175.0, 175.0, 200.0]
## Targets are picked within this distance of the player; a target that ends up further than
## LEASH (the player ran on) is dropped and the drone comes back.
const SEEK_RANGE := 150.0
const LEASH := 200.0
const HIT_RADIUS := 6.0
## After a hit the drone bounces off and drifts for this long before diving again, so one
## drone can't grind a single enemy down every frame.
const RECOVER_SECONDS := 0.35
## How quickly a drone turns toward where it wants to go (higher snaps harder).
const TURN_RATE := 9.0
## Idle drones circle this far from the player.
const HOVER_RADIUS := 22.0
const SIZE := 18.0
const EVOLVED_ART := "robotaxi"
const EVOLVED_SIZE := 24.0
const EVOLVED_DAMAGE := 1.5
const EVOLVED_HIT_RADIUS := 10.0
const EVOLVED_PUSH := 200.0


class Drone:
	var sprite: Sprite2D
	var position := Vector2.ZERO
	var velocity := Vector2.ZERO
	var target: Enemy
	var recover_left := 0.0


var _drones: Array[Drone] = []
var _clock := 0.0


func _init() -> void:
	# Above enemies, which share z 0 with the player in the y-sorted entity layer.
	z_index = 5


func _ready() -> void:
	_sync_drone_count()


func _on_level_changed() -> void:
	_sync_drone_count()


func _process(delta: float) -> void:
	_clock += delta
	var speed: float = stat(SPEED)
	var damage: float = stat(DAMAGE) * damage_scale() * (EVOLVED_DAMAGE if evolved else 1.0)
	for i in _drones.size():
		var drone := _drones[i]
		if drone.recover_left > 0.0:
			drone.recover_left -= delta
			drone.velocity = drone.velocity.lerp(Vector2.ZERO, minf(1.0, 3.0 * delta))
		else:
			if not _target_still_good(drone):
				drone.target = _pick_target(drone)
			var goal := _hover_spot(i) if drone.target == null else drone.target.position
			# Full speed toward a target; easing in toward the hover spot so idle drones settle.
			var desired := (goal - drone.position) * 4.0
			if drone.target != null or desired.length() > speed:
				desired = desired.normalized() * speed
			drone.velocity = drone.velocity.lerp(desired, minf(1.0, TURN_RATE * delta))
		drone.position += drone.velocity * delta
		if drone.recover_left <= 0.0:
			_ram(drone, damage)
		drone.sprite.position = drone.position + Vector2(0, sin(_clock * 8.0 + i) * 1.5)
		# Banks into its turns.
		drone.sprite.rotation = clampf(drone.velocity.x / speed, -1.0, 1.0) * 0.3


## Hits the first enemy the drone touches, then bounces off it.
func _ram(drone: Drone, damage: float) -> void:
	for enemy in game.query_enemies(drone.position, EVOLVED_HIT_RADIUS if evolved else HIT_RADIUS):
		var push := drone.velocity.normalized()
		game.damage_enemy(enemy, damage, push * (EVOLVED_PUSH if evolved else 80.0), id)
		drone.velocity = -drone.velocity * 0.6
		drone.recover_left = RECOVER_SECONDS
		return


## The drone's target is alive and still near the player. Takes the drone rather than the enemy:
## a freed enemy can't be passed through an Enemy-typed argument.
func _target_still_good(drone: Drone) -> bool:
	return is_instance_valid(drone.target) and not drone.target.dead \
		and drone.target.position.distance_squared_to(player.position) <= LEASH * LEASH


## The enemy nearest this drone among those near the player, preferring ones no other drone is
## already after, so several drones spread out instead of chasing the same one.
func _pick_target(drone: Drone) -> Enemy:
	var taken := {}
	for other in _drones:
		if other != drone and is_instance_valid(other.target):
			taken[other.target.get_instance_id()] = true
	var best: Enemy = null
	var best_score := INF
	for enemy in game.query_enemies(player.position, SEEK_RANGE):
		var score := enemy.position.distance_to(drone.position)
		if taken.has(enemy.get_instance_id()):
			score += 80.0
		if score < best_score:
			best_score = score
			best = enemy
	return best


func _hover_spot(index: int) -> Vector2:
	var angle := _clock * 1.5 + TAU * index / maxi(_drones.size(), 1)
	return player.position + Vector2.from_angle(angle) * HOVER_RADIUS + Vector2(0, -6)


func _on_evolved() -> void:
	for drone in _drones:
		drone.sprite.texture = Art.texture(EVOLVED_ART)
		drone.sprite.scale = Vector2.ONE * Art.scale_for(EVOLVED_ART, EVOLVED_SIZE)


func _sync_drone_count() -> void:
	while _drones.size() < stat(COUNT):
		var drone := Drone.new()
		drone.position = player.position
		drone.sprite = Art.sprite(EVOLVED_ART, EVOLVED_SIZE) if evolved else Art.sprite(art, SIZE)
		# Drones fly in world space; the weapon itself rides along on the player. A top-level
		# sprite doesn't inherit the weapon's z either, so it gets its own.
		drone.sprite.top_level = true
		drone.sprite.z_index = z_index
		drone.sprite.position = drone.position
		add_child(drone.sprite)
		_drones.append(drone)
