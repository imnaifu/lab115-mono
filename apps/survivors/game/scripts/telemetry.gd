class_name Telemetry
extends RefCounted
## Anonymous play data for tuning the game: how long runs last, what kills players, which
## weapons carry them. Sent as events to the self-hosted Umami at stats.lab115.com (the same
## instance daily.lab115.com reports to), through a small helper the web page defines
## (window.survivorsTelemetry, in export_presets.cfg's html/head_include). Umami's script only
## runs on survivors.lab115.com, so the editor, local builds and the smoke test send nothing.
## Nothing personal goes out: no account, name or position, just a random id per run (to tell
## duplicates apart), the run's numbers, the kind of device and its screen size.
##
## Events:
## - run_start: device, screen, orientation, language, tilt, sound and music, runs played before.
## - run_end: `result` (win / died / restart / quit), seconds survived, level, kills, `killer`
##   (the last enemy type to hurt the player), weapons and perks with levels, each weapon's
##   damage share, the picks in order, a `timeline` of "seconds:level/HP/enemies" every 30 s,
##   bosses met and killed, and frames per second (average and worst second).
## A run still going when the page closes is saved as a snapshot every SNAPSHOT_SECONDS and
## sent as a "quit" by the page itself, then or on the next visit.

## Bumped when the balance changes, so data from before and after can be told apart.
const VERSION := "2026-10-28"
const TIMELINE_SECONDS := 30.0
const SNAPSHOT_SECONDS := 10.0
## Umami keeps string values up to 500 characters.
const MAX_TEXT := 480

var _game: Game
var _run_id := ""
var _picks := PackedStringArray()
var _timeline := PackedStringArray()
var _next_sample := TIMELINE_SECONDS
var _snapshot_left := SNAPSHOT_SECONDS
var _fps_sum := 0.0
var _fps_count := 0
var _fps_worst := INF
var _second_left := 1.0
var _bosses_seen := 0
var _bosses_killed := 0
var _peak_enemies := 0
var _started := false
var _finished := false
## The type of the last enemy that hurt the player; at death, what killed them.
var last_hurt_by := ""


func _init(game: Game) -> void:
	_game = game


func start() -> void:
	_started = true
	_run_id = "%08x" % randi()
	var runs_before: int = Settings.get_value("runs_played", 0)
	Settings.set_value("runs_played", runs_before + 1)
	var screen := DisplayServer.window_get_size()
	_send("run_start", {
		"version": VERSION,
		"run": _run_id,
		"device": "phone" if Device.is_handheld() else "desktop",
		"screen": "%dx%d" % [screen.x, screen.y],
		"orientation": _orientation(),
		"lang": Lang.current(),
		"tilt": Tilt.enabled(),
		"sound": Sound.sfx_enabled(),
		"music": Sound.music_enabled(),
		"runs_before": runs_before,
	})


## Called every frame of play.
func tick(delta: float) -> void:
	if not _started or _finished:
		return
	_peak_enemies = maxi(_peak_enemies, _game.enemies.size())
	# The engine's FPS is already a one-second average; sample it once a second, skipping the
	# first few while the run settles in.
	_second_left -= delta
	if _second_left <= 0.0:
		_second_left += 1.0
		if _game.elapsed > 5.0:
			var fps := Engine.get_frames_per_second()
			_fps_sum += fps
			_fps_count += 1
			_fps_worst = minf(_fps_worst, fps)
	if _game.elapsed >= _next_sample:
		_next_sample += TIMELINE_SECONDS
		_timeline.append("%d:%d/%d/%d" % [roundi(_game.elapsed), _game.level, ceili(_game.player.hp), _game.enemies.size()])
	_snapshot_left -= delta
	if _snapshot_left <= 0.0:
		_snapshot_left = SNAPSHOT_SECONDS
		_call("snapshot(%s)" % JSON.stringify(JSON.stringify(_summary("quit"))))


func on_pick(choice: Dictionary) -> void:
	_picks.append(choice["id"])


func on_enemy_spawned(enemy: Enemy) -> void:
	if enemy.is_elite:
		_bosses_seen += 1


func on_enemy_killed(enemy: Enemy) -> void:
	if enemy.is_elite:
		_bosses_killed += 1


## Sends the run's summary once; later calls (the end screen's restart after a death) do nothing.
func finish(result: String) -> void:
	if not _started or _finished:
		return
	_finished = true
	_send("run_end", _summary(result))
	_call("clear()")


func _summary(result: String) -> Dictionary:
	var player := _game.player
	var weapons := PackedStringArray()
	for weapon in player.weapons:
		weapons.append("%s:%d" % [weapon.id, weapon.level])
	var perks := PackedStringArray()
	for perk_id: String in _game.upgrades.passive_levels:
		perks.append("%s:%d" % [perk_id, _game.upgrades.passive_levels[perk_id]])
	var data := {
		"version": VERSION,
		"run": _run_id,
		"result": result,
		"seconds": roundi(_game.elapsed),
		"level": _game.level,
		"kills": _game.kills,
		"killer": last_hurt_by,
		"hp": ceili(player.hp),
		"max_hp": roundi(player.max_hp),
		"weapons": ",".join(weapons),
		"perks": ",".join(perks),
		"picks": ",".join(_picks).left(MAX_TEXT),
		"timeline": ";".join(_timeline).left(MAX_TEXT),
		"bosses_seen": _bosses_seen,
		"bosses_killed": _bosses_killed,
		"peak_enemies": _peak_enemies,
		"fps_avg": roundi(_fps_sum / _fps_count) if _fps_count > 0 else 0,
		"fps_worst": roundi(_fps_worst) if _fps_count > 0 else 0,
		"device": "phone" if Device.is_handheld() else "desktop",
	}
	# Each weapon's share of all damage dealt, in percent (the end screen's ranking).
	var total := 0.0
	for amount: float in _game.damage_by_source.values():
		total += amount
	for weapon_id: String in Upgrades.WEAPONS:
		data["dmg_" + weapon_id] = roundi(100.0 * _game.damage_by_source.get(weapon_id, 0.0) / maxf(total, 1.0))
	return data


func _orientation() -> String:
	if _game.screen_turned:
		return "turned"
	var size := DisplayServer.window_get_size()
	return "portrait" if size.y > size.x else "landscape"


func _send(event: String, data: Dictionary) -> void:
	_call("track(%s, %s)" % [JSON.stringify(event), JSON.stringify(data)])


static func _call(call: String) -> void:
	if OS.has_feature("web"):
		JavaScriptBridge.eval("window.survivorsTelemetry && window.survivorsTelemetry.%s" % call)
