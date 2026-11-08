class_name StampRings
extends Node2D
## The check-in rings on the ground (Stamps, .68), one in front of each landmark not checked in at
## yet. Before the landmark opens: a grey dashed ring saying when it opens. Once open: a yellow
## ring (brand yellow: red means it hurts, and 新加坡's cool spots are blue) whose rim fills round
## as the player stands in it and empties again outside it, with the seconds stood so far. Drawn
## as a true circle, since the check is a distance (画到哪算到哪).

const DASHES := 28
const FONT_SIZE := 15
## The label sits this far below the ring's centre, clear of the landmark's drawing.
const LABEL_DROP := 70.0

var game: Game
## The labels, drawn on a layer of their own over everything in the world (with the damage
## numbers): a landmark's buildings stand over the ground and would hide them.
var _labels: Node2D
## [where, text, colour] for each label this frame, filled by _draw for _draw_labels.
var _label_queue: Array = []


func _init() -> void:
	# On the ground: over the map, under the pickups and everyone.
	z_index = -6
	_labels = Node2D.new()
	# Relative to this node's -6: 20 overall, the damage numbers' layer.
	_labels.z_index = 26
	_labels.draw.connect(_draw_labels)
	add_child(_labels)


func _process(_delta: float) -> void:
	queue_redraw()
	_labels.queue_redraw()


func _draw() -> void:
	_label_queue.clear()
	# Not behind the title screen: the rings belong to a run.
	if game.state == Game.State.TITLE:
		return
	var reach := game.view_half() + Vector2.ONE * Stamps.RADIUS
	for id: String in Maps.current.STAMPS:
		if game.stamps.done(id):
			continue
		var center := game.stamps.ring_center(id)
		var offset := center - game.player.position
		if absf(offset.x) > reach.x or absf(offset.y) > reach.y:
			continue
		if game.stamps.is_open(id):
			_draw_open(id, center)
		else:
			_draw_closed(id, center)


func _draw_closed(id: String, center: Vector2) -> void:
	var step := TAU / DASHES
	for i in DASHES:
		draw_arc(center, Stamps.RADIUS, i * step, i * step + step * 0.55, 4, Color(Art.LINE_STRONG, 0.8), 3.0, true)
	var opens := roundi(Stamps.open_at(id))
	_label(center, tr("%s 开门") % ("%d:%02d" % [opens / 60, opens % 60]), Art.INK_MUTED)


func _draw_open(id: String, center: Vector2) -> void:
	var ratio := game.stamps.held_ratio(id)
	draw_circle(center, Stamps.RADIUS, Color(Art.BRAND_SOFT, 0.45))
	draw_arc(center, Stamps.RADIUS, 0.0, TAU, 64, Color(Art.BRAND, 0.9), 3.0, true)
	if ratio > 0.0:
		# The rim filling clockwise from the top, thick (the only progress shown since 0.3.13, when the
		# ring over the player's head went).
		draw_arc(center, Stamps.RADIUS - 4.0, -PI / 2.0, -PI / 2.0 + TAU * ratio, 64, Art.BRAND_DEEP, 8.0, true)
	var seconds := floori(ratio * Stamps.CHECK_IN_SECONDS)
	var total := roundi(Stamps.CHECK_IN_SECONDS)
	# 打卡中 only while standing in it (0.3.11, the user: 打卡没进去的时候不要显示打卡中，进去才是打卡中，进去前
	# 叫别的); outside, what to do, and how far it got if it was started.
	if game.stamps.inside_id() == id:
		_label(center, tr("打卡中 %d/%d") % [seconds, total], Art.INK)
	elif seconds > 0:
		_label(center, tr("打卡 %d/%d · 回圈里继续") % [seconds, total], Art.INK_MUTED)
	else:
		_label(center, tr("打卡点 · 站进圈 %d 秒") % total, Art.INK)


func _label(center: Vector2, text: String, color: Color) -> void:
	_label_queue.append([center + Vector2(0.0, LABEL_DROP), text, color])


func _draw_labels() -> void:
	var font := Art.font(700)
	for label: Array in _label_queue:
		var text: String = label[1]
		var width := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, FONT_SIZE).x
		var at: Vector2 = label[0] - Vector2(width / 2.0, 0.0)
		_labels.draw_string_outline(font, at, text, HORIZONTAL_ALIGNMENT_LEFT, -1, FONT_SIZE, 4, Art.PAPER)
		_labels.draw_string(font, at, text, HORIZONTAL_ALIGNMENT_LEFT, -1, FONT_SIZE, label[2])
