class_name Stamps
extends RefCounted
## 打卡: one of the map's landmarks (Maps.current.STAMPS) opens at its time in the run (OPEN_AT, by
## its place in STAMPS: nearest first), and from then on a ring lies on the ground in front of it;
## standing in the ring for CHECK_IN_SECONDS all told checks in there for good (Progress). A stamp
## comes down on the screen and the landmark's small bonus applies from then on, this run and every
## run after, on every map: the first piece of 局外成长. It is all the reward there is (.68, the user:
## 打卡只给局外永久奖励).
##
## Since .68 (the user: 1 3 5 7 9 开门；出圈倒退，不暂停，不清零): the landmarks open at 1:00, 3:00,
## 5:00, 7:00 and 9:00 and stay open; outside the ring the time stood there runs back down as fast
## as it built up, and back inside it climbs again from what is left (kept for this run only). The
## rush to every landmark in the first minute, while the enemies are few, is what the times stop.
## Until .67 any landmark could be checked in at any time by standing within 110 of it for a second.

## The ring's radius, round ring_center(): 120 from .77 (the user: 打开的圈略微小一点; 150 until then).
const RADIUS := 120.0
const CHECK_IN_SECONDS := 10.0
## When each landmark opens (run seconds), by its place in the map's STAMPS.
const OPEN_AT := [60.0, 180.0, 300.0, 420.0, 540.0]
## The ring lies this far in front of (south of) where City says to stand, so most of it is open
## ground rather than under the landmark's drawing.
const RING_AHEAD := 60.0
## How each kind of bonus reads on the 打卡 page, given its amount.
const BONUSES := {
	"might": "伤害 +%d%%", "haste": "冷却 -%d%%", "speed": "移速 +%d%%",
	"max_hp": "最大生命 +%d", "magnet": "拾取范围 +%d%%", "regen": "每秒回血 +%s", "luck": "运气 +%d",
}
## Kinds whose amount is a plain number rather than a fraction shown as a percent.
const PLAIN_BONUSES := ["max_hp", "regen", "luck"]

signal checked_in(id: String)

## Checked in at this run, in order (the result screen and the run's data).
var new_ids := PackedStringArray()

var _game: Game
## The landmark whose ring the player is standing in, or "".
var _inside := ""
## Landmark id -> seconds stood in its ring so far this run (running back down outside it).
var _held := {}
## Landmarks whose opening has been announced (or that were open before the run reached them).
var _announced := {}
## Landmark id -> its ring's centre, worked out once.
var _centers := {}


func _init(game: Game) -> void:
	_game = game


## The middle of `id`'s ring: in front of where City says to stand at it.
func ring_center(id: String) -> Vector2:
	if not _centers.has(id):
		_centers[id] = _game.city.stamp_spot(Maps.current.STAMPS[id]["block"]) + Vector2(0.0, RING_AHEAD)
	return _centers[id]


## The run second `id` opens at (OPEN_AT by its place in the map's STAMPS; the last time for any
## past the fifth).
static func open_at(id: String) -> float:
	var index: int = Maps.current.STAMPS.keys().find(id)
	return OPEN_AT[clampi(index, 0, OPEN_AT.size() - 1)]


func is_open(id: String) -> bool:
	return _game.elapsed >= open_at(id)


## How far along checking in at `id` is, 0 to 1.
func held_ratio(id: String) -> float:
	return minf(_held.get(id, 0.0) / CHECK_IN_SECONDS, 1.0)


## How far along checking in is (0 to 1), for the ring over the player; 0 when not in a ring.
func progress() -> float:
	return held_ratio(_inside) if _inside != "" else 0.0


func tick(delta: float) -> void:
	_inside = ""
	for id: String in Maps.current.STAMPS:
		if Progress.has_stamp(id) or not is_open(id):
			continue
		if not _announced.has(id):
			_announced[id] = true
			# Not for one a run started past (测试模式's later start): only as it opens.
			if _game.elapsed - open_at(id) < 1.0:
				_game.announce(tr("%s 开门了，去打卡！") % tr(Maps.current.STAMPS[id]["name"]))
		var held: float = _held.get(id, 0.0)
		if _game.player.position.distance_to(ring_center(id)) <= RADIUS:
			_inside = id
			held += delta
		else:
			held = maxf(0.0, held - delta)
		_held[id] = held
		if held >= CHECK_IN_SECONDS:
			_check_in(id)


func _check_in(id: String) -> void:
	_held.erase(id)
	if _inside == id:
		_inside = ""
	Progress.add_stamp(id)
	new_ids.append(id)
	apply_bonus(_game.player, id)
	checked_in.emit(id)


## Every landmark checked in at so far, on any map, on a player starting a run.
static func apply_all(player: Player) -> void:
	for id in Progress.stamp_ids():
		if not Maps.stamp(id).is_empty():
			apply_bonus(player, id)


static func apply_bonus(player: Player, id: String) -> void:
	var bonus: Array = Maps.stamp(id)["bonus"]
	var amount: float = bonus[1]
	match bonus[0]:
		"might":
			player.might += amount
		"haste":
			player.cooldown_scale *= 1.0 - amount
		"speed":
			player.move_speed *= 1.0 + amount
		"max_hp":
			player.max_hp += amount
			player.hp += amount
		"magnet":
			player.pickup_radius *= 1.0 + amount
		"regen":
			player.regen += amount
		"luck":
			player.luck += amount


## The bonus as the 打卡 page shows it, e.g. 伤害 +2%.
static func bonus_text(id: String) -> String:
	var bonus: Array = Maps.stamp(id)["bonus"]
	var amount: float = bonus[1]
	var shown: Variant = amount if bonus[0] in PLAIN_BONUSES else roundi(amount * 100.0)
	return TranslationServer.translate(BONUSES[bonus[0]]) % shown


## All the bonuses checked in so far, added up by kind, in BONUSES order (the 打卡 page's total).
static func total_text() -> PackedStringArray:
	var totals := {}
	for id in Progress.stamp_ids():
		var stamp := Maps.stamp(id)
		if not stamp.is_empty():
			var bonus: Array = stamp["bonus"]
			totals[bonus[0]] = totals.get(bonus[0], 0.0) + bonus[1]
	var lines := PackedStringArray()
	for kind: String in BONUSES:
		if totals.has(kind):
			var shown: Variant = snappedf(totals[kind], 0.01) if kind in PLAIN_BONUSES else roundi(totals[kind] * 100.0)
			lines.append(TranslationServer.translate(BONUSES[kind]) % shown)
	return lines
