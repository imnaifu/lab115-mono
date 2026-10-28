class_name Sound
extends Node
## Sound effects and music. One instance hangs off the scene tree's root rather than the game
## scene, so the music carries on through "play again" (which reloads the scene). Callers only
## use the static helpers: Sound.play("hit"), Sound.xp(), Sound.music("battle").
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
	for i in VOICES:
		var voice := AudioStreamPlayer.new()
		add_child(voice)
		_voices.append(voice)
	_music_player = AudioStreamPlayer.new()
	add_child(_music_player)
	# A track asked for before this node joined the tree starts now.
	_start_track()


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
