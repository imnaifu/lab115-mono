class_name OrbitWeapon
extends Weapon
## Walls circling the player: an enemy one runs into is hurt and pushed out, and a boss's bullet
## or pie meeting one is stopped. (Silicon Valley: 防火墙.) Survivor.io's guardian, Vampire
## Survivors' King Bible. 零信任 (evolved with 降噪耳机): six walls, and the bullets they stop fly
## back the way they came.

const COUNT := [2, 2, 3, 3, 4]
## An enemy is hurt at most once every HIT_GAP seconds by the walls.
## Raised a fifth, and the orbit widened, after it dealt 8% of an ops run's damage: enemies
## kept off by the player's movement rarely got inside the first draft's circle (at 44, an ops
## bot kiting like everyone else killed 6 enemies in its first 50 seconds).
const DAMAGE := [12.0, 17.0, 17.0, 22.0, 27.0]
const ORBIT_RADIUS := [58.0, 58.0, 62.0, 62.0, 68.0]
## Radians per second.
const SPIN := [2.2, 2.2, 2.6, 2.6, 3.2]
const WALL_RADIUS := 11.0
const HIT_GAP := 0.5
const PUSH := 90.0
const SIZE := 18.0
const EVOLVED_COUNT := 6
const REFLECT_DAMAGE := 20.0
const REFLECT_SPEED := 220.0

var _angle := 0.0
var _clock := 0.0
var _sprites: Array[Sprite2D] = []
## Enemy instance id -> when the walls last hurt it.
var _last_hit := {}


func _init() -> void:
	# Above the enemies, like the drones.
	z_index = 5


func _process(delta: float) -> void:
	_clock += delta
	_angle = fmod(_angle + stat(SPIN) * delta, TAU)
	var count: int = EVOLVED_COUNT if evolved else stat(COUNT)
	while _sprites.size() < count:
		var sprite := Art.sprite(art, SIZE)
		sprite.top_level = true
		sprite.z_index = z_index
		add_child(sprite)
		_sprites.append(sprite)
	var damage: float = stat(DAMAGE) * damage_scale()
	for i in count:
		var at: Vector2 = player.position + Vector2.from_angle(_angle + TAU * i / count) * stat(ORBIT_RADIUS)
		_sprites[i].position = at
		for enemy in game.query_enemies(at, WALL_RADIUS):
			var key := enemy.get_instance_id()
			if _clock - _last_hit.get(key, -INF) < HIT_GAP:
				continue
			_last_hit[key] = _clock
			game.damage_enemy(enemy, damage, (enemy.position - player.position).normalized() * PUSH, id)
		_block_shots(at)
	# Forget enemies not hit for a while, so the table doesn't grow over a run.
	if _last_hit.size() > 200:
		for key in _last_hit.keys():
			if _clock - _last_hit[key] > HIT_GAP:
				_last_hit.erase(key)


func _block_shots(at: Vector2) -> void:
	for shot in game.hostile_shots:
		var point = shot.blockable_point()
		if point == null:
			continue
		var reach := WALL_RADIUS + shot.block_radius()
		if (point as Vector2).distance_squared_to(at) > reach * reach:
			continue
		var was_bullet := shot.kind == HostileShot.Kind.BULLET
		var velocity := shot.block(game)
		Sound.play("block")
		Effects.ring(game, at, 14.0, Art.BLUE)
		if evolved and was_bullet:
			var back := spawn_projectile(10.0, -velocity.normalized() * REFLECT_SPEED, REFLECT_DAMAGE, 1, 1.5)
			back.position = at
