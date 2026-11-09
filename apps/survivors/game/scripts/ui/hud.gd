class_name Hud
extends CanvasLayer
## Screen-space UI, drawn after the design canvas 「硅谷幸存者 · 界面设计」: the HUD (upgrade slots,
## XP, clock, boss readouts, kills, district, joystick, hints) and the title, level-up, funding
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
## Rows of SLOT_COUNT built for weapons and for passives: enough for 无尽模式's every passive (0.3.24).
const SLOT_ROWS_MAX := 3
## The title screen's cast standing on a line: art, height, how high it hops from.
const TITLE_SIZE := 44
const LOW_HP_RATIO := 0.35
## How red the screen's edges flash for a hit just taken (of the low-health vignette's full red).
const HURT_FLASH := 0.6
const XP_BAR_SIZE := Vector2(96, 18)
## The boss bar sits under the clock; on an upright phone it must clear the buttons and the
## district on the right (the minimap was there too until .44).
const BOSS_BAR_WIDTH := 110.0
const BOSS_BAR_WIDTH_PORTRAIT := 80.0
## Level-up cards side by side when there are more than three of them (luck's extra card).
const LEVEL_UP_CARD_MIN_WIDTH := 112.0
## The next-boss countdown under the clock shows this many seconds ahead.
const NEXT_BOSS_WARNING := 20.0
## How long before Game.RUN_SECONDS the 离下班 countdown shows.
const CLEAR_WARNING := 30.0
## What a landmark checked in at again laid down (Stamps.checked_in's gift, MapObjects.PARCEL_LOOT).
const GIFT_NAMES := {"red_packet": "一个红包", "heal": "一杯珍珠奶茶", "magnet": "一块磁铁", "nap": "一次午休"}
## The landmark on the title screen's map button (_map_button), fitted inside this square.
const MAP_ICON := 26.0
## How long the 昵称 dialog waits after the last keystroke before asking the server (.97).
const NAME_CHECK_DELAY := 0.4
## The 大招 button's size (_build_ultimate_button).
## 40 since 0.1.0 (the user: 大招改小一点); 48 until then.
const ULTIMATE_SIZE := 40.0
## Room between the district over it and the 技能 button (0.1.1, the user: 大招位置稍微往下一点，和地图
## 名字靠太近了): on top of the column's own 6.
const ULTIMATE_GAP := 12.0
## How long the first-boss hint saying what the 大招 does stays up: longer than a toast, it's a
## sentence to read.
const ULTIMATE_HINT_SECONDS := 4.0
## Charged and waiting (0.3.25, the user: 技能满了后，一直闪，带电火花之类的闪): the button blinks this
## many times a second, a full ring round it, and ULTIMATE_SPARKS little bolts crackle off the ring,
## drawn anew every ULTIMATE_SPARK_SECONDS so they jump about.
const ULTIMATE_BLINK_HZ := 3.0
const ULTIMATE_SPARKS := 4
const ULTIMATE_SPARK_SECONDS := 0.08
const ULTIMATE_SPARK_COLOR := Color("8fe3ff")
## 加班's alarm lights (_build_overtime): their reach in from each side (a share of the width),
## strength and sweep speed (radians a second) by tier.
const ALARM_REACH := 0.32
const ALARM_START := 0.6
const ALARM_STEP := 0.1
const ALARM_SPEED := 3.0
const ALARM_SPEED_STEP := 1.0
const ALARM_SPEED_MAX := 8.0
## A first few runs show how to move until the player does, after this long standing still.
const MOVE_HINT_AFTER := 2.0
const MOVE_HINT_RUNS := 3
const WARNING_SECONDS := 3.5
## The year-end bonus opening (_show_chest, .46: about six seconds, the user's 五秒以上), beat by
## beat: the chest drops in (CHEST_DROP_SECONDS), rocks CHEST_SHAKES times over CHEST_SHAKE_SECONDS
## (leaning CHEST_LEAN radians, a little more each swing), builds up over CHEST_CHARGE_SECONDS in
## CHEST_CHARGE_BEATS jolts, bursts open, counts the 工资 up over CHEST_COUNT_SECONDS
## (CHEST_COUNT_TICKS ticks), flips the upgrade in and only then shows 收下.
const CHEST_DROP_SECONDS := 0.5
const CHEST_SHAKES := 12
const CHEST_SHAKE_SECONDS := 2.0
const CHEST_LEAN := 0.1
const CHEST_CHARGE_SECONDS := 1.5
const CHEST_CHARGE_BEATS := 15
const CHEST_COUNT_SECONDS := 1.0
const CHEST_COUNT_TICKS := 12
const CHEST_ART_SIZE := 96.0
const CHEST_STAGE_HEIGHT := 140.0
const CHEST_GLOW_RINGS := 5
const CHEST_RAYS := 12
const CHEST_RAY_TURN_SECONDS := 8.0
const CHEST_STAR_SIZE := 18.0
## Stars thrown out as it opens, by rating (绩效 C / B / A / S; S throws a second wave as many).
const CHEST_STARS := [6, 10, 16, 24]
## How wide the shine running across the upgrade's row is.
const CHEST_SHINE_WIDTH := 18.0
## A year-end bonus paying one of these 工资 amounts says so after it (Game.FUNDING_ROUNDS; 888's
## 发发发！ went with .63, when 666 became the most one pays).
const LUCKY_SALARIES := {666: "六六六！"}
## Space kept around a screen that has to shrink to fit.
const FIT_MARGIN := 8.0
const RANKING_ROWS := 6
## How the last hit landed (Telemetry.last_hurt_how), for the result's 凶手 line when the killer has
## no line of its own to say (a boss says its BossKits "kill" line instead).
const KILL_CAUSES := {"charge": "被冲过来撞倒", "bullet": "被子弹命中", "heat": "被热晕了"}
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
## 离下班 0:23 in the last CLEAR_WARNING seconds, then 清场中 · 剩 37 until the last enemy is down
## (.78: nothing new comes after Game.RUN_SECONDS; the user: 10:00 到了给个提示).
## The 大招 (Ultimates, .81): a round button with the job's face and the ultimate's name, top
## right under the pause button (.83, the user: 大招放上面，下面不好按; at the bottom right in
## .81-.82); grey while it charges (.95, kills fill it; grey once used before); and whether its
## first filling up has brought the hint up yet (the first boss did until .95).
var _ultimate_button: Button
var _ultimate_label: Label
var _ultimate_hinted := false
var _ultimate_job := ""
## While a 大招 lasts (.93): a gold ring round the button running down with it, and the label
## counting (无敌 3.2, 自己人 ×12). While it charges (.95): a pale ring filling up, and the label
## the share (63%).
var _ultimate_ring: Control
var _ultimate_ring_share := 0.0
var _ultimate_ring_color := Art.PAPER
## Charged and waiting (ULTIMATE_BLINK_HZ): the bolts drawn now, when they were made, and dice of
## their own so the game's (Game.rng) don't move with the HUD's frame rate.
var _ultimate_full := false
var _ultimate_sparks: Array[PackedVector2Array] = []
var _ultimate_sparks_at := -INF
var _spark_rng := RandomNumberGenerator.new()
## The cut-in playing while a 技能 is set off (0.1.1), freed when it is over.
var _cut_in: SkillCutIn
## The 出发 page's demo (Game.start_preview, 0.2.1): the view of the world under the job card, the
## camera in it that follows the player, and the stage over it the skill's cut-in plays on.
var _preview_camera: Camera2D
var _preview_stage: Control
## How large it is drawn on a phone held upright, and sideways (logical pixels).
const PREVIEW_SIZE := Vector2(312, 168)
const PREVIEW_SIZE_LANDSCAPE := Vector2(356, 132)
## How much of the world it shows: the game's own 1:1 (under 1 would zoom out; 0.8 left the
## people too small to make out on a phone).
const PREVIEW_ZOOM := 1.0
## The cut-in is built for the whole screen; in the view it plays this much smaller.
const PREVIEW_CUT_IN_SCALE := 0.55
## The top bar's right-hand column (kills and pause, the district), where the 大招 button sits.
var _top_right: VBoxContainer
var _clear_pill: Control
var _clear_label: Label
## The result screen's line about the clear-time board (.78): its rank, or a button to pick a 昵称.
var _board_row: VBoxContainer
## The 收藏 page's 排行榜 tab (.78): which map's board, and what came back for it.
var _board_map := ""
## The job whose board it shows (0.3.7), "" for the whole board.
var _board_job := ""
var _board_answer := {}
var _board_note := ""
## The map's weather while it lasts (the map's MAP_EVENT, .34): its name, seconds left, what to do.
var _weather_pill: Control
var _weather_time: Label
var _boss_bar: Control
var _boss_name: Label
var _boss_more: Label
var _boss_progress: ProgressBar
var _kills_label: Label
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
## 加班 (Game.overtime_tier, .78): a red alarm light sweeping the screen's left and right edges in
## turn, faster and brighter each tier (the user: 屏幕也可以变红; not darker, 屏幕不用变暗). Not
## the low-health vignette's red all round the edge, so the two don't read the same.
var _alarm_left: TextureRect
var _alarm_right: TextureRect
var _joystick: Joystick
var _touch_index := -1
var _title_overlay: Control
var _title_holder: Control
## The 出发 page (.96): over the home screen, still Game.State.TITLE.
var _depart_overlay: Control
var _depart_holder: Control
var _depart_open := false
## Open the 出发 page when the scene comes back (a map picked there with 只换地图 restarts the scene).
static var reopen_depart := false
var _title_heading: Control
var _level_up_overlay: Control
var _cards_holder: CenterContainer
var _chest_overlay: Control
var _chest_holder: CenterContainer
var _chest_revealed := false
var _chest_stage: Control
## Everything on the stage but the flash, moved as one when the chest jolts.
var _chest_shaker: Control
var _chest_art: TextureRect
## The light behind the chest and how it is drawn now (_glow); `target` is the colour it is
## turning to.
var _chest_glow: Control
var _chest_glow_power := 0.0
var _chest_glow_color := Color.WHITE
var _chest_glow_target := Color.WHITE
var _chest_flash: ColorRect
## The 工资 heading, counting up as it opens, and how many ticks the count has played.
var _chest_salary_label: Label
var _chest_count_ticks := 0
## The chest's 收下 button: there from the start so the dialog doesn't jump, but see-through and
## off until the opening has played out (.39, the user's call: it used to be live at once, and a
## tap mid-shake skipped straight to the end).
var _chest_take: Button
var _chest_burst: Control
var _chest_stamp: Control
## What each rating gives, under the chest (the one it landed on marked).
var _chest_chips: Array[PanelContainer] = []
var _pause_overlay: Control
var _pause_holder: CenterContainer
## The 培训 page (Training), opened from the title screen.
var _training_overlay: Control
var _training_holder: Control
var _training_open := false
var _training_scroll: ScrollContainer
## The revive dialog (Game.State.REVIVE), and the top bar's sign that this run has a 返聘 to spend.
var _revive_overlay: Control
var _revive_holder: CenterContainer
var _revive_pill: Control
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
## The clear-time boards (.78) on a page of their own (.89, the user: 排行榜单独拿出去，放不下了; a
## 收藏 tab .78–.88): opened from the home screen's 排行榜 tile (.96; the trophy by the map button
## .89–.95) and from the result screen's board line.
var _board_overlay: Control
var _board_holder: Control
var _board_open := false
var _collection_tab := 0
## Which page the collection overlay is (.96): "awards" (成就: 成就 and 打卡, from the home screen's
## tile) or "profile" (个人: 生涯, 战绩 and 图鉴, from its chip). One page, 收藏, until .96.
var _collection_kind := "awards"
## The page's scrolling list, whose position a redraw of the same tab keeps.
var _collection_scroll: ScrollContainer
## 战绩 opened to show their details (run ids), on the collection page's 战绩 tab.
var _history_open := {}
## The map picker page (from the title screen, .34) and the card for the city picked on it.
var _world_overlay: Control
var _world_holder: Control
var _world_open := false
var _world_card: Control
var _map_list: MapList
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
## 重置进度's questions on the 云存档 page: 0 none, 1 the warning, 2 the last confirmation.
var _confirm_reset := 0
## A 存档码 is made the first time the view opens on a synced account; once per scene, so a failed
## try isn't repeated on every redraw.
var _code_requested := false
## The page's callback for a typed 存档码 (survivorsCode.ask), held until the page calls it.
var _code_callback: JavaScriptObject
## Where a computer build takes a 存档码 (the web asks in a field of the page's own).
var _code_field: LineEdit
## The web page's 昵称 dialog calls back into this (kept, or the browser drops it).
var _name_callback: JavaScriptObject
## The web 昵称 dialog's check as the player types (.97), kept alive like _name_callback.
var _name_check_callback: JavaScriptObject
## The web page's 提意见 dialog (.94, survivorsCode.askText) calls back into this, kept the same way.
var _feedback_callback: JavaScriptObject
## The banner for a landmark checked in at or an achievement earned, and the ones waiting.
var _badge: PanelContainer
var _badge_icon: TextureRect
var _badge_kicker: Label
var _badge_title: Label
var _badge_tween: Tween
var _badge_queue: Array = []
var _badge_current: Array = []
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

	_build_overtime()
	_build_vignette()
	_joystick = Joystick.new()
	_joystick.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_joystick.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(_joystick)
	_build_top_bar()
	_build_ultimate_button()
	_build_toast()
	_build_badge()
	_build_bottom_hints()
	_title_overlay = _overlay(Art.PAPER_SOFT)
	_title_holder = _full(_title_overlay)
	_add_corner_version(_title_overlay)
	_depart_overlay = _overlay(Art.PAPER_SOFT)
	_depart_holder = _full(_depart_overlay)
	# Dialogs that pause play darken the world; the result and settings are pages of their own.
	_level_up_overlay = _overlay(Art.SCRIM)
	_cards_holder = _centered(_level_up_overlay)
	_chest_overlay = _overlay(Art.SCRIM)
	_chest_holder = _centered(_chest_overlay)
	_pause_overlay = _overlay(Art.SCRIM)
	_pause_holder = _centered(_pause_overlay)
	_add_corner_version(_pause_overlay)
	_revive_overlay = _overlay(Art.SCRIM)
	_revive_holder = _centered(_revive_overlay)
	_end_overlay = _overlay(Art.PAPER_SOFT)
	_end_holder = _full(_end_overlay)
	_add_corner_version(_end_overlay)
	_collection_overlay = _overlay(Art.PAPER_SOFT)
	_collection_holder = _full(_collection_overlay)
	_world_overlay = _overlay(Art.PAPER_SOFT)
	_world_holder = _full(_world_overlay)
	_training_overlay = _overlay(Art.PAPER_SOFT)
	_training_holder = _full(_training_overlay)
	_board_overlay = _overlay(Art.PAPER_SOFT)
	_board_holder = _full(_board_overlay)
	# Last, so it opens on top of the title or pause screen it was opened from.
	_settings_overlay = _overlay(Art.PAPER_SOFT)
	_settings_holder = _full(_settings_overlay)
	# Opened from the settings, over them.
	_save_overlay = _overlay(Art.PAPER_SOFT)
	_save_holder = _full(_save_overlay)
	_depart_open = reopen_depart
	reopen_depart = false
	_show_title()

	game.inventory_changed.connect(_refresh_inventory)
	game.level_up_offered.connect(_show_level_up)
	game.run_ended.connect(_show_end)
	game.announced.connect(_show_toast)
	game.chest_opened.connect(_show_chest)
	game.revive_offered.connect(_show_revive)
	game.boss_move.connect(_on_boss_move)
	game.stamps.checked_in.connect(_on_checked_in)
	game.stamps.opened.connect(_on_stamp_opened)
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
	_update_ultimate()
	_update_clear_pill()
	_update_weather()
	_update_boss_bar()
	# The announcements drop in under whatever the centre column shows right now.
	_toast.offset_top = _center_column.position.y + _center_column.size.y + 6.0
	_badge.offset_top = _toast.offset_top + 34.0
	# On a phone a wide banner would cover the 大招 button and its countdown (.93): below that
	# column then.
	var column := _top_right.get_global_rect()
	if _badge.get_global_rect().end.x > column.position.x - 4.0:
		_badge.offset_top = maxf(_badge.offset_top, column.end.y + 6.0)
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
	var dialog := game.state in [Game.State.PAUSED, Game.State.LEVEL_UP, Game.State.CHEST, Game.State.REVIVE]
	var last_minute := (playing or dialog) and game.elapsed >= Game.RUN_SECONDS - 60.0 and not game.endless
	Sound.set_mix(dialog, danger if playing else 0.0, last_minute, game.overtime_tier())
	_update_overtime()

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
	_revive_overlay.visible = state == Game.State.REVIVE
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
		_training_open = false
		_depart_open = false
	_depart_overlay.visible = _depart_open
	# The demo plays while the 出发 page is up, however it was opened (_open_depart, or back from
	# the map picker), and stops when it goes.
	if _depart_open and state == Game.State.TITLE:
		game.start_preview()
	elif game.previewing:
		game.stop_preview()
	if is_instance_valid(_preview_camera):
		_preview_camera.position = game.player.position
	if state != Game.State.TITLE and state != Game.State.ENDED:
		_board_open = false
	_board_overlay.visible = _board_open
	_collection_overlay.visible = _collection_open
	_world_overlay.visible = _world_open
	_training_overlay.visible = _training_open
	_settings_overlay.visible = _settings_open
	_save_overlay.visible = _save_open
	if _settings_open and _tilt_hint != null:
		# Why tilt steering can't work yet only matters while it's switched on.
		var tilt_state := Tilt.state()
		_tilt_hint.visible = Tilt.enabled() and TILT_HINTS.has(tilt_state)
		_tilt_hint.text = TILT_HINTS.get(tilt_state, "")
	if state != _shown_state:
		_shown_state = state
		# A 返聘 is earned in a chest and spent in the revive dialog, both left back into play.
		_revive_pill.visible = not game.revived and Progress.revives_left() > 0
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
	if _board_open:
		if key == KEY_ESCAPE:
			_board_open = false
		return
	if _collection_open:
		if key == KEY_ESCAPE:
			_collection_open = false
		return
	if _world_open:
		if key == KEY_ESCAPE:
			_world_open = false
		return
	if _training_open:
		if key == KEY_ESCAPE:
			_close_training()
		return
	if _depart_open:
		if key == KEY_ESCAPE:
			_close_depart()
		elif key == KEY_LEFT or key == KEY_A:
			_step_job(-1)
		elif key == KEY_RIGHT or key == KEY_D:
			_step_job(1)
		elif key == KEY_ENTER or key == KEY_KP_ENTER or key == KEY_SPACE:
			game.start_run()
		return
	match game.state:
		Game.State.TITLE:
			# Home: on to the 出发 page (.96; the run started from here before).
			if key == KEY_ENTER or key == KEY_KP_ENTER or key == KEY_SPACE:
				_open_depart()
		Game.State.PLAYING:
			if key == KEY_ESCAPE or key == KEY_P:
				game.set_paused(true)
			elif key == KEY_SPACE:
				game.ultimates.cast()
		Game.State.PAUSED:
			if key == KEY_ESCAPE or key == KEY_P:
				game.set_paused(false)
			elif key == KEY_R:
				game.restart()
		Game.State.LEVEL_UP:
			if key >= KEY_1 and key <= KEY_9:
				_pick(key - KEY_1)
			elif key == KEY_R:
				_reroll()
		Game.State.CHEST:
			if key == KEY_ENTER or key == KEY_KP_ENTER or key == KEY_SPACE:
				_on_chest_button()
		Game.State.REVIVE:
			# After PICK_DELAY_MS, like a level-up: keys pressed for dodging as the player died
			# mustn't decide for them.
			if Time.get_ticks_msec() < _accept_picks_at:
				return
			if key == KEY_ENTER or key == KEY_KP_ENTER or key == KEY_SPACE:
				game.accept_revive()
			elif key == KEY_ESCAPE:
				game.decline_revive()
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
	# The title has a portrait and a landscape arrangement, and so has the map picker.
	_show_title.call_deferred()
	if _world_open:
		_open_map_picker.call_deferred()
	if _training_open:
		_open_training.call_deferred()


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
	# As many slots as the run may carry, SLOT_COUNT a row: one row each, and in 无尽模式 (no limit,
	# 0.3.24) more rows that show once there is something to put in them (_refresh_inventory).
	for slot_list in [_weapon_slots, _passive_slots]:
		var grid := GridContainer.new()
		grid.columns = SLOT_COUNT
		grid.add_theme_constant_override("h_separation", 3)
		grid.add_theme_constant_override("v_separation", 3)
		grid.mouse_filter = Control.MOUSE_FILTER_IGNORE
		slots.add_child(grid)
		# Built for the most either can hold in 无尽模式 (13 passives, 11 weapons: three rows), whatever
		# the mode is now: the 出发 page can switch it after the HUD is up.
		for i in SLOT_COUNT * SLOT_ROWS_MAX:
			var slot := Panel.new()
			slot.custom_minimum_size = Vector2(SLOT_SIZE, SLOT_SIZE)
			slot.mouse_filter = Control.MOUSE_FILTER_IGNORE
			grid.add_child(slot)
			slot_list.append(slot)
			_fill_slot(slot, "", 0, Art.PAPER)
	# The whole map under the slots (0.1.0): left, so the 大招 button keeps its place on the right
	# (the user: 大招放原位，小地图放左边).
	var minimap := Minimap.new()
	minimap.game = game
	minimap.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	slots.add_child(minimap)

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

	_clear_pill = UiKit.panel(UiKit.box(Art.BRAND_SOFT, Art.INK, UiKit.OUTLINE, UiKit.PILL, Vector4(8, 1, 8, 2)))
	_clear_pill.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_clear_pill.visible = false
	_clear_label = UiKit.label("", 10, "strong", Art.INK)
	_clear_label.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
	_clear_pill.add_child(_clear_label)
	_center_column.add_child(_clear_pill)

	# 湾区地震 12 秒 · 躲开地上的红圈, for as long as the weather lasts (the user wanted it said on
	# screen, not only in the toast as it starts).
	_weather_pill = UiKit.panel(UiKit.box(Art.SKY_LIGHT, Art.LINK, UiKit.OUTLINE, UiKit.PILL, Vector4(8, 1, 8, 2)))
	_weather_pill.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_weather_pill.visible = false
	var weather_row := HBoxContainer.new()
	weather_row.add_theme_constant_override("separation", 4)
	weather_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_weather_pill.add_child(weather_row)
	# The run's weather, drawn from every map's (Spawner.weather, .99).
	var map_event: Dictionary = game.spawner.weather
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

	# Kills and the buttons, the district under them. (A minimap sat between them until .44: the
	# user found it too busy.)
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
	# A 返聘 this run can still spend: the badge says a death won't end it outright.
	_revive_pill = UiKit.panel(UiKit.box(Art.MINT_LIGHT, Art.INK, UiKit.OUTLINE, UiKit.PILL, Vector4(5, 2, 8, 2)))
	_revive_pill.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_revive_pill.visible = false
	var rehire_row := HBoxContainer.new()
	rehire_row.add_theme_constant_override("separation", 2)
	rehire_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_revive_pill.add_child(rehire_row)
	rehire_row.add_child(UiKit.icon("rehire", 14))
	rehire_row.add_child(UiKit.label("返聘", 10, "strong", Art.GREEN_INK))
	buttons.add_child(_revive_pill)
	buttons.add_child(kills)
	# Re-zeroes tilt steering mid-run, without pausing (resuming re-zeroes it anyway).
	_recalibrate_button = UiKit.round_button("phone_tilt", _recalibrate_tilt)
	buttons.add_child(_recalibrate_button)
	_pause_button = UiKit.round_button("pause", game.set_paused.bind(true))
	buttons.add_child(_pause_button)
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
	_top_right = right


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


