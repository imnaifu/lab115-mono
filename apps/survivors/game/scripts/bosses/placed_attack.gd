class_name PlacedAttack
extends BossAttack
## 定点 (.45): red shapes put down round the player, going off after `fuse`. The boss stands until
## the last has gone off.
## - "bigcircle" / "bigsquare": one big one where the player stands.
## - "chain": one under the player every `every` seconds, `count` of them, so they trail behind
##   someone who keeps walking.
## - "lead": where the player will be `ahead` seconds on at their pace (a circle, or a box `size`),
##   `count` of them `every` seconds apart; turning or stopping gets out of the way.
## - "cross": two diagonal bands crossing on the player (a red X).
## - "plus": one on the player and one each way `spacing` off (a plus of five).
## - "checker": a 3 × 3 grid of `cell`s on the player, the middle and the corners red.

var _drops_left := 0
var _drop_left := 0.0


func start() -> void:
	var at := player().position
	var fuse: float = config["fuse"]
	_drops_left = 0
	match form():
		"bigcircle":
			circle(at, config["radius"], fuse)
		"bigsquare":
			var half: float = config["half"]
			rect(at, Vector2(half, half), 0.0, fuse)
		"chain", "lead":
			_drops_left = config["count"]
			_drop_left = 0.0
			_drop()
		"cross":
			var half := Vector2((config["length"] as float) / 2.0, (config["width"] as float) / 2.0)
			rect(at, half, PI / 4.0, fuse)
			rect(at, half, -PI / 4.0, fuse)
		"plus":
			var spacing: float = config["spacing"]
			for offset: Vector2 in [Vector2.ZERO, Vector2(spacing, 0.0), Vector2(-spacing, 0.0), Vector2(0.0, spacing), Vector2(0.0, -spacing)]:
				circle(at + offset, config["radius"], fuse)
		"checker":
			var cell: float = config["cell"]
			for column in range(-1, 2):
				for row in range(-1, 2):
					if (column + row) % 2 == 0:
						rect(at + Vector2(column, row) * cell, Vector2(cell, cell) / 2.0, 0.0, fuse)


## Every 定点 shape is bombed (BossAttack `bomb`): a bomb drops on it and it blows up.
func add_zone(zone: Zone) -> Zone:
	zone.bomb = true
	return super(zone)


func busy() -> bool:
	return _drops_left > 0 or not zones.is_empty()


func tick(delta: float) -> Vector2:
	enemy.bracing = true
	if _drops_left > 0:
		_drop_left -= delta
		if _drop_left <= 0.0:
			_drop()
	return Vector2.ZERO


func clear() -> void:
	super()
	_drops_left = 0
	enemy.bracing = false


func went_off(_zone: Zone) -> void:
	Sound.play("quake")
	if not busy():
		enemy.bracing = false


## The next of a chain or a lead's shapes.
func _drop() -> void:
	_drops_left -= 1
	_drop_left = config["every"]
	var fuse: float = config["fuse"]
	var at := player().position
	if form() == "lead":
		at += player().velocity * (config["ahead"] as float)
	if config.has("size"):
		rect(at, (config["size"] as Vector2) / 2.0, 0.0, fuse)
	else:
		circle(at, config["radius"], fuse)
