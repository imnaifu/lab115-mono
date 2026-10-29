class_name Hud
extends CanvasLayer
## Screen-space UI, drawn after the design canvas 「硅谷幸存者 · 界面设计」: the HUD (upgrade slots,
## XP, clock, boss readouts, kills, minimap, joystick, hints) and the title, level-up, funding
## bag, pause, result and settings screens. Keeps running while the tree is paused so the
## screens can take input. The pieces come from UiKit.
## Screen visibility follows game.state every frame instead of being toggled by events, so a
## pick made from code (the smoke-test bot) closes the level-up screen too.
## Layout is anchored rather than placed, because the view is 640x360 or wider in landscape
## and 360x640 or taller on an upright phone in portrait; a phone set to landscape turns the
## whole layer a quarter turn instead (fit_screen, Game.apply_orientation). A screen is built
## when it opens, in the arrangement for the shape the HUD has then.

## Ignore picks for a moment after the cards appear, so keys held down while playing don't
## choose one by accident.
const PICK_DELAY_MS := 300
const SLOT_COUNT := 6
const SLOT_SIZE := 19.0
## The title screen's cast standing on a line: art, height, how high it hops from.
const TITLE_SIZE := 44
const LOW_HP_RATIO := 0.35
const XP_BAR_SIZE := Vector2(96, 18)
## The boss bar sits under the clock; on an upright phone it must clear the minimap.
const BOSS_BAR_WIDTH := 110.0
const BOSS_BAR_WIDTH_PORTRAIT := 80.0
## Level-up cards side by side when there are more than three of them (the headhunter perk).
const LEVEL_UP_CARD_MIN_WIDTH := 112.0
## The next-boss countdown under the clock shows this many seconds ahead.
const NEXT_BOSS_WARNING := 20.0
## A first few runs show how to move until the player does, after this long standing still.
const MOVE_HINT_AFTER := 2.0
const MOVE_HINT_RUNS := 3
## How a boss move is dodged, shown at the bottom the first time it comes up in a run.
const BOSS_MOVE_HINTS := {
	"charge": "红色通道要冲过来了，横着躲开",
	"summon": "它在召唤小怪，别被围住",
	"blink": "红圈是它要闪现到的地方，别站进去",
	"volley": "蓄力完会朝四周发弹，躲到楼后面",
	"lob": "地上的阴影是饼的落点，快离开",
	"quake": "红圈填满就会炸开，先退到圈外",
	"countdown": "头顶倒计时归零前没打死，它就暴走",
	"clones": "半透明的是幻觉分身，一碰就碎",
	"aura": "金圈里的小怪减伤一半，先打投资人",
}
const WARNING_SECONDS := 3.5
## The funding bag's slot machine: laps of all the rounds before landing, and how long it spins.
const CHEST_SPIN_LAPS := 4
const CHEST_SPIN_SECONDS := 1.6
## Space kept around a screen that has to shrink to fit.
const FIT_MARGIN := 8.0
## How far the funding bag sticks up over the top of its dialog.
const BAG_OVERHANG := 36.0
const RANKING_ROWS := 6
## How the last hit landed (Telemetry.last_hurt_how), for the result's 凶手 line.
const KILL_CAUSES := {"charge": "冲锋撞死", "bullet": "告警弹命中", "pie": "被饼砸中", "quake": "被宕机震飞"}
## Settings-screen hint for each Tilt.state().
const TILT_HINTS := {
	"asking": "请在弹窗里允许访问动作与方向",
	"retry": "再点一下屏幕来授权",
	"denied": "没有权限：请在浏览器设置里允许动作与方向",
	"unsupported": "这台设备不支持",
}

var game: Game

var _root: Control
var _top_bar: Control
var _xp_bar: ProgressBar
var _level_label: Label
var _time_label: Label
var _center_column: VBoxContainer
var _next_boss_pill: Control
var _next_boss_time: Label
var _boss_bar: Control
var _boss_name: Label
var _boss_more: Label
var _boss_progress: ProgressBar
var _kills_label: Label
var _minimap: Minimap
var _district_label: Label
var _district := ""
var _pause_button: Button
var _recalibrate_button: Button
var _weapon_slots: Array[Panel] = []
var _passive_slots: Array[Panel] = []
var _toast: PanelContainer
var _toast_label: Label
var _toast_tween: Tween
var _move_hint: Control
var _warning: Control
var _warning_label: Label
var _warning_tween: Tween
## Boss moves already explained this run.
var _warned := {}
var _vignette: TextureRect
var _joystick: Joystick
var _touch_index := -1
var _title_overlay: Control
var _title_holder: Control
var _title_heading: Control
var _level_up_overlay: Control
var _cards_holder: CenterContainer
var _chest_overlay: Control
var _chest_holder: CenterContainer
var _chest_spin: Tween
var _chest_revealed := false
## Shows the bag's result straight away (the button pressed mid-spin).
var _chest_reveal := Callable()
var _reel_prev: Label
var _reel_label: Label
var _reel_next: Label
var _odds_chips: Array[PanelContainer] = []
var _pause_overlay: Control
var _pause_holder: CenterContainer
var _end_overlay: Control
var _end_holder: Control
var _victory := false
var _sharing := false
var _settings_overlay: Control
var _settings_holder: Control
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
	_root.theme = UiKit.build_theme()
	add_child(_root)

	_build_vignette()
	_joystick = Joystick.new()
	_joystick.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_joystick.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(_joystick)
	_build_top_bar()
	_build_toast()
	_build_bottom_hints()
	_title_overlay = _overlay(Art.PAPER_SOFT)
	_title_holder = _full(_title_overlay)
	_add_corner_version(_title_overlay)
	# Dialogs that pause play darken the world; the result and settings are pages of their own.
	_level_up_overlay = _overlay(Art.SCRIM)
	_cards_holder = _centered(_level_up_overlay)
	_chest_overlay = _overlay(Art.SCRIM)
	_chest_holder = _centered(_chest_overlay)
	_pause_overlay = _overlay(Art.SCRIM)
	_pause_holder = _centered(_pause_overlay)
	_add_corner_version(_pause_overlay)
	_end_overlay = _overlay(Art.PAPER_SOFT)
	_end_holder = _full(_end_overlay)
	_add_corner_version(_end_overlay)
	# Last, so it opens on top of the title or pause screen it was opened from.
	_settings_overlay = _overlay(Art.PAPER_SOFT)
	_settings_holder = _full(_settings_overlay)
	_show_title()

	game.inventory_changed.connect(_refresh_inventory)
	game.level_up_offered.connect(_show_level_up)
	game.run_ended.connect(_show_end)
	game.announced.connect(_show_toast)
	game.chest_opened.connect(_show_chest)
	game.boss_move.connect(_on_boss_move)


func _notification(what: int) -> void:
	if what == NOTIFICATION_TRANSLATION_CHANGED:
		_fit_title()
		# The job card's lines are put together already translated, so they don't follow the
		# language on their own: the title is rebuilt instead.
		if game != null and game.state == Game.State.TITLE:
			_show_title.call_deferred()


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
	_update_next_boss()
	_update_boss_bar()
	# The announcements drop in under whatever the centre column shows right now.
	_toast.offset_top = _center_column.position.y + _center_column.size.y + 6.0
	var district := BayArea.district_of(Vector2i((game.player.position / City.BLOCK).floor()))
	if district != _district:
		_district = district
		_district_label.text = BayArea.DISTRICTS[district]["name"]

	var hp_ratio := game.player.hp / game.player.max_hp
	var danger := clampf((LOW_HP_RATIO - hp_ratio) / LOW_HP_RATIO, 0.0, 1.0)
	_vignette.modulate.a = danger * (0.75 + 0.25 * sin(_clock * 6.0)) if game.state == Game.State.PLAYING else 0.0
	# The music follows the screen: it steps back under a dialog, the heartbeat goes with the
	# vignette, and the last minute plays faster (dialogs included, so it doesn't slow and
	# speed up again around every level-up).
	var playing := game.state == Game.State.PLAYING
	var dialog := game.state in [Game.State.PAUSED, Game.State.LEVEL_UP, Game.State.CHEST]
	var last_minute := (playing or dialog) and game.elapsed >= Game.RUN_SECONDS - 60.0
	Sound.set_mix(dialog, danger if playing else 0.0, last_minute)

	var state := game.state
	_title_overlay.visible = state == Game.State.TITLE
	# Only during play: under a dialog it shows through the scrim, behind the dialog's title.
	_top_bar.visible = state == Game.State.PLAYING
	_pause_button.visible = state == Game.State.PLAYING
	_recalibrate_button.visible = state == Game.State.PLAYING and Tilt.enabled()
	_level_up_overlay.visible = state == Game.State.LEVEL_UP
	_pause_overlay.visible = state == Game.State.PAUSED
	_end_overlay.visible = state == Game.State.ENDED
	_chest_overlay.visible = state == Game.State.CHEST
	_warning.visible = _warning.visible and state == Game.State.PLAYING
	_move_hint.visible = state == Game.State.PLAYING and not game.has_moved and game.elapsed > MOVE_HINT_AFTER \
		and game.runs_before < MOVE_HINT_RUNS and not Tilt.enabled() and not _warning.visible
	if _move_hint.visible:
		_move_hint.modulate.a = 0.75 + 0.25 * sin(_clock * 5.0)
	if state != Game.State.TITLE and state != Game.State.PAUSED:
		_settings_open = false
	_settings_overlay.visible = _settings_open
	if _settings_open and _tilt_hint != null:
		# Why tilt steering can't work yet only matters while it's switched on.
		var tilt_state := Tilt.state()
		_tilt_hint.visible = Tilt.enabled() and TILT_HINTS.has(tilt_state)
		_tilt_hint.text = TILT_HINTS.get(tilt_state, "")
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
			if key >= KEY_1 and key <= KEY_9:
				_pick(key - KEY_1)
		Game.State.CHEST:
			if key == KEY_ENTER or key == KEY_KP_ENTER or key == KEY_SPACE:
				_on_chest_button()
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
	# The title has a portrait and a landscape arrangement.
	_show_title.call_deferred()


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
	const RADIUS := 48.0
	const KNOB_RADIUS := 20.0
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
		draw_circle(origin, RADIUS, Color(Art.PAPER, 0.35))
		draw_arc(origin, RADIUS - 1.0, 0.0, TAU, 48, Color(Art.INK, 0.25), 2.0, true)
		draw_circle(knob, KNOB_RADIUS, Color(Art.PAPER, 0.9))
		draw_arc(knob, KNOB_RADIUS - 1.0, 0.0, TAU, 32, Art.INK, 2.5, true)


