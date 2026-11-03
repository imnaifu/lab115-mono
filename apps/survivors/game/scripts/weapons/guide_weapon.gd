class_name GuideWeapon
extends Weapon
## A design tool's layout grid: every so often a horizontal and a vertical gridline are pulled
## through where the player stands, a small cross at first and right across the screen at full
## 更长, and stay a moment; enemies on a line keep taking damage. (Silicon Valley: 网格线. It was the designer's 参考线, guides, in .12-.13,
## the data scientist's 坐标轴, a chart's axes, in .14-.40, and the designer's again from .41; the
## chart look, purple lines and a bar-chart icon, stayed on it until .49.) Vampire Survivors' Song
## of Mana, a column of light through the player.
## 栅格系统 (evolved with 开源项目; 实时看板 until .49): the lines stay until the next set replaces
## them.
##
## The designer's own weapon, so it levels up along two directions (Upgrades.BRANCHES):
## 更长 draws both lines longer, 更粗 makes them wider and harder-hitting. Always one line each way
## since .74 (the user: 线改短一点，升级是加长和加粗，不加数量；线加满才全屏，一开始就个十字):
## .41–.73 every line ran across the whole screen and 更多网格线 added one more, up to three each
## way, so in a late crowd it outdid every other job's weapon (about 600 damage a second alone at
## 8:00 against the programmer's 360); 更粗 went from +1.5 a level to +3.5 to make up for the lines
## it no longer adds, about 520 a second at full level at 8:00.
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
## Per tick, every TICK seconds, to everything on a line. 0.6 from .58 (the user: 设计师也降一下,
## 单纯变弱, nothing given back): a quarter less damage a second than the 0.43 before.
## 7 a hit at level 1 (.39, the user's call): an opening Bug (8 health, 10.4 in Beijing, up to 13
## by 1:00) takes two hits on every map. Growth and pace come from the balance fit (DESIGN.md 2.2).
const BASE_DAMAGE := 7.0
const DAMAGE_PER_THICKER := 3.5
const TICK := 0.6
const BASE_WIDTH := 8.0
const WIDTH_PER_THICKER := 4.0
## How long a set stays: three quarters of the cooldown, and like the cooldown shorter with 双屏
## and the other cooldown bonuses, so the quarter left open never closes.
const BASE_SECONDS := 1.5
## A set fades in over FADE_IN and out over its last FADE_OUT seconds.
const FADE_IN := 0.15
const FADE_OUT := 0.3
## How far each line runs either way from the player with no 更长: a small cross. Each 更长 takes it
## a quarter of the way on to the screen's edge (the view's half width for the horizontal line, its
## half height for the vertical one), so at BRANCH_MAX it crosses the whole screen.
const START_HALF := 60.0
## The landscape view's half width (640 / 2): what the cards and the 官网 give as 长度, the
## horizontal line's reach on a computer.
const SHOWN_SCREEN_HALF := 320.0
## The designer's pink, the soft red of a design tool's layout grid. The data scientist's purple
## (8c7cf0) until .49, when the data scientist's needle took that colour.
const COLOR := Color("ff5d9e")


class Guide:
	var horizontal := true
	## The line's y if horizontal, its x if vertical.
	var at := 0.0
	## Where along the line its middle is (x if horizontal), and how far it runs either way.
	var middle := 0.0
	var half_length := 0.0
	var life := 0.0
	var age := 0.0
	var tick_left := 0.0


var _guides: Array[Guide] = []
var _floor: Node2D


## The lines with `longer` upgrades to 更长 and `thicker` to 更粗 (the cards' numbers too): `range`
## is how far the horizontal line runs either way on a computer's screen (SHOWN_SCREEN_HALF at
## full). `duration` is the same at every level, before cooldown bonuses.
static func branch_stats(longer: int, thicker: int) -> Dictionary:
	return {"range": reach_share(longer) * (SHOWN_SCREEN_HALF - START_HALF) + START_HALF,
		"damage": BASE_DAMAGE + DAMAGE_PER_THICKER * thicker,
		"size": (BASE_WIDTH + WIDTH_PER_THICKER * thicker) / BASE_WIDTH, "duration": BASE_SECONDS}


## How far from START_HALF to the screen's edge the lines run after `longer` upgrades to 更长.
static func reach_share(longer: int) -> float:
	return clampf(float(longer) / Upgrades.BRANCH_MAX, 0.0, 1.0)


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
		var guide := Guide.new()
		guide.horizontal = horizontal
		guide.at = player.position.y if horizontal else player.position.x
		guide.middle = player.position.x if horizontal else player.position.y
		# A small cross, out to the screen's edges at full 更长 (each axis its own: on a phone held
		# upright the horizontal line has less screen to cross).
		var edge: float = game.view_half().x if horizontal else game.view_half().y
		guide.half_length = lerpf(START_HALF, maxf(edge, START_HALF), reach_share(branch_a))
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
			var along := enemy.position.x if guide.horizontal else enemy.position.y
			if absf(across - guide.at) <= half_width + enemy.hit_radius and absf(along - guide.middle) <= guide.half_length + enemy.hit_radius:
				game.damage_enemy(enemy, damage, Vector2.ZERO, id, true)
	_floor.queue_redraw()


## Each guide as far as it reaches from where it was pulled (.74; across the visible screen until
## then): a soft band as wide as it hits, with a crisp line down its middle, fading in at the start
## and out at the end.
func _draw_guides() -> void:
	var stats := branch_stats(branch_a, branch_b)
	var width: float = BASE_WIDTH * stats["size"]
	for guide in _guides:
		var alpha := clampf(minf(guide.age / FADE_IN, guide.life / FADE_OUT), 0.0, 1.0)
		var from := Vector2(guide.middle - guide.half_length, guide.at) if guide.horizontal else Vector2(guide.at, guide.middle - guide.half_length)
		var to := Vector2(guide.middle + guide.half_length, guide.at) if guide.horizontal else Vector2(guide.at, guide.middle + guide.half_length)
		_floor.draw_line(from, to, Color(COLOR, 0.22 * alpha), width)
		_floor.draw_line(from, to, Color(COLOR, 0.9 * alpha), 1.5)
