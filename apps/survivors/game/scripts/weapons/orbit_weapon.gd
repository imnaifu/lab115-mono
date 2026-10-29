class_name OrbitWeapon
extends Weapon
## Walls circling the player: an enemy one runs into is hurt and pushed out. A weapon only: it
## used to stop boss bullets and pies too, which the user took out. (Silicon Valley: 防火墙.)
## Survivor.io's guardian, Vampire Survivors' King Bible. 零信任 (evolved with 降噪耳机): six
## walls, and whatever they hit is held still for a moment.
##
## The circle keeps a fixed radius. (In .11-.14 it closed in on an enemy that got inside it; the
## user preferred it fixed, a little tighter.)
##
## The ops' own weapon, so it levels up along two directions (Upgrades.BRANCHES): 更多 adds a
## wall, 更硬 makes every wall hit harder, bigger and further back. Either way each upgrade also
## spins the walls a little faster on a slightly wider circle.

## Walls to start with: two (one in .11-.14, which let most enemies slip past once the circle
## stopped closing in on them).
## An enemy is hurt at most once every HIT_GAP seconds by the walls.
const BASE_WALLS := 2
const BASE_DAMAGE := 12.0
const DAMAGE_PER_HARDER := 7.0
## 44 at first, then 58 after the walls dealt 8% of an ops run's damage (enemies kept off by the
## player's movement rarely got inside the circle), then a little tighter again at the user's
## request.
const BASE_ORBIT_RADIUS := 52.0
const ORBIT_PER_UPGRADE := 2.5
## Radians per second. With the starting weapon alone, two walls at this speed kept up with the
## programmer over 90 seconds (57 kills to 59); one wall, even at 4.0, fell behind (48).
const BASE_SPIN := 2.2
const SPIN_PER_UPGRADE := 0.25
const WALL_RADIUS := 11.0
const WALL_RADIUS_PER_HARDER := 3.0
const HIT_GAP := 0.5
const PUSH := 90.0
const PUSH_PER_HARDER := 40.0
const SIZE := 18.0
const EVOLVED_COUNT := 6
const EVOLVED_STUN := 0.4

var _angle := 0.0
var _clock := 0.0
var _sprites: Array[Sprite2D] = []
## Enemy instance id -> when the walls last hurt it.
var _last_hit := {}


## The walls with `more` upgrades to 更多 and `harder` to 更硬 (the cards' numbers too, which
## show `count`, `damage` and `size`: the spin and the circle grow either way, so they say nothing
## about the choice).
static func branch_stats(more: int, harder: int) -> Dictionary:
	var upgrades := more + harder
	return {"count": BASE_WALLS + more, "damage": BASE_DAMAGE + DAMAGE_PER_HARDER * harder, "size": 1.0 + WALL_RADIUS_PER_HARDER * harder / WALL_RADIUS,
		"orbit": BASE_ORBIT_RADIUS + ORBIT_PER_UPGRADE * upgrades, "spin": BASE_SPIN + SPIN_PER_UPGRADE * upgrades,
		"push": PUSH + PUSH_PER_HARDER * harder}


func _init() -> void:
	# Above the enemies, like the drones.
	z_index = 5


func _process(delta: float) -> void:
	_clock += delta
	var stats := branch_stats(branch_a, branch_b)
	_angle = fmod(_angle + stats["spin"] * delta, TAU)
	var count: int = maxi(EVOLVED_COUNT, stats["count"]) if evolved else stats["count"]
	var wall_radius: float = WALL_RADIUS * stats["size"]
	while _sprites.size() < count:
		var sprite := Art.sprite(art, SIZE)
		sprite.top_level = true
		sprite.z_index = z_index
		add_child(sprite)
		_sprites.append(sprite)
	var damage: float = stats["damage"] * damage_scale()
	for i in count:
		var at: Vector2 = player.position + Vector2.from_angle(_angle + TAU * i / count) * stats["orbit"]
		_sprites[i].position = at
		_sprites[i].scale = Vector2.ONE * Art.scale_for(art, SIZE * stats["size"])
		for enemy in game.query_enemies(at, wall_radius):
			var key := enemy.get_instance_id()
			if _clock - _last_hit.get(key, -INF) < HIT_GAP:
				continue
			_last_hit[key] = _clock
			game.damage_enemy(enemy, damage, (enemy.position - player.position).normalized() * stats["push"], id)
			if evolved:
				enemy.stun(EVOLVED_STUN)
	# Forget enemies not hit for a while, so the table doesn't grow over a run.
	if _last_hit.size() > 200:
		for key in _last_hit.keys():
			if _clock - _last_hit[key] > HIT_GAP:
				_last_hit.erase(key)

