class_name Stamps
extends RefCounted
## 打卡: walk up to one of the map's landmarks (Maps.current.STAMPS) and stay within RADIUS of it
## for CHECK_IN_SECONDS to check in there for good (Progress). A stamp comes down on the screen
## and the landmark's small bonus applies from then on, this run and every run after, on every
## map: the first piece of 局外成长. The near ones are a few seconds' walk from the start, the
## Golden Gate (or the Bird's Nest) about a minute away, so a short first run still checks in
## somewhere.

const RADIUS := 110.0
const CHECK_IN_SECONDS := 1.0
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
## The landmark being stood at, and for how long so far.
var _at := ""
var _held := 0.0
## Landmark id -> where to stand, worked out once.
var _spots := {}


func _init(game: Game) -> void:
	_game = game


## Where to stand to check in at `id`.
func spot(id: String) -> Vector2:
	if not _spots.has(id):
		_spots[id] = _game.city.stamp_spot(Maps.current.STAMPS[id]["block"])
	return _spots[id]


## How far along checking in is (0 to 1), for the ring over the player; 0 when not at one.
func progress() -> float:
	return _held / CHECK_IN_SECONDS if _at != "" else 0.0


func tick(delta: float) -> void:
	var near := ""
	for id: String in Maps.current.STAMPS:
		if not Progress.has_stamp(id) and _game.player.position.distance_to(spot(id)) <= RADIUS:
			near = id
			break
	if near != _at:
		_at = near
		_held = 0.0
	if _at == "":
		return
	_held += delta
	if _held < CHECK_IN_SECONDS:
		return
	var id := _at
	_at = ""
	_held = 0.0
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
