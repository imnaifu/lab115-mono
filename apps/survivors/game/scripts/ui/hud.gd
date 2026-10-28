class_name Hud
extends CanvasLayer
## Screen-space UI: XP bar, timer, kills, inventory slots and the touch joystick, plus the
## title, level-up, pause and end-of-run overlays. Keeps running while the tree is paused so
## the overlays can take input.
## Overlay visibility follows game.state every frame instead of being toggled by events, so a
## pick made from code (the smoke-test bot) closes the level-up panel too.
## Layout is anchored rather than placed, because the view is 640x360 or wider in landscape
## and 360x640 or taller on an upright phone in portrait; a phone set to landscape turns the
## whole layer a quarter turn instead (fit_screen, Game.apply_orientation).

## Ignore picks for a moment after the panel opens, so keys held down while playing don't
## choose a card by accident.
const PICK_DELAY_MS := 300
const SLOT_COUNT := 6
const SLOT_SIZE := 20.0
## Accent colour of a card or row by the kind of upgrade.
const KIND_COLORS := {"weapon": Art.BLUE, "passive": Art.GREEN, "heal": Art.PINK}
## The title screen's parade of the cast.
const PARADE := ["ping", "bug", "mail", "meeting", "ghost404", "techdebt", "server"]
## Width the title screen's text wraps at, which keeps the English title on two lines instead
## of stretching the column past the screen.
const TITLE_TEXT_WIDTH := 340.0
const LOW_HP_RATIO := 0.35
## Settings-screen hint for each Tilt.state().
const TILT_HINTS := {
	"asking": "请在弹窗里允许访问动作与方向",
	"retry": "再点一下屏幕来授权",
	"denied": "没有权限：请在浏览器设置里允许动作与方向",
	"unsupported": "这台设备不支持",
}

var game: Game

var _root: Control
var _xp_bar: ProgressBar
var _level_label: Label
var _time_label: Label
var _kills_label: Label
var _pause_button: Button
var _recalibrate_button: Button
var _top_bar: Control
var _weapon_slots: Array[Panel] = []
var _passive_slots: Array[Panel] = []
var _toast: PanelContainer
var _toast_label: Label
var _toast_tween: Tween
var _vignette: TextureRect
var _joystick: Joystick
var _touch_index := -1
var _title_overlay: Control
var _level_up_overlay: Control
var _cards_holder: CenterContainer
var _pause_overlay: Control
var _pause_holder: CenterContainer
var _end_overlay: Control
var _end_holder: CenterContainer
var _settings_overlay: Control
var _settings_holder: CenterContainer
var _settings_open := false
var _tilt_hint: Label
var _shown_state := -1
## Brightens the XP bar for a moment whenever XP comes in, so picking up a star registers.
var _xp_flash := 0.0
var _seen_xp := Vector2i.ZERO
var _accept_picks_at := 0
var _clock := 0.0


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_root = Control.new()
	_root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.theme = _build_theme()
	add_child(_root)

	_build_vignette()
	_joystick = Joystick.new()
	_joystick.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_joystick.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(_joystick)
	_build_top_bar()
	_build_toast()
	_title_overlay = _build_title()
	_level_up_overlay = _overlay(Color(Art.INK, 0.45))
	_cards_holder = _centered(_level_up_overlay)
	_pause_overlay = _overlay(Color(Art.INK, 0.45))
	_pause_holder = _centered(_pause_overlay)
	_end_overlay = _overlay(Color(Art.INK, 0.55))
	_end_holder = _centered(_end_overlay)
	# Last, so it opens on top of the title or pause screen it was opened from.
	_settings_overlay = _overlay(Color(Art.INK, 0.5))
	_settings_holder = _centered(_settings_overlay)

	game.inventory_changed.connect(_refresh_inventory)
	game.level_up_offered.connect(_show_level_up)
	game.run_ended.connect(_show_end)
	game.announced.connect(_show_toast)


