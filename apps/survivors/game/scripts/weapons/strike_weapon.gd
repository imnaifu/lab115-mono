class_name StrikeWeapon
extends Weapon
## Strikes random on-screen enemies from above, splashing anyone standing close by.
## (Silicon Valley: 云端部署 — lightning out of a cloud.)

const COUNT := [2, 3, 3, 4, 6]
const DAMAGE := [18.0, 18.0, 26.0, 26.0, 26.0]
const SPLASH_RADIUS := [14.0, 14.0, 14.0, 20.0, 20.0]
const COOLDOWN := [2.2, 2.2, 2.2, 2.2, 1.6]


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
