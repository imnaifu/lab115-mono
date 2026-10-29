class_name Perks
extends RefCounted
## The passives that do something rather than change a number (Upgrades applies those): they
## keep their own timers and react to kills and hits. Levels are read from
## Upgrades.passive_levels, so a perk does nothing until it is picked.
##
## - stock (股票期权): vests a little more damage every minute after it is picked.
## - scapegoat (背锅侠): a hit on the player blasts the enemies around them for several times it.
## - cost_cut (降本增效): a killed enemy may explode and hurt its neighbours, which may explode too.
## - open_source (开源项目): a killed enemy may leave a turret behind for a few seconds.
## - standup (站会): every so often knocks back and stuns everything close.
## - nap (午休): standing still for a moment heals quickly.
## (headhunter, 猎头电话, adds level-up choices; Upgrades.choice_count reads it.)

const VESTING_SECONDS := 60.0
## Damage vested per minute, per level.
const VESTING_MIGHT := 0.02
const SCAPEGOAT_RADIUS := 70.0
const SCAPEGOAT_MULTIPLIER := [3.0, 4.0, 5.0, 6.0, 8.0]
const BLAST_CHANCE := [0.05, 0.08, 0.11, 0.14, 0.18]
const BLAST_DAMAGE := [18.0, 24.0, 30.0, 36.0, 45.0]
const BLAST_RADIUS := 36.0
## Blasts are queued and set off a few per frame, so a chain ripples outward instead of
## clearing the screen in one frame.
const MAX_BLASTS_PER_FRAME := 6
const TURRET_CHANCE := [0.02, 0.03, 0.04, 0.05, 0.06]
const TURRET_SECONDS := 8.0
const MAX_TURRETS := 4
const STANDUP_EVERY := [14.0, 12.0, 10.0, 9.0, 8.0]
const STANDUP_RADIUS := 100.0
const STANDUP_DAMAGE := [10.0, 15.0, 20.0, 25.0, 30.0]
const STANDUP_STUN := 1.0
const STANDUP_PUSH := 120.0
## Seconds of standing still before the nap starts, then HP per second by level.
const NAP_AFTER := 1.0
const NAP_REGEN := [1.5, 2.5, 3.5, 4.5, 6.0]

var _game: Game
var _vesting_left := VESTING_SECONDS
var _standup_left := 0.0
var _still_for := 0.0
var _blasts: Array[Vector2] = []
var _turrets: Array[Turret] = []


func _init(game: Game) -> void:
	_game = game


## Called every frame of play.
func tick(delta: float) -> void:
	var player := _game.player
	var stock := _level("stock")
	if stock > 0:
		_vesting_left -= delta
		if _vesting_left <= 0.0:
			_vesting_left += VESTING_SECONDS
			player.might += VESTING_MIGHT * stock

	var standup := _level("standup")
	if standup > 0:
		_standup_left -= delta
		if _standup_left <= 0.0:
			_standup_left = _stat(STANDUP_EVERY, standup)
			_hold_standup(_stat(STANDUP_DAMAGE, standup))

	var nap := _level("nap")
	_still_for = _still_for + delta if player.velocity.length_squared() < 1.0 else 0.0
	var napping := nap > 0 and _still_for >= NAP_AFTER
	player.set_napping(napping)
	if napping and player.hp < player.max_hp:
		player.heal(_stat(NAP_REGEN, nap) * delta)

	var cost_cut := _level("cost_cut")
	for i in mini(_blasts.size(), MAX_BLASTS_PER_FRAME):
		_blast(_blasts.pop_front(), _stat(BLAST_DAMAGE, cost_cut))

	for i in range(_turrets.size() - 1, -1, -1):
		if not _turrets[i].tick(delta):
			_turrets.remove_at(i)


func on_kill(enemy: Enemy) -> void:
	var cost_cut := _level("cost_cut")
	if cost_cut > 0 and _game.rng.randf() < _stat(BLAST_CHANCE, cost_cut):
		_blasts.append(enemy.position)
	var open_source := _level("open_source")
	if open_source > 0 and _turrets.size() < MAX_TURRETS and _game.rng.randf() < _stat(TURRET_CHANCE, open_source):
		var turret := Turret.new()
		turret.game = _game
		turret.seconds_left = TURRET_SECONDS
		turret.position = _game.city.resolve(enemy.position, 6.0)
		_game.entity_layer.add_child(turret)
		_turrets.append(turret)


## The player just lost `amount` HP.
func on_hurt(amount: float) -> void:
	var scapegoat := _level("scapegoat")
	if scapegoat == 0:
		return
	var player := _game.player
	var damage: float = amount * _stat(SCAPEGOAT_MULTIPLIER, scapegoat) * player.might
	Effects.ring(_game, player.position, SCAPEGOAT_RADIUS, Art.INK)
	for enemy in _game.query_enemies(player.position, SCAPEGOAT_RADIUS):
		_game.damage_enemy(enemy, damage, (enemy.position - player.position).normalized() * 80.0, "scapegoat")


func _hold_standup(damage: float) -> void:
	var player := _game.player
	Effects.ring(_game, player.position, STANDUP_RADIUS, Art.BLUE)
	Sound.play("standup")
	for enemy in _game.query_enemies(player.position, STANDUP_RADIUS):
		enemy.stun(STANDUP_STUN)
		_game.damage_enemy(enemy, damage * player.might, (enemy.position - player.position).normalized() * STANDUP_PUSH, "standup", true)


func _blast(at: Vector2, damage: float) -> void:
	Effects.ring(_game, at, BLAST_RADIUS, Color("ff8a5c"))
	for enemy in _game.query_enemies(at, BLAST_RADIUS):
		_game.damage_enemy(enemy, damage * _game.player.might, (enemy.position - at).normalized() * 60.0, "cost_cut", true)


func _level(perk_id: String) -> int:
	return _game.upgrades.passive_levels.get(perk_id, 0)


static func _stat(table: Array, level: int) -> float:
	return table[clampi(level, 1, table.size()) - 1]
