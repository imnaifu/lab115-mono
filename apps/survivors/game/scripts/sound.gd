class_name Sound
extends Node
## Sound effects and music. One instance hangs off the scene tree's root rather than the game
## scene, so the music carries on through "play again" (which reloads the scene). Callers only
## use the static helpers: Sound.play("hit"), Sound.xp(), Sound.music("battle"),
## Sound.boss_move("charge"), Sound.boss_down(), and Sound.set_mix(), which the HUD calls every
## frame so the music can step back under dialogs and at low health, and speed up in the last
## minute.
##
## Both can be switched off in Settings ("sound", "music"); the choice is saved like the others.

const SFX_DIR := "res://assets/audio/sfx/"
const MUSIC_DIR := "res://assets/audio/music/"
## Per effect: volume in dB, plus optional `gap` (minimum seconds between two plays, so a crowd
## dying at once is one pop rather than fifty stacked on top of each other) and `spread` (random
## pitch range, so repeats don't sound mechanical).
const EFFECTS := {
	"click": {"volume": -8.0},
	"level_up": {"volume": -6.0},
	"pick": {"volume": -6.0},
	"xp": {"volume": -12.0, "gap": 0.03},
	"hit": {"volume": -20.0, "gap": 0.08, "spread": 0.15},
	"kill": {"volume": -16.0, "gap": 0.05, "spread": 0.12},
	"hurt": {"volume": -8.0, "gap": 0.2},
	"heal": {"volume": -6.0},
	"magnet": {"volume": -6.0},
	"alarm": {"volume": -6.0},
	"zap": {"volume": -14.0, "gap": 0.1, "spread": 0.1},
	"win": {"volume": -4.0},
	"lose": {"volume": -4.0},
	# The ones below were levelled against those above by their loudest 50 ms: boss cues sit
	# between a hit and the alarm, a boss going down and an ultimate near the level-up chime.
	"windup": {"volume": -18.0, "gap": 0.3},
	"blink": {"volume": -13.0, "gap": 0.3},
	"clones": {"volume": -19.0, "gap": 0.3},
	"summon": {"volume": -1.0, "gap": 0.3},
	"lob": {"volume": -6.0, "gap": 0.3},
	"boss_fire": {"volume": -14.0, "gap": 0.1, "spread": 0.05},
	"quake": {"volume": -10.0, "gap": 0.1},
	"boss_down": {"volume": -6.0},
	"heartbeat": {"volume": -16.0},
	"ultimate": {"volume": -8.0},
	"corner": {"volume": -8.0},
	"block": {"volume": -15.0, "gap": 0.08, "spread": 0.1},
	"reel_tick": {"volume": -4.0},
	"payout": {"volume": 0.0},
	"standup": {"volume": -8.0},
}
## The title track measures about 2 dB quieter than the battle one (-20.6 vs -18.5 LUFS); the
## volumes even that out and keep the music under the effects.
const TRACKS := {
	"title": {"volume": -12.0},
	"battle": {"volume": -14.0},
}
const VOICES := 12
## Stars picked up in quick succession climb a semitone each, up to an octave, like coins in most
## games; a pause longer than this starts the run of notes again.
const XP_CHAIN_SECONDS := 0.6
const XP_CHAIN_STEPS := 12
const FADE_SECONDS := 0.6
## Music and effects each get a bus, so the music can step back without taking the effects with
## it. Web builds play through the browser's own audio, which follows bus volumes but not bus
## effects (no filters), so stepping back is by volume only.
## The buses come from default_bus_layout.tres and are never added here: in a web build (Godot
## 4.7.2) a bus added at run time lands at the wrong index in the browser's audio graph, and
## pointing it at Master then wires every bus, Master included, into a loop that never reaches
## the speakers.
const MUSIC_BUS := "Music"
const SFX_BUS := "Effects"
## How far the music steps back under a dialog (pause, level-up, funding draw), and at zero
## health (from nothing at the HUD's low-health line), so the heartbeat comes through.
const DIALOG_DUCK_DB := -8.0
const DANGER_DUCK_DB := -8.0
## A boss going down knocks the music back this far, coming back over BOSS_DUCK_SECONDS.
const BOSS_DUCK_DB := -10.0
const BOSS_DUCK_SECONDS := 1.2
## How fast the music's level follows all that, in dB per second, so it never jumps.
const DUCK_SLEW := 40.0
## Seconds between heartbeats at the low-health line and at zero health.
const HEARTBEAT_SLOW := 1.0
const HEARTBEAT_FAST := 0.55
## The last minute's music plays this much faster, reached over HURRY_RAMP_SECONDS. It is a plain
## speed-up, so it also goes up in pitch a little, like an old cartridge's hurry-up.
const HURRY_SPEED := 1.05
const HURRY_RAMP_SECONDS := 2.0
## The cue for a boss move as it starts, by Enemy ability. The always-on ones (countdown, aura)
## have none: the alarm already marked the boss's arrival.
const MOVE_SOUNDS := {
	"charge": "windup",
	"volley": "windup",
	"quake": "windup",
	"blink": "blink",
	"clones": "clones",
	"summon": "summon",
	"lob": "lob",
	# The maps' guest bosses (.26) brace like the others before their moves.
	"pull": "windup",
	"squeeze": "windup",
	"sweep": "windup",
	"redlight": "windup",
}