func _build_ultimate_button() -> void:
	var holder := VBoxContainer.new()
	holder.add_theme_constant_override("separation", 2)
	holder.size_flags_horizontal = Control.SIZE_SHRINK_END
	holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	# In the holder, so it goes with the button when that is hidden.
	holder.add_child(UiKit.gap(ULTIMATE_GAP))
	_ultimate_button = UiKit.round_button(Jobs.data(game.player.job)["art"], game.ultimates.cast, ULTIMATE_SIZE)
	_ultimate_button.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	holder.add_child(_ultimate_button)
	_ultimate_ring = Control.new()
	_ultimate_ring.set_anchors_preset(Control.PRESET_FULL_RECT)
	_ultimate_ring.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_ultimate_ring.draw.connect(_draw_ultimate_ring)
	_ultimate_button.add_child(_ultimate_ring)
	game.ultimates.winding_up.connect(_play_cut_in)
	game.corner_cut_in.connect(_play_corner_cut_in)
	game.corner_hit.connect(_flash_corner)
	game.cut_in.connect(_play_game_cut_in)
	game.ultimates.went_off.connect(_on_ultimate_went_off)
	game.ultimates.charged.connect(_on_ultimate_charged)
	_ultimate_label = UiKit.label(Jobs.ultimate(game.player.job)["name"], 11, "strong", Art.INK)
	_ultimate_label.add_theme_constant_override("outline_size", 5)
	_ultimate_label.add_theme_color_override("font_outline_color", Art.PAPER)
	_ultimate_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	holder.add_child(_ultimate_label)
	_top_right.add_child(holder)


## Shown in play only; glowing while it can go off, grey while it charges.
func _update_ultimate() -> void:
	var playing := game.state == Game.State.PLAYING
	_ultimate_button.get_parent().visible = playing
	# Under the pause screen opened halfway through, it waits unseen (SkillCutIn).
	if is_instance_valid(_cut_in):
		_cut_in.visible = playing or game.previewing
	if not playing:
		return
	# The job picked on the title screen, after the button was built.
	if _ultimate_job != game.player.job:
		_ultimate_job = game.player.job
		_ultimate_button.icon = Art.texture(Jobs.data(_ultimate_job)["art"])
	var can_go := game.ultimates.ready()
	var ultimate := Jobs.ultimate(game.player.job)
	var left := game.ultimates.seconds_left()
	_ultimate_button.disabled = not can_go
	var full := can_go and left <= 0.0
	_ultimate_button.modulate = Color.WHITE.lerp(Color(1.5, 1.4, 1.1), _ultimate_blink()) if full \
		else Color.WHITE if left > 0.0 else Color(1, 1, 1, 0.45)
	# Redrawn every frame while charged (the ring blinks), and once more as that ends to clear it.
	if full:
		# _clock going back is a new run's HUD; either way the bolts are due.
		if _clock - _ultimate_sparks_at >= ULTIMATE_SPARK_SECONDS or _clock < _ultimate_sparks_at:
			_ultimate_sparks_at = _clock
			_make_ultimate_sparks()
		_ultimate_ring.queue_redraw()
	elif _ultimate_full:
		_ultimate_ring.queue_redraw()
	_ultimate_full = full
	# The gold ring runs down while one lasts; otherwise a pale one fills as kills charge it.
	var share := clampf(left / maxf(game.ultimates.duration(), 0.001), 0.0, 1.0) if left > 0.0 \
		else 0.0 if can_go else game.ultimates.charge_share()
	var ring_color := UltimateTimer.SHIELD_COLOR if left > 0.0 else Art.PAPER
	if share != _ultimate_ring_share or ring_color != _ultimate_ring_color:
		_ultimate_ring_share = share
		_ultimate_ring_color = ring_color
		_ultimate_ring.queue_redraw()
	if left > 0.0:
		_ultimate_label.text = "%s ×%d" % [tr(ultimate["timer"]), game.ultimates.allies()] if game.player.job == "data_scientist" \
			else UltimateTimer.count_text(ultimate["timer"], left)
	else:
		_ultimate_label.text = tr(ultimate["name"]) if can_go else "%d%%" % floori(game.ultimates.charge_share() * 100.0)


## The ring round the 大招 button, clockwise from the top: gold running down while it lasts, pale
## filling up while it charges.
func _draw_ultimate_ring() -> void:
	var middle := _ultimate_ring.size / 2.0
	var radius := ULTIMATE_SIZE / 2.0 + 1.0
	if _ultimate_full:
		_draw_ultimate_charged(middle, radius)
		return
	if _ultimate_ring_share <= 0.0:
		return
	_ultimate_ring.draw_arc(middle, radius, 0.0, TAU, 48, Art.INK, 6.0, true)
	_ultimate_ring.draw_arc(middle, radius, -PI / 2.0, -PI / 2.0 + TAU * _ultimate_ring_share, 48, _ultimate_ring_color, 4.0, true)


## 0 to 1 and back ULTIMATE_BLINK_HZ times a second: how bright the charged button is just now.
func _ultimate_blink() -> float:
	return 0.5 + 0.5 * sin(_clock * TAU * ULTIMATE_BLINK_HZ)


## Charged and waiting: a full ring blinking between gold and white, and the bolts round it, inked,
## with a white core and a spark where each ends.
func _draw_ultimate_charged(middle: Vector2, radius: float) -> void:
	var blink := _ultimate_blink()
	_ultimate_ring.draw_arc(middle, radius, 0.0, TAU, 48, Art.INK, 6.0 + 2.0 * blink, true)
	_ultimate_ring.draw_arc(middle, radius, 0.0, TAU, 48, Art.BRAND.lerp(Art.PAPER, blink), 4.0 + 2.0 * blink, true)
	for bolt in _ultimate_sparks:
		var points := PackedVector2Array()
		for point in bolt:
			points.append(middle + point)
		# An ink edge like everything else's, or pale blue is lost on the light ground.
		_ultimate_ring.draw_polyline(points, Art.INK, 4.5, true)
		_ultimate_ring.draw_polyline(points, ULTIMATE_SPARK_COLOR, 2.5, true)
		_ultimate_ring.draw_polyline(points, Art.PAPER, 1.0, true)
		_ultimate_ring.draw_circle(points[points.size() - 1], 1.8, Art.PAPER)


## New bolts (every ULTIMATE_SPARK_SECONDS): each starts on the ring somewhere random and zigzags
## out 8-14 px, its kinks pushed a few px either side of the way out.
func _make_ultimate_sparks() -> void:
	_ultimate_sparks.clear()
	var radius := ULTIMATE_SIZE / 2.0 + 1.0
	for i in ULTIMATE_SPARKS:
		var out := Vector2.from_angle(_spark_rng.randf() * TAU)
		var side := out.orthogonal()
		var length := _spark_rng.randf_range(8.0, 14.0)
		var kinks := _spark_rng.randi_range(2, 3)
		var bolt := PackedVector2Array([out * radius])
		for step in range(1, kinks + 1):
			var reach := radius + length * step / float(kinks + 1)
			bolt.append(out * reach + side * _spark_rng.randf_range(-3.5, 3.5))
		bolt.append(out * (radius + length))
		_ultimate_sparks.append(bolt)


## Full again (.95): 大招充好了 over the player each time, and the first time how to set it off and
## what it does (.93: the name alone told nobody anything; two lines, so it fits a phone).
func _on_ultimate_charged() -> void:
	Effects.callout(game, game.player.position + Vector2(0.0, -44.0), tr("技能充好了！"), Art.BRAND, 14)
	Sound.play("ultimate")
	if _ultimate_hinted:
		return
	_ultimate_hinted = true
	var ultimate := Jobs.ultimate(game.player.job)
	var where := tr("技能充好了：点右上角放「%s」") if Device.is_handheld() else tr("技能充好了：按空格放「%s」")
	_show_toast(where % tr(ultimate["name"]) + "\n" + tr(ultimate["brief"]), ULTIMATE_HINT_SECONDS)


## The screensaver's logo in a corner (Game.on_screensaver_corner, 0.3.15): a 技能's cut-in, its
## logo and words, as long as the game stands still for it.
func _play_corner_cut_in() -> void:
	_cut_in = SkillCutIn.new()
	_root.add_child(_cut_in)
	_cut_in.play_with(Upgrades.WEAPONS["screensaver"]["art"], tr("撞角了！"), tr("等了一整个屏保的时间"), _root.size, Game.CORNER_FREEZE)


## Every corner the screensaver hits (0.3.26): the whole screen flashes white, its blast being the
## whole screen. Under the HUD's dialogs, which a hit while one is open doesn't happen under anyway.
func _flash_corner() -> void:
	var flash := ColorRect.new()
	flash.color = Color(Color.WHITE, 0.5)
	flash.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	flash.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(flash)
	_root.move_child(flash, 0)
	# Real time: the corner's cut-in (Game.freeze) may stop the game meanwhile.
	var fade := flash.create_tween().set_ignore_time_scale()
	fade.tween_property(flash, "color:a", 0.0, 0.3)
	fade.tween_callback(flash.queue_free)


## A moment the game stops for (Game.play_cut_in: a year-end bonus about to open since 0.3.19; a boss
## coming, the clock-out, a clear, a meeting, the weather since 0.3.20).
func _play_game_cut_in(art: String, title: String, line: String) -> void:
	_cut_in = SkillCutIn.new()
	_root.add_child(_cut_in)
	_cut_in.play_with(art, title, line, _root.size, Game.CUT_IN_SECONDS)


## Set off (0.1.1): the cut-in over the HUD while the game stands still (SkillCutIn).
func _play_cut_in() -> void:
	_cut_in = SkillCutIn.new()
	# The 出发 page's demo plays it in its view, smaller, as if that were the screen.
	if game.previewing and is_instance_valid(_preview_stage):
		var holder := Control.new()
		holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
		holder.scale = Vector2.ONE * PREVIEW_CUT_IN_SCALE
		holder.size = _preview_stage.size / PREVIEW_CUT_IN_SCALE
		_preview_stage.add_child(holder)
		holder.add_child(_cut_in)
		_cut_in.tree_exited.connect(holder.queue_free)
		_cut_in.play(game.player.job, holder.size)
		return
	_root.add_child(_cut_in)
	_cut_in.play(game.player.job, _root.size)


## The banner as it goes off (.93): the job's face, 大招「name」 and what it does in a line, ahead
## of any landmark or achievement waiting.
func _on_ultimate_went_off() -> void:
	var ultimate := Jobs.ultimate(game.player.job)
	_queue_badge([Jobs.data(game.player.job)["art"], tr("技能「%s」") % tr(ultimate["name"]), tr(ultimate["brief"]), Art.BRAND_DEEP, false, ""], true)


func _update_clear_pill() -> void:
	var seconds_left := Game.RUN_SECONDS - game.elapsed
	# 无尽模式 has no 10:00 (0.3.0): no countdown to it, no 加班 after.
	_clear_pill.visible = seconds_left <= CLEAR_WARNING and not game.endless
	if not _clear_pill.visible:
		return
	# 0.3.29: 下班 is the win, and the run goes on (no clearing up any more).
	if seconds_left > 0.0:
		_clear_label.text = tr("离下班 %s · 撑到就算通关") % ("0:%02d" % ceili(seconds_left))
	else:
		_clear_label.text = tr("加班中 · 撑得越久排名越高")


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
	_boss_name.text = boss.display_name()
	_boss_more.text = "+%d" % others if others > 0 else ""
	_boss_more.visible = others > 0
	_boss_progress.value = maxf(boss.hp, 0.0) / boss.max_hp


func _recalibrate_tilt() -> void:
	Tilt.calibrate()
	_show_toast("已按现在的角度重新校准")


func _refresh_inventory() -> void:
	var weapons := game.player.weapons
	for i in _weapon_slots.size():
		var weapon: Weapon = weapons[i] if i < weapons.size() else null
		_fill_slot(_weapon_slots[i], weapon.art if weapon else "", weapon.level if weapon else 0, Art.SKY_LIGHT, weapon != null and weapon.evolved,
			Upgrades.level_text(weapon, true) if weapon else "")
		_weapon_slots[i].visible = i < _slots_shown(weapons.size())
	var passive_ids := game.upgrades.passive_levels.keys()
	for i in _passive_slots.size():
		var passive_id: String = passive_ids[i] if i < passive_ids.size() else ""
		var art: String = Upgrades.PASSIVES[passive_id]["art"] if passive_id != "" else ""
		_fill_slot(_passive_slots[i], art, game.upgrades.passive_levels.get(passive_id, 0), Art.MINT_LIGHT)
		_passive_slots[i].visible = i < _slots_shown(passive_ids.size())


## Slots shown for `count` things: full rows of SLOT_COUNT, one at least (0.3.24: 无尽模式 rows grow).
static func _slots_shown(count: int) -> int:
	return maxi(1, ceili(count / float(SLOT_COUNT))) * SLOT_COUNT


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
	# Centred: the 大招 hint runs to two lines (.93).
	_toast_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_toast.add_child(_toast_label)
	_root.add_child(_toast)


func _show_toast(text: String, hold := 1.8) -> void:
	_toast_label.text = text
	# Back to a zero-width anchor point, so the box regrows around the centre for the new text.
	_toast.offset_left = 0
	_toast.offset_right = 0
	_toast.modulate.a = 1.0
	_toast.scale = Vector2.ONE * 0.8
	if _toast_tween != null:
		_toast_tween.kill()
	_toast_tween = create_tween()
	# The HUD runs while paused, so without this a line said just before a level-up ran out unseen
	# behind the cards: it waits under the dialog and goes on after.
	_toast_tween.set_pause_mode(Tween.TWEEN_PAUSE_STOP)
	_toast_tween.tween_property(_toast, "scale", Vector2.ONE, 0.15).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_toast_tween.tween_interval(hold)
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


