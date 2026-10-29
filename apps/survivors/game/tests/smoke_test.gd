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
## and streams still playing when it quits are reported as leaked),
## --all-weapons=N (start with every weapon at level N and take only perks at level-ups, to
## compare the weapons' damage share in the report), --perks=id:level,... (start with those
## passives, e.g. --perks=standup:5,cost_cut:5), --boss=type,... (bring those enemy types in
## next to the player at the start, e.g. --boss=incident,pie_boss to watch their moves),
## --share (with --shots, also render the end screen's result image into the shots directory, or
## with --pause-at the pause screen's run-so-far image),
## --only-perks (at level-ups take a passive whenever one is offered, so the run shows what the
## starting weapon alone does), --hold-hp=R (keep the player's health at that share of the maximum, e.g. 0.2 to look at the
## low-health bar; they can't die), --job=coder|pm|designer|ops|data_scientist (play as that job; not saved), --evolve (start with every weapon the job can carry evolved,
## to look at the evolutions), --stamps=N|all (start having checked in at the first N landmarks,
## or all of them), --collection=0|1 (with --shots, also screenshot the title's 打卡 · 成就 page on
## that tab). Progress (打卡, 成就) is kept in memory only: a bot run never touches the save.

## Overlays pop in with a short animation; screenshots wait this many frames for it to settle.
const OVERLAY_SETTLE_FRAMES := 20
## Run times (seconds) at which the report notes the player's level.
const REPORT_TIMES := [60, 180, 300, 450, 600]

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
var _all_weapons_level := 0
var _perks := PackedStringArray()
var _bosses := PackedStringArray()
var _chests := 0
var _chest_frames := 0
var _chest_shot_taken := false
var _share := false
var _hold_hp := -1.0
var _only_perks := false
var _evolve := false
## Melee jobs' bots only step away from enemies right on top of them, so their swings land.
var _avoid_radius := 70.0
var _share_started := false
var _share_saved := false
var _stamps_before := 0
## The 打卡 · 成就 tab to screenshot at the title, or -1; and frames it has been open.
var _collection_tab := -1
var _collection_frames := 0
## Player level when each REPORT_TIMES second was reached, for comparing pacing between builds.
var _levels_at := {}
var _worst_frame_ms := 0.0
var _last_frame_usec := 0