# --- HUD -----------------------------------------------------------------------------------

func _build_top_bar() -> void:
	_top_bar = Control.new()
	_top_bar.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_top_bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(_top_bar)

	# Weapons over passives, top left.
	var slots := VBoxContainer.new()
	slots.position = Vector2(8, 8)
	slots.add_theme_constant_override("separation", 3)
	slots.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_top_bar.add_child(slots)
	for slot_list in [_weapon_slots, _passive_slots]:
		var grid := GridContainer.new()
		grid.columns = SLOT_COUNT
		grid.add_theme_constant_override("h_separation", 3)
		grid.add_theme_constant_override("v_separation", 3)
		grid.mouse_filter = Control.MOUSE_FILTER_IGNORE
		slots.add_child(grid)
		for i in SLOT_COUNT:
			var slot := Panel.new()
			slot.custom_minimum_size = Vector2(SLOT_SIZE, SLOT_SIZE)
			slot.mouse_filter = Control.MOUSE_FILTER_IGNORE
			grid.add_child(slot)
			slot_list.append(slot)
			_fill_slot(slot, "", 0, Art.PAPER)

	# XP, the clock and the boss readouts, top centre, stacked so a hidden one takes no room.
	_center_column = VBoxContainer.new()
	_center_column.anchor_left = 0.5
	_center_column.anchor_right = 0.5
	_center_column.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_center_column.offset_top = 8
	_center_column.add_theme_constant_override("separation", 2)
	_center_column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_top_bar.add_child(_center_column)

	_xp_bar = _progress(XP_BAR_SIZE, Art.PAPER, Art.BRAND)
	_xp_bar.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	# The outline goes over the fill, so the yellow never covers it.
	var outline := Panel.new()
	outline.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	outline.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var ring := UiKit.box(Color.TRANSPARENT, Art.INK, UiKit.OUTLINE, UiKit.PILL)
	ring.draw_center = false
	outline.add_theme_stylebox_override("panel", ring)
	_xp_bar.add_child(outline)
	_level_label = UiKit.label("Lv 1", 11, "display")
	_level_label.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_level_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_level_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_level_label.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
	_xp_bar.add_child(_level_label)
	_center_column.add_child(_xp_bar)

	# The clock in big digits with a white edge, no pill: it reads over any ground.
	_time_label = UiKit.label("00:00", 24, "display")
	_time_label.add_theme_constant_override("outline_size", 7)
	_time_label.add_theme_color_override("font_outline_color", Art.PAPER)
	_time_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_time_label.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
	_center_column.add_child(_time_label)

	# The next boss's countdown: a moment to get ready (Survivor.io shows one).
	_next_boss_pill = UiKit.panel(UiKit.box(Art.PAPER, Art.BOSS_RED, UiKit.OUTLINE, UiKit.PILL, Vector4(8, 1, 8, 2)))
	_next_boss_pill.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_next_boss_pill.visible = false
	var countdown := HBoxContainer.new()
	countdown.add_theme_constant_override("separation", 4)
	countdown.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_next_boss_pill.add_child(countdown)
	countdown.add_child(UiKit.label("下一个 boss", 10, "strong", Art.BOSS_RED))
	_next_boss_time = UiKit.label("", 10, "display", Art.BOSS_RED)
	countdown.add_child(_next_boss_time)
	_center_column.add_child(_next_boss_pill)

	# The boss out the longest: name, health, how many more are out.
	_boss_bar = UiKit.panel(UiKit.box(Art.PAPER, Art.INK, UiKit.OUTLINE, UiKit.PILL, Vector4(8, 3, 8, 3)))
	_boss_bar.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_boss_bar.visible = false
	var boss_row := HBoxContainer.new()
	boss_row.add_theme_constant_override("separation", 6)
	boss_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_boss_bar.add_child(boss_row)
	_boss_name = UiKit.label("", 11, "heavy", Art.BOSS_RED)
	boss_row.add_child(_boss_name)
	_boss_progress = _progress(Vector2(BOSS_BAR_WIDTH, 8), Art.PINK_LIGHT, Art.BOSS_RED)
	_boss_progress.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	boss_row.add_child(_boss_progress)
	_boss_more = UiKit.label("", 10, "display", Art.INK_MUTED)
	boss_row.add_child(_boss_more)
	_center_column.add_child(_boss_bar)

	# Kills and the buttons, the minimap under them, the district under that.
	var right := VBoxContainer.new()
	right.anchor_left = 1.0
	right.anchor_right = 1.0
	right.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	right.offset_right = -8
	right.offset_top = 6
	right.add_theme_constant_override("separation", 6)
	right.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_top_bar.add_child(right)
	var buttons := HBoxContainer.new()
	buttons.alignment = BoxContainer.ALIGNMENT_END
	buttons.add_theme_constant_override("separation", 6)
	buttons.size_flags_horizontal = Control.SIZE_SHRINK_END
	buttons.mouse_filter = Control.MOUSE_FILTER_IGNORE
	right.add_child(buttons)
	var kills := UiKit.panel(UiKit.box(Art.PAPER, Art.INK, UiKit.OUTLINE, UiKit.PILL, Vector4(8, 3, 9, 3)))
	kills.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var kills_row := HBoxContainer.new()
	kills_row.add_theme_constant_override("separation", 3)
	kills_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	kills.add_child(kills_row)
	kills_row.add_child(UiKit.icon("skull", 12))
	_kills_label = UiKit.label("0", 11, "display")
	kills_row.add_child(_kills_label)
	buttons.add_child(kills)
	# Re-zeroes tilt steering mid-run, without pausing (resuming re-zeroes it anyway).
	_recalibrate_button = UiKit.round_button("phone_tilt", _recalibrate_tilt)
	buttons.add_child(_recalibrate_button)
	_pause_button = UiKit.round_button("pause", game.set_paused.bind(true))
	buttons.add_child(_pause_button)
	_minimap = Minimap.new()
	_minimap.game = game
	_minimap.size_flags_horizontal = Control.SIZE_SHRINK_END
	right.add_child(_minimap)
	var district := UiKit.panel(UiKit.box(Art.PAPER, Color.TRANSPARENT, 0, UiKit.PILL, Vector4(8, 1, 8, 1)))
	district.size_flags_horizontal = Control.SIZE_SHRINK_END
	_district_label = UiKit.label("", 10, "strong")
	district.add_child(_district_label)
	right.add_child(district)


## A rounded bar: `track` behind, `fill` for the value.
func _progress(bar_size: Vector2, track: Color, fill: Color) -> ProgressBar:
	var bar := ProgressBar.new()
	bar.max_value = 1.0
	bar.show_percentage = false
	bar.custom_minimum_size = bar_size
	bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bar.add_theme_stylebox_override("background", UiKit.box(track, Color.TRANSPARENT, 0, UiKit.PILL))
	bar.add_theme_stylebox_override("fill", UiKit.box(fill, Color.TRANSPARENT, 0, UiKit.PILL))
	return bar


func _update_next_boss() -> void:
	var seconds_left := game.spawner.seconds_to_next_boss()
	_next_boss_pill.visible = seconds_left > 0.0 and seconds_left <= NEXT_BOSS_WARNING
	if _next_boss_pill.visible:
		_next_boss_time.text = "0:%02d" % ceili(seconds_left)


func _update_boss_bar() -> void:
	var boss: Enemy = null
	var others := 0
	# game.enemies is in spawn order, so the first boss found is the one out the longest.
	for enemy in game.enemies:
		if enemy.is_elite and not enemy.dead:
			if boss == null:
				boss = enemy
			else:
				others += 1
	_boss_bar.visible = boss != null
	if boss == null:
		return
	_boss_progress.custom_minimum_size.x = BOSS_BAR_WIDTH_PORTRAIT if _is_portrait() else BOSS_BAR_WIDTH
	_boss_name.text = Spawner.ENEMY_TYPES[boss.type_name]["name"]
	_boss_more.text = "+%d" % others if others > 0 else ""
	_boss_more.visible = others > 0
	_boss_progress.value = maxf(boss.hp, 0.0) / boss.max_hp


func _recalibrate_tilt() -> void:
	Tilt.calibrate()
	_show_toast("已按现在的角度重新校准")


func _refresh_inventory() -> void:
	var weapons := game.player.weapons
	for i in SLOT_COUNT:
		var weapon: Weapon = weapons[i] if i < weapons.size() else null
		_fill_slot(_weapon_slots[i], weapon.art if weapon else "", weapon.level if weapon else 0, Art.SKY_LIGHT, weapon != null and weapon.evolved)
	var passive_ids := game.upgrades.passive_levels.keys()
	for i in SLOT_COUNT:
		var passive_id: String = passive_ids[i] if i < passive_ids.size() else ""
		var art: String = Upgrades.PASSIVES[passive_id]["art"] if passive_id != "" else ""
		_fill_slot(_passive_slots[i], art, game.upgrades.passive_levels.get(passive_id, 0), Art.MINT_LIGHT)


