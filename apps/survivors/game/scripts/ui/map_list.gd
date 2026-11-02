class_name MapList
extends VBoxContainer
## The title screen's map picker (.60, the user: 地图改下，不用登机的逻辑，而是每个地图给个难度星星
## 之类的，硅谷一颗星，不用说 996 什么的): one row per city in the route's order (Maps.ROUTE, easiest
## first, the cities still to come in their places), each with its landmark, its name, its
## difficulty in stars (each map's STARS) and where it stands. Tapping a row picks it
## (city_picked); the page round it shows that city's card. .38–.59 this was an airport
## departures board (working week, grade, 可登机, a split-flap flip as a city opened) with a
## boarding pass beside it.

signal city_picked(id: String)

const ROW_HEIGHT := 40.0
## The most stars a map has: every map shows that many, the ones it hasn't faded.
const MAX_STARS := 3
const STAR_ON := Art.BRAND_DEEP
const STAR_OFF := Art.LINE
## Each status with a pill: its text, the pill's colour and the text's. A map open and not won
## yet has none.
const STATUSES := {
	"cleared": ["已通关", Color("4caf6a"), Color.WHITE],
	"locked": ["锁定", Art.PAPER_SUNK, Art.INK_MUTED],
	"soon": ["敬请期待", Art.PAPER_SUNK, Art.INK_MUTED],
}

## The row picked (to begin with, the map in use).
var selected := ""

## Per city: its row (a Button).
var _rows := {}


func _ready() -> void:
	add_theme_constant_override("separation", 6)
	if selected == "":
		selected = Maps.current_id
	for id: String in Maps.ROUTE:
		var row := _make_row(id)
		_rows[id] = row
		add_child(row)
	_mark_picked()


## Where a city stands: still to come, locked, won at least once, or open.
static func status_of(id: String) -> String:
	if not Maps.ORDER.has(id):
		return "soon"
	if not Maps.unlocked(id):
		return "locked"
	if Maps.cleared(id):
		return "cleared"
	return "open"


## A city's landmark, or the info mark for one with none drawn yet.
static func icon_of(id: String) -> String:
	var icon: String = WorldMap.CITIES[id]["icon"]
	return icon if icon != "" else "ui_info"


## A map's difficulty stars, 0 for a city still to come.
static func stars_of(id: String) -> int:
	return Maps.script_of(id).STARS if Maps.ORDER.has(id) else 0


## MAX_STARS stars in a row, the first `count` lit.
static func stars(count: int, font_size: int) -> Control:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 0)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	for i in MAX_STARS:
		var star := UiKit.label("★", font_size, "heavy", STAR_ON if i < count else STAR_OFF)
		star.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
		row.add_child(star)
	return row


func _make_row(id: String) -> Button:
	var status := status_of(id)
	var bright := status == "open" or status == "cleared"
	var row := Button.new()
	row.custom_minimum_size = Vector2(0.0, ROW_HEIGHT)
	row.focus_mode = Control.FOCUS_NONE
	row.pressed.connect(_pick.bind(id))
	var content := HBoxContainer.new()
	content.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	content.offset_left = 8.0
	content.offset_right = -8.0
	content.add_theme_constant_override("separation", 8)
	content.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(content)
	var tile := UiKit.well(icon_of(id), 28.0, Art.PAPER_SUNK, 8)
	tile.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	tile.modulate.a = 1.0 if bright else 0.5
	content.add_child(tile)
	if id == Maps.current_id and status != "soon":
		# The map in use: a yellow dot before its name.
		content.add_child(_here_dot())
	var city_name := UiKit.label(WorldMap.CITIES[id]["name"], 14, "heavy", Art.INK if bright else Art.INK_MUTED)
	city_name.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	# A long name (Silicon Valley in English) is cut short rather than pushing the stars off the row.
	city_name.clip_text = true
	city_name.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	city_name.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content.add_child(city_name)
	if status != "soon":
		content.add_child(stars(stars_of(id), 14))
	# Every row's status the same width, so the stars line up row to row (each row lays out on
	# its own) and a longer word in English can't push the row wider.
	var status_cell := CenterContainer.new()
	status_cell.custom_minimum_size.x = 72.0
	status_cell.mouse_filter = Control.MOUSE_FILTER_IGNORE
	content.add_child(status_cell)
	if STATUSES.has(status):
		var look: Array = STATUSES[status]
		var pill := UiKit.panel(UiKit.box(look[1], Color.TRANSPARENT, 0, UiKit.PILL, Vector4(7, 0, 7, 1)))
		pill.mouse_filter = Control.MOUSE_FILTER_IGNORE
		# Not clipped: the centred cell gives the label no width of its own, so a clipped one shrank
		# to nothing.
		var status_label := UiKit.label(look[0], 10, "heavy", look[2])
		pill.add_child(status_label)
		status_cell.add_child(pill)
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


## The row picked on a pale yellow with a dark outline, the others plain cards.
func _mark_picked() -> void:
	for id: String in _rows:
		var row: Button = _rows[id]
		var picked: bool = id == selected
		var style := UiKit.box(Art.BRAND_SOFT if picked else Art.PAPER, Art.INK if picked else Art.LINE,
			UiKit.OUTLINE if picked else 1, UiKit.RADIUS_SM)
		for state in ["normal", "hover", "pressed", "focus", "disabled"]:
			row.add_theme_stylebox_override(state, style)
