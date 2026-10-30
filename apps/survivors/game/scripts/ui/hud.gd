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
## How red the screen's edges flash for a hit just taken (of the low-health vignette's full red).
const HURT_FLASH := 0.6
const XP_BAR_SIZE := Vector2(96, 18)
## The boss bar sits under the clock; on an upright phone it must clear the minimap.
const BOSS_BAR_WIDTH := 110.0
const BOSS_BAR_WIDTH_PORTRAIT := 80.0
## Level-up cards side by side when there are more than three of them (luck's extra card).
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
	"aura": "金圈里的小怪减伤一半，先打中间那个",
	"pull": "箭头往里吸的时候逆着走，别被拖到它身边",
	"squeeze": "脚下的红圈收紧之前走出去",
	"hoard": "金圈里的星星会被它吸走，先去捡，打掉它全吐出来",
	"sweep": "镜头扫过来时逆着它横穿过去，站着不动会被拍到",
	"redlight": "头顶亮黄灯就松手，红灯时动了要罚款",
}
## What each boss affix (Enemy.AFFIXES) does, for the 图鉴.
const AFFIX_NOTES := {
	"996": "移速 +30%，出招更勤",
	"thick": "血量 +50%，个头更大",
	"angry": "掉到一半血以下变红，更快、出招更勤",
	"heal": "3 秒没挨打就开始回血，别停手",
	"blame": "被打死时甩出 3 个小号的自己",
}
const WARNING_SECONDS := 3.5
## The year-end bonus chest rocks CHEST_SHAKES times (leaning CHEST_LEAN radians, a little more
## each swing) over about CHEST_SHAKE_SECONDS before it opens. By rating (绩效 B / A / S): the
## colour of its rays and stamp, and how many stars fly out.
const CHEST_SHAKES := 7
const CHEST_SHAKE_SECONDS := 0.9
const CHEST_LEAN := 0.12
const CHEST_ART_SIZE := 96.0
const CHEST_STAGE_HEIGHT := 128.0
const CHEST_RAYS := 12
const CHEST_RAY_TURN_SECONDS := 8.0
const CHEST_STAR_SIZE := 18.0
const CHEST_GLOW := [Color("dfe5ee"), Color("f7c948"), Color("ff9f1a")]
const CHEST_STARS := [0, 6, 14]
## Space kept around a screen that has to shrink to fit.
const FIT_MARGIN := 8.0
const RANKING_ROWS := 6
## How the last hit landed (Telemetry.last_hurt_how), for the result's 凶手 line.
const KILL_CAUSES := {"charge": "冲锋撞死", "bullet": "告警弹命中", "pie": "被饼砸中", "quake": "被宕机震飞", "sweep": "被监控抓拍", "redlight": "被罚款罚倒了", "heat": "被热晕了"}
## Settings-screen hint for each Tilt.state().
const TILT_HINTS := {
	"asking": "请在弹窗里允许访问动作与方向",
	"retry": "再点一下屏幕来授权",
	"denied": "没有权限：请在浏览器设置里允许动作与方向",
	"unsupported": "这台设备不支持",
}
## The cloud save's state on the settings and the 云存档 page, one per Cloud.Status.
const CLOUD_STATUS_TEXT := [
	"这个版本不连云端，进度只存在这台设备上",
	"正在连接…",
	"已同步",
	"没连上，进度先存在这台设备上，之后会自动补传",
	"已关闭，进度只存在这台设备上",
]
## Cloud.Redeem as cloud_action reports it (Telemetry).
const REDEEM_RESULTS := ["ok", "invalid", "not_found", "offline"]
## What entering a 存档码 came to, one per Cloud.Redeem.
const REDEEM_NOTES := [
	"找回了，两边的进度已经合并",
	"存档码是 12 位字母和数字，再核对一下",
	"没找到这个存档码",
	"没连上云端，稍后再试",
]

var game: Game

var _root: Control
var _top_bar: Control
var _xp_bar: ProgressBar
var _level_label: Label
var _time_label: Label
var _center_column: VBoxContainer
var _next_boss_pill: Control
var _next_boss_time: Label
## The map's weather while it lasts (the map's MAP_EVENT, .34): its name, seconds left, what to do.
var _weather_pill: Control
var _weather_time: Label
var _boss_bar: Control
var _boss_name: Label
var _boss_more: Label
var _boss_progress: ProgressBar
var _kills_label: Label
var _minimap: Minimap
var _district_label: Label
## The district's own icon beside its name (the map's DISTRICTS `icon`, .37).
var _district_icon: TextureRect
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
var _chest_shake: Tween
var _chest_revealed := false
## Opens the chest straight away (the button pressed while it still rocks).
var _chest_reveal := Callable()
var _chest_stage: Control
var _chest_art: TextureRect
var _chest_burst: Control
var _chest_stamp: Control
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
## The 打卡 · 成就 page (from the title screen), and which tab it shows.
var _collection_overlay: Control
var _collection_holder: Control
var _collection_open := false
var _collection_tab := 0
## The page's scrolling list, whose position a redraw of the same tab keeps.
var _collection_scroll: ScrollContainer
## The world map page (from the title screen, .34) and the card for the city picked on it.
var _world_overlay: Control
var _world_holder: Control
var _world_open := false
var _world_card: Control
var _departures: Departures
## The 云存档 page (from the settings), and its scrolling list.
var _save_overlay: Control
var _save_holder: Control
var _save_open := false
var _save_scroll: ScrollContainer
## The 云存档 page: what the last action on it came to (on a green or red strip at the top), whether
## one is still running (its buttons wait), and whether deleting is being asked about.
var _save_note := ""
var _save_note_ok := true
var _save_busy := false
var _confirm_delete := false
## A 存档码 is made the first time the view opens on a synced account; once per scene, so a failed
## try isn't repeated on every redraw.
var _code_requested := false
## The page's callback for a typed 存档码 (survivorsCode.ask), held until the page calls it.
var _code_callback: JavaScriptObject
## Where a computer build takes a 存档码 (the web asks in a field of the page's own).
var _code_field: LineEdit
## The banner for a landmark checked in at or an achievement earned, and the ones waiting.
var _badge: PanelContainer
var _badge_icon: TextureRect
var _badge_kicker: Label
var _badge_title: Label
var _badge_tween: Tween
var _badge_queue: Array = []
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
	_build_badge()
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
	_collection_overlay = _overlay(Art.PAPER_SOFT)
	_collection_holder = _full(_collection_overlay)
	_world_overlay = _overlay(Art.PAPER_SOFT)
	_world_holder = _full(_world_overlay)
	# Last, so it opens on top of the title or pause screen it was opened from.
	_settings_overlay = _overlay(Art.PAPER_SOFT)
	_settings_holder = _full(_settings_overlay)
	# Opened from the settings, over them.
	_save_overlay = _overlay(Art.PAPER_SOFT)
	_save_holder = _full(_save_overlay)
	_show_title()

	game.inventory_changed.connect(_refresh_inventory)
	game.level_up_offered.connect(_show_level_up)
	game.run_ended.connect(_show_end)
	game.announced.connect(_show_toast)
	game.chest_opened.connect(_show_chest)
	game.boss_move.connect(_on_boss_move)
	game.stamps.checked_in.connect(_on_checked_in)
	game.achievements.unlocked.connect(_on_achievement)
	if Cloud.shared() != null:
		Cloud.shared().changed.connect(_on_cloud_changed)


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
	# The level as a job grade: L12 (P12 on 北京). Every level-up is a promotion now (.33), and the
	# level-up panel says so, so there is no separate 晋升 banner any more.
	_level_label.text = Maps.rank_of(game.level)
	_time_label.text = _clock_text(game.elapsed)
	_kills_label.text = str(game.kills)
	_update_next_boss()
	_update_weather()
	_update_boss_bar()
	# The announcements drop in under whatever the centre column shows right now.
	_toast.offset_top = _center_column.position.y + _center_column.size.y + 6.0
	_badge.offset_top = _toast.offset_top + 34.0
	var district: String = Maps.current.district_of(Vector2i((game.player.position / City.BLOCK).floor()))
	if district != _district:
		_district = district
		_district_label.text = Maps.current.DISTRICTS[district]["name"]
		_district_icon.texture = Art.texture(Maps.current.DISTRICTS[district]["icon"])

	var hp_ratio := game.player.hp / game.player.max_hp
	var danger := clampf((LOW_HP_RATIO - hp_ratio) / LOW_HP_RATIO, 0.0, 1.0)
	# Low health keeps the edges pulsing; a hit just taken flashes them whatever the health.
	var glow := maxf(danger * (0.75 + 0.25 * sin(_clock * 6.0)), game.player.hurt_glow() * HURT_FLASH)
	_vignette.modulate.a = glow if game.state == Game.State.PLAYING else 0.0
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
		_save_open = false
	if state != Game.State.TITLE:
		_collection_open = false
		_world_open = false
	_collection_overlay.visible = _collection_open
	_world_overlay.visible = _world_open
	_settings_overlay.visible = _settings_open
	_save_overlay.visible = _save_open
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
	if _save_open:
		if key == KEY_ESCAPE:
			_close_save_page()
		return
	if _settings_open:
		if key == KEY_ESCAPE:
			_close_settings()
		return
	if _collection_open:
		if key == KEY_ESCAPE:
			_collection_open = false
		return
	if _world_open:
		if key == KEY_ESCAPE:
			_world_open = false
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
	# The title has a portrait and a landscape arrangement, and so have the departures.
	_show_title.call_deferred()
	if _world_open:
		_open_departures.call_deferred()


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
	_level_label = UiKit.label(Maps.rank_of(1), 11, "display")
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

	# 湾区地震 12 秒 · 躲开地上的红圈, for as long as the weather lasts (the user wanted it said on
	# screen, not only in the toast as it starts).
	_weather_pill = UiKit.panel(UiKit.box(Art.SKY_LIGHT, Art.LINK, UiKit.OUTLINE, UiKit.PILL, Vector4(8, 1, 8, 2)))
	_weather_pill.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_weather_pill.visible = false
	var weather_row := HBoxContainer.new()
	weather_row.add_theme_constant_override("separation", 4)
	weather_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_weather_pill.add_child(weather_row)
	var map_event: Dictionary = Maps.current.MAP_EVENT
	# The weather's own icon (.37): a quake's rock, rain, sand, fog.
	weather_row.add_child(UiKit.icon("event_" + map_event["id"], 13))
	weather_row.add_child(UiKit.label(map_event.get("name", ""), 10, "strong", Art.LINK))
	_weather_time = UiKit.label("", 10, "display", Art.LINK)
	weather_row.add_child(_weather_time)
	weather_row.add_child(UiKit.label("· " + tr(map_event.get("hint", "")), 10, "body", Art.INK_MUTED))
	_center_column.add_child(_weather_pill)

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
	var district := UiKit.panel(UiKit.box(Art.PAPER, Color.TRANSPARENT, 0, UiKit.PILL, Vector4(6, 1, 8, 1)))
	district.size_flags_horizontal = Control.SIZE_SHRINK_END
	var district_row := HBoxContainer.new()
	district_row.add_theme_constant_override("separation", 3)
	district_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	district.add_child(district_row)
	# The texture is set with the name, as the player walks from district to district.
	_district_icon = UiKit.icon("ui_info", 14)
	district_row.add_child(_district_icon)
	_district_label = UiKit.label("", 10, "strong")
	district_row.add_child(_district_label)
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


