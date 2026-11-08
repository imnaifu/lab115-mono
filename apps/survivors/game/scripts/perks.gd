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
## 午休 (nap: standing still a moment healed quickly) was taken out in .53, the user's call.
##
## A rarer card makes each one's main number better for good (effect, Upgrades.perk_bonus); until
## .53 it jumped them a level or two instead.

const VESTING_SECONDS := 60.0
## Damage vested per minute, per level.
const VESTING_MIGHT := 0.02
## The most damage it vests in a run (0.3.13 (the user, after the passives were looked at: 都改): no cap until then, and 无尽模式 made it +10% a minute
## for an hour, about +550% by the end).
const VESTING_CAP := 1.0
## 0.3.13 (the user, after the passives were looked at: 都改): 100 and ×4 / 5 / 6 / 8 / 10 (70 and ×3 / 4 / 5 / 6 / 8 until then): nobody took it, every
## point of it hangs on being hit, so it reaches further and hits back harder for the hits it takes.
const SCAPEGOAT_RADIUS := 100.0
const SCAPEGOAT_MULTIPLIER := [4.0, 5.0, 6.0, 8.0, 10.0]
const BLAST_CHANCE := [0.05, 0.08, 0.11, 0.14, 0.18]
const BLAST_DAMAGE := [18.0, 24.0, 30.0, 36.0, 45.0]
const BLAST_RADIUS := 36.0
## Blasts are queued and set off a few per frame, so a chain ripples outward instead of
## clearing the screen in one frame.
const MAX_BLASTS_PER_FRAME := 6
## 0.3.13 (the user, after the passives were looked at: 都改): 5 / 7.5 / 10 / 12.5 / 15% (2–6% until then; with Turret.SHOT_DAMAGE 8 it added 1–3% to a
## full build alone at 8:00).
const TURRET_CHANCE := [0.05, 0.075, 0.1, 0.125, 0.15]
const TURRET_SECONDS := 8.0
const MAX_TURRETS := 4
## Every 10 s to start with since .35 (it was 14, 12, 10, 9, 8: the user found 14 s far too long
## to wait for).
const STANDUP_EVERY := [10.0, 9.0, 8.0, 7.0, 6.0]
const STANDUP_RADIUS := 100.0
## 0.3.13 (the user, after the passives were looked at: 都改): 15 / 22 / 30 / 37 / 45 (10–30 until then).
const STANDUP_DAMAGE := [15.0, 22.0, 30.0, 37.0, 45.0]
const STANDUP_STUN := 1.0
## Only a jolt since 0.3.13 (the user, after the passives were looked at: 都改) (120 until then): it threw the crowd out of a close-in weapon's reach,
## and the product manager's laser dealt about 5% less with it than without.
const STANDUP_PUSH := 20.0

var _game: Game
var _vesting_left := VESTING_SECONDS
## Damage vested by 股票期权 so far this run (VESTING_CAP).
var _vested := 0.0
var _standup_left := 0.0
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
			# Up to VESTING_CAP in all (0.3.13).
			var vested := minf(effect("stock", stock, _bonus("stock")), VESTING_CAP - _vested)
			if vested > 0.0:
				_vested += vested
				player.might += vested

	var standup := _level("standup")
	if standup > 0:
		_standup_left -= delta
		if _standup_left <= 0.0:
			_standup_left = effect("standup", standup, _bonus("standup"))
			_hold_standup(_stat(STANDUP_DAMAGE, standup))

	var cost_cut := _level("cost_cut")
	for i in mini(_blasts.size(), MAX_BLASTS_PER_FRAME):
		_blast(_blasts.pop_front(), _stat(BLAST_DAMAGE, cost_cut))

	for i in range(_turrets.size() - 1, -1, -1):
		if not _turrets[i].tick(delta):
			_turrets.remove_at(i)


func on_kill(enemy: Enemy) -> void:
	var cost_cut := _level("cost_cut")
	if cost_cut > 0 and _game.rng.randf() < effect("cost_cut", cost_cut, _bonus("cost_cut")):
		_blasts.append(enemy.position)
	var open_source := _level("open_source")
	if open_source > 0 and _turrets.size() < MAX_TURRETS and _game.rng.randf() < effect("open_source", open_source, _bonus("open_source")):
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
	var damage: float = amount * effect("scapegoat", scapegoat, _bonus("scapegoat")) * player.might
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


## This run's rarity bonus for `perk_id` (Upgrades.perk_bonus).
func _bonus(perk_id: String) -> float:
	return _game.upgrades.perk_bonus.get(perk_id, 0.0)


## A perk's main number at `level` with its rarity bonus `bonus`: what it does and what its card
## shows. 站会 comes round more often; the others' numbers go up.
static func effect(perk_id: String, level: int, bonus: float) -> float:
	match perk_id:
		"stock":
			return VESTING_MIGHT * level * (1.0 + bonus)
		"scapegoat":
			return _stat(SCAPEGOAT_MULTIPLIER, level) * (1.0 + bonus)
		"cost_cut":
			return _stat(BLAST_CHANCE, level) * (1.0 + bonus)
		"open_source":
			return _stat(TURRET_CHANCE, level) * (1.0 + bonus)
		"standup":
			return _stat(STANDUP_EVERY, level) / (1.0 + bonus)
	return 0.0


static func _stat(table: Array, level: int) -> float:
	return table[clampi(level, 1, table.size()) - 1]