## The first time ever the bonus it brings for good; after that (0.3.0) the thing it laid down.
func _on_checked_in(id: String, first: bool, gift: String) -> void:
	var stamp: Dictionary = Maps.current.STAMPS[id]
	# The stars always come with it (0.3.11): 送你星星和一个红包.
	var line := Stamps.bonus_text(id) if first else tr("送你星星和%s") % tr(GIFT_NAMES.get(gift, ""))
	_queue_badge([stamp["art"], tr("打卡成功") + " · " + line, tr(stamp["name"]), Art.HP_RED, true])


## A landmark opening: a banner (its picture, 开门了 · 去打卡 in the rings' yellow, its name) rather
## than an announcement, which anything picked up a moment later used to replace.
func _on_stamp_opened(id: String) -> void:
	var stamp: Dictionary = Maps.current.STAMPS[id]
	_queue_badge([stamp["art"], tr("开门了 · 去打卡"), tr(stamp["name"]), Art.BRAND_DEEP, false, "alarm"])


func _on_achievement(id: String) -> void:
	var entry := Achievements.data(id)
	# With its tier, in the tier's colour: 成就达成 · 黄金.
	var tier := Achievements.tier_of(id)
	# And the 工资 it paid (.96): 成就达成 · 黄金 · ¥800.
	_queue_badge([entry["art"], tr("成就达成") + " · " + tr(tier["name"]) + " · ¥%d" % Achievements.prize_of(id), tr(entry["name"]), tier["color"], false])


## `badge` is [art, line, name, colour, whether it's a stamp, and optionally the sound ("" for none)].
## `urgent` (the 大招's, .93) goes up now: whatever was showing goes back to the front of the
## queue to show again after it.
func _queue_badge(badge: Array, urgent := false) -> void:
	var showing := _badge_tween != null and _badge_tween.is_running()
	if not urgent:
		_badge_queue.append(badge)
		if not showing:
			_next_badge()
		return
	if showing:
		_badge_tween.kill()
		_badge_queue.push_front(_badge_current)
	_badge_queue.push_front(badge)
	_next_badge()


func _next_badge() -> void:
	if _badge_queue.is_empty():
		return
	var badge: Array = _badge_queue.pop_front()
	_badge_current = badge
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
	# A sixth entry overrides the sound; "" for none (the 大招 has its own).
	var sound: String = badge[5] if badge.size() > 5 else ("pick" if stamp else "level_up")
	if sound != "":
		Sound.play(sound)
	_badge_tween = create_tween()
	# Held still under a dialog (level-up, chest, pause), as the announcements are.
	_badge_tween.set_pause_mode(Tween.TWEEN_PAUSE_STOP)
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
	if _warned.has(ability) or not BossKits.HINTS.has(ability):
		return
	_warned[ability] = true
	_warning_label.text = BossKits.HINTS[ability]
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


## The 加班 overlay (see _alarm_left): an alarm light on each side.
func _build_overtime() -> void:
	_alarm_left = _alarm_side(Vector2(0.0, 0.5), Vector2(ALARM_REACH, 0.5))
	_alarm_right = _alarm_side(Vector2(1.0, 0.5), Vector2(1.0 - ALARM_REACH, 0.5))


func _alarm_side(edge: Vector2, inner: Vector2) -> TextureRect:
	var gradient := Gradient.new()
	gradient.colors = PackedColorArray([Color(Art.BOSS_RED, 0.9), Color(Art.BOSS_RED, 0.0)])
	var texture := GradientTexture2D.new()
	texture.gradient = gradient
	texture.fill_from = edge
	texture.fill_to = inner
	var side := TextureRect.new()
	side.texture = texture
	side.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	side.stretch_mode = TextureRect.STRETCH_SCALE
	side.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	side.mouse_filter = Control.MOUSE_FILTER_IGNORE
	side.modulate.a = 0.0
	_root.add_child(side)
	return side


## The overlay, the red clock and its pulse, by tier; nothing outside play.
func _update_overtime() -> void:
	var tier := game.overtime_tier() if game.state != Game.State.TITLE and game.state != Game.State.ENDED else 0
	if tier == 0:
		_alarm_left.modulate.a = 0.0
		_alarm_right.modulate.a = 0.0
		_time_label.remove_theme_color_override("font_color")
		_time_label.scale = Vector2.ONE
		return
	var step := tier - 1
	var strength := minf(ALARM_START + ALARM_STEP * step, 1.0)
	var sweep := sin(_clock * minf(ALARM_SPEED + ALARM_SPEED_STEP * step, ALARM_SPEED_MAX))
	_alarm_left.modulate.a = strength * (0.5 + 0.5 * sweep)
	_alarm_right.modulate.a = strength * (0.5 - 0.5 * sweep)
	_time_label.add_theme_color_override("font_color", Art.BOSS_RED)
	_time_label.pivot_offset = _time_label.size / 2.0
	_time_label.scale = Vector2.ONE * (1.0 + 0.08 * maxf(0.0, sin(_clock * 6.0)))


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

## The home screen (.96, the user: 点击开始游戏后，再选择职业; 战绩拿出来放首页，首页重新整理下; 做个个人页
## …入口放首页，打卡和成就放一起，单独一个入口): the 个人 chip (top left) and 设置 (top right), the name,
## 开始搬砖 (to the 出发 page, where the job and the map are picked), and three tiles for what to come
## back to: 培训 (工资 to spend), 成就 (打卡 too) and 排行榜. Until .96 the jobs, the map, 培训 / 收藏 /
## 设置 buttons and a two-line pitch were all on it.
func _show_title() -> void:
	_clear(_title_holder)
	var portrait := _is_portrait()
	# Two soft circles behind everything, as in the design.
	_title_holder.add_child(_blob(Art.FILL_SKY, 0.45, 140.0, Vector2(-40.0, 120.0), false))
	_title_holder.add_child(_blob(Art.FILL_MINT, 0.5, 120.0, Vector2(-50.0, 40.0), true))

	var page := _page(Vector4(16, 16, 16, 24) if portrait else Vector4(24, 12, 24, 14))
	_title_holder.add_child(page)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 0)
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	page.add_child(column)

	var corners := HBoxContainer.new()
	corners.add_theme_constant_override("separation", 8)
	corners.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(corners)
	corners.add_child(_profile_chip())
	corners.add_child(UiKit.filler())
	var settings := UiKit.round_button("gear", _open_settings, 44.0)
	settings.tooltip_text = tr("设置")
	corners.add_child(settings)

	# The name and the buttons sit in the middle of what's left, a little above it.
	column.add_child(UiKit.filler())
	# No kicker over the name (.98, the user: 上面那个灰色中英文版本都去掉吧): in English it said the
	# same thing twice.
	_title_heading = _heading("大厂幸存者", TITLE_SIZE if portrait else 40)
	column.add_child(_title_heading)
	column.add_child(UiKit.gap(40 if portrait else 18))

	var start := UiKit.primary_button("开始搬砖", _open_depart, 60.0 if portrait else 50.0, 21)
	start.custom_minimum_size.x = 312.0 if portrait else 300.0
	start.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	column.add_child(start)
	column.add_child(UiKit.gap(18 if portrait else 12))

	var tiles := HBoxContainer.new()
	tiles.alignment = BoxContainer.ALIGNMENT_CENTER
	tiles.add_theme_constant_override("separation", 8)
	tiles.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(tiles)
	var tile_width := 98.0 if portrait else 96.0
	# 培训 (.44): where year-end bonuses' and achievements' 工资 is spent on the base stats.
	tiles.add_child(_home_tile("moneybag", "培训", tr("工资 ¥%d") % maxi(Training.balance(), 0), _open_training, tile_width))
	tiles.add_child(_home_tile("star_gold", "成就", "%d/%d" % [Achievements.earned_count(), Achievements.shown().size()], _open_awards, tile_width))
	# One board while only 硅谷 is on offer (.99), so not 每图一个榜.
	var board_status := tr("每图一个榜") if Maps.ORDER.size() > 1 else tr("比谁通关快")
	tiles.add_child(_home_tile("icon_trophy", "排行榜", board_status, _open_board, tile_width))
	if TestMode.on:
		column.add_child(UiKit.gap(8 if portrait else 4))
		column.add_child(_test_row())
	var below := UiKit.filler()
	below.size_flags_stretch_ratio = 1.4
	column.add_child(below)
	# Rebuilt on every orientation change, mid-run too, when the title is hidden; and twice in a
	# frame can happen, so only a start button still on screen takes the focus.
	if game.state == Game.State.TITLE:
		(func() -> void:
			if is_instance_valid(start) and start.is_inside_tree() and not _depart_open:
				_focus(start)).call_deferred()
	_fit_title()
	if _depart_open:
		_open_depart()


## The home screen's way into the 个人 page: the job's face, the 昵称 (or 我的 without one) and ›.
func _profile_chip() -> Button:
	var chip := UiKit.secondary_button("", _open_profile, 44.0, 14)
	var cloud := Cloud.shared()
	var shown_name := cloud.display_name if cloud != null and cloud.display_name != "" else tr("我的")
	var content := HBoxContainer.new()
	content.add_theme_constant_override("separation", 6)
	content.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	content.offset_left = 6
	content.offset_right = -12
	content.mouse_filter = Control.MOUSE_FILTER_IGNORE
	content.add_child(UiKit.icon(Jobs.data(game.player.job)["art"], 30))
	var label := UiKit.label(shown_name + "  ›", 14, "strong", Art.INK)
	label.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
	label.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	content.add_child(label)
	chip.add_child(content)
	# Wide enough for the face and the name: the button doesn't size itself to a child.
	chip.custom_minimum_size.x = 30.0 + 6.0 + 18.0 + Art.font(700).get_string_size(shown_name + "  ›", HORIZONTAL_ALIGNMENT_LEFT, -1, 14).x
	chip.tooltip_text = tr("个人")
	return chip


## A home-screen tile: an icon, its name and one line of where things stand (工资 ¥23000, 9/28).
func _home_tile(art: String, title: String, status: String, action: Callable, width: float) -> Button:
	var tile := Button.new()
	tile.custom_minimum_size = Vector2(width, 92.0)
	tile.focus_mode = Control.FOCUS_ALL
	tile.add_theme_stylebox_override("normal", UiKit.box(Art.PAPER, Art.INK, UiKit.OUTLINE, UiKit.RADIUS_CARD))
	tile.add_theme_stylebox_override("hover", UiKit.box(Art.PAPER_SUNK, Art.INK, UiKit.OUTLINE, UiKit.RADIUS_CARD))
	tile.add_theme_stylebox_override("pressed", UiKit.box(Art.LINE, Art.INK, UiKit.OUTLINE, UiKit.RADIUS_CARD))
	tile.add_theme_stylebox_override("focus", UiKit.focus_ring(UiKit.RADIUS_CARD))
	tile.pressed.connect(action)
	tile.pressed.connect(func() -> void: Sound.play("click"))
	var content := VBoxContainer.new()
	content.alignment = BoxContainer.ALIGNMENT_CENTER
	content.add_theme_constant_override("separation", 2)
	content.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	content.mouse_filter = Control.MOUSE_FILTER_IGNORE
	tile.add_child(content)
	var icon := UiKit.icon(art, 30)
	icon.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	content.add_child(icon)
	# Smaller when the name doesn't fit the tile (English Achievements ran past its edges).
	var shown_title := tr(title)
	var title_size := 14
	while title_size > 10 and Art.font(900).get_string_size(shown_title, HORIZONTAL_ALIGNMENT_LEFT, -1, title_size).x > width - 12.0:
		title_size -= 1
	var name_label := UiKit.label(title, title_size, "heavy", Art.INK)
	name_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	content.add_child(name_label)
	var status_label := UiKit.label(status, 11, "muted")
	status_label.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
	status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	status_label.clip_text = true
	content.add_child(status_label)
	return tile


## The 出发 page's 普通 / 无尽 switch (Game.set_endless, 0.2.0) and a line on what the picked one is.
func _mode_picker(portrait: bool) -> Control:
	var holder := VBoxContainer.new()
	holder.add_theme_constant_override("separation", 4)
	holder.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	holder.custom_minimum_size.x = 312.0 if portrait else 300.0
	var note := UiKit.label(_mode_note(game.endless), 12, "muted")
	note.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	holder.add_child(UiKit.segmented([tr("普通模式"), tr("无尽模式")], 1 if game.endless else 0, func(index: int) -> void:
		game.set_endless(index == 1)
		note.text = tr(_mode_note(index == 1)), Art.PAPER_SUNK, 34.0))
	holder.add_child(note)
	return holder


func _mode_note(endless: bool) -> String:
	return "怪一直越来越多，打到倒下为止，比谁撑得久" if endless else "撑到 10:00 下班，清完场上的怪才算通关"


## The 出发 page (.96), from 开始搬砖: the five jobs and the picked one's card, the map (its picker
## opens over this page and, picking 只换地图, comes back to it), the 返聘 saved, and 上班 to start.
## The title state still: closing it goes back home.
func _open_depart() -> void:
	if game.state != Game.State.TITLE:
		return
	_depart_open = true
	_clear(_depart_holder)
	var portrait := _is_portrait()
	var page := _page(Vector4(16, 20, 16, 24) if portrait else Vector4(24, 12, 24, 12))
	_depart_holder.add_child(page)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 0)
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	page.add_child(column)

	var header := HBoxContainer.new()
	header.add_theme_constant_override("separation", 8)
	column.add_child(header)
	header.add_child(UiKit.round_button("ui_back", _close_depart, 44.0, Art.INK))
	var title := UiKit.label("选职业", 22, "heavy")
	title.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	header.add_child(title)
	column.add_child(UiKit.gap(20 if portrait else 8))
	column.add_child(_job_picker(portrait))
	column.add_child(UiKit.gap(16 if portrait else 8))
	# No 普通 / 无尽 switch since 0.3.29 (the user: 只留一个模式); _mode_picker is left for the record.
	# The map button only while there is more than one map to pick (.99, the user: 地图不用选择).
	if Maps.ORDER.size() > 1:
		column.add_child(_map_button(portrait))
	# 返聘 saved from earlier (.43, bought in 培训 since .44): said here, as they carry into the run.
	var revives := Progress.revives_left()
	if revives > 0:
		var rehire := HBoxContainer.new()
		rehire.alignment = BoxContainer.ALIGNMENT_CENTER
		rehire.add_theme_constant_override("separation", 6)
		rehire.mouse_filter = Control.MOUSE_FILTER_IGNORE
		rehire.add_child(UiKit.icon("rehire", 18))
		rehire.add_child(UiKit.label(tr("返聘 ×%d · 被裁时可以选择回来，每局一次") % revives, 12, "strong", Art.GREEN_INK))
		column.add_child(UiKit.gap(10 if portrait else 4))
		column.add_child(rehire)
	if TestMode.on:
		column.add_child(UiKit.gap(8 if portrait else 4))
		column.add_child(_test_row())
	column.add_child(UiKit.filler())

	var go := UiKit.primary_button("上班", game.start_run, 56.0 if portrait else 48.0, 20)
	go.custom_minimum_size.x = 312.0 if portrait else 240.0
	go.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	column.add_child(go)
	column.add_child(UiKit.gap(12 if portrait else 6))
	var hint := HBoxContainer.new()
	hint.alignment = BoxContainer.ALIGNMENT_CENTER
	hint.add_theme_constant_override("separation", 8)
	hint.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hint.add_child(UiKit.icon("ui_hand", 18, Art.INK_MUTED))
	var hint_label := UiKit.label("按住屏幕任意处拖动来走位，武器会自动攻击" if Device.is_handheld() else "WASD 或方向键走位，武器会自动攻击；左右键换职业，回车上班", 12, "muted")
	hint_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	hint_label.custom_minimum_size = Vector2(minf(300.0, _root.size.x - 80.0), 0)
	hint.add_child(hint_label)
	column.add_child(hint)
	(func() -> void:
		if is_instance_valid(go) and go.is_inside_tree():
			_focus(go)).call_deferred()
	_fit_to_screen(_depart_holder)


func _close_depart() -> void:
	_depart_open = false
	_show_title()

## The map in use, with its stars (how hard it is: 北京 ★★★; until .60 its working week) and its
## landmark, on a button that opens the map picker to pick another (.38; .34–.37 a world map,
## before that a row of map tabs).
func _map_button(portrait: bool) -> Control:
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 8)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var label := UiKit.label("地图", 13, "strong", Art.INK_MUTED)
	label.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(label)
	var button := UiKit.secondary_button("", _open_map_picker, 36.0, 14)
	button.custom_minimum_size.x = 240.0 if portrait else 220.0
	# The landmark in a MAP_ICON square, not the button's own icon: that is capped in width only, so a
	# tall one (Big Ben, the Space Needle) stretched the button tall and stuck out of it (.86, the
	# user: 地图那里 ui 不太对).
	var content := HBoxContainer.new()
	content.alignment = BoxContainer.ALIGNMENT_CENTER
	content.add_theme_constant_override("separation", 8)
	content.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	content.mouse_filter = Control.MOUSE_FILTER_IGNORE
	content.add_child(UiKit.icon(MapList.icon_of(Maps.current_id), MAP_ICON))
	var name := UiKit.label("%s  ›" % Maps.label_of(Maps.current_id), 14, "strong", Art.INK)
	name.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	content.add_child(name)
	button.add_child(content)
	row.add_child(button)
	# The boards' trophy (.89–.95) sat beside it; since .96 排行榜 is a home-screen tile.
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
		["下个 boss", game.spawner.bring_boss],
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


## The map picker (.60, the user: 不用登机的逻辑，每个地图给个难度星星; .38–.59 an airport's
## departures board and a boarding pass): every city in a list with its stars, and under it
## (beside it, held sideways) the card for the one picked, to begin with the map in use.
func _open_map_picker() -> void:
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
	titles.add_child(UiKit.label("选地图", 20, "heavy"))
	# Wrapped, so the longer English line doesn't widen the page (which then shrinks to fit).
	var note := UiKit.label("星越多越难；通关一张，下一张就开放", 11, "muted")
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	titles.add_child(note)

	var body: BoxContainer = VBoxContainer.new() if portrait else HBoxContainer.new()
	body.add_theme_constant_override("separation", 8 if portrait else 10)
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(body)
	_map_list = MapList.new()
	_map_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_map_list.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	_map_list.city_picked.connect(_show_map_card)
	body.add_child(_map_list)
	_world_card = VBoxContainer.new()
	_world_card.add_theme_constant_override("separation", 6)
	_world_card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_world_card.custom_minimum_size.x = 0.0 if portrait else 250.0
	body.add_child(_world_card)
	_show_map_card(Maps.current_id)
	_fit_to_screen(_world_holder)


