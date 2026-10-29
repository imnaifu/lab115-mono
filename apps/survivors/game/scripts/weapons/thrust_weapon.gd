class_name ThrustWeapon
extends Weapon
## Three quick stabs at the nearest enemy, the last the hardest, each going through everything
## along a long narrow line. At full level the far half of the line hits harder.
## (Silicon Valley: 订书机, stapling through a stack.) Hades' Eternal Spear: its three-stab combo,
## and Extending Jab at level 5 (+40% reach, +40% damage far off).

## Damage of the first, second and third stab, per level.
const DAMAGE := [[8.0, 10.0, 10.0], [10.0, 12.0, 12.0], [10.0, 12.0, 12.0], [12.0, 15.0, 15.0], [14.0, 18.0, 18.0]]
const LENGTH := [80.0, 80.0, 95.0, 95.0, 133.0]
const WIDTH := [10.0, 10.0, 12.0, 12.0, 14.0]
const COOLDOWN := [1.4, 1.4, 1.3, 1.3, 1.2]
const STAB_GAP := 0.12
const FAR_BONUS_FROM_LEVEL := 5
const FAR_BONUS := 1.4
const KNOCKBACK := 40.0

var _stab := 3
var _stab_left := 0.0


func cooldown() -> float:
	return stat(COOLDOWN)


func fire() -> bool:
	if game.nearest_enemy(player.position, stat(LENGTH)) == null:
		return false
	_stab = 0
	_stab_left = 0.0
	return true


func _process(delta: float) -> void:
	super(delta)
	if _stab >= 3:
		return
	_stab_left -= delta
	if _stab_left <= 0.0:
		_stab_left = STAB_GAP
		_stab_once(stat(DAMAGE)[_stab])
		_stab += 1


func _stab_once(base_damage: float) -> void:
	var length: float = stat(LENGTH)
	var width: float = stat(WIDTH)
	# Aimed again for every stab: the first may have killed what the combo started on.
	var target := game.nearest_enemy(player.position, length)
	var direction := player.facing if target == null else (target.position - player.position).normalized()
	var damage := base_damage * damage_scale()
	var hits := 0
	var hit_boss := false
	for enemy in game.query_enemies(player.position + direction * length / 2.0, length / 2.0 + width):
		var offset := enemy.position - player.position
		var along := offset.dot(direction)
		if along < -enemy.radius or along > length + enemy.radius:
			continue
		if absf(offset.dot(direction.orthogonal())) > width / 2.0 + enemy.radius:
			continue
		var far := level >= FAR_BONUS_FROM_LEVEL and along > length / 2.0
		game.damage_enemy(enemy, damage * (FAR_BONUS if far else 1.0), direction * KNOCKBACK, id)
		hits += 1
		hit_boss = hit_boss or enemy.is_elite
	Effects.lash(game, player.position, direction, length, width)
	game.melee_impact(hits, hit_boss)
