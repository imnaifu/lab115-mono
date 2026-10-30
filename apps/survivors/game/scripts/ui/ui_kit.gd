class_name UiKit
extends RefCounted
## The game's UI pieces, drawn after the design canvas 「硅谷幸存者 · 界面设计」 (Sokosoko):
## ink outlines, pill buttons with the main one yellow on a hard ink shadow, white cards with a
## heavy outline for dialogs, segmented choices with the picked one filled in ink, switches. The
## HUD and the result image both build from here, so they can't drift apart. Sizes are the
## design's own: it is drawn at 360 wide, which is the portrait view's logical width.

const RADIUS_SM := 8
const RADIUS_MD := 12
const RADIUS_CARD := 16
const RADIUS_LG := 20
const PILL := 99
## The main button's hard shadow: its bottom edge is this much thicker than the rest of the outline.
const SHADOW_DROP := 4
const OUTLINE_HEAVY := 3
const OUTLINE := 2

static var _kicker_font: FontVariation


## A flat rounded box. `padding` is left, top, right, bottom.
static func box(background: Color, border: Color, border_width: int, radius: int, padding: Vector4 = Vector4.ZERO) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = background
	style.border_color = border
	style.set_border_width_all(border_width)
	style.set_corner_radius_all(radius)
	style.anti_aliasing = true
	style.content_margin_left = padding.x
	style.content_margin_top = padding.y
	style.content_margin_right = padding.z
	style.content_margin_bottom = padding.w
	return style


## A box on a hard ink shadow: the heavy outline with its bottom edge SHADOW_DROP thicker, which
## reads as the design's `box-shadow: 0 4px 0 ink` without a blur.
static func raised(background: Color, radius: int, padding: Vector4 = Vector4.ZERO) -> StyleBoxFlat:
	var style := box(background, Art.INK, OUTLINE_HEAVY, radius, padding)
	style.border_width_bottom = OUTLINE_HEAVY + SHADOW_DROP
	return style


## The same, pressed down onto its shadow: the face drops by the shadow's depth.
static func pressed_down(background: Color, radius: int, padding: Vector4 = Vector4.ZERO) -> StyleBoxFlat:
	var style := box(background, Art.INK, OUTLINE_HEAVY, radius, padding)
	style.border_width_top = OUTLINE_HEAVY + SHADOW_DROP
	return style


## A dialog card: white, the heavy ink outline, a soft shadow.
static func dialog_box(padding: Vector4) -> StyleBoxFlat:
	var style := box(Art.PAPER, Art.INK, OUTLINE_HEAVY, RADIUS_LG, padding)
	style.shadow_color = Color(Art.INK, 0.16)
	style.shadow_size = 16
	style.shadow_offset = Vector2(0, 6)
	return style


static func panel(style: StyleBox) -> PanelContainer:
	var container := PanelContainer.new()
	container.add_theme_stylebox_override("panel", style)
	container.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return container


## Text in one of the design's styles: "body" (regular), "muted" (secondary grey), "strong"
## (bold), "heavy" (black weight), "display" (Nunito black, for numbers and Latin headings).
static func label(text: String, font_size: int, style: String = "body", color: Color = Color.TRANSPARENT) -> Label:
	var line := Label.new()
	line.text = text
	line.mouse_filter = Control.MOUSE_FILTER_IGNORE
	line.add_theme_font_size_override("font_size", font_size)
	match style:
		"muted":
			line.add_theme_color_override("font_color", Art.INK_MUTED)
		"strong":
			line.add_theme_font_override("font", Art.font(700))
		"heavy":
			line.add_theme_font_override("font", Art.font(900))
		"display":
			line.add_theme_font_override("font", Art.display_font(900))
	if color.a > 0.0:
		line.add_theme_color_override("font_color", color)
	return line


## The small spaced-out Latin line over a heading (LEVEL UP, YEAR-END BONUS, GAME OVER).
static func kicker(text: String, color: Color = Art.INK_MUTED, font_size: int = 12) -> Label:
	if _kicker_font == null:
		_kicker_font = Art.display_font(900).duplicate() as FontVariation
		_kicker_font.spacing_glyph = 2
	var line := label(text, font_size, "body", color)
	line.add_theme_font_override("font", _kicker_font)
	line.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	# Latin on purpose in both languages, like the design.
	line.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
	return line


