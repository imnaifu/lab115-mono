extends SceneTree
## Plays a run with a simple bot (dodges nearby enemies, picks random upgrades) and prints a
## summary. Exits with code 1 if the run broke a basic invariant.
##
##   godot --headless --fixed-fps 60 --path . -s tests/smoke_test.gd -- --seconds=120
##
## Options: --seconds=N (game seconds to simulate), --god (player can't die), --die-at=N (kill
## the player at N seconds to reach the end screen), --restart-at=N (press restart at N
## seconds; the run then continues in the fresh scene), --shots=DIR --shot-every=N (save a
## screenshot every N game seconds, plus the title, the first level-up panel and the end
## screen; needs a window, so drop --headless), --pause-at=N (open the pause screen at N
## seconds and screenshot it), --window=WxH (window size, e.g. 405x720 to see a phone held upright),
## --lang=zh|en (UI language for this run, instead of the saved or system one),
## --teleport=X,Y (start the run at that world position, to look at a district),
## --handheld (behave as on a phone, e.g. with --window=405x720 to see it held upright),
## --orientation=portrait|landscape (a phone's Settings choice for this run, not saved),
## --sound (play the sound effects and music; off by default, since nobody listens to a test run
## and streams still playing when it quits are reported as leaked).

## Overlays pop in with a short animation; screenshots wait this many frames for it to settle.
const OVERLAY_SETTLE_FRAMES := 20

var _game: Game
var _frames := 0
var _max_frames := 120 * 60
var _god := false
var _shot_dir := ""
var _shot_every_frames := 0
var _upgrades_taken := 0
var _peak_enemies := 0
var _wander_angle := 0.0
var _started_usec := 0
var _die_at := -1.0
var _restart_at := -1.0
var _restarts := 0
var _level_up_frames := 0
var _end_frames := 0
var _level_up_shot_taken := false
var _title_frames := 0
var _pause_at := -1.0
var _pause_frames := 0
var _pause_shot_taken := false
var _lang := ""
var _teleport: Variant = null


func _initialize() -> void:
	Settings.overrides["sound"] = false
	Settings.overrides["music"] = false
	for arg in OS.get_cmdline_user_args():
		var value := arg.get_slice("=", 1)
		if arg.begins_with("--seconds="):
			_max_frames = int(float(value) * 60.0)
		elif arg == "--god":
			_god = true
		elif arg.begins_with("--shots="):
			_shot_dir = value
		elif arg.begins_with("--shot-every="):
			_shot_every_frames = int(float(value) * 60.0)
		elif arg.begins_with("--die-at="):
			_die_at = float(value)
		elif arg.begins_with("--restart-at="):
			_restart_at = float(value)
		elif arg.begins_with("--pause-at="):
			_pause_at = float(value)
		elif arg.begins_with("--lang="):
			_lang = value
		elif arg == "--handheld":
			Device.force_handheld = true
		elif arg.begins_with("--orientation="):
			Settings.overrides["orientation"] = value
		elif arg == "--sound":
			Settings.overrides.erase("sound")
			Settings.overrides.erase("music")
		elif arg.begins_with("--teleport="):
			_teleport = Vector2(float(value.get_slice(",", 0)), float(value.get_slice(",", 1)))
		elif arg.begins_with("--window="):
			var dimensions := value.split("x")
			DisplayServer.window_set_size(Vector2i(int(dimensions[0]), int(dimensions[1])))
	# Load it as the current scene, like a real launch, so restart's scene reload works.
	change_scene_to_file("res://scenes/main.tscn")
	_started_usec = Time.get_ticks_usec()


