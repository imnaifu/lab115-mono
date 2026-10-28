class_name StrikeWeapon
extends Weapon
## Strikes random on-screen enemies from above, splashing anyone standing close by.
## (Silicon Valley: 云端部署 — lightning out of a cloud.)
##
## It never misses and reaches anything on screen, so it gets fewer, slower strikes than the
## weapons that have to be aimed or need enemies close; with more it took 65-80% of all damage.

const COUNT := [1, 2, 2, 3, 4]
const DAMAGE := [16.0, 16.0, 22.0, 22.0, 28.0]
const SPLASH_RADIUS := [12.0, 12.0, 12.0, 16.0, 18.0]
const COOLDOWN := [2.6, 2.6, 2.4, 2.4, 2.0]


func cooldown() -> float:
	return stat(COOLDOWN)


func fire() -> bool:
	var targets := game.random_visible_enemies(stat(COUNT))
	if targets.is_empty():
		return false
	var damage: float = stat(DAMAGE) * player.might
	Sound.play("zap")
	for target in targets:
		# Copy the position first: the strike may kill the target.
		var strike_at := target.position
		Effects.lightning(game, strike_at, art)
		for enemy in game.query_enemies(strike_at, stat(SPLASH_RADIUS)):
			game.damage_enemy(enemy, damage, Vector2.ZERO, id)
	return true
