class_name UltimateTimer
extends Node2D
## What a 大招 is doing, over the thing doing it while it lasts (.93, the user: 也看不出来无敌的效果
## ……加一下无敌和无敌的倒计时，现在的实现太粗糙了，没有人知道发生了什么): a word and the seconds left
## over a bar running down (无敌 4.2 over the product manager, 分身 over the designer's copy, 服务器
## over the ops' server), and for 今天必须上线 a see-through gold shield round the player, popping
## up as it starts and flickering through its last second. A child of its host, so it moves with
## it; it reads the host's seconds left through `left_of` and goes once they run out.

const SHIELD_COLOR := Color(1.0, 0.85, 0.35)
const FONT_SIZE := 13
const BAR_SIZE := Vector2(40.0, 4.0)
const POP_SECONDS := 0.2

var word := ""
var total := 1.0
## Returns the host's seconds left.
var left_of: Callable
## How high over the host's feet the word sits (its body's top).
var above := 30.0
var color := SHIELD_COLOR
## The shield's radius; 0 for none.
var shield_radius := 0.0

var _age := 0.0


func _process(delta: float) -> void:
	_age += delta
	if _left() <= 0.0:
		queue_free()
		return
	queue_redraw()


func _left() -> float:
	return float(left_of.call()) if left_of.is_valid() else 0.0


func _draw() -> void:
	var left := _left()
	# Flickering through the last second, like the gold tint, so its end comes as no surprise.
	var showing := left > 1.0 or fmod(left, 0.2) < 0.1
	if shield_radius > 0.0 and showing:
		var grow := clampf(_age / POP_SECONDS, 0.0, 1.0)
		var radius := shield_radius * (0.6 + 0.4 * grow) + sin(_age * 6.0) * 1.5
		draw_circle(Vector2.ZERO, radius, Color(color, 0.22))
		draw_arc(Vector2.ZERO, radius, 0.0, TAU, 48, Color(color, 0.95), 2.5, true)
		draw_arc(Vector2.ZERO, radius + 3.0, 0.0, TAU, 48, Color(Art.INK, 0.35), 1.0, true)
	var font := Art.display_font(900)
	var text := count_text(word, left)
	var width := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, FONT_SIZE).x
	var bar := Rect2(-BAR_SIZE.x / 2.0, -above - BAR_SIZE.y, BAR_SIZE.x, BAR_SIZE.y)
	var baseline := Vector2(-width / 2.0, bar.position.y - 3.0)
	draw_string_outline(font, baseline, text, HORIZONTAL_ALIGNMENT_LEFT, -1, FONT_SIZE, 5, Art.INK)
	draw_string(font, baseline, text, HORIZONTAL_ALIGNMENT_LEFT, -1, FONT_SIZE, color)
	draw_rect(bar.grow(1.0), Art.INK)
	draw_rect(Rect2(bar.position, Vector2(bar.size.x * clampf(left / total, 0.0, 1.0), bar.size.y)), color)


## 无敌 4.2: tenths under 10 seconds, whole seconds above (also the HUD button's label).
static func count_text(what: String, left: float) -> String:
	return "%s %.1f" % [TranslationServer.translate(what), left] if left < 10.0 else "%s %d" % [TranslationServer.translate(what), ceili(left)]