func _initialize() -> void:
	Settings.overrides["sound"] = false
	Settings.overrides["music"] = false
	Progress.to_disk = false
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
		elif arg.begins_with("--all-weapons="):
			_all_weapons_level = clampi(int(value), 1, Upgrades.MAX_LEVEL)
		elif arg.begins_with("--perks="):
			_perks = value.split(",")
		elif arg.begins_with("--boss="):
			_bosses = value.split(",")
		elif arg == "--share":
			_share = true
		elif arg.begins_with("--job="):
			Settings.overrides["job"] = value
			if Upgrades.WEAPONS[Jobs.data(value)["weapon"]]["type"] == "melee":
				_avoid_radius = 35.0
		elif arg == "--only-perks":
			_only_perks = true
		elif arg.begins_with("--hold-hp="):
			_hold_hp = clampf(float(value), 0.01, 1.0)
		elif arg == "--evolve":
			_evolve = true
		elif arg.begins_with("--stamps="):
			_stamps_before = BayArea.STAMPS.size() if value == "all" else int(value)
		elif arg.begins_with("--collection="):
			_collection_tab = int(value)
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
			if _title_frames == 0:
				for id: String in BayArea.STAMPS.keys().slice(0, _stamps_before):
					Progress.add_stamp(id)
			if _shot_dir != "":
				_title_frames += 1
				if _title_frames < OVERLAY_SETTLE_FRAMES:
					return false
				if _title_frames == OVERLAY_SETTLE_FRAMES:
					_save_shot("title")
				if _collection_tab >= 0:
					if _collection_frames == 0:
						_game.hud._open_collection(_collection_tab)
					_collection_frames += 1
					if _collection_frames < OVERLAY_SETTLE_FRAMES:
						return false
					_save_shot("collection")
					_game.hud._collection_open = false
					_collection_tab = -1
			_game.start_run()
			if _teleport != null:
				_game.player.position = _teleport
			if _all_weapons_level > 0 or _evolve:
				_grant_all_weapons()
			for perk in _perks:
				for i in int(perk.get_slice(":", 1)):
					_game.upgrades.apply({"kind": "passive", "id": perk.get_slice(":", 0)})
			if not _perks.is_empty():
				_game.inventory_changed.emit()
			for i in _bosses.size():
				var side := Vector2.from_angle(TAU * i / _bosses.size()) * 110.0
				_game.spawn_enemy(_bosses[i], _game.player.position + side)
		Game.State.PAUSED:
			if _pause_at >= 0.0 and not _pause_shot_taken and _shot_dir != "":
				_pause_frames += 1
				if _pause_frames < OVERLAY_SETTLE_FRAMES:
					return false
				_save_shot("pause")
				_pause_shot_taken = true
			if _share and _pause_at >= 0.0 and _shot_dir != "" and DisplayServer.get_name() != "headless":
				if not _share_started:
					_share_started = true
					_game.hud._make_share_image()
					return false
				if _game.hud._sharing:
					return false
				if not _share_saved:
					_share_saved = true
					DirAccess.copy_absolute(ProjectSettings.globalize_path("user://share_card.png"), "%s/shot_share_pause.png" % _shot_dir)
					print("[smoke] saved %s/shot_share_pause.png" % _shot_dir)
			# The window losing focus pauses the game too; a bot run should carry on.
			_game.set_paused(false)
		Game.State.LEVEL_UP:
			if _shot_dir != "" and not _level_up_shot_taken:
				_level_up_frames += 1
				if _level_up_frames < OVERLAY_SETTLE_FRAMES:
					return false
				_save_shot("level_up")
				_level_up_shot_taken = true
			_game.choose_upgrade(_pick_choice())
			_upgrades_taken += 1
		Game.State.CHEST:
			if _shot_dir != "" and not _chest_shot_taken:
				# Long enough for the slot machine to land.
				_chest_frames += 1
				if _chest_frames < 120:
					return false
				_save_shot("chest")
				_chest_shot_taken = true
			_chests += 1
			_game.close_chest()
		Game.State.PLAYING:
			_game.player.input_override = _steer()
			if _god:
				_game.player.hp = _game.player.max_hp
			if _hold_hp > 0.0:
				_game.player.hp = _game.player.max_hp * _hold_hp
				_game.player.queue_redraw()
			if _die_at >= 0.0 and _game.elapsed >= _die_at:
				_game.player.take_damage(INF)
			if _pause_at >= 0.0 and not _pause_shot_taken and _game.elapsed >= _pause_at:
				_game.set_paused(true)
				# Without a window there is nothing to capture; just exercise the pause screen once.
				_pause_shot_taken = _shot_dir == ""
	_peak_enemies = maxi(_peak_enemies, _game.enemies.size())
	for at: int in REPORT_TIMES:
		if _game.elapsed >= at and not _levels_at.has(at):
			_levels_at[at] = _game.level
	# Without a window frames run back to back, so the gap between them is the frame's cost.
	var now_usec := Time.get_ticks_usec()
	if _last_frame_usec > 0 and _game.state == Game.State.PLAYING and _game.elapsed > 1.0:
		_worst_frame_ms = maxf(_worst_frame_ms, (now_usec - _last_frame_usec) / 1000.0)
	_last_frame_usec = now_usec

	if _shot_dir != "" and _shot_every_frames > 0 and _frames % _shot_every_frames == 0:
		# Several a second get tenths in their names, or they would overwrite each other.
		_save_shot("%03ds" % floori(_game.elapsed) if _shot_every_frames >= 60 else "%05.1fs" % _game.elapsed)
	if _game.state == Game.State.ENDED and _shot_dir != "":
		_end_frames += 1
		if _end_frames < OVERLAY_SETTLE_FRAMES:
			return false
		if _end_frames == OVERLAY_SETTLE_FRAMES:
			_save_shot("end")
		if _share and DisplayServer.get_name() != "headless":
			if not _share_started:
				_share_started = true
				_game.hud._make_share_image()
				return false
			if _game.hud._sharing:
				return false
			DirAccess.copy_absolute(ProjectSettings.globalize_path("user://share_card.png"), "%s/shot_share.png" % _shot_dir)
			print("[smoke] saved %s/shot_share.png" % _shot_dir)
	if _game.state == Game.State.ENDED or _frames >= _max_frames:
		quit(_report())
		return true
	return false