func _process(delta: float) -> void:
	_clock += delta
	_xp_bar.value = clampf(float(game.xp) / game.xp_to_next(), 0.0, 1.0)
	var xp_now := Vector2i(game.level, game.xp)
	if xp_now != _seen_xp:
		_seen_xp = xp_now
		_xp_flash = 1.0
	_xp_flash = maxf(0.0, _xp_flash - delta * 4.0)
	_xp_bar.modulate = Color.WHITE.lerp(Color(1.4, 1.4, 1.4), _xp_flash)
	_level_label.text = "Lv %d" % game.level
	_time_label.text = _clock_text(game.elapsed)
	_kills_label.text = str(game.kills)

	var hp_ratio := game.player.hp / game.player.max_hp
	var danger := clampf((LOW_HP_RATIO - hp_ratio) / LOW_HP_RATIO, 0.0, 1.0)
	_vignette.modulate.a = danger * (0.75 + 0.25 * sin(_clock * 6.0)) if game.state == Game.State.PLAYING else 0.0

	var state := game.state
	_title_overlay.visible = state == Game.State.TITLE
	_top_bar.visible = state != Game.State.TITLE
	_pause_button.visible = state == Game.State.PLAYING
	_recalibrate_button.visible = state == Game.State.PLAYING and Tilt.enabled()
	_level_up_overlay.visible = state == Game.State.LEVEL_UP
	_pause_overlay.visible = state == Game.State.PAUSED
	_end_overlay.visible = state == Game.State.ENDED
	if state != Game.State.TITLE and state != Game.State.PAUSED:
		_settings_open = false
	_settings_overlay.visible = _settings_open
	if _settings_open and _tilt_hint != null:
		# How tilt steering works (or why it can't yet) only matters while it's switched on.
		_tilt_hint.visible = Tilt.enabled()
		_tilt_hint.text = TILT_HINTS.get(Tilt.state(), "左右以水平为准，前后以开局时拿手机的角度为准；玩的时候点右上角的手机按钮可以重新校准")
	if state != _shown_state:
		_shown_state = state
		if state != Game.State.PLAYING:
			_release_touch()
		if state == Game.State.PAUSED:
			_show_pause()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		_on_touch(event)
		return
	if event is InputEventScreenDrag:
		if event.index == _touch_index:
			_joystick.drag(_to_layout(event.position))
			game.player.touch_direction = _joystick.direction()
		return
	var key_event := event as InputEventKey
	if key_event == null or not key_event.pressed or key_event.echo:
		return
	var key := key_event.keycode
	if _settings_open:
		if key == KEY_ESCAPE:
			_close_settings()
		return
	match game.state:
		Game.State.TITLE:
			if key == KEY_ENTER or key == KEY_KP_ENTER or key == KEY_SPACE:
				game.start_run()
		Game.State.PLAYING:
			if key == KEY_ESCAPE or key == KEY_P:
				game.set_paused(true)
		Game.State.PAUSED:
			if key == KEY_ESCAPE or key == KEY_P:
				game.set_paused(false)
			elif key == KEY_R:
				game.restart()
		Game.State.LEVEL_UP:
			if key >= KEY_1 and key <= KEY_3:
				_pick(key - KEY_1)
		Game.State.ENDED:
			if key == KEY_R or key == KEY_ENTER or key == KEY_KP_ENTER:
				game.restart()


## Lays the HUD out landscape. On a turned screen that means sizing it to the screen's swapped
## dimensions and turning the whole layer a quarter turn, top edge along the screen's right.
func fit_screen(turned: bool) -> void:
	var view := get_viewport().get_visible_rect().size
	if turned:
		_root.set_anchors_preset(Control.PRESET_TOP_LEFT)
		_root.position = Vector2.ZERO
		_root.size = Vector2(view.y, view.x)
		transform = Transform2D(PI / 2.0, Vector2(view.x, 0.0))
	else:
		transform = Transform2D.IDENTITY
		_root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)


# --- Touch joystick ------------------------------------------------------------------------

## Pressing anywhere starts a joystick there; dragging steers. The first finger wins, so a
## second tap (say, on the pause button) doesn't yank the stick.
func _on_touch(touch: InputEventScreenTouch) -> void:
	if touch.pressed:
		if game.state == Game.State.PLAYING and _touch_index == -1:
			_touch_index = touch.index
			_joystick.begin(_to_layout(touch.position))
	elif touch.index == _touch_index:
		_release_touch()


## Screen position to HUD layout position; they differ while the layer is turned.
func _to_layout(screen_position: Vector2) -> Vector2:
	return _root.get_global_transform_with_canvas().affine_inverse() * screen_position


func _release_touch() -> void:
	_touch_index = -1
	_joystick.end()
	game.player.touch_direction = Vector2.ZERO


class Joystick extends Control:
	const RADIUS := 34.0
	const KNOB_RADIUS := 13.0
	const DEAD_ZONE := 0.15

	var origin := Vector2.ZERO
	var knob := Vector2.ZERO
	var active := false

	func begin(at: Vector2) -> void:
		origin = at
		knob = at
		active = true
		queue_redraw()

	func drag(at: Vector2) -> void:
		knob = origin + (at - origin).limit_length(RADIUS)
		queue_redraw()

	func end() -> void:
		active = false
		queue_redraw()

	func direction() -> Vector2:
		var offset := (knob - origin) / RADIUS
		return offset if offset.length() > DEAD_ZONE else Vector2.ZERO

	func _draw() -> void:
		if not active:
			return
		draw_circle(origin, RADIUS, Color(1, 1, 1, 0.25))
		draw_arc(origin, RADIUS, 0.0, TAU, 48, Color(Art.INK, 0.5), 2.0, true)
		draw_circle(knob, KNOB_RADIUS, Color(1, 1, 1, 0.9))
		draw_arc(knob, KNOB_RADIUS, 0.0, TAU, 32, Art.INK, 2.0, true)


# --- Top bar -------------------------------------------------------------------------------