static var _instance: Sound

var _streams := {}
var _voices: Array[AudioStreamPlayer] = []
var _next_voice := 0
var _last_played := {}
var _music_player: AudioStreamPlayer
## The track that should be playing; "" for silence.
var _track := ""
var _fade: Tween
var _xp_step := 0
var _last_xp_at := -1.0
var _music_bus := -1
## The HUD's last report (set_mix).
var _dialog := false
var _danger := 0.0
var _hurry := false
var _boss_duck_left := 0.0
var _heartbeat_left := 0.0


static func play(effect: String) -> void:
	_shared()._play(effect, 1.0)


## A star was picked up: the same pluck, a little higher each time while they keep coming.
static func xp() -> void:
	var sound := _shared()
	var now := _now()
	sound._xp_step = mini(sound._xp_step + 1, XP_CHAIN_STEPS) if now - sound._last_xp_at < XP_CHAIN_SECONDS else 0
	sound._last_xp_at = now
	sound._play("xp", pow(2.0, sound._xp_step / 12.0))


## Switches to a track ("title" or "battle"); does nothing if it is already playing.
static func music(track_name: String) -> void:
	var sound := _shared()
	if track_name == sound._track and sound._music_player != null and sound._music_player.playing:
		return
	sound._track = track_name
	sound._start_track()


## Fades the music out, e.g. under the win / lose jingle.
static func stop_music() -> void:
	var sound := _shared()
	sound._track = ""
	if sound._music_player == null or not sound._music_player.playing:
		return
	sound._kill_fade()
	sound._fade = sound.create_tween()
	sound._fade.tween_property(sound._music_player, "volume_db", -40.0, FADE_SECONDS)
	sound._fade.tween_callback(sound._music_player.stop)


## A boss starts a move: its cue, so a move made off screen can still be heard coming.
static func boss_move(ability: String) -> void:
	if MOVE_SOUNDS.has(ability):
		play(MOVE_SOUNDS[ability])


## A boss went down: a bang of its own, which the kill pop's gap can't swallow, and the music
## steps back to make room for it.
static func boss_down() -> void:
	var sound := _shared()
	sound._play("boss_down", 1.0)
	if sfx_enabled():
		sound._boss_duck_left = BOSS_DUCK_SECONDS


## The HUD's report, every frame: whether a dialog covers the game, how close the player is to
## dying (0 at or above the low-health line, 1 at zero) and whether the run is in its last minute.
## The title and end screens report none of the three.
static func set_mix(dialog: bool, danger: float, hurry: bool) -> void:
	var sound := _shared()
	sound._dialog = dialog
	sound._danger = danger
	sound._hurry = hurry


static func sfx_enabled() -> bool:
	return Settings.get_value("sound", true)


static func set_sfx_enabled(enabled: bool) -> void:
	Settings.set_value("sound", enabled)


static func music_enabled() -> bool:
	return Settings.get_value("music", true)


static func set_music_enabled(enabled: bool) -> void:
	Settings.set_value("music", enabled)
	_shared()._start_track()


static func _shared() -> Sound:
	if _instance == null:
		_instance = Sound.new()
		_instance.name = "Sound"
		# Deferred: the first call comes from the game scene's _ready, while the root is still
		# busy adding that scene and refuses new children.
		(Engine.get_main_loop() as SceneTree).root.add_child.call_deferred(_instance)
	return _instance


