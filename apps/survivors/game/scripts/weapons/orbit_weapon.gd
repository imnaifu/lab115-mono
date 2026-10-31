class_name OrbitWeapon
extends Weapon
## Guard walls: each circles the player while nothing is near, and as soon as an enemy is within
## GUARD_RADIUS of the player it flies at it and hits it, then goes for the next.
## The one closest to the player goes first, so whatever gets in to the player is dealt with;
## anything a wall brushes on its way is hit too. (Silicon Valley: 防火墙.) Survivor.io's guardian,
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
const DAMAGE_PER_HARDER := 14.0
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
## An enemy is hurt at most once every HIT_GAP seconds by the walls.
## Per wall since .39, so a wall touching an enemy always hurts it unless that wall itself just
## did; walls no longer queue for one shared gap, which made a five-wall build several times as
## strong, so the gap went from 0.56 to what the balance fit asked for (1.35 in .39, 1.8 from .40,
## where the ops still came out the strongest job).
const HIT_GAP := 1.8
## After hitting its target a wall drifts back this long before going again, so it doesn't grind
## one enemy down every frame.
const RECOVER_SECONDS := 0.43
const SIZE := 18.0
const EVOLVED_COUNT := 6
const EVOLVED_STUN := 0.4


class Wall:
	var sprite: Sprite2D
	var position := Vector2.ZERO
	var target: Enemy
	var recover_left := 0.0
	## Enemy instance id -> when this wall last hurt it. Each wall keeps its own (.39): with one
	## table for all the walls, a wall went through an enemy another had just hit and did nothing.
	var last_hit := {}


var _walls: Array[Wall] = []
var _clock := 0.0


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
	for i in _walls.size():
		var wall := _walls[i]
		if wall.recover_left > 0.0:
			wall.recover_left -= delta
		elif not _target_still_good(wall, stats["radius"]):
			wall.target = _pick_target(wall, stats["radius"])
		var goal := player.position + Vector2.from_angle(_clock * IDLE_SPIN + TAU * i / _walls.size()) * IDLE_RADIUS
		if wall.target != null and wall.recover_left <= 0.0:
			goal = wall.target.position
		wall.position = wall.position.move_toward(goal, SPEED * delta)
		wall.sprite.position = wall.position
		wall.sprite.scale = Vector2.ONE * Art.scale_for(art, SIZE * stats["size"])
		for enemy in game.query_enemies(wall.position, wall_radius):
			var key := enemy.get_instance_id()
			if _clock - wall.last_hit.get(key, -INF) < HIT_GAP:
				continue
			wall.last_hit[key] = _clock
			game.damage_enemy(enemy, damage, Vector2.ZERO, id)
			if evolved:
				enemy.stun(EVOLVED_STUN)
			if enemy == wall.target:
				# Picked afresh after the pause: by then this one may be dead and gone.
				wall.recover_left = RECOVER_SECONDS
				wall.target = null
		# Forget enemies not hit for a while, so the table doesn't grow over a run.
		if wall.last_hit.size() > 200:
			for key in wall.last_hit.keys():
				if _clock - wall.last_hit[key] > HIT_GAP:
					wall.last_hit.erase(key)


## The wall's target is alive, still inside the guarded circle and not just hit (it waits out its
## HIT_GAP while the wall goes for another). Takes the wall rather than the enemy: a freed enemy
## can't be passed through an Enemy-typed argument.
func _target_still_good(wall: Wall, radius: float) -> bool:
	if not is_instance_valid(wall.target) or wall.target.dead:
		return false
	if wall.target.position.distance_squared_to(player.position) > radius * radius:
		return false
	return _clock - wall.last_hit.get(wall.target.get_instance_id(), -INF) >= HIT_GAP


## The enemy inside the guarded circle closest to the player that no other wall is after and
## that isn't waiting out its HIT_GAP, or null.
func _pick_target(wall: Wall, radius: float) -> Enemy:
	var taken := {}
	for other in _walls:
		if other != wall and is_instance_valid(other.target):
			taken[other.target.get_instance_id()] = true
	var best: Enemy = null
	var best_distance := INF
	for enemy in game.query_enemies(player.position, radius):
		var key := enemy.get_instance_id()
		if taken.has(key) or _clock - wall.last_hit.get(key, -INF) < HIT_GAP:
			continue
		var distance := enemy.position.distance_squared_to(player.position)
		if distance < best_distance:
			best_distance = distance
			best = enemy
	return best