func _build_top_bar() -> void:
	_top_bar = Control.new()
	_top_bar.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_top_bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(_top_bar)

	_xp_bar = ProgressBar.new()
	_xp_bar.max_value = 1.0
	_xp_bar.show_percentage = false
	_xp_bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_xp_bar.anchor_right = 1.0
	_xp_bar.offset_left = 6
	_xp_bar.offset_right = -6
	_xp_bar.offset_top = 5
	_xp_bar.offset_bottom = 17
	_top_bar.add_child(_xp_bar)
	_level_label = _label("Lv 1", 10, true)
	_level_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_level_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_level_label.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_level_label.offset_right = -6
	_xp_bar.add_child(_level_label)

	var slots := VBoxContainer.new()
	slots.position = Vector2(6, 22)
	slots.add_theme_constant_override("separation", 3)
	slots.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_top_bar.add_child(slots)
	for slot_list in [_weapon_slots, _passive_slots]:
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 2)
		row.mouse_filter = Control.MOUSE_FILTER_IGNORE
		slots.add_child(row)
		for i in SLOT_COUNT:
			var slot := _slot()
			row.add_child(slot)
			slot_list.append(slot)

	_time_label = _label("00:00", 20)
	_time_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_time_label.anchor_left = 0.5
	_time_label.anchor_right = 0.5
	_time_label.offset_left = -40
	_time_label.offset_right = 40
	_time_label.offset_top = 19
	_top_bar.add_child(_time_label)

	var right := HBoxContainer.new()
	right.alignment = BoxContainer.ALIGNMENT_END
	right.add_theme_constant_override("separation", 4)
	right.anchor_left = 1.0
	right.anchor_right = 1.0
	right.offset_left = -130
	right.offset_right = -6
	right.offset_top = 22
	right.offset_bottom = 46
	right.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_top_bar.add_child(right)
	right.add_child(_icon("skull", 14))
	_kills_label = _label("0", 13)
	right.add_child(_kills_label)
	var spacer := Control.new()
	spacer.custom_minimum_size = Vector2(4, 0)
	right.add_child(spacer)
	# Re-zeroes tilt steering mid-run, without pausing (resuming re-zeroes it anyway).
	_recalibrate_button = Button.new()
	_recalibrate_button.icon = Art.texture("phone_tilt")
	_recalibrate_button.expand_icon = true
	_recalibrate_button.custom_minimum_size = Vector2(24, 24)
	_recalibrate_button.focus_mode = Control.FOCUS_NONE
	_recalibrate_button.theme_type_variation = "IconButton"
	_recalibrate_button.pressed.connect(_recalibrate_tilt)
	right.add_child(_recalibrate_button)
	_pause_button = Button.new()
	_pause_button.icon = Art.texture("pause")
	_pause_button.expand_icon = true
	_pause_button.custom_minimum_size = Vector2(24, 24)
	_pause_button.focus_mode = Control.FOCUS_NONE
	_pause_button.theme_type_variation = "IconButton"
	_pause_button.pressed.connect(game.set_paused.bind(true))
	right.add_child(_pause_button)


func _recalibrate_tilt() -> void:
	Tilt.calibrate()
	_show_toast("已按现在的角度重新校准")


func _slot() -> Panel:
	var slot := Panel.new()
	slot.custom_minimum_size = Vector2(SLOT_SIZE, SLOT_SIZE)
	slot.mouse_filter = Control.MOUSE_FILTER_IGNORE
	slot.add_theme_stylebox_override("panel", _box(Color(Art.PAPER, 0.35), Color(Art.INK, 0.5), 2, 5))
	return slot


func _refresh_inventory() -> void:
	var weapons := game.player.weapons
	for i in SLOT_COUNT:
		var weapon: Weapon = weapons[i] if i < weapons.size() else null
		_fill_slot(_weapon_slots[i], weapon.art if weapon else "", weapon.level if weapon else 0)
	var passive_ids := game.upgrades.passive_levels.keys()
	for i in SLOT_COUNT:
		var passive_id: String = passive_ids[i] if i < passive_ids.size() else ""
		var art: String = Upgrades.PASSIVES[passive_id]["art"] if passive_id != "" else ""
		_fill_slot(_passive_slots[i], art, game.upgrades.passive_levels.get(passive_id, 0))


func _fill_slot(slot: Panel, art: String, item_level: int) -> void:
	for child in slot.get_children():
		child.queue_free()
	var filled := art != ""
	slot.add_theme_stylebox_override("panel", _box(Color(Art.PAPER, 0.92 if filled else 0.35), Color(Art.INK, 1.0 if filled else 0.5), 2, 5))
	if not filled:
		return
	var icon := _icon(art, SLOT_SIZE - 4)
	icon.position = Vector2(2, 2)
	slot.add_child(icon)
	var badge := _label(str(item_level), 8)
	badge.position = Vector2(SLOT_SIZE - 6, SLOT_SIZE - 11)
	slot.add_child(badge)


func _build_toast() -> void:
	_toast = PanelContainer.new()
	_toast.add_theme_stylebox_override("panel", _box(Art.PAPER, Art.INK, 2, 12, Vector4(12, 4, 12, 4)))
	_toast.anchor_left = 0.5
	_toast.anchor_right = 0.5
	_toast.offset_top = 70
	_toast.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_toast.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_toast.modulate.a = 0.0
	_toast.resized.connect(func() -> void: _toast.pivot_offset = _toast.size / 2.0)
	_toast_label = _label("", 13, true)
	_toast.add_child(_toast_label)
	_root.add_child(_toast)


func _show_toast(text: String) -> void:
	_toast_label.text = text
	# Back to a zero-width anchor point, so the box regrows around the centre for the new text.
	_toast.offset_left = 0
	_toast.offset_right = 0
	_toast.modulate.a = 1.0
	_toast.scale = Vector2.ONE * 0.8
	if _toast_tween != null:
		_toast_tween.kill()
	_toast_tween = create_tween()
	_toast_tween.tween_property(_toast, "scale", Vector2.ONE, 0.15).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_toast_tween.tween_interval(1.8)
	_toast_tween.tween_property(_toast, "modulate:a", 0.0, 0.5)


