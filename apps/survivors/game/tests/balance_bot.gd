extends "res://tests/smoke_test.gd"
## The balance bot (.72): plays a run the way a player who knows the game would, to calibrate the
## balance formula (DESIGN.md 2.8, tools/balance.py). On top of the smoke test's bot it takes the
## cards that matter (its own weapon, up to four weapons, then 伤害 / 冷却 / 生命 / 护甲 / 回血),
## goes for stars up to SEEK away, walks out of the bosses' red shapes, never steps into one and
## sidesteps their bullets. Prints one `[balance] {...}` line of JSON at the end.
##
##   godot --headless --fixed-fps 60 --path . -s tests/balance_bot.gd -- --job=pm --seconds=600
##
## Its own options, each a multiplier or a bonus on the run, to measure what a step of it does:
## --enemy-hp=X, --enemy-damage=X, --spawn=X (times the map's DIFFICULTY, Maps.test_scale);
## --might=X (伤害 +X, as 0.4 for +40%), --max-hp=X (生命 +X), --regen=X (每秒回血 +X),
## --armor=X, --speed=X (移速 ×(1+X)), --haste=X (冷却 ×(1−X)); --training=one (every 培训
## stat one rank) or --training=full; --label=TEXT (copied into the JSON). The smoke test's
## options work too (--map, --stamps, --meta=full …).

## How far it goes for a star: further than the smoke test's 160, as a player chasing levels does.
const SEEK := 250.0
## Cards it takes, best first, among the passives (the rest it takes only when nothing better).
const PASSIVE_ORDER := ["might", "haste", "vitality", "armor", "regen", "swiftness", "magnet"]
## When it sets its 大招 off (_maybe_ultimate): under this share of its health, or a boss this close.
const ULTIMATE_HP := 0.4
const ULTIMATE_BOSS_NEAR := 90.0

var _label := "base"
var _player_bonus := {}
var _training := ""
var _bonus_applied := false
var _training_bought := false


func _initialize() -> void:
	super()
	for arg in OS.get_cmdline_user_args():
		var value := arg.get_slice("=", 1)
		match arg.get_slice("=", 0):
			"--enemy-hp":
				Maps.test_scale["hp"] = float(value)
			"--enemy-damage":
				Maps.test_scale["damage"] = float(value)
			"--spawn":
				Maps.test_scale["spawn"] = float(value)
			"--might", "--max-hp", "--regen", "--armor", "--speed", "--haste":
				_player_bonus[arg.get_slice("=", 0).trim_prefix("--")] = float(value)
			"--training":
				_training = value
			"--label":
				_label = value


func _process(delta: float) -> bool:
	if _game != null and is_instance_valid(_game) and current_scene == _game:
		# 培训 bought in the (in-memory) save before the run starts, so Training.apply sees it.
		if _game.state == Game.State.TITLE and not _training_bought and _training != "":
			_training_bought = true
			Progress.add_salary("balance-bot", 10000000)
			for entry: Dictionary in Training.STATS:
				var ranks: int = 1 if _training == "one" else int(entry["ranks"])
				for i in ranks:
					Training.buy(entry["id"])
		if _game.state == Game.State.PLAYING and not _bonus_applied:
			_bonus_applied = true
			_apply_bonus(_game.player)
	return super(delta)


func _apply_bonus(player: Player) -> void:
	for key: String in _player_bonus:
		var amount: float = _player_bonus[key]
		match key:
			"might":
				player.might += amount
			"max-hp":
				player.max_hp += amount
				player.hp += amount
			"regen":
				player.regen += amount
			"armor":
				player.armor += amount
			"speed":
				player.move_speed *= 1.0 + amount
			"haste":
				player.cooldown_scale *= 1.0 - amount


## Sets its 大招 off (Ultimates) as a player saving it would: low on health, a boss on top of it,
## (until 0.3.29 also the floor to clear after 10:00).
func _maybe_ultimate() -> void:
	if not _game.ultimates.ready():
		return
	var player := _game.player
	var boss_near := false
	for enemy in _game.query_enemies(player.position, ULTIMATE_BOSS_NEAR, false):
		if enemy.is_elite:
			boss_near = true
	if player.hp < player.max_hp * ULTIMATE_HP or boss_near:
		_game.ultimates.cast()


