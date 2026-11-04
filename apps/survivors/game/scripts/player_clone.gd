class_name PlayerClone
extends Player
## The designer's 大招 复制图层 (.81, Ultimates; the user: 分身会自动躲避，有所有武器和数值，会受伤
## 害，死了就死了): a copy of the player as they are when it goes off, every weapon (but the
## outsourced decoys, which belong to the one player) at its level and every stat, with health
## of its own. It steers itself: away from the crowd near it, back toward the player when it
## strays past LEASH, and keeps a little to one side otherwise. Gone after SECONDS or when its
## health runs out. Game owns it (Game.clones) and hurts it on contact like the player.

const SECONDS := 15.0
## How far from the player it may wander before heading back, and where it stands otherwise.
const LEASH := 200.0
const BESIDE := 70.0
## Enemies nearer than this push its steering away.
const AVOID := 110.0
const FADE_SECONDS := 0.6

var seconds_left := SECONDS
var _side := 1.0


func _ready() -> void:
	# No camera: the player's is the screen's.
	_sprite = Art.sprite(Jobs.data(job)["art"], SIZE)
	_base_scale = _sprite.scale.x
	add_child(_sprite)
	_side = 1.0 if randf() < 0.5 else -1.0


## Copies `source` (the player): its job, stats and weapons.
func copy_from(source: Player) -> void:
	job = source.job
	max_hp = source.max_hp
	hp = source.max_hp
	armor = source.armor
	base_move_speed = source.base_move_speed
	move_speed = source.move_speed
	might = source.might
	cooldown_scale = source.cooldown_scale
	pickup_radius = 0.0
	position = source.position + Vector2(BESIDE * _side, 0.0)
	for weapon in source.weapons:
		if weapon.id == "outsource":
			continue
		var copy := Upgrades.create_weapon(weapon.id)
		copy.level = weapon.level
		copy.branch_a = weapon.branch_a
		copy.branch_b = weapon.branch_b
		copy.evolved = weapon.evolved
		copy.damage_bonus = weapon.damage_bonus
		add_weapon(copy)
		copy._on_level_changed()


func _process(delta: float) -> void:
	seconds_left -= delta
	if seconds_left <= 0.0 or hp <= 0.0:
		_vanish()
		return
	input_override = _steer()
	super(delta)
	# A see-through blue copy, fading out over its last moments.
	var alpha := 0.75 * clampf(seconds_left / FADE_SECONDS, 0.0, 1.0)
	_sprite.modulate = Color(0.7, 0.85, 1.0, alpha) if _invuln_left <= 0.0 else Color(1.0, 0.5, 0.5, alpha)


func _steer() -> Vector2:
	var player := game.player
	var away := Vector2.ZERO
	for enemy in game.query_enemies(position, AVOID, false):
		var offset := position - enemy.position
		away += offset / maxf(offset.length_squared(), 1.0)
	var spot := player.position + Vector2(BESIDE * _side, 0.0)
	var toward := spot - position
	var steer := toward.normalized() * clampf(toward.length() / LEASH, 0.2, 2.0) if toward.length() > 8.0 else Vector2.ZERO
	if away.length_squared() > 0.000001:
		steer += away.normalized() * 1.5
	return steer.limit_length(1.0)


## Hurt like the player (armour, a moment untouchable after a hit), but going down is just the end
## of it: nothing for the run.
func take_damage(amount: float) -> void:
	if _invuln_left > 0.0 or hp <= 0.0:
		return
	hp -= minf(hp, maxf(1.0, amount - armor))
	_invuln_left = INVULN_SECONDS
	_hurt_left = HURT_GLOW_SECONDS
	queue_redraw()


func shake(_seconds: float, _strength: float) -> void:
	pass


func _vanish() -> void:
	if is_queued_for_deletion():
		return
	Effects.poof(game, position, Color(0.7, 0.85, 1.0))
	queue_free()
