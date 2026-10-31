class_name GuideWeapon
extends Weapon
## A chart's axes: every so often a horizontal and a vertical line are pulled across the whole
## screen through where the player stands, and stay a moment; enemies on a line keep taking
## damage. (Silicon Valley: 坐标轴; it was the designer's 参考线, guides, until the two jobs swapped
## weapons.) Vampire Survivors' Song of Mana, a column of light through the player.
## 实时看板 (evolved with 开源项目): the lines stay until the next set replaces them.
##
## The data scientist's own weapon, so it levels up along two directions (Upgrades.BRANCHES):
## 更多网格线 adds one more line each way, 更粗更久 makes every line wider, longer-lasting and
## harder-hitting. A new set always replaces the last, so lasting longer only fills the gap
## until the next set (from 2 levels of 更粗更久 the lines are always up) and never stacks.

## 2.0, down from 2.4, so the lines are up three quarters of the time: data scientist bots ended
## their first three minutes anywhere from level 5 to 11, one at a third of its health.
const COOLDOWN := 2.0
## Per tick, every TICK seconds, to everything on a line.
## 7 a hit at level 1 (.39, the user's call): an opening Bug (8 health, 10.4 in Beijing, up to 13
## by 1:00) takes two hits on every map. Growth and pace come from the balance fit (DESIGN.md 2.2).
const BASE_DAMAGE := 7.0
const DAMAGE_PER_THICKER := 1.5
const TICK := 0.43
const BASE_WIDTH := 8.0
const WIDTH_PER_THICKER := 4.0
const BASE_SECONDS := 1.5
const SECONDS_PER_THICKER := 0.4
## How far from the player each line of a set runs, the first through the player.
const OFFSETS := [0.0, 40.0, -40.0, 80.0, -80.0]
## The data scientist's purple.
const COLOR := Color("8c7cf0")


class Guide:
	var horizontal := true
	## The line's y if horizontal, its x if vertical.
	var at := 0.0
	var life := 0.0
	var tick_left := 0.0


var _guides: Array[Guide] = []
var _floor: Node2D


## The lines with `more` upgrades to 更多网格线 and `thicker` to 更粗更久 (the cards' numbers too):
## `count` lines each way.
static func branch_stats(more: int, thicker: int) -> Dictionary:
	return {"count": 1 + more, "damage": BASE_DAMAGE + DAMAGE_PER_THICKER * thicker,
		"size": (BASE_WIDTH + WIDTH_PER_THICKER * thicker) / BASE_WIDTH, "duration": BASE_SECONDS + SECONDS_PER_THICKER * thicker}


func _ready() -> void:
	# Drawn in world space on the ground, under the crowd, like a meeting room.
	_floor = Node2D.new()
	_floor.z_index = -4
	_floor.draw.connect(_draw_guides)
	game.add_child(_floor)


## The ground drawing lives on the game, not under the weapon: it goes with the weapon (a job
## switched on the title screen drops its weapon).
func _exit_tree() -> void:
	if is_instance_valid(_floor):
		_floor.queue_free()


func cooldown() -> float:
	return COOLDOWN


func fire() -> bool:
	var stats := branch_stats(branch_a, branch_b)
	# One set at a time (.32): with 更粗更久 a set outlives the cooldown, and overlapping sets all
	# ticked on whatever stood next to the player, so nothing got close (bots as the data
	# scientist lasted the full 10 minutes 28% of the time, 8% with this).
	_guides.clear()
	for i in stats["count"]:
		for horizontal in [true, false]:
			var guide := Guide.new()
			guide.horizontal = horizontal
			guide.at = (player.position.y if horizontal else player.position.x) + OFFSETS[i]
			# Evolved, a set lasts until the next replaces it.
			guide.life = INF if evolved else stats["duration"]
			_guides.append(guide)
	return true


func _process(delta: float) -> void:
	super(delta)
	var stats := branch_stats(branch_a, branch_b)
	var damage: float = stats["damage"] * damage_scale()
	var half_width: float = BASE_WIDTH * stats["size"] / 2.0
	var on_screen := game.visible_enemies()
	for i in range(_guides.size() - 1, -1, -1):
		var guide := _guides[i]
		guide.life -= delta
		if guide.life <= 0.0:
			_guides.remove_at(i)
			continue
		guide.tick_left -= delta
		if guide.tick_left > 0.0:
			continue
		guide.tick_left = TICK * player.cooldown_scale
		for enemy in on_screen:
			var across := enemy.position.y if guide.horizontal else enemy.position.x
			if absf(across - guide.at) <= half_width + enemy.hit_radius:
				game.damage_enemy(enemy, damage, Vector2.ZERO, id, true)
	_floor.queue_redraw()


## Each guide across the visible screen: a soft band as wide as it hits, with a crisp line down
## its middle, fading out at the end.
func _draw_guides() -> void:
	var stats := branch_stats(branch_a, branch_b)
	var width: float = BASE_WIDTH * stats["size"]
	var half := game.view_half() + Vector2(20.0, 20.0)
	var centre := player.position
	for guide in _guides:
		var alpha := clampf(guide.life * 4.0, 0.0, 1.0)
		var from := Vector2(centre.x - half.x, guide.at) if guide.horizontal else Vector2(guide.at, centre.y - half.y)
		var to := Vector2(centre.x + half.x, guide.at) if guide.horizontal else Vector2(guide.at, centre.y + half.y)
		_floor.draw_line(from, to, Color(COLOR, 0.22 * alpha), width)
		_floor.draw_line(from, to, Color(COLOR, 0.9 * alpha), 1.5)