## Red edges that pulse in as HP runs low.
func _build_vignette() -> void:
	var gradient := Gradient.new()
	gradient.offsets = PackedFloat32Array([0.0, 0.6, 1.0])
	gradient.colors = PackedColorArray([Color(Art.RED, 0.0), Color(Art.RED, 0.0), Color(Art.RED, 0.75)])
	var texture := GradientTexture2D.new()
	texture.gradient = gradient
	texture.fill = GradientTexture2D.FILL_RADIAL
	texture.fill_from = Vector2(0.5, 0.5)
	texture.fill_to = Vector2(1.0, 1.0)
	_vignette = TextureRect.new()
	_vignette.texture = texture
	_vignette.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_vignette.stretch_mode = TextureRect.STRETCH_SCALE
	_vignette.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_vignette.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_vignette.modulate.a = 0.0
	_root.add_child(_vignette)


# --- Title ---------------------------------------------------------------------------------

func _build_title() -> Control:
	var overlay := _overlay(Color(Art.LAWN, 0.7))
	var column := VBoxContainer.new()
	column.alignment = BoxContainer.ALIGNMENT_CENTER
	column.add_theme_constant_override("separation", 10)
	_centered(overlay).add_child(column)

	var title := _label("硅谷幸存者", 40)
	title.add_theme_constant_override("outline_size", 12)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	title.custom_minimum_size = Vector2(TITLE_TEXT_WIDTH, 0)
	column.add_child(title)

	var parade := HBoxContainer.new()
	parade.alignment = BoxContainer.ALIGNMENT_CENTER
	parade.add_theme_constant_override("separation", 6)
	column.add_child(parade)
	for i in PARADE.size():
		var holder := Control.new()
		holder.custom_minimum_size = Vector2(26, 30)
		parade.add_child(holder)
		var icon := _icon(PARADE[i], 26)
		holder.add_child(icon)
		# Each one hops on its own beat, so the row ripples.
		var hop := icon.create_tween().set_loops()
		hop.tween_interval(i * 0.08)
		hop.tween_property(icon, "position:y", -5.0, 0.22).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
		hop.tween_property(icon, "position:y", 0.0, 0.22).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
		hop.tween_interval((PARADE.size() - i) * 0.08 + 0.3)

	var pitch := _label("躲开 Bug、会议和 Deadline，撑过 10 分钟就能敲钟上市！", 13)
	pitch.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	pitch.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	pitch.custom_minimum_size = Vector2(TITLE_TEXT_WIDTH, 0)
	column.add_child(pitch)

	var buttons := HBoxContainer.new()
	buttons.alignment = BoxContainer.ALIGNMENT_CENTER
	buttons.add_theme_constant_override("separation", 10)
	column.add_child(buttons)
	var start := Button.new()
	start.text = "开始搬砖"
	start.custom_minimum_size = Vector2(150, 40)
	start.add_theme_font_size_override("font_size", 18)
	start.pressed.connect(game.start_run)
	buttons.add_child(start)
	buttons.add_child(_settings_button())
	start.call_deferred("grab_focus")

	var controls := _label("电脑：WASD / 方向键移动　手机：按住屏幕拖动", 10)
	controls.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	controls.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	controls.custom_minimum_size = Vector2(TITLE_TEXT_WIDTH, 0)
	column.add_child(controls)

	return overlay


# --- Level-up ------------------------------------------------------------------------------

func _show_level_up(choices: Array) -> void:
	_clear(_cards_holder)
	var portrait := _is_portrait()
	var column := VBoxContainer.new()
	column.alignment = BoxContainer.ALIGNMENT_CENTER
	column.add_theme_constant_override("separation", 10)
	_cards_holder.add_child(column)

	var heading := _label(tr("升级啦！ Lv %d") % game.level, 24)
	heading.add_theme_color_override("font_color", Art.YELLOW)
	heading.add_theme_constant_override("outline_size", 8)
	heading.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(heading)

	var cards := _stack(portrait)
	cards.alignment = BoxContainer.ALIGNMENT_CENTER
	cards.add_theme_constant_override("separation", 8 if portrait else 10)
	column.add_child(cards)
	for i in choices.size():
		var card := _make_card(choices[i], i, portrait)
		cards.add_child(card)
		_pop_in(card, i * 0.06)

	var hint := _label("按 1 / 2 / 3 或点卡片选择", 10)
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(hint)

	_level_up_overlay.visible = true
	_accept_picks_at = Time.get_ticks_msec() + PICK_DELAY_MS
	(cards.get_child(0) as Button).grab_focus()