func _update_weather() -> void:
	var seconds_left := game.map_events.weather_left()
	_weather_pill.visible = seconds_left > 0.0
	if _weather_pill.visible:
		_weather_time.text = tr("%d 秒") % ceili(seconds_left)


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
	# With its affixes, so the bar says what this one does differently: 裁员通知 · 996.
	_boss_name.text = boss.display_name()
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
		_fill_slot(_weapon_slots[i], weapon.art if weapon else "", weapon.level if weapon else 0, Art.SKY_LIGHT, weapon != null and weapon.evolved,
			Upgrades.level_text(weapon, true) if weapon else "")
	var passive_ids := game.upgrades.passive_levels.keys()
	for i in SLOT_COUNT:
		var passive_id: String = passive_ids[i] if i < passive_ids.size() else ""
		var art: String = Upgrades.PASSIVES[passive_id]["art"] if passive_id != "" else ""
		_fill_slot(_passive_slots[i], art, game.upgrades.passive_levels.get(passive_id, 0), Art.MINT_LIGHT)


## A slot: the item's icon on its tint with the level on a small ink badge (a star once evolved,
## on yellow); empty, a faint square.
## `level_text` in place of the number when there is one: a job weapon's two directions, "2|3".
func _fill_slot(slot: Panel, art: String, item_level: int, fill: Color, evolved: bool = false, level_text: String = "") -> void:
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
	var text := "★" if evolved else (level_text if level_text != "" else str(item_level))
	# Wider for a job weapon's "2|3".
	var badge_width := 10.0 if text.length() <= 1 else 16.0
	badge.position = Vector2(SLOT_SIZE - badge_width + 3.0, SLOT_SIZE - 6.0)
	badge.size = Vector2(badge_width, 10)
	slot.add_child(badge)
	var number := UiKit.label(text, 7, "display", Art.INK if evolved else Art.PAPER)
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


## The banner for 局外成长 earned mid-run: a card under the announcements with a picture, a line
## saying what happened and the name. A landmark's comes down like a red stamp, slightly askew;
## an achievement's pops in gold. Several at once wait their turn.
func _build_badge() -> void:
	_badge = UiKit.panel(UiKit.box(Art.PAPER, Art.INK, UiKit.OUTLINE, UiKit.RADIUS_MD, Vector4(10, 6, 16, 6)))
	_badge.anchor_left = 0.5
	_badge.anchor_right = 0.5
	_badge.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_badge.modulate.a = 0.0
	_badge.resized.connect(func() -> void: _badge.pivot_offset = _badge.size / 2.0)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_badge.add_child(row)
	_badge_icon = UiKit.icon("star_gold", 34.0)
	row.add_child(_badge_icon)
	var lines := VBoxContainer.new()
	lines.add_theme_constant_override("separation", 0)
	lines.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(lines)
	_badge_kicker = UiKit.label("", 11, "strong")
	lines.add_child(_badge_kicker)
	_badge_title = UiKit.label("", 17, "heavy")
	lines.add_child(_badge_title)
	_root.add_child(_badge)


func _on_checked_in(id: String) -> void:
	var stamp: Dictionary = Maps.current.STAMPS[id]
	_queue_badge([stamp["art"], tr("打卡成功") + " · " + Stamps.bonus_text(id), tr(stamp["name"]), Art.HP_RED, true])


func _on_achievement(id: String) -> void:
	var entry := Achievements.data(id)
	# With its tier, in the tier's colour: 成就达成 · 黄金.
	var tier := Achievements.tier_of(id)
	_queue_badge([entry["art"], tr("成就达成") + " · " + tr(tier["name"]), tr(entry["name"]), tier["color"], false])


## `badge` is [art, line, name, colour, whether it's a stamp].
func _queue_badge(badge: Array) -> void:
	_badge_queue.append(badge)
	if _badge_tween == null or not _badge_tween.is_running():
		_next_badge()


func _next_badge() -> void:
	if _badge_queue.is_empty():
		return
	var badge: Array = _badge_queue.pop_front()
	var stamp: bool = badge[4]
	_badge_icon.texture = Art.texture(badge[0])
	_badge_kicker.text = badge[1]
	_badge_kicker.add_theme_color_override("font_color", badge[3])
	_badge_title.text = badge[2]
	_badge.add_theme_stylebox_override("panel", UiKit.box(Art.PAPER, badge[3] if stamp else Art.INK, UiKit.OUTLINE_HEAVY if stamp else UiKit.OUTLINE, UiKit.RADIUS_MD, Vector4(10, 6, 16, 6)))
	# Back to a zero-width anchor point, so the box regrows round the centre for the new text.
	_badge.offset_left = 0
	_badge.offset_right = 0
	_badge.rotation = -0.06 if stamp else 0.0
	_badge.scale = Vector2.ONE * (1.7 if stamp else 0.7)
	_badge.modulate.a = 0.0
	Sound.play("pick" if stamp else "level_up")
	_badge_tween = create_tween()
	if stamp:
		# Slammed down: big, then hard onto the page.
		_badge_tween.tween_property(_badge, "scale", Vector2.ONE, 0.16).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	else:
		_badge_tween.tween_property(_badge, "scale", Vector2.ONE, 0.2).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_badge_tween.parallel().tween_property(_badge, "modulate:a", 1.0, 0.08)
	_badge_tween.tween_interval(2.2)
	_badge_tween.tween_property(_badge, "modulate:a", 0.0, 0.4)
	_badge_tween.tween_callback(_next_badge)


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

	column.add_child(UiKit.kicker("BIG TECH SURVIVORS"))
	column.add_child(UiKit.gap(6))
	_title_heading = _heading("大厂幸存者", TITLE_SIZE if portrait else 40)
	column.add_child(_title_heading)
	var pitch := UiKit.label("躲开 Bug、会议和 Deadline\n撑过 10 分钟就能敲钟上市" if portrait else "躲开 Bug、会议和 Deadline，撑过 10 分钟就能敲钟上市！", 15 if portrait else 13)
	pitch.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	pitch.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	column.add_child(UiKit.gap(12 if portrait else 6))
	column.add_child(pitch)
	column.add_child(UiKit.gap(16 if portrait else 8))
	column.add_child(_job_picker(portrait))
	column.add_child(UiKit.gap(14 if portrait else 8))
	column.add_child(_map_button(portrait))
	if TestMode.on:
		column.add_child(UiKit.gap(8 if portrait else 4))
		column.add_child(_test_row())
	column.add_child(UiKit.gap(20 if portrait else 10))

	var start := UiKit.primary_button("开始搬砖", game.start_run, 56.0 if portrait else 48.0, 20)
	start.custom_minimum_size.x = 312.0 if portrait else 200.0
	start.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	var settings := _settings_button()
	settings.custom_minimum_size.x = 140.0 if portrait else 120.0
	settings.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	var collection := UiKit.secondary_button("收藏", _open_collection)
	collection.icon = Art.texture("star_gold")
	collection.add_theme_constant_override("icon_max_width", 18)
	collection.custom_minimum_size.x = 150.0 if portrait else 140.0
	if portrait:
		column.add_child(start)
		column.add_child(UiKit.gap(12))
		var more := HBoxContainer.new()
		more.alignment = BoxContainer.ALIGNMENT_CENTER
		more.add_theme_constant_override("separation", 12)
		more.add_child(collection)
		more.add_child(settings)
		column.add_child(more)
	else:
		var buttons := HBoxContainer.new()
		buttons.alignment = BoxContainer.ALIGNMENT_CENTER
		buttons.add_theme_constant_override("separation", 12)
		buttons.add_child(start)
		buttons.add_child(collection)
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


