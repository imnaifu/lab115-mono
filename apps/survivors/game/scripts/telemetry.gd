class_name Telemetry
extends RefCounted
## Anonymous play data for tuning the game: how long runs last, what kills players, which
## weapons carry them. Sent as events to the self-hosted Umami at stats.lab115.com (the same
## instance daily.lab115.com reports to), through a small helper the web page defines
## (window.survivorsTelemetry, in export_presets.cfg's html/head_include). Umami's script only
## runs on survivors.lab115.com, so the editor, local builds and the smoke test send nothing.
## Nothing personal goes out: no name or position. From .30 the page stamps every event with
## `install`, a random id this browser keeps (to count players and see who comes back), `page`,
## one per page load (to tie a load's events together; Umami's own session changes with the
## network), and once the cloud save has signed in `account`, its Nakama user id (to follow a
## player onto the cloud save and across devices sharing it; it isn't a credential, the device id
## and the 存档码 that sign in never go out). Besides, a random id per run (to tell duplicates
## apart), the run's numbers, the kind of device and its screen size.
##
## Events:
## - game_ready: once per page load, when the title screen is up: `load_ms` since the page
##   started loading (pageviews without it are visitors lost while the game loaded); from .30
##   also `from`, `runs_before` and `lang`, so who leaves at the title can be told apart by where
##   they came from and whether they played before.
## - load_abandoned (sent by the page, .30): a page hidden or closed before game_ready, with `ms`
##   waited and the download's `progress` in percent (-1 unknown). A phone that only switched
##   apps for a moment sends it too: the same `page`'s game_ready shows it came back.
## - run_start: `job` (Jobs), device, screen, orientation, language, tilt, sound and music, runs played before,
##   `from` (the link's ?from=, e.g. "share" for the result image's QR code), and for a page's
##   first run `page_ms`, how long after the page opened it started; from .19, `stamps` and
##   `achievements`, how many landmarks this device has checked in at and achievements earned
##   (局外成长: the stamps' bonuses make a player stronger, so compare runs with the same count);
##   from .20 both events carry `map` (sv 硅谷, bj 北京, from .34 sea 西雅图); a 测试模式 run (TestMode)
##   sends neither; from .28, `cloud`, how the cloud save
##   stands on this device (Cloud.STATUS_NAMES: off / connecting / synced / offline / disabled),
##   to see whether it gets through in-app browsers.
##   From .30, `page_run`: the run's number on this page (2 and up are 再来一局).
## - run_end: `job`, `result` (win / died / restart / quit), seconds survived, level, kills, `killer`
##   (the last enemy type to hurt the player), weapons and perks with levels, each weapon's
##   damage share, the picks in order, `offered` (how often each card was offered, for pick
##   rates), `chests` (the ratings year-end bonuses landed on: angel / series_a / ipo, from .27 shown
##   as 绩效 B / A / S), `evolved` (weapons evolved), a
##   `timeline` of
##   "seconds:level/HP/enemies" every 30 s, bosses met and killed, the `district` the run ended
##   in, and frames per second (average and worst second). `dmg_<weapon>` is each weapon's share of
##   all damage in percent, for the weapons (and damaging perks) that dealt any. From .19,
##   `new_stamps` and `new_achievements`: the ids checked in at and earned this run. From .21,
##   `boss_rolls`: the run's bosses as planned (Spawner.boss_rolls, e.g. 62:layoff+quake!996),
##   since which boss comes when, with which extra moves and affixes, now changes every run.
##   From .27, `luck` (the player's at the end) and `rarities`: how many upgrades of each rarity
##   (普通,优秀,稀有,史诗,传说, Upgrades.RARITIES) the run got, picked or out of a chest, and
##   `lucky_cards`, how many level-ups luck added a card to.
## - cloud_action (.30): the cloud save and its page (设置 → 云存档), `action` with a `result`: connect
##   (once per page when the first sync settles: synced / offline, `ms`, `merged` when the cloud
##   brought progress), open (the 云存档 page, with its `status`), code (a 存档码 made: ok /
##   offline), copy (复制 tapped), copied (the page's copy button: ok / hold, when only a long
##   press can copy), redeem (a code entered: ok / invalid / not_found / offline, with the
##   `previous` account), redeem_cancelled (the page's field closed), delete (ok / offline, with
##   the deleted `account`), enable.
## - share (.30): the result image. `open` from the game with `where` (end / pause); then from
##   the page's dialog share, shared / share_cancelled (the system share sheet's outcome), save,
##   close. A long press on the image (how WeChat saves) can't be seen.
## The page itself also reports script errors (js_error), see export_presets.cfg.
## A run still going when the page closes is saved as a snapshot every SNAPSHOT_SECONDS and
## sent as a "quit" by the page itself when it closes and again on the next visit (in-app
## browsers often close before the first send gets out), so the same `run` can arrive more
## than once: keep the one with the most `seconds`.