## A slot: the item's icon on its tint with the level on a small ink badge (a star once evolved,
## on yellow); empty, a faint square.
func _fill_slot(slot: Panel, art: String, item_level: int, fill: Color, evolved: bool = false) -> void:
	for child in slot.get_children():
		child.queue_free()
	var filled := art != ""
	if evolved:
		fill = Art.BRAND_SOFT
	slot.add_theme_stylebox_override("panel", UiKit.box(fill if filled else Color(Art.PAPER, 0.7), Color(Art.INK, 1.0 if filled else 0.35), 1, 4))
	if not filled:
		return
	var icon := UiKit.icon(art, SLOT_SIZE - 5.0)
	icon.position = Vector2(2.5, 2.5)
	slot.add_child(icon)
	var badge := Panel.new()
	badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
	badge.add_theme_stylebox_override("panel", UiKit.box(Art.BRAND if evolved else Art.INK, Art.INK, 1 if evolved else 0, UiKit.PILL))
	badge.position = Vector2(SLOT_SIZE - 7.0, SLOT_SIZE - 6.0)
	badge.size = Vector2(10, 10)
	slot.add_child(badge)
	var number := UiKit.label("★" if evolved else str(item_level), 7, "display", Art.INK if evolved else Art.PAPER)
	number.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	number.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	number.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	number.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
	badge.add_child(number)


func _build_toast() -> void:
	_toast = UiKit.panel(UiKit.box(Art.PAPER, Art.INK, UiKit.OUTLINE, UiKit.PILL, Vector4(14, 4, 14, 5)))
	_toast.anchor_left = 0.5
	_toast.anchor_right = 0.5
	_toast.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_toast.modulate.a = 0.0
	_toast.resized.connect(func() -> void: _toast.pivot_offset = _toast.size / 2.0)
	_toast_label = UiKit.label("", 13, "strong")
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


## Two pills near the bottom: how to move, for a first few runs until the player does (the live
## data had a first-time player stand still at level 1 for half a minute); and in red, how to
## dodge a boss move the first time it comes up in a run.
func _build_bottom_hints() -> void:
	var drag := "按住屏幕任意处拖动来走位" if Device.is_handheld() else "用 WASD 或方向键走位"
	_move_hint = _bottom_pill(Art.INK, "ui_hand", drag)
	_root.add_child(_move_hint)
	_warning = _bottom_pill(Art.BOSS_RED, "ui_warning", "")
	_warning_label = _warning.get_child(0).get_child(1)
	_root.add_child(_warning)


func _bottom_pill(color: Color, art: String, text: String) -> Control:
	var pill := UiKit.panel(UiKit.box(Art.PAPER, color, UiKit.OUTLINE, UiKit.PILL, Vector4(12, 5, 12, 5)))
	pill.anchor_left = 0.5
	pill.anchor_right = 0.5
	pill.anchor_top = 1.0
	pill.anchor_bottom = 1.0
	pill.grow_horizontal = Control.GROW_DIRECTION_BOTH
	pill.grow_vertical = Control.GROW_DIRECTION_BEGIN
	pill.offset_bottom = -14
	pill.visible = false
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 6)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	pill.add_child(row)
	row.add_child(UiKit.icon(art, 14, color))
	row.add_child(UiKit.label(text, 12, "strong", color))
	return pill


func _on_boss_move(ability: String) -> void:
	Sound.boss_move(ability)
	if _warned.has(ability) or not BOSS_MOVE_HINTS.has(ability):
		return
	_warned[ability] = true
	_warning_label.text = BOSS_MOVE_HINTS[ability]
	_warning.offset_left = 0
	_warning.offset_right = 0
	_warning.visible = true
	_warning.modulate.a = 1.0
	if _warning_tween != null:
		_warning_tween.kill()
	_warning_tween = create_tween()
	_warning_tween.tween_interval(WARNING_SECONDS)
	_warning_tween.tween_property(_warning, "modulate:a", 0.0, 0.4)
	_warning_tween.tween_callback(func() -> void: _warning.visible = false)


## Red edges that pulse in as HP runs low.
func _build_vignette() -> void:
	var gradient := Gradient.new()
	gradient.offsets = PackedFloat32Array([0.0, 0.6, 1.0])
	gradient.colors = PackedColorArray([Color(Art.HP_RED, 0.0), Color(Art.HP_RED, 0.0), Color(Art.HP_RED, 0.7)])
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

func _show_title() -> void:
	_clear(_title_holder)
	var portrait := _is_portrait()
	# Two soft circles behind everything, as in the design.
	_title_holder.add_child(_blob(Art.FILL_SKY, 0.45, 140.0, Vector2(-40.0, 120.0), false))
	_title_holder.add_child(_blob(Art.FILL_MINT, 0.5, 120.0, Vector2(-50.0, 40.0), true))

	var page := _page(Vector4(24, 56, 24, 24) if portrait else Vector4(24, 20, 24, 14))
	_title_holder.add_child(page)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 0)
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	page.add_child(column)

	column.add_child(UiKit.kicker("SILICON VALLEY SURVIVORS"))
	column.add_child(UiKit.gap(6))
	_title_heading = _heading("硅谷幸存者", TITLE_SIZE if portrait else 40)
	column.add_child(_title_heading)
	var pitch := UiKit.label("躲开 Bug、会议和 Deadline\n撑过 10 分钟就能敲钟上市" if portrait else "躲开 Bug、会议和 Deadline，撑过 10 分钟就能敲钟上市！", 15 if portrait else 13)
	pitch.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	pitch.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	column.add_child(UiKit.gap(12 if portrait else 6))
	column.add_child(pitch)
	column.add_child(UiKit.gap(16 if portrait else 8))
	column.add_child(_job_picker(portrait))
	column.add_child(UiKit.gap(20 if portrait else 10))

	var start := UiKit.primary_button("开始搬砖", game.start_run, 56.0 if portrait else 48.0, 20)
	start.custom_minimum_size.x = 312.0 if portrait else 200.0
	start.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	var settings := _settings_button()
	settings.custom_minimum_size.x = 140.0 if portrait else 120.0
	settings.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	if portrait:
		column.add_child(start)
		column.add_child(UiKit.gap(12))
		column.add_child(settings)
	else:
		var buttons := HBoxContainer.new()
		buttons.alignment = BoxContainer.ALIGNMENT_CENTER
		buttons.add_theme_constant_override("separation", 12)
		buttons.add_child(start)
		buttons.add_child(settings)
		column.add_child(buttons)

	column.add_child(UiKit.filler())
	var hint := HBoxContainer.new()
	hint.alignment = BoxContainer.ALIGNMENT_CENTER
	hint.add_theme_constant_override("separation", 8)
	hint.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hint.add_child(UiKit.icon("ui_hand", 18, Art.INK_MUTED))
	var hint_label := UiKit.label("按住屏幕任意处拖动来走位，武器会自动攻击" if Device.is_handheld() else "WASD 或方向键走位，武器会自动攻击", 12, "muted")
	hint_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	hint_label.custom_minimum_size = Vector2(minf(280.0, _root.size.x - 80.0), 0)
	hint.add_child(hint_label)
	column.add_child(hint)
	# Rebuilt on every orientation change, mid-run too, when the title is hidden; and twice in a
	# frame can happen, so only a start button still on screen takes the focus.
	if game.state == Game.State.TITLE:
		(func() -> void:
			if is_instance_valid(start) and start.is_inside_tree():
				_focus(start)).call_deferred()
	_fit_title()


## A soft disc of `color` peeking in from the left (or right) edge.
func _blob(color: Color, alpha: float, diameter: float, offset: Vector2, from_right: bool) -> Control:
	var disc := Panel.new()
	disc.mouse_filter = Control.MOUSE_FILTER_IGNORE
	disc.add_theme_stylebox_override("panel", UiKit.box(Color(color, alpha), Color.TRANSPARENT, 0, UiKit.PILL))
	if from_right:
		disc.anchor_left = 1.0
		disc.anchor_right = 1.0
		disc.offset_left = -diameter - offset.x
		disc.offset_right = -offset.x
	else:
		disc.offset_left = offset.x
		disc.offset_right = offset.x + diameter
	disc.offset_top = offset.y
	disc.offset_bottom = offset.y + diameter
	return disc


## The five jobs as round faces to tap, and what the picked one plays like: side by side when
## the screen lies sideways.
func _job_picker(portrait: bool) -> Control:
	var picked := game.player.job
	var face_size := 52.0 if portrait else 36.0
	var faces := HBoxContainer.new()
	faces.alignment = BoxContainer.ALIGNMENT_CENTER
	faces.add_theme_constant_override("separation", 8 if portrait else 6)
	faces.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for job_id: String in Jobs.ORDER:
		faces.add_child(_job_face(job_id, job_id == picked, face_size))
	var detail := _job_detail(picked, portrait)
	var holder: BoxContainer = VBoxContainer.new() if portrait else HBoxContainer.new()
	holder.alignment = BoxContainer.ALIGNMENT_CENTER
	holder.add_theme_constant_override("separation", 10 if portrait else 14)
	holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	holder.add_child(faces)
	holder.add_child(detail)
	return holder


func _job_face(job_id: String, picked: bool, face_size: float) -> Button:
	var face := Button.new()
	face.custom_minimum_size = Vector2(face_size, face_size)
	face.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	# Start keeps the keyboard focus; arrow keys change the job (_unhandled_input).
	face.focus_mode = Control.FOCUS_NONE
	var resting := UiKit.box(Art.BRAND_SOFT, Art.INK, UiKit.OUTLINE_HEAVY, UiKit.PILL) if picked \
		else UiKit.box(Art.PAPER, Art.LINE, UiKit.OUTLINE, UiKit.PILL)
	face.add_theme_stylebox_override("normal", resting)
	face.add_theme_stylebox_override("hover", resting if picked else UiKit.box(Art.PAPER_SOFT, Art.LINE_STRONG, UiKit.OUTLINE, UiKit.PILL))
	face.add_theme_stylebox_override("pressed", UiKit.box(Art.BRAND_SOFT, Art.INK, UiKit.OUTLINE_HEAVY, UiKit.PILL))
	var centre := CenterContainer.new()
	centre.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	centre.mouse_filter = Control.MOUSE_FILTER_IGNORE
	centre.add_child(UiKit.icon(Jobs.JOBS[job_id]["art"], face_size * 0.82))
	face.add_child(centre)
	face.pressed.connect(_pick_job.bind(job_id))
	return face


