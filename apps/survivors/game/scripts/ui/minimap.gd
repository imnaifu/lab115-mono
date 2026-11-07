class_name Minimap
extends Control
## The whole map at a glance, top left of the HUD under the weapon and passive slots (0.1.0, the user: 加小地图，
## 小地图上用不同颜色圆点区分). Only dots on a plain ground, no roads or districts: .1–.43 had a
## minimap with the coastline, freeways and district colours, and the user took it out as too busy
## (.44). The map is a bounded square (Maps.current.BOUNDS), so it always shows all of it.
## A faint frame marks what the screen shows. The crowd isn't drawn; the rest is, one colour a
## kind (DOTS, legend() for the pause screen): the player, landmarks (open: filled; not yet: a grey
## ring; checked in at: gone), bosses, and the things laid about the map (MapObjects).

const MAP_SIZE := 72.0
const INSET := 3.0
const DOT := 2.4
const PLAYER_DOT := 3.2
## Each kind's colour, and the one-character name the pause screen's legend gives it.
const DOTS := {
	"player": [Art.INK, "自己"],
	"stamp": [Art.BRAND_DEEP, "打卡"],
	"boss": [Art.HP_RED, "boss"],
	"parcel": [Color("a8743a"), "快递"],
	"room": [Art.BLUE, "会议"],
	"form": [Color("8a5cd6"), "加班"],
	"desk": [Art.GREEN, "工位"],
}
const GOLD_DESK := Color(1.0, 0.75, 0.1)
## A meeting going on blinks red this many times a second.
const BLINK := 3.0

var game: Game

var _frame := StyleBoxFlat.new()
var _clock := 0.0


func _ready() -> void:
	custom_minimum_size = Vector2.ONE * (MAP_SIZE + INSET * 2.0)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_frame.bg_color = Color(Art.PAPER_SOFT, 0.92)
	_frame.border_color = Art.INK
	_frame.set_border_width_all(2)
	_frame.set_corner_radius_all(10)
	_frame.anti_aliasing = true


func _process(delta: float) -> void:
	_clock += delta
	queue_redraw()


func _draw() -> void:
	draw_style_box(_frame, Rect2(Vector2.ZERO, size))
	if game == null or game.state == Game.State.TITLE:
		return
	var area := Rect2(Vector2.ONE * INSET, Vector2.ONE * MAP_SIZE)
	var bounds: Rect2 = Maps.current.BOUNDS
	# What the screen shows, faint, under everything.
	var half := game.view_half()
	var view := Rect2(_to_map(game.player.position - half, area, bounds), half * 2.0 * area.size / bounds.size)
	draw_rect(view.intersection(area), Color(Art.INK, 0.12))
	# Landmarks: filled once open, a grey ring before; none once checked in at this run.
	for id: String in Maps.current.STAMPS:
		if game.stamps.done(id):
			continue
		var at := _to_map(game.stamps.ring_center(id), area, bounds)
		if game.stamps.is_open(id):
			draw_circle(at, DOT + 0.6, DOTS["stamp"][0])
		else:
			draw_arc(at, DOT, 0.0, TAU, 12, Art.LINE_STRONG, 1.2, true)
	for thing: Dictionary in game.map_objects.things():
		var color: Color = DOTS[thing["kind"]][0]
		if thing["kind"] == "desk" and thing["golden"]:
			color = GOLD_DESK
		elif thing["kind"] == "room" and thing["state"] == "on":
			# A meeting on: red, blinking, so it reads at a glance.
			color = DOTS["boss"][0] if fmod(_clock * BLINK, 1.0) < 0.5 else DOTS["room"][0]
		draw_circle(_to_map(thing["at"], area, bounds), DOT, color)
	for enemy in game.enemies:
		if enemy.is_elite and not enemy.dead:
			draw_circle(_to_map(enemy.position, area, bounds), DOT + 0.6, DOTS["boss"][0])
	# The player last, on top, ringed in white to stand out from whatever is under them.
	var me := _to_map(game.player.position, area, bounds)
	draw_circle(me, PLAYER_DOT + 1.0, Art.PAPER)
	draw_circle(me, PLAYER_DOT, DOTS["player"][0])


## A world point on the minimap, clamped inside it (the player can't leave BOUNDS, but just in case).
func _to_map(point: Vector2, area: Rect2, bounds: Rect2) -> Vector2:
	var at := area.position + (point - bounds.position) / bounds.size * area.size
	return at.clamp(area.position, area.end)


## The colours and what each means, for the pause screen: a dot and a word each.
static func legend() -> Control:
	var flow := HFlowContainer.new()
	flow.add_theme_constant_override("h_separation", 10)
	flow.add_theme_constant_override("v_separation", 4)
	flow.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for kind: String in DOTS:
		var item := HBoxContainer.new()
		item.add_theme_constant_override("separation", 3)
		item.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var dot := UiKit.panel(UiKit.box(DOTS[kind][0], Color.TRANSPARENT, 0, UiKit.PILL))
		dot.custom_minimum_size = Vector2(8, 8)
		dot.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		item.add_child(dot)
		item.add_child(UiKit.label(DOTS[kind][1], 11, "body", Art.INK_MUTED))
		flow.add_child(item)
	return flow