## A level-up choice: a tall card side by side in landscape, a wide row (`compact`) stacked in
## portrait.
func _make_card(choice: Dictionary, index: int, compact: bool) -> Button:
	var kind: String = choice["kind"]
	var accent: Color = KIND_COLORS[kind]
	var card := Button.new()
	card.custom_minimum_size = Vector2(300, 74) if compact else Vector2(150, 180)
	card.add_theme_stylebox_override("normal", _box(Art.PAPER, accent, 3, 12, Vector4.ZERO, true))
	card.add_theme_stylebox_override("hover", _box(Color.WHITE, Art.INK, 3, 12, Vector4.ZERO, true))
	card.add_theme_stylebox_override("pressed", _box(Color("fff3cf"), Art.INK, 3, 12, Vector4.ZERO, true))
	card.add_theme_stylebox_override("focus", _box(Color.TRANSPARENT, Art.INK, 3, 12, Vector4.ZERO, false, false))
	card.pressed.connect(_pick.bind(index))
	card.mouse_entered.connect(_hover.bind(card, true))
	card.mouse_exited.connect(_hover.bind(card, false))
	card.resized.connect(func() -> void: card.pivot_offset = card.size / 2.0)

	var margin := MarginContainer.new()
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	for side in ["left", "right", "top", "bottom"]:
		margin.add_theme_constant_override("margin_" + side, 8)
	margin.mouse_filter = Control.MOUSE_FILTER_IGNORE
	card.add_child(margin)

	var tag := _tag("新！", Art.RED) if choice["level"] == 1 else null
	var bubble := _icon_bubble(choice["art"], 40.0 if compact else 52.0, accent)
	var name_label := _label(choice["name"], 15, true)
	var description := _label(choice["text"], 11, true)
	description.modulate = Color(1, 1, 1, 0.85)
	description.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART

	if compact:
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 8)
		row.mouse_filter = Control.MOUSE_FILTER_IGNORE
		margin.add_child(row)
		row.add_child(_key_badge(index))
		row.add_child(bubble)
		var text_column := VBoxContainer.new()
		text_column.alignment = BoxContainer.ALIGNMENT_CENTER
		text_column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		text_column.mouse_filter = Control.MOUSE_FILTER_IGNORE
		row.add_child(text_column)
		var name_row := HBoxContainer.new()
		name_row.add_theme_constant_override("separation", 6)
		name_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
		text_column.add_child(name_row)
		name_row.add_child(name_label)
		if kind != "heal":
			name_row.add_child(_level_dots(choice["level"], accent))
		if tag != null:
			name_row.add_child(tag)
		text_column.add_child(description)
		return card

	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 5)
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	margin.add_child(column)
	var top := HBoxContainer.new()
	top.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(top)
	top.add_child(_key_badge(index))
	var filler := Control.new()
	filler.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	filler.mouse_filter = Control.MOUSE_FILTER_IGNORE
	top.add_child(filler)
	if tag != null:
		top.add_child(tag)
	var bubble_row := CenterContainer.new()
	bubble_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bubble_row.add_child(bubble)
	column.add_child(bubble_row)
	name_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(name_label)
	if kind != "heal":
		var dots_row := CenterContainer.new()
		dots_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
		dots_row.add_child(_level_dots(choice["level"], accent))
		column.add_child(dots_row)
	description.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(description)
	return card


func _pick(index: int) -> void:
	if game.state != Game.State.LEVEL_UP or Time.get_ticks_msec() < _accept_picks_at:
		return
	game.choose_upgrade(index)


func _hover(card: Control, entered: bool) -> void:
	var tween := card.create_tween()
	tween.tween_property(card, "scale", Vector2.ONE * (1.04 if entered else 1.0), 0.1)


func _key_badge(index: int) -> Control:
	var badge := PanelContainer.new()
	badge.add_theme_stylebox_override("panel", _box(Art.INK, Art.INK, 0, 9, Vector4(5, 0, 5, 0)))
	badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
	badge.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	var number := _label(str(index + 1), 10)
	number.add_theme_constant_override("outline_size", 0)
	badge.add_child(number)
	return badge


## A small coloured pill: 新！ on fresh upgrades, 推荐 on the title's tilt switch.
func _tag(text_key: String, color: Color) -> Control:
	var tag := PanelContainer.new()
	tag.add_theme_stylebox_override("panel", _box(color, Art.INK, 2, 8, Vector4(5, 0, 5, 0)))
	tag.mouse_filter = Control.MOUSE_FILTER_IGNORE
	tag.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var text := _label(text_key, 10)
	text.add_theme_constant_override("outline_size", 0)
	tag.add_child(text)
	return tag


## The upgrade's icon on a soft disc of its accent colour.
func _icon_bubble(art: String, size: float, accent: Color) -> Control:
	var disc := Panel.new()
	disc.custom_minimum_size = Vector2(size, size)
	disc.add_theme_stylebox_override("panel", _box(Color(accent, 0.2), Color.TRANSPARENT, 0, int(size / 2.0)))
	disc.mouse_filter = Control.MOUSE_FILTER_IGNORE
	# Stay round inside a row instead of stretching to the row's height.
	disc.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var icon := _icon(art, size * 0.74)
	icon.position = Vector2.ONE * size * 0.13
	disc.add_child(icon)
	return disc


## Five pips: filled up to `filled`, the rest hollow.
func _level_dots(filled: int, accent: Color) -> Control:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 3)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	for i in Upgrades.MAX_LEVEL:
		var dot := Panel.new()
		dot.custom_minimum_size = Vector2(8, 8)
		dot.add_theme_stylebox_override("panel", _box(accent if i < filled else Color.WHITE, Art.INK, 1, 4))
		dot.mouse_filter = Control.MOUSE_FILTER_IGNORE
		row.add_child(dot)
	return row


# --- Pause ---------------------------------------------------------------------------------