## The yellow main button on its hard shadow, one per screen.
static func primary_button(text: String, action: Callable, height: float = 50.0, font_size: int = 17) -> Button:
	var button := _button(text, action, height)
	var padding := Vector4(18, 0, 18, 0)
	button.add_theme_stylebox_override("normal", raised(Art.BRAND, PILL, padding))
	button.add_theme_stylebox_override("hover", raised(Art.BRAND_DEEP, PILL, padding))
	button.add_theme_stylebox_override("pressed", pressed_down(Art.BRAND_DEEP, PILL, padding))
	button.add_theme_stylebox_override("hover_pressed", pressed_down(Art.BRAND_DEEP, PILL, padding))
	button.add_theme_stylebox_override("disabled", raised(Art.PAPER_SUNK, PILL, padding))
	button.add_theme_font_override("font", Art.font(900))
	button.add_theme_font_size_override("font_size", font_size)
	return button


## The white secondary button with a grey outline.
static func secondary_button(text: String, action: Callable, height: float = 44.0, font_size: int = 14) -> Button:
	var button := _button(text, action, height)
	var padding := Vector4(14, 0, 14, 0)
	button.add_theme_stylebox_override("normal", box(Art.PAPER, Art.LINE_STRONG, OUTLINE, PILL, padding))
	button.add_theme_stylebox_override("hover", box(Art.PAPER_SUNK, Art.LINE_STRONG, OUTLINE, PILL, padding))
	button.add_theme_stylebox_override("pressed", box(Art.LINE, Art.LINE_STRONG, OUTLINE, PILL, padding))
	button.add_theme_stylebox_override("hover_pressed", box(Art.LINE, Art.LINE_STRONG, OUTLINE, PILL, padding))
	button.add_theme_font_override("font", Art.font(700))
	button.add_theme_font_size_override("font_size", font_size)
	return button


## A round white button holding an icon (pause, recalibrate, back).
static func round_button(art: String, action: Callable, diameter: float = 32.0, tint: Color = Color.WHITE) -> Button:
	var button := _button("", action, diameter)
	button.custom_minimum_size = Vector2(diameter, diameter)
	button.icon = Art.texture(art)
	button.expand_icon = true
	button.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
	if tint != Color.WHITE:
		button.add_theme_color_override("icon_normal_color", tint)
		button.add_theme_color_override("icon_hover_color", tint)
		button.add_theme_color_override("icon_pressed_color", tint)
		button.add_theme_color_override("icon_focus_color", tint)
	var padding := Vector4.ONE * diameter * 0.25
	button.add_theme_stylebox_override("normal", box(Art.PAPER, Art.INK, OUTLINE, PILL, padding))
	button.add_theme_stylebox_override("hover", box(Art.PAPER_SUNK, Art.INK, OUTLINE, PILL, padding))
	button.add_theme_stylebox_override("pressed", box(Art.LINE, Art.INK, OUTLINE, PILL, padding))
	button.focus_mode = Control.FOCUS_NONE
	return button


## Mutually exclusive choices in one pill track, the picked one filled in ink. Calls `on_pick`
## with the chosen index.
static func segmented(options: Array, selected: int, on_pick: Callable, track: Color = Art.PAPER, height: float = 36.0) -> Control:
	var holder := panel(box(track, Art.LINE if track == Art.PAPER else Color.TRANSPARENT, 1 if track == Art.PAPER else 0, PILL, Vector4(4, 4, 4, 4)))
	holder.mouse_filter = Control.MOUSE_FILTER_PASS
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 4)
	holder.add_child(row)
	var group := ButtonGroup.new()
	var empty := StyleBoxEmpty.new()
	var picked := box(Art.INK, Color.TRANSPARENT, 0, PILL)
	for i in options.size():
		var option := Button.new()
		option.text = options[i]
		option.toggle_mode = true
		option.button_group = group
		option.button_pressed = i == selected
		option.focus_mode = Control.FOCUS_NONE
		option.custom_minimum_size = Vector2(0, height - 8.0)
		option.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		option.add_theme_font_override("font", Art.font(700))
		option.add_theme_font_size_override("font_size", 13)
		for state in ["normal", "hover", "focus"]:
			option.add_theme_stylebox_override(state, empty)
		option.add_theme_stylebox_override("pressed", picked)
		option.add_theme_stylebox_override("hover_pressed", picked)
		option.add_theme_color_override("font_color", Art.INK_MUTED)
		option.add_theme_color_override("font_hover_color", Art.INK)
		option.add_theme_color_override("font_pressed_color", Art.PAPER)
		option.add_theme_color_override("font_hover_pressed_color", Art.PAPER)
		option.pressed.connect(on_pick.bind(i))
		option.pressed.connect(func() -> void: Sound.play("click"))
		row.add_child(option)
	return holder