## The map in use, with its working week (how hard it is: 北京 · 996), on a button that opens the
## departures board to pick another (.38; .34–.37 a world map, before that a row of map tabs).
func _map_button(portrait: bool) -> Control:
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 8)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var label := UiKit.label("目的地", 13, "strong", Art.INK_MUTED)
	label.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(label)
	var button := UiKit.secondary_button("%s  ›" % Maps.label_of(Maps.current_id), _open_departures, 36.0, 14)
	button.icon = Art.texture("plane")
	button.add_theme_constant_override("icon_max_width", 28)
	button.custom_minimum_size.x = 240.0 if portrait else 220.0
	row.add_child(button)
	return row


## 测试模式 (TestMode, ?debug=1): which minute the run starts at, and invincibility.
func _test_row() -> Control:
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 8)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var label := UiKit.label("测试", 13, "strong", Art.BOSS_RED)
	label.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(label)
	var minutes := []
	for minute: int in TestMode.START_MINUTES:
		minutes.append("%d:00" % minute)
	var picker := UiKit.segmented(minutes, TestMode.START_MINUTES.find(TestMode.start_minute), func(index: int) -> void:
		TestMode.start_minute = TestMode.START_MINUTES[index]
		_show_title.call_deferred(), Art.PAPER_SUNK, 30.0)
	picker.custom_minimum_size.x = 220.0
	row.add_child(picker)
	row.add_child(UiKit.secondary_button(_god_text(), func() -> void:
		TestMode.god = not TestMode.god
		_show_title.call_deferred(), 30.0, 12))
	return row


func _god_text() -> String:
	return tr("无敌：开") if TestMode.god else tr("无敌：关")


## 测试模式's buttons on the pause screen: each resumes the run and then does its thing.
func _test_buttons() -> Control:
	var flow := HFlowContainer.new()
	flow.add_theme_constant_override("h_separation", 6)
	flow.add_theme_constant_override("v_separation", 6)
	var actions := [
		["天气", game.test_weather],
		["特邀 boss", game.spawner.bring_boss.bind(true)],
		["下个 boss", game.spawner.bring_boss.bind(false)],
		["升一级", game.test_level_up],
	]
	for entry: Array in actions:
		var action: Callable = entry[1]
		flow.add_child(UiKit.secondary_button(entry[0], func() -> void:
			game.set_paused(false)
			action.call(), 30.0, 12))
	flow.add_child(UiKit.secondary_button(_god_text(), func() -> void:
		TestMode.god = not TestMode.god
		_show_pause(), 30.0, 12))
	return flow


## The map picker (.38, the user's pick: an airport's departures board): the board listing every
## city by working week, and under it (beside it, held sideways) the boarding pass for the one
## picked, to begin with the map in use.
func _open_departures() -> void:
	_world_open = true
	_clear(_world_holder)
	var portrait := _is_portrait()
	var page := _page(Vector4(14, 16, 14, 14) if portrait else Vector4(20, 10, 20, 10))
	_world_holder.add_child(page)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 8 if portrait else 6)
	page.add_child(column)

	var header := HBoxContainer.new()
	header.add_theme_constant_override("separation", 8)
	column.add_child(header)
	header.add_child(UiKit.round_button("ui_back", func() -> void: _world_open = false, 40.0, Art.INK))
	var titles := VBoxContainer.new()
	titles.add_theme_constant_override("separation", 0)
	titles.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	header.add_child(titles)
	titles.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	titles.add_child(UiKit.label("选目的地", 20, "heavy"))
	# Wrapped, so the longer English line doesn't widen the page (which then shrinks to fit).
	var note := UiKit.label("按工时排，越往下越卷；通关一座城，下一座就能登机", 11, "muted")
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	titles.add_child(note)

	var body: BoxContainer = VBoxContainer.new() if portrait else HBoxContainer.new()
	body.add_theme_constant_override("separation", 8 if portrait else 10)
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(body)
	_departures = Departures.new()
	_departures.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_departures.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	_departures.city_picked.connect(_show_boarding_pass)
	body.add_child(_departures)
	_world_card = VBoxContainer.new()
	_world_card.add_theme_constant_override("separation", 6)
	_world_card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_world_card.custom_minimum_size.x = 0.0 if portrait else 250.0
	body.add_child(_world_card)
	_show_boarding_pass(Maps.current_id)
	_fit_to_screen(_world_holder)


## The boarding pass for the city picked on the departures board: the leg of the route into it
## (from the city before it), its working week, grade and difficulty, its weather and guest boss,
## its ten bosses, how far along the player is there, and 登机 if it is open (or what opens it, or
## that it is still to come).
func _show_boarding_pass(id: String) -> void:
	if not is_instance_valid(_world_card):
		return
	_clear(_world_card)
	var playable := Maps.ORDER.has(id)
	var card := UiKit.panel(UiKit.box(Art.PAPER, Art.INK, UiKit.OUTLINE, UiKit.RADIUS_MD, Vector4(12, 8, 12, 10)))
	card.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_world_card.add_child(card)
	var lines := VBoxContainer.new()
	lines.add_theme_constant_override("separation", 6)
	card.add_child(lines)

	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", 5)
	head.mouse_filter = Control.MOUSE_FILTER_IGNORE
	lines.add_child(head)
	head.add_child(UiKit.icon("plane", 14))
	var kicker := UiKit.kicker("BOARDING PASS", Art.INK_MUTED, 10)
	kicker.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	head.add_child(kicker)
	head.add_child(UiKit.label("登机牌", 11, "strong", Art.INK_MUTED))

	# From the city before it on the route to this one, over the map between them.
	var index := Maps.ROUTE.find(id)
	var from: String = Maps.ROUTE[index - 1] if index > 0 else ""
	var route := HBoxContainer.new()
	route.add_theme_constant_override("separation", 8)
	route.mouse_filter = Control.MOUSE_FILTER_IGNORE
	lines.add_child(route)
	route.add_child(_airport(from))
	var frame := UiKit.panel(UiKit.box(WorldMap.SEA, Art.INK, 2, 8, Vector4.ONE * 2.0))
	frame.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	route.add_child(frame)
	var strip := WorldMap.new()
	strip.from = from
	strip.to = id
	strip.custom_minimum_size = Vector2(0.0, 60.0)
	frame.add_child(strip)
	route.add_child(_airport(id))

	var facts := HFlowContainer.new()
	facts.add_theme_constant_override("h_separation", 10)
	facts.add_theme_constant_override("v_separation", 4)
	facts.mouse_filter = Control.MOUSE_FILTER_IGNORE
	lines.add_child(facts)
	facts.add_child(_pass_fact("", "工时", Departures.hours_of(id)))
	facts.add_child(_pass_fact("", "职级", "%s1" % Departures.rank_of(id)))
	if not playable:
		var later := UiKit.label("还在装修，下个版本见", 12, "muted")
		later.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		lines.add_child(later)
		return
	var map := Maps.script_of(id)
	var difficulty: Dictionary = map.DIFFICULTY
	facts.add_child(_pass_fact("", "难度", tr("基准") if difficulty["hp"] <= 1.0 else tr("生命 ×%s · 伤害 ×%s") % [difficulty["hp"], difficulty["damage"]]))
	var map_event: Dictionary = map.MAP_EVENT
	facts.add_child(_pass_fact("event_" + map_event["id"], "天气", tr(map_event["name"])))
	var guest: Dictionary = Spawner.ENEMY_TYPES[map.GUEST_BOSS["type"]]
	facts.add_child(_pass_fact(guest["art"], "特邀嘉宾", tr(guest["name"])))

	# The ten bosses it brings, each in its slot's place on the schedule.
	var bosses := HFlowContainer.new()
	bosses.add_theme_constant_override("h_separation", 2)
	bosses.add_theme_constant_override("v_separation", 2)
	bosses.mouse_filter = Control.MOUSE_FILTER_IGNORE
	lines.add_child(bosses)
	var caption := UiKit.label("boss", 10, "strong", Art.INK_MUTED)
	caption.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	bosses.add_child(caption)
	var shown := []
	for event: Dictionary in Spawner.EVENTS:
		if event["kind"] != "elite" or shown.has(event["type"]):
			continue
		shown.append(event["type"])
		var boss: String = map.BOSS_SWAPS.get(event["type"], event["type"])
		bosses.add_child(UiKit.icon(Spawner.ENEMY_TYPES[boss]["art"], 20))

	var progress := tr("打卡 %d/%d") % [Maps.stamps_on(id), map.STAMPS.size()]
	var wins := int((Progress.stat("map_wins", {}) as Dictionary).get(id, 0))
	if wins > 0:
		progress += " · " + tr("通关 %d 次") % wins
	lines.add_child(UiKit.label(progress, 12, "body"))
	lines.add_child(UiKit.filler())
	lines.add_child(_perforation())
	if not Maps.unlocked(id):
		var hint := UiKit.label(Maps.unlock_hint(id), 12, "strong", Art.BOSS_RED)
		hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		lines.add_child(hint)
		return
	var actions := HBoxContainer.new()
	actions.add_theme_constant_override("separation", 8)
	lines.add_child(actions)
	var board := UiKit.primary_button("登机", func() -> void: game.change_map(id, true), 44.0, 17)
	board.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	actions.add_child(board)
	if id != Maps.current_id:
		var switch := UiKit.secondary_button("只换地图", func() -> void: game.change_map(id), 44.0, 13)
		actions.add_child(switch)


