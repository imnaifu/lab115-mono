class_name MapObjects
extends Node2D
## Things laid about the map at random each run (.99, the user: 参考 Megabonk，给地图更多随机的设定;
## picked 快递, 紧急会议室, 加班申请 and 工位充电 from its pots and shrines):
## - 快递 (parcels, PARCELS on the map at a time): walking into one opens it (the user: 纸箱碰一下就开),
##   and it always holds stars and one thing (the user: 100% 有掉落，红包多一点), drawn by PARCEL_LOOT; the
##   map's only 珍珠奶茶 since .99 (the user: 奶茶放到快递里面，boss 不用了). Another turns up somewhere
##   else PARCEL_RESPAWN seconds after one is opened.
## - 紧急会议室 (meeting rooms, ROOMS a run): standing in one's ring for ROOM_ENTER starts a meeting:
##   ROOM_ELITES gilded elites of the crowd of the moment (Enemy.make_champion) close in, and
##   clearing them within ROOM_SECONDS opens a year-end bonus (Game._open_chest, the first boss's
##   pay). Too slow, and the meeting ends with them still out and nothing for it.
## - 加班申请 (forms, FORMS a run): standing in one's ring for FORM_SIGN signs it (Game.sign_form):
##   sturdier enemies from then on, richer year-end bonuses and 红包. Signed is signed.
## - 工位 (desks, DESKS a run and maybe a golden one): standing in one's ring for DESK_CHARGE all told
##   (running back down outside it, like a landmark's) offers three stat cards to pick one from
##   (Game.offer_desk, Upgrades.desk_choices), a golden desk's all 史诗 or 传说.
## Each lies at least KEEP_APART from the others, KEEP_FROM_STAMP from a landmark's ring and
## KEEP_FROM_START from where the run starts, inside the map's BOUNDS by EDGE. Drawn on the ground
## like the landmarks' rings (StampRings), the thing itself just above it, the crowd over both.

const PARCELS := 10
const PARCEL_RESPAWN := 60.0
## A new parcel turns up at least this far from the player, out of sight.
const PARCEL_RESPAWN_AWAY := 500.0
## Opened when the player comes this close.
const PARCEL_REACH := 20.0
const PARCEL_SIZE := 24.0
## A parcel says what it is only this close (0.3.11): ten of them labelled at once would clutter.
const PARCEL_LABEL_REACH := 160.0
## What a parcel holds besides its stars: [kind, weight], one drawn every time. 红包 the likeliest
## (the user: 红包多一点). Since 0.3.11 (the user: 快递经验必给，其他按概率给 → 经验必给，再必给一样别的) the
## stars always come and one of these with them (44 / 22 / 17 / 17%); until then just one thing, the
## stars one of five at 10%.
const PARCEL_LOOT := [["red_packet", 40.0], ["heal", 20.0], ["magnet", 15.0], ["nap", 15.0]]
## A parcel's stars: this much XP plus this much a minute into the run.
const PARCEL_XP := 4
const PARCEL_XP_PER_MINUTE := 2
const ROOMS := 3
const ROOM_RADIUS := 60.0
const ROOM_ENTER := 1.0
const ROOM_ELITES := 10
const ROOM_SECONDS := 30.0
const ROOM_ELITE_HEALTH := 3.0
## The elites come in from a ring this far round the player.
const ROOM_CLOSE_IN := 230.0
const ROOM_SIZE := 44.0
const FORMS := 3
const FORM_RADIUS := 50.0
const FORM_SIGN := 2.0
const FORM_SIZE := 26.0
const DESKS := 3
const GOLDEN_DESK_CHANCE := 0.25
const DESK_RADIUS := 70.0
const DESK_CHARGE := 8.0
const DESK_SIZE := 34.0
const GOLD := Color(1.0, 0.8, 0.25)
## A glow under each thing (0.3.10, the user: 快递什么的加个发光之类的明显一点 → 快递那些加发光), the soft disc
## the pickups lie on (Pickup.halo_texture): GLOW_SCALE times the thing's size, its kind's colour
## (the minimap's, a little lighter; a golden desk's gold), swelling and shrinking by GLOW_PULSE and
## brightening and dimming between GLOW_ALPHA, GLOW_SPEED radians a second; and every GLOW_FLASH_EVERY
## seconds the thing itself flashes brighter for a moment, like the pickups' twinkle. Each its own
## phase, so they don't pulse in step.
const GLOW_SCALE := 2.6
const GLOW_PULSE := 0.12
const GLOW_ALPHA := Vector2(0.65, 1.0)
const GLOW_SPEED := 2.4
const GLOW_FLASH_EVERY := 3.0
const GLOW_FLASH_SECONDS := 0.3
const GLOW_COLORS := {"parcel": Color("ffc46b"), "room": Color("7fb2ff"), "form": Color("b48cff"), "desk": Color("6fd68a")}
const KEEP_APART := 260.0
const KEEP_FROM_STAMP := 320.0
const KEEP_FROM_START := 350.0
const EDGE := 160.0
const FONT_SIZE := 13
const LABEL_DROP := 34.0
const TRIES := 80

