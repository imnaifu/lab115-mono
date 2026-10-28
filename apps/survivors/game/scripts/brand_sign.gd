class_name BrandSign
extends Node2D
## A rooftop sign: a little board on two legs with a parody company's icon and name, in the
## same ink-outlined style as the drawings. The name uses the game font, so the sign is drawn
## here rather than baked into an SVG. Sits with its legs' feet at the node's origin.

const FONT_SIZE := 9
const HEIGHT := 15.0
const LEG := 4.0
const PADDING := 4.0
const ICON := 11.0

## An entry of BayArea.BRANDS: text, colour and an optional icon art or badge text.
var brand: Dictionary

static var _board: StyleBoxFlat


func _draw() -> void:
	var font := Art.display_font(800)
	var text: String = brand["text"]
	var color: Color = brand["color"]
	var icon_art: String = brand.get("icon", "")
	var badge: String = brand.get("badge", "")
	var text_width := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, FONT_SIZE).x
	var badge_width := 0.0
	if badge != "":
		badge_width = font.get_string_size(badge, HORIZONTAL_ALIGNMENT_LEFT, -1, FONT_SIZE).x + 6.0
	var width := PADDING * 2.0 + text_width
	if icon_art != "":
		width += ICON + 3.0
	if badge != "":
		width += badge_width + 2.0
	var board := Rect2(-width / 2.0, -LEG - HEIGHT, width, HEIGHT)

	for leg_x in [board.position.x + 5.0, board.end.x - 5.0]:
		draw_line(Vector2(leg_x, -LEG), Vector2(leg_x, 0.0), Art.INK, 1.5)
	draw_style_box(_board_style(), board)
	var x := board.position.x + PADDING
	# Centres the text's ink between ascent and descent rather than on the baseline.
	var baseline := board.position.y + (HEIGHT + font.get_ascent(FONT_SIZE) - font.get_descent(FONT_SIZE)) / 2.0
	if icon_art != "":
		draw_texture_rect(Art.texture(icon_art), Rect2(x, board.position.y + (HEIGHT - ICON) / 2.0, ICON, ICON), false)
		x += ICON + 3.0
	draw_string(font, Vector2(x, baseline), text, HORIZONTAL_ALIGNMENT_LEFT, -1, FONT_SIZE, color)
	x += text_width + 2.0
	if badge != "":
		draw_rect(Rect2(x, board.position.y + 3.0, badge_width, HEIGHT - 6.0), color)
		draw_string(font, Vector2(x + 3.0, baseline), badge, HORIZONTAL_ALIGNMENT_LEFT, -1, FONT_SIZE, Color.WHITE)


static func _board_style() -> StyleBoxFlat:
	if _board == null:
		_board = StyleBoxFlat.new()
		_board.bg_color = Art.PAPER
		_board.border_color = Art.INK
		_board.set_border_width_all(2)
		_board.set_corner_radius_all(4)
		_board.anti_aliasing = true
	return _board
