class_name SquadWeapon
extends Weapon
## Outsourced decoys: little workers who keep close round the player. Enemies near one go after it
## instead of the player (bosses don't fall for it, Game._lure_for), wear it down by touching it,
## and get hit back; one knocked down is replaced after a few seconds. (Silicon Valley: 外包团队,
## there to take the hits.) They used to walk out and fight enemies near the player, as the drones
## and the ops' guard wall do in their own ways.

const COUNT := [2, 3, 3, 4, 5]
## Per hit on whatever touches the worker, every ATTACK_GAP seconds.
const DAMAGE := [6.0, 6.0, 9.0, 9.0, 12.0]
const WORKER_HP := [40.0, 40.0, 60.0, 60.0, 80.0]
## Enemies this close to a standing worker go for it rather than the player.
const LURE_RADIUS := 70.0
## Workers keep this far round the player, slowly turning so they spread out.
const STATION_RADIUS := 44.0
const STATION_SPIN := 0.6
const SPEED := 75.0
const ATTACK_GAP := 0.6
const RESPAWN_SECONDS := 4.0
const BODY_RADIUS := 6.0
const SIZE := 16.0


class Worker:
	var sprite: Sprite2D
	var position := Vector2.ZERO
	var hp := 0.0
	var down_left := 0.0
	var attack_left := 0.0


var _workers: Array[Worker] = []
var _clock := 0.0


func _process(delta: float) -> void:
	_clock += delta
	while _workers.size() < stat(COUNT):
		var worker := Worker.new()
		worker.sprite = Art.sprite(art, SIZE)
		game.entity_layer.add_child(worker.sprite)
		_hire(worker, _workers.size())
		_workers.append(worker)
	var damage: float = stat(DAMAGE) * damage_scale()
	var standing: Array[Vector2] = []
	for i in _workers.size():
		var worker := _workers[i]
		if worker.down_left > 0.0:
			worker.down_left -= delta
			if worker.down_left <= 0.0:
				_hire(worker, i)
			continue
		var station := player.position + Vector2.from_angle(_clock * STATION_SPIN + TAU * i / _workers.size()) * STATION_RADIUS
		var to_station := station - worker.position
		if to_station.length() > 1.0:
			worker.position = game.city.resolve(worker.position + to_station.normalized() * minf(SPEED * delta, to_station.length()), BODY_RADIUS)
			if absf(to_station.x) > 0.5:
				worker.sprite.flip_h = to_station.x < 0.0
		worker.attack_left -= delta
		var touching := game.query_enemies(worker.position, BODY_RADIUS)
		if worker.attack_left <= 0.0 and not touching.is_empty():
			worker.attack_left = ATTACK_GAP
			for enemy in touching:
				game.damage_enemy(enemy, damage, (enemy.position - worker.position).normalized() * 40.0, id)
		_take_hits(worker, touching, delta)
		worker.sprite.position = worker.position + Vector2(0, -absf(sin(_clock * 12.0 + i)) * 1.5)
		if worker.down_left <= 0.0:
			standing.append(worker.position)
	game.decoys = standing


## A weapon going (a job switched on the title screen) takes its decoys with it.
func _exit_tree() -> void:
	game.decoys = []


## Enemies touching a worker wear it down by their contact damage per second.
func _take_hits(worker: Worker, touching: Array[Enemy], delta: float) -> void:
	var worst := 0.0
	for enemy in touching:
		if not enemy.dead:
			worst = maxf(worst, enemy.damage)
	if worst <= 0.0:
		return
	worker.hp -= worst * delta
	if worker.hp <= 0.0:
		worker.down_left = RESPAWN_SECONDS
		worker.sprite.visible = false
		Effects.poof(game, worker.position, Art.YELLOW)


func _hire(worker: Worker, index: int) -> void:
	worker.hp = stat(WORKER_HP)
	worker.position = game.city.resolve(player.position + Vector2.from_angle(TAU * index / maxi(stat(COUNT), 1)) * STATION_RADIUS, BODY_RADIUS)
	worker.sprite.position = worker.position
	worker.sprite.visible = true