var game: Game
## Every thing on the map: {kind: parcel / room / form / desk, at, sprite, held (seconds stood in
## its ring), and for a room `state` (idle / on), `left` (seconds) and `elites`; a desk `golden`}.
var _things: Array[Dictionary] = []
## Seconds of play, for the glows (GLOW_SPEED).
var _glow_clock := 0.0
## Seconds until each opened parcel's replacement turns up.
var _parcel_timers: Array[float] = []
## Desks charged while something else held the game (Game.offer_desk), offered in turn.
var desk_waiting: Array[bool] = []
var parcels_opened := 0
var rooms_won := 0
var rooms_lost := 0
var _labels: Node2D
var _label_queue: Array = []
var _start := Vector2.ZERO


func _init() -> void:
	# On the ground, like the landmarks' rings: under the pickups and everyone.
	z_index = -6
	_labels = Node2D.new()
	# Relative to this node's -6: 20 overall, the damage numbers' layer.
	_labels.z_index = 26
	_labels.draw.connect(_draw_labels)
	add_child(_labels)


func _ready() -> void:
	_start = game.player.position
	for i in PARCELS:
		_add("parcel")
	for i in ROOMS:
		_add("room")
	for i in FORMS:
		_add("form")
	for i in DESKS:
		_add("desk")
	if game.rng.randf() < GOLDEN_DESK_CHANCE:
		_add("desk", true)


## Everything laid about the map still there, for the minimap (read only).
func things() -> Array[Dictionary]:
	return _things


func _process(_delta: float) -> void:
	queue_redraw()
	_labels.queue_redraw()


## Game._process, while a run is on.
func tick(delta: float) -> void:
	if not desk_waiting.is_empty():
		game.offer_desk(desk_waiting.pop_front())
	for i in range(_parcel_timers.size() - 1, -1, -1):
		_parcel_timers[i] -= delta
		if _parcel_timers[i] <= 0.0:
			_parcel_timers.remove_at(i)
			_add("parcel", false, PARCEL_RESPAWN_AWAY)
	_glow_clock += delta
	for thing in _things:
		_tick_glow(thing)
	var player_at := game.player.position
	for i in range(_things.size() - 1, -1, -1):
		var thing := _things[i]
		var distance := player_at.distance_to(thing["at"])
		match thing["kind"]:
			"parcel":
				if distance <= PARCEL_REACH:
					_open_parcel(thing)
					_remove(i)
			"form":
				if _stand(thing, distance <= FORM_RADIUS, delta) >= FORM_SIGN:
					Effects.ring(game, thing["at"], FORM_RADIUS, Art.BOSS_RED)
					_remove(i)
					game.sign_form()
			"desk":
				if _stand(thing, distance <= DESK_RADIUS, delta) >= DESK_CHARGE:
					Effects.ring(game, thing["at"], DESK_RADIUS, GOLD if thing["golden"] else Art.GREEN)
					_remove(i)
					if thing["golden"]:
						game.achievements.on_golden_desk()
					game.offer_desk(thing["golden"])
			"room":
				if _tick_room(thing, distance, delta):
					_remove(i)


