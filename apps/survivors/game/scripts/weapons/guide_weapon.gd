class_name GuideWeapon
extends Weapon
## A design tool's layout grid: every so often a horizontal and a vertical gridline are pulled
## across the whole screen through where the player stands, and stay a moment; enemies on a line
## keep taking damage. (Silicon Valley: 网格线. It was the designer's 参考线, guides, in .12-.13,
## the data scientist's 坐标轴, a chart's axes, in .14-.40, and the designer's again from .41; the
## chart look, purple lines and a bar-chart icon, stayed on it until .49.) Vampire Survivors' Song
## of Mana, a column of light through the player.
## 栅格系统 (evolved with 开源项目; 实时看板 until .49): the lines stay until the next set replaces
## them.
##
## The designer's own weapon, so it levels up along two directions (Upgrades.BRANCHES):
## 更多网格线 adds one more line each way, 更粗 makes every line wider and harder-hitting.
##
## A set stays three quarters of its cycle and is gone for the last quarter, however it is
## upgraded (.49, the user's call: 去掉更久). Until then 更粗 was 更粗更久 and each level also made a
## set last 0.4 s longer: from two levels on a set lasted the whole cycle, so a grid stood round the
## player all the time, the two lines through them catching anything that touched them, and the
## user stood still through the last two minutes and won.
##
## A set lives at most one cycle (the cooldown, sped up as it is) and fades in and out, so the next
## takes over as the last has faded (.41, the user's report: a set that outlived the cycle was
## still at full strength when the next one replaced it, a flash every two seconds).

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
## How long a set stays: three quarters of the cooldown, and like the cooldown shorter with 双屏
## and the other cooldown bonuses, so the quarter left open never closes.
const BASE_SECONDS := 1.5
## A set fades in over FADE_IN and out over its last FADE_OUT seconds.
const FADE_IN := 0.15
const FADE_OUT := 0.3
## How far from the player each line of a set runs, the first through the player.
## Where each axis's lines go, out from the player. 更多网格线 adds one line a time, across then down
## in turn, three each way at most (.41, the user's call: it added one each way a time, up to five
## each way, and made the data scientist the strongest job).
const OFFSETS := [0.0, 40.0, -40.0]
## The designer's pink, the soft red of a design tool's layout grid. The data scientist's purple
## (8c7cf0) until .49, when the data scientist's needle took that colour.
const COLOR := Color("ff5d9e")


class Guide:
	var horizontal := true
	## The line's y if horizontal, its x if vertical.
	var at := 0.0
	var life := 0.0
	var age := 0.0
	var tick_left := 0.0


var _guides: Array[Guide] = []
var _floor: Node2D


## The lines with `more` upgrades to 更多网格线 and `thicker` to 更粗 (the cards' numbers too):
## `count` lines each way. `duration` is the same at every level, before cooldown bonuses.
static func branch_stats(more: int, thicker: int) -> Dictionary:
	return {"rows": 1 + ceili(more / 2.0), "columns": 1 + floori(more / 2.0), "damage": BASE_DAMAGE + DAMAGE_PER_THICKER * thicker,
		"size": (BASE_WIDTH + WIDTH_PER_THICKER * thicker) / BASE_WIDTH, "duration": BASE_SECONDS}


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
	# One set at a time (.32): when 更粗更久 made a set outlive the cooldown, overlapping sets all
	# ticked on whatever stood next to the player, so nothing got close (bots as the data
	# scientist lasted the full 10 minutes 28% of the time, 8% with this).
	_guides.clear()
	for horizontal in [true, false]:
		for i in mini(stats["rows"] if horizontal else stats["columns"], OFFSETS.size()):
			var guide := Guide.new()
			guide.horizontal = horizontal
			guide.at = (player.position.y if horizontal else player.position.x) + OFFSETS[i]
			# Three quarters of the cycle, sped up with it, so a gap is always left before the next
			# set (evolved, it lasts until then).
			var cycle := COOLDOWN * player.cooldown_scale
			guide.life = cycle if evolved else stats["duration"] * player.cooldown_scale
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
		guide.age += delta
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
## its middle, fading in at the start and out at the end.
func _draw_guides() -> void:
	var stats := branch_stats(branch_a, branch_b)
	var width: float = BASE_WIDTH * stats["size"]
	var half := game.view_half() + Vector2(20.0, 20.0)
	var centre := player.position
	for guide in _guides:
		var alpha := clampf(minf(guide.age / FADE_IN, guide.life / FADE_OUT), 0.0, 1.0)
		var from := Vector2(centre.x - half.x, guide.at) if guide.horizontal else Vector2(guide.at, centre.y - half.y)
		var to := Vector2(centre.x + half.x, guide.at) if guide.horizontal else Vector2(guide.at, centre.y + half.y)
		_floor.draw_line(from, to, Color(COLOR, 0.22 * alpha), width)
		_floor.draw_line(from, to, Color(COLOR, 0.9 * alpha), 1.5)
