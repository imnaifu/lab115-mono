class_name Ultimates
extends RefCounted
## Each job's 大招 (.81, the user's design: 一个主动，一局放一次; Jobs.ULTIMATES names them). The
## player sets it off once a run (the round button top right, or Space); a 返聘 doesn't
## bring it back. Going off it freezes the game a moment (Game.hitstop), shouts the job's line
## and does its job's thing; `went_off` brings up the HUD's banner saying what it does. Until .93
## every job's also threw a yellow ring round the player that meant nothing (the user: 一开始有个
## 黄圈是什么意思); now only the data scientist's draws one, as far as it reaches. What lasts has an
## UltimateTimer over it and the HUD's button counts it down (`seconds_left`):
## - 程序员 全量发布: WAVES spirals of WAVE_KEYS Enter keys, each the Enter key's own hit times
##   KEY_DAMAGE_SCALE, through everything, out to the screen's edge.
## - 产品经理 今天必须上线: BOOST_SECONDS untouchable and BOOST_SPEED faster (Player.boost_left),
##   inside a gold shield; what it stops says 免疫 (Player.take_damage).
## - 设计师 复制图层: a PlayerClone with every weapon and stat, PlayerClone.SECONDS at most.
## - 运维 扩容: a ServerTurret where the player stands, its shells the firewall's hit times
##   TURRET_DAMAGE_SCALE.
## - 数据科学家 改标签: up to RELABEL_MAX of the crowd (no boss) within RELABEL_RADIUS turn on the
##   rest for Enemy.ALLY_SECONDS at most, hitting as hard as they did (the user: 伤害不要加大).

const WAVES := 3
## 80 a wave since .91 (the user: 程序员大招也削弱下，数量少一点; 120 before).
const WAVE_KEYS := 80
const WAVE_GAP := 0.2
## Each wave turns this much further, so the three make a spiral.
const WAVE_TURN := 1.0
const KEY_SPEED := 260.0
const KEY_SIZE := 18.0
const KEY_DAMAGE_SCALE := 10.0
const BOOST_SECONDS := 5.0
const BOOST_SPEED := 1.5
const TURRET_DAMAGE_SCALE := 3.0
const RELABEL_RADIUS := 180.0
const RELABEL_MAX := 40
const CAST_HITSTOP := 0.3
const SOURCE := "ultimate"
## The product manager's shield round the player, a little wider than the body.
const SHIELD_RADIUS := 26.0

signal went_off

var used := false
## The run second it went off, -1 until then (for the run's data).
var used_at := -1.0

var _game: Game


func _init(game: Game) -> void:
	_game = game


func ready() -> bool:
	return not used and _game.state == Game.State.PLAYING


## Sets the job's 大招 off, once a run.
func cast() -> void:
	if not ready():
		return
	used = true
	used_at = _game.elapsed
	var player := _game.player
	var ultimate := Jobs.ultimate(player.job)
	_game.hitstop(CAST_HITSTOP, true)
	# High enough to clear the countdown over the player's head (UltimateTimer).
	Effects.callout(_game, player.position + Vector2(0.0, -44.0), _game.tr(ultimate["line"]), Art.BRAND, 16)
	Sound.play("standup")
	match player.job:
		"coder":
			_release()
		"pm":
			player.boost_left = BOOST_SECONDS
			_mark(player, Player.SIZE * 0.5 + 8.0, func() -> float: return player.boost_left, SHIELD_RADIUS)
		"designer":
			_copy_layer()
		"ops":
			_scale_out()
		"data_scientist":
			_relabel()
	went_off.emit()


## While it lasts: the seconds left of it (the longest-lasting copy, server or ally), 0 when it
## is over or never lasted (全量发布), and how long it lasts in all.
func seconds_left() -> float:
	var left := 0.0
	match _game.player.job:
		"pm":
			left = _game.player.boost_left
		"designer":
			for clone in _game.clones:
				if is_instance_valid(clone) and not clone.is_queued_for_deletion():
					left = maxf(left, clone.seconds_left)
		"ops":
			for turret in _game.turrets:
				if is_instance_valid(turret):
					left = maxf(left, turret.seconds_left)
		"data_scientist":
			for enemy in _game.enemies:
				left = maxf(left, enemy.ally_left)
	return left if used else 0.0