## Seconds stood in a ring so far: up while inside, back down as fast outside (as a landmark's).
func _stand(thing: Dictionary, inside: bool, delta: float) -> float:
	thing["held"] = thing["held"] + delta if inside else maxf(0.0, thing["held"] - delta)
	return thing["held"]


## A room's meeting: waits for the player to stand in, then runs ROOM_SECONDS. True once it's over.
func _tick_room(room: Dictionary, distance: float, delta: float) -> bool:
	if room["state"] == "idle":
		if _stand(room, distance <= ROOM_RADIUS, delta) >= ROOM_ENTER:
			_start_meeting(room)
		return false
	room["left"] -= delta
	var out := _elites_left(room)
	if out == 0:
		rooms_won += 1
		Sound.play("payout")
		# Said by the bonus's cut-in now (Game.open_meeting_bonus, 0.3.19), not a line at the top.
		Effects.ring(game, room["at"], ROOM_RADIUS * 2.0, Art.BRAND)
		# The first boss's year-end bonus (its pay and an upgrade), opened like one.
		game.open_meeting_bonus()
		return true
	if room["left"] <= 0.0:
		rooms_lost += 1
		game.announce(tr("会没开完…精英还在"))
		return true
	return false


func _start_meeting(room: Dictionary) -> void:
	room["state"] = "on"
	room["left"] = ROOM_SECONDS
	var elites := []
	for i in ROOM_ELITES:
		var direction := Vector2.from_angle(TAU * i / ROOM_ELITES)
		var enemy := game.spawn_enemy(game.spawner.crowd_type(), game.player.position + direction * ROOM_CLOSE_IN)
		enemy.make_champion(ROOM_ELITE_HEALTH)
		elites.append(enemy)
	room["elites"] = elites
	Sound.play("alarm")
	game.announce(tr("紧急会议！%d 秒内打掉 %d 个精英") % [roundi(ROOM_SECONDS), ROOM_ELITES])


## A room's elites still against the player: not dead, not turned to the player's side.
func _elites_left(room: Dictionary) -> int:
	var count := 0
	# Untyped: a killed elite is freed a frame later, and a typed loop variable can't hold a freed one.
	for enemy in room["elites"]:
		if is_instance_valid(enemy) and not enemy.dead and enemy.ally_left <= 0.0:
			count += 1
	return count


func _open_parcel(parcel: Dictionary) -> void:
	parcels_opened += 1
	_parcel_timers.append(PARCEL_RESPAWN)
	Sound.play("pick")
	Effects.poof(game, parcel["at"], Color("c8a06a"))
	drop_loot(parcel["at"])


## A parcel's stars (PARCEL_XP) and one thing from PARCEL_LOOT, drawn by its weights, side by side
## `at`; which thing it was. A parcel's, and since 0.3.0 a landmark checked in at (Stamps._check_in,
## the user: 打卡局内送东西 → 就随机一个掉落物; the stars too since 0.3.11: 一起改，和快递一样).
func drop_loot(at: Vector2) -> String:
	game.drop(Pickup.Kind.XP, at + Vector2(-8.0, 0.0), PARCEL_XP + PARCEL_XP_PER_MINUTE * floori(game.elapsed / 60.0))
	at += Vector2(8.0, 0.0)
	var weights := PackedFloat32Array()
	for entry: Array in PARCEL_LOOT:
		weights.append(entry[1])
	var kind: String = PARCEL_LOOT[game.rng.rand_weighted(weights)][0]
	match kind:
		"red_packet":
			game.drop(Pickup.Kind.RED_PACKET, at, Game.RED_PACKET_SALARY[game.rng.randi() % Game.RED_PACKET_SALARY.size()])
		"heal":
			game.drop(Pickup.Kind.HEAL, at, 1)
		"magnet":
			game.drop(Pickup.Kind.MAGNET, at, 1)
		"nap":
			game.drop(Pickup.Kind.NAP, at, 1)
	return kind


