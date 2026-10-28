class_name FacingWeapon
extends Weapon
## Rapid shots thrown the way the player is facing, fanned side by side.
## (Silicon Valley: 复制粘贴.)

const COUNT := [1, 1, 2, 2, 3]
const DAMAGE := [8.0, 11.0, 11.0, 14.0, 14.0]
## Enemies each file passes through. Players walk away from a crowd as often as into it, so a
## file that reaches the crowd has to count for more than one hit.
const PIERCE := [2, 2, 2, 2, 3]
const COOLDOWN := [0.7, 0.7, 0.7, 0.7, 0.5]
const SPEED := 300.0
const SPACING := 8.0
const SIZE := 13.0


func cooldown() -> float:
	return stat(COOLDOWN)


func fire() -> bool:
	var count: int = stat(COUNT)
	var side := player.facing.orthogonal()
	for i in count:
		var projectile := spawn_projectile(SIZE, player.facing * SPEED, stat(DAMAGE), stat(PIERCE), 0.9)
		projectile.position += side * (i - (count - 1) / 2.0) * SPACING
		projectile.align_to_velocity = true
	return true