## The picked job: name and its weapon's type, its own weapon, its build and how it plays.
## Sideways there is height for four lines only: the build goes on the name's line.
func _job_detail(job_id: String, portrait: bool) -> Control:
	var job_data := Jobs.data(job_id)
	var card := UiKit.panel(UiKit.box(Art.PAPER, Art.LINE, UiKit.OUTLINE, UiKit.RADIUS_MD, Vector4(12, 8, 12, 8)))
	card.custom_minimum_size = Vector2(312.0 if portrait else 356.0, 0.0)
	card.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 2)
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	card.add_child(column)
	var name_row := HBoxContainer.new()
	name_row.add_theme_constant_override("separation", 6)
	name_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(name_row)
	name_row.add_child(UiKit.label(job_data["name"], 16, "heavy"))
	name_row.add_child(_type_tag(Upgrades.WEAPONS[job_data["weapon"]]["type"]))
	var stats := UiKit.label(tr("生命 %d · 护甲 %d · 移速 %d") % [job_data["hp"], job_data["armor"], job_data["speed"]], 11, "muted")
	stats.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
	if not portrait:
		name_row.add_child(UiKit.filler())
		name_row.add_child(stats)
	var weapon_row := HBoxContainer.new()
	weapon_row.add_theme_constant_override("separation", 4)
	weapon_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(weapon_row)
	var weapon: Dictionary = Upgrades.WEAPONS[job_data["weapon"]]
	weapon_row.add_child(UiKit.icon(weapon["art"], 16))
	weapon_row.add_child(UiKit.label(tr("专属武器：%s") % tr(weapon["name"]), 12, "strong"))
	if portrait:
		column.add_child(stats)
	var pitch := UiKit.label(job_data["pitch"], 12)
	pitch.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	column.add_child(pitch)
	return card


## A weapon type as a coloured tag: 射击, 近战, 区域, 召唤.
func _type_tag(type: String) -> Control:
	var info: Dictionary = Jobs.TYPES[type]
	return UiKit.tag(info["name"], info["fill"], info["ink"])


func _pick_job(job_id: String) -> void:
	if game.state != Game.State.TITLE:
		return
	game.set_job(job_id)
	Sound.play("click")
	_show_title()


## Arrow keys on the title screen: the job before or after the picked one.
func _step_job(step: int) -> void:
	var index := Jobs.ORDER.find(game.player.job)
	_pick_job(Jobs.ORDER[(index + step + Jobs.ORDER.size()) % Jobs.ORDER.size()])


## Which build this is, in the bottom-right corner of the title, pause and result screens, so a
## phone still on an old one can be told apart at a glance.
func _add_corner_version(overlay: Control) -> void:
	var version := UiKit.label("v" + Telemetry.VERSION, 9, "muted")
	version.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
	version.anchor_left = 1.0
	version.anchor_right = 1.0
	version.anchor_top = 1.0
	version.anchor_bottom = 1.0
	version.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	version.grow_vertical = Control.GROW_DIRECTION_BEGIN
	version.offset_right = -8
	version.offset_bottom = -6
	overlay.add_child(version)


## A heading on a highlighter stroke: a yellow pill behind the lower part of the text, a little
## wider than it. Kept to one line, so the stroke is a dash under the words.
func _heading(text: String, font_size: int) -> Control:
	var holder := MarginContainer.new()
	holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	holder.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	# The container stretches this to the label's size; the stroke inside is anchored to its
	# bottom edge, which a container child can't be.
	var backdrop := Control.new()
	backdrop.mouse_filter = Control.MOUSE_FILTER_IGNORE
	holder.add_child(backdrop)
	var bar := Panel.new()
	bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bar.add_theme_stylebox_override("panel", UiKit.box(Art.BRAND, Color.TRANSPARENT, 0, 3))
	bar.anchor_right = 1.0
	bar.anchor_top = 1.0
	bar.anchor_bottom = 1.0
	backdrop.add_child(bar)
	var label := UiKit.label(text, font_size, "display")
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	holder.add_child(label)
	_size_heading(holder, font_size)
	return holder


func _size_heading(holder: Control, font_size: int) -> void:
	var bar: Control = holder.get_child(0).get_child(0)
	bar.offset_left = -font_size * 0.15
	bar.offset_right = font_size * 0.15
	bar.offset_bottom = -font_size * 0.12
	bar.offset_top = bar.offset_bottom - font_size * 0.36
	(holder.get_child(1) as Label).add_theme_font_size_override("font_size", font_size)


## Shrinks the title when its name in the current language is too wide for one line on this
## screen (Silicon Valley Survivors on an upright phone).
func _fit_title() -> void:
	if _title_heading == null or not is_instance_valid(_title_heading) or _root.size.x <= 0.0:
		return
	var label: Label = _title_heading.get_child(1)
	var room := minf(_root.size.x - 40.0, 600.0)
	var width := Art.display_font(900).get_string_size(label.atr(label.text), HORIZONTAL_ALIGNMENT_LEFT, -1, TITLE_SIZE).x
	_size_heading(_title_heading, TITLE_SIZE if width <= room else floori(TITLE_SIZE * room / width))


# --- Level-up ------------------------------------------------------------------------------

func _show_level_up(choices: Array) -> void:
	_clear(_cards_holder)
	var portrait := _is_portrait()
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 0)
	_cards_holder.add_child(column)

	column.add_child(UiKit.kicker("LEVEL UP", Art.BRAND_SOFT))
	var title := UiKit.label(tr("升级！Lv %d") % game.level, 28, "display", Art.PAPER)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(title)
	var sub := UiKit.label("选一张带走", 13, "body", Art.BRAND_SOFT)
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(sub)
	column.add_child(UiKit.gap(18 if portrait else 12))

	var narrow := not portrait and choices.size() > 3
	var cards: BoxContainer = VBoxContainer.new() if portrait else HBoxContainer.new()
	cards.alignment = BoxContainer.ALIGNMENT_CENTER
	cards.add_theme_constant_override("separation", 12 if portrait else 10)
	column.add_child(cards)
	var recommended := false
	for i in choices.size():
		var card := _make_card(choices[i], i, portrait, narrow, choices.size() > 3)
		cards.add_child(card)
		recommended = recommended or choices[i].get("recommended", false)
		_pop_in(card, i * 0.06)

	var hint_text := "按数字键或点卡片选择"
	if recommended:
		hint_text = "手上不到 3 把武器时，新武器卡会标「推荐」"
	elif Device.is_handheld():
		hint_text = "点一张卡片带走"
	var hint := UiKit.panel(UiKit.box(Color(Art.PAPER, 0.14), Color.TRANSPARENT, 0, UiKit.PILL, Vector4(12, 6, 12, 6)))
	hint.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	var hint_row := HBoxContainer.new()
	hint_row.add_theme_constant_override("separation", 6)
	hint_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hint.add_child(hint_row)
	hint_row.add_child(UiKit.icon("ui_info", 14))
	hint_row.add_child(UiKit.label(hint_text, 12, "body", Art.PAPER))
	column.add_child(UiKit.gap(18 if portrait else 12))
	column.add_child(hint)

	_level_up_overlay.visible = true
	_accept_picks_at = Time.get_ticks_msec() + PICK_DELAY_MS
	_focus(cards.get_child(0))
	_fit_cards.call_deferred(cards)
	_fit_to_screen(_cards_holder)


## A level-up choice: a wide row in portrait, a tall card side by side in landscape (`narrow`
## when four or five share the row). A recommended card stands out the way the main button
## does, on a hard shadow, with 推荐 on its corner.
func _make_card(choice: Dictionary, index: int, portrait: bool, narrow: bool, crowded: bool) -> Button:
	var kind: String = choice["kind"]
	var level: int = choice["level"]
	var fresh := level == 1 and kind != "heal"
	var recommended: bool = choice.get("recommended", false)
	var inset := 10.0 if crowded else 14.0
	var card := Button.new()
	card.custom_minimum_size = Vector2(minf(328.0, _root.size.x - 32.0), 0.0) if portrait \
		else Vector2(LEVEL_UP_CARD_MIN_WIDTH if narrow else 150.0, 0.0)
	var padding := Vector4.ONE * inset
	card.add_theme_stylebox_override("normal", UiKit.raised(Art.PAPER, UiKit.RADIUS_CARD, padding) if recommended \
		else UiKit.box(Art.PAPER, Art.LINE, UiKit.OUTLINE, UiKit.RADIUS_CARD, padding))
	card.add_theme_stylebox_override("hover", UiKit.raised(Art.PAPER_SOFT, UiKit.RADIUS_CARD, padding) if recommended \
		else UiKit.box(Art.PAPER, Art.LINE_STRONG, UiKit.OUTLINE, UiKit.RADIUS_CARD, padding))
	card.add_theme_stylebox_override("pressed", UiKit.box(Art.BRAND_SOFT, Art.INK, UiKit.OUTLINE_HEAVY, UiKit.RADIUS_CARD, padding))
	card.add_theme_stylebox_override("focus", UiKit.focus_ring(UiKit.RADIUS_CARD))
	card.pressed.connect(_pick.bind(index))
	card.mouse_entered.connect(_hover.bind(card, true))
	card.mouse_exited.connect(_hover.bind(card, false))
	card.resized.connect(func() -> void: card.pivot_offset = card.size / 2.0)

	# A Button doesn't lay out its children, so the content sits in a margin of its own, clear of
	# the outline (and of the shadow under a recommended card).
	var content := MarginContainer.new()
	content.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	content.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var edge := inset + UiKit.OUTLINE_HEAVY
	content.add_theme_constant_override("margin_left", int(edge))
	content.add_theme_constant_override("margin_right", int(edge))
	content.add_theme_constant_override("margin_top", int(edge))
	content.add_theme_constant_override("margin_bottom", int(edge + (UiKit.SHADOW_DROP if recommended else 0)))
	card.add_child(content)

	var fill := Art.MINT_LIGHT if kind == "passive" else Art.PINK_LIGHT if kind == "heal" else Art.SKY_LIGHT if fresh else Art.PAPER_SUNK
	var well := UiKit.well(choice["art"], (48.0 if crowded else 60.0) if portrait else (44.0 if narrow else 52.0), fill)
	var name_label := UiKit.label(_card_name(choice), 17 if portrait else 15, "heavy")
	var badge: Control = null
	if fresh:
		badge = UiKit.tag("新武器", Art.SKY_LIGHT, Art.LINK) if kind == "weapon" else UiKit.tag("被动", Art.MINT_LIGHT, Art.GREEN_INK)
	elif kind != "heal":
		badge = UiKit.level_dots(level - 1, choice["max"], true)
	# What type of weapon it is.
	var type_tag: Control = null
	if kind == "weapon":
		type_tag = _type_tag(choice["type"])
	var description := UiKit.label(choice["text"], 13 if portrait else 11, "muted")
	description.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	# What the card changes in numbers ("伤害 14 → 18"), translated already; none on the fallback card.
	var numbers_text := game.upgrades.numbers(choice)
	var numbers: Label = null
	if numbers_text != "":
		numbers = UiKit.label(numbers_text, 12 if portrait else 10, "strong", Art.LINK)
		numbers.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART

	if portrait:
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 12)
		row.mouse_filter = Control.MOUSE_FILTER_IGNORE
		content.add_child(row)
		row.add_child(well)
		var text_column := VBoxContainer.new()
		text_column.add_theme_constant_override("separation", 2)
		text_column.alignment = BoxContainer.ALIGNMENT_CENTER
		text_column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		text_column.mouse_filter = Control.MOUSE_FILTER_IGNORE
		row.add_child(text_column)
		var name_row := HBoxContainer.new()
		name_row.add_theme_constant_override("separation", 8)
		name_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
		text_column.add_child(name_row)
		name_row.add_child(name_label)
		if badge != null:
			name_row.add_child(badge)
		if type_tag != null:
			name_row.add_child(type_tag)
		text_column.add_child(description)
		if numbers != null:
			text_column.add_child(numbers)
	else:
		var column := VBoxContainer.new()
		column.add_theme_constant_override("separation", 4)
		column.mouse_filter = Control.MOUSE_FILTER_IGNORE
		content.add_child(column)
		column.add_child(UiKit.gap(4))
		column.add_child(well)
		name_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		# Four or five narrow cards side by side: a long English name takes two lines instead of
		# widening its card.
		name_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		column.add_child(name_label)
		if badge != null:
			badge.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
			column.add_child(badge)
		if type_tag != null:
			type_tag.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
			column.add_child(type_tag)
		description.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		column.add_child(description)
		if numbers != null:
			numbers.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			column.add_child(numbers)

	if recommended:
		var corner := UiKit.tag("推荐", Art.BRAND, Art.INK, UiKit.OUTLINE, 12)
		corner.anchor_left = 1.0
		corner.anchor_right = 1.0
		corner.grow_horizontal = Control.GROW_DIRECTION_BEGIN
		corner.offset_right = -12
		corner.offset_top = -11
		card.add_child(corner)
	return card