## The card for the city picked in the map picker: its landmark, name and stars, its weather, its
## four bosses, how far along the player is there, and 出发 if it is open (or what opens it, or
## that it is still to come).
func _show_map_card(id: String) -> void:
	if not is_instance_valid(_world_card):
		return
	_clear(_world_card)
	var card := UiKit.panel(UiKit.box(Art.PAPER, Art.INK, UiKit.OUTLINE, UiKit.RADIUS_MD, Vector4(12, 10, 12, 10)))
	card.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_world_card.add_child(card)
	var lines := VBoxContainer.new()
	lines.add_theme_constant_override("separation", 6)
	card.add_child(lines)

	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", 8)
	head.mouse_filter = Control.MOUSE_FILTER_IGNORE
	lines.add_child(head)
	head.add_child(UiKit.well(MapList.icon_of(id), 40.0, Art.PAPER_SUNK, 10))
	var city_name := UiKit.label(WorldMap.CITIES[id]["name"], 20, "heavy")
	city_name.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	city_name.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	city_name.clip_text = true
	city_name.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	head.add_child(city_name)
	if not Maps.ORDER.has(id):
		var later := UiKit.label("还在装修，下个版本见", 12, "muted")
		later.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		lines.add_child(later)
		return
	head.add_child(MapList.stars(MapList.stars_of(id), 18))
	var map := Maps.script_of(id)
	var facts := HFlowContainer.new()
	facts.add_theme_constant_override("h_separation", 10)
	facts.add_theme_constant_override("v_separation", 4)
	facts.mouse_filter = Control.MOUSE_FILTER_IGNORE
	lines.add_child(facts)
	var map_event: Dictionary = map.MAP_EVENT
	facts.add_child(_map_fact("event_" + map_event["id"], "天气", tr(map_event["name"])))

	# The four bosses it brings, in the order they come.
	var bosses := HFlowContainer.new()
	bosses.add_theme_constant_override("h_separation", 2)
	bosses.add_theme_constant_override("v_separation", 2)
	bosses.mouse_filter = Control.MOUSE_FILTER_IGNORE
	lines.add_child(bosses)
	var caption := UiKit.label("boss", 10, "strong", Art.INK_MUTED)
	caption.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	bosses.add_child(caption)
	for boss: String in map.BOSSES:
		bosses.add_child(UiKit.icon(Spawner.ENEMY_TYPES[boss]["art"], 20))

	var progress := tr("打卡 %d/%d") % [Maps.stamps_on(id), map.STAMPS.size()]
	var wins := int((Progress.stat("map_wins", {}) as Dictionary).get(id, 0))
	if wins > 0:
		progress += " · " + tr("通关 %d 次") % wins
	lines.add_child(UiKit.label(progress, 12, "body"))
	lines.add_child(UiKit.filler())
	if not Maps.unlocked(id):
		var hint := UiKit.label(Maps.unlock_hint(id), 12, "strong", Art.BOSS_RED)
		hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		lines.add_child(hint)
		return
	var actions := HBoxContainer.new()
	actions.add_theme_constant_override("separation", 8)
	lines.add_child(actions)
	var start := UiKit.primary_button("出发", func() -> void: game.change_map(id, true), 44.0, 17)
	start.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	actions.add_child(start)
	if id != Maps.current_id:
		var switch := UiKit.secondary_button("只换地图", func() -> void:
			# Back on the 出发 page it was picked from once the scene has restarted on the map.
			reopen_depart = _depart_open
			game.change_map(id), 44.0, 13)
		actions.add_child(switch)


## A line of the map card: an optional icon, a grey caption and its value.
func _map_fact(art: String, caption: String, value: String) -> Control:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 3)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(UiKit.label(caption, 10, "body", Art.INK_MUTED))
	if art != "":
		row.add_child(UiKit.icon(art, 16))
	row.add_child(UiKit.label(value, 11, "strong"))
	return row


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
	# The card and under it the demo (0.2.1, the user: 缩小职业卡、放在卡下面).
	var detail := VBoxContainer.new()
	detail.add_theme_constant_override("separation", 6)
	detail.mouse_filter = Control.MOUSE_FILTER_IGNORE
	detail.add_child(_job_detail(picked, portrait))
	detail.add_child(_preview_view(PREVIEW_SIZE if portrait else PREVIEW_SIZE_LANDSCAPE))
	var holder: BoxContainer = VBoxContainer.new() if portrait else HBoxContainer.new()
	holder.alignment = BoxContainer.ALIGNMENT_CENTER
	holder.add_theme_constant_override("separation", 10 if portrait else 14)
	holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	holder.add_child(faces)
	holder.add_child(detail)
	return holder


## The demo's view (Game.start_preview): the game's own world, seen by a camera of its own on the
## player, in a rounded frame. Drawn at the screen's pixel density (the view's pixels times how
## many real pixels a logical one is), then shrunk back, so it is as sharp as the game itself.
func _preview_view(view_size: Vector2) -> Control:
	var density := maxf(1.0, maxf(get_window().size.x, get_window().size.y) / maxf(_root.size.x, _root.size.y))
	var frame := UiKit.panel(UiKit.box(Art.PAPER, Art.LINE, UiKit.OUTLINE, UiKit.RADIUS_MD, Vector4(3, 3, 3, 3)))
	frame.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	frame.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var stage := Control.new()
	stage.custom_minimum_size = view_size
	stage.clip_contents = true
	stage.mouse_filter = Control.MOUSE_FILTER_IGNORE
	frame.add_child(stage)
	var container := SubViewportContainer.new()
	container.mouse_filter = Control.MOUSE_FILTER_IGNORE
	container.scale = Vector2.ONE / density
	stage.add_child(container)
	var viewport := SubViewport.new()
	viewport.size = Vector2i((view_size * density).round())
	viewport.world_2d = game.get_viewport().world_2d
	viewport.gui_disable_input = true
	viewport.canvas_item_default_texture_filter = get_viewport().canvas_item_default_texture_filter
	container.add_child(viewport)
	_preview_camera = Camera2D.new()
	_preview_camera.zoom = Vector2.ONE * density * PREVIEW_ZOOM
	_preview_camera.position = game.player.position
	_preview_camera.process_mode = Node.PROCESS_MODE_ALWAYS
	viewport.add_child(_preview_camera)
	_preview_stage = stage
	return frame


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


## The picked job: name and its weapon's type, its own weapon and its build (sideways the build goes
## on the name's line).
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
	# 0.2.1 (the user: 选职业下面只用职业名和武器和数值): the pitch and the 技能 line (.81, .93) gave
	# way to the demo under the card, which shows the weapon and the skill at work.
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
	# The 出发 page redrawn with it (and home behind, whose chip shows the job's face).
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


# --- 培训 ------------------------------------------------------------------------------------

## The 培训 page (.44, Training, after Vampire Survivors' PowerUp shop): the 工资 there to spend, a
## row per base stat (its rank, what it gives now and at the next rank, and a button with the
## price), and 全部退款. Rebuilt after every purchase, staying scrolled where it was.
func _open_training() -> void:
	var kept_scroll := 0
	if _training_open and is_instance_valid(_training_scroll):
		kept_scroll = _training_scroll.scroll_vertical
	_training_open = true
	_clear(_training_holder)
	var portrait := _is_portrait()
	var page := _page(Vector4(16, 20, 16, 16) if portrait else Vector4(24, 14, 24, 12))
	_training_holder.add_child(page)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 12 if portrait else 8)
	page.add_child(column)

	var header := HBoxContainer.new()
	header.add_theme_constant_override("separation", 8)
	column.add_child(header)
	var back := UiKit.round_button("ui_back", _close_training, 44.0, Art.INK)
	header.add_child(back)
	var title := UiKit.label("培训", 22, "heavy")
	title.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(title)
	var wallet := UiKit.panel(UiKit.box(Art.BRAND_SOFT, Art.INK, UiKit.OUTLINE, UiKit.PILL, Vector4(10, 4, 12, 4)))
	wallet.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var wallet_row := HBoxContainer.new()
	wallet_row.add_theme_constant_override("separation", 6)
	wallet_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	wallet.add_child(wallet_row)
	wallet_row.add_child(UiKit.icon("moneybag", 20))
	var balance := UiKit.label(tr("工资 ¥%d") % maxi(Training.balance(), 0), 15, "heavy")
	balance.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
	wallet_row.add_child(balance)
	header.add_child(wallet)

	column.add_child(_collection_note(tr("年终奖发的工资在这里花：每项基础属性练几级，以后每局开局都带着。随时可以全部退款重新分配（已经买的返聘不退）。")))
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	column.add_child(scroll)
	_training_scroll = scroll
	if kept_scroll > 0:
		_scroll_after_layout(scroll, kept_scroll)
	var grid := GridContainer.new()
	grid.columns = 1 if portrait else 2
	grid.add_theme_constant_override("h_separation", 8)
	grid.add_theme_constant_override("v_separation", 8)
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(grid)
	for entry: Dictionary in Training.STATS:
		grid.add_child(_training_row(entry))
	grid.add_child(_revive_shop_row())

	var footer := HBoxContainer.new()
	footer.alignment = BoxContainer.ALIGNMENT_END
	column.add_child(footer)
	var refund := UiKit.secondary_button("全部退款", func() -> void:
		Training.refund_all()
		Sound.play("payout")
		_open_training(), 40.0, 14)
	refund.disabled = Training.total_ranks() == 0
	footer.add_child(refund)
	_focus(back)


## One stat on the 培训 page: its icon, name and rank dots, what it gives now and what the next
## rank adds, and the button to buy it (its price, or 已满).
func _training_row(entry: Dictionary) -> Control:
	var id: String = entry["id"]
	var rank := Training.rank(id)
	var top: int = entry["ranks"]
	var row_panel := UiKit.panel(UiKit.box(Art.PAPER, Art.LINE, UiKit.OUTLINE, UiKit.RADIUS_MD, Vector4(10, 8, 10, 8)))
	row_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row_panel.add_child(row)
	row.add_child(UiKit.well(entry["art"], 40, Art.MINT_LIGHT if rank > 0 else Art.PAPER_SUNK, UiKit.RADIUS_SM))
	var text := VBoxContainer.new()
	text.add_theme_constant_override("separation", 2)
	text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	text.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(text)
	var name_row := HBoxContainer.new()
	name_row.add_theme_constant_override("separation", 8)
	name_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	text.add_child(name_row)
	name_row.add_child(UiKit.label(entry["name"], 14, "strong"))
	name_row.add_child(UiKit.level_dots(rank, top, rank < top))
	var gives: String
	if id == "reroll":
		# Counted per run, the free one included (Player.BASE_REROLLS): 每局 1 次 reads plainer than +0.
		var per_run := Player.BASE_REROLLS + rank
		gives = tr("已练满，每局 %d 次") % per_run if rank >= top else tr("每局 %d 次 → 下一级 %d 次") % [per_run, per_run + 1]
	elif rank >= top:
		gives = tr("已练满 %s") % Training.amount_value(id, rank)
	elif rank > 0:
		gives = tr("现在 %s → 下一级 %s") % [Training.amount_value(id, rank), Training.amount_value(id, rank + 1)]
	else:
		gives = tr("还没练 → 下一级 %s") % Training.amount_value(id, 1)
	var detail := UiKit.label(gives, 11, "muted")
	detail.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
	detail.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	detail.custom_minimum_size.x = 120.0
	text.add_child(detail)
	var buy: Button
	if rank >= top:
		buy = UiKit.secondary_button("已满", func() -> void: pass, 36.0, 13)
		buy.disabled = true
	else:
		var cost := Training.price(id)
		buy = UiKit.primary_button("¥%d" % cost, func() -> void:
			if Training.buy(id):
				Sound.play("pick")
				_open_training(), 36.0, 14)
		buy.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
		buy.disabled = cost > Training.balance()
	buy.custom_minimum_size.x = 76.0
	buy.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(buy)
	return row_panel


## The 培训 page's 返聘 (.44; 绩效 S's prize in .43): how many are saved, what one does, and the
## button to buy another for Training.REVIVE_PRICE.
func _revive_shop_row() -> Control:
	var row_panel := UiKit.panel(UiKit.box(Art.MINT_LIGHT, Art.LINE, UiKit.OUTLINE, UiKit.RADIUS_MD, Vector4(10, 8, 10, 8)))
	row_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row_panel.add_child(row)
	row.add_child(UiKit.well("rehire", 40, Art.PAPER, UiKit.RADIUS_SM))
	var text := VBoxContainer.new()
	text.add_theme_constant_override("separation", 2)
	text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	text.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(text)
	var name_label := UiKit.label(tr("返聘 ×%d") % Progress.revives_left(), 14, "strong")
	name_label.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
	text.add_child(name_label)
	var detail := UiKit.label("被裁时可以选择回来上班（回半血），每局最多用一次，存着下局也能用", 11, "muted")
	detail.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	detail.custom_minimum_size.x = 120.0
	text.add_child(detail)
	var buy := UiKit.primary_button("¥%d" % Training.REVIVE_PRICE, func() -> void:
		if Training.buy_revive():
			Sound.play("pick")
			_open_training(), 36.0, 14)
	buy.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
	buy.disabled = Training.REVIVE_PRICE > Training.balance()
	buy.custom_minimum_size.x = 76.0
	buy.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(buy)
	return row_panel


func _close_training() -> void:
	_training_open = false


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

	# A charged desk's cards (MapObjects, .99) come up on this panel too, worded as the desk's.
	var desk := game.desk_offer
	column.add_child(UiKit.kicker("DESK" if desk else "PROMOTED", Art.BRAND_SOFT))
	# Every level-up is a promotion to the next grade (.33). `game.level` already counts the
	# level-ups still banked, so name the one this panel is for.
	var title := UiKit.label(tr("工位充好电了") if desk else tr("升职！%s") % Maps.rank_of(game.level - game.queued_level_ups + 1), 28, "display", Art.PAPER)
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
	var sub_text := "选一项带走，这局一直有效" if desk else "选一张带走"
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
	# No 刷新 for a desk's cards (Game.can_reroll), so no greyed button either.
	if not desk:
		column.add_child(_reroll_row())
		column.add_child(UiKit.gap(10 if portrait else 8))
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

	var fill := Art.MINT_LIGHT if kind in ["passive", "desk"] else Art.PINK_LIGHT if kind == "heal" else Art.SKY_LIGHT if fresh else Art.PAPER_SUNK
	var well := UiKit.well(choice["art"], (48.0 if crowded else 60.0) if portrait else (44.0 if narrow else 52.0), fill)
	var name_label := UiKit.label(_card_name(choice), 17 if portrait else 15, "heavy")
	var badge: Control = null
	if kind == "desk":
		# Not a passive: no slot, no level (Upgrades.desk_choices).
		badge = UiKit.tag("工位", Art.MINT_LIGHT, Art.GREEN_INK)
	elif fresh:
		badge = UiKit.tag("新武器", Art.SKY_LIGHT, Art.LINK) if kind == "weapon" else UiKit.tag("被动", Art.MINT_LIGHT, Art.GREEN_INK)
	elif choice.has("branch_level"):
		# A job weapon's direction card: that direction's own level (.35).
		badge = UiKit.level_dots(choice["branch_level"] - 1, Upgrades.BRANCH_MAX, true, 1)
	elif kind != "heal":
		badge = UiKit.level_dots(level - 1, choice["max"], true, 1)
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


## A card's name; a job weapon's direction card adds the direction: 「激光笔 · 更宽」.
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


## The level-up's 刷新 button (.96): 刷新 ×N while the run has some left (R on a keyboard), greyed
## at ×0 with a line saying 培训 adds more (while it still can), so players find where they come from.
func _reroll_row() -> Control:
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 8)
	var left := game.player.rerolls
	var text := tr("刷新 ×%d") % left
	if not Device.is_handheld():
		text += "  (R)"
	var button := UiKit.secondary_button(text, _reroll, 36.0, 13)
	button.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
	button.icon = Art.texture("reroll")
	button.add_theme_constant_override("icon_max_width", 20)
	button.focus_mode = Control.FOCUS_NONE
	button.disabled = not game.can_reroll()
	# The theme's disabled button is dark grey, lost on the level-up's dark scrim: a sunk paper pill
	# with muted text instead, still readable as 刷新 ×0.
	button.add_theme_stylebox_override("disabled", UiKit.box(Art.PAPER_SUNK, Art.LINE_STRONG, UiKit.OUTLINE, UiKit.PILL, Vector4(14, 0, 14, 0)))
	button.add_theme_color_override("font_disabled_color", Art.INK_MUTED)
	button.add_theme_color_override("icon_disabled_color", Color(1, 1, 1, 0.5))
	row.add_child(button)
	if left <= 0 and not Training.maxed("reroll"):
		row.add_child(UiKit.label("培训里能加次数", 12, "body", Art.BRAND_SOFT))
	return row


## Redraws the level-up's cards (Game.reroll_upgrade), which shows the panel again; ignored for
## PICK_DELAY_MS after it appears, like a pick, so a tap meant for dodging doesn't spend one.
func _reroll() -> void:
	if game.state != Game.State.LEVEL_UP or Time.get_ticks_msec() < _accept_picks_at:
		return
	game.reroll_upgrade()


func _hover(card: Control, entered: bool) -> void:
	var tween := card.create_tween()
	tween.tween_property(card, "scale", Vector2.ONE * (1.03 if entered else 1.0), 0.15)


# --- Year-end bonus ------------------------------------------------------------------------

