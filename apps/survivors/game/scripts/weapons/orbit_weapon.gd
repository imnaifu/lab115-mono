class_name OrbitWeapon
extends Weapon
## Guard walls: each circles the player while nothing is near, and as soon as an enemy is within
## GUARD_RADIUS of the player it flies at the one closest to the player, slams it (and whatever else
## its body covers there), and comes back until it may go again. (Silicon Valley: 防火墙.)
## .82 (the user: 运维的攻击很奇怪，不要去卡不同的怪，而是固定攻击最近的，只卡频率; 都打最近的):
## every wall goes for the same enemy, the closest to the player, and each wall slams once every
## ATTACK_GAP seconds, the walls taking turns. Until .81 a wall could hurt an enemy only once every
## 1.8 seconds (HIT_GAP), so after one hit it went for the second closest, then the third, the walls
## split up across different enemies, and whatever they brushed on the way was hurt too. Survivor.io's guardian,
## turned into a guard dog. 零信任 (evolved with 降噪耳机): six walls, and whatever they hit is held
## still for a moment.
##
## It used to be walls on a fixed circle (.9-.15; the circle closed in on enemies inside it in
## .11-.14), which an enemy that got inside never met again: "it keeps hitting me", the user said.
## It no longer stops boss bullets either.
##
## The ops' own weapon, so it levels up along two directions (Upgrades.BRANCHES): 更多 adds a
## wall, 更硬 makes every wall hit harder and bigger. Either way each upgrade also widens the
## guarded circle a little.
##
## Walls no longer push what they hit out (90, 40 more a 更硬): .39, the user's call for every job's
## own weapon, so the jobs differ only in how they deal damage.

## One wall to start with, the user's call.
const BASE_WALLS := 1
## 7 a hit at level 1 (.39, the user's call): an opening Bug (8 health, 10.4 in Beijing, up to 13
## by 1:00) takes two hits on every map. Growth and pace come from the balance fit (DESIGN.md 2.2).
const BASE_DAMAGE := 7.0
## +10 a 更硬 since .74 (the user: 防火墙成长也调低; +14 before): walls slam whatever crowds the player,
## and in a late crowd that came to about 650 damage a second alone at 8:00, now about 500.
const DAMAGE_PER_HARDER := 10.0
## Enemies this close to the player are the walls' to go for.
const BASE_GUARD_RADIUS := 70.0
const GUARD_PER_UPGRADE := 4.0
## Where idle walls circle, and how fast (radians per second).
const IDLE_RADIUS := 30.0
const IDLE_SPIN := 2.2
## How fast a wall flies at its target, pixels per second.
const SPEED := 260.0
const WALL_RADIUS := 11.0
const WALL_RADIUS_PER_HARDER := 3.0
## Seconds between one wall's slams, times the player's cooldown (冷却 now counts for the walls too,
## as for every other weapon). Set by a firewall-only probe to keep the damage a second of .79,
## when an enemy could be hurt once every 1.8 s by each wall (HIT_GAP) and a wall rested 0.43 s
## after each target.
const ATTACK_GAP := 0.5
const SIZE := 18.0
const EVOLVED_COUNT := 6
const EVOLVED_STUN := 0.4


class Wall:
	var sprite: Sprite2D
	var position := Vector2.ZERO
	## Set while flying at an enemy; null while back by the player.
	var target: Enemy
	## Until it may slam again.
	var cooldown_left := 0.0


var _walls: Array[Wall] = []
var _clock := 0.0
## When a wall last set off: the walls go one after another, a share of the gap apart, so with
## several they hit the closest enemy in turn rather than all landing on it at once.
var _last_launch := -INF


## The walls with `more` upgrades to 更多 and `harder` to 更硬 (the cards' numbers too).
static func branch_stats(more: int, harder: int) -> Dictionary:
	return {"count": BASE_WALLS + more, "damage": BASE_DAMAGE + DAMAGE_PER_HARDER * harder,
		"radius": BASE_GUARD_RADIUS + GUARD_PER_UPGRADE * (more + harder),
		"size": 1.0 + WALL_RADIUS_PER_HARDER * harder / WALL_RADIUS}


func _init() -> void:
	# Above the enemies, like the drones.
	z_index = 5


func _process(delta: float) -> void:
	_clock += delta
	var stats := branch_stats(branch_a, branch_b)
	var count: int = maxi(EVOLVED_COUNT, stats["count"]) if evolved else stats["count"]
	while _walls.size() < count:
		var wall := Wall.new()
		wall.position = player.position
		wall.sprite = Art.sprite(art, SIZE)
		# The walls fly in world space; the weapon rides along on the player.
		wall.sprite.top_level = true
		wall.sprite.z_index = z_index
		add_child(wall.sprite)
		_walls.append(wall)
	var wall_radius: float = WALL_RADIUS * stats["size"]
	var damage: float = stats["damage"] * damage_scale()
	var gap := ATTACK_GAP * player.cooldown_scale
	var closest := _closest_enemy(stats["radius"])
	for i in _walls.size():
		var wall := _walls[i]
		wall.cooldown_left -= delta
		if wall.target != null and (not is_instance_valid(wall.target) or wall.target.dead):
			wall.target = null
		# Always the one closest to the player: a wall on its way switches if another gets closer.
		if wall.target != null:
			wall.target = closest
		elif wall.cooldown_left <= 0.0 and closest != null and _clock - _last_launch >= gap / _walls.size():
			wall.target = closest
			_last_launch = _clock
		var goal := player.position + Vector2.from_angle(_clock * IDLE_SPIN + TAU * i / _walls.size()) * IDLE_RADIUS
		if wall.target != null:
			goal = wall.target.position
		wall.position = wall.position.move_toward(goal, SPEED * delta)
		wall.sprite.position = wall.position
		wall.sprite.scale = Vector2.ONE * Art.scale_for(art, SIZE * stats["size"])
		if wall.target == null:
			continue
		var hit := game.query_enemies(wall.position, wall_radius)
		if not wall.target in hit:
			continue
		# Reached it: one slam on everything under the wall, then back until the gap is up.
		for enemy in hit:
			game.damage_enemy(enemy, damage, Vector2.ZERO, id)
			if evolved:
				enemy.stun(EVOLVED_STUN)
		wall.target = null
		wall.cooldown_left = gap


## The enemy inside the guarded circle closest to the player, or null.
func _closest_enemy(radius: float) -> Enemy:
	var best: Enemy = null
	var best_distance := INF
	for enemy in game.query_enemies(player.position, radius):
		if enemy.dead:
			continue
		var distance := enemy.position.distance_squared_to(player.position)
		if distance < best_distance:
			best_distance = distance
			best = enemy
	return best