## One end of the boarding pass's flight: the city's code over its name ("首站" with no code for
## the start of the route).
func _airport(id: String) -> Control:
	var block := VBoxContainer.new()
	block.add_theme_constant_override("separation", -2)
	block.mouse_filter = Control.MOUSE_FILTER_IGNORE
	block.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var code := UiKit.label(WorldMap.CITIES[id]["code"] if id != "" else "—", 20, "display")
	code.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
	code.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	block.add_child(code)
	var name := UiKit.label(WorldMap.CITIES[id]["name"] if id != "" else "首站", 10, "muted")
	name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	block.add_child(name)
	return block


## A line of the boarding pass: an optional icon, a grey caption and its value.
func _pass_fact(art: String, caption: String, value: String) -> Control:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 3)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(UiKit.label(caption, 10, "body", Art.INK_MUTED))
	if art != "":
		row.add_child(UiKit.icon(art, 16))
	row.add_child(UiKit.label(value, 11, "strong"))
	return row


## The dashed tear-off line above the boarding pass's stub.
func _perforation() -> Control:
	var line := Control.new()
	line.custom_minimum_size = Vector2(0.0, 6.0)
	line.mouse_filter = Control.MOUSE_FILTER_IGNORE
	line.draw.connect(func() -> void:
		var y := line.size.y / 2.0
		var x := 0.0
		while x < line.size.x:
			line.draw_line(Vector2(x, y), Vector2(minf(x + 5.0, line.size.x), y), Art.LINE_STRONG, 1.5)
			x += 9.0)
	return line


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
## screen (Big Tech Survivors on an upright phone).
func _fit_title() -> void:
	if _title_heading == null or not is_instance_valid(_title_heading) or _root.size.x <= 0.0:
		return
	var label: Label = _title_heading.get_child(1)
	var room := minf(_root.size.x - 40.0, 600.0)
	var width := Art.display_font(900).get_string_size(label.atr(label.text), HORIZONTAL_ALIGNMENT_LEFT, -1, TITLE_SIZE).x
	_size_heading(_title_heading, TITLE_SIZE if width <= room else floori(TITLE_SIZE * room / width))


# --- Level-up ------------------------------------------------------------------------------

## `lucky`: luck added a card (Upgrades.lucky_card), which the line under the title says, with the
## 锦鲤's koi, so players see what luck does. A level-up where the job's own weapon is due
## (Upgrades.JOB_WEAPON_LEVELS, its cards marked `milestone`) says so too, with that weapon.
func _show_level_up(choices: Array, lucky: bool = false) -> void:
	_clear(_cards_holder)
	var portrait := _is_portrait()
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 0)
	_cards_holder.add_child(column)

	column.add_child(UiKit.kicker("PROMOTED", Art.BRAND_SOFT))
	# Every level-up is a promotion to the next grade (.33). `game.level` already counts the
	# level-ups still banked, so name the one this panel is for.
	var title := UiKit.label(tr("升职！%s") % Maps.rank_of(game.level - game.queued_level_ups + 1), 28, "display", Art.PAPER)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(title)
	var sub_row := HBoxContainer.new()
	sub_row.alignment = BoxContainer.ALIGNMENT_CENTER
	sub_row.add_theme_constant_override("separation", 4)
	sub_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var milestone: Dictionary = {}
	for choice: Dictionary in choices:
		if choice.get("milestone", false):
			milestone = choice
			break
	if not milestone.is_empty():
		sub_row.add_child(UiKit.icon(milestone["art"], 18))
	if lucky:
		sub_row.add_child(UiKit.icon("koi", 18))
	var sub_text := "选一张带走"
	if not milestone.is_empty():
		sub_text = "专属武器升级，运气好还多一张！选一张带走" if lucky else "专属武器升级！选一张带走"
	elif lucky:
		sub_text = "运气好，多出一张！选一张带走"
	var standout := lucky or not milestone.is_empty()
	sub_row.add_child(UiKit.label(sub_text, 13, "heavy" if standout else "body", Art.BRAND if standout else Art.BRAND_SOFT))
	column.add_child(sub_row)
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
## does, on a hard shadow, with 推荐 on its corner. A card rarer than 普通 has a heavy outline in
## its rarity's colour (Art.RARITY_EDGE), a tag with the rarity's name and a line saying what it
## adds (Upgrades.rarity_line).
func _make_card(choice: Dictionary, index: int, portrait: bool, narrow: bool, crowded: bool) -> Button:
	var kind: String = choice["kind"]
	var level: int = choice["level"]
	var fresh := level == 1 and kind != "heal"
	var recommended: bool = choice.get("recommended", false)
	var rarity: int = choice.get("rarity", 0)
	var inset := 10.0 if crowded else 14.0
	var card := Button.new()
	card.custom_minimum_size = Vector2(minf(328.0, _root.size.x - 32.0), 0.0) if portrait \
		else Vector2(LEVEL_UP_CARD_MIN_WIDTH if narrow else 150.0, 0.0)
	var padding := Vector4.ONE * inset
	var normal := UiKit.box(Art.PAPER, Art.LINE, UiKit.OUTLINE, UiKit.RADIUS_CARD, padding)
	var hover := UiKit.box(Art.PAPER, Art.LINE_STRONG, UiKit.OUTLINE, UiKit.RADIUS_CARD, padding)
	if recommended:
		normal = UiKit.raised(Art.PAPER, UiKit.RADIUS_CARD, padding)
		hover = UiKit.raised(Art.PAPER_SOFT, UiKit.RADIUS_CARD, padding)
	elif rarity > 0:
		normal = UiKit.box(Art.PAPER, Art.RARITY_EDGE[rarity], UiKit.OUTLINE_HEAVY, UiKit.RADIUS_CARD, padding)
		hover = UiKit.box(Art.PAPER_SOFT, Art.RARITY_EDGE[rarity], UiKit.OUTLINE_HEAVY, UiKit.RADIUS_CARD, padding)
	card.add_theme_stylebox_override("normal", normal)
	card.add_theme_stylebox_override("hover", hover)
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
	elif choice.has("branch_level"):
		# A job weapon's direction card: that direction's own level (.35).
		badge = UiKit.level_dots(choice["branch_level"] - 1, Upgrades.BRANCH_MAX, true, 1)
	elif kind != "heal":
		# A rarer table perk jumps several levels at once (Upgrades.RARITIES `extra_levels`).
		badge = UiKit.level_dots(level - 1, choice["max"], true, choice.get("to_level", level) - level + 1)
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
	var rarity_text := Upgrades.rarity_line(choice)
	var rarity_label: Label = null
	if rarity_text != "":
		rarity_label = UiKit.label(rarity_text, 12 if portrait else 10, "heavy", Art.RARITY_INK[rarity])
		rarity_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART

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
		if rarity_label != null:
			text_column.add_child(rarity_label)
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
		if rarity_label != null:
			rarity_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			column.add_child(rarity_label)

	# The rarity's name on the top-left corner (推荐 takes the right one).
	if rarity > 0:
		var rarity_corner := UiKit.tag(Upgrades.RARITIES[rarity]["name"], Art.RARITY_FILL[rarity], Art.RARITY_INK[rarity], UiKit.OUTLINE, 12)
		rarity_corner.offset_left = 12
		rarity_corner.offset_top = -11
		card.add_child(rarity_corner)

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


# --- Year-end bonus ------------------------------------------------------------------------

