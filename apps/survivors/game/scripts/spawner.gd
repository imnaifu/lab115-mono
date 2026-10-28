class_name Spawner
extends RefCounted
## Decides what spawns and when: a steady trickle whose mix shifts over the run, plus
## scripted events (enemy rings closing in, elites) at fixed times.

const MAX_ALIVE := 350
## Phones run the same GDScript through WebAssembly on a slower CPU, so the crowd is capped
## lower there to keep the frame rate up.
const MAX_ALIVE_MOBILE := 260
const RING_RADIUS := 210.0
## The first minutes spawn fewer enemies than the curve says (60% at the start, back to the full
## rate by 3:00), so the lone starting weapon isn't swamped before the first upgrades land.
const EASE_IN_SECONDS := 180.0
const EASE_IN_START := 0.6

## `size` is the art's frame height in logical pixels, `radius` the body used for hits and
## crowd spacing, `color` the puff left behind on death. Radii are smaller than the art on
## purpose: they are the balance the game was tuned with, and crowds overlapping a little reads
## fine with these drawings.
const ENEMY_TYPES := {
	"ping": {"name": "消息红点", "art": "ping", "size": 22.0, "color": Color("ff5d5d"),
		"hp": 4.0, "speed": 50.0, "damage": 5.0, "xp": 1, "radius": 5.0, "wobble": 30.0},
	"bug": {"name": "Bug", "art": "bug", "size": 24.0, "color": Color("ff5d5d"),
		"hp": 8.0, "speed": 38.0, "damage": 6.0, "xp": 1, "radius": 6.0},
	"mail": {"name": "未读邮件", "art": "mail", "size": 24.0, "color": Color("fff7e0"),
		"hp": 14.0, "speed": 44.0, "damage": 8.0, "xp": 2, "radius": 6.0},
	"meeting": {"name": "会议邀请", "art": "meeting", "size": 26.0, "color": Color("5b9cff"),
		"hp": 26.0, "speed": 30.0, "damage": 9.0, "xp": 3, "radius": 6.0},
	"ghost": {"name": "404 幽灵", "art": "ghost404", "size": 26.0, "color": Color("eef1f6"),
		"hp": 18.0, "speed": 40.0, "damage": 10.0, "xp": 3, "radius": 6.0, "ghostly": true},
	"techdebt": {"name": "技术债", "art": "techdebt", "size": 28.0, "color": Color("ffd36b"),
		"hp": 45.0, "speed": 34.0, "damage": 12.0, "xp": 4, "radius": 6.0, "knockback_resist": 0.5},
	"server": {"name": "宕机服务器", "art": "server", "size": 38.0, "color": Color("a9b3c4"),
		"hp": 140.0, "speed": 26.0, "damage": 18.0, "xp": 10, "radius": 10.0, "knockback_resist": 0.8},
	"deadline": {"name": "Deadline", "art": "deadline", "size": 50.0, "color": Color("ff5d5d"),
		"hp": 900.0, "speed": 36.0, "damage": 25.0, "xp": 60, "radius": 14.0, "knockback_resist": 1.0, "elite": true},
	"ai": {"name": "AI 大模型", "art": "ai_boss", "size": 64.0, "color": Color("8c7cf0"),
		"hp": 1600.0, "speed": 40.0, "damage": 30.0, "xp": 100, "radius": 16.0, "knockback_resist": 1.0, "elite": true},
}

## Mix of the steady trickle by run time; each entry applies until its `until` second.
## The opening is slow bugs only; pings, fast and weaving, join once the player has a level or two.
const WAVES := [
	{"until": 30.0, "mix": {"bug": 1}},
	{"until": 60.0, "mix": {"ping": 3, "bug": 2}},
	{"until": 150.0, "mix": {"ping": 2, "bug": 3, "mail": 2}},
	{"until": 240.0, "mix": {"bug": 1, "mail": 3, "meeting": 2, "ghost": 1}},
	{"until": 330.0, "mix": {"mail": 2, "meeting": 2, "ghost": 2, "techdebt": 2}},
	{"until": 450.0, "mix": {"meeting": 2, "ghost": 2, "techdebt": 3, "server": 1}},
	{"until": 600.0, "mix": {"mail": 2, "ghost": 2, "techdebt": 3, "server": 2}},
]

## Scripted moments, sorted by time.
const EVENTS := [
	{"at": 90.0, "kind": "ring", "type": "ping", "count": 16, "text": "消息轰炸！"},
	{"at": 150.0, "kind": "elite", "type": "deadline", "count": 1, "text": "Deadline 逼近！"},
	{"at": 210.0, "kind": "ring", "type": "bug", "count": 30, "text": "Bug 大爆发！"},
	{"at": 300.0, "kind": "elite", "type": "ai", "count": 1, "text": "首领出现：AI 大模型"},
	{"at": 390.0, "kind": "ring", "type": "ghost", "count": 30, "text": "404 幽灵合围！"},
	{"at": 450.0, "kind": "elite", "type": "deadline", "count": 2, "text": "两个 Deadline 撞车了！"},
	{"at": 510.0, "kind": "ring", "type": "ping", "count": 48, "text": "消息轰炸 ×2！"},
	{"at": 540.0, "kind": "elite", "type": "ai", "count": 2, "text": "最后的考验：AI 大模型 ×2"},
]

var max_alive := MAX_ALIVE

var _game: Game
var _spawn_budget := 0.0
var _next_event := 0


func _init(game: Game) -> void:
	_game = game
	if OS.has_feature("mobile") or OS.has_feature("web_android") or OS.has_feature("web_ios"):
		max_alive = MAX_ALIVE_MOBILE


## Spawns per second: 0.6 at the start (eased in, see EASE_IN_SECONDS), about 9 by the
## ten-minute mark.
func spawn_rate() -> float:
	var ease_in := lerpf(EASE_IN_START, 1.0, minf(_game.elapsed / EASE_IN_SECONDS, 1.0))
	return (1.0 + _game.elapsed / 60.0 * 0.8) * ease_in


## Enemy HP multiplier so late enemies keep up with upgraded weapons.
func hp_scale() -> float:
	return 1.0 + _game.elapsed / 60.0 * 0.15


func tick(delta: float) -> void:
	while _next_event < EVENTS.size() and _game.elapsed >= EVENTS[_next_event]["at"]:
		_run_event(EVENTS[_next_event])
		_next_event += 1

	_spawn_budget += spawn_rate() * delta
	while _spawn_budget >= 1.0:
		_spawn_budget -= 1.0
		if _game.enemies.size() >= max_alive:
			_spawn_budget = 0.0
			break
		_game.spawn_enemy(_pick_type(), _game.offscreen_point(_game.random_direction()))


func _pick_type() -> String:
	var mix: Dictionary = WAVES[-1]["mix"]
	for wave: Dictionary in WAVES:
		if _game.elapsed < wave["until"]:
			mix = wave["mix"]
			break
	var names := mix.keys()
	var weights := PackedFloat32Array()
	for type_name in names:
		weights.append(mix[type_name])
	return names[_game.rng.rand_weighted(weights)]


func _run_event(event: Dictionary) -> void:
	var count: int = event["count"]
	for i in count:
		if event["kind"] == "ring":
			var direction := Vector2.from_angle(TAU * i / count)
			_game.spawn_enemy(event["type"], _game.player.position + direction * RING_RADIUS)
		else:
			_game.spawn_enemy(event["type"], _game.offscreen_point(_game.random_direction()))
	Sound.play("alarm")
	_game.announce(event["text"])
