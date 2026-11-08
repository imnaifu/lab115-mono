class_name BounceWeapon
extends Weapon
## Logos bouncing round the screen for good, off its edges like an old
## screensaver, going through everything they touch; the same enemy can be hit again every REHIT
## seconds. A logo that bounces right into a corner of the screen blasts everything round it.
## (Silicon Valley: 屏保.) Vampire Survivors' Runetracer, made permanent: it used to fly a couple
## of seconds and vanish, and the user wanted them "never gone, just bouncing all over".
## 动态壁纸 (evolved with 降噪耳机): every bounce off an edge blasts the enemies near it too.
##
## A square tile since .74 (the user: 屏保可以略大一点，然后做成正方形，这样才能完美贴边): SIZE 18 → 24,
## the drawing fills its square, it turns back the moment its side meets the screen's edge and
## hits whatever overlaps the square. Until then a round-ish logo that rocked from side to side,
## bounced and hit by a circle of radius 9 round its middle, so it turned short of the edge.

## Logos out at once.
const COUNT := [1, 1, 2, 2, 3]
## 0.3.9 (the user: 屏保成长伤害加一下 / 复制粘贴穿透改成无限 / 机械键盘初始削弱一点，成长加一点 / 云端部署改 2.2 秒 / 拉会半径大一点 / 无人机伤害加一点 / 邮件伤害加一点):
## growth +6 / +6 / +9 (+4 / +4 / +6 until then), the opening 12 the same.
const DAMAGE := [12.0, 18.0, 18.0, 24.0, 33.0]
const SPEED := [150.0, 150.0, 170.0, 170.0, 190.0]
const REHIT := 0.5
## The tile's side, as drawn and as it hits and bounces.
const SIZE := 24.0
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
	## Enemy instance id -> the weapon's clock when this logo last hit it.
	var hit_at := {}


var _logos: Array[Logo] = []
var _clock := 0.0


func _process(delta: float) -> void:
	_clock += delta
	# Launched from the player, one more whenever a level adds one; never taken back.
	while _logos.size() < stat(COUNT):
		_launch()
	var damage: float = stat(DAMAGE) * damage_scale()
	var speed: float = stat(SPEED)
	# Where the tile's middle turns back: its side on the screen's edge.
	var half := game.view_half() - Vector2.ONE * SIZE / 2.0
	for logo in _logos:
		# Levels speed them up as they go.
		logo.velocity = logo.velocity.normalized() * speed
		logo.position += logo.velocity * delta
		# Only off the screen's edges (.39): it bounced off buildings too, but only their solid
		# footing counted (and water), while the logo is drawn over the whole building, so it went
		# through what showed and turned at lines nobody could see.
		var bounced := _bounce_off_screen(logo, half)
		logo.sprite.position = logo.position
		if bounced:
			_on_edge_bounce(logo, half, damage)
		# Everything the square overlaps: candidates within its corner's reach, then the square.
		for enemy in game.query_enemies(logo.position, SIZE * 0.71):
			var gap := (enemy.position - logo.position).abs() - Vector2.ONE * (SIZE / 2.0 + enemy.hit_radius)
			if gap.x > 0.0 or gap.y > 0.0:
				continue
			var key := enemy.get_instance_id()
			if _clock - logo.hit_at.get(key, -INF) < REHIT:
				continue
			logo.hit_at[key] = _clock
			game.damage_enemy(enemy, damage, logo.velocity.normalized() * 30.0, id)
		# Forget enemies not hit for a while: a logo now lives the whole run.
		if logo.hit_at.size() > 100:
			for key in logo.hit_at.keys():
				if _clock - logo.hit_at[key] > REHIT:
					logo.hit_at.erase(key)


## A new logo off the player, diagonal-ish like the screensaver: never close to straight along an
## axis, or it would shuttle between two edges without sweeping the screen.
func _launch() -> void:
	var logo := Logo.new()
	var quarter := game.rng.randi_range(0, 3)
	var heading := PI / 2.0 * quarter + deg_to_rad(game.rng.randf_range(25.0, 65.0))
	logo.velocity = Vector2.from_angle(heading) * stat(SPEED)
	logo.position = player.position
	logo.sprite = Art.sprite(art, SIZE)
	logo.sprite.position = logo.position
	game.effect_layer.add_child(logo.sprite)
	_logos.append(logo)


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
