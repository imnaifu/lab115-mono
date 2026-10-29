class_name SwingWeapon
extends Weapon
## A swing round the front of the player: everything inside the arc is hurt and knocked well back,
## from level 3 also stunned for a moment, and at level 5 it goes all the way round.
## (Silicon Valley: PRD 卷筒, the spec rolled up and swung.) Halls of Torment's sword, HoloCure's
## scythe. 需求评审会 (evolved with 站会): every swing a wider full circle that stuns longer.

const DAMAGE := [20.0, 26.0, 26.0, 34.0, 44.0]
const ARC_DEGREES := [120.0, 120.0, 150.0, 150.0, 360.0]
const RADIUS := [50.0, 50.0, 58.0, 58.0, 66.0]
const COOLDOWN := [1.0, 0.95, 0.9, 0.85, 0.8]
const STUN := [0.0, 0.0, 0.3, 0.3, 0.5]
const KNOCKBACK := 140.0
## Swings at the nearest enemy this close, otherwise the way the player faces.
const AIM_RANGE := 70.0
const EVOLVED_RADIUS := 80.0
const EVOLVED_STUN := 0.6


func cooldown() -> float:
	return stat(COOLDOWN)


func fire() -> bool:
	var radius: float = EVOLVED_RADIUS if evolved else stat(RADIUS)
	var arc: float = TAU if evolved else deg_to_rad(stat(ARC_DEGREES))
	var stun: float = EVOLVED_STUN if evolved else stat(STUN)
	var target := game.nearest_enemy(player.position, AIM_RANGE)
	var aim := player.facing if target == null else (target.position - player.position).normalized()
	var damage: float = stat(DAMAGE) * damage_scale()
	var hits := 0
	var hit_boss := false
	for enemy in game.query_enemies(player.position, radius):
		var offset := enemy.position - player.position
		# Outside the arc only counts once it is clear of the player: one pressed against them is
		# hit whichever way the swing goes.
		if arc < TAU and offset.length() > enemy.radius + Player.HURT_RADIUS and absf(aim.angle_to(offset)) > arc / 2.0:
			continue
		game.damage_enemy(enemy, damage, offset.normalized() * KNOCKBACK, id)
		if stun > 0.0:
			enemy.stun(stun)
		hits += 1
		hit_boss = hit_boss or enemy.is_elite
	Effects.slash(game, player.position, aim.angle(), arc, radius)
	game.melee_impact(hits, hit_boss)
	return true
