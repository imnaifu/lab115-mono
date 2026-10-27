class_name StreetSign
extends Node2D
## A green street sign on a pole at a crossing, the way Bay Area corners have them: the
## east-west street on the top blade, the north-south one below. The pole's foot is at the
## node's origin.

const FONT_SIZE := 7
const POLE := 30.0
const BLADE := 9.0
const BLADE_COLOR := Color("2e7d4f")

## [top blade, bottom blade]
var names: Array = []


func _draw() -> void:
	var font := Art.font()
	draw_line(Vector2.ZERO, Vector2(0.0, -POLE), Color("7a8494"), 2.0)
	for i in names.size():
		var text: String = names[i]
		var width := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, FONT_SIZE).x + 8.0
		var blade := Rect2(-width / 2.0, -POLE - BLADE * (names.size() - i), width, BLADE - 1.0)
		draw_rect(blade.grow(1.0), Art.INK)
		draw_rect(blade, BLADE_COLOR)
		var baseline := blade.position.y + (blade.size.y + font.get_ascent(FONT_SIZE) - font.get_descent(FONT_SIZE)) / 2.0
		draw_string(font, Vector2(blade.position.x + 4.0, baseline), text, HORIZONTAL_ALIGNMENT_LEFT, -1, FONT_SIZE, Color.WHITE)
