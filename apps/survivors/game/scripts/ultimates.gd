class_name Ultimates
extends RefCounted
## Each job's 大招 (.81, the user's design: 一个主动; Jobs.ULTIMATES names them). The player sets
## it off with the round button top right, or Space. Once a run until .95; since then kills
## charge it (the user, from PokéBonk: 大招也改成靠冲能 → 改到 1000 → 开局没有 → 充能 500，boss
## 改成 20充能): it starts empty, each kill adds a point and a boss BOSS_CHARGE, and at
## CHARGE_FULL it can go off again, from empty. It doesn't charge while one lasts (no second copy
## or server on top of the first, and the data scientist's turned crowd can't refill it); a 返聘
## doesn't fill it. Set off, the game stands still for SkillCutIn.SECONDS (Game.freeze; 0.1.1, the
## user: 点了后，暂停一下，做一个动画特效，然后再继续) while `winding_up` has the HUD play the
## cut-in with the job's face, the skill's name and the job's line; then, as the game moves again,
## it does its job's thing and `went_off` brings up the HUD's banner saying what it does. Until
## 0.1.1 it only slowed the game 0.3 s and shouted the line over the player's head; since 0.1.1 the
## game calls it 技能, not 大招 (the user: 不要叫大招，全改，叫技能). Until .93
## every job's also threw a yellow ring round the player that meant nothing (the user: 一开始有个
## 黄圈是什么意思); now only the data scientist's draws one, as far as it reaches. What lasts has an
## UltimateTimer over it and the HUD's button counts it down (`seconds_left`):
## - 程序员 全量发布: KEYS Enter keys, one at each hour of a clock face, each the Enter key's own
##   hit, through everything, out to the screen's edge.
## - 产品经理 今天必须上线: BOOST_SECONDS untouchable and BOOST_SPEED faster (Player.boost_left),
##   inside a gold shield; what it stops says 免疫 (Player.take_damage).
## - 设计师 复制图层: a PlayerClone with every weapon and stat, PlayerClone.SECONDS at most.
## - 运维 扩容: a ServerTurret where the player stands, its shells the firewall's hit times
##   TURRET_DAMAGE_SCALE.
## - 数据科学家 改标签: up to RELABEL_MAX of the crowd (no boss) within RELABEL_RADIUS turn on the
##   rest for Enemy.ALLY_SECONDS at most, hitting as hard as they did (the user: 伤害不要加大).

## 12 since .95, one at each hour of a clock face, as hard as the Enter key's own hit (the user,
## with kills charging it: 大招也太强了，削弱，一次只有 12，每个时钟方向一个，伤害和当前回车伤害一样).
## Until then three spirals 0.2 s apart, of 80 keys each (120 before .91), ten times the hit each.
const KEYS := 12
const KEY_SPEED := 260.0
const KEY_SIZE := 18.0
const BOOST_SECONDS := 5.0
const BOOST_SPEED := 1.5
## As hard as the firewall's own hit since .95 (the user, with kills charging it: 大招都整体削弱，因为放的次数多了; 运维 10s, 伤害和墙一样); 3 times it before.
const TURRET_DAMAGE_SCALE := 1.0
## 150 and 10 at most since .95 (the same; 数据改 150，最多 10); 180 and 40 before.
const RELABEL_RADIUS := 150.0
const RELABEL_MAX := 10
const SOURCE := "ultimate"
## The ring round the player as it goes off, after the cut-in: only a flourish, it does nothing.
const GO_OFF_RING := 90.0
## The product manager's shield round the player, a little wider than the body.
const SHIELD_RADIUS := 26.0
## Points to fill it (.95): a kill is one, a boss BOSS_CHARGE. A cleared run kills about 2,150
## (the live runs since .81, 5 of them, and DESIGN.md's earlier counts under drops), so it goes off
## about four times, the first time around 4:30; a run over by 5:00 (about 500) fills it once at most.
const CHARGE_FULL := 500.0
const BOSS_CHARGE := 20.0

## Set off: the game stands still and the HUD plays the cut-in (SkillCutIn).
signal winding_up
## Going off, after the cut-in.
signal went_off
## It just filled up (the HUD says so).
signal charged

## Points towards CHARGE_FULL, back to 0 each time it goes off.
var charge := 0.0
## How many times it went off this run.
var casts := 0
## The run second it first went off, -1 until then (for the run's data, as before .95).
var used_at := -1.0

var _game: Game


func _init(game: Game) -> void:
	_game = game


func ready() -> bool:
	return charge >= CHARGE_FULL and _game.state == Game.State.PLAYING


## Share of the way to the next one, 0 to 1.
func charge_share() -> float:
	return clampf(charge / CHARGE_FULL, 0.0, 1.0)


## A kill (Game._kill) charges it, except while one lasts.
func on_killed(enemy: Enemy) -> void:
	if charge >= CHARGE_FULL or seconds_left() > 0.0:
		return
	charge = minf(CHARGE_FULL, charge + (BOSS_CHARGE if enemy.is_elite else 1.0))
	if charge >= CHARGE_FULL:
		charged.emit()


## Sets the job's 技能 off once it is full, and empties it: the cut-in first, the game standing
## still, then the thing itself (_go_off).
func cast() -> void:
	if not ready():
		return
	charge = 0.0
	casts += 1
	if used_at < 0.0:
		used_at = _game.elapsed
	Sound.play("standup")
	winding_up.emit()
	_game.freeze(SkillCutIn.SECONDS, _go_off)


func _go_off() -> void:
	# Left for the title meanwhile (quit from the pause screen): nothing to go off in.
	if _game.state == Game.State.TITLE or _game.state == Game.State.ENDED:
		return
	var player := _game.player
	Effects.ring(_game, player.position, GO_OFF_RING, Art.BRAND)
	player.shake(0.12, 3.0)
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
	return left if casts > 0 else 0.0


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


## 全量发布: a key towards each hour of the clock, 12 o'clock first.
func _release() -> void:
	var player := _game.player
	var enter := player.get_weapon("enter")
	var hit: float = (AimedWeapon.branch_stats(enter.branch_a, enter.branch_b)["damage"] * enter.damage_scale()) if enter != null \
		else AimedWeapon.BASE_DAMAGE * player.might
	var reach := _game.view_half().length() + 40.0
	for i in KEYS:
		var direction := Vector2.UP.rotated(TAU * i / KEYS)
		var key := Projectile.new()
		key.setup(_game, SOURCE, "enter_key", KEY_SIZE, player.position, direction * KEY_SPEED, hit, 1 << 20, reach / KEY_SPEED)
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