## A boss's year-end bonus (年终奖): the chest rocks, quicker and quicker, then flies open on the
## rating Game rolled (绩效 B / A / S), with rays behind it and, for A and S, stars flying out;
## then the upgrades it brought appear one by one (Game has applied them already). `odds` are
## this chest's own chances, which luck and the boss's affixes move.
func _show_chest(funding_round: Dictionary, items: Array, odds: Array[float]) -> void:
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
		# Sideways the chest keeps a fixed width and the upgrades get the rest, for their names.
		head.custom_minimum_size = Vector2(240, 0)
	body.add_child(head)
	head.add_child(UiKit.kicker("YEAR-END BONUS"))
	var title := UiKit.label("年终奖开箱", 26, "heavy")
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	head.add_child(title)

	# The stage: the chest in the middle, its rays (hidden until it opens) behind, clipped to it.
	var landing := Game.FUNDING_ROUNDS.find(funding_round)
	_chest_stage = Control.new()
	_chest_stage.custom_minimum_size = Vector2(0, CHEST_STAGE_HEIGHT)
	_chest_stage.clip_contents = true
	_chest_stage.mouse_filter = Control.MOUSE_FILTER_IGNORE
	head.add_child(_chest_stage)
	_chest_burst = _burst(CHEST_GLOW[landing])
	_chest_stage.add_child(_chest_burst)
	var centre := CenterContainer.new()
	centre.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	centre.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_chest_stage.add_child(centre)
	_chest_art = UiKit.icon("chest", CHEST_ART_SIZE)
	# It rocks on its base rather than spinning round its middle.
	_chest_art.pivot_offset = Vector2(CHEST_ART_SIZE / 2.0, CHEST_ART_SIZE * 0.85)
	centre.add_child(_chest_art)
	# The rating, stamped on under the chest once it opens.
	_chest_stamp = UiKit.tag(funding_round["name"], CHEST_GLOW[landing], Art.INK, UiKit.OUTLINE_HEAVY, 20)
	_chest_stamp.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_chest_stamp.modulate.a = 0.0
	head.add_child(_chest_stamp)

	# What each rating gives and how likely it was for this chest, the one it landed on marked once
	# it opens.
	var chips := GridContainer.new()
	chips.columns = Game.FUNDING_ROUNDS.size()
	chips.add_theme_constant_override("h_separation", 6)
	chips.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for index in Game.FUNDING_ROUNDS.size():
		var option: Dictionary = Game.FUNDING_ROUNDS[index]
		var chip := UiKit.panel(UiKit.box(Art.PAPER_SUNK, Color.TRANSPARENT, 0, 10, Vector4(4, 5, 4, 5)))
		chip.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var chip_column := VBoxContainer.new()
		chip_column.add_theme_constant_override("separation", 0)
		chip_column.mouse_filter = Control.MOUSE_FILTER_IGNORE
		chip.add_child(chip_column)
		var round_name := UiKit.label(option["name"], 13, "strong")
		round_name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		chip_column.add_child(round_name)
		var chance := UiKit.label(tr("升 %d 样 · %d%%") % [option["items"], roundi(odds[index])], 11, "muted")
		chance.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		chip_column.add_child(chance)
		chips.add_child(chip)
		_odds_chips.append(chip)
	head.add_child(UiKit.gap(10))
	head.add_child(chips)

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
	_fit_to_screen(_chest_holder)

	# Swings each a little shorter and wider than the last, a tick on each, then it opens.
	_chest_reveal = _reveal_chest.bind(landing, result, prize, funding_round, items)
	_chest_shake = dialog.create_tween()
	var swing_seconds := CHEST_SHAKE_SECONDS / CHEST_SHAKES
	for i in CHEST_SHAKES:
		var lean := CHEST_LEAN * (1.0 + i * 0.15) * (1.0 if i % 2 == 0 else -1.0)
		_chest_shake.tween_property(_chest_art, "rotation", lean, swing_seconds * (1.5 - float(i) / CHEST_SHAKES)) \
			.set_trans(Tween.TRANS_SINE)
		_chest_shake.tween_callback(func() -> void: Sound.play("reel_tick"))
	_chest_shake.tween_property(_chest_art, "rotation", 0.0, 0.06)
	_chest_shake.tween_callback(_chest_reveal)


## Rays and a glow in `color` round the chest, shown when it opens (turning slowly).
func _burst(color: Color) -> Control:
	var burst := Control.new()
	burst.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	burst.mouse_filter = Control.MOUSE_FILTER_IGNORE
	burst.modulate.a = 0.0
	burst.resized.connect(func() -> void: burst.pivot_offset = burst.size / 2.0)
	burst.draw.connect(func() -> void:
		var middle := burst.size / 2.0
		# Ending inside the stage, so they make a round burst rather than a box cut off at its edges.
		var reach := minf(burst.size.x, burst.size.y) * 0.62
		var half_width := PI / CHEST_RAYS / 2.0
		for i in CHEST_RAYS:
			var angle := TAU * i / CHEST_RAYS
			burst.draw_colored_polygon(PackedVector2Array([middle, middle + Vector2.from_angle(angle - half_width) * reach,
				middle + Vector2.from_angle(angle + half_width) * reach]), Color(color, 0.45))
		burst.draw_circle(middle, CHEST_ART_SIZE * 0.45, Color(color, 0.7))
	)
	return burst


func _reveal_chest(landing: int, result: Label, prize: VBoxContainer, funding_round: Dictionary, items: Array) -> void:
	if _chest_revealed:
		return
	_chest_revealed = true
	if _chest_shake != null and _chest_shake.is_valid():
		_chest_shake.kill()
	# The lid flies open: the open chest pops, the rays come up behind it and turn.
	_chest_art.rotation = 0.0
	_chest_art.texture = Art.texture("chest_open")
	_chest_art.scale = Vector2.ONE * 1.25
	_chest_art.create_tween().tween_property(_chest_art, "scale", Vector2.ONE, 0.35) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_chest_burst.scale = Vector2.ONE * 0.5
	var glow := _chest_burst.create_tween().set_parallel()
	glow.tween_property(_chest_burst, "modulate:a", 1.0, 0.2)
	glow.tween_property(_chest_burst, "scale", Vector2.ONE, 0.35).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_chest_burst.create_tween().set_loops().tween_property(_chest_burst, "rotation", TAU, CHEST_RAY_TURN_SECONDS).from(0.0)
	for i in CHEST_STARS[landing]:
		_throw_star(TAU * i / CHEST_STARS[landing] + randf() * 0.4)
	_stamp_on(_chest_stamp)
	_odds_chips[landing].add_theme_stylebox_override("panel", UiKit.box(Art.BRAND_SOFT, Art.INK, UiKit.OUTLINE, 10, Vector4(4, 5, 4, 5)))
	result.text = tr("%s！白给 %d 样升级") % [tr(funding_round["name"]), items.size()]
	Sound.play("win" if funding_round["id"] == "ipo" else "payout")
	# The same upgrade twice in one chest is one row, from its first level to its last, in the
	# rarer of its two rarities.
	var rows: Array[Dictionary] = []
	var row_of := {}
	for item: Dictionary in items:
		# A job weapon's directions level up apart (.35): one row each, with that direction's level.
		var key: String = item["id"] + ":" + item.get("branch", "")
		var reached: int = item.get("branch_level", item.get("to_level", item["level"]))
		if row_of.has(key):
			var row_entry: Dictionary = rows[row_of[key]]
			row_entry["level"] = reached
			row_entry["rarity"] = maxi(row_entry.get("rarity", 0), item.get("rarity", 0))
		else:
			row_of[key] = rows.size()
			var entry := item.duplicate()
			entry["from"] = item.get("branch_level", item["level"]) - 1
			entry["level"] = reached
			rows.append(entry)
	for i in rows.size():
		var row := _prize_row(rows[i], _is_portrait())
		prize.add_child(row)
		# After the lid has come off.
		_pop_in(row, 0.3 + i * 0.12)
	_fit_to_screen(_chest_holder)


## A gold star flying out of the open chest at `angle`, fading as it goes.
func _throw_star(angle: float) -> void:
	var star := UiKit.icon("star_gold", CHEST_STAR_SIZE)
	var start := _chest_stage.size / 2.0 - Vector2.ONE * CHEST_STAR_SIZE / 2.0
	star.position = start
	_chest_stage.add_child(star)
	var flight := star.create_tween().set_parallel()
	flight.tween_property(star, "position", start + Vector2.from_angle(angle) * randf_range(60.0, 120.0), 0.6) \
		.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	flight.tween_property(star, "modulate:a", 0.0, 0.3).set_delay(0.35)
	flight.chain().tween_callback(star.queue_free)


## The rating coming down like a rubber stamp: big and faint, then pressed on at a slight tilt.
func _stamp_on(stamp: Control) -> void:
	stamp.pivot_offset = stamp.size / 2.0
	stamp.scale = Vector2.ONE * 1.8
	stamp.rotation = -0.15
	var press := stamp.create_tween().set_parallel()
	press.tween_property(stamp, "modulate:a", 1.0, 0.1)
	press.tween_property(stamp, "scale", Vector2.ONE, 0.25).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	press.tween_property(stamp, "rotation", -0.05, 0.25)