## A card's name; a job weapon's direction card adds the direction: 「PRD 卷筒 · 更宽」.
func _card_name(choice: Dictionary) -> String:
	if not choice.has("branch_name"):
		return choice["name"]
	return "%s · %s" % [tr(choice["name"]), tr(choice["branch_name"])]


## Grows each card to what its text needs once wrapped (a Button doesn't size to its children):
## English runs longer, and the numbers line adds a line or two.
func _fit_cards(cards: Control) -> void:
	if not is_instance_valid(cards):
		return
	for card: Control in cards.get_children():
		var content: Control = card.get_child(0)
		card.custom_minimum_size = card.custom_minimum_size.max(content.get_combined_minimum_size())


func _pick(index: int) -> void:
	if game.state != Game.State.LEVEL_UP or Time.get_ticks_msec() < _accept_picks_at:
		return
	game.choose_upgrade(index)


func _hover(card: Control, entered: bool) -> void:
	var tween := card.create_tween()
	tween.tween_property(card, "scale", Vector2.ONE * (1.03 if entered else 1.0), 0.15)


# --- Funding bag ---------------------------------------------------------------------------

## A boss's funding bag: a reel runs through the rounds and lands on the one Game rolled, then
## the upgrades it brought appear (Game has applied them already).
func _show_chest(funding_round: Dictionary, items: Array) -> void:
	_clear(_chest_holder)
	_chest_revealed = false
	_odds_chips.clear()
	var portrait := _is_portrait()
	var dialog := UiKit.panel(UiKit.dialog_box(Vector4(18, 18, 18, 18)))
	dialog.custom_minimum_size = Vector2(minf(320.0, _root.size.x - 40.0), 0.0) if portrait else Vector2(minf(560.0, _root.size.x - 40.0), 0.0)
	_chest_holder.add_child(dialog)
	var body: BoxContainer = VBoxContainer.new() if portrait else HBoxContainer.new()
	body.add_theme_constant_override("separation", 12 if portrait else 20)
	dialog.add_child(body)

	var head := VBoxContainer.new()
	head.add_theme_constant_override("separation", 0)
	if portrait:
		head.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	else:
		# Sideways the reel keeps a fixed width and the upgrades get the rest, for their names.
		head.custom_minimum_size = Vector2(240, 0)
	body.add_child(head)
	# The bag sits on the dialog's top edge, on a white disc that hides the outline behind it.
	var bag_anchor := Control.new()
	bag_anchor.custom_minimum_size = Vector2(0, 14)
	bag_anchor.mouse_filter = Control.MOUSE_FILTER_IGNORE
	head.add_child(bag_anchor)
	var disc := UiKit.panel(UiKit.box(Art.PAPER, Color.TRANSPARENT, 0, UiKit.PILL, Vector4(4, 4, 4, 4)))
	disc.anchor_left = 0.5
	disc.anchor_right = 0.5
	disc.offset_left = -32
	disc.offset_right = 32
	disc.offset_top = -50
	disc.offset_bottom = 14
	disc.add_child(UiKit.icon("moneybag", 56))
	bag_anchor.add_child(disc)
	head.add_child(UiKit.kicker("FUNDING ROUND"))
	var title := UiKit.label("融资开奖", 26, "heavy")
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	head.add_child(title)
	head.add_child(UiKit.gap(12))

	# The reel: the round before and after the one in the window, greyed out.
	var reel := UiKit.panel(UiKit.box(Art.PAPER_SOFT, Art.INK, UiKit.OUTLINE_HEAVY, 14, Vector4(8, 4, 8, 4)))
	reel.clip_contents = true
	var reel_stack := VBoxContainer.new()
	reel_stack.add_theme_constant_override("separation", 0)
	reel_stack.mouse_filter = Control.MOUSE_FILTER_IGNORE
	reel.add_child(reel_stack)
	_reel_prev = _reel_side_label()
	reel_stack.add_child(_reel_prev)
	var window := UiKit.panel(UiKit.box(Art.BRAND, Art.INK, UiKit.OUTLINE, 10))
	window.custom_minimum_size = Vector2(0, 52)
	_reel_label = UiKit.label("", 26, "heavy")
	_reel_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_reel_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	window.add_child(_reel_label)
	reel_stack.add_child(window)
	_reel_next = _reel_side_label()
	reel_stack.add_child(_reel_next)
	head.add_child(reel)
	_set_reel(0)

	# What each round gives and how often, the landed one marked once the reel stops.
	var odds := GridContainer.new()
	odds.columns = Game.FUNDING_ROUNDS.size()
	odds.add_theme_constant_override("h_separation", 6)
	odds.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for option: Dictionary in Game.FUNDING_ROUNDS:
		var chip := UiKit.panel(UiKit.box(Art.PAPER_SUNK, Color.TRANSPARENT, 0, 10, Vector4(4, 5, 4, 5)))
		chip.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var chip_column := VBoxContainer.new()
		chip_column.add_theme_constant_override("separation", 0)
		chip_column.mouse_filter = Control.MOUSE_FILTER_IGNORE
		chip.add_child(chip_column)
		var round_name := UiKit.label(option["name"], 13, "strong")
		round_name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		chip_column.add_child(round_name)
		var chance := UiKit.label(tr("升 %d 样 · %d%%") % [option["items"], roundi(option["weight"])], 11, "muted")
		chance.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		chip_column.add_child(chance)
		odds.add_child(chip)
		_odds_chips.append(chip)
	head.add_child(UiKit.gap(10))
	head.add_child(odds)

	var tail := VBoxContainer.new()
	tail.add_theme_constant_override("separation", 10)
	tail.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tail.alignment = BoxContainer.ALIGNMENT_CENTER
	body.add_child(tail)
	var result := UiKit.label("", 15, "heavy")
	result.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	tail.add_child(result)
	# One upgrade a row, so every name has room (two columns sideways made the dialog too wide).
	var prize := VBoxContainer.new()
	prize.add_theme_constant_override("separation", 8)
	tail.add_child(prize)
	var take := UiKit.primary_button("收下", _on_chest_button)
	tail.add_child(take)
	_focus(take)
	_pop_in(dialog, 0.0)
	_accept_picks_at = Time.get_ticks_msec() + PICK_DELAY_MS
	_fit_to_screen(_chest_holder, BAG_OVERHANG)

	# Laps of every round, slowing down, then the winning one.
	var landing := Game.FUNDING_ROUNDS.find(funding_round)
	var steps := float(CHEST_SPIN_LAPS * Game.FUNDING_ROUNDS.size() + landing)
	_chest_reveal = _reveal_chest.bind(landing, result, prize, funding_round, items)
	_chest_spin = dialog.create_tween()
	_chest_spin.tween_method(_spin_reel, 0.0, steps, CHEST_SPIN_SECONDS) \
		.set_trans(Tween.TRANS_QUART).set_ease(Tween.EASE_OUT)
	_chest_spin.tween_callback(_chest_reveal)


func _reel_side_label() -> Label:
	var side := UiKit.label("", 14, "strong", Art.LINE_STRONG)
	side.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	side.custom_minimum_size = Vector2(0, 26)
	side.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	return side


func _set_reel(index: int) -> void:
	var rounds := Game.FUNDING_ROUNDS
	var count := rounds.size()
	_reel_prev.text = rounds[(index + count - 1) % count]["name"]
	_reel_label.text = rounds[index % count]["name"]
	_reel_next.text = rounds[(index + 1) % count]["name"]