## Lays a `kind` down at a free spot (at least `away` from the player too), with its picture.
func _add(kind: String, golden := false, away := 0.0) -> void:
	var at := _free_spot(away)
	var thing := {"kind": kind, "at": at, "held": 0.0, "golden": golden, "state": "idle", "left": 0.0, "elites": []}
	var sprite: Sprite2D
	var size := PARCEL_SIZE
	match kind:
		"parcel":
			sprite = Art.sprite("parcel", PARCEL_SIZE)
		"room":
			sprite = Art.sprite("meeting_room", ROOM_SIZE)
			size = ROOM_SIZE
		"form":
			sprite = Art.sprite("paper", FORM_SIZE)
			size = FORM_SIZE
		"desk":
			sprite = Art.sprite("monitors", DESK_SIZE)
			size = DESK_SIZE
			if golden:
				sprite.modulate = GOLD
	# The glow (GLOW_SCALE): over the rings drawn on this node, under the thing (added first, same z).
	var halo := Sprite2D.new()
	halo.texture = Pickup.halo_texture()
	halo.modulate = GOLD if golden else GLOW_COLORS[kind]
	halo.position = at
	halo.z_index = 1
	add_child(halo)
	thing["halo"] = halo
	thing["glow_scale"] = size * GLOW_SCALE / halo.texture.get_height()
	thing["glow_phase"] = game.rng.randf() * TAU
	thing["tint"] = sprite.modulate
	sprite.position = at
	# Just over the rings drawn on this node.
	sprite.z_index = 1
	add_child(sprite)
	thing["sprite"] = sprite
	_things.append(thing)


func _remove(index: int) -> void:
	var sprite: Sprite2D = _things[index]["sprite"]
	sprite.queue_free()
	(_things[index]["halo"] as Sprite2D).queue_free()
	_things.remove_at(index)


## A thing's glow this frame (GLOW_SCALE): the halo swelling and brightening, the thing flashing now and then.
func _tick_glow(thing: Dictionary) -> void:
	var phase: float = thing["glow_phase"]
	var wave := sin(_glow_clock * GLOW_SPEED + phase)
	var halo: Sprite2D = thing["halo"]
	halo.scale = Vector2.ONE * float(thing["glow_scale"]) * (1.0 + GLOW_PULSE * wave)
	halo.modulate.a = lerpf(GLOW_ALPHA.x, GLOW_ALPHA.y, (wave + 1.0) / 2.0)
	var since := fmod(_glow_clock + phase, GLOW_FLASH_EVERY)
	var flash := clampf(1.0 - absf(since - GLOW_FLASH_SECONDS / 2.0) / (GLOW_FLASH_SECONDS / 2.0), 0.0, 1.0)
	var tint: Color = thing["tint"]
	(thing["sprite"] as Sprite2D).modulate = tint.lerp(Color(tint.r * 1.7, tint.g * 1.7, tint.b * 1.7, tint.a), flash)


## A random spot on the map clear of the rest (KEEP_*); after TRIES, the last one tried.
func _free_spot(away: float) -> Vector2:
	var bounds: Rect2 = Maps.current.BOUNDS.grow(-EDGE)
	var spot := bounds.get_center()
	for attempt in TRIES:
		spot = bounds.position + Vector2(game.rng.randf(), game.rng.randf()) * bounds.size
		if _clear(spot, away):
			return spot
	return spot


func _clear(spot: Vector2, away: float) -> bool:
	if spot.distance_to(_start) < KEEP_FROM_START or game.city.is_water(spot):
		return false
	if away > 0.0 and spot.distance_to(game.player.position) < away:
		return false
	for id: String in Maps.current.STAMPS:
		if spot.distance_to(game.stamps.ring_center(id)) < KEEP_FROM_STAMP:
			return false
	for thing in _things:
		if spot.distance_to(thing["at"]) < KEEP_APART:
			return false
	return true