## One upgrade out of the chest: its icon, name, rarity and the level it went to.
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
	var rarity: int = item.get("rarity", 0)
	var fill := Art.MINT_LIGHT if kind == "passive" else Art.PINK_LIGHT if kind == "heal" else Art.BRAND_SOFT if kind == "evolve" else Art.SKY_LIGHT
	if kind == "evolve":
		row_panel.add_theme_stylebox_override("panel", UiKit.box(Art.BRAND_SOFT, Art.INK, UiKit.OUTLINE, UiKit.RADIUS_MD, Vector4(10, 6 if roomy else 3, 10, 6 if roomy else 3)))
	elif rarity > 0:
		# Outlined in its rarity's colour, as a level-up card would be.
		row_panel.add_theme_stylebox_override("panel", UiKit.box(Art.PAPER, Art.RARITY_EDGE[rarity], UiKit.OUTLINE_HEAVY, UiKit.RADIUS_MD, Vector4(10, 6 if roomy else 3, 10, 6 if roomy else 3)))
	row.add_child(UiKit.well(item["art"], 34 if roomy else 28, fill, UiKit.RADIUS_SM))
	var name_label := UiKit.label(_card_name(item), 14, "strong")
	name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	name_label.clip_text = true
	name_label.custom_minimum_size = Vector2(60, 0)
	row.add_child(name_label)
	if rarity > 0:
		row.add_child(UiKit.tag(Upgrades.RARITIES[rarity]["name"], Art.RARITY_FILL[rarity], Art.RARITY_INK[rarity]))
	var from: int = item.get("from", level - 1)
	var step := tr("回复 30") if kind == "heal" else tr("进化！") if kind == "evolve" else tr("新") if level == 1 and not item.has("branch") else "Lv %d → %d" % [from, level]
	row.add_child(UiKit.label(step, 12, "display", Art.LINK))
	return row_panel


## While the chest still rocks it opens it at once; after that it closes the dialog.
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
		weapon_chips.append([Upgrades.weapon_name(weapon.id, weapon.evolved), Upgrades.level_text(weapon), weapon.art, weapon.evolved])
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
		["护甲 · 回血", "%s · %s/s" % [Upgrades._amount_text(player.armor), Upgrades._amount_text(player.regen)]],
		["运气", str(roundi(player.luck))],
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
	if TestMode.on:
		actions.add_child(_test_buttons())

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
		# A level, or a job weapon's two directions already written out ("Lv 2 · 3").
		var level_text: String = "★" if entry[3] else (entry[1] if entry[1] is String else "Lv %d" % entry[1])
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
	for stat: Array in [["存活", _clock_text(game.elapsed)], ["职级", Maps.rank_of(game.level)], ["击杀", str(game.kills)]]:
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
	var earned := _earned_row()
	if earned != null:
		left.add_child(earned)
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


## What the run added to 局外成长, on gold: landmarks checked in at and achievements earned;
## null when nothing.
func _earned_row() -> Control:
	var parts := PackedStringArray()
	var stamp_names := PackedStringArray()
	for id in game.stamps.new_ids:
		stamp_names.append(tr(Maps.current.STAMPS[id]["name"]))
	if not stamp_names.is_empty():
		parts.append(tr("打卡 ") + "、".join(stamp_names))
	var achievement_names := PackedStringArray()
	for id in game.achievements.new_ids:
		achievement_names.append(tr(Achievements.data(id)["name"]))
	if not achievement_names.is_empty():
		parts.append(tr("成就 ") + "、".join(achievement_names))
	if parts.is_empty():
		return null
	var row := UiKit.panel(UiKit.box(Art.BRAND_SOFT, Color.TRANSPARENT, 0, UiKit.RADIUS_MD, Vector4(10, 6, 10, 6)))
	var line := HBoxContainer.new()
	line.add_theme_constant_override("separation", 8)
	line.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(line)
	line.add_child(UiKit.icon("star_gold", 18))
	var label := UiKit.label(tr("本局收获：") + " · ".join(parts), 12, "strong")
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	line.add_child(label)
	return row


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
	# The share funnel's first step; the page reports which of its buttons get used.
	Telemetry.send_event("share", {"action": "open", "where": "pause" if game.state != Game.State.ENDED else "end"})


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
	# The cloud save's state, and its own page (存档码, another device's code, deleting); not in a
	# build that doesn't use it.
	var cloud := Cloud.shared()
	if cloud != null and cloud.status != Cloud.Status.OFF:
		var manage := UiKit.secondary_button("管理存档", _open_save_page, 40.0)
		manage.icon = Art.texture("floppy")
		manage.add_theme_constant_override("icon_max_width", 18)
		manage.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
		general.append(_setting_row("云存档", "Cloud Save", manage, CLOUD_STATUS_TEXT[cloud.status]))
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


## The 收藏 page: every landmark (checked in at or still to find, with where it is and what it
## gives), every achievement (with progress for the counted ones) and the 图鉴, on three tabs.
func _open_collection(tab: int = -1) -> void:
	# Redrawn in place (the cloud bringing progress) it stays scrolled where it was.
	var kept_scroll := 0
	if _collection_open and (tab < 0 or tab == _collection_tab) and is_instance_valid(_collection_scroll):
		kept_scroll = _collection_scroll.scroll_vertical
	if tab >= 0:
		_collection_tab = tab
	_collection_open = true
	_clear(_collection_holder)
	var portrait := _is_portrait()
	var page := _page(Vector4(16, 20, 16, 16) if portrait else Vector4(24, 14, 24, 12))
	_collection_holder.add_child(page)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 12 if portrait else 8)
	page.add_child(column)

	var header := HBoxContainer.new()
	header.add_theme_constant_override("separation", 8)
	column.add_child(header)
	var back := UiKit.round_button("ui_back", func() -> void: _collection_open = false, 44.0, Art.INK)
	header.add_child(back)
	var title := UiKit.label("收藏", 22, "heavy")
	title.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(title)
	var stamped := 0
	for map_id: String in Maps.ORDER:
		stamped += Maps.stamps_on(map_id)
	# Only the achievements in play (a switched-off feature's one is hidden even if earned).
	var earned := Achievements.earned_count()
	var tabs := UiKit.segmented(["%s %d/%d" % [tr("打卡"), stamped, Maps.stamp_count()],
		"%s %d/%d" % [tr("成就"), earned, Achievements.shown().size()],
		"%s %d/%d" % [tr("图鉴"), Bestiary.seen_count(), Bestiary.ids().size()]], _collection_tab, _open_collection, Art.PAPER_SUNK)
	tabs.custom_minimum_size.x = 330.0
	if portrait:
		column.add_child(tabs)
	else:
		tabs.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		header.add_child(tabs)

	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	column.add_child(scroll)
	_collection_scroll = scroll
	if kept_scroll > 0:
		_scroll_after_layout(scroll, kept_scroll)
	var body := VBoxContainer.new()
	body.add_theme_constant_override("separation", 10)
	body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(body)
	match _collection_tab:
		0:
			_fill_stamps(body, portrait)
		1:
			_fill_achievements(body, portrait)
		_:
			_fill_bestiary(body, portrait)
	_focus(back)


func _fill_stamps(body: VBoxContainer, portrait: bool) -> void:
	var totals := Stamps.total_text()
	var summary := tr("走到地标跟前站 1 秒就能打卡，每个地标都送一点永久加成") if totals.is_empty() \
		else tr("已获得：") + "  ".join(totals)
	body.add_child(_collection_note(summary))
	# A section per map, the one in use first; a locked map's landmarks stay hidden behind what
	# opens it.
	var order: Array = Maps.ORDER.duplicate()
	order.erase(Maps.current_id)
	order.push_front(Maps.current_id)
	for map_id: String in order:
		var map := Maps.script_of(map_id)
		var stamps: Dictionary = map.STAMPS
		body.add_child(UiKit.label("%s %d/%d" % [tr(map.NAME), Maps.stamps_on(map_id), stamps.size()], 13, "strong", Art.INK_MUTED))
		if not Maps.unlocked(map_id):
			body.add_child(_collection_card("ui_info", tr("还没解锁"), [Maps.unlock_hint(map_id)], false, [], portrait))
			continue
		var grid := GridContainer.new()
		# One column on an upright phone: two squeeze the names and notes into a few characters a line.
		grid.columns = 1 if portrait else 3
		grid.add_theme_constant_override("h_separation", 8)
		grid.add_theme_constant_override("v_separation", 8)
		grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		body.add_child(grid)
		for id: String in stamps:
			var stamp: Dictionary = stamps[id]
			var done := Progress.has_stamp(id)
			var block: Vector2i = stamp["block"]
			var district := tr(map.DISTRICTS[map.district_of(block)]["name"])
			var where := tr("%s · %s 和 %s 路口") % [district, map.north_south_name(block.x, block.y), map.east_west_name(block.y + 1)]
			var lines := [tr(stamp["note"]) if done else where, (tr("已打卡 · ") if done else tr("打卡后 · ")) + Stamps.bonus_text(id)]
			grid.add_child(_collection_card(stamp["art"], tr(stamp["name"]), lines, done, [], portrait))