func _show_pause() -> void:
	_clear(_pause_holder)
	var portrait := _is_portrait()
	var panel := _panel()
	_pause_holder.add_child(panel)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 10)
	panel.add_child(column)

	var heading := _label("休息一下", 22, true)
	heading.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(heading)

	var build := _stack(portrait)
	build.add_theme_constant_override("separation", 10 if portrait else 18)
	column.add_child(build)
	var weapon_rows: Array = []
	for weapon in game.player.weapons:
		var entry: Dictionary = Upgrades.WEAPONS[weapon.id]
		weapon_rows.append([entry["art"], entry["name"], weapon.level])
	build.add_child(_build_list("武器", weapon_rows, Art.BLUE))
	var passive_rows: Array = []
	for passive_id: String in game.upgrades.passive_levels:
		var entry: Dictionary = Upgrades.PASSIVES[passive_id]
		passive_rows.append([entry["art"], entry["name"], game.upgrades.passive_levels[passive_id]])
	build.add_child(_build_list("能力", passive_rows, Art.GREEN))

	var player := game.player
	var stats := GridContainer.new()
	stats.columns = 2 if portrait else 3
	stats.add_theme_constant_override("h_separation", 16)
	stats.add_theme_constant_override("v_separation", 2)
	column.add_child(stats)
	for text in [
		tr("生命 %d / %d") % [ceili(player.hp), roundi(player.max_hp)],
		tr("伤害 +%d%%") % roundi((player.might - 1.0) * 100.0),
		tr("冷却 -%d%%") % roundi((1.0 - player.cooldown_scale) * 100.0),
		tr("移速 +%d%%") % roundi((player.move_speed / Player.BASE_MOVE_SPEED - 1.0) * 100.0),
		tr("拾取 +%d%%") % roundi((player.pickup_radius / Player.BASE_PICKUP_RADIUS - 1.0) * 100.0),
		tr("护甲 %d　回血 %.1f/秒") % [roundi(player.armor), player.regen],
	]:
		stats.add_child(_label(text, 11, true))

	if Tilt.enabled():
		var recalibrate := _label("继续时会按那时拿手机的角度重新校准", 10, true)
		recalibrate.modulate = Color(1, 1, 1, 0.6)
		recalibrate.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		column.add_child(recalibrate)

	# Three buttons side by side don't fit the 360-wide portrait view; stack them there.
	var buttons := _stack(portrait)
	buttons.alignment = BoxContainer.ALIGNMENT_CENTER
	buttons.add_theme_constant_override("separation", 8 if portrait else 10)
	column.add_child(buttons)
	var resume := _button("继续（Esc）", game.set_paused.bind(false))
	buttons.add_child(resume)
	buttons.add_child(_button("重新开始（R）", game.restart))
	buttons.add_child(_settings_button())
	if portrait:
		for button: Button in buttons.get_children():
			button.custom_minimum_size.x = 200
			button.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	resume.grab_focus()
	_pop_in(panel, 0.0)


func _build_list(title: String, rows: Array, accent: Color) -> Control:
	var list := VBoxContainer.new()
	list.add_theme_constant_override("separation", 3)
	list.custom_minimum_size = Vector2(170, 0)
	var header := _label(title, 12, true)
	header.modulate = Color(1, 1, 1, 0.6)
	list.add_child(header)
	if rows.is_empty():
		var none := _label("还没有", 11, true)
		none.modulate = Color(1, 1, 1, 0.5)
		list.add_child(none)
	for row_data: Array in rows:
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 6)
		row.add_child(_icon(row_data[0], 18))
		var name_label := _label(row_data[1], 12, true)
		name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(name_label)
		row.add_child(_level_dots(row_data[2], accent))
		list.add_child(row)
	return list


# --- End -----------------------------------------------------------------------------------

func _show_end(victory: bool) -> void:
	_clear(_end_holder)
	var panel := _panel()
	_end_holder.add_child(panel)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 8)
	panel.add_child(column)

	var title := _label("敲钟上市！" if victory else "项目黄了…", 30)
	title.add_theme_color_override("font_color", Art.YELLOW if victory else Art.RED)
	title.add_theme_constant_override("outline_size", 10)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(title)
	var subtitle := _label("撑过了 10 分钟，公司成功 IPO" if victory else "公司没撑住……再融一轮？", 12, true)
	subtitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(subtitle)

	var stats := HBoxContainer.new()
	stats.alignment = BoxContainer.ALIGNMENT_CENTER
	stats.add_theme_constant_override("separation", 8)
	column.add_child(stats)
	for stat: Array in [["存活", _clock_text(game.elapsed)], ["等级", str(game.level)], ["击杀", str(game.kills)]]:
		stats.add_child(_stat_chip(stat[0], stat[1]))

	var ranking := _damage_ranking()
	if ranking.get_child_count() > 1:
		column.add_child(ranking)

	var again := _button("再来一局（R）", game.restart)
	again.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	column.add_child(again)
	again.grab_focus()
	_pop_in(panel, 0.0)


func _stat_chip(caption: String, value: String) -> Control:
	var chip := PanelContainer.new()
	chip.add_theme_stylebox_override("panel", _box(Color.WHITE, Art.INK, 2, 10, Vector4(12, 4, 12, 4)))
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 0)
	chip.add_child(column)
	var caption_label := _label(caption, 10, true)
	caption_label.modulate = Color(1, 1, 1, 0.6)
	caption_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(caption_label)
	var value_label := _label(value, 18, true)
	value_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(value_label)
	return chip


