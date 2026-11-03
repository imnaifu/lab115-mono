class_name BossPointers
extends Node2D
## Arrows at the screen's edge pointing at bosses that are off screen, each with the boss's face,
## so a boss walking in (or one the player ran away from) is never a surprise; and (.68) yellow ones
## at open landmarks not checked in at yet, with the landmark's picture. Drawn in the world
## around the player, so a phone playing turned sideways gets them turned with everything else.

## Kept clear of the screen's edges (the arrow reaches DISC_RADIUS + ARROW_SIZE past the disc's
## centre); more at the top, where the upgrade slots and buttons sit.
const INSET_SIDE := 32.0
const INSET_TOP := 80.0
const INSET_BOTTOM := 32.0
const DISC_RADIUS := 15.0
const FACE_SIZE := 20.0
const ARROW_SIZE := 7.0

var game: Game


func _process(_delta: float) -> void:
	queue_redraw()


func _draw() -> void:
	if game.state != Game.State.PLAYING:
		return
	var half := game.view_half()
	var center := game.player.position
	var low := Vector2(-half.x + INSET_SIDE, -half.y + INSET_TOP)
	var high := Vector2(half.x - INSET_SIDE, half.y - INSET_BOTTOM)
	# Open landmarks not checked in at yet (Stamps, .68), under the bosses' arrows: the map has
	# no minimap or arrows otherwise, and the corner ones are 40 seconds' walk away.
	for id: String in Maps.current.STAMPS:
		if Progress.has_stamp(id) or not game.stamps.is_open(id):
			continue
		var landmark_offset := game.stamps.ring_center(id) - center
		if absf(landmark_offset.x) >= half.x or absf(landmark_offset.y) >= half.y:
			_draw_pointer(center, landmark_offset, low, high, Art.BRAND, Art.BRAND_SOFT, Art.BRAND_DEEP,
				Art.texture(Maps.current.STAMPS[id]["art"]))
	for enemy in game.enemies:
		if not enemy.is_elite or enemy.dead:
			continue
		var offset := enemy.position - center
		if absf(offset.x) < half.x and absf(offset.y) < half.y:
			continue
		_draw_pointer(center, offset, low, high, Art.BOSS_RED, Art.PINK_LIGHT, Art.BOSS_RED,
			Art.texture(Spawner.ENEMY_TYPES[enemy.type_name]["art"]))


## An arrow at the inset box's edge, on the line from `center` towards `offset`, with a disc
## holding `face`.
func _draw_pointer(center: Vector2, offset: Vector2, low: Vector2, high: Vector2, arrow_color: Color,
		disc_color: Color, rim_color: Color, face: Texture2D) -> void:
	# Along the line to it, as far as the inset box allows.
	var reach := INF
	if offset.x > 0.001:
		reach = minf(reach, high.x / offset.x)
	elif offset.x < -0.001:
		reach = minf(reach, low.x / offset.x)
	if offset.y > 0.001:
		reach = minf(reach, high.y / offset.y)
	elif offset.y < -0.001:
		reach = minf(reach, low.y / offset.y)
	var spot := center + offset * reach
	var direction := offset.normalized()
	var tip := spot + direction * (DISC_RADIUS + ARROW_SIZE + 2.0)
	var base := spot + direction * (DISC_RADIUS + 1.0)
	var side := direction.orthogonal() * ARROW_SIZE
	var arrow := PackedVector2Array([tip, base + side, base - side])
	draw_colored_polygon(arrow, arrow_color)
	arrow.append(tip)
	draw_polyline(arrow, Art.INK, 1.5, true)
	draw_circle(spot, DISC_RADIUS, disc_color)
	draw_arc(spot, DISC_RADIUS - 1.25, 0.0, TAU, 32, rim_color, 2.5, true)
	var face_size := face.get_size() * FACE_SIZE / maxf(face.get_width(), face.get_height())
	draw_texture_rect(face, Rect2(spot - face_size / 2.0, face_size), false)