func _fill_achievements(body: VBoxContainer, portrait: bool) -> void:
	# The tiers at a glance, hardest first: 白金 0/3 · 黄金 1/8 · ...
	var tallies := PackedStringArray()
	for count: Array in Achievements.tier_counts():
		tallies.append("%s %d/%d" % [tr(Achievements.TIERS[count[0]]["name"]), count[1], count[2]])
	body.add_child(_collection_note(" · ".join(tallies)))
	for group: String in Achievements.GROUPS:
		# A plain label rather than a kicker: kickers stay Latin and untranslated, these are words.
		body.add_child(UiKit.label(group, 13, "strong", Art.INK_MUTED))
		var grid := GridContainer.new()
		grid.columns = 1 if portrait else 2
		grid.add_theme_constant_override("h_separation", 8)
		grid.add_theme_constant_override("v_separation", 8)
		grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		body.add_child(grid)
		for entry: Dictionary in Achievements.shown():
			if entry["group"] != group:
				continue
			var done := Progress.has_achievement(entry["id"])
			var counted := Achievements.progress(entry["id"])
			# With how many players have it, the way game stores show it.
			var lines := [tr(entry["text"]), Achievements.rate_text(entry["id"])]
			var tier := Achievements.tier_of(entry["id"])
			var badge := [tr(tier["name"]), tier["color"]]
			grid.add_child(_collection_card(entry["art"], tr(entry["name"]), lines, done, counted if not done else [], portrait, badge))


## The 怪物图鉴: each group's enemies, a silhouette until met; then what it is, its numbers (the
## regular ones; a boss's depend on when it comes), its move and how to dodge it, the maps it
## turns up on, and how many have been killed. Then the boss affixes, each once met.
func _fill_bestiary(body: VBoxContainer, portrait: bool) -> void:
	body.add_child(_collection_note(tr("遇到过的怪会收进图鉴；boss 每局可能多带招式和词条")))
	for group: Dictionary in Bestiary.GROUPS:
		body.add_child(UiKit.label(group["name"], 13, "strong", Art.INK_MUTED))
		var grid := GridContainer.new()
		grid.columns = 1 if portrait else 2
		grid.add_theme_constant_override("h_separation", 8)
		grid.add_theme_constant_override("v_separation", 8)
		grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		body.add_child(grid)
		for id: String in group["ids"]:
			var data: Dictionary = Spawner.ENEMY_TYPES[id]
			if not Bestiary.seen(id):
				grid.add_child(_collection_card(data["art"], "？？？", [tr("还没遇到")], false, [], portrait))
				continue
			var lines := [tr(Bestiary.NOTES[id])]
			if data.get("elite", false):
				var move: String = data.get("ability", "")
				lines.append(tr("招式：") + (tr(BOSS_MOVE_HINTS[move]) if BOSS_MOVE_HINTS.has(move) else tr("没有招式，只是血厚")))
				lines.append(tr("出现在：") + "、".join(Bestiary.maps_of(id)))
			else:
				lines.append(tr("生命 %d · 速度 %d · 伤害 %d") % [data["hp"], data["speed"], data["damage"]])
			lines.append(tr("累计击杀 %d") % Bestiary.kills(id))
			grid.add_child(_collection_card(data["art"], tr(data["name"]), lines, true, [], portrait))
	body.add_child(UiKit.label("boss 词条", 13, "strong", Art.INK_MUTED))
	var affixes := GridContainer.new()
	affixes.columns = 1 if portrait else 2
	affixes.add_theme_constant_override("h_separation", 8)
	affixes.add_theme_constant_override("v_separation", 8)
	affixes.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	body.add_child(affixes)
	for affix: String in Enemy.AFFIXES:
		var met := Bestiary.affix_seen(affix)
		affixes.add_child(_collection_card("star_gold", tr(Enemy.AFFIXES[affix]) if met else "？？？",
			[tr(AFFIX_NOTES[affix]) if met else tr("还没遇到")], met, [], portrait))


## The 云存档 page (Cloud), opened from the settings: whether the cloud save is on and synced, this
## account's 存档码 to copy, and on one row entering a code from another device and deleting the
## cloud save (asked twice).
func _open_save_page() -> void:
	# Redrawn in place (after an action, or the cloud's status changing) it stays scrolled where it
	# was; opened afresh, the last message and question are stale.
	var kept_scroll := 0
	if _save_open and is_instance_valid(_save_scroll):
		kept_scroll = _save_scroll.scroll_vertical
	else:
		_save_note = ""
		_confirm_delete = false
		Telemetry.send_event("cloud_action", {"action": "open", "status": Cloud.status_name()})
	_save_open = true
	_clear(_save_holder)
	var portrait := _is_portrait()
	var page := _page(Vector4(16, 20, 16, 16) if portrait else Vector4(24, 14, 24, 12))
	_save_holder.add_child(page)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 12 if portrait else 8)
	page.add_child(column)
	var header := HBoxContainer.new()
	header.add_theme_constant_override("separation", 8)
	column.add_child(header)
	var back := UiKit.round_button("ui_back", _close_save_page, 44.0, Art.INK)
	header.add_child(back)
	var title := UiKit.label("云存档", 22, "heavy")
	title.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	header.add_child(title)
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	column.add_child(scroll)
	_save_scroll = scroll
	if kept_scroll > 0:
		_scroll_after_layout(scroll, kept_scroll)
	var body := VBoxContainer.new()
	body.add_theme_constant_override("separation", 10)
	body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(body)
	_fill_save(body, portrait)
	_focus(back)


## Back to the settings, which show the status as it is now.
func _close_save_page() -> void:
	_save_open = false
	if _settings_open:
		_open_settings()


func _redraw_save_page() -> void:
	if _save_open:
		_open_save_page()


func _fill_save(body: VBoxContainer, portrait: bool) -> void:
	var cloud := Cloud.shared()
	var status: Cloud.Status = cloud.status if cloud != null else Cloud.Status.OFF
	body.add_child(_collection_note(tr("进度会自动存到云端。记下存档码，换手机或清了浏览器数据，都能用它找回")))
	if _save_note != "":
		var strip := UiKit.panel(UiKit.box(Art.MINT_LIGHT if _save_note_ok else Art.PINK_LIGHT, Color.TRANSPARENT, 0, UiKit.RADIUS_MD, Vector4(12, 8, 12, 8)))
		var message := UiKit.label(_save_note, 13, "strong", Art.GREEN_INK if _save_note_ok else Art.BOSS_RED)
		message.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		strip.add_child(message)
		body.add_child(strip)
	body.add_child(_collection_card("floppy", tr("云存档"), [tr(CLOUD_STATUS_TEXT[status])], status == Cloud.Status.SYNCED, [], portrait))
	if status == Cloud.Status.OFF:
		return
	var disabled := status == Cloud.Status.DISABLED
	if disabled:
		body.add_child(_save_buttons([_save_button("重新开启云存档", func() -> void:
			Telemetry.send_event("cloud_action", {"action": "enable"})
			cloud.enable())]))
	else:
		body.add_child(UiKit.label(tr("存档码"), 13, "strong", Art.INK_MUTED))
		var code_card := UiKit.panel(UiKit.box(Art.PAPER, Art.LINE, UiKit.OUTLINE, UiKit.RADIUS_CARD, Vector4(14, 12, 14, 12)))
		var code_column := VBoxContainer.new()
		code_column.add_theme_constant_override("separation", 10)
		code_card.add_child(code_column)
		body.add_child(code_card)
		if cloud.code != "":
			var shown := UiKit.label(Cloud.format_code(cloud.code), 26, "display")
			shown.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
			shown.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			code_column.add_child(shown)
			code_column.add_child(_save_buttons([_save_button("复制", _copy_code)]))
		else:
			var waiting := status == Cloud.Status.SYNCED and not _code_requested
			code_column.add_child(UiKit.label(tr("正在生成…") if waiting or _save_busy else tr("连上云端后才能拿到存档码"), 13, "muted"))
			if waiting:
				_make_code.call_deferred()

	# Entering another device's code and deleting on one row (deleting only while it's on).
	var actions: Array = []
	var field: LineEdit = null
	if OS.has_feature("web"):
		actions.append(_save_button("输入存档码", _ask_code))
	else:
		# A computer build has a keyboard and no page to ask in: the field is on the row.
		field = _code_entry()
		actions.append(_save_button("找回", func() -> void: _redeem_code(_code_field.text)))
	if not disabled and not _confirm_delete:
		actions.append(_save_button("删除云存档", func() -> void:
			_confirm_delete = true
			_open_save_page()
			# The question goes under the row, at the bottom: show all of it.
			_scroll_after_layout(_save_scroll, 1 << 20)))
	var row := _save_buttons(actions)
	if field != null:
		row.add_child(field)
		row.move_child(field, 0)
	body.add_child(row)
	var hint := UiKit.label(tr("换了设备？输入原来的存档码，两边的进度会合并到一起"), 12, "muted")
	hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	body.add_child(hint)

	if disabled or not _confirm_delete:
		return
	var confirm := UiKit.panel(UiKit.box(Art.PINK_LIGHT, Color.TRANSPARENT, 0, UiKit.RADIUS_MD, Vector4(12, 10, 12, 10)))
	var confirm_column := VBoxContainer.new()
	confirm_column.add_theme_constant_override("separation", 10)
	confirm.add_child(confirm_column)
	var warning := UiKit.label(tr("删除后，云端的存档和存档码都会作废，这台设备上的进度保留。确定吗？"), 13, "strong", Art.BOSS_RED)
	warning.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	confirm_column.add_child(warning)
	confirm_column.add_child(_save_buttons([_save_button("确定删除", _delete_cloud_save), _save_button("取消", func() -> void:
		_confirm_delete = false
		_open_save_page())]))
	body.add_child(confirm)


