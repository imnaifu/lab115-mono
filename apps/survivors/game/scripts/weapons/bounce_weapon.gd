class_name BounceWeapon
extends Weapon
## Logos sent off in random directions that bounce off the edges of the screen (and off
## buildings) like an old screensaver, going through everything they touch; the same enemy can be
## hit again every REHIT seconds. A logo that bounces right into a corner of the screen blasts
## everything round it. (Silicon Valley: 屏保.) Vampire Survivors' Runetracer.
## 动态壁纸 (evolved with 降噪耳机): every bounce off an edge blasts the enemies near it too.

const COUNT := [1, 1, 2, 2, 3]
const DAMAGE := [14.0, 18.0, 18.0, 24.0, 30.0]
const SPEED := [160.0, 160.0, 180.0, 180.0, 200.0]
## Seconds each logo flies (Runetracer: 2.25, 3.25 at full level).
const DURATION := [2.25, 2.25, 2.55, 2.55, 3.25]
## A little under the flight time plus a beat, so a logo is nearly always out.
const COOLDOWN := 2.4
const REHIT := 0.5
const HIT_RADIUS := 9.0
## The first logo of a volley heads for the nearest enemy this close (give or take AIM_JITTER),
## the rest anywhere: early on the enemies are all near the player, and purely random logos
## mostly crossed empty screen (3 kills in the first minute).
const AIM_RANGE := 200.0
const AIM_JITTER := 0.35
const SIZE := 18.0
## A bounce this close to both edges at a corner counts as hitting the corner.
const CORNER_SNAP := 14.0
const CORNER_RADIUS := 60.0
## Corner blast damage, in multiples of the logo's own.
const CORNER_DAMAGE := 3.0
const EDGE_BLAST_RADIUS := 30.0
const EDGE_BLAST_DAMAGE := 0.6


class Logo:
	var sprite: Sprite2D
	var position := Vector2.ZERO
	var velocity := Vector2.ZERO
	var life := 0.0
	## Enemy instance id -> seconds of life left when it was last hit.
	var hit_at := {}


var _logos: Array[Logo] = []


func cooldown() -> float:
	return COOLDOWN


func fire() -> bool:
	var nearest := game.nearest_enemy(player.position, AIM_RANGE)
	for i in stat(COUNT):
		var logo := Logo.new()
		# Diagonal-ish, like the screensaver: never close to straight along an axis, or it would
		# shuttle between two edges without sweeping the screen.
		var quarter := game.rng.randi_range(0, 3)
		var heading := PI / 2.0 * quarter + deg_to_rad(game.rng.randf_range(25.0, 65.0))
		if i == 0 and nearest != null:
			heading = (nearest.position - player.position).angle() + game.rng.randf_range(-AIM_JITTER, AIM_JITTER)
		logo.velocity = Vector2.from_angle(heading) * stat(SPEED)
		logo.position = player.position
		logo.life = stat(DURATION)
		logo.sprite = Art.sprite(art, SIZE)
		logo.sprite.position = logo.position
		game.effect_layer.add_child(logo.sprite)
		_logos.append(logo)
	return true


func _process(delta: float) -> void:
	super(delta)
	var damage: float = stat(DAMAGE) * damage_scale()
	var half := game.view_half() - Vector2(HIT_RADIUS, HIT_RADIUS)
	for i in range(_logos.size() - 1, -1, -1):
		var logo := _logos[i]
		logo.life -= delta
		if logo.life <= 0.0:
			logo.sprite.queue_free()
			_logos.remove_at(i)
			continue
		logo.position += logo.velocity * delta
		var bounced := _bounce_off_screen(logo, half)
		# Off buildings too: the push out of a wall is the surface's normal.
		var clear := game.city.resolve(logo.position, HIT_RADIUS * 0.5)
		if clear != logo.position:
			logo.velocity = logo.velocity.bounce((clear - logo.position).normalized())
			logo.position = clear
		logo.sprite.position = logo.position
		logo.sprite.rotation = sin(logo.life * 3.0) * 0.15
		if bounced:
			_on_edge_bounce(logo, half, damage)
		for enemy in game.query_enemies(logo.position, HIT_RADIUS):
			var key := enemy.get_instance_id()
			if logo.hit_at.has(key) and logo.hit_at[key] - logo.life < REHIT:
				continue
			logo.hit_at[key] = logo.life
			game.damage_enemy(enemy, damage, logo.velocity.normalized() * 30.0, id)


## Turns the logo back at the screen's edges (the screen follows the player, so it is measured
## from them). Whether it bounced.
func _bounce_off_screen(logo: Logo, half: Vector2) -> bool:
	var offset := logo.position - player.position
	var bounced := false
	if (offset.x < -half.x and logo.velocity.x < 0.0) or (offset.x > half.x and logo.velocity.x > 0.0):
		logo.velocity.x = -logo.velocity.x
		bounced = true
	if (offset.y < -half.y and logo.velocity.y < 0.0) or (offset.y > half.y and logo.velocity.y > 0.0):
		logo.velocity.y = -logo.velocity.y
		bounced = true
	return bounced


func _on_edge_bounce(logo: Logo, half: Vector2, damage: float) -> void:
	var offset := (logo.position - player.position).abs()
	if half.x - offset.x <= CORNER_SNAP and half.y - offset.y <= CORNER_SNAP:
		# The moment everyone watching a screensaver waited for.
		_blast(logo.position, CORNER_RADIUS, damage * CORNER_DAMAGE, Art.BRAND)
		Effects.callout(game, logo.position, tr("撞角了！"), Art.BRAND)
		Sound.play("corner")
	elif evolved:
		_blast(logo.position, EDGE_BLAST_RADIUS, damage * EDGE_BLAST_DAMAGE, Art.BLUE)
	else:
		Effects.ring(game, logo.position, 10.0, Art.BLUE)


func _blast(at: Vector2, radius: float, damage: float, color: Color) -> void:
	Effects.ring(game, at, radius, color)
	for enemy in game.query_enemies(at, radius):
		game.damage_enemy(enemy, damage, (enemy.position - at).normalized() * 60.0, id, true)