func _spin_reel(step: float) -> void:
	var index := floori(step) % Game.FUNDING_ROUNDS.size()
	if _reel_label.text != Game.FUNDING_ROUNDS[index]["name"]:
		_set_reel(index)
		Sound.play("reel_tick")


func _reveal_chest(landing: int, result: Label, prize: VBoxContainer, funding_round: Dictionary, items: Array) -> void:
	if _chest_revealed:
		return
	_chest_revealed = true
	if _chest_spin != null and _chest_spin.is_valid():
		_chest_spin.kill()
	_set_reel(landing)
	_odds_chips[landing].add_theme_stylebox_override("panel", UiKit.box(Art.BRAND_SOFT, Art.INK, UiKit.OUTLINE, 10, Vector4(4, 5, 4, 5)))
	result.text = tr("%s到账！白给 %d 样升级") % [tr(funding_round["name"]), items.size()]
	Sound.play("win" if funding_round["id"] == "ipo" else "payout")
	# The same upgrade twice in one bag is one row, from its first level to its last.
	var rows: Array[Dictionary] = []
	var row_of := {}
	for item: Dictionary in items:
		if row_of.has(item["id"]):
			rows[row_of[item["id"]]]["level"] = item["level"]
		else:
			row_of[item["id"]] = rows.size()
			var entry := item.duplicate()
			entry["from"] = item["level"] - 1
			rows.append(entry)
	for i in rows.size():
		var row := _prize_row(rows[i], _is_portrait())
		prize.add_child(row)
		_pop_in(row, 0.1 + i * 0.1)
	_fit_to_screen(_chest_holder, BAG_OVERHANG)


## One upgrade out of the bag: its icon, name and the level it went to.
func _prize_row(item: Dictionary, roomy: bool) -> Control:
	var row_panel := UiKit.panel(UiKit.box(Art.PAPER, Art.LINE, UiKit.OUTLINE, UiKit.RADIUS_MD, Vector4(10, 6 if roomy else 3, 10, 6 if roomy else 3)))
	row_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row_panel.resized.connect(func() -> void: row_panel.pivot_offset = row_panel.size / 2.0)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row_panel.add_child(row)
	var kind: String = item["kind"]
	var level: int = item["level"]
	var fill := Art.MINT_LIGHT if kind == "passive" else Art.PINK_LIGHT if kind == "heal" else Art.BRAND_SOFT if kind == "evolve" else Art.SKY_LIGHT
	if kind == "evolve":
		row_panel.add_theme_stylebox_override("panel", UiKit.box(Art.BRAND_SOFT, Art.INK, UiKit.OUTLINE, UiKit.RADIUS_MD, Vector4(10, 6 if roomy else 3, 10, 6 if roomy else 3)))
	row.add_child(UiKit.well(item["art"], 34 if roomy else 28, fill, UiKit.RADIUS_SM))
	var name_label := UiKit.label(_card_name(item), 14, "strong")
	name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	name_label.clip_text = true
	name_label.custom_minimum_size = Vector2(60, 0)
	row.add_child(name_label)
	var from: int = item.get("from", level - 1)
	var step := tr("回复 30") if kind == "heal" else tr("进化！") if kind == "evolve" else tr("新") if level == 1 else "Lv %d → %d" % [from, level]
	row.add_child(UiKit.label(step, 12, "display", Art.LINK))
	return row_panel


## Mid-spin it shows the result at once; after that it closes the bag.
func _on_chest_button() -> void:
	if game.state != Game.State.CHEST or Time.get_ticks_msec() < _accept_picks_at:
		return
	if not _chest_revealed:
		_chest_reveal.call()
		return
	game.close_chest()


# --- Pause ---------------------------------------------------------------------------------

func _show_pause() -> void:
	_clear(_pause_holder)
	var portrait := _is_portrait()
	var dialog := UiKit.panel(UiKit.dialog_box(Vector4(16, 16, 16, 16)))
	# Upright, the card takes the screen like the design; sideways it is a wide card.
	dialog.custom_minimum_size = _root.size - Vector2(32, 48) if portrait else Vector2(minf(600.0, _root.size.x - 40.0), 0.0)
	_pause_holder.add_child(dialog)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 12 if portrait else 10)
	dialog.add_child(column)

	var header := HBoxContainer.new()
	header.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(header)
	header.add_theme_constant_override("separation", 8)
	var title := UiKit.label("暂停", 22, "heavy")
	header.add_child(title)
	var job_tag := UiKit.tag(Jobs.data(game.player.job)["name"], Art.PAPER_SUNK, Art.INK)
	header.add_child(job_tag)
	header.add_child(UiKit.filler())
	header.add_child(UiKit.label(_clock_text(game.elapsed), 13, "display"))

	var build := VBoxContainer.new()
	build.add_theme_constant_override("separation", 6)
	build.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var weapon_chips: Array = []
	for weapon in game.player.weapons:
		weapon_chips.append([Upgrades.weapon_name(weapon.id, weapon.evolved), weapon.level, weapon.art, weapon.evolved])
	build.add_child(UiKit.label(tr("武器 %d / %d") % [weapon_chips.size(), Jobs.MAX_WEAPONS], 12, "strong", Art.INK_MUTED))
	build.add_child(_chip_grid(weapon_chips, Art.SKY_LIGHT))
	var passive_chips: Array = []
	for passive_id: String in game.upgrades.passive_levels:
		var passive: Dictionary = Upgrades.PASSIVES[passive_id]
		passive_chips.append([passive["name"], game.upgrades.passive_levels[passive_id], passive["art"], false])
	build.add_child(UiKit.gap(4))
	build.add_child(UiKit.label(tr("被动 %d / %d") % [passive_chips.size(), Upgrades.MAX_PASSIVES], 12, "strong", Art.INK_MUTED))
	build.add_child(_chip_grid(passive_chips, Art.MINT_LIGHT))

	var player := game.player
	var stats := UiKit.panel(UiKit.box(Art.PAPER_SOFT, Color.TRANSPARENT, 0, UiKit.RADIUS_MD, Vector4(10, 8, 10, 8)))
	var stat_grid := GridContainer.new()
	stat_grid.columns = 3
	stat_grid.add_theme_constant_override("h_separation", 10)
	stat_grid.add_theme_constant_override("v_separation", 6)
	stat_grid.mouse_filter = Control.MOUSE_FILTER_IGNORE
	stats.add_child(stat_grid)
	# Health as it is now only: the cap shows on the bar under the player anyway.
	for stat: Array in [
		["生命", str(ceili(player.hp))],
		["伤害", "×%.2f" % player.might],
		["冷却", "×%.2f" % player.cooldown_scale],
		["移速", str(roundi(player.move_speed))],
		["拾取", str(roundi(player.pickup_radius))],
		["护甲 · 回血", "%d · %s/s" % [roundi(player.armor), Upgrades._short_float(player.regen)]],
	]:
		var cell := VBoxContainer.new()
		cell.add_theme_constant_override("separation", 0)
		cell.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		cell.mouse_filter = Control.MOUSE_FILTER_IGNORE
		cell.add_child(UiKit.label(stat[0], 11, "muted"))
		var value := UiKit.label(stat[1], 15, "display")
		value.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
		cell.add_child(value)
		stat_grid.add_child(cell)

	var actions := VBoxContainer.new()
	actions.add_theme_constant_override("separation", 8)
	var resume := UiKit.primary_button("继续", game.set_paused.bind(false))
	actions.add_child(resume)
	var second_row := HBoxContainer.new()
	second_row.add_theme_constant_override("separation", 8)
	actions.add_child(second_row)
	var restart := UiKit.secondary_button("重新开始", game.restart)
	restart.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	second_row.add_child(restart)
	# The run so far as a result image, to show off (or ask for help) mid-run.
	var share := UiKit.secondary_button("分享", _make_share_image)
	share.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	second_row.add_child(share)
	var settings := _settings_button()
	settings.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	second_row.add_child(settings)

	var recalibrate: Label = null
	if Tilt.enabled():
		recalibrate = UiKit.label("继续时会按那时拿手机的角度重新校准", 11, "muted")
		recalibrate.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART

	if portrait:
		column.add_child(build)
		column.add_child(stats)
		if recalibrate != null:
			column.add_child(recalibrate)
		column.add_child(UiKit.filler())
		column.add_child(actions)
	else:
		var body := HBoxContainer.new()
		body.add_theme_constant_override("separation", 18)
		column.add_child(body)
		body.add_child(build)
		var side := VBoxContainer.new()
		side.add_theme_constant_override("separation", 10)
		side.custom_minimum_size = Vector2(250, 0)
		body.add_child(side)
		side.add_child(stats)
		if recalibrate != null:
			side.add_child(recalibrate)
		side.add_child(UiKit.filler())
		side.add_child(actions)
	_focus(resume)
	_pop_in(dialog, 0.0)
	_fit_to_screen(_pause_holder)


## Icon, name and level chips two to a row (entries are [name, level, art, evolved]; an evolved
## weapon's chip is yellow), or "none yet".
func _chip_grid(entries: Array, fill: Color) -> Control:
	if entries.is_empty():
		return UiKit.label("还没有", 12, "muted")
	var grid := GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 6)
	grid.add_theme_constant_override("v_separation", 6)
	grid.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for entry: Array in entries:
		var chip := UiKit.panel(UiKit.box(Art.BRAND_SOFT if entry[3] else fill, Color.TRANSPARENT, 0, 10, Vector4(6, 4, 8, 4)))
		chip.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		chip.custom_minimum_size = Vector2(120, 0)
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 5)
		row.mouse_filter = Control.MOUSE_FILTER_IGNORE
		chip.add_child(row)
		row.add_child(UiKit.icon(entry[2], 18))
		# A size down from the other chips: the icon takes room, and English names run long.
		var name_label := UiKit.label(entry[0], 12, "strong")
		name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		name_label.clip_text = true
		row.add_child(name_label)
		var level_text := "★" if entry[3] else "Lv %d" % entry[1]
		var level_label := UiKit.label(level_text, 11, "display")
		level_label.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
		row.add_child(level_label)
		grid.add_child(chip)
	return grid


