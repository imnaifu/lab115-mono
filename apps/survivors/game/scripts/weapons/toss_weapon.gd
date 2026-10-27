class_name TossWeapon
extends Weapon
## Heavy things tossed upward that arc back down, smashing through everything in the way.
## (Silicon Valley: 机械键盘.)

const COUNT := [1, 2, 2, 3, 3]
const DAMAGE := [24.0, 24.0, 34.0, 34.0, 44.0]
const SIZE := [1.0, 1.0, 1.0, 1.0, 1.4]
const GRAVITY := 420.0
const ART_SIZE := 20.0

var _next_side := 1.0


func cooldown() -> float:
	return 2.2


func fire() -> bool:
	var size: float = stat(SIZE)
	for i in stat(COUNT):
		var toss := Vector2(_next_side * game.rng.randf_range(30.0, 90.0), -game.rng.randf_range(200.0, 240.0))
		# Alternate sides so multiple tosses cover both flanks.
		_next_side = -_next_side
		var projectile := spawn_projectile(ART_SIZE, toss, stat(DAMAGE), -1, 2.0)
		projectile.gravity = GRAVITY
		projectile.spin = 10.0 * signf(toss.x)
		projectile.hit_radius = 8.0 * size
		projectile.knockback = 40.0
		projectile.set_visual_scale(size)
	return true