func _draw() -> void:
	_label_queue.clear()
	if game.state == Game.State.TITLE:
		return
	var reach := game.view_half() + Vector2.ONE * (DESK_RADIUS + 40.0)
	for thing in _things:
		var offset: Vector2 = thing["at"] - game.player.position
		if absf(offset.x) > reach.x or absf(offset.y) > reach.y:
			continue
		# Each says what it is and what it's for, on two lines (0.3.11, the user: 紧急会议室是干啥的，地图上都标清楚).
		match thing["kind"]:
			"parcel":
				if offset.length() <= PARCEL_LABEL_REACH:
					_label(thing["at"], PARCEL_SIZE * 0.5 + 12.0, tr("快递 · 碰一下就开") + "\n" + tr("必有经验，还可能有红包 / 奶茶 / 磁铁 / 午休"), Color("a8743a"))
			"room":
				_draw_room(thing)
			"form":
				_draw_ring(thing["at"], FORM_RADIUS, thing["held"] / FORM_SIGN, Art.BOSS_RED, Art.PINK_LIGHT)
				_label(thing["at"], FORM_RADIUS, tr("加班申请 · 站 %s 秒签字") % _seconds(FORM_SIGN) + "\n" \
					+ tr("之后怪 +%d%% 血，年终奖和红包 +%d%%") % [roundi(Game.FORM_HEALTH * 100.0), roundi(Game.FORM_REWARD * 100.0)], Art.BOSS_RED)
			"desk":
				var color: Color = GOLD if thing["golden"] else Art.GREEN
				_draw_ring(thing["at"], DESK_RADIUS, thing["held"] / DESK_CHARGE, color, Art.MINT_LIGHT)
				var name := tr("金色工位") if thing["golden"] else tr("工位")
				var what := tr("站满 %d 秒选一张史诗 / 传说属性卡") if thing["golden"] else tr("站满 %d 秒选一张属性卡")
				_label(thing["at"], DESK_RADIUS, tr("%s · 充电 %d/%d") % [name, floori(thing["held"]), roundi(DESK_CHARGE)] + "\n" \
					+ what % roundi(DESK_CHARGE), Art.GREEN_INK)


func _draw_room(room: Dictionary) -> void:
	if room["state"] == "idle":
		_draw_ring(room["at"], ROOM_RADIUS, room["held"] / ROOM_ENTER, Art.LINK, Art.SKY_LIGHT)
		_label(room["at"], ROOM_RADIUS, tr("紧急会议室 · 站进圈开会") + "\n" \
			+ tr("%d 秒内打完 %d 个精英，开一份年终奖") % [roundi(ROOM_SECONDS), ROOM_ELITES], Art.LINK)
		return
	# The meeting on: the ring empties as the time runs out.
	_draw_ring(room["at"], ROOM_RADIUS, room["left"] / ROOM_SECONDS, Art.BOSS_RED, Art.PINK_LIGHT)
	_label(room["at"], ROOM_RADIUS, tr("会议中 %d 秒 · 还剩 %d 个") % [ceili(room["left"]), _elites_left(room)], Art.BOSS_RED)


## A ring on the ground, its rim filled `ratio` of the way round from the top.
func _draw_ring(center: Vector2, radius: float, ratio: float, color: Color, fill: Color) -> void:
	draw_circle(center, radius, Color(fill, 0.45))
	draw_arc(center, radius, 0.0, TAU, 48, Color(color, 0.9), 3.0, true)
	if ratio > 0.0:
		draw_arc(center, radius - 4.0, -PI / 2.0, -PI / 2.0 + TAU * minf(ratio, 1.0), 48, color, 6.0, true)


func _label(center: Vector2, radius: float, text: String, color: Color) -> void:
	_label_queue.append([center + Vector2(0.0, radius + LABEL_DROP - 20.0), text, color])


func _draw_labels() -> void:
	var font := Art.font(700)
	for label: Array in _label_queue:
		# Line by line, each centred (0.3.11: a name line and a what-it's-for line).
		var lines: PackedStringArray = (label[1] as String).split("\n")
		for i in lines.size():
			var text := lines[i]
			var size := FONT_SIZE if i == 0 else FONT_SIZE - 2
			var width := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, size).x
			var at: Vector2 = label[0] + Vector2(-width / 2.0, i * (FONT_SIZE + 3.0))
			_labels.draw_string_outline(font, at, text, HORIZONTAL_ALIGNMENT_LEFT, -1, size, 4, Art.PAPER)
			_labels.draw_string(font, at, text, HORIZONTAL_ALIGNMENT_LEFT, -1, size, label[2])


## Seconds as a label says them: 2, 1.5.
static func _seconds(value: float) -> String:
	return str(roundi(value)) if is_equal_approx(value, roundf(value)) else str(snappedf(value, 0.1))
