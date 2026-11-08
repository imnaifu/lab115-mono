class_name FacingWeapon
extends Weapon
## Rapid shots thrown the way the player is facing, fanned side by side.
## (Silicon Valley: 复制粘贴.) Ctrl+A 全选粘贴 (evolved with 猎头电话): the same volley goes out in
## eight directions at once.

const COUNT := [1, 1, 2, 2, 3]
## Raised after the live runs had it at 1-7% of all damage even at full level. Doubled in .74 (the
## user: 复制粘贴只加伤害; was 10 / 14 / 14 / 18 / 25): it fires the way the player walks, mostly
## away from the crowd, and alone it dealt about 56 a second at full level at 8:00 in the bot's
## hands, a tenth of a job weapon; about 97 now (players who turn to face the crowd hit more).
const DAMAGE := [20.0, 28.0, 28.0, 36.0, 50.0]
## Enemies each file passes through. Players walk away from a crowd as often as into it, so a
## file that reaches the crowd has to count for more than one hit.
## 0.3.9 (the user: 屏保成长伤害加一下 / 复制粘贴穿透改成无限 / 机械键盘初始削弱一点，成长加一点 / 云端部署改 2.2 秒 / 拉会半径大一点 / 无人机伤害加一点 / 邮件伤害加一点):
## through every enemy at every level (2 / 2 / 2 / 2 / 3 until then).
const UNLIMITED := 1 << 20
const PIERCE := [UNLIMITED, UNLIMITED, UNLIMITED, UNLIMITED, UNLIMITED]
## Upgrades never make it faster (.39, the user's call: only 双屏显示器 speeds weapons up); what
## the speed-ups gave went into damage instead, the same damage a second at every level.
const COOLDOWN := [0.7, 0.7, 0.7, 0.7, 0.7]
const SPEED := 300.0
const SPACING := 8.0
const SIZE := 13.0


func cooldown() -> float:
	return stat(COOLDOWN)


func fire() -> bool:
	for i in (8 if evolved else 1):
		_volley(player.facing.rotated(TAU * i / 8.0))
	return true


func _volley(direction: Vector2) -> void:
	var count: int = stat(COUNT)
	var side := direction.orthogonal()
	for i in count:
		var projectile := spawn_projectile(SIZE, direction * SPEED, stat(DAMAGE), stat(PIERCE), 0.9)
		projectile.position += side * (i - (count - 1) / 2.0) * SPACING
		projectile.align_to_velocity = true