## A boss's year-end bonus (年终奖), opened over about six seconds (.46, the user: 酷炫一点，长一点，
## 五秒以上; before, it opened after 0.9 s of rocking). On a dark stage the chest drops in and rocks,
## quicker and quicker, a white light growing behind it; then it shudders and swells while the light
## climbs the rarities to the rating Game rolled (绩效 C white, B green, A blue, S purple: the colour of the
## upgrade it gives) and bursts open. Then the 工资 it paid counts up and its upgrade flips in, both
## saved / applied already (Game._open_chest). What it gives is laid out from the start, unseen, so
## the dialog keeps its size as it plays. Not skippable: 收下 comes up last. Shows what each rating
## gives but not how likely it is (.46, the user: 概率藏起来不要可见).
func _show_chest(funding_round: Dictionary, salary: int, item: Dictionary, boss_slot: int) -> void:
	_clear(_chest_holder)
	_chest_revealed = false
	_chest_chips.clear()
	_chest_glow_power = 0.0
	_chest_glow_color = Color.WHITE
	_chest_glow_target = Color.WHITE
	_chest_count_ticks = 0
	var landing := Game.FUNDING_ROUNDS.find(funding_round)
	var rarity: int = funding_round["rarity"]
	var portrait := _is_portrait()
	var dialog := UiKit.panel(UiKit.dialog_box(Vector4(18, 18, 18, 18)))
	dialog.custom_minimum_size = Vector2(minf(320.0, _root.size.x - 40.0), 0.0) if portrait else Vector2(minf(560.0, _root.size.x - 40.0), 0.0)
	dialog.resized.connect(func() -> void: dialog.pivot_offset = dialog.size / 2.0)
	_chest_holder.add_child(dialog)
	var body: BoxContainer = VBoxContainer.new() if portrait else HBoxContainer.new()
	body.add_theme_constant_override("separation", 12 if portrait else 20)
	dialog.add_child(body)

	var head := VBoxContainer.new()
	head.add_theme_constant_override("separation", 0)
	if portrait:
		head.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	else:
		# Sideways the chest keeps a fixed width and what it gave gets the rest.
		head.custom_minimum_size = Vector2(240, 0)
	body.add_child(head)
	head.add_child(UiKit.kicker("YEAR-END BONUS"))
	var title := UiKit.label("年终奖开箱", 26, "heavy")
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	head.add_child(title)
	head.add_child(UiKit.gap(6))

	# The stage, dark so the light and the sparks show, clipped to its rounded box: on a layer that
	# shudders as one, the light, the rays (hidden until it opens) and the chest; over it all, the
	# white flash as it opens.
	var stage := Control.new()
	stage.custom_minimum_size = Vector2(0, CHEST_STAGE_HEIGHT)
	stage.clip_contents = true
	stage.mouse_filter = Control.MOUSE_FILTER_IGNORE
	stage.draw.connect(func() -> void:
		stage.draw_style_box(UiKit.box(Art.INK, Color.TRANSPARENT, 0, UiKit.RADIUS_MD), Rect2(Vector2.ZERO, stage.size)))
	head.add_child(stage)
	_chest_stage = stage
	_chest_shaker = _stage_layer()
	stage.add_child(_chest_shaker)
	_chest_glow = _glow()
	_chest_shaker.add_child(_chest_glow)
	_chest_burst = _burst(Art.RARITY_EDGE[rarity])
	_chest_shaker.add_child(_chest_burst)
	var centre := CenterContainer.new()
	centre.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	centre.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_chest_shaker.add_child(centre)
	# The chest on a seat of its own size, so it can drop in and jolt about without the
	# CenterContainer putting it back.
	var seat := Control.new()
	seat.custom_minimum_size = Vector2.ONE * CHEST_ART_SIZE
	seat.mouse_filter = Control.MOUSE_FILTER_IGNORE
	centre.add_child(seat)
	_chest_art = UiKit.icon("chest", CHEST_ART_SIZE)
	# It rocks on its base rather than spinning round its middle.
	_chest_art.pivot_offset = Vector2(CHEST_ART_SIZE / 2.0, CHEST_ART_SIZE * 0.85)
	seat.add_child(_chest_art)
	_chest_flash = ColorRect.new()
	_chest_flash.color = Color(Color.WHITE, 0.0)
	_chest_flash.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_chest_flash.mouse_filter = Control.MOUSE_FILTER_IGNORE
	stage.add_child(_chest_flash)
	# The rating, stamped on under the chest once it opens, in its upgrade's colours.
	head.add_child(UiKit.gap(6))
	_chest_stamp = UiKit.tag(funding_round["name"], Art.RARITY_FILL[rarity], Art.RARITY_INK[rarity], UiKit.OUTLINE_HEAVY, 20)
	_chest_stamp.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_chest_stamp.modulate.a = 0.0
	head.add_child(_chest_stamp)

	# What each rating gives, its 工资 and its upgrade's colour (not its odds); the one it landed on
	# marked once it opens.
	var chips := GridContainer.new()
	chips.columns = Game.FUNDING_ROUNDS.size()
	chips.add_theme_constant_override("h_separation", 6)
	chips.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for option: Dictionary in Game.FUNDING_ROUNDS:
		var chip := UiKit.panel(UiKit.box(Art.PAPER_SUNK, Color.TRANSPARENT, 0, 10, Vector4(4, 5, 4, 5)))
		chip.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var chip_column := VBoxContainer.new()
		chip_column.add_theme_constant_override("separation", 0)
		chip_column.mouse_filter = Control.MOUSE_FILTER_IGNORE
		chip.add_child(chip_column)
		var option_rarity: int = option["rarity"]
		var round_name := UiKit.label(option["name"], 13, "strong")
		# What each rating pays for this boss (.70: more for each later boss); .63–.69 one amount a
		# rating, a range before.
		var pay := UiKit.label("¥%d" % Game.chest_salary(option, boss_slot), 11, "muted")
		var upgrade := UiKit.label(tr("%s升级") % tr(Upgrades.RARITIES[option_rarity]["colour"]), 11, "heavy", Art.RARITY_INK[option_rarity])
		upgrade.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
		for chip_label: Label in [round_name, pay, upgrade]:
			chip_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			chip_column.add_child(chip_label)
		chips.add_child(chip)
		_chest_chips.append(chip)
	head.add_child(UiKit.gap(10))
	head.add_child(chips)

	var tail := VBoxContainer.new()
	tail.add_theme_constant_override("separation", 10)
	tail.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tail.alignment = BoxContainer.ALIGNMENT_CENTER
	body.add_child(tail)
	var result := UiKit.label("拆年终奖中…", 15, "heavy", Art.INK_MUTED)
	result.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	tail.add_child(result)
	# What it gave, laid out now but unseen until it has opened: the 工资, then the upgrade.
	var salary_row := _salary_row(salary)
	salary_row.modulate.a = 0.0
	tail.add_child(salary_row)
	var upgrade_row := _chest_upgrade_row(item)
	upgrade_row.modulate.a = 0.0
	tail.add_child(upgrade_row)
	var take := UiKit.primary_button("收下", _on_chest_button)
	take.modulate.a = 0.0
	take.disabled = true
	_chest_take = take
	tail.add_child(take)
	_pop_in(dialog, 0.0)
	_accept_picks_at = Time.get_ticks_msec() + PICK_DELAY_MS
	_fit_to_screen(_chest_holder)
	_play_chest(dialog, landing, rarity, result, salary_row, upgrade_row, funding_round, salary)


## The opening, beat by beat (the CHEST_* timings), on one tween on the dialog, gone with it.
func _play_chest(dialog: Control, landing: int, rarity: int, result: Label, salary_row: Control, upgrade_row: Control,
		funding_round: Dictionary, salary: int) -> void:
	var show := dialog.create_tween()
	# 1. It drops onto the stage from above, squashes and puffs dust.
	_chest_art.position.y = -CHEST_STAGE_HEIGHT
	show.tween_property(_chest_art, "position:y", 0.0, CHEST_DROP_SECONDS * 0.64).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	show.tween_callback(_chest_landed)
	show.tween_property(_chest_art, "scale", Vector2(1.18, 0.82), CHEST_DROP_SECONDS * 0.12)
	show.tween_property(_chest_art, "scale", Vector2.ONE, CHEST_DROP_SECONDS * 0.24).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	# 2. It rocks, each swing shorter and wider than the last with a tick a little higher, while a
	# white light comes up behind it.
	show.tween_callback(func() -> void:
		_chest_glow.create_tween().tween_method(_set_glow_power, 0.0, 0.45, CHEST_SHAKE_SECONDS))
	var swing_weights := 0.0
	for i in CHEST_SHAKES:
		swing_weights += 1.5 - float(i) / CHEST_SHAKES
	for i in CHEST_SHAKES:
		var lean := CHEST_LEAN * (1.0 + i * 0.12) * (1.0 if i % 2 == 0 else -1.0)
		var seconds := CHEST_SHAKE_SECONDS * (1.5 - float(i) / CHEST_SHAKES) / swing_weights
		var pitch := 1.0 + i * 0.04
		show.tween_property(_chest_art, "rotation", lean, seconds).set_trans(Tween.TRANS_SINE)
		show.tween_callback(func() -> void: Sound.play_pitched("reel_tick", pitch))
	show.tween_property(_chest_art, "rotation", 0.0, 0.05)
	# 3. It shudders and swells, spitting sparks, while the light climbs from white through the
	# rarities to the one it landed on: white for the first share of the beats, then a share per
	# colour, so every rating keeps the player guessing for a while and 绩效 S climbs the most.
	for beat in CHEST_CHARGE_BEATS:
		var progress := float(beat) / CHEST_CHARGE_BEATS
		show.tween_callback(_charge_beat.bind(progress, floori(progress * (rarity + 1))))
		show.tween_interval(CHEST_CHARGE_SECONDS / CHEST_CHARGE_BEATS)
	# 4. It bursts open; 绩效 S throws a second wave of stars.
	show.tween_callback(_reveal_chest.bind(dialog, landing, rarity, result, funding_round))
	show.tween_interval(0.25)
	if landing == Game.FUNDING_ROUNDS.size() - 1:
		show.tween_callback(_star_wave.bind(rarity, CHEST_STARS[landing], 0.5))
	show.tween_interval(0.1)
	# 5. The 工资 counts up, ticking, then rings up (a cheer for the luckiest amounts).
	show.tween_callback(_pop_in.bind(salary_row, 0.0))
	show.tween_method(_count_salary.bind(salary), 0.0, float(salary), CHEST_COUNT_SECONDS)
	show.tween_callback(_salary_counted.bind(salary_row, result, funding_round, salary))
	# 6. The upgrade turns over into view, a shine running across it.
	show.tween_interval(0.15)
	show.tween_callback(_flip_in.bind(upgrade_row))
	# 7. And only then 收下.
	show.tween_interval(0.6)
	show.tween_callback(_show_chest_take.bind(0.0))


## A layer filling the chest's stage, drawn on or moved as one.
func _stage_layer() -> Control:
	var layer := Control.new()
	layer.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return layer


## The light behind the chest: soft rings of _chest_glow_color, as strong as _chest_glow_power.
func _glow() -> Control:
	var glow := _stage_layer()
	glow.draw.connect(func() -> void:
		if _chest_glow_power <= 0.01:
			return
		var middle := glow.size / 2.0
		for ring in CHEST_GLOW_RINGS:
			var radius := CHEST_ART_SIZE * (0.3 + 0.16 * ring) * (0.7 + 0.5 * _chest_glow_power)
			glow.draw_circle(middle, radius, Color(_chest_glow_color, 0.14 * _chest_glow_power))
	)
	return glow


func _set_glow_power(power: float) -> void:
	_chest_glow_power = power
	_chest_glow.queue_redraw()


func _set_glow_color(colour: Color) -> void:
	_chest_glow_color = colour
	_chest_glow.queue_redraw()


## Rays and a glow in `color` round the chest, shown when it opens (turning slowly).
func _burst(color: Color) -> Control:
	var burst := _stage_layer()
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


## The chest hitting the stage: a thud and dust puffing out either side of its base.
func _chest_landed() -> void:
	Sound.play("block")
	var base := _chest_stage.size / 2.0 + Vector2(0.0, CHEST_ART_SIZE * 0.4)
	for i in 10:
		var side := -1.0 if i % 2 == 0 else 1.0
		_stage_dot(base + Vector2(side * CHEST_ART_SIZE * 0.3, 0.0), Vector2(side * randf_range(25.0, 60.0), randf_range(-16.0, -2.0)),
			randf_range(4.0, 7.0), Color(Art.PAPER, 0.55), 0.5)


## One beat of the build-up (`progress` 0 to 1): the chest jolts, harder as it goes, and swells,
## sparks fly off it, and the light turns to `tier`'s colour (0 white, then Art.RARITY_EDGE) when
## it climbs, with a chime a step higher each time.
func _charge_beat(progress: float, tier: int) -> void:
	var jolt := 1.5 + 3.0 * progress
	_chest_shaker.position = Vector2(randf_range(-jolt, jolt), randf_range(-jolt, jolt))
	_chest_art.scale = Vector2.ONE * (1.0 + 0.15 * progress)
	_set_glow_power(0.5 + 0.5 * progress)
	var colour: Color = Color.WHITE if tier == 0 else Art.RARITY_EDGE[tier]
	if colour != _chest_glow_target:
		_chest_glow_target = colour
		_chest_glow.create_tween().tween_method(_set_glow_color, _chest_glow_color, colour, 0.15)
		Sound.play_pitched("pick", 1.0 + 0.2 * tier)
	var middle := _chest_stage.size / 2.0
	for i in 2:
		_stage_dot(middle, Vector2.from_angle(randf() * TAU) * randf_range(45.0, 75.0), randf_range(2.0, 3.5), colour.lightened(0.3), 0.4)


## The chest bursting open: a white flash on the stage and a fainter one over the whole screen,
## the lid off, the rays and the light in the rating's colour, the dialog punched out and back,
## stars and sparks flying, the rating stamped on and its chip marked.
func _reveal_chest(dialog: Control, landing: int, rarity: int, result: Label, funding_round: Dictionary) -> void:
	_chest_revealed = true
	_chest_shaker.position = Vector2.ZERO
	_chest_art.texture = Art.texture("chest_open")
	_chest_art.scale = Vector2.ONE * 1.4
	_chest_art.create_tween().tween_property(_chest_art, "scale", Vector2.ONE, 0.4) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_set_glow_power(1.0)
	_set_glow_color(Art.RARITY_EDGE[rarity])
	_chest_burst.scale = Vector2.ONE * 0.4
	var rays := _chest_burst.create_tween().set_parallel()
	rays.tween_property(_chest_burst, "modulate:a", 1.0, 0.15)
	rays.tween_property(_chest_burst, "scale", Vector2.ONE * 1.1, 0.4).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_chest_burst.create_tween().set_loops().tween_property(_chest_burst, "rotation", TAU, CHEST_RAY_TURN_SECONDS).from(0.0)
	_chest_flash.color.a = 1.0
	_chest_flash.create_tween().tween_property(_chest_flash, "color:a", 0.0, 0.45)
	var screen_flash := ColorRect.new()
	screen_flash.color = Color(Color.WHITE, 0.6)
	screen_flash.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	screen_flash.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_chest_overlay.add_child(screen_flash)
	var fade := screen_flash.create_tween()
	fade.tween_property(screen_flash, "color:a", 0.0, 0.35)
	fade.tween_callback(screen_flash.queue_free)
	dialog.scale = Vector2.ONE * 1.06
	dialog.create_tween().tween_property(dialog, "scale", Vector2.ONE, 0.3).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_star_wave(rarity, CHEST_STARS[landing], 0.0)
	_stamp_on(_chest_stamp)
	_chest_chips[landing].add_theme_stylebox_override("panel", UiKit.box(Art.RARITY_FILL[rarity], Art.INK, UiKit.OUTLINE, 10, Vector4(4, 5, 4, 5)))
	result.text = tr("%s！") % tr(funding_round["name"])
	result.add_theme_color_override("font_color", Art.INK)
	Sound.play("ultimate")


## `count` gold stars thrown out of the open chest (turned by `turn` of a step, so a second wave
## flies between the first's), and sparks in the rating's colour.
func _star_wave(rarity: int, count: int, turn: float) -> void:
	for i in count:
		_throw_star(TAU * (i + turn) / count + randf() * 0.3)
	var middle := _chest_stage.size / 2.0
	for i in count:
		_stage_dot(middle, Vector2.from_angle(randf() * TAU) * randf_range(50.0, 110.0), randf_range(2.5, 4.0),
			Art.RARITY_EDGE[rarity].lightened(0.35), 0.6)


## A dot on the chest's stage (dust, a spark) flying `drift` from `at`, shrinking and fading over
## `seconds`.
func _stage_dot(at: Vector2, drift: Vector2, radius: float, colour: Color, seconds: float) -> void:
	var dot := Control.new()
	dot.mouse_filter = Control.MOUSE_FILTER_IGNORE
	dot.position = at
	dot.draw.connect(func() -> void: dot.draw_circle(Vector2.ZERO, radius, colour))
	_chest_shaker.add_child(dot)
	var flight := dot.create_tween().set_parallel()
	flight.tween_property(dot, "position", at + drift, seconds).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	flight.tween_property(dot, "scale", Vector2.ONE * 0.3, seconds)
	flight.tween_property(dot, "modulate:a", 0.0, seconds * 0.6).set_delay(seconds * 0.4)
	flight.chain().tween_callback(dot.queue_free)


## The 工资 counting up to `salary` (the tween's `value`), a tick at every CHEST_COUNT_TICKS-th of it.
func _count_salary(value: float, salary: int) -> void:
	_chest_salary_label.text = tr("工资 +¥%d") % roundi(value)
	var tick := floori(value / maxf(salary, 1.0) * CHEST_COUNT_TICKS)
	if tick > _chest_count_ticks:
		_chest_count_ticks = tick
		Sound.play_pitched("reel_tick", 1.2 + 0.03 * tick)


## The 工资 counted up: its row pops, the till rings (a fanfare for 绩效 S) and the luckiest amounts
## get a cheer of their own.
func _salary_counted(salary_row: Control, result: Label, funding_round: Dictionary, salary: int) -> void:
	_chest_salary_label.text = tr("工资 +¥%d") % salary
	salary_row.scale = Vector2.ONE * 1.08
	salary_row.create_tween().tween_property(salary_row, "scale", Vector2.ONE, 0.25).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	Sound.play("win" if funding_round["id"] == "ipo" else "payout")
	if LUCKY_SALARIES.has(salary):
		result.text += " " + tr(LUCKY_SALARIES[salary])


## The upgrade's row turning over into view, then a shine running across it.
func _flip_in(card: Control) -> void:
	card.modulate.a = 1.0
	card.scale = Vector2(0.0, 1.0)
	Sound.play("level_up")
	var flip := card.create_tween()
	flip.tween_property(card, "scale:x", 1.0, 0.3).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	flip.tween_method(_set_shine.bind(card), 0.0, 1.0, 0.5)


func _set_shine(shine: float, card: Control) -> void:
	card.set_meta("shine", shine)
	card.queue_redraw()


## The chest's 收下, faded in after `settled` seconds (once what it gave is all on screen).
func _show_chest_take(settled: float) -> void:
	var take := _chest_take
	var show_take := take.create_tween()
	show_take.tween_interval(settled)
	show_take.tween_property(take, "modulate:a", 1.0, 0.15)
	show_take.tween_callback(func() -> void:
		take.disabled = false
		_focus(take))


## A year-end bonus's 工资 (.44), saved for 培训 on the title screen; its heading counts up as the
## chest opens (_count_salary). (.43's 绩效 S gave a 返聘 too, in a green row under it; 返聘 are
## bought in 培训 now.)
func _salary_row(amount: int) -> Control:
	var note_text := tr("攒着去开始画面的「培训」升级属性，现在有 ¥%d") % Training.balance()
	var row_panel := UiKit.panel(UiKit.box(Art.BRAND_SOFT, Art.INK, UiKit.OUTLINE, UiKit.RADIUS_MD, Vector4(10, 8, 10, 8)))
	row_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row_panel.resized.connect(func() -> void: row_panel.pivot_offset = row_panel.size / 2.0)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row_panel.add_child(row)
	row.add_child(UiKit.icon("moneybag", 36))
	var text := VBoxContainer.new()
	text.add_theme_constant_override("separation", 0)
	text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	text.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(text)
	# Sized for the whole amount from the start, so the row doesn't grow as it counts up.
	_chest_salary_label = UiKit.label(tr("工资 +¥%d") % amount, 15, "heavy")
	_chest_salary_label.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
	text.add_child(_chest_salary_label)
	var note := UiKit.label(note_text, 11, "muted")
	note.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	note.custom_minimum_size.x = 180.0
	text.add_child(note)
	return row_panel