static func _now() -> float:
	return Time.get_ticks_msec() / 1000.0


func _ready() -> void:
	# Level-up, pause and end screens pause the tree; their clicks and jingles still play.
	process_mode = Node.PROCESS_MODE_ALWAYS
	_music_bus = AudioServer.get_bus_index(MUSIC_BUS)
	if _music_bus == -1 or AudioServer.get_bus_index(SFX_BUS) == -1:
		# Players on a missing bus play on Master; only the music's stepping back is lost.
		push_error("default_bus_layout.tres lacks the %s / %s buses" % [MUSIC_BUS, SFX_BUS])
	for i in VOICES:
		var voice := AudioStreamPlayer.new()
		voice.bus = SFX_BUS
		add_child(voice)
		_voices.append(voice)
	_music_player = AudioStreamPlayer.new()
	_music_player.bus = MUSIC_BUS
	add_child(_music_player)
	# A track asked for before this node joined the tree starts now.
	_start_track()


func _process(delta: float) -> void:
	if _music_player == null:
		return
	_boss_duck_left = maxf(0.0, _boss_duck_left - delta)
	# Under a dialog at low health the deeper of the two applies, not both.
	var duck := minf(DIALOG_DUCK_DB if _dialog else 0.0, DANGER_DUCK_DB * _danger)
	duck += BOSS_DUCK_DB * _boss_duck_left / BOSS_DUCK_SECONDS
	if _music_bus != -1:
		var level := AudioServer.get_bus_volume_db(_music_bus)
		if not is_equal_approx(level, duck):
			AudioServer.set_bus_volume_db(_music_bus, move_toward(level, duck, DUCK_SLEW * delta))

	if _danger > 0.0 and not _dialog:
		_heartbeat_left -= delta
		if _heartbeat_left <= 0.0:
			_play("heartbeat", 1.0)
			_heartbeat_left = lerpf(HEARTBEAT_SLOW, HEARTBEAT_FAST, _danger)
	else:
		# So the first beat comes as soon as health drops under the line.
		_heartbeat_left = 0.0

	var speed := HURRY_SPEED if _hurry else 1.0
	if not is_equal_approx(_music_player.pitch_scale, speed):
		_music_player.pitch_scale = move_toward(_music_player.pitch_scale, speed, (HURRY_SPEED - 1.0) / HURRY_RAMP_SECONDS * delta)


func _notification(what: int) -> void:
	if _music_player == null:
		return
	# Browsers keep playing a background tab's audio; the game pauses itself there, and so does
	# the music.
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT:
		_music_player.stream_paused = true
	elif what == NOTIFICATION_APPLICATION_FOCUS_IN:
		_music_player.stream_paused = false


func _play(effect: String, pitch: float) -> void:
	# Effects asked for in the first frame, before this node is in the tree, are dropped.
	if not is_inside_tree() or not sfx_enabled():
		return
	var spec: Dictionary = EFFECTS[effect]
	var now := _now()
	if now - _last_played.get(effect, -1.0) < spec.get("gap", 0.0):
		return
	_last_played[effect] = now
	var voice := _voices[_next_voice]
	_next_voice = (_next_voice + 1) % VOICES
	voice.stream = _stream(SFX_DIR, effect)
	voice.volume_db = spec["volume"]
	var spread: float = spec.get("spread", 0.0)
	voice.pitch_scale = pitch * randf_range(1.0 - spread, 1.0 + spread)
	voice.play()


func _start_track() -> void:
	if _music_player == null:
		return
	_kill_fade()
	if _track == "" or not music_enabled():
		_music_player.stop()
		return
	# Music files are imported with looping on (see their .import files).
	_music_player.stream = _stream(MUSIC_DIR, _track)
	_music_player.volume_db = TRACKS[_track]["volume"]
	# A new track starts at its own speed, even if the last run ended in its hurried last minute.
	_music_player.pitch_scale = 1.0
	_music_player.play()


func _kill_fade() -> void:
	if _fade != null:
		_fade.kill()
		_fade = null


func _stream(directory: String, sound_name: String) -> AudioStream:
	var path := directory + sound_name + ".ogg"
	if not _streams.has(path):
		_streams[path] = load(path)
	return _streams[path]
