class_name SquadWeapon
extends Weapon
## Little workers that walk out to enemies near the player and hit them; enemies hurt them back,
## and one knocked down is replaced after a few seconds. (Silicon Valley: 外包团队.)

const COUNT := [2, 3, 3, 4, 5]
## Per hit, every ATTACK_GAP seconds.
const DAMAGE := [8.0, 8.0, 11.0, 11.0, 14.0]
const WORKER_HP := [40.0, 40.0, 55.0, 55.0, 70.0]
const SPEED := 70.0
const ATTACK_GAP := 0.6
## Workers go after enemies this close to the player, and drop one that gets further than LEASH.
const SEEK_RANGE := 160.0
const LEASH := 220.0
const RESPAWN_SECONDS := 4.0
const REACH := 4.0
const BODY_RADIUS := 5.0
const SIZE := 16.0
## Idle workers stand this far round the player.
const IDLE_RADIUS := 26.0


class Worker:
	var sprite: Sprite2D
	var position := Vector2.ZERO
	var hp := 0.0
	var down_left := 0.0
	var attack_left := 0.0
	var target: Enemy


var _workers: Array[Worker] = []


func _process(delta: float) -> void:
	while _workers.size() < stat(COUNT):
		var worker := Worker.new()
		worker.sprite = Art.sprite(art, SIZE)
		game.entity_layer.add_child(worker.sprite)
		_hire(worker, _workers.size())
		_workers.append(worker)
	var damage: float = stat(DAMAGE) * damage_scale()
	for i in _workers.size():
		var worker := _workers[i]
		if worker.down_left > 0.0:
			worker.down_left -= delta
			if worker.down_left <= 0.0:
				_hire(worker, i)
			continue
		if not _target_still_good(worker):
			worker.target = game.nearest_enemy(worker.position, SEEK_RANGE)
			if worker.target != null and worker.target.position.distance_to(player.position) > SEEK_RANGE:
				worker.target = null
		var goal := player.position + Vector2.from_angle(TAU * i / _workers.size()) * IDLE_RADIUS
		if worker.target != null:
			goal = worker.target.position
		var to_goal := goal - worker.position
		var reach := (worker.target.radius + REACH) if worker.target != null else 2.0
		if to_goal.length() > reach:
			worker.position = game.city.resolve(worker.position + to_goal.normalized() * minf(SPEED * delta, to_goal.length()), BODY_RADIUS)
			if absf(to_goal.x) > 0.5:
				worker.sprite.flip_h = to_goal.x < 0.0
		worker.attack_left -= delta
		if worker.target != null and to_goal.length() <= reach + 1.0 and worker.attack_left <= 0.0:
			worker.attack_left = ATTACK_GAP
			game.damage_enemy(worker.target, damage, to_goal.normalized() * 40.0, id)
		_take_hits(worker, delta)
		worker.sprite.position = worker.position + Vector2(0, -absf(sin(game.elapsed * 12.0 + i)) * 1.5)


## Enemies touching a worker wear it down by their contact damage per second.
func _take_hits(worker: Worker, delta: float) -> void:
	var worst := 0.0
	for enemy in game.query_enemies(worker.position, BODY_RADIUS):
		worst = maxf(worst, enemy.damage)
	if worst <= 0.0:
		return
	worker.hp -= worst * delta
	if worker.hp <= 0.0:
		worker.down_left = RESPAWN_SECONDS
		worker.target = null
		worker.sprite.visible = false
		Effects.poof(game, worker.position, Art.YELLOW)


func _hire(worker: Worker, index: int) -> void:
	worker.hp = stat(WORKER_HP)
	worker.position = game.city.resolve(player.position + Vector2.from_angle(TAU * index / maxi(stat(COUNT), 1)) * IDLE_RADIUS, BODY_RADIUS)
	worker.sprite.position = worker.position
	worker.sprite.visible = true
	worker.target = null


func _target_still_good(worker: Worker) -> bool:
	return is_instance_valid(worker.target) and not worker.target.dead \
		and worker.target.position.distance_squared_to(player.position) <= LEASH * LEASH