# --- Result --------------------------------------------------------------------------------

func _show_end(victory: bool) -> void:
	_victory = victory
	_clear(_end_holder)
	var portrait := _is_portrait()
	var page := _page(Vector4(16, 22, 16, 26) if portrait else Vector4(24, 16, 24, 24))
	_end_holder.add_child(page)
	var left := VBoxContainer.new()
	left.add_theme_constant_override("separation", 10)
	left.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var right := left
	if portrait:
		page.add_child(left)
	else:
		var body := HBoxContainer.new()
		body.add_theme_constant_override("separation", 20)
		page.add_child(body)
		body.add_child(left)
		right = VBoxContainer.new()
		right.add_theme_constant_override("separation", 10)
		right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		body.add_child(right)

	left.add_child(UiKit.kicker("IPO DAY" if victory else "GAME OVER"))
	var title := UiKit.label("敲钟上市！" if victory else "项目黄了…", 30, "heavy")
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	left.add_child(title)
	var sub := UiKit.label(tr("第 %d 局 · %s") % [game.runs_before + 1, tr(Jobs.data(game.player.job)["name"])], 13, "muted")
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	left.add_child(sub)

	var stats := HBoxContainer.new()
	stats.add_theme_constant_override("separation", 8)
	left.add_child(stats)
	for stat: Array in [["存活", _clock_text(game.elapsed)], ["等级", "Lv %d" % game.level], ["击杀", str(game.kills)]]:
		var card := UiKit.panel(UiKit.box(Art.PAPER, Art.LINE, UiKit.OUTLINE, UiKit.RADIUS_MD, Vector4(4, 6, 4, 6)))
		card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var card_column := VBoxContainer.new()
		card_column.add_theme_constant_override("separation", 0)
		card_column.mouse_filter = Control.MOUSE_FILTER_IGNORE
		card.add_child(card_column)
		var value := UiKit.label(stat[1], 22, "display")
		value.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		value.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
		card_column.add_child(value)
		var caption := UiKit.label(stat[0], 12, "muted")
		caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		card_column.add_child(caption)
		stats.add_child(card)

	var culprit := _culprit_row(victory)
	if culprit != null:
		left.add_child(culprit)
	var advice := _end_advice(victory)
	if not advice.is_empty():
		left.add_child(_advice_card(advice))
	var ranking := _damage_ranking()
	if ranking != null:
		right.add_child(ranking)

	right.add_child(UiKit.filler())
	var buttons := HBoxContainer.new()
	buttons.add_theme_constant_override("separation", 10)
	right.add_child(buttons)
	var share := UiKit.secondary_button("生成战绩图", _make_share_image, 50.0, 15)
	share.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	buttons.add_child(share)
	var change := UiKit.secondary_button("换职业", game.change_job, 50.0, 15)
	change.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	buttons.add_child(change)
	var again := UiKit.primary_button("再来一局", game.restart)
	again.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	again.size_flags_stretch_ratio = 1.3
	buttons.add_child(again)
	_focus(again)
	_pop_in(page, 0.0)
	_fit_to_screen(_end_holder)


## Who ended the run and how, on pink (or, after a win, who came closest).
func _culprit_row(victory: bool) -> Control:
	var killer := game.telemetry.last_hurt_by
	if not Spawner.ENEMY_TYPES.has(killer):
		return null
	var data: Dictionary = Spawner.ENEMY_TYPES[killer]
	var row_panel := UiKit.panel(UiKit.box(Art.PINK_LIGHT, Color.TRANSPARENT, 0, UiKit.RADIUS_MD, Vector4(12, 8, 12, 8)))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row_panel.add_child(row)
	var face := UiKit.panel(UiKit.box(Art.PAPER, Art.BOSS_RED, UiKit.OUTLINE, UiKit.PILL))
	face.custom_minimum_size = Vector2(34, 34)
	face.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var face_centre := CenterContainer.new()
	face_centre.mouse_filter = Control.MOUSE_FILTER_IGNORE
	face.add_child(face_centre)
	face_centre.add_child(UiKit.icon(data["art"], 22))
	row.add_child(face)
	row.add_child(UiKit.label("差点送走我的" if victory else "凶手", 14, "muted"))
	var name_label := UiKit.label(data["name"], 14, "heavy")
	name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(name_label)
	if not victory:
		var how := game.telemetry.last_hurt_how
		var cause: String = KILL_CAUSES.get(how, "被 boss 撞倒" if data.get("elite", false) else "被围殴")
		row.add_child(UiKit.label(cause, 12, "strong", Art.BOSS_RED))
	return row_panel


## The next run's one tip after a loss, as [headline, detail]: what most likely went wrong (the
## live data's early deaths were mostly one-weapon builds).
func _end_advice(victory: bool) -> Array:
	if victory:
		return []
	var weapons := game.player.weapons.size()
	if weapons <= 2:
		return [tr("只带了 %d 把武器。") % weapons, tr("升级时先拿武器卡，凑够 3–4 把再拿被动。")]
	var bosses := _bosses_out()
	if bosses >= 2:
		return [tr("被 %d 个 boss 围住了。") % bosses, tr("边走边打，别停在原地。")]
	if Spawner.ENEMY_TYPES.get(game.telemetry.last_hurt_by, {}).get("elite", false):
		return [tr("倒在了 boss 的招式下。"), tr("出招前地上会画出范围，看到就往旁边躲。")]
	if game.elapsed < 120.0:
		return [tr("开局要多走动。"), tr("走到星星旁边才能捡到经验升级。")]
	return [tr("差一点。"), tr("试试多拿撸铁或降噪耳机，更抗揍。")]


func _advice_card(advice: Array) -> Control:
	var card := UiKit.panel(UiKit.box(Art.BRAND_SOFT, Color.TRANSPARENT, 0, UiKit.RADIUS_MD, Vector4(12, 10, 12, 10)))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	card.add_child(row)
	var bulb := UiKit.icon("ui_bulb", 18, Art.INK)
	bulb.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	row.add_child(bulb)
	var lines := VBoxContainer.new()
	lines.add_theme_constant_override("separation", 2)
	lines.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	lines.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(lines)
	for i in advice.size():
		var line := UiKit.label(advice[i], 13, "heavy" if i == 0 else "body")
		line.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		lines.add_child(line)
	return card


func _bosses_out() -> int:
	var count := 0
	for enemy in game.enemies:
		if enemy.is_elite and not enemy.dead:
			count += 1
	return count


## Weapons (and the perks that deal damage) by their share of all damage dealt this run, or null
## when nothing dealt any.
func _damage_ranking() -> Control:
	var total := 0.0
	var entries: Array = []
	for source: String in game.damage_by_source:
		total += game.damage_by_source[source]
		if Upgrades.WEAPONS.has(source) or Upgrades.PASSIVES.has(source):
			entries.append([source, game.damage_by_source[source]])
	if entries.is_empty() or total <= 0.0:
		return null
	entries.sort_custom(func(a: Array, b: Array) -> bool: return a[1] > b[1])
	var card := UiKit.panel(UiKit.box(Art.PAPER, Art.LINE, UiKit.OUTLINE, UiKit.RADIUS_MD, Vector4(12, 10, 12, 10)))
	var list := VBoxContainer.new()
	list.add_theme_constant_override("separation", 6)
	list.mouse_filter = Control.MOUSE_FILTER_IGNORE
	card.add_child(list)
	list.add_child(UiKit.label("伤害排行", 13, "strong", Art.INK_MUTED))
	for entry: Array in entries.slice(0, RANKING_ROWS):
		var source_name: String = Upgrades.weapon_name(entry[0], game.upgrades.is_evolved(entry[0])) \
			if Upgrades.WEAPONS.has(entry[0]) else Upgrades.PASSIVES[entry[0]]["name"]
		var share: float = entry[1] / total
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 8)
		row.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var name_label := UiKit.label(source_name, 13, "strong")
		name_label.custom_minimum_size = Vector2(64, 0)
		row.add_child(name_label)
		row.add_child(ShareBar.new(share))
		var percent := UiKit.label("%d%%" % roundi(share * 100.0), 13, "display")
		percent.custom_minimum_size = Vector2(36, 0)
		percent.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		row.add_child(percent)
		list.add_child(row)
	return card


## A share of the whole as a bar: sky fill with an ink edge on a sunk track.
class ShareBar extends Control:
	var share := 0.0

	func _init(value: float) -> void:
		share = value
		custom_minimum_size = Vector2(40, 12)
		size_flags_horizontal = Control.SIZE_EXPAND_FILL
		size_flags_vertical = Control.SIZE_SHRINK_CENTER
		mouse_filter = Control.MOUSE_FILTER_IGNORE
		resized.connect(queue_redraw)

	func _draw() -> void:
		draw_style_box(UiKit.box(Art.PAPER_SUNK, Color.TRANSPARENT, 0, UiKit.PILL), Rect2(Vector2.ZERO, size))
		var width := size.x * clampf(share, 0.0, 1.0)
		if width <= 0.0:
			return
		var fill := UiKit.box(Art.FILL_SKY, Art.INK, 0, UiKit.PILL)
		fill.border_width_right = 2
		draw_style_box(fill, Rect2(Vector2.ZERO, Vector2(maxf(width, size.y), size.y)))


## Renders the result image (ShareCard) and hands it to the page to save or share; elsewhere
## (the editor, the smoke test) it is saved to user://share_card.png.
func _make_share_image() -> void:
	if _sharing:
		return
	_sharing = true
	var card := ShareCard.new()
	add_child(card)
	# From the pause screen it is the run so far.
	card.build(game, _victory, _root.theme, game.state != Game.State.ENDED)
	var image: Image = await card.capture()
	card.queue_free()
	_sharing = false
	if not OS.has_feature("web"):
		image.save_png("user://share_card.png")
		print("[hud] result image saved to %s" % ProjectSettings.globalize_path("user://share_card.png"))
		return
	var share := JavaScriptBridge.get_interface("survivorsShare")
	if share == null:
		return
	var hint := "长按图片保存，或发给朋友" if Device.is_handheld() else "右键图片可以另存为"
	# The page swaps in the last hint on iPhone / iPad, where saving goes through the share sheet.
	share.show(Marshalls.raw_to_base64(image.save_png_to_buffer()), tr(hint), tr("分享"), tr("保存图片"), tr("关闭"), tr("点「保存图片」，再选「存储图像」存进相册"))