## Bumped with every release (not only balance changes), so data from before and after can be
## told apart and the version shown on the title screen pins down which build someone is on.
const VERSION := "2026-10-28.35"
const TIMELINE_SECONDS := 30.0
const SNAPSHOT_SECONDS := 10.0
## Umami keeps string values up to 500 characters.
const MAX_TEXT := 480

## Whether this page load has sent game_ready, and started a run yet: the scene (and with it
## this object) is rebuilt for every run, the page isn't.
static var _ready_sent := false
static var _runs_on_page := 0

var _game: Game
var _run_id := ""
var _picks := PackedStringArray()
## Times each card id was offered at a level-up.
var _offered := {}
var _chests := PackedStringArray()
## Upgrades got by rarity tier (Upgrades.RARITIES), picked or from chests.
var _rarities := PackedInt32Array([0, 0, 0, 0, 0])
## Level-ups where luck added a card (Upgrades.lucky_card).
var _lucky_cards := 0
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
## The type of the last enemy that hurt the player; at death, what killed them. `last_hurt_how`
## is how that hit landed (Game.hurt_player).
var last_hurt_by := ""
var last_hurt_how := ""


func _init(game: Game) -> void:
	_game = game


## The title screen is up: sent once per page load.
func on_title_shown() -> void:
	if _ready_sent or not OS.has_feature("web"):
		return
	_ready_sent = true
	# The page reloads a tab brought back after a release into the new version (see there).
	_call("setVersion(%s)" % JSON.stringify(VERSION))
	_send("game_ready", {
		"version": VERSION,
		"device": "phone" if Device.is_handheld() else "desktop",
		"load_ms": _page_ms(),
		"from": _link_source(),
		"runs_before": Settings.get_value("runs_played", 0),
		"lang": Lang.current(),
	})


func start() -> void:
	_started = true
	_run_id = "%08x" % randi()
	_runs_on_page += 1
	var runs_before: int = Settings.get_value("runs_played", 0)
	Settings.set_value("runs_played", runs_before + 1)
	var screen := DisplayServer.window_get_size()
	var data := {
		"version": VERSION,
		"run": _run_id,
		"job": _game.player.job,
		"map": Maps.current_id,
		"device": "phone" if Device.is_handheld() else "desktop",
		"screen": "%dx%d" % [screen.x, screen.y],
		"orientation": _orientation(),
		"lang": Lang.current(),
		"tilt": Tilt.enabled(),
		"sound": Sound.sfx_enabled(),
		"music": Sound.music_enabled(),
		"runs_before": runs_before,
		"from": _link_source(),
		"stamps": Progress.stamp_ids().size(),
		"achievements": Progress.achievement_ids().size(),
		"cloud": Cloud.status_name(),
		"page_run": _runs_on_page,
	}
	if _runs_on_page == 1:
		data["page_ms"] = _page_ms()
	_send("run_start", data)
	# Saved right away rather than at the first SNAPSHOT_SECONDS tick, so a page closed in the
	# first seconds of a run still reports it as a quit.
	_save_snapshot()


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
		_save_snapshot()


func _save_snapshot() -> void:
	_call("snapshot(%s)" % JSON.stringify(JSON.stringify(_summary("quit"))))


func on_pick(choice: Dictionary) -> void:
	_picks.append(_card_id(choice))
	_count_rarity(choice)


## Weapon and passive upgrades only: the heal card and evolutions have no rarity.
func _count_rarity(choice: Dictionary) -> void:
	if choice["kind"] in ["weapon", "passive"]:
		_rarities[choice.get("rarity", 0)] += 1


## A card's id in the data; a job weapon's direction card has its direction after it: "prd:b".
static func _card_id(choice: Dictionary) -> String:
	return choice["id"] + (":" + choice["branch"] if choice.has("branch") else "")


func on_offer(choices: Array) -> void:
	for choice: Dictionary in choices:
		var card := _card_id(choice)
		_offered[card] = _offered.get(card, 0) + 1


func on_lucky_card() -> void:
	_lucky_cards += 1


