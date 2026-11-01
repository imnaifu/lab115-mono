class_name MeleeAttack
extends BossAttack
## 近战 (.45): the boss itself.
## - "dash": a lane from it towards the player and on past them fills in; then it rushes down the
##   lane, hitting the player once if its body passes over them, and shoving them out to the side.
## - "sweep": a fan towards the player fills in and goes off.
## - "leap": it jumps to where the player stood; the landing circle goes off as it lands.
## - "slam": a circle round itself fills in and goes off, shoving the player out of it.
## It stands while the shape fills, and a moment after (RECOVER) before walking on.

enum Stage { DONE, WARN, ACT, RECOVER }

const DASH_SPEED := 300.0
const RECOVER := 0.3
## How high a leap goes, at its top.
const LEAP_HEIGHT := 46.0
const SHOVE := 170.0
## A lane is never shorter than this, even with a wall right in front.
const MIN_RUN := 24.0

var _stage := Stage.DONE
var _direction := Vector2.RIGHT
var _from := Vector2.ZERO
var _to := Vector2.ZERO
## How far this dash goes (its lane's length, cut short by a building).
var _run := 0.0
var _act_left := 0.0
var _recover_left := 0.0
var _hit := false
var _zone: Zone


func start() -> void:
	var to_player := player().position - enemy.position
	_direction = to_player.normalized() if to_player.length() > 0.1 else Vector2.RIGHT
	_from = enemy.position
	_hit = false
	_stage = Stage.WARN
	var warn: float = config["warn"]
	match form():
		"dash":
			var width: float = config["width"]
			# Only as far as it can go: a building stops it, so the lane stops there too.
			var length := _clear_run(config["length"])
			_run = length
			# The lane is everything its body will sweep: from behind it to past where it stops.
			_zone = rect(_from + _direction * length / 2.0, Vector2(length / 2.0 + width / 2.0, width / 2.0), _direction.angle(), warn)
			_zone.armed = false
			_zone.fills_along = true
		"sweep":
			_zone = Zone.new()
			_zone.shape = "fan"
			_zone.center = _from
			_zone.radius = config["radius"]
			_zone.angle = _direction.angle()
			_zone.spread = deg_to_rad(config["angle"])
			_zone.fuse = warn
			add_zone(_zone)
		"leap":
			_to = game.city.resolve(player().position, enemy.radius)
			_zone = circle(_to, config["radius"], warn)
		"slam":
			_zone = circle(_from, config["radius"], warn)


func busy() -> bool:
	return _stage != Stage.DONE


func tick(delta: float) -> Vector2:
	match _stage:
		Stage.WARN:
			if form() == "leap":
				# Up and across while the landing circle fills; down as it goes off.
				var progress := _zone.progress()
				enemy.position = _from.lerp(_to, smoothstep(0.0, 1.0, progress))
				enemy.lift = sin(progress * PI) * LEAP_HEIGHT
			else:
				enemy.bracing = true
			return Vector2.ZERO
		Stage.ACT:
			_act_left -= delta
			_check_body_hit()
			if _act_left <= 0.0:
				_recover()
			return _direction * DASH_SPEED
		Stage.RECOVER:
			_recover_left -= delta
			if _recover_left <= 0.0:
				_stage = Stage.DONE
	return Vector2.ZERO


func went_off(zone: Zone) -> void:
	if zone != _zone:
		return
	enemy.bracing = false
	match form():
		"dash":
			# Lit for as long as the rush takes.
			_act_left = _run / DASH_SPEED
			zone.flash_left = _act_left
			_stage = Stage.ACT
			Sound.play("blink")
		"leap":
			enemy.position = _to
			enemy.lift = 0.0
			_shove_out(zone)
			Sound.play("quake")
			_recover()
		_:
			_shove_out(zone)
			Sound.play("quake")
			_recover()


## Rushing down its lane (Enemy.is_charging).
func dashing() -> bool:
	return _stage == Stage.ACT


func clear() -> void:
	super()
	_stage = Stage.DONE
	enemy.lift = 0.0
	enemy.bracing = false


## How far it can rush from where it stands, up to `length`, before a building is in the way.
func _clear_run(length: float) -> float:
	var step := 6.0
	var run := 0.0
	while run + step <= length:
		var point := _from + _direction * (run + step)
		if game.city.resolve(point, enemy.radius) != point:
			break
		run += step
	return maxf(run, MIN_RUN)


func _recover() -> void:
	_stage = Stage.RECOVER
	_recover_left = RECOVER


## A dash hits once, when its body (as wide as the lane) passes over the player.
func _check_body_hit() -> void:
	if _hit:
		return
	var reach: float = (config["width"] as float) / 2.0 + Player.HURT_RADIUS
	if enemy.position.distance_to(player().position) > reach:
		return
	_hit = true
	hurt(config["damage"])
	# Out to whichever side of the lane they were on.
	var side := _direction.orthogonal()
	if side.dot(player().position - enemy.position) < 0.0:
		side = -side
	player().shove(side * SHOVE)


## Caught in a sweep, a slam or a landing: shoved out, away from the middle.
func _shove_out(zone: Zone) -> void:
	if not inside(zone, player().position):
		return
	var away := player().position - zone.center
	player().shove((away.normalized() if away.length() > 0.1 else _direction) * SHOVE)