## The upgrade a year-end bonus gave (.46), applied already: outlined in its rarity's colour like a
## level-up card, with its rarity's tag, the step it took and what that changed. Clipped, so the
## shine _flip_in runs across it stays inside.
func _chest_upgrade_row(item: Dictionary) -> Control:
	var rarity: int = item.get("rarity", 0)
	var edge: Color = Art.RARITY_EDGE[rarity] if rarity > 0 else Art.LINE
	var row_panel := UiKit.panel(UiKit.box(Art.PAPER, edge, UiKit.OUTLINE_HEAVY, UiKit.RADIUS_MD, Vector4(10, 8, 10, 8)))
	row_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row_panel.clip_contents = true
	row_panel.resized.connect(func() -> void: row_panel.pivot_offset = row_panel.size / 2.0)
	# Drawn over the box and under the text: a slanted white band at `shine` (0 to 1) across it.
	row_panel.draw.connect(func() -> void:
		var shine: float = row_panel.get_meta("shine", -1.0)
		if shine <= 0.0 or shine >= 1.0:
			return
		var slant := row_panel.size.y * 0.5
		var left := lerpf(-CHEST_SHINE_WIDTH, row_panel.size.x + slant, shine)
		row_panel.draw_colored_polygon(PackedVector2Array([Vector2(left, 0.0), Vector2(left + CHEST_SHINE_WIDTH, 0.0),
			Vector2(left + CHEST_SHINE_WIDTH - slant, row_panel.size.y), Vector2(left - slant, row_panel.size.y)]), Color(Color.WHITE, 0.75))
	)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row_panel.add_child(row)
	var kind: String = item["kind"]
	var fill := Art.MINT_LIGHT if kind in ["passive", "desk"] else Art.PINK_LIGHT if kind == "heal" else Art.SKY_LIGHT
	row.add_child(UiKit.well(item["art"], 40, fill, UiKit.RADIUS_SM))
	var text := VBoxContainer.new()
	text.add_theme_constant_override("separation", 1)
	text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	text.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(text)
	var name_row := HBoxContainer.new()
	name_row.add_theme_constant_override("separation", 6)
	name_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	text.add_child(name_row)
	name_row.add_child(UiKit.label(_card_name(item), 15, "heavy"))
	if rarity > 0:
		name_row.add_child(UiKit.tag(Upgrades.RARITIES[rarity]["name"], Art.RARITY_FILL[rarity], Art.RARITY_INK[rarity], UiKit.OUTLINE))
	# The step it took, then what it changed (worked out before it was applied, Game._open_chest).
	var numbers: String = item.get("numbers", "")
	var change := UiKit.label(_chest_step(item) + (" · " + numbers if numbers != "" else ""), 12, "strong", Art.LINK)
	change.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
	change.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	change.custom_minimum_size.x = 160.0
	text.add_child(change)
	var rarity_text := Upgrades.rarity_line(item)
	if rarity_text != "":
		var rarity_label := UiKit.label(rarity_text, 11, "heavy", Art.RARITY_INK[rarity])
		rarity_label.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
		text.add_child(rarity_label)
	return row_panel


## The step a year-end bonus's upgrade took, translated: 新, Lv 2 → 3 (a job weapon's direction its
## own level), or the fallback card's heal.
func _chest_step(item: Dictionary) -> String:
	if item["kind"] == "heal":
		return tr("回复 %d") % roundi(Upgrades.HEAL_CARD)
	if item.has("branch_level"):
		return "Lv %d → %d" % [item["branch_level"] - 1, item["branch_level"]]
	var level: int = item["level"]
	if level == 1:
		return tr("新")
	return "Lv %d → %d" % [level - 1, level]


## A gold star flying out of the open chest at `angle`, spinning and fading as it goes.
func _throw_star(angle: float) -> void:
	var star := UiKit.icon("star_gold", CHEST_STAR_SIZE)
	var start := _chest_stage.size / 2.0 - Vector2.ONE * CHEST_STAR_SIZE / 2.0
	star.position = start
	star.pivot_offset = Vector2.ONE * CHEST_STAR_SIZE / 2.0
	_chest_stage.add_child(star)
	var flight := star.create_tween().set_parallel()
	flight.tween_property(star, "position", start + Vector2.from_angle(angle) * randf_range(60.0, 130.0), 0.7) \
		.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	flight.tween_property(star, "rotation", randf_range(-3.0, 3.0), 0.7)
	flight.tween_property(star, "modulate:a", 0.0, 0.3).set_delay(0.4)
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


## Closes the dialog once the opening has played out (_chest_take is on); before that, nothing.
func _on_chest_button() -> void:
	if game.state != Game.State.CHEST or Time.get_ticks_msec() < _accept_picks_at:
		return
	if not _chest_revealed or _chest_take == null or _chest_take.disabled:
		return
	game.close_chest()


# --- Revive --------------------------------------------------------------------------------

## The player died holding `left` 返聘 (Game.revive_offered): spend one and carry on, or go home
## (the result screen) and keep it for another run. The player's call (.43), not automatic.
func _show_revive(left: int) -> void:
	_clear(_revive_holder)
	var dialog := UiKit.panel(UiKit.dialog_box(Vector4(18, 18, 18, 18)))
	dialog.custom_minimum_size = Vector2(minf(320.0, _root.size.x - 40.0), 0.0)
	_revive_holder.add_child(dialog)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 10)
	dialog.add_child(column)
	column.add_child(UiKit.kicker("REHIRE"))
	var title := UiKit.label("项目黄了…", 26, "heavy")
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(title)
	var art := UiKit.icon("rehire", 72)
	art.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	column.add_child(art)
	var question := UiKit.label("用一次返聘回来接着干？", 16, "strong")
	question.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(question)
	var note := UiKit.label(tr("回到一半生命，%d 秒无敌，身边的怪会被震开。还剩 %d 次返聘，每局最多用一次。") \
		% [roundi(Game.REVIVE_INVULN), left], 12, "muted")
	note.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	note.custom_minimum_size.x = dialog.custom_minimum_size.x - 36.0
	column.add_child(note)
	var buttons := HBoxContainer.new()
	buttons.alignment = BoxContainer.ALIGNMENT_CENTER
	buttons.add_theme_constant_override("separation", 10)
	column.add_child(buttons)
	# Ignored for PICK_DELAY_MS, like the level-up cards: a tap meant for dodging as the player
	# died mustn't decide for them.
	var home := UiKit.secondary_button("下班", func() -> void:
		if Time.get_ticks_msec() >= _accept_picks_at:
			game.decline_revive(), 46.0, 15)
	home.custom_minimum_size.x = 110.0
	buttons.add_child(home)
	var rehire := UiKit.primary_button("返聘", func() -> void:
		if Time.get_ticks_msec() >= _accept_picks_at:
			game.accept_revive(), 46.0, 17)
	rehire.custom_minimum_size.x = 150.0
	buttons.add_child(rehire)
	_pop_in(dialog, 0.0)
	_accept_picks_at = Time.get_ticks_msec() + PICK_DELAY_MS
	_fit_to_screen(_revive_holder)
	_focus(rehire)


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
	build.add_child(UiKit.label(tr("武器 %d / %d") % [weapon_chips.size(), game.upgrades.weapon_limit()], 12, "strong", Art.INK_MUTED))
	build.add_child(_chip_grid(weapon_chips, Art.SKY_LIGHT))
	var passive_chips: Array = []
	for passive_id: String in game.upgrades.passive_levels:
		var passive: Dictionary = Upgrades.PASSIVES[passive_id]
		passive_chips.append([passive["name"], game.upgrades.passive_levels[passive_id], passive["art"], false])
	build.add_child(UiKit.gap(4))
	build.add_child(UiKit.label(tr("被动 %d / %d") % [passive_chips.size(), game.upgrades.passive_limit()], 12, "strong", Art.INK_MUTED))
	build.add_child(_chip_grid(passive_chips, Art.MINT_LIGHT))

	var player := game.player
	var stats := UiKit.panel(UiKit.box(Art.PAPER_SOFT, Color.TRANSPARENT, 0, UiKit.RADIUS_MD, Vector4(10, 8, 10, 8)))
	var stat_grid := GridContainer.new()
	stat_grid.columns = 3
	stat_grid.add_theme_constant_override("h_separation", 10)
	stat_grid.add_theme_constant_override("v_separation", 6)
	stat_grid.mouse_filter = Control.MOUSE_FILTER_IGNORE
	# The minimap's colours under the numbers (0.1.0): what each dot is.
	var stats_column := VBoxContainer.new()
	stats_column.add_theme_constant_override("separation", 8)
	stats_column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	stats.add_child(stats_column)
	stats_column.add_child(stat_grid)
	stats_column.add_child(Minimap.legend())
	# Health as it is now only: the cap shows on the bar under the player anyway.
	for stat: Array in [
		["生命", str(ceili(player.hp))],
		["伤害", "×%.2f" % player.might],
		["冷却", "×%.2f" % player.cooldown_scale],
		["移速", str(roundi(player.move_speed))],
		["拾取", str(roundi(player.pickup_radius))],
		["护甲 · 回血", "%s · %s/s" % [Upgrades._amount_text(player.armor), Upgrades._amount_text(player.regen)]],
		["运气", str(roundi(player.luck))],
		["返聘（本局已用）" if game.revived else "返聘", str(Progress.revives_left())],
		["刷新（本局还剩）", str(player.rerolls)],
		# 加班申请 signed this run (.99): enemy health and bonus pay both up.
		["加班申请", "×%d" % game.signed_forms],
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
	# Back to the title screen, giving the run up (.39, the user asked for a way back to the first
	# page; named for the title's 开始搬砖), as the result screen's 回主页 does.
	var clock_out := UiKit.secondary_button("下班", game.change_job)
	clock_out.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	second_row.add_child(clock_out)
	var third_row := HBoxContainer.new()
	third_row.add_theme_constant_override("separation", 8)
	actions.add_child(third_row)
	# The run so far as a result image, to show off (or ask for help) mid-run.
	var share := UiKit.secondary_button("分享", _make_share_image)
	share.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	third_row.add_child(share)
	var settings := _settings_button()
	settings.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	third_row.add_child(settings)
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

	# A win clocked out at 10:00 and went on (0.3.29): the title says how long. 无尽模式 never won.
	left.add_child(UiKit.kicker("IPO DAY" if victory else "ENDLESS" if game.endless else "GAME OVER"))
	var title_text := tr("撑满 60 分钟！") if game.full_hour() else tr("加班到 %s") % _clock_text(game.elapsed) if victory \
		else tr("无尽加班！") if game.endless else tr("项目黄了…")
	var title := UiKit.label(title_text, 30, "heavy")
	title.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	left.add_child(title)
	var sub_text := tr("第 %d 局 · %s") % [game.runs_before + 1, tr(Jobs.data(game.player.job)["name"])]
	if game.endless:
		sub_text += " · " + tr("无尽模式")
	var sub := UiKit.label(sub_text, 13, "muted")
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	left.add_child(sub)

	var stats := HBoxContainer.new()
	stats.add_theme_constant_override("separation", 8)
	left.add_child(stats)
	# How long it lasted is what the board ranks (0.3.29; a clear's time .78–0.3.28).
	for stat: Array in [["撑了" if victory or game.endless else "存活", _clock_text(game.elapsed)], ["职级", Maps.rank_of(game.level)], ["击杀", str(game.kills)]]:
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

	# A clear, or (.96) a run that lasted Leaderboard.MIN_SECONDS, goes on the map's board.
	if not Leaderboard.pending.is_empty():
		_board_row = VBoxContainer.new()
		_board_row.add_theme_constant_override("separation", 6)
		left.add_child(_board_row)
		_send_clear()
	var culprit := _culprit_row(victory)
	if culprit != null:
		left.add_child(culprit)
	var earned := _earned_row()
	if earned != null:
		left.add_child(earned)
	var advice := _end_advice(victory)
	if not advice.is_empty():
		left.add_child(_advice_card(advice))
	var feedback := _end_feedback_row()
	if feedback != null:
		left.add_child(feedback)
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
	# 回主页 since .46 (was 换职业, the user: 改成类似回到主页的意思): it goes back to the title screen,
	# where the job and the map are picked.
	var change := UiKit.secondary_button("回主页", game.change_job, 50.0, 15)
	change.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	buttons.add_child(change)
	var again := UiKit.primary_button("再来一局", game.restart)
	again.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	again.size_flags_stretch_ratio = 1.3
	buttons.add_child(again)
	_focus(again)
	_pop_in(page, 0.0)
	_fit_to_screen(_end_holder)


## What the run added to 局外成长, on gold: 工资 for 培训 (.44), landmarks checked in at and
## achievements earned; null when nothing.
func _earned_row() -> Control:
	var parts := PackedStringArray()
	if game.salary_earned > 0:
		# With the 加班申请 signed (.99), which made it bigger.
		parts.append(tr("工资 +¥%d") % game.salary_earned if game.signed_forms == 0 \
			else tr("工资 +¥%d（加班申请 ×%d）") % [game.salary_earned, game.signed_forms])
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
		# A boss has the last word (BossKits): 「项目延期，责任在你」.
		var last_word: String = BossKits.KITS[killer]["lines"].get("kill", "") if BossKits.has(killer) else ""
		var how := game.telemetry.last_hurt_how
		var cause: String = tr("「%s」") % tr(last_word) if last_word != "" \
			else tr(KILL_CAUSES.get(how, "被 boss 撞倒" if data.get("elite", false) else "被围殴"))
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


## Weapons (and the perks that deal damage) by their share of all damage dealt this run, each with
## its damage per second while the player had it (Game.dps_of, .46, the user: 伤害排行加个每秒伤害),
## or null when nothing dealt any.
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
		var per_second := UiKit.label(tr("%d/秒") % roundi(game.dps_of(entry[0])), 12, "display", Art.INK_MUTED)
		per_second.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
		per_second.custom_minimum_size = Vector2(52, 0)
		per_second.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		row.add_child(per_second)
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
	# The cloud save's row moved to the 个人 page in .96 (the user: 云存档放个人).
	var cloud := Cloud.shared()
	if cloud != null and cloud.status != Cloud.Status.OFF:
		# 提意见 (.94) goes through the same server, so it shows where the cloud save does.
		var feedback_note := UiKit.label("Bug、太难太简单、想要什么，都可以说。只有开发者能看到", 12, "muted")
		feedback_note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		var write := UiKit.secondary_button("写几句", func() -> void: _ask_feedback("settings", feedback_note), 40.0)
		write.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
		var feedback_row := _setting_row("提意见", "Feedback", write, "")
		feedback_row.add_child(feedback_note)
		feedback_row.move_child(feedback_note, feedback_row.get_child_count() - 2)
		general.append(feedback_row)
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


## The 成就 and 个人 pages (one 收藏 page until .96): every landmark (checked in at or still to find, with where it is and what it
## gives), every achievement (with progress for the counted ones) and the 图鉴, on three tabs.
## The 成就 page (.96): achievements (with their 工资 prizes) and landmarks, side by side tabs.
func _open_awards(tab: int = 0) -> void:
	_collection_kind = "awards"
	_open_collection(tab)


## The 个人 page (.96): who the player is and how they've done (生涯), their runs (战绩), the
## 怪物图鉴 and, under 生涯, the cloud save.
func _open_profile(tab: int = 0) -> void:
	_collection_kind = "profile"
	_open_collection(tab)


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
	var profile := _collection_kind == "profile"
	var title := UiKit.label("个人" if profile else "成就", 22, "heavy")
	title.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(title)
	var stamped := 0
	for map_id: String in Maps.ORDER:
		stamped += Maps.stamps_on(map_id)
	# Only the achievements in play (a switched-off feature's one is hidden even if earned).
	var earned := Achievements.earned_count()
	var names: Array
	if profile:
		names = [tr("生涯"), tr("战绩"), "%s %d/%d" % [tr("图鉴"), Bestiary.seen_count(), Bestiary.ids().size()]]
	else:
		names = ["%s %d/%d" % [tr("成就"), earned, Achievements.shown().size()],
			"%s %d/%d" % [tr("打卡"), stamped, Maps.stamp_count()]]
	var tabs := UiKit.segmented(names, _collection_tab, _open_collection, Art.PAPER_SUNK)
	tabs.custom_minimum_size.x = 300.0
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
	match [_collection_kind, _collection_tab]:
		["awards", 1]:
			_fill_stamps(body, portrait)
		["awards", _]:
			_fill_achievements(body, portrait)
		["profile", 1]:
			_fill_history(body)
		["profile", 2]:
			_fill_bestiary(body, portrait)
		_:
			_fill_profile(body, portrait)
	_focus(back)


## The 个人 page's 生涯 (.96): face, 昵称 and how long they've been at it; the trophies (to the 成就
## page); the totals kept across runs; wins by job and by map; and the cloud save (moved here from
## 设置, the user: 云存档放个人).
func _fill_profile(body: VBoxContainer, portrait: bool) -> void:
	var cloud := Cloud.shared()
	var card := UiKit.panel(UiKit.box(Art.PAPER, Art.INK, UiKit.OUTLINE, UiKit.RADIUS_CARD, Vector4(12, 10, 12, 10)))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	card.add_child(row)
	row.add_child(UiKit.well(Jobs.data(game.player.job)["art"], 56.0, Art.BRAND_SOFT))
	var who := VBoxContainer.new()
	who.add_theme_constant_override("separation", 2)
	who.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	who.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(who)
	var has_name := Leaderboard.has_name()
	var name_label := UiKit.label(cloud.display_name if has_name else tr("还没有昵称"), 18, "heavy", Art.INK if has_name else Art.INK_MUTED)
	name_label.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
	name_label.clip_text = true
	who.add_child(name_label)
	# 入职: when 第一天上班 was earned (the first run's end); the save keeps the earliest time.
	var runs := int(Progress.stat("runs", 0))
	var since := Progress.achievement_time("first_day")
	var tenure := tr("共 %d 局") % runs
	if since > 0:
		var days := floori((Time.get_unix_time_from_system() - since) / 86400.0) + 1
		tenure = tr("入职第 %d 天 · 共 %d 局") % [days, runs]
	var tenure_label := UiKit.label(tenure, 12, "muted")
	tenure_label.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
	who.add_child(tenure_label)
	# Picked once (.97): only asked for while there's none.
	if Leaderboard.online() and not has_name:
		var pick := UiKit.secondary_button("起昵称", func() -> void:
			_ask_name(func(_answer: Dictionary) -> void: _open_profile(0)), 34.0, 13)
		pick.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		row.add_child(pick)
	body.add_child(card)

	# The trophies at a glance, on a strip that opens the 成就 page (the list is there). Narrow
	# enough for an upright phone: anything wider than the screen widens the whole page.
	var strip := UiKit.panel(UiKit.box(Art.PAPER, Art.LINE, 1, UiKit.RADIUS_MD, Vector4(10, 8, 10, 8)))
	var line := HBoxContainer.new()
	line.add_theme_constant_override("separation", 6)
	line.mouse_filter = Control.MOUSE_FILTER_IGNORE
	strip.add_child(line)
	# Wrapping onto a second line when the tier names are long (English: Platinum 0/1 Gold 0/17…).
	var trophies := HFlowContainer.new()
	trophies.add_theme_constant_override("h_separation", 10)
	trophies.add_theme_constant_override("v_separation", 6)
	trophies.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	trophies.mouse_filter = Control.MOUSE_FILTER_IGNORE
	line.add_child(trophies)
	for count: Array in Achievements.tier_counts():
		var tier: Dictionary = Achievements.TIERS[count[0]]
		var cell := HBoxContainer.new()
		cell.add_theme_constant_override("separation", 3)
		cell.mouse_filter = Control.MOUSE_FILTER_IGNORE
		cell.add_child(UiKit.tag(tr(tier["name"]), tier["color"], Art.PAPER))
		var tally := UiKit.label("%d/%d" % [count[1], count[2]], 12, "strong", Art.INK)
		tally.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
		cell.add_child(tally)
		trophies.add_child(cell)
	var more := UiKit.label("›", 16, "heavy", Art.INK_MUTED)
	more.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	line.add_child(more)
	var tap := Button.new()
	tap.flat = true
	tap.focus_mode = Control.FOCUS_NONE
	for look in ["normal", "hover", "pressed", "focus"]:
		tap.add_theme_stylebox_override(look, StyleBoxEmpty.new())
	tap.pressed.connect(func() -> void: _open_awards(0))
	strip.add_child(tap)
	body.add_child(strip)

	# Totals over every run (Achievements.finish keeps them), then the best of the runs still kept.
	var entries := RunHistory.entries()
	var longest := 0
	for entry: Dictionary in entries:
		longest = maxi(longest, int(entry.get("seconds", 0)))
	var wins_by_job: Dictionary = Progress.stat("wins", {})
	var map_wins: Dictionary = Progress.stat("map_wins", {})
	var wins := 0
	for count: Variant in map_wins.values():
		wins += int(count)
	# Bosses: every 怪物图鉴 group after the first (小怪), the maps' four each.
	var boss_kills := 0
	for group: Dictionary in Bestiary.GROUPS.slice(1):
		for type_id: String in group["ids"]:
			boss_kills += Bestiary.kills(type_id)
	body.add_child(UiKit.label("生涯数据", 13, "strong", Art.INK_MUTED))
	var grid := GridContainer.new()
	grid.columns = 3 if portrait else 5
	grid.add_theme_constant_override("h_separation", 8)
	grid.add_theme_constant_override("v_separation", 8)
	for stat: Array in [
		["局数", str(runs)],
		["通关", str(wins)],
		["累计击杀", str(int(Progress.stat("kills", 0)))],
		["打掉 boss", str(boss_kills)],
		["最长存活", _clock_text(longest) if longest > 0 else "-"],
	]:
		grid.add_child(_stat_cell(stat[0], stat[1]))
	body.add_child(grid)

	body.add_child(UiKit.label("各职业通关", 13, "strong", Art.INK_MUTED))
	var jobs := HBoxContainer.new()
	jobs.add_theme_constant_override("separation", 6)
	for job_id: String in Jobs.ORDER:
		var cell := VBoxContainer.new()
		cell.add_theme_constant_override("separation", 0)
		cell.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		cell.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var face := UiKit.icon(Jobs.data(job_id)["art"], 34)
		face.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
		cell.add_child(face)
		var count := UiKit.label("×%d" % int(wins_by_job.get(job_id, 0)), 13, "strong", Art.INK)
		count.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
		count.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		cell.add_child(count)
		jobs.add_child(cell)
	body.add_child(jobs)

	body.add_child(UiKit.label("各地图" if Maps.ORDER.size() > 1 else "地图", 13, "strong", Art.INK_MUTED))
	for map_id: String in Maps.ORDER:
		body.add_child(_map_record_row(map_id, int(map_wins.get(map_id, 0)), entries))

	if cloud != null and cloud.status != Cloud.Status.OFF:
		body.add_child(UiKit.label("云存档", 13, "strong", Art.INK_MUTED))
		var manage := UiKit.secondary_button("管理存档", _open_save_page, 40.0)
		manage.icon = Art.texture("floppy")
		manage.add_theme_constant_override("icon_max_width", 18)
		manage.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
		var rows: Array[Control] = [_setting_row("云存档", "Cloud Save", manage, CLOUD_STATUS_TEXT[cloud.status])]
		body.add_child(_settings_card(rows))


## A number with its caption under it, on a soft card (the 个人 page's totals).
func _stat_cell(caption: String, value: String) -> Control:
	var cell := UiKit.panel(UiKit.box(Art.PAPER_SOFT, Color.TRANSPARENT, 0, UiKit.RADIUS_MD, Vector4(10, 6, 10, 6)))
	cell.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 0)
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	cell.add_child(column)
	var number := UiKit.label(value, 17, "display")
	number.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
	column.add_child(number)
	column.add_child(UiKit.label(caption, 11, "muted"))
	return cell


