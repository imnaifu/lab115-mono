class_name RangedAttack
extends BossAttack
## 远程 (.45): bullets (HostileShot), after a wind-up of `warn` seconds, aimed at where the player
## was when it began. The boss stands until the last is out; the bullets fly on.
## - "aimed": a thin red line from it through the player, then `count` bullets down it, `every`
##   seconds apart.
## - "spread": `count` thin lines fanning out `step` degrees apart, then a bullet down each.
## - "ring": a ring closing on it, then `count` bullets out all round, one straight at the player;
##   with `rings` > 1 another every `every` seconds, turned half a gap.
## - "spiral": it turns once round over `seconds`, throwing a bullet every `every` (from `arms`
##   sides at once), starting at the player and turning clockwise.
## - "homing": `count` slow bullets, `every` seconds apart, each turning towards the player at up to
##   `turn` degrees a second, gone after `life` seconds.

enum Stage { DONE, WARN, FIRE }

## How far the aim lines reach, about the screen's width.
const AIM_LENGTH := 360.0

var _stage := Stage.DONE
var _direction := Vector2.RIGHT
var _warn_left := 0.0
var _fired := 0
var _shots := 0
var _next_left := 0.0


func start() -> void:
	var to_player := player().position - enemy.position
	_direction = to_player.normalized() if to_player.length() > 0.1 else Vector2.RIGHT
	_warn_left = config["warn"]
	_stage = Stage.WARN
	_fired = 0
	_next_left = 0.0
	match form():
		"ring":
			_shots = config["rings"]
		"spiral":
			_shots = ceili((config["seconds"] as float) / (config["every"] as float))
		"spread":
			_shots = 1
		_:
			_shots = config["count"]


func busy() -> bool:
	return _stage != Stage.DONE


func tick(delta: float) -> Vector2:
	enemy.bracing = _stage == Stage.WARN
	match _stage:
		Stage.WARN:
			_warn_left -= delta
			if _warn_left <= 0.0:
				_stage = Stage.FIRE
		Stage.FIRE:
			_next_left -= delta
			while _next_left <= 0.0 and _fired < _shots:
				_fire(_fired)
				_fired += 1
				_next_left += config.get("every", 0.0)
			if _fired >= _shots:
				_stage = Stage.DONE
	return Vector2.ZERO


func clear() -> void:
	super()
	_stage = Stage.DONE


## The `index`-th volley.
func _fire(index: int) -> void:
	var speed: float = config["speed"]
	var damage := Enemy._hits(config["damage"])
	match form():
		"aimed":
			_shoot(_direction, speed, damage)
		"spread":
			var count: int = config["count"]
			var step := deg_to_rad(config["step"])
			for i in count:
				_shoot(_direction.rotated((i - (count - 1) / 2.0) * step), speed, damage)
		"ring":
			var count: int = config["count"]
			# The first ring has one straight at the player; each next one is turned half a gap.
			var turn := 0.5 * index
			for i in count:
				_shoot(_direction.rotated(TAU * (i + turn) / count), speed, damage)
		"spiral":
			var arms: int = config["arms"]
			var heading := _direction.rotated(TAU * index / float(_shots))
			for arm in arms:
				_shoot(heading.rotated(TAU * arm / arms), speed, damage)
		"homing":
			var aim := (player().position - enemy.position).normalized()
			_shoot(aim, speed, damage, deg_to_rad(config["turn"]), config["life"])
	Sound.play("boss_fire")


func _shoot(heading: Vector2, speed: float, damage: float, turn := 0.0, life := HostileShot.BULLET_SECONDS) -> void:
	game.fire_bullet(enemy.position + heading * enemy.radius, heading * speed, damage, enemy.type_name, form(), turn, life)


func draw(canvas: CanvasItem) -> void:
	if _stage == Stage.DONE:
		return
	var at := enemy.position
	var red := Art.BOSS_RED
	var closing := clampf(_warn_left / (config["warn"] as float), 0.0, 1.0)
	match form():
		"aimed":
			var alpha := 0.85 if _stage == Stage.WARN else 0.35
			canvas.draw_dashed_line(at, at + _direction * AIM_LENGTH, Color(red, alpha), 1.5, 6.0)
		"spread":
			if _stage == Stage.WARN:
				var count: int = config["count"]
				var step := deg_to_rad(config["step"])
				for i in count:
					var heading := _direction.rotated((i - (count - 1) / 2.0) * step)
					canvas.draw_dashed_line(at, at + heading * AIM_LENGTH * 0.6, Color(red, 0.7), 1.2, 5.0)
		_:
			if _stage == Stage.WARN:
				# A ring tightening onto it: it fires when the ring closes.
				canvas.draw_arc(at, enemy.radius + 4.0 + 18.0 * closing, 0.0, TAU, 40, Color(red, 0.9 - 0.4 * closing), 2.5, true)