## Weapons ranked by the damage they dealt this run, with bars relative to the best.
func _damage_ranking() -> Control:
	var list := VBoxContainer.new()
	list.add_theme_constant_override("separation", 3)
	var header := _label("伤害排行", 12, true)
	header.modulate = Color(1, 1, 1, 0.6)
	list.add_child(header)
	var entries: Array = []
	for source: String in game.damage_by_source:
		if Upgrades.WEAPONS.has(source):
			entries.append([source, game.damage_by_source[source]])
	entries.sort_custom(func(a: Array, b: Array) -> bool: return a[1] > b[1])
	var best: float = entries[0][1] if not entries.is_empty() else 1.0
	for entry: Array in entries:
		var weapon: Dictionary = Upgrades.WEAPONS[entry[0]]
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 6)
		row.add_child(_icon(weapon["art"], 18))
		var name_label := _label(weapon["name"], 11, true)
		name_label.custom_minimum_size = Vector2(66, 0)
		row.add_child(name_label)
		var track := Panel.new()
		track.custom_minimum_size = Vector2(120, 10)
		track.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		track.add_theme_stylebox_override("panel", _box(Color.WHITE, Art.INK, 2, 5))
		var fill := Panel.new()
		fill.add_theme_stylebox_override("panel", _box(Art.BLUE, Color.TRANSPARENT, 0, 4))
		fill.position = Vector2(2, 2)
		fill.size = Vector2(maxf(116.0 * entry[1] / best, 6.0), 6)
		track.add_child(fill)
		row.add_child(track)
		row.add_child(_label(Lang.short_number(entry[1]), 11, true))
		list.add_child(row)
	return list


# --- Settings ------------------------------------------------------------------------------

func _settings_button() -> Button:
	var button := _button("设置", _open_settings)
	button.icon = Art.texture("gear")
	# The SVG imports at 4x; cap it to text height instead of drawing it at texture size.
	button.add_theme_constant_override("icon_max_width", 18)
	button.custom_minimum_size = Vector2(96, 32)
	return button


func _open_settings() -> void:
	_settings_open = true
	_clear(_settings_holder)
	var panel := _panel()
	_settings_holder.add_child(panel)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 12)
	column.custom_minimum_size = Vector2(260, 0)
	panel.add_child(column)

	var heading := _label("设置", 22, true)
	heading.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(heading)

	var current := Lang.current()
	var language_choice := _choice_row("语言", [["中文", current == "zh"], ["English", current == "en"]], _on_language_picked)
	column.add_child(language_choice)

	if Device.is_handheld():
		var landscape := Device.prefers_landscape()
		column.add_child(_choice_row("屏幕方向", [["竖屏", not landscape], ["横屏", landscape]], _on_orientation_picked))

	_tilt_hint = null
	if Tilt.available():
		var tilt_on := Tilt.enabled()
		column.add_child(_choice_row("陀螺仪移动", [["开", tilt_on], ["关", not tilt_on]], _on_tilt_picked))
		_tilt_hint = _label("", 10, true)
		_tilt_hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		_tilt_hint.custom_minimum_size = Vector2(260, 0)
		_tilt_hint.modulate = Color(1, 1, 1, 0.7)
		column.add_child(_tilt_hint)

	var back := _button("返回", _close_settings)
	back.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	column.add_child(back)
	(language_choice.get_child(1) as Button).grab_focus()
	_pop_in(panel, 0.0)


func _close_settings() -> void:
	_settings_open = false
	if game.state == Game.State.PAUSED:
		_show_pause()


## A caption followed by a set of choice buttons (see _choice_buttons).
func _choice_row(caption: String, options: Array, on_pick: Callable) -> Control:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 6)
	var caption_label := _label(caption, 13, true)
	caption_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(caption_label)
	for option in _choice_buttons(options, on_pick, Vector2(72, 30)):
		row.add_child(option)
	return row


## Mutually exclusive toggle buttons; `options` is [[text, selected]]. Calls `on_pick` with the
## chosen index.
func _choice_buttons(options: Array, on_pick: Callable, button_size: Vector2) -> Array[Button]:
	var group := ButtonGroup.new()
	var buttons: Array[Button] = []
	for i in options.size():
		var option := Button.new()
		option.text = options[i][0]
		option.toggle_mode = true
		option.button_group = group
		option.button_pressed = options[i][1]
		option.theme_type_variation = "ChoiceButton"
		option.custom_minimum_size = button_size
		option.pressed.connect(on_pick.bind(i))
		buttons.append(option)
	return buttons


func _on_language_picked(index: int) -> void:
	Lang.choose(Lang.LANGUAGES[index])


func _on_tilt_picked(index: int) -> void:
	Tilt.set_enabled(index == 0)


func _on_orientation_picked(index: int) -> void:
	Settings.set_value("orientation", "portrait" if index == 0 else "landscape")
	game.apply_orientation()
	# The panels were laid out for the old shape; build them again once the HUD has refitted.
	_reopen_settings.call_deferred()


func _reopen_settings() -> void:
	if game.state == Game.State.PAUSED:
		_show_pause()
	_open_settings()


# --- Helpers -------------------------------------------------------------------------------

## Whether the HUD is laid out tall: an upright phone in portrait. Measured on the layout root
## rather than the viewport, which is also tall while a landscape game is drawn turned.
func _is_portrait() -> bool:
	return _root.size.y > _root.size.x


## Stacks top to bottom in portrait, side by side in landscape.
func _stack(vertical: bool) -> BoxContainer:
	if vertical:
		return VBoxContainer.new()
	return HBoxContainer.new()


func _overlay(color: Color) -> Control:
	var overlay := ColorRect.new()
	overlay.color = color
	overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	overlay.visible = false
	_root.add_child(overlay)
	return overlay