func _steer() -> Vector2:
	_maybe_ultimate()
	var player := _game.player
	var escape := _zone_escape(player.position)
	if escape != Vector2.ZERO:
		return escape.normalized()
	var away := Vector2.ZERO
	for enemy in _game.query_enemies(player.position, _avoid_radius):
		var offset := player.position - enemy.position
		away += offset / maxf(offset.length_squared(), 1.0)
	_wander_angle += 0.004
	var steer := Vector2.from_angle(_wander_angle) * 0.5
	if away.length_squared() > 0.000001:
		steer += away.normalized() * 2.0
	var nearest_pickup: Pickup = null
	var best_distance_sq := SEEK * SEEK
	for pickup in _game.pickups:
		var distance_sq := pickup.position.distance_squared_to(player.position)
		if distance_sq < best_distance_sq:
			best_distance_sq = distance_sq
			nearest_pickup = pickup
	if nearest_pickup != null:
		steer += (nearest_pickup.position - player.position).normalized()
	steer += _bullet_dodge(player.position)
	return _clear_ahead(player.position, steer.normalized()).normalized()


## Every red shape a boss has on the ground (dash lanes too: the boss runs down them).
func _zones() -> Array:
	var zones := []
	for enemy in _game.enemies:
		if enemy.is_elite and not enemy.dead:
			for attack in enemy._attacks:
				for zone in attack.zones:
					if zone.left > 0.0:
						zones.append(zone)
	return zones


## The way out of any red shape the player stands in (zero when in none).
func _zone_escape(at: Vector2) -> Vector2:
	var out := Vector2.ZERO
	for zone in _zones():
		if not BossAttack.inside(zone, at):
			continue
		if zone.shape == "rect":
			var local: Vector2 = (at - zone.center).rotated(-zone.angle)
			if zone.half.x - absf(local.x) < zone.half.y - absf(local.y):
				out += Vector2(signf(local.x) if local.x != 0.0 else 1.0, 0.0).rotated(zone.angle)
			else:
				out += Vector2(0.0, signf(local.y) if local.y != 0.0 else 1.0).rotated(zone.angle)
		else:
			var away: Vector2 = at - zone.center
			out += away.normalized() if away.length_squared() > 0.01 else Vector2.RIGHT
	return out


## Steps sideways from boss bullets closing in; runs from homing ones.
func _bullet_dodge(at: Vector2) -> Vector2:
	var dodge := Vector2.ZERO
	for shot in _game.hostile_shots:
		if shot.done:
			continue
		var to_player: Vector2 = at - shot.position
		if to_player.length() > 80.0:
			continue
		if shot._turn > 0.0:
			dodge += to_player.normalized() * 2.0
			continue
		var lateral: Vector2 = shot._velocity.orthogonal().normalized()
		if lateral.dot(to_player) < 0.0:
			lateral = -lateral
		if shot._velocity.dot(to_player) > 0.0:
			dodge += lateral * 2.0
	return dodge


## The step about to be taken, turned aside if it would walk into a red shape.
func _clear_ahead(at: Vector2, step: Vector2) -> Vector2:
	if step == Vector2.ZERO:
		return step
	var zones := _zones()
	if zones.is_empty():
		return step
	for turn in [0.0, 45.0, -45.0, 90.0, -90.0, 135.0, -135.0, 180.0]:
		var candidate := step.rotated(deg_to_rad(turn))
		var blocked := false
		for zone in zones:
			if BossAttack.inside(zone, at + candidate * 14.0):
				blocked = true
				break
		if not blocked:
			return candidate
	return Vector2.ZERO


## Its own weapon first (the direction behind), then levels for the weapons it carries, up to four
## weapons, then the passives in PASSIVE_ORDER.
func _pick_choice() -> int:
	var choices := _game.current_choices
	var player := _game.player
	var job_weapon: String = Jobs.data(player.job)["weapon"]
	var best := 0
	var best_score := -1.0
	for i in choices.size():
		var choice: Dictionary = choices[i]
		var score := 1.0
		if choice["kind"] == "weapon":
			var owned := player.get_weapon(choice["id"])
			if choice["id"] == job_weapon and owned != null:
				var branch: String = choice.get("branch", "")
				score = 100.0 - float(owned.branch_a if branch == "a" else owned.branch_b)
			elif owned != null:
				score = 80.0
			elif player.weapons.size() < 4:
				score = 70.0
			else:
				score = 5.0
		elif choice["kind"] == "passive":
			var rank := PASSIVE_ORDER.find(choice["id"])
			var held: bool = _game.upgrades.passive_levels.has(choice["id"])
			score = (60.0 if held else 50.0) + (10.0 - rank if rank >= 0 else 0.0)
		if score > best_score:
			best_score = score
			best = i
	return best


func _report() -> int:
	var code := super()
	print("[balance] " + JSON.stringify({"label": _label, "job": _game.player.job, "map": Maps.current_id,
		"result": _outcome(), "seconds": snappedf(_game.elapsed, 0.1), "level": _game.level, "ult_at": _game.ultimates.used_at, "ults": _game.ultimates.casts,
		"bosses": _game.telemetry._bosses_killed, "killer": _game.telemetry.last_hurt_by}))
	return code
