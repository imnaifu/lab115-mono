class_name RicochetWeapon
extends Weapon
## An email sent at the nearest enemy that, once it lands, flies on to the nearest enemy it hasn't
## hit yet, a few times over. (Silicon Valley: 邮件抄送, cc'ing one more person each bounce.)

## Enemies each email reaches, the first included.
## Toned down from 8 bounces of 18 at full level, a third of a product manager's damage.
const BOUNCES := [3, 4, 4, 5, 6]
const DAMAGE := [10.0, 10.0, 15.0, 15.0, 21.0]
const COUNT := [1, 1, 1, 2, 2]
## Upgrades never make it faster (.39, the user's call: only 双屏显示器 speeds weapons up); what
## the speed-ups gave went into damage instead, the same damage a second at every level.
const COOLDOWN := [1.6, 1.6, 1.6, 1.6, 1.6]
const SPEED := 260.0
const RANGE := 180.0
const JUMP_RANGE := 90.0
const SIZE := 14.0


class Mail:
	var sprite: Sprite2D
	var position := Vector2.ZERO
	var target: Enemy
	var hits_left := 0
	var hit := {}


var _mails: Array[Mail] = []


func cooldown() -> float:
	return stat(COOLDOWN)


func fire() -> bool:
	var targets := game.query_enemies(player.position, RANGE)
	if targets.is_empty():
		return false
	targets.sort_custom(func(a: Enemy, b: Enemy) -> bool:
		return a.position.distance_squared_to(player.position) < b.position.distance_squared_to(player.position))
	for i in mini(stat(COUNT), targets.size()):
		var mail := Mail.new()
		mail.position = player.position
		mail.target = targets[i]
		mail.hits_left = stat(BOUNCES)
		mail.sprite = Art.sprite(art, SIZE)
		mail.sprite.position = mail.position
		game.effect_layer.add_child(mail.sprite)
		_mails.append(mail)
	return true


func _process(delta: float) -> void:
	super(delta)
	var damage: float = stat(DAMAGE) * damage_scale()
	for i in range(_mails.size() - 1, -1, -1):
		var mail := _mails[i]
		if not _target_alive(mail):
			mail.target = _next_target(mail)
		if mail.target == null or mail.hits_left <= 0:
			mail.sprite.queue_free()
			_mails.remove_at(i)
			continue
		var to_target := mail.target.position - mail.position
		var step := SPEED * delta
		if to_target.length() <= mail.target.hit_radius + step:
			mail.position = mail.target.position
			mail.hit[mail.target.get_instance_id()] = true
			mail.hits_left -= 1
			var landed_on := mail.target
			mail.target = null
			game.damage_enemy(landed_on, damage, to_target.normalized() * 40.0, id)
		else:
			mail.position += to_target.normalized() * step
			# Turned to where it flies, mirrored when that is leftward so its arrow leads and it
			# stays the right way up (.39: tilted a fifth of the way, flying left with the arrow
			# pointing right).
			var heading := to_target.angle()
			var leftward := absf(heading) > PI / 2.0
			mail.sprite.flip_h = leftward
			mail.sprite.rotation = wrapf(heading - PI, -PI, PI) if leftward else heading
		mail.sprite.position = mail.position


func _target_alive(mail: Mail) -> bool:
	return is_instance_valid(mail.target) and not mail.target.dead


## The nearest enemy this email hasn't hit yet, within reach of where it is; null if none.
func _next_target(mail: Mail) -> Enemy:
	var best: Enemy = null
	var best_distance := INF
	for enemy in game.query_enemies(mail.position, JUMP_RANGE):
		if mail.hit.has(enemy.get_instance_id()):
			continue
		var distance := enemy.position.distance_squared_to(mail.position)
		if distance < best_distance:
			best_distance = distance
			best = enemy
	return best