func _centered(parent: Control) -> CenterContainer:
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	center.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(center)
	return center


func _panel() -> PanelContainer:
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", _box(Art.PAPER, Art.INK, 3, 14, Vector4(16, 12, 16, 14), true))
	panel.resized.connect(func() -> void: panel.pivot_offset = panel.size / 2.0)
	return panel


func _clear(holder: Node) -> void:
	for child in holder.get_children():
		holder.remove_child(child)
		child.queue_free()


func _pop_in(node: Control, delay: float) -> void:
	node.modulate.a = 0.0
	node.scale = Vector2.ONE * 0.85
	var tween := node.create_tween().set_parallel()
	tween.tween_property(node, "modulate:a", 1.0, 0.12).set_delay(delay)
	tween.tween_property(node, "scale", Vector2.ONE, 0.22).set_delay(delay) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)


func _button(text: String, action: Callable) -> Button:
	var button := Button.new()
	button.text = text
	button.custom_minimum_size = Vector2(110, 32)
	button.pressed.connect(action)
	return button


## Text in the HUD style: white with an ink outline over the world, or plain ink (`on_paper`)
## inside panels.
func _label(text: String, font_size: int, on_paper: bool = false) -> Label:
	var label := Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", font_size)
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if on_paper:
		label.theme_type_variation = "PaperLabel"
	return label


func _icon(art: String, size: float) -> TextureRect:
	var icon := TextureRect.new()
	icon.texture = Art.texture(art)
	icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	icon.custom_minimum_size = Vector2(size, size)
	icon.size = Vector2(size, size)
	icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return icon


func _clock_text(seconds_elapsed: float) -> String:
	var seconds := floori(seconds_elapsed)
	return "%02d:%02d" % [floori(seconds / 60.0), seconds % 60]


## A rounded box in the drawings' style. `padding` is left, top, right, bottom.
func _box(background: Color, border: Color, border_width: int, radius: int, padding: Vector4 = Vector4.ZERO, shadow: bool = false, draw_center: bool = true) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = background
	style.draw_center = draw_center
	style.border_color = border
	style.set_border_width_all(border_width)
	style.set_corner_radius_all(radius)
	style.anti_aliasing = true
	style.content_margin_left = padding.x
	style.content_margin_top = padding.y
	style.content_margin_right = padding.z
	style.content_margin_bottom = padding.w
	if shadow:
		style.shadow_color = Color(Art.INK, 0.3)
		style.shadow_offset = Vector2(0, 4)
	return style


func _build_theme() -> Theme:
	var theme := Theme.new()
	theme.default_font = Art.font()
	theme.default_font_size = 12
	theme.set_color("font_color", "Label", Color.WHITE)
	theme.set_color("font_outline_color", "Label", Art.INK)
	theme.set_constant("outline_size", "Label", 5)
	theme.set_type_variation("PaperLabel", "Label")
	theme.set_color("font_color", "PaperLabel", Art.INK)
	theme.set_constant("outline_size", "PaperLabel", 0)

	theme.set_stylebox("normal", "Button", _box(Art.YELLOW, Art.INK, 3, 10, Vector4(12, 4, 12, 4), true))
	theme.set_stylebox("hover", "Button", _box(Color("ffe08f"), Art.INK, 3, 10, Vector4(12, 4, 12, 4), true))
	theme.set_stylebox("pressed", "Button", _box(Color("f2bd3a"), Art.INK, 3, 10, Vector4(12, 4, 12, 4)))
	theme.set_stylebox("focus", "Button", _box(Color.TRANSPARENT, Art.BLUE, 3, 13, Vector4.ZERO, false, false))
	for color_name in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color", "font_hover_pressed_color"]:
		theme.set_color(color_name, "Button", Art.INK)
	theme.set_font_size("font_size", "Button", 14)

	# Settings options: paper when off, yellow when chosen.
	theme.set_type_variation("ChoiceButton", "Button")
	theme.set_stylebox("normal", "ChoiceButton", _box(Art.PAPER, Art.INK, 2, 10, Vector4(8, 2, 8, 2)))
	theme.set_stylebox("hover", "ChoiceButton", _box(Color.WHITE, Art.INK, 2, 10, Vector4(8, 2, 8, 2)))
	theme.set_stylebox("pressed", "ChoiceButton", _box(Art.YELLOW, Art.INK, 2, 10, Vector4(8, 2, 8, 2)))
	theme.set_stylebox("hover_pressed", "ChoiceButton", _box(Color("ffe08f"), Art.INK, 2, 10, Vector4(8, 2, 8, 2)))

	theme.set_type_variation("IconButton", "Button")
	theme.set_stylebox("normal", "IconButton", _box(Art.PAPER, Art.INK, 2, 8, Vector4(4, 4, 4, 4)))
	theme.set_stylebox("hover", "IconButton", _box(Color.WHITE, Art.INK, 2, 8, Vector4(4, 4, 4, 4)))
	theme.set_stylebox("pressed", "IconButton", _box(Color("fff3cf"), Art.INK, 2, 8, Vector4(4, 4, 4, 4)))

	theme.set_stylebox("background", "ProgressBar", _box(Color.WHITE, Art.INK, 2, 6))
	theme.set_stylebox("fill", "ProgressBar", _box(Art.BLUE, Art.INK, 2, 6))
	return theme
