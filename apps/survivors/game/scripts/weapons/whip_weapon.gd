class_name WhipWeapon
extends Weapon
## A lash along the way the player faces, hitting everything in a long strip; from level 2 a
## second lash follows behind. (Silicon Valley: 网线鞭, a network cable.) Vampire Survivors' whip.
## 光纤 (evolved with 人脉名片): twice as long, all four ways at once.

const DAMAGE := [16.0, 16.0, 22.0, 22.0, 32.0]
const LENGTH := [100.0, 100.0, 100.0, 120.0, 140.0]
const WIDTH := [20.0, 20.0, 20.0, 22.0, 26.0]
const COOLDOWN := [1.2, 1.2, 1.1, 1.0, 0.9]
const BOTH_WAYS_FROM_LEVEL := 2
const BACK_LASH_DELAY := 0.15
const KNOCKBACK := 60.0

var _back_lash_left := -1.0
var _back_direction := Vector2.ZERO


func cooldown() -> float:
	return stat(COOLDOWN)


func fire() -> bool:
	var length: float = stat(LENGTH) * (2.0 if evolved else 1.0)
	if evolved:
		for i in 4:
			_lash(player.facing.rotated(PI / 2.0 * i), length)
		return true
	_lash(player.facing, length)
	if level >= BOTH_WAYS_FROM_LEVEL:
		_back_lash_left = BACK_LASH_DELAY
		_back_direction = -player.facing
	return true


func _process(delta: float) -> void:
	super(delta)
	if _back_lash_left > 0.0:
		_back_lash_left -= delta
		if _back_lash_left <= 0.0:
			_lash(_back_direction, stat(LENGTH))


func _lash(direction: Vector2, length: float) -> void:
	var width: float = stat(WIDTH)
	var damage: float = stat(DAMAGE) * damage_scale()
	var hits := 0
	var hit_boss := false
	var middle := player.position + direction * length / 2.0
	for enemy in game.query_enemies(middle, Vector2(length / 2.0, width / 2.0).length()):
		var offset := enemy.position - player.position
		var along := offset.dot(direction)
		var across := absf(offset.dot(direction.orthogonal()))
		if along < -enemy.radius or along > length + enemy.radius or across > width / 2.0 + enemy.radius:
			continue
		game.damage_enemy(enemy, damage, direction * KNOCKBACK, id)
		hits += 1
		hit_boss = hit_boss or enemy.is_elite
	Effects.lash(game, player.position, direction, length, width)
	game.melee_impact(hits, hit_boss)