## An on/off switch: a yellow track when on, a sunk one when off, the knob sliding across.
class ToggleSwitch extends Button:
	const TRACK := Vector2(48, 28)
	const KNOB := 20.0

	func _init(on: bool) -> void:
		toggle_mode = true
		button_pressed = on
		flat = true
		focus_mode = Control.FOCUS_NONE
		custom_minimum_size = TRACK
		size_flags_vertical = Control.SIZE_SHRINK_CENTER
		for state in ["normal", "hover", "pressed", "hover_pressed", "focus"]:
			add_theme_stylebox_override(state, StyleBoxEmpty.new())
		toggled.connect(func(_on: bool) -> void:
			Sound.play("click")
			queue_redraw())

	func _draw() -> void:
		var track := Rect2(Vector2.ZERO, TRACK)
		draw_style_box(UiKit.box(Art.BRAND if button_pressed else Art.PAPER_SUNK, Art.INK, UiKit.OUTLINE, UiKit.PILL), track)
		var knob_x := TRACK.x - KNOB / 2.0 - 4.0 if button_pressed else KNOB / 2.0 + 4.0
		var center := Vector2(knob_x, TRACK.y / 2.0)
		draw_circle(center, KNOB / 2.0, Art.PAPER)
		draw_arc(center, KNOB / 2.0 - 1.0, 0.0, TAU, 32, Art.INK, UiKit.OUTLINE, true)


static func icon(art: String, icon_size: float, tint: Color = Color.WHITE) -> TextureRect:
	var picture := TextureRect.new()
	picture.texture = Art.texture(art)
	picture.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	picture.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	picture.custom_minimum_size = Vector2(icon_size, icon_size)
	picture.size = Vector2(icon_size, icon_size)
	picture.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	picture.mouse_filter = Control.MOUSE_FILTER_IGNORE
	picture.modulate = tint
	return picture


## An icon on a rounded square of colour, like the design's card wells.
static func well(art: String, well_size: float, fill: Color, radius: int = RADIUS_MD) -> Control:
	var square := panel(box(fill, Color.TRANSPARENT, 0, radius))
	square.custom_minimum_size = Vector2(well_size, well_size)
	square.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	square.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	var centre := CenterContainer.new()
	centre.mouse_filter = Control.MOUSE_FILTER_IGNORE
	square.add_child(centre)
	centre.add_child(icon(art, well_size * 0.72))
	return square


## A small pill tag: 新武器, 被动, 推荐.
static func tag(text: String, background: Color, color: Color, border_width: int = 0, font_size: int = 11) -> Control:
	var pill := panel(box(background, Art.INK, border_width, PILL, Vector4(7, 0, 7, 1)))
	pill.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	pill.add_child(label(text, font_size, "heavy" if border_width > 0 else "strong", color))
	return pill


## One pip per level: ink up to `filled`; with `next`, the `gained` after it are yellow (the
## levels a card gives); the rest hollow.
static func level_dots(filled: int, total: int, next: bool = false, gained: int = 1) -> Control:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 3)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	for i in total:
		var dot := Panel.new()
		dot.custom_minimum_size = Vector2(7, 7)
		dot.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var style: StyleBoxFlat
		if i < filled:
			style = box(Art.INK, Art.INK, 0, PILL)
		elif i < filled + gained and next:
			style = box(Art.BRAND, Art.INK, 1, PILL)
		else:
			style = box(Color.TRANSPARENT, Art.LINE_STRONG, 1, PILL)
		dot.add_theme_stylebox_override("panel", style)
		row.add_child(dot)
	return row


## A fixed gap in a box container.
static func gap(height: float) -> Control:
	var spacer := Control.new()
	spacer.custom_minimum_size = Vector2(0, height)
	spacer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return spacer


## Takes up the rest of a box container.
static func filler() -> Control:
	var spacer := Control.new()
	spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	spacer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return spacer


## Keyboard focus: a 2px ring just outside the control.
static func focus_ring(radius: int) -> StyleBoxFlat:
	var ring := box(Color.TRANSPARENT, Art.LINK, 2, radius)
	ring.draw_center = false
	ring.set_expand_margin_all(3)
	return ring


## The base theme: the default face and the plain label colour. Everything styled differently
## sets its own overrides through the helpers above.
static func build_theme() -> Theme:
	var theme := Theme.new()
	theme.default_font = Art.font(500)
	theme.default_font_size = 12
	theme.set_color("font_color", "Label", Art.INK)
	for color_name in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color", "font_hover_pressed_color"]:
		theme.set_color(color_name, "Button", Art.INK)
	theme.set_stylebox("focus", "Button", focus_ring(PILL))
	return theme


static func _button(text: String, action: Callable, height: float) -> Button:
	var button := Button.new()
	button.text = text
	button.custom_minimum_size = Vector2(0, height)
	button.add_theme_stylebox_override("focus", focus_ring(PILL))
	button.pressed.connect(action)
	button.pressed.connect(func() -> void: Sound.play("click"))
	return button
