class_name Departures
extends PanelContainer
## 出发 · DEPARTURES, the title screen's map picker (.38, the user's pick, over a Kingdom Rush
## campaign map, a card carousel like Vampire Survivors' and a level path like Candy Crush's): an
## airport departures board, one row per city in the route's order (Maps.ROUTE, easiest first,
## the cities still to come in their places), each with its landmark, working week, name and code,
## grade, and whether it can be boarded. Tapping a row picks it (city_picked); the page round it
## shows that city's boarding pass. A city that opens for the first time on this device has its
## status flip over like a split-flap board (Settings "world_seen", as the world map's reveal did).

signal city_picked(id: String)

const ROW_HEIGHT := 30.0
## The board's dark face, a row's line, and the highlight round the row picked.
const FACE := Color("2f3542")
const ROW_LINE := Color(1, 1, 1, 0.1)
const PICKED := Color(1, 1, 1, 0.08)
const DIM := Color(1, 1, 1, 0.5)
## Each status: its text, the pill's colour and the text's.
const STATUSES := {
	"cleared": ["已通关", Color("4caf6a"), Color.WHITE],
	"open": ["可登机", Art.BRAND, Art.INK],
	"locked": ["锁定", Color(1, 1, 1, 0.14), Color(1, 1, 1, 0.6)],
	"soon": ["未开航", Color(1, 1, 1, 0.14), Color(1, 1, 1, 0.6)],
}
## The split-flap flip of a status that just opened: how long it shuffles, how often the letters
## change, how long each row waits after the one before it, and the letters it shuffles through.
const FLIP_SECONDS := 0.8
const FLIP_STEP := 0.05
const FLIP_STAGGER := 0.35
const FLIP_GLYPHS := "ABCDEFGHJKLMNPRSTUVWXYZ0123456789"

## The row picked (to begin with, the map in use).
var selected := ""

## Per city: its row (a Button), its status pill and the label in it.
var _rows := {}
var _status_labels := {}
## Rows whose status is flipping: city id → seconds since its flip started (negative while waiting).
var _flips := {}
var _flip_tick := 0.0


func _ready() -> void:
	add_theme_stylebox_override("panel", UiKit.box(FACE, Art.INK, UiKit.OUTLINE, UiKit.RADIUS_MD, Vector4(10, 8, 10, 8)))
	if selected == "":
		selected = Maps.current_id
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 0)
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(column)
	var heading := HBoxContainer.new()
	heading.add_theme_constant_override("separation", 6)
	heading.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(heading)
	heading.add_child(UiKit.icon("plane", 16))
	heading.add_child(UiKit.label("航班", 15, "heavy", Art.BRAND))
	var kicker := UiKit.kicker("DEPARTURES", Art.BRAND, 11)
	kicker.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	heading.add_child(kicker)
	heading.add_child(UiKit.filler())
	column.add_child(UiKit.gap(4))
	column.add_child(_columns(["工时", "目的地", "职级", "状态"], DIM, 10, false))
	for id: String in Maps.ROUTE:
		var row := _make_row(id)
		_rows[id] = row
		column.add_child(row)
	_start_flips()
	_mark_picked()


func _process(delta: float) -> void:
	if _flips.is_empty():
		return
	_flip_tick -= delta
	var shuffle := _flip_tick <= 0.0
	if shuffle:
		_flip_tick = FLIP_STEP
	for id: String in _flips.keys():
		_flips[id] += delta
		var label: Label = _status_labels[id]
		if _flips[id] >= FLIP_SECONDS:
			_flips.erase(id)
			label.text = tr(STATUSES[_status(id)][0])
			_settle(label.get_parent())
		elif _flips[id] >= 0.0 and shuffle:
			var letters := ""
			for i in 3:
				letters += FLIP_GLYPHS[randi() % FLIP_GLYPHS.length()]
			label.text = letters


## Where a city stands: still to come, locked, won at least once, or open.
static func _status(id: String) -> String:
	if not Maps.ORDER.has(id):
		return "soon"
	if not Maps.unlocked(id):
		return "locked"
	if Maps.cleared(id):
		return "cleared"
	return "open"


## A city's working week and grade: its map's, or for one still to come, what it will have.
static func hours_of(id: String) -> String:
	return Maps.script_of(id).HOURS if Maps.ORDER.has(id) else WorldMap.CITIES[id]["hours"]


static func rank_of(id: String) -> String:
	return Maps.script_of(id).RANK_PREFIX if Maps.ORDER.has(id) else WorldMap.CITIES[id]["rank"]


## A city's landmark, or a plane for one with none drawn yet.
static func icon_of(id: String) -> String:
	var icon: String = WorldMap.CITIES[id]["icon"]
	return icon if icon != "" else "plane"


## A row of the board's four columns: working week, destination, grade, status.
func _columns(cells: Array, color: Color, font_size: int, strong: bool) -> Control:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 6)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var widths := [62.0, 0.0, 34.0, 62.0]
	for i in cells.size():
		var cell: Control = cells[i] if cells[i] is Control else UiKit.label(cells[i], font_size, "strong" if strong else "body", color)
		cell.custom_minimum_size.x = widths[i]
		if widths[i] == 0.0:
			cell.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(cell)
	return row


