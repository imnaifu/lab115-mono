class_name TossWeapon
extends Weapon
## Heavy things tossed upward that arc back down, smashing through everything in the way.
## (Silicon Valley: 机械键盘.)

## .74 (the user: 有穿透的武器数值调低点…其他的给我方案 → go): the third keyboard at level 5 (4 before).
const COUNT := [1, 2, 2, 2, 3]
## .74 (the user: 有穿透的武器数值调低点…其他的给我方案 → go): was 24 / 24 / 34 / 34 / 44, with one more keyboard at level 4 and
## ×1.4 at 5. Smashing through a late crowd it dealt about 490 a second alone at full level at 8:00,
## now about 300 (the common weapons' mark; the jobs' own about 500).
## 0.3.9 (the user: 屏保成长伤害加一下 / 复制粘贴穿透改成无限 / 机械键盘初始削弱一点，成长加一点 / 云端部署改 2.2 秒 / 拉会半径大一点 / 无人机伤害加一点 / 邮件伤害加一点):
## 20 to start (24), +5 / +5 (+2 / +2), so full 30 (28) — then (the user: 机械键盘还是削弱一下到500 左右,
## alone at full level at 8:00 it hit about 710 a second walking a loop): 12 to start, +3 / +3, full
## 18, about 500 a second there (15 / 15 / 18 / 21 / 21 tried first: 570).
const DAMAGE := [12.0, 12.0, 15.0, 18.0, 18.0]
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