func on_chest(round_id: String, items: Array) -> void:
	_chests.append(round_id)
	for item: Dictionary in items:
		_count_rarity(item)


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
	_call("clear(%s)" % JSON.stringify(_run_id))


func _summary(result: String) -> Dictionary:
	var player := _game.player
	var weapons := PackedStringArray()
	var evolved := PackedStringArray()
	for weapon in player.weapons:
		weapons.append("%s:%d" % [weapon.id, weapon.level])
		if weapon.evolved:
			evolved.append(weapon.id)
	var perks := PackedStringArray()
	for perk_id: String in _game.upgrades.passive_levels:
		perks.append("%s:%d" % [perk_id, _game.upgrades.passive_levels[perk_id]])
	var offered := PackedStringArray()
	for card_id: String in _offered:
		offered.append("%s:%d" % [card_id, _offered[card_id]])
	var data := {
		"version": VERSION,
		"run": _run_id,
		"job": player.job,
		"map": Maps.current_id,
		"result": result,
		"seconds": roundi(_game.elapsed),
		"level": _game.level,
		"kills": _game.kills,
		"killer": last_hurt_by,
		"killer_how": last_hurt_how,
		"hp": ceili(player.hp),
		"max_hp": roundi(player.max_hp),
		"weapons": ",".join(weapons),
		"perks": ",".join(perks),
		"picks": ",".join(_picks).left(MAX_TEXT),
		"offered": ",".join(offered).left(MAX_TEXT),
		"chests": ",".join(_chests).left(MAX_TEXT),
		"luck": roundi(player.luck),
		"rarities": ",".join(Array(_rarities).map(func(count: int) -> String: return str(count))),
		"lucky_cards": _lucky_cards,
		"evolved": ",".join(evolved),
		"district": Maps.current.district_of(Vector2i((player.position / City.BLOCK).floor())),
		"timeline": ";".join(_timeline).left(MAX_TEXT),
		"bosses_seen": _bosses_seen,
		"bosses_killed": _bosses_killed,
		"peak_enemies": _peak_enemies,
		"fps_avg": roundi(_fps_sum / _fps_count) if _fps_count > 0 else 0,
		"fps_worst": roundi(_fps_worst) if _fps_count > 0 else 0,
		"device": "phone" if Device.is_handheld() else "desktop",
		"new_stamps": ",".join(_game.stamps.new_ids),
		"new_achievements": ",".join(_game.achievements.new_ids),
		"boss_rolls": _game.spawner.boss_rolls().left(MAX_TEXT),
	}
	# Each source's share of all damage dealt, in percent (the end screen's ranking): only those
	# that dealt some, now that there are fifteen weapons and a run carries six of them.
	var total := 0.0
	for amount: float in _game.damage_by_source.values():
		total += amount
	for source: String in _game.damage_by_source:
		data["dmg_" + source] = roundi(100.0 * _game.damage_by_source[source] / maxf(total, 1.0))
	return data


func _orientation() -> String:
	if _game.screen_turned:
		return "turned"
	var size := DisplayServer.window_get_size()
	return "portrait" if size.y > size.x else "landscape"


## Milliseconds since the page started loading.
static func _page_ms() -> int:
	if not OS.has_feature("web"):
		return 0
	return int(JavaScriptBridge.eval("Math.round(performance.now())"))


## The page link's ?from= (who sent the player here), or "".
static func _link_source() -> String:
	if not OS.has_feature("web"):
		return ""
	var source = JavaScriptBridge.eval("(new URLSearchParams(location.search).get('from') || '').slice(0, 40)")
	return source if source is String else ""


func _send(event: String, data: Dictionary) -> void:
	_call("track(%s, %s)" % [JSON.stringify(event), JSON.stringify(data)])


## The cloud save's account (Cloud), stamped on every event from now on; "" when there's none.
static func set_account(account: String) -> void:
	_call("setAccount(%s)" % JSON.stringify(account))


## An event from outside a run (the 云存档 page, the cloud save, sharing), with the version and the
## kind of device added.
static func send_event(event: String, data: Dictionary) -> void:
	data["version"] = VERSION
	data["device"] = "phone" if Device.is_handheld() else "desktop"
	_call("track(%s, %s)" % [JSON.stringify(event), JSON.stringify(data)])


static func _call(call: String) -> void:
	if OS.has_feature("web"):
		JavaScriptBridge.eval("window.survivorsTelemetry && window.survivorsTelemetry.%s" % call)
