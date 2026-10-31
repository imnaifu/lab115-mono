class_name StrikeWeapon
extends Weapon
## Strikes random enemies within RANGE of the player from above, splashing anyone standing close
## by. (Silicon Valley: 云端部署 — lightning out of a cloud.)
##
## It never misses, so it gets fewer, slower strikes than the weapons that have to be aimed or
## need enemies close; with more it took 65-80% of all damage.
## 多云多活 (evolved with 冰美式): twice the strikes, twice the splash.

const COUNT := [1, 2, 2, 3, 4]
const DAMAGE := [16.0, 16.0, 24.0, 24.0, 36.0]
const SPLASH_RADIUS := [12.0, 12.0, 12.0, 16.0, 18.0]
## Upgrades never make it faster (.39, the user's call: only 双屏显示器 speeds weapons up); what
## the speed-ups gave went into damage instead, the same damage a second at every level.
const COOLDOWN := [2.6, 2.6, 2.6, 2.6, 2.6]
## Only enemies this close to the player (most of the screen's short side): when it struck anywhere
## on screen, kills far off went by unnoticed (the user's call).
const RANGE := 150.0


func cooldown() -> float:
	return stat(COOLDOWN)


func fire() -> bool:
	var near := game.query_enemies(player.position, RANGE)
	near.shuffle()
	var targets := near.slice(0, stat(COUNT) * (2 if evolved else 1))
	if targets.is_empty():
		return false
	var damage: float = stat(DAMAGE) * damage_scale()
	var splash: float = stat(SPLASH_RADIUS) * (2.0 if evolved else 1.0)
	Sound.play("zap")
	for target: Enemy in targets:
		# Copy the position first: the strike may kill the target.
		var strike_at := target.position
		Effects.lightning(game, strike_at, art)
		# The splash drawn too: neighbours hurt by it used to lose health with nothing shown (.39).
		Effects.ring(game, strike_at, splash, Art.YELLOW)
		for enemy in game.query_enemies(strike_at, splash):
			game.damage_enemy(enemy, damage, Vector2.ZERO, id)
	return true
