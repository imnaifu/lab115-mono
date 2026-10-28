class_name FreewaySign
extends Node2D
## A green freeway sign on two posts beside US-101 / I-280: the route number with an arrow and
## the city that way (San Francisco north, San Jose south). Drawn rather than an SVG so the
## text uses the game font. Sits with its posts' feet at the node's origin.

const FONT_SIZE := 9
const SIZE := Vector2(74.0, 30.0)
const POST := 22.0
const GREEN := Color("2e7d4f")

var number := "101"
## Pointing north (to San Francisco) or south (to San Jose).
var north := true


func _draw() -> void:
	var board := Rect2(-SIZE.x / 2.0, -POST - SIZE.y, SIZE.x, SIZE.y)
	for post_x in [board.position.x + 10.0, board.end.x - 10.0]:
		draw_line(Vector2(post_x, -POST), Vector2(post_x, 0.0), Art.INK, 2.0)
	draw_rect(board.grow(2.0), Art.INK)
	draw_rect(board, GREEN)
	draw_rect(board.grow(-2.0), Color.WHITE, false, 1.0)
	var font := Art.display_font(800)
	var heading := "%s %s" % [number, "N" if north else "S"]
	draw_string(font, board.position + Vector2(6.0, 12.0), heading, HORIZONTAL_ALIGNMENT_LEFT, -1, FONT_SIZE, Color.WHITE)
	draw_string(font, board.position + Vector2(6.0, 24.0), "San Francisco" if north else "San Jose", HORIZONTAL_ALIGNMENT_LEFT, -1, FONT_SIZE - 1, Color.WHITE)
	# An arrow at the right end, up for north and down for south.
	var arrow_x := board.end.x - 9.0
	var tip := Vector2(arrow_x, board.position.y + (5.0 if north else SIZE.y - 5.0))
	var tail := Vector2(arrow_x, board.position.y + (SIZE.y - 6.0 if north else 6.0))
	var back := 4.0 if north else -4.0
	draw_line(tail, tip, Color.WHITE, 2.0)
	draw_line(tip, tip + Vector2(-3.5, back), Color.WHITE, 2.0)
	draw_line(tip, tip + Vector2(3.5, back), Color.WHITE, 2.0)