func _make_row(id: String) -> Button:
	var status := _status(id)
	var playable := status != "soon"
	var bright := status == "open" or status == "cleared"
	var row := Button.new()
	row.custom_minimum_size = Vector2(0.0, ROW_HEIGHT)
	row.focus_mode = Control.FOCUS_NONE
	for state in ["normal", "hover", "pressed", "focus", "disabled"]:
		row.add_theme_stylebox_override(state, StyleBoxEmpty.new())
	row.pressed.connect(_pick.bind(id))
	var content := HBoxContainer.new()
	content.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	content.add_theme_constant_override("separation", 6)
	content.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(content)
	# The working week, behind the city's landmark on a white tile (a grey one, faded, until it opens).
	var hours := HBoxContainer.new()
	hours.add_theme_constant_override("separation", 5)
	hours.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var tile := UiKit.well(icon_of(id), 22.0, Art.PAPER if bright else Color(1, 1, 1, 0.35), 6)
	tile.modulate.a = 1.0 if bright else 0.6
	hours.add_child(tile)
	hours.add_child(UiKit.label(hours_of(id), 12 if hours_of(id).length() <= 3 else 10, "display", Art.BRAND if bright else DIM))
	var name_cell := HBoxContainer.new()
	name_cell.add_theme_constant_override("separation", 5)
	name_cell.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if id == Maps.current_id and playable:
		# The map in use: a yellow dot before its name (a word there pushed long names off).
		name_cell.add_child(_here_dot())
	var city_name := UiKit.label(WorldMap.CITIES[id]["name"], 13, "heavy", Color.WHITE if bright else DIM)
	# A long name (Silicon Valley in English) is cut short rather than pushing the status off the board.
	city_name.clip_text = true
	city_name.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	city_name.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	name_cell.add_child(city_name)
	var code := UiKit.label(WorldMap.CITIES[id]["code"], 10, "display", DIM)
	code.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
	code.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	name_cell.add_child(code)
	var rank := UiKit.label(rank_of(id), 12, "display", Color.WHITE if bright else DIM)
	rank.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
	var look: Array = STATUSES[status]
	var pill := UiKit.panel(UiKit.box(look[1], Color.TRANSPARENT, 0, UiKit.PILL, Vector4(6, 0, 6, 1)))
	pill.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var status_label := UiKit.label(look[0], 10, "heavy", look[2])
	status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	# Every row's status the same width, so the columns line up row to row (each row lays out on
	# its own) and a longer word in English can't push the row wider.
	status_label.clip_text = true
	pill.add_child(status_label)
	_status_labels[id] = status_label
	var filled := _columns([hours, name_cell, rank, pill], Color.WHITE, 12, true)
	filled.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	content.add_child(filled)
	filled.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return row


## The yellow dot marking the map in use.
static func _here_dot() -> Control:
	var dot := Control.new()
	dot.custom_minimum_size = Vector2(8.0, 8.0)
	dot.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	dot.mouse_filter = Control.MOUSE_FILTER_IGNORE
	dot.draw.connect(func() -> void: dot.draw_circle(dot.size / 2.0, 4.0, Art.BRAND))
	return dot


func _pick(id: String) -> void:
	selected = id
	_mark_picked()
	city_picked.emit(id)


## The row picked lit up, the others plain, with a line between each.
func _mark_picked() -> void:
	for id: String in _rows:
		var row: Button = _rows[id]
		var style := StyleBoxFlat.new()
		style.bg_color = PICKED if id == selected else Color.TRANSPARENT
		style.border_color = Art.BRAND if id == selected else ROW_LINE
		style.set_border_width_all(0)
		style.border_width_top = 1
		if id == selected:
			style.set_border_width_all(2)
			style.set_corner_radius_all(6)
		row.add_theme_stylebox_override("normal", style)
		row.add_theme_stylebox_override("hover", style)
		row.add_theme_stylebox_override("pressed", style)


## A status landing after its flip: a quick swell and back.
func _settle(pill: Control) -> void:
	pill.pivot_offset = pill.size / 2.0
	var tween := pill.create_tween()
	tween.tween_property(pill, "scale", Vector2.ONE * 1.2, 0.08)
	tween.tween_property(pill, "scale", Vector2.ONE, 0.12)


## Cities open now that this device hasn't seen open flip their status over, one after another,
## and then count as seen.
func _start_flips() -> void:
	var seen: Array = Settings.get_value("world_seen", [])
	var delay := 0.0
	for id: String in Maps.ROUTE:
		if Maps.ORDER.has(id) and Maps.unlocked(id) and not seen.has(id):
			_flips[id] = -delay
			delay += FLIP_STAGGER
			seen.append(id)
	if not _flips.is_empty():
		Settings.set_value("world_seen", seen)