func _process(_delta: float) -> bool:
	# Scene changes land a frame late; wait for the (new) Game to be in place.
	if _game == null or current_scene != _game:
		_game = current_scene as Game
		if _game == null:
			return false
		if _lang != "":
			Lang.apply(_lang)
	_frames += 1
	if _restart_at >= 0.0 and _restarts == 0 and _game.elapsed >= _restart_at:
		_restarts += 1
		print("[smoke] restarting at %.1fs" % _game.elapsed)
		_game.restart()
		return false
	match _game.state:
		Game.State.TITLE:
			if _shot_dir != "":
				_title_frames += 1
				if _title_frames < OVERLAY_SETTLE_FRAMES:
					return false
				_save_shot("title")
			_game.start_run()
			if _teleport != null:
				_game.player.position = _teleport
		Game.State.PAUSED:
			if _pause_at >= 0.0 and not _pause_shot_taken and _shot_dir != "":
				_pause_frames += 1
				if _pause_frames < OVERLAY_SETTLE_FRAMES:
					return false
				_save_shot("pause")
				_pause_shot_taken = true
			# The window losing focus pauses the game too; a bot run should carry on.
			_game.set_paused(false)
		Game.State.LEVEL_UP:
			if _shot_dir != "" and not _level_up_shot_taken:
				_level_up_frames += 1
				if _level_up_frames < OVERLAY_SETTLE_FRAMES:
					return false
				_save_shot("level_up")
				_level_up_shot_taken = true
			_game.choose_upgrade(_game.rng.randi() % _game.current_choices.size())
			_upgrades_taken += 1
		Game.State.PLAYING:
			_game.player.input_override = _steer()
			if _god:
				_game.player.hp = _game.player.max_hp
			if _die_at >= 0.0 and _game.elapsed >= _die_at:
				_game.player.take_damage(INF)
			if _pause_at >= 0.0 and not _pause_shot_taken and _game.elapsed >= _pause_at:
				_game.set_paused(true)
				# Without a window there is nothing to capture; just exercise the pause screen once.
				_pause_shot_taken = _shot_dir == ""
	_peak_enemies = maxi(_peak_enemies, _game.enemies.size())

	if _shot_dir != "" and _shot_every_frames > 0 and _frames % _shot_every_frames == 0:
		_save_shot("%03ds" % floori(_game.elapsed))
	if _game.state == Game.State.ENDED and _shot_dir != "":
		_end_frames += 1
		if _end_frames < OVERLAY_SETTLE_FRAMES:
			return false
		_save_shot("end")
	if _game.state == Game.State.ENDED or _frames >= _max_frames:
		quit(_report())
		return true
	return false


## Blends three urges: run from close enemies (weighted by proximity), drift toward the
## nearest pickup, and slowly circle so the bot keeps covering new ground.
func _steer() -> Vector2:
	var player := _game.player
	var away := Vector2.ZERO
	for enemy in _game.query_enemies(player.position, 70.0):
		var offset := player.position - enemy.position
		away += offset / maxf(offset.length_squared(), 1.0)
	_wander_angle += 0.004
	var steer := Vector2.from_angle(_wander_angle) * 0.5
	if away.length_squared() > 0.000001:
		steer += away.normalized() * 2.0
	var nearest_pickup: Pickup = null
	var best_distance_sq := 160.0 * 160.0
	for pickup in _game.pickups:
		var distance_sq := pickup.position.distance_squared_to(player.position)
		if distance_sq < best_distance_sq:
			best_distance_sq = distance_sq
			nearest_pickup = pickup
	if nearest_pickup != null:
		steer += (nearest_pickup.position - player.position).normalized()
	return steer.normalized()


func _save_shot(label: String) -> void:
	if DisplayServer.get_name() == "headless":
		return
	DirAccess.make_dir_recursive_absolute(_shot_dir)
	var path := "%s/shot_%s.png" % [_shot_dir, label]
	root.get_texture().get_image().save_png(path)
	print("[smoke] saved %s" % path)


func _report() -> int:
	var weapon_levels := PackedStringArray()
	for weapon in _game.player.weapons:
		weapon_levels.append("%s:%d" % [weapon.id, weapon.level])
	var passive_levels := PackedStringArray()
	for passive_id: String in _game.upgrades.passive_levels:
		passive_levels.append("%s:%d" % [passive_id, _game.upgrades.passive_levels[passive_id]])
	var wall_ms := (Time.get_ticks_usec() - _started_usec) / 1000.0
	print("[smoke] result=%s elapsed=%.1fs level=%d kills=%d upgrades=%d peak_enemies=%d hp=%.0f/%.0f" % [
		_outcome(), _game.elapsed, _game.level, _game.kills, _upgrades_taken, _peak_enemies,
		_game.player.hp, _game.player.max_hp])
	print("[smoke] weapons=%s passives=%s" % [", ".join(weapon_levels), ", ".join(passive_levels)])
	var uncollected_xp := 0
	for pickup in _game.pickups:
		if pickup.kind == Pickup.Kind.XP:
			uncollected_xp += pickup.value
	print("[smoke] xp left on the floor=%d (in %d pickups)" % [uncollected_xp, _game.pickups.size()])
	print("[smoke] %d frames in %.0f ms (%.2f ms/frame)" % [_frames, wall_ms, wall_ms / _frames])

	var problems := PackedStringArray()
	if _peak_enemies == 0:
		problems.append("no enemies spawned")
	if _game.kills == 0:
		problems.append("no kills")
	if _game.elapsed > 30.0 and _game.level < 2:
		problems.append("never levelled up")
	# The kill check above already covers the fresh run working after a restart.
	if _restart_at >= 0.0 and _restarts == 0:
		problems.append("restart never happened")
	if not problems.is_empty():
		printerr("[smoke] FAIL: %s" % ", ".join(problems))
		return 1
	print("[smoke] OK")
	return 0


func _outcome() -> String:
	if _game.state != Game.State.ENDED:
		return "timeout"
	return "victory" if _game.elapsed >= Game.RUN_SECONDS else "died"
