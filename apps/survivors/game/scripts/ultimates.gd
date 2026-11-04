class_name Ultimates
extends RefCounted
## Each job's 大招 (.81, the user's design: 一个主动，一局放一次; Jobs.ULTIMATES names them). The
## player sets it off once a run (the round button low on the right, or Space); a 返聘 doesn't
## bring it back. Going off it freezes the game a moment (Game.hitstop), shouts the job's line
## and does its job's thing:
## - 程序员 全量发布: WAVES spirals of WAVE_KEYS Enter keys, each the Enter key's own hit times
##   KEY_DAMAGE_SCALE, through everything, out to the screen's edge.
## - 产品经理 今天必须上线: BOOST_SECONDS untouchable and BOOST_SPEED faster (Player.boost_left).
## - 设计师 复制图层: a PlayerClone with every weapon and stat, PlayerClone.SECONDS at most.
## - 运维 扩容: a ServerTurret where the player stands, its shells the firewall's hit times
##   TURRET_DAMAGE_SCALE.
## - 数据科学家 改标签: up to RELABEL_MAX of the crowd (no boss) within RELABEL_RADIUS turn on the
##   rest for Enemy.ALLY_SECONDS at most, hitting as hard as they did (the user: 伤害不要加大).

const WAVES := 3
const WAVE_KEYS := 120
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
	Effects.ring(_game, player.position, 120.0, Art.BRAND)
	Effects.callout(_game, player.position + Vector2(0.0, -16.0), _game.tr(ultimate["line"]), Art.BRAND, 16)
	Sound.play("standup")
	match player.job:
		"coder":
			_release()
		"pm":
			player.boost_left = BOOST_SECONDS
		"designer":
			_copy_layer()
		"ops":
			_scale_out()
		"data_scientist":
			_relabel()


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


func _relabel() -> void:
	var near := _game.query_enemies(_game.player.position, RELABEL_RADIUS, false)
	near.sort_custom(func(a: Enemy, b: Enemy) -> bool:
		return a.position.distance_squared_to(_game.player.position) < b.position.distance_squared_to(_game.player.position))
	var turned := 0
	for enemy in near:
		if enemy.is_elite or turned >= RELABEL_MAX:
			continue
		enemy.make_ally()
		turned += 1