# --- Settings ------------------------------------------------------------------------------

func _settings_button() -> Button:
	var button := UiKit.secondary_button("设置", _open_settings)
	button.icon = Art.texture("gear")
	# The SVG imports at 4x; cap it to text height instead of drawing it at texture size.
	button.add_theme_constant_override("icon_max_width", 18)
	return button


## Settings as a page of its own: language, screen orientation (phones), switches for tilt,
## sound and music.
func _open_settings() -> void:
	_settings_open = true
	_clear(_settings_holder)
	var portrait := _is_portrait()
	var page := _page(Vector4(16, 20, 16, 20) if portrait else Vector4(24, 14, 24, 16))
	_settings_holder.add_child(page)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 14 if portrait else 10)
	page.add_child(column)

	var header := HBoxContainer.new()
	header.add_theme_constant_override("separation", 8)
	column.add_child(header)
	header.add_child(UiKit.round_button("ui_back", _close_settings, 44.0, Art.INK))
	var title := UiKit.label("设置", 22, "heavy")
	title.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	header.add_child(title)

	var general: Array[Control] = []
	general.append(_setting_row("语言", "Language", UiKit.segmented(["中文", "English"], 0 if Lang.current() == "zh" else 1, _on_language_picked, Art.PAPER_SUNK), ""))
	if Device.is_handheld():
		var landscape := Device.prefers_landscape()
		general.append(_setting_row("屏幕方向", "", UiKit.segmented(["跟随手机", "横屏"], 1 if landscape else 0, _on_orientation_picked, Art.PAPER_SUNK), "选「横屏」后竖着拿手机，整个游戏会转 90°"))
	var switches: Array[Control] = []
	_tilt_hint = null
	if Tilt.available():
		switches.append(_switch_row("陀螺仪", "倾斜手机来走位（iOS 需点一下授权）", Tilt.enabled(), Tilt.set_enabled))
		_tilt_hint = UiKit.label("", 12, "strong", Art.BOSS_RED)
		_tilt_hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		switches.append(_tilt_hint)
	switches.append(_switch_row("音效", "连续捡星星时音调逐个升高", Sound.sfx_enabled(), Sound.set_sfx_enabled))
	switches.append(_switch_row("音乐", "标题和战斗各一首循环曲", Sound.music_enabled(), Sound.set_music_enabled))

	if portrait:
		var rows: Array[Control] = []
		rows.append_array(general)
		rows.append_array(switches)
		column.add_child(_settings_card(rows))
	else:
		var body := HBoxContainer.new()
		body.add_theme_constant_override("separation", 12)
		column.add_child(body)
		var left := _settings_card(general)
		left.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		left.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
		body.add_child(left)
		var right := _settings_card(switches)
		right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		right.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
		body.add_child(right)

	if Tilt.available():
		var note := UiKit.panel(UiKit.box(Art.SKY_LIGHT, Color.TRANSPARENT, 0, UiKit.RADIUS_MD, Vector4(12, 8, 12, 8)))
		var note_row := HBoxContainer.new()
		note_row.add_theme_constant_override("separation", 8)
		note_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
		note.add_child(note_row)
		var info := UiKit.icon("ui_info", 16, Art.LINK)
		info.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
		note_row.add_child(info)
		var note_text := UiKit.label("开了陀螺仪后，右上角会多一个「校准」按钮：以开局时拿手机的角度为准，倾斜 18° 跑满速。", 12)
		note_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		note_text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		note_row.add_child(note_text)
		column.add_child(note)

	column.add_child(UiKit.filler())
	var done := UiKit.primary_button("完成", _close_settings)
	if not portrait:
		done.custom_minimum_size.x = 200
		done.size_flags_horizontal = Control.SIZE_SHRINK_END
	column.add_child(done)
	_focus(done)
	_fit_to_screen(_settings_holder)


## White card holding setting rows with hairlines between them.
func _settings_card(rows: Array[Control]) -> Control:
	var card := UiKit.panel(UiKit.box(Art.PAPER, Art.LINE, UiKit.OUTLINE, UiKit.RADIUS_CARD, Vector4(14, 2, 14, 2)))
	var list := VBoxContainer.new()
	list.add_theme_constant_override("separation", 0)
	list.mouse_filter = Control.MOUSE_FILTER_IGNORE
	card.add_child(list)
	for i in rows.size():
		if i > 0 and not rows[i] is Label:
			var hairline := ColorRect.new()
			hairline.color = Art.LINE
			hairline.custom_minimum_size = Vector2(0, 1)
			hairline.mouse_filter = Control.MOUSE_FILTER_IGNORE
			list.add_child(hairline)
		list.add_child(rows[i])
	return card


## A setting with a choice under its name, and a hint under that.
func _setting_row(title: String, subtitle: String, control: Control, hint: String) -> Control:
	var row := VBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	var name_row := HBoxContainer.new()
	name_row.add_theme_constant_override("separation", 6)
	name_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	name_row.add_child(UiKit.label(title, 15, "strong"))
	# The English name beside the Chinese one; in English the name is that already.
	if subtitle != "" and Lang.current() == "zh":
		var latin := UiKit.label(subtitle, 12, "display", Art.INK_MUTED)
		latin.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
		name_row.add_child(latin)
	row.add_child(UiKit.gap(4))
	row.add_child(name_row)
	row.add_child(control)
	if hint != "":
		var hint_label := UiKit.label(hint, 12, "muted")
		hint_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		row.add_child(hint_label)
	row.add_child(UiKit.gap(4))
	return row


## A setting that is on or off: its name and hint, a switch on the right.
func _switch_row(title: String, hint: String, on: bool, setter: Callable) -> Control:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	var text := VBoxContainer.new()
	text.add_theme_constant_override("separation", 0)
	text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	text.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(text)
	text.add_child(UiKit.gap(10))
	text.add_child(UiKit.label(title, 15, "strong"))
	var hint_label := UiKit.label(hint, 12, "muted")
	hint_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	text.add_child(hint_label)
	text.add_child(UiKit.gap(10))
	var switch := UiKit.ToggleSwitch.new(on)
	switch.toggled.connect(setter)
	row.add_child(switch)
	return row


func _close_settings() -> void:
	_settings_open = false
	if game.state == Game.State.PAUSED:
		_show_pause()


func _on_language_picked(index: int) -> void:
	Lang.choose(Lang.LANGUAGES[index])


## "Follow the phone" lays the game out the way the phone is held; "landscape" turns it on an
## upright phone.
func _on_orientation_picked(index: int) -> void:
	Settings.set_value("orientation", "portrait" if index == 0 else "landscape")
	game.apply_orientation()
	# The screens were laid out for the old shape; build them again once the HUD has refitted.
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


## A full-screen holder for a page (title, result, settings).
func _full(parent: Control) -> Control:
	var holder := Control.new()
	holder.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(holder)
	return holder


## A page's content area: the whole screen inside `margins` (left, top, right, bottom).
func _page(margins: Vector4) -> MarginContainer:
	var page := MarginContainer.new()
	page.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	page.mouse_filter = Control.MOUSE_FILTER_IGNORE
	page.add_theme_constant_override("margin_left", int(margins.x))
	page.add_theme_constant_override("margin_top", int(margins.y))
	page.add_theme_constant_override("margin_right", int(margins.z))
	page.add_theme_constant_override("margin_bottom", int(margins.w))
	page.resized.connect(func() -> void: page.pivot_offset = page.size / 2.0)
	return page


## Shrinks a screen that comes out taller or wider than the view (a full build in English on a
## short landscape screen) until it fits, around the screen's centre; `overhang` is height drawn
## outside the screen's own box (the funding bag). Wrapped text and fitted cards settle over a
## few frames, so it refits every time the screen's size changes.
func _fit_to_screen(holder: Control, overhang: float = 0.0) -> void:
	holder.scale = Vector2.ONE
	if holder.get_child_count() == 0:
		return
	var screen: Control = holder.get_child(0)
	if not screen.resized.is_connected(_refit):
		screen.resized.connect(_refit.bind(holder, screen, overhang))
	_refit.call_deferred(holder, screen, overhang)


func _refit(holder: Control, screen: Control, overhang: float) -> void:
	if not is_instance_valid(screen) or screen.get_parent() != holder or screen.size.x <= 0.0:
		return
	var room := _root.size - Vector2(FIT_MARGIN * 2.0, FIT_MARGIN * 2.0 + overhang)
	if screen is MarginContainer:
		# A page's margins count as room already.
		room = _root.size
	# A screen bigger than the view grows its holder past the view's right and bottom edges; put
	# the holder's centre back on the view's (lower by half the overhang, which then has the room
	# above) before shrinking around it.
	holder.pivot_offset = holder.size / 2.0
	holder.position = (_root.size - holder.size) / 2.0 + Vector2(0.0, overhang / 2.0)
	holder.scale = Vector2.ONE * minf(1.0, minf(room.x / screen.size.x, room.y / screen.size.y))


## Puts the keyboard focus on a screen's main control, on computers only: phones have no keys
## to move it, so there the focus ring would only be a stray blue outline.
func _focus(control: Control) -> void:
	if not Device.is_handheld():
		control.grab_focus()


func _clear(holder: Node) -> void:
	for child in holder.get_children():
		holder.remove_child(child)
		child.queue_free()


func _pop_in(node: Control, delay: float) -> void:
	node.modulate.a = 0.0
	node.scale = Vector2.ONE * 0.9
	var tween := node.create_tween().set_parallel()
	tween.tween_property(node, "modulate:a", 1.0, 0.12).set_delay(delay)
	tween.tween_property(node, "scale", Vector2.ONE, 0.22).set_delay(delay) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)


func _clock_text(seconds_elapsed: float) -> String:
	var seconds := floori(seconds_elapsed)
	return "%02d:%02d" % [floori(seconds / 60.0), seconds % 60]
