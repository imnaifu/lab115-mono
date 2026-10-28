class_name BossPointers
extends Node2D
## Arrows at the screen's edge pointing at bosses that are off screen, each with the boss's face,
## so a boss walking in (or one the player ran away from) is never a surprise. Drawn in the world
## around the player, so a phone playing turned sideways gets them turned with everything else.

## Kept clear of the screen's edges (the arrow reaches DISC_RADIUS + ARROW_SIZE past the disc's
## centre); more at the top, where the upgrade slots and minimap sit.
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
	for enemy in game.enemies:
		if not enemy.is_elite or enemy.dead:
			continue
		var offset := enemy.position - center
		if absf(offset.x) < half.x and absf(offset.y) < half.y:
			continue
		# Along the line to the boss, as far as the inset box allows.
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
		draw_colored_polygon(arrow, Art.BOSS_RED)
		arrow.append(tip)
		draw_polyline(arrow, Art.INK, 1.5, true)
		draw_circle(spot, DISC_RADIUS, Art.PINK_LIGHT)
		draw_arc(spot, DISC_RADIUS - 1.25, 0.0, TAU, 32, Art.BOSS_RED, 2.5, true)
		var face := Art.texture(Spawner.ENEMY_TYPES[enemy.type_name]["art"])
		var face_size := face.get_size() * FACE_SIZE / maxf(face.get_width(), face.get_height())
		draw_texture_rect(face, Rect2(spot - face_size / 2.0, face_size), false)