## A map on the 个人 page: its landmark, name, how many clears, and the best of the kept runs there
## (the fastest clear, or the longest run when none was won), as the boards put it.
func _map_record_row(map_id: String, wins: int, entries: Array) -> Control:
	var strip := UiKit.panel(UiKit.box(Art.PAPER, Art.LINE, 1, UiKit.RADIUS_MD, Vector4(10, 6, 10, 6)))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	strip.add_child(row)
	row.add_child(UiKit.icon(MapList.icon_of(map_id), MAP_ICON))
	var name := UiKit.label(Maps.label_of(map_id), 13, "strong", Art.INK)
	name.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	name.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(name)
	var fastest := 0
	var longest := 0
	for entry: Dictionary in entries:
		if str(entry.get("map", "")) != map_id:
			continue
		var seconds := int(entry.get("seconds", 0))
		if entry.get("result", "") == "win":
			fastest = seconds if fastest == 0 else mini(fastest, seconds)
		else:
			longest = maxi(longest, seconds)
	var best := "-"
	if fastest > 0:
		best = Leaderboard.record_text(fastest * 1000, true)
	elif longest > 0:
		best = Leaderboard.record_text(longest * 1000, false)
	var numbers := UiKit.label(tr("通关 %d 次 · 最好 %s") % [wins, best], 12, "muted")
	numbers.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
	numbers.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(numbers)
	return strip


func _fill_stamps(body: VBoxContainer, portrait: bool) -> void:
	var totals := Stamps.total_text()
	var summary := tr("地标按时开门，站进圈里满 10 秒就能打卡，每个地标都送一点永久加成") if totals.is_empty() \
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
			# Its prize (.96), always shown (.99, the user: 成就拿到了之后，怎么就不展示金钱了，也要展示啊),
			# with 已入账 once paid; one earned before .96 wasn't paid (不用补发), so it's just the amount.
			var prize := Achievements.prize_of(entry["id"])
			if done and Progress.has_salary(Achievements.salary_id(entry["id"])):
				lines.append(tr("奖金 ¥%d 已入账") % prize)
			else:
				lines.append(tr("奖金 ¥%d") % prize)
			var tier := Achievements.tier_of(entry["id"])
			var badge := [tr(tier["name"]), tier["color"]]
			grid.add_child(_collection_card(entry["art"], tr(entry["name"]), lines, done, counted if not done else [], portrait, badge))


## The 怪物图鉴: each group's enemies, a silhouette until met; then what it is, its numbers (the
## regular ones; a boss's depend on when it comes), its attacks and how to dodge them, the maps it
## turns up on, and how many have been killed.
## 战绩 (66, the user: 支持查看历史战绩): the runs kept (RunHistory), newest first, under a line of
## totals over them; tapping one opens its details (what did the damage, who ended it, 工资).
func _fill_history(body: VBoxContainer) -> void:
	var entries := RunHistory.entries()
	if entries.is_empty():
		body.add_child(_collection_note(tr("还没有战绩：打满 30 秒的局（通关、被裁、下班）都会记在这里，留最近 %d 局") % Progress.RUNS_KEPT))
		return
	var wins := 0
	var longest := 0
	var most_kills := 0
	for entry: Dictionary in entries:
		wins += 1 if entry.get("result", "") == "win" else 0
		longest = maxi(longest, int(entry.get("seconds", 0)))
		most_kills = maxi(most_kills, int(entry.get("kills", 0)))
	body.add_child(_collection_note(tr("最近 %d 局 · 通关 %d 次 · 最长存活 %s · 最多击杀 %d") % [entries.size(), wins, _clock_text(longest), most_kills]))
	for entry: Dictionary in entries:
		body.add_child(_history_row(entry))


## One run of 战绩: the job's face, map and job, how long it lasted, its grade and kills, how it
## ended and when; opened, the damage ranking, who ended it and the 工资 it paid.
func _history_row(entry: Dictionary) -> Control:
	var run_id: String = entry["id"]
	var opened: bool = _history_open.has(run_id)
	# A card that grows with what's in it (a Button doesn't), with a see-through button laid over
	# it to take the tap.
	var row := UiKit.panel(UiKit.box(Art.PAPER, Art.LINE, 1, UiKit.RADIUS_MD, Vector4(10, 8, 10, 8)))
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 6)
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(column)
	var line := HBoxContainer.new()
	line.add_theme_constant_override("separation", 10)
	line.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(line)
	var job: Dictionary = Jobs.data(str(entry.get("job", "")))
	var face := UiKit.well(job["art"], 34.0, Art.PAPER_SUNK, 10)
	face.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	line.add_child(face)
	var words := VBoxContainer.new()
	words.add_theme_constant_override("separation", 0)
	words.mouse_filter = Control.MOUSE_FILTER_IGNORE
	words.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	line.add_child(words)
	var map_id := str(entry.get("map", "sv"))
	var where := tr(Maps.script_of(map_id).NAME) if Maps.ORDER.has(map_id) else map_id
	var heading := "%s · %s" % [where, tr(job["name"])]
	if entry.get("endless", false):
		heading += " · " + tr("无尽模式")
	words.add_child(UiKit.label(heading, 13, "heavy"))
	var numbers := UiKit.label(tr("存活 %s · %s · 击杀 %d") % [_clock_text(int(entry.get("seconds", 0))), RunHistory.rank_text(entry), int(entry.get("kills", 0))], 11, "muted")
	numbers.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
	words.add_child(numbers)
	var ending := VBoxContainer.new()
	ending.add_theme_constant_override("separation", 2)
	ending.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ending.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	line.add_child(ending)
	var look: Array = RunHistory.RESULTS.get(str(entry.get("result", "")), RunHistory.RESULTS["quit"])
	var pill := UiKit.panel(UiKit.box(look[1], Color.TRANSPARENT, 0, UiKit.PILL, Vector4(8, 0, 8, 1)))
	pill.mouse_filter = Control.MOUSE_FILTER_IGNORE
	pill.size_flags_horizontal = Control.SIZE_SHRINK_END
	pill.add_child(UiKit.label(look[0], 11, "heavy", look[2]))
	ending.add_child(pill)
	var date := UiKit.label(RunHistory.date_text(entry), 10, "muted")
	date.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
	date.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	ending.add_child(date)
	if opened:
		column.add_child(_history_details(entry))
	var tap := Button.new()
	tap.flat = true
	tap.focus_mode = Control.FOCUS_NONE
	for state in ["normal", "hover", "pressed", "focus"]:
		tap.add_theme_stylebox_override(state, StyleBoxEmpty.new())
	tap.pressed.connect(func() -> void:
		if opened:
			_history_open.erase(run_id)
		else:
			_history_open[run_id] = true
		_open_collection(_collection_tab))
	row.add_child(tap)
	return row


## A run's details: what did the damage, who ended it, what it paid.
func _history_details(entry: Dictionary) -> Control:
	var lines := PackedStringArray()
	var evolved: Array = entry.get("evolved", [])
	var damage := PackedStringArray()
	for source: Array in entry.get("damage", []):
		damage.append("%s %d%%" % [RunHistory.source_name(source[0], evolved), source[1]])
	if not damage.is_empty():
		lines.append(tr("伤害：") + " · ".join(damage))
	var killer := str(entry.get("killer", ""))
	if entry.get("result", "") == "died" and Spawner.ENEMY_TYPES.has(killer):
		lines.append(tr("被%s裁掉") % tr(Spawner.ENEMY_TYPES[killer]["name"]))
	if int(entry.get("salary", 0)) > 0:
		lines.append(tr("工资 +¥%d") % int(entry["salary"]))
	var details := UiKit.label("\n".join(lines) if not lines.is_empty() else tr("没有更多记录"), 12)
	details.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
	details.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	return details


func _fill_bestiary(body: VBoxContainer, portrait: bool) -> void:
	# Bosses drawn per run since .99 (Spawner._draw_bosses), listed by the time they come.
	body.add_child(_collection_note(tr("遇到过的怪会收进图鉴；每局 2:00、4:00、6:00、8:00 各从 5 个 boss 里抽一个")))
	for group: Dictionary in Bestiary.shown_groups():
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
			if BossKits.has(id):
				# 招式：冲刺（近战）· 红带是它要冲的路线，横着躲开
				for attack: Dictionary in BossKits.describe(id):
					lines.append(tr("招式：") + "%s（%s）· %s" % [tr(attack["name"]), tr(attack["kind"]), tr(attack["hint"])])
				lines.append(tr("出现在：") + "、".join(Bestiary.maps_of(id)))
			else:
				lines.append(tr("生命 %d · 速度 %d · 伤害 %d") % [data["hp"], data["speed"], data["damage"]])
			lines.append(tr("累计击杀 %d") % Bestiary.kills(id))
			grid.add_child(_collection_card(data["art"], tr(data["name"]), lines, true, [], portrait))


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
		_confirm_reset = 0
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

	if not disabled and _confirm_delete:
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
	_fill_reset(body)


## 重置进度 (.56), at the bottom of the 云存档 page: on the title screen only (not over a paused run),
## and not in 测试模式 (whose saves are thrown away anyway). Asks twice: first what goes and what
## stays (the old 存档码 shown, to write down), then a last confirmation.
func _fill_reset(body: VBoxContainer) -> void:
	if game.state != Game.State.TITLE or TestMode.on:
		return
	body.add_child(UiKit.label(tr("重置进度"), 13, "strong", Art.INK_MUTED))
	if _confirm_reset == 0:
		body.add_child(_save_buttons([_save_button("重置进度", func() -> void:
			_confirm_reset = 1
			_open_save_page()
			_scroll_after_layout(_save_scroll, 1 << 20))]))
		return
	var cloud := Cloud.shared()
	var lines := PackedStringArray()
	if _confirm_reset == 1:
		lines.append(tr("重置会清空这台设备上的全部进度：打卡、成就、图鉴、工资和培训、返聘、各地图的通关记录，从头开始。"))
		if cloud != null and cloud.code != "":
			lines.append(tr("这台设备会换一个新的存档码。原来的存档码 %s 还能用：别的设备上的进度不受影响，以后输入它还能把旧进度合并回来，先记下来。") % Cloud.format_code(cloud.code))
		else:
			lines.append(tr("这台设备还没有存档码，重置以后旧进度就找不回来了。"))
	else:
		lines.append(tr("最后确认：真的要清空这台设备上的全部进度吗？"))
	var confirm := UiKit.panel(UiKit.box(Art.PINK_LIGHT, Color.TRANSPARENT, 0, UiKit.RADIUS_MD, Vector4(12, 10, 12, 10)))
	var confirm_column := VBoxContainer.new()
	confirm_column.add_theme_constant_override("separation", 10)
	confirm.add_child(confirm_column)
	for line in lines:
		var warning := UiKit.label(line, 13, "strong", Art.BOSS_RED)
		warning.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		confirm_column.add_child(warning)
	var go_on := _save_button("下一步" if _confirm_reset == 1 else "确定重置", func() -> void:
		if _confirm_reset == 1:
			_confirm_reset = 2
			_open_save_page()
			_scroll_after_layout(_save_scroll, 1 << 20)
		else:
			_reset_progress())
	confirm_column.add_child(_save_buttons([go_on, _save_button("取消", func() -> void:
		_confirm_reset = 0
		_open_save_page())]))
	body.add_child(confirm)


## Clears this device's progress for a fresh account and 存档码 (Cloud.leave_account, then
## Progress.clear_all, then Cloud.reconnect, in that order so the old copy can't merge back), and
## starts the title screen over on the empty save.
func _reset_progress() -> void:
	_confirm_reset = 0
	var cloud := Cloud.shared()
	var account := cloud.account_id() if cloud != null else ""
	if cloud != null:
		await _save_action(cloud.leave_account)
	Progress.clear_all()
	Telemetry.send_event("cloud_action", {"action": "reset", "result": "ok", "account": account})
	if cloud != null:
		cloud.reconnect()
	# Back to the title screen on the same map, rebuilt from the empty save.
	game.change_map(Maps.current_id)


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
## (the 成就 and 个人 pages' counts, the title screen's map lock).
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


## Sends the run just ended to its board (won, or since .96 lasted a minute) when the player has a
## 昵称, and says how it went.
func _send_clear() -> void:
	if not Leaderboard.online():
		_show_board_row(tr("连上云端后才能上排行榜"), false)
		return
	if not Leaderboard.has_name():
		_show_board_row(tr("起个昵称，这次的成绩就能上%s榜") % _board_name(), true)
		return
	_show_board_row(tr("正在上榜…"), false)
	var answer: Dictionary = await Leaderboard.submit()
	# 榜上有名 (0.3.18): top 3 on the board or the job's.
	if answer.get("ok", false):
		game.achievements.on_board_rank(Leaderboard.last_rank, Leaderboard.last_job_rank)
	if answer.get("ok", false):
		var line := tr("%s榜第 %d 名 · 最好 %s") % [_board_name(), Leaderboard.last_rank, Leaderboard.record_text(Leaderboard.last_best_ms, Leaderboard.last_best_cleared)]
		# And among this job's (0.3.7; a server before says nothing).
		if Leaderboard.last_job_rank > 0:
			line += " · " + tr("%s第 %d 名") % [tr(Jobs.data(game.player.job)["name"]), Leaderboard.last_job_rank]
		_show_board_row(line, false)
	else:
		_show_board_row(Leaderboard.error_text(answer), not Leaderboard.has_name())


## The map's name as its board is called on the result screen: 硅谷, or 硅谷无尽 for 无尽模式's.
func _board_name() -> String:
	return tr("%s无尽") % tr(Maps.current.NAME) if game.endless else tr(Maps.current.NAME)