func duration() -> float:
	match _game.player.job:
		"pm":
			return BOOST_SECONDS
		"designer":
			return PlayerClone.SECONDS
		"ops":
			return ServerTurret.SECONDS
		"data_scientist":
			return Enemy.ALLY_SECONDS
	return 0.0


## How many of the crowd are still on the player's side (改标签).
func allies() -> int:
	return _game.enemies.reduce(func(count: int, enemy: Enemy) -> int: return count + (1 if enemy.ally_left > 0.0 else 0), 0)


## An UltimateTimer over `host`, `above` its feet, counting down what `left_of` returns.
func _mark(host: Node2D, above: float, left_of: Callable, shield_radius := 0.0) -> void:
	var timer := UltimateTimer.new()
	timer.word = Jobs.ultimate(_game.player.job)["timer"]
	timer.total = duration()
	timer.left_of = left_of
	timer.above = above
	timer.shield_radius = shield_radius
	host.add_child(timer)


## 全量发布: the spirals, a wave every WAVE_GAP.
func _release() -> void:
	var enter := _game.player.get_weapon("enter")
	var hit: float = (AimedWeapon.branch_stats(enter.branch_a, enter.branch_b)["damage"] * enter.damage_scale()) if enter != null \
		else AimedWeapon.BASE_DAMAGE * _game.player.might
	for wave in WAVES:
		if wave == 0:
			_wave(wave, hit)
		else:
			_game.get_tree().create_timer(WAVE_GAP * wave, false).timeout.connect(_wave.bind(wave, hit))


func _wave(wave: int, hit: float) -> void:
	if _game.state == Game.State.ENDED:
		return
	var player := _game.player
	var reach := _game.view_half().length() + 40.0
	for i in WAVE_KEYS:
		var direction := Vector2.from_angle(TAU * i / WAVE_KEYS + deg_to_rad(WAVE_TURN * wave * 1.5))
		var key := Projectile.new()
		key.setup(_game, SOURCE, "enter_key", KEY_SIZE, player.position, direction * KEY_SPEED, hit * KEY_DAMAGE_SCALE, 1 << 20, reach / KEY_SPEED)
		key.knockback = 0.0
		key.hit_radius = KEY_SIZE * 0.4
		_game.effect_layer.add_child(key)


func _copy_layer() -> void:
	var clone := PlayerClone.new()
	clone.game = _game
	clone.job = _game.player.job
	_game.entity_layer.add_child(clone)
	clone.copy_from(_game.player)
	_game.clones.append(clone)
	Effects.poof(_game, clone.position, Color(0.7, 0.85, 1.0))
	_mark(clone, Player.SIZE * 0.5 + 8.0, func() -> float: return clone.seconds_left, 0.0)


func _scale_out() -> void:
	var turret := ServerTurret.new()
	turret.game = _game
	var walls := _game.player.get_weapon("firewall")
	var hit: float = (OrbitWeapon.branch_stats(walls.branch_a, walls.branch_b)["damage"] * walls.damage_scale()) if walls != null \
		else OrbitWeapon.BASE_DAMAGE * _game.player.might
	turret.damage = hit * TURRET_DAMAGE_SCALE
	turret.position = _game.player.position
	_game.entity_layer.add_child(turret)
	_game.turrets.append(turret)
	_mark(turret, ServerTurret.SIZE + 8.0, func() -> float: return turret.seconds_left, 0.0)


func _relabel() -> void:
	# How far it reached, in the allies' green, so the player sees which of the crowd it took.
	Effects.ring(_game, _game.player.position, RELABEL_RADIUS, Enemy.ALLY_TINT)
	var near := _game.query_enemies(_game.player.position, RELABEL_RADIUS, false)
	near.sort_custom(func(a: Enemy, b: Enemy) -> bool:
		return a.position.distance_squared_to(_game.player.position) < b.position.distance_squared_to(_game.player.position))
	var turned := 0
	for enemy in near:
		if enemy.is_elite or turned >= RELABEL_MAX:
			continue
		enemy.make_ally()
		turned += 1