## Blends three urges: run from close enemies (weighted by proximity), drift toward the
## nearest pickup, and slowly circle so the bot keeps covering new ground.
func _steer() -> Vector2:
	var player := _game.player
	var away := Vector2.ZERO
	for enemy in _game.query_enemies(player.position, _avoid_radius):
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


## Every weapon the job can carry at the --all-weapons level (full level with --evolve, then
## evolved).
func _grant_all_weapons() -> void:
	var target_level := Upgrades.MAX_LEVEL if _evolve else _all_weapons_level
	for weapon_id in Upgrades.weapons_for(_game.player.job):
		var weapon := _game.player.get_weapon(weapon_id)
		if weapon == null:
			weapon = Upgrades.create_weapon(weapon_id)
			_game.player.add_weapon(weapon)
		while weapon.level < target_level:
			# A job weapon takes its two directions in turn.
			weapon.level_up(("a" if weapon.branch_a <= weapon.branch_b else "b") if Upgrades.BRANCHES.has(weapon_id) else "")
		if _evolve and Upgrades.EVOLUTIONS.has(weapon_id):
			weapon.evolve()
	_game.inventory_changed.emit()


## A random card; with --all-weapons, a perk whenever one is offered so the weapons stay level.
func _pick_choice() -> int:
	var choices := _game.current_choices
	if _all_weapons_level > 0 or _only_perks:
		for i in choices.size():
			if choices[i]["kind"] != "weapon":
				return i
	return _game.rng.randi() % choices.size()


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
		weapon_levels.append("%s:%d%s" % [weapon.id, weapon.level, "*" if weapon.evolved else ""])
	var passive_levels := PackedStringArray()
	for passive_id: String in _game.upgrades.passive_levels:
		passive_levels.append("%s:%d" % [passive_id, _game.upgrades.passive_levels[passive_id]])
	var wall_ms := (Time.get_ticks_usec() - _started_usec) / 1000.0
	print("[smoke] job=%s" % _game.player.job)
	print("[smoke] result=%s elapsed=%.1fs level=%d kills=%d upgrades=%d peak_enemies=%d hp=%.0f/%.0f" % [
		_outcome(), _game.elapsed, _game.level, _game.kills, _upgrades_taken, _peak_enemies,
		_game.player.hp, _game.player.max_hp])
	print("[smoke] weapons=%s passives=%s (* evolved)" % [", ".join(weapon_levels), ", ".join(passive_levels)])
	print("[smoke] last hurt by=%s" % _game.telemetry.last_hurt_by)
	print("[smoke] checked in=%s achievements=%s" % [",".join(_game.stamps.new_ids), ",".join(_game.achievements.new_ids)])
	print("[smoke] bosses killed=%d of %d, funding bags opened=%d (%s)" % [
		_game.telemetry._bosses_killed, _game.telemetry._bosses_seen, _chests, ",".join(_game.telemetry._chests)])
	var uncollected_xp := 0
	for pickup in _game.pickups:
		if pickup.kind == Pickup.Kind.XP:
			uncollected_xp += pickup.value
	print("[smoke] xp left on the floor=%d (in %d pickups)" % [uncollected_xp, _game.pickups.size()])
	print("[smoke] %d frames in %.0f ms (%.2f ms/frame, worst %.1f ms)" % [_frames, wall_ms, wall_ms / _frames, _worst_frame_ms])
	var levels := PackedStringArray()
	for at: int in REPORT_TIMES:
		if _levels_at.has(at):
			levels.append("%ds:Lv%d" % [at, _levels_at[at]])
	print("[smoke] levels %s" % " ".join(levels))
	var total_damage := 0.0
	for source: String in _game.damage_by_source:
		total_damage += _game.damage_by_source[source]
	var shares := PackedStringArray()
	var sources: Array = _game.damage_by_source.keys()
	sources.sort_custom(func(a, b): return _game.damage_by_source[a] > _game.damage_by_source[b])
	for source: String in sources:
		shares.append("%s %.0f%%" % [source, 100.0 * _game.damage_by_source[source] / maxf(total_damage, 1.0)])
	print("[smoke] damage %s" % ", ".join(shares))

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