## The 存档码 field of a computer build.
func _code_entry() -> LineEdit:
	_code_field = LineEdit.new()
	_code_field.placeholder_text = "XXXX-XXXX-XXXX"
	_code_field.custom_minimum_size = Vector2(170, 40)
	_code_field.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_code_field.add_theme_stylebox_override("normal", UiKit.box(Art.PAPER_SUNK, Art.LINE_STRONG, UiKit.OUTLINE, UiKit.RADIUS_MD, Vector4(12, 0, 12, 0)))
	_code_field.add_theme_stylebox_override("focus", UiKit.box(Art.PAPER, Art.INK, UiKit.OUTLINE, UiKit.RADIUS_MD, Vector4(12, 0, 12, 0)))
	_code_field.add_theme_font_override("font", Art.display_font(900))
	_code_field.add_theme_font_size_override("font_size", 16)
	_code_field.add_theme_color_override("font_color", Art.INK)
	_code_field.add_theme_color_override("font_placeholder_color", Art.LINE_STRONG)
	_code_field.add_theme_color_override("caret_color", Art.INK)
	_code_field.text_submitted.connect(_redeem_code)
	return _code_field


## Scrolls once the new list has been laid out: before that it has no height to scroll into, and
## wrapped text settles over a few frames, so it's set again on each of them.
func _scroll_after_layout(scroll: ScrollContainer, scrolled_to: int) -> void:
	for i in 4:
		await get_tree().process_frame
		if not is_instance_valid(scroll):
			return
		scroll.scroll_vertical = scrolled_to


func _save_button(text: String, action: Callable) -> Button:
	var button := UiKit.secondary_button(text, action, 40.0)
	button.disabled = _save_busy
	return button


func _save_buttons(buttons: Array) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	for button: Button in buttons:
		row.add_child(button)
	return row


## Status changes (the settings and the 云存档 page show it), and progress another device added
## (the 收藏 page's counts, the title screen's map lock).
func _on_cloud_changed(progress_merged: bool) -> void:
	if progress_merged and game.state == Game.State.TITLE:
		_show_title()
	if _collection_open:
		_open_collection()
	if _save_open:
		_open_save_page()
	elif _settings_open:
		_open_settings()


## Runs one of the 云存档 page's actions (a Cloud coroutine) with the page's buttons waiting, and
## hands back what it returned.
func _save_action(action: Callable) -> Variant:
	_save_busy = true
	_redraw_save_page()
	var result: Variant = await action.call()
	_save_busy = false
	return result


func _set_save_note(text: String, ok: bool) -> void:
	_save_note = text
	_save_note_ok = ok
	_redraw_save_page()


func _make_code() -> void:
	if _code_requested or _save_busy:
		return
	_code_requested = true
	var made: String = await _save_action(Cloud.shared().ensure_code)
	Telemetry.send_event("cloud_action", {"action": "code", "result": "offline" if made.is_empty() else "ok"})
	if made.is_empty():
		_set_save_note(tr("没连上云端，稍后再试"), false)
	else:
		_redraw_save_page()


## On the web the page shows the code in a field of its own with a copy button: copying needs the
## tap itself, which the game only sees a frame later; and a long press on the field still copies
## where the browser won't (WeChat's).
func _copy_code() -> void:
	var shown := Cloud.format_code(Cloud.shared().code)
	Telemetry.send_event("cloud_action", {"action": "copy"})
	if OS.has_feature("web"):
		var page := JavaScriptBridge.get_interface("survivorsCode")
		if page != null:
			page.show(shown, tr("存档码"), tr("记在备忘录里，或者截个图。换设备时输入它就能找回进度"), tr("复制"), tr("已复制"), tr("长按上面的码就能复制"), tr("关闭"))
			return
	DisplayServer.clipboard_set(shown)
	_set_save_note(tr("已复制存档码"), true)


## The page asks for the code in a field of its own: the game's text fields don't bring up a
## phone's keyboard on the web.
func _ask_code() -> void:
	var page := JavaScriptBridge.get_interface("survivorsCode")
	if page == null:
		return
	_code_callback = JavaScriptBridge.create_callback(func(args: Array) -> void: _redeem_code(str(args[0])))
	page.ask(tr("输入存档码"), tr("另一台设备上「设置 → 云存档」里的 12 位码"), "XXXX-XXXX-XXXX", tr("找回"), tr("取消"), _code_callback)


func _redeem_code(text: String) -> void:
	if _save_busy:
		return
	# The account the device was on before, to tie it to the one it moves to (the event's account).
	var previous := Cloud.shared().account_id()
	var result: Cloud.Redeem = await _save_action(Cloud.shared().redeem.bind(text))
	Telemetry.send_event("cloud_action", {"action": "redeem", "result": REDEEM_RESULTS[result], "previous": previous})
	_set_save_note(tr(REDEEM_NOTES[result]), result == Cloud.Redeem.OK)


func _delete_cloud_save() -> void:
	_confirm_delete = false
	# Named here: deleting signs the device out, so the page no longer stamps it.
	var account := Cloud.shared().account_id()
	var deleted: bool = await _save_action(Cloud.shared().delete_account)
	Telemetry.send_event("cloud_action", {"action": "delete", "result": "ok" if deleted else "offline", "account": account})
	_set_save_note(tr("云存档已删除，这台设备上的进度还在") if deleted else tr("没连上云端，稍后再试"), deleted)


## A line of explanation on a soft blue panel at the top of a tab.
func _collection_note(text: String) -> Control:
	var note := UiKit.panel(UiKit.box(Art.SKY_LIGHT, Color.TRANSPARENT, 0, UiKit.RADIUS_MD, Vector4(12, 8, 12, 8)))
	var label := UiKit.label(text, 12)
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	note.add_child(label)
	return note


## One landmark or achievement: its picture in a well (a grey silhouette until earned), the
## name, a line or two, and a bar for counted progress ([done, goal], or empty).
func _collection_card(art: String, title: String, lines: Array, done: bool, counted: Array, portrait: bool, badge: Array = []) -> Control:
	var card := UiKit.panel(UiKit.box(Art.PAPER, Art.INK if done else Art.LINE, UiKit.OUTLINE, UiKit.RADIUS_CARD, Vector4(10, 8, 10, 8)))
	card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	card.add_child(row)
	var well := UiKit.well(art, 44.0 if portrait else 40.0, Art.BRAND_SOFT if done else Art.PAPER_SUNK)
	if not done:
		# A silhouette: what to look for, not what it looks like yet.
		well.get_child(0).get_child(0).modulate = Color(0, 0, 0, 0.18)
	row.add_child(well)
	var text := VBoxContainer.new()
	text.add_theme_constant_override("separation", 1)
	text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	text.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(text)
	var name_label := UiKit.label(title, 14, "strong", Art.INK if done else Art.INK_MUTED)
	# Wrapping, so a long name never makes the page wider than the screen.
	name_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	if badge.is_empty():
		text.add_child(name_label)
	else:
		# The name with a small tag after it: an achievement's tier, in its colour (faded until earned).
		var name_row := HBoxContainer.new()
		name_row.add_theme_constant_override("separation", 6)
		name_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
		name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		name_row.add_child(name_label)
		var colour: Color = badge[1]
		name_row.add_child(UiKit.tag(badge[0], colour if done else Color(colour, 0.35), Art.PAPER))
		text.add_child(name_row)
	for line: String in lines:
		var label := UiKit.label(line, 11, "muted")
		label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		text.add_child(label)
	if not counted.is_empty() and counted[1] > 0:
		var bar_row := HBoxContainer.new()
		bar_row.add_theme_constant_override("separation", 6)
		bar_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
		text.add_child(bar_row)
		var bar := _progress(Vector2(0, 6), Art.PAPER_SUNK, Art.BRAND)
		bar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		bar.value = float(counted[0]) / counted[1]
		bar_row.add_child(bar)
		var numbers := UiKit.label("%d/%d" % counted, 11, "strong", Art.INK_MUTED)
		numbers.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
		bar_row.add_child(numbers)
	return card


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
## outside the screen's own box (none does now; the old funding bag stuck up over its dialog). Wrapped text and fitted cards settle over a
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
	# Shrink round the screen's centre and put that on the view's (lower by half the overhang,
	# which then has the room above). A dialog's CenterContainer grows with it and keeps it centred,
	# so its centre is the holder's (the dialog's own position lags a frame behind as it re-sorts).
	# A full-page holder (_full) doesn't grow with a page taller than the view: shrinking round the
	# holder's centre pushed the page's bottom (the result page's buttons) off a short phone.
	var box := Rect2(Vector2.ZERO, holder.size) if holder is Container else Rect2(screen.position, screen.size)
	holder.pivot_offset = box.get_center()
	holder.position = _root.size / 2.0 - holder.pivot_offset + Vector2(0.0, overhang / 2.0)
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
