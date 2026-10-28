class_name Pickup
extends Node2D
## Something on the ground for the player to collect: XP stars, bubble tea that heals, the
## funding bag that grants a free level-up and the magnet that pulls in every star. Game drives
## tick() for all pickups at once, since late runs can have hundreds of stars.

enum Kind { XP, HEAL, BONUS, MAGNET }

const COLLECT_DISTANCE := 6.0
const PULL_ACCELERATION := 700.0
## Art and frame size per kind; XP picks its star by value instead (Art.star).
const LOOKS := {
	Kind.HEAL: ["boba", 18.0],
	Kind.BONUS: ["moneybag", 20.0],
	Kind.MAGNET: ["magnet", 16.0],
}
## Big enough to spot on any ground at a glance: stars are the whole economy of a run.
const STAR_SIZES := {"star_blue": 13.0, "star_green": 15.0, "star_gold": 18.0}
## The halo behind a pickup, as a multiple of its size. Stars glow pale yellow (white barely
## shows on the pale lawn), rare drops a deeper gold.
const HALO_SCALE := 2.2
const HALO_COLORS := {Kind.XP: Color("fff3a8"), Kind.HEAL: Color("ffd25e"), Kind.BONUS: Color("ffd25e"), Kind.MAGNET: Color("ffd25e")}
## Each pickup swells and shrinks a little, and every few seconds flashes brighter.
const PULSE := 0.08
const TWINKLE_EVERY := 2.5
## The bouncing arrow and spreading ring on the first star a device ever sees (point_at).
const POINTER_HEIGHT := 20.0
const POINTER_SIZE := 7.0
const POINTER_RING := 16.0

static var _halo_texture: GradientTexture2D

var kind := Kind.XP
var value := 1

var _attracted := false
var _speed := 0.0
var _bob_phase := 0.0
var _base_scale := 1.0
var _size := 13.0
var _sprite: Sprite2D
var _halo: Sprite2D
var _pointed := false


func setup(pickup_kind: Kind, amount: int) -> void:
	kind = pickup_kind
	value = amount
	_bob_phase = randf() * TAU
	_halo = Sprite2D.new()
	_halo.texture = _halo_glow()
	_halo.modulate = HALO_COLORS[kind]
	add_child(_halo)
	_sprite = Sprite2D.new()
	add_child(_sprite)
	_refresh_texture()


func add_value(amount: int) -> void:
	value += amount
	_refresh_texture()


## Marks this pickup with a bouncing arrow until it is collected.
func point_at() -> void:
	_pointed = true
	queue_redraw()


func attract() -> void:
	if _attracted:
		return
	_attracted = true
	# A small hop away before flying in, so pickups read as "grabbed" rather than vanishing.
	_speed = -50.0


## Moves toward the player once inside their pickup radius. Returns true when collected.
func tick(delta: float, player: Player) -> bool:
	_bob_phase += delta * 3.0
	_sprite.position.y = sin(_bob_phase) * 1.2
	_sprite.scale = Vector2.ONE * _base_scale * (1.0 + PULSE * sin(_bob_phase * 2.0))
	# A short bright flash once per TWINKLE_EVERY seconds, staggered by the random start phase.
	var twinkle := fmod(_bob_phase / 3.0, TWINKLE_EVERY)
	var flash := clampf(1.0 - absf(twinkle - 0.15) / 0.15, 0.0, 1.0)
	_sprite.modulate = Color(1, 1, 1).lerp(Color(1.8, 1.8, 1.8), flash)
	_halo.scale = Vector2.ONE * (_size * HALO_SCALE / _halo.texture.get_height()) * (1.0 + 0.25 * flash)
	if _pointed:
		queue_redraw()
	var offset := player.position - position
	var distance_sq := offset.length_squared()
	if not _attracted and distance_sq <= player.pickup_radius * player.pickup_radius:
		attract()
	if not _attracted:
		return false
	_speed += PULL_ACCELERATION * delta
	var distance := sqrt(distance_sq)
	position += offset / maxf(distance, 0.001) * minf(_speed * delta, distance)
	return distance <= COLLECT_DISTANCE


func _draw() -> void:
	if not _pointed:
		return
	# A ring spreading out from the star once a second, and an arrow bobbing above it.
	var spread := fmod(_bob_phase / 3.0, 1.0)
	draw_arc(Vector2.ZERO, _size * 0.5 + POINTER_RING * spread, 0.0, TAU, 32, Color(Art.BRAND_DEEP, 1.0 - spread), 2.0, true)
	var tip := Vector2(0.0, -_size * 0.5 - 4.0 - absf(sin(_bob_phase * 1.5)) * 4.0)
	var arrow := PackedVector2Array([tip, tip + Vector2(-POINTER_SIZE, -POINTER_SIZE), tip + Vector2(POINTER_SIZE, -POINTER_SIZE)])
	draw_colored_polygon(arrow, Art.BRAND)
	arrow.append(tip)
	draw_polyline(arrow, Art.INK, 1.5, true)
	draw_line(tip + Vector2(0.0, -POINTER_SIZE), tip + Vector2(0.0, -POINTER_HEIGHT), Art.INK, 2.0, true)


func _refresh_texture() -> void:
	var art_name: String
	var size: float
	if kind == Kind.XP:
		art_name = Art.star(value)
		size = STAR_SIZES[art_name]
	else:
		art_name = LOOKS[kind][0]
		size = LOOKS[kind][1]
	_size = size
	_sprite.texture = Art.texture(art_name)
	_base_scale = Art.scale_for(art_name, size)
	_sprite.scale = Vector2.ONE * _base_scale
	_halo.scale = Vector2.ONE * (size * HALO_SCALE / _halo.texture.get_height())


## A soft white disc fading to nothing at the rim, tinted per kind by the halo's modulate.
static func _halo_glow() -> GradientTexture2D:
	if _halo_texture == null:
		var gradient := Gradient.new()
		gradient.offsets = PackedFloat32Array([0.0, 0.45, 1.0])
		gradient.colors = PackedColorArray([Color(1, 1, 1, 0.9), Color(1, 1, 1, 0.55), Color(1, 1, 1, 0.0)])
		_halo_texture = GradientTexture2D.new()
		_halo_texture.gradient = gradient
		_halo_texture.fill = GradientTexture2D.FILL_RADIAL
		_halo_texture.fill_from = Vector2(0.5, 0.5)
		_halo_texture.fill_to = Vector2(1.0, 0.5)
		_halo_texture.width = 64
		_halo_texture.height = 64
	return _halo_texture
