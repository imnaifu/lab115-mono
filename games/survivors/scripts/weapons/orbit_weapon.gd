class_name OrbitWeapon
extends Weapon
## Things circling the player that hit whatever they pass through.
## (Silicon Valley: 无人机.)

const COUNT := [1, 2, 2, 3, 4]
const DAMAGE := [8.0, 8.0, 12.0, 12.0, 12.0]
const ORBIT_RADIUS := [30.0, 30.0, 36.0, 36.0, 40.0]
const ORBIT_SPEED := [3.0, 3.0, 3.0, 3.0, 4.0]
const HIT_RADIUS := 7.0
## The same enemy can be hit again after this many seconds.
const HIT_INTERVAL := 0.5
const SIZE := 18.0

var _angle := 0.0
var _orbiters: Array[Sprite2D] = []
var _last_hit := {}


func _init() -> void:
	# Above enemies, which share z 0 with the player in the y-sorted entity layer.
	z_index = 5


func _ready() -> void:
	_rebuild_orbiters()


func _on_level_changed() -> void:
	_rebuild_orbiters()


func _process(delta: float) -> void:
	_angle += stat(ORBIT_SPEED) * delta
	var radius: float = stat(ORBIT_RADIUS)
	var damage: float = stat(DAMAGE) * player.might
	for i in _orbiters.size():
		var offset := Vector2.from_angle(_angle + TAU * i / _orbiters.size()) * radius
		# Drones stay upright and just bob, so they read as flying rather than spinning.
		_orbiters[i].position = offset + Vector2(0, sin(_angle * 3.0 + i) * 1.5)
		for enemy in game.query_enemies(player.position + offset, HIT_RADIUS):
			var key := enemy.get_instance_id()
			if game.elapsed - _last_hit.get(key, -INF) < HIT_INTERVAL:
				continue
			_last_hit[key] = game.elapsed
			game.damage_enemy(enemy, damage, offset.normalized() * 90.0, id)
	if _last_hit.size() > 600:
		_forget_old_hits()


func _rebuild_orbiters() -> void:
	for orbiter in _orbiters:
		orbiter.queue_free()
	_orbiters.clear()
	for i in stat(COUNT):
		var orbiter := Art.sprite(art, SIZE)
		add_child(orbiter)
		_orbiters.append(orbiter)


func _forget_old_hits() -> void:
	for key in _last_hit.keys():
		if game.elapsed - _last_hit[key] >= HIT_INTERVAL:
			_last_hit.erase(key)