## The result screen's board line: a note, and the 起个昵称 button while one is wanted.
func _show_board_row(text: String, ask_name: bool) -> void:
	if not is_instance_valid(_board_row):
		return
	_clear(_board_row)
	var strip := UiKit.panel(UiKit.box(Art.BRAND_SOFT, Color.TRANSPARENT, 0, UiKit.RADIUS_MD, Vector4(12, 8, 12, 8)))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	strip.add_child(row)
	row.add_child(UiKit.icon("star_gold", 18))
	var note := UiKit.label(text, 13, "strong", Art.INK)
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	note.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(note)
	if ask_name:
		row.add_child(UiKit.secondary_button("起昵称", func() -> void: _ask_name(_on_end_name), 34.0, 13))
	elif Leaderboard.online():
		row.add_child(UiKit.secondary_button("看榜", _open_board, 34.0, 13))
	_board_row.add_child(strip)


func _on_end_name(answer: Dictionary) -> void:
	if answer.get("ok", false):
		_send_clear()
	else:
		_show_board_row(Leaderboard.error_text(answer), true)


## Asks for a 昵称 (the page's own field on the web, where the game's fields bring up no keyboard
## on a phone; a field of the game's elsewhere) and sets it; `done` gets the server's answer once
## it's set. Picked once and for good, unique (.97, the user: 去掉改昵称逻辑，新建昵称需要全局唯一，
## 输入的时候校验): the server is asked as the player types (a pause of NAME_CHECK_DELAY), the line
## under the field says whether it's free, 确定 waits for a yes, and the dialog stays up when the
## server turns it down on 确定 (taken in the meantime), saying why.
func _ask_name(done: Callable) -> void:
	if OS.has_feature("web"):
		var page := JavaScriptBridge.get_interface("survivorsCode")
		if page != null:
			_name_check_callback = JavaScriptBridge.create_callback(func(args: Array) -> void:
				var value := str(args[0])
				var answer: Dictionary = await Leaderboard.check_name(value)
				page.nameStatus(value, _name_status_text(answer), answer.get("ok", false), false))
			_name_callback = JavaScriptBridge.create_callback(func(args: Array) -> void:
				var value := str(args[0])
				var answer: Dictionary = await Leaderboard.set_name(value)
				if answer.get("ok", false):
					page.nameStatus(value, "", true, true)
					done.call(answer)
				else:
					page.nameStatus(value, Leaderboard.error_text(answer), false, false))
			page.askName(tr("起个昵称"), tr("排行榜上显示的名字，2–12 个字，不能和别人重复，起了就不能改"), tr("比如：摸鱼的程序员"),
				tr("确定"), tr("取消"), _name_callback, _name_check_callback)
			return
	_name_dialog(done)


## What the 昵称 dialog says under the field for a check's answer: 可以用, or why not.
func _name_status_text(answer: Dictionary) -> String:
	return tr("可以用") if answer.get("ok", false) else Leaderboard.error_text(answer)


## The result screen's 提意见 line (.94): right after a run is when there's most to say. Null
## where the cloud save isn't in use (nothing to send it through).
func _end_feedback_row() -> Control:
	var cloud := Cloud.shared()
	if cloud == null or cloud.status == Cloud.Status.OFF:
		return null
	var strip := UiKit.panel(UiKit.box(Art.PAPER_SUNK, Color.TRANSPARENT, 0, UiKit.RADIUS_MD, Vector4(12, 6, 12, 6)))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	strip.add_child(row)
	var note := UiKit.label("这局有什么想说的？", 13, "strong", Art.INK)
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	note.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	note.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(note)
	row.add_child(UiKit.secondary_button("提意见", func() -> void: _ask_feedback("end", note), 34.0, 13))
	return strip


## Asks for a few lines of 提意见 (the page's own field on the web, as for the 昵称; a field of the
## game's elsewhere) and sends them; `note` says how it went. Not opened while the cloud save is
## off line, so nothing typed is lost.
func _ask_feedback(where: String, note: Label) -> void:
	if not Feedback.online():
		_set_feedback_note(note, tr(Feedback.ERRORS["offline"]), false)
		Telemetry.send_event("feedback", {"action": "offline", "where": where})
		return
	Telemetry.send_event("feedback", {"action": "open", "where": where})
	var asked := func(text: String) -> void:
		if text.strip_edges() == "":
			return
		_set_feedback_note(note, tr("正在发送…"), true)
		var answer: Dictionary = await Feedback.send(text, where)
		if answer.get("ok", false):
			_set_feedback_note(note, tr("收到了，谢谢！每条都会看"), true)
		else:
			_set_feedback_note(note, tr(Feedback.error_text(answer)), false)
	var title := tr("提意见")
	var hint := tr("Bug、太难太简单、想要什么，都可以说。只有开发者能看到")
	var placeholder := tr("比如：第一个 boss 太难了")
	if OS.has_feature("web"):
		var page := JavaScriptBridge.get_interface("survivorsCode")
		if page != null:
			_feedback_callback = JavaScriptBridge.create_callback(func(args: Array) -> void: asked.call(str(args[0])))
			page.askText(title, hint, placeholder, Feedback.MAX_LENGTH, tr("发送"), tr("取消"), _feedback_callback)
			return
	_feedback_dialog(title, hint, placeholder, asked)


## The 提意见 line's text: sent (ink) or not (red). The page may have been redrawn since.
func _set_feedback_note(note: Label, text: String, ok: bool) -> void:
	if not is_instance_valid(note):
		return
	note.text = text
	note.add_theme_color_override("font_color", Art.INK if ok else Art.BOSS_RED)


## A computer build's 提意见 dialog: a few lines and two buttons over the screen.
func _feedback_dialog(title: String, hint: String, placeholder: String, asked: Callable) -> void:
	var cover := ColorRect.new()
	cover.color = Color(Art.INK, 0.45)
	cover.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	cover.mouse_filter = Control.MOUSE_FILTER_STOP
	# Under the themed root: added to the layer itself, its text came out white (no theme there).
	_root.add_child(cover)
	var center := _centered(cover)
	var card := UiKit.panel(UiKit.box(Art.PAPER, Art.INK, UiKit.OUTLINE, UiKit.RADIUS_CARD, Vector4(18, 16, 18, 16)))
	center.add_child(card)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 10)
	card.add_child(column)
	column.add_child(UiKit.label(title, 18, "heavy"))
	var hint_label := UiKit.label(hint, 12, "muted")
	hint_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	hint_label.custom_minimum_size.x = 320
	column.add_child(hint_label)
	var field := TextEdit.new()
	field.placeholder_text = placeholder
	field.wrap_mode = TextEdit.LINE_WRAPPING_BOUNDARY
	field.custom_minimum_size = Vector2(320, 120)
	# Styled like the 存档码 field (_code_entry): Godot's default TextEdit is dark grey.
	field.add_theme_stylebox_override("normal", UiKit.box(Art.PAPER_SUNK, Art.LINE_STRONG, UiKit.OUTLINE, UiKit.RADIUS_MD, Vector4(10, 8, 10, 8)))
	field.add_theme_stylebox_override("focus", UiKit.box(Art.PAPER, Art.INK, UiKit.OUTLINE, UiKit.RADIUS_MD, Vector4(10, 8, 10, 8)))
	field.add_theme_font_size_override("font_size", 15)
	field.add_theme_color_override("font_color", Art.INK)
	field.add_theme_color_override("font_placeholder_color", Art.LINE_STRONG)
	field.add_theme_color_override("caret_color", Art.INK)
	field.add_theme_color_override("background_color", Color.TRANSPARENT)
	column.add_child(field)
	# TextEdit has no max_length: cut what's past the limit as it's typed.
	field.text_changed.connect(func() -> void:
		if field.text.length() > Feedback.MAX_LENGTH:
			field.text = field.text.left(Feedback.MAX_LENGTH)
			field.set_caret_line(field.get_line_count() - 1)
			field.set_caret_column(field.get_line(field.get_line_count() - 1).length()))
	var buttons := HBoxContainer.new()
	buttons.add_theme_constant_override("separation", 8)
	column.add_child(buttons)
	var send := func() -> void:
		var text := field.text
		cover.queue_free()
		asked.call(text)
	buttons.add_child(UiKit.primary_button("发送", send, 40.0, 15))
	buttons.add_child(UiKit.secondary_button("取消", cover.queue_free, 40.0, 15))
	field.grab_focus.call_deferred()


## A computer build's 昵称 dialog: a field and two buttons over the screen.
func _name_dialog(done: Callable) -> void:
	var cover := ColorRect.new()
	cover.color = Color(Art.INK, 0.45)
	cover.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	cover.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(cover)
	var center := _centered(cover)
	var card := UiKit.panel(UiKit.box(Art.PAPER, Art.INK, UiKit.OUTLINE, UiKit.RADIUS_CARD, Vector4(18, 16, 18, 16)))
	center.add_child(card)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 10)
	card.add_child(column)
	column.add_child(UiKit.label("起个昵称", 18, "heavy"))
	var hint := UiKit.label("排行榜上显示的名字，2–12 个字，不能和别人重复，起了就不能改", 12, "muted")
	hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	hint.custom_minimum_size.x = 240.0
	column.add_child(hint)
	var field := LineEdit.new()
	field.placeholder_text = tr("比如：摸鱼的程序员")
	field.max_length = 12
	field.custom_minimum_size = Vector2(240, 40)
	column.add_child(field)
	var status := UiKit.label("", 12, "strong", Art.INK_MUTED)
	status.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
	column.add_child(status)
	var buttons := HBoxContainer.new()
	buttons.add_theme_constant_override("separation", 8)
	column.add_child(buttons)
	var say := func(text: String, good: bool) -> void:
		status.text = text
		status.add_theme_color_override("font_color", Art.GREEN_INK if good else Art.BOSS_RED)
	# Which edit the last check was for: an answer for older text is dropped.
	var edits := [0]
	# Connected below, once `submit` exists (a lambda keeps what a variable held when it was made).
	var ok := UiKit.primary_button("确定", func() -> void: pass, 40.0, 15)
	ok.disabled = true
	var submit := func() -> void:
		if ok.disabled:
			return
		ok.disabled = true
		var answer: Dictionary = await Leaderboard.set_name(field.text)
		if not is_instance_valid(cover):
			return
		if answer.get("ok", false):
			cover.queue_free()
			done.call(answer)
		else:
			say.call(Leaderboard.error_text(answer), false)
	field.text_changed.connect(func(text: String) -> void:
		edits[0] += 1
		var edit: int = edits[0]
		ok.disabled = true
		status.text = ""
		if text.strip_edges() == "":
			return
		await get_tree().create_timer(NAME_CHECK_DELAY, true).timeout
		if edits[0] != edit or not is_instance_valid(cover):
			return
		var answer: Dictionary = await Leaderboard.check_name(text)
		if edits[0] != edit or not is_instance_valid(cover):
			return
		say.call(_name_status_text(answer), answer.get("ok", false))
		ok.disabled = not answer.get("ok", false))
	ok.pressed.connect(submit)
	field.text_submitted.connect(func(_text: String) -> void: submit.call())
	buttons.add_child(ok)
	buttons.add_child(UiKit.secondary_button("取消", cover.queue_free, 40.0, 15))
	field.grab_focus.call_deferred()

## The 排行榜 page: header and back, then a map's board (_fill_board). Redrawn in place as the
## board comes back from the server.
func _open_board() -> void:
	if not _board_open:
		_board_answer = {}
		_board_note = ""
		_board_map = Maps.current_id
		_board_job = ""
		Telemetry.send_event("leaderboard", {"action": "open"})
	_board_open = true
	_clear(_board_holder)
	var portrait := _is_portrait()
	var page := _page(Vector4(16, 20, 16, 16) if portrait else Vector4(24, 14, 24, 12))
	_board_holder.add_child(page)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 12 if portrait else 8)
	page.add_child(column)
	var header := HBoxContainer.new()
	header.add_theme_constant_override("separation", 8)
	column.add_child(header)
	var back := UiKit.round_button("ui_back", func() -> void: _board_open = false, 44.0, Art.INK)
	header.add_child(back)
	var title := UiKit.label("排行榜", 22, "heavy")
	title.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	header.add_child(title)
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	column.add_child(scroll)
	var body := VBoxContainer.new()
	body.add_theme_constant_override("separation", 10)
	body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(body)
	_fill_board(body, portrait)
	_focus(back)


## The 排行榜 page's body: a map's board (the map in use first) and the player's 昵称 (起昵称 while
## there's none).
func _fill_board(body: VBoxContainer, portrait: bool) -> void:
	if _board_map == "":
		_board_map = Maps.current_id
	# One board a map since 0.3.29 (the 普通 / 无尽 switch of 0.2.0 went with 无尽模式).
	# All jobs or one (0.3.7, the user: 排行榜支持每个职业排行，两个模式都是).
	body.add_child(_board_job_picker())
	body.add_child(_collection_note(tr("按撑了多久排，越久越前；撑过 10:00 下班就算通关，撑过 1 分钟就上榜。每人留自己最好的一次")))
	var names: Array = []
	for map_id: String in Maps.ORDER:
		names.append(tr(Maps.script_of(map_id).NAME))
	var maps := UiKit.segmented(names, Maps.ORDER.find(_board_map), func(index: int) -> void:
		_board_map = Maps.ORDER[index]
		_board_answer = {}
		_open_board(), Art.PAPER_SUNK)
	# No tabs with a single map on offer (.99): one 硅谷 tab says nothing.
	if Maps.ORDER.size() > 1:
		body.add_child(maps)
	if not Leaderboard.online():
		body.add_child(_collection_note(tr("连上云端后才能看排行榜")))
		return
	var name_row := HBoxContainer.new()
	name_row.add_theme_constant_override("separation", 8)
	var name_text := tr("我的昵称：%s") % Cloud.shared().display_name if Leaderboard.has_name() else tr("还没有昵称，起一个才能上榜")
	var name_label := UiKit.label(name_text, 13, "strong", Art.INK)
	name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	name_row.add_child(name_label)
	# Picked once (.97): 起昵称 while there's none, nothing after.
	if not Leaderboard.has_name():
		name_row.add_child(UiKit.secondary_button("起昵称", func() -> void:
			_ask_name(func(_answer: Dictionary) -> void:
				_board_note = ""
				_board_answer = {}
				_open_board()), 34.0, 13))
	body.add_child(name_row)
	if _board_note != "":
		body.add_child(_collection_note(_board_note))
	if _board_answer.is_empty():
		body.add_child(_collection_note(tr("正在读取…")))
		_load_board(_board_map, _board_job)
		return
	if _board_answer.has("error"):
		body.add_child(_collection_note(Leaderboard.error_text(_board_answer)))
		return
	# The server leaves `records` out of an empty board (an empty Lua table would come as {}).
	var listed: Variant = _board_answer.get("records", [])
	var records: Array = listed if listed is Array else []
	if records.is_empty():
		body.add_child(_collection_note(tr("还没人用%s上榜，第一个就是你") % tr(Jobs.data(_board_job)["name"]) if _board_job != "" \
			else tr("还没人上榜，第一个就是你")))
	for record: Dictionary in records:
		body.add_child(_board_line(record))
	var me: Variant = _board_answer.get("me")
	if me is Dictionary and int(me.get("rank", 0)) > records.size():
		body.add_child(UiKit.label("…", 13, "muted"))
		body.add_child(_board_line(me))


func _load_board(map_id: String, job: String) -> void:
	var answer: Dictionary = await Leaderboard.board(map_id, job)
	if not _board_open or _board_map != map_id or _board_job != job:
		return
	_board_answer = answer if not answer.is_empty() else {"error": "offline"}
	_open_board()


## The 排行榜 page's job row (0.3.7): 全部, then each job's face; the picked one in the brand's colour.
func _board_job_picker() -> Control:
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 6)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var choices: Array = [""]
	choices.append_array(Jobs.ORDER)
	for job_id: String in choices:
		var picked := job_id == _board_job
		var button := Button.new()
		button.custom_minimum_size = Vector2(52.0 if job_id == "" else 40.0, 40.0)
		button.focus_mode = Control.FOCUS_NONE
		var resting := UiKit.box(Art.BRAND_SOFT, Art.INK, UiKit.OUTLINE_HEAVY, UiKit.PILL) if picked \
			else UiKit.box(Art.PAPER, Art.LINE, UiKit.OUTLINE, UiKit.PILL)
		for state in ["normal", "hover", "pressed", "focus"]:
			button.add_theme_stylebox_override(state, resting)
		if job_id == "":
			button.text = tr("全部")
			button.add_theme_font_override("font", Art.font(700))
			button.add_theme_font_size_override("font_size", 13)
			button.add_theme_color_override("font_color", Art.INK)
		else:
			button.tooltip_text = tr(Jobs.data(job_id)["name"])
			var centre := CenterContainer.new()
			centre.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
			centre.mouse_filter = Control.MOUSE_FILTER_IGNORE
			centre.add_child(UiKit.icon(Jobs.JOBS[job_id]["art"], 32))
			button.add_child(centre)
		button.pressed.connect(func() -> void:
			Sound.play("click")
			if _board_job == job_id:
				return
			_board_job = job_id
			_board_answer = {}
			_open_board())
		row.add_child(button)
	return row


## One line of a board: rank, job, name, time.
func _board_line(record: Dictionary) -> Control:
	var mine: bool = record.get("me", false)
	var strip := UiKit.panel(UiKit.box(Art.BRAND_SOFT if mine else Art.PAPER, Art.INK if mine else Art.LINE, UiKit.OUTLINE, UiKit.RADIUS_MD, Vector4(10, 6, 10, 6)))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	strip.add_child(row)
	# JSON numbers come back as floats: 1, not 1.0.
	var rank := UiKit.label(str(int(record.get("rank", 0))), 15, "display")
	rank.custom_minimum_size.x = 30
	row.add_child(rank)
	var job: String = str(record.get("job", ""))
	if Jobs.JOBS.has(job):
		row.add_child(UiKit.icon(Jobs.data(job)["art"], 22))
	var shown_name := UiKit.label(str(record.get("name", "")), 14, "strong", Art.INK)
	shown_name.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
	shown_name.clip_text = true
	shown_name.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(shown_name)
	# How long a run lasted (0.3.29): one past 10:00 (won) in the bold 12:34.5, one short of it muted,
	# 撑到 7:42.
	var cleared: bool = record.get("cleared", true)
	var time := UiKit.label(Leaderboard.record_text(int(record.get("ms", 0)), cleared), 14 if cleared else 13, "display" if cleared else "strong", Art.INK if cleared else Art.INK_MUTED)
	time.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
	row.add_child(time)
	# 举报 (.78–.96) is gone with changing names (.97, the user: 去掉).
	return strip


func _clock_text(seconds_elapsed: float) -> String:
	var seconds := floori(seconds_elapsed)
	return "%02d:%02d" % [floori(seconds / 60.0), seconds % 60]
