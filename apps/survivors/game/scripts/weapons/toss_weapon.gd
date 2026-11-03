class_name TossWeapon
extends Weapon
## Heavy things tossed upward that arc back down, smashing through everything in the way.
## (Silicon Valley: 机械键盘.)

## .74 (the user: 有穿透的武器数值调低点…其他的给我方案 → go): the third keyboard at level 5 (4 before).
const COUNT := [1, 2, 2, 2, 3]
## .74 (the user: 有穿透的武器数值调低点…其他的给我方案 → go): was 24 / 24 / 34 / 34 / 44, with one more keyboard at level 4 and
## ×1.4 at 5. Smashing through a late crowd it dealt about 490 a second alone at full level at 8:00,
## now about 300 (the common weapons' mark; the jobs' own about 500).
const DAMAGE := [24.0, 24.0, 26.0, 28.0, 28.0]
## .74 (the user: 有穿透的武器数值调低点…其他的给我方案 → go): ×1.2 at level 5 (×1.4 before).
const SIZE := [1.0, 1.0, 1.0, 1.0, 1.2]
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
