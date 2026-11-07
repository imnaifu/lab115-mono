class_name Game
extends Node2D
## One run of the game. Builds the world, drives enemies and pickups every frame, and tracks
## XP, level-ups and the win/lose state. Weapons and UI reach shared state through here.

signal inventory_changed
## `lucky`: luck added a card to these (Upgrades.lucky_card).
signal level_up_offered(choices: Array, lucky: bool)
signal run_ended(victory: bool)
signal announced(text: String)
## `salary`: the 工资 this one paid, one of the rating's amounts.
signal chest_opened(funding_round: Dictionary, salary: int, item: Dictionary, boss_slot: int)
## A boss is starting one of its attacks (its form, BossKits.HINTS); the HUD explains how to dodge it.
signal boss_move(form: String)
## The player died holding a 返聘 (Progress.revives_left, `left` of them) they may spend.
signal revive_offered(left: int)

## CHEST is a boss's year-end bonus being opened (the chest dialog in Hud). REVIVE is the player
## dead, asked whether to spend a 返聘 (the revive dialog in Hud).
enum State { TITLE, PLAYING, PAUSED, LEVEL_UP, CHEST, ENDED, REVIVE }

## Nothing new comes after RUN_SECONDS (.78, the user: 10:00 后不刷怪，直到清完所有怪才结束): the run
## is won when the last enemy left goes down (a clear, timed for the leaderboard), and dying while
## clearing up is a loss. Until .77 the run was won the moment the clock reached it.
const RUN_SECONDS := 600.0
## 加班 (.78, the user: 10:00 后所有怪加一下数值; 屏幕也可以变红之类的，提升紧张度): while clearing
## up, a new tier every OVERTIME_STEP seconds (the first at RUN_SECONDS). From the first, every
## enemy walks OVERTIME_SPEED faster, OVERTIME_SPEED_STEP more each tier after, a boss walks only
## BossKits.OVERTIME_WALK_SECONDS between attacks, and all damage to the player is
## OVERTIME_DAMAGE_START times, OVERTIME_DAMAGE more each tier after (×3 at 11:00, ×4 at 12:00).
## Their speed is capped as always (the crowd at Enemy.OVERTIME_CROWD_MAX, bosses at
## BOSS_MAX_SPEED, under the slowest job's 60) until OVERTIME_UNCAP_TIER, and from there the cap
## rises OVERTIME_CAP_STEP a tier: a boss can catch the slowest job from 11:30 and a base-speed
## 66 one from 12:30, so kiting a clear out for minutes gets dangerous. (The user picked both, .78: the
## first try, ×1.0 then +15% a tier and no uncapping, killed 1 in 21 bots that reached 10:00,
## and two kited a last boss for 6 and 14 minutes, never caught, at up to ×5 damage. The user
## asked for about 15% of those reaching 10:00 to die clearing; the bots that did: ×1.2 +0.2 3%,
## ×1.5 +0.3 7%, ×2 +0.5 11%, nearly all in the first seconds, under a full floor. Bots dodge
## far better than people, so these numbers start there, to be checked on the runs' data.) No
## extra health: the board ranks speed, the pressure is on staying alive.
## The relabelled crowd (Enemy.make_ally): how often one fighting another trades blows, and how far
## it looks for one to go after.
const ALLY_FIGHT_EVERY := 0.5
const ALLY_SEEK := 400.0
const OVERTIME_STEP := 30.0
const OVERTIME_SPEED := 1.2
const OVERTIME_SPEED_STEP := 0.05
const OVERTIME_DAMAGE_START := 2.0
const OVERTIME_DAMAGE := 0.5
const OVERTIME_UNCAP_TIER := 3
const OVERTIME_CAP_STEP := 3.0
## What each new tier says (the first is the clock-out itself); past the list, the last one.
const OVERTIME_LINES := ["下班时间到！不再来新怪，清完场上的就上市", "老板还没走…怪更暴躁了", "全员加班！怪越来越暴躁", "通宵了！再不清完要出事"]
## 无尽模式 (0.1.3, the user: 十分钟后继续出怪，只不过数量上再多一些; 改成无尽模式，新加，原来的模式不动):
## picked on the 出发 page (Settings "endless"), open from the first run. The same run until
## RUN_SECONDS; from there the crowd keeps coming, more of it (Spawner.OVERTIME_SPAWN), with the
## same 加班 tiers, and the run ends only when the player goes down or clocks out. Kept apart
## from the usual mode (the user's call): never a win, so no map opened, no 敲钟 achievement and
## nothing on the clear boards; it has its own boards ranking how long a run lasted (Leaderboard)
## and its own achievements (Achievements.ENDLESS_MINUTES). Its lines for each new tier:
const ENDLESS_LINES := ["下班时间到！怪越来越多，看你能撑多久", "老板还没走…怪更多更暴躁了", "全员加班！怪越来越多", "通宵了！看你还能撑多久"]
## Logical view sizes; project.godot's viewport size is the landscape one.
const LANDSCAPE_VIEW := Vector2i(640, 360)
const PORTRAIT_VIEW := Vector2i(360, 640)
## Enemies appear this far outside the screen edge, enough to hide the biggest boss.
const SPAWN_MARGIN := 40.0
const GRID_CELL := 32.0
## Query rects are padded by this so large enemies whose centre sits in a neighbouring cell
## are still found.
const MAX_ENEMY_RADIUS := 16.0
## How hard a boss's touch knocks the player away, pixels per second at first (Player.knock_back).
const BOSS_KNOCKBACK := 320.0
## The most an enemy's hit_radius gets (a 64-tall boss with 加厚: 64 × 0.36 × 1.2), for the grid
## lookup in query_enemies.
const MAX_HIT_RADIUS := 28.0
## Enemies left this far behind are moved back in front of the player so pressure never drops.
## 460 since .97 (560 before): with a slower crowd (Spawner.ENEMY_TYPES) the ones left behind come
## round again sooner, so there's always some on the player's heels. Never nearer than where enemies
## come in (relocate_distance), or a fresh one would be moved on and on.
const RELOCATE_DISTANCE := 460.0
## How much past the far corner of where enemies come in (offscreen_point) the relocation starts.
const RELOCATE_PAST_SPAWN := 30.0
## An enemy that starts going round a building keeps to the flow field this long. "Straight is
## fine" only means some grid path runs straight there, not that the direct line is clear;
## without this, one rounding a corner flipped between the two every frame and stood still.
const DETOUR_HOLD_SECONDS := 0.6
## Pickups on the ground at most: past it a new star takes in the one farthest from the player
## (_drop_xp). 500 since .86 (the user: 星星上限 500，最远的删掉; 400 before, and then a kill's XP
## went into some star already down anywhere on the map, so late in a run stars stopped dropping
## where things died).
const MAX_PICKUPS := 500
## What a 珍珠奶茶 heals. Since .99 it comes only in the parcels on the ground (MapObjects; the
## user: 奶茶放到快递里面，boss 不用了). .48–.98 only bosses dropped one, one each (the user's call:
## 奶茶改成只有 boss 掉落，回血改成 20); until then 1.2% of regular kills did too, about 9 a run in
## the live data's median run on top of the bosses', and each healed 30.
const HEAL_AMOUNT := 20.0
## XP for the first level-ups, cheaper than the curve in xp_to_next() (5, 11, 17, 23) so a new run
## gets its first upgrades quickly; from level 5 on the curve applies.
const EARLY_LEVEL_XP := [3, 7, 13, 20]
## A magnet pulls in the stars on screen (since .48; every star on the map before, so each one
## could bank several level-ups). Until .32 any kill dropped one 0.4% of the time and every boss
## dropped one: about 13 a run, the user felt the run kept leveling up in bursts. Since then only
## regular kills from level 10 on (Vampire Survivors' Vacuum only drops from level 12): 0.2% (about
## 4-5 a run) until .48, 0.5% since (the user's call, with the pull cut down to the screen).
## .61–.71 never two of a kind within 60 seconds (the user: 磁铁也是); .72 took that out for all
## three rare drops (the user: 移出 60s 不重复掉的设计), so each kill just rolls its chance.
const MAGNET_DROP_CHANCE := 0.005
const MAGNET_FROM_LEVEL := 10
## A 午休 (.61, Vampire Survivors' Orologion) stops every enemy, bosses too and the ones that turn
## up meanwhile, for NAP_SECONDS (the user: 全场怪定住 3s，包括 boss). Stopped is Enemy.stun: no
## walking and no new attack, but touching still hurts and a boss's shapes already down still go
## off. Regular kills from level 10 on drop one, as often as a magnet (the user: 概率和磁铁一样).
const NAP_DROP_CHANCE := 0.005
const NAP_FROM_LEVEL := 10
const NAP_SECONDS := 3.0
## A 红包 (.61) pays one of these in 工资, saved at once like a year-end bonus's. Regular kills drop
## one from the start, so even a run over before its first boss earns a little.
const RED_PACKET_DROP_CHANCE := 0.005
const RED_PACKET_SALARY := [6, 8, 16, 18]
## A 加班申请 (.99, MapObjects): enemy health from then on, and 年终奖 and 红包 pay, up by these per
## form signed (FORM_HEALTH works out at −0.41 logit a form by DESIGN.md 2.8's formula).
const FORM_HEALTH := 0.1
const FORM_REWARD := 0.3
## A boss's year-end bonus (年终奖, a chest) opens on a performance rating, which decides how much
## 工资 it pays (`salary`: since .70 one amount per boss, the 2:00 / 4:00 / 6:00 / 8:00 boss in turn,
## chest_salary; .63–.69 one amount a rating; before, one of several at random), kept in the
## save for 培训 (Training), and one upgrade in the run at the rating's `rarity` (Upgrades.RARITIES:
## 绩效 C 普通 white, B 优秀 green, A 稀有 blue, S 史诗 purple; Upgrades.chest_upgrade). It gave
## 1 / 3 / 5 free upgrades until .43, none from .44 (年终奖改成给工资) and one again from .46 (the
## user: 年终奖开箱同时送一个局内升级). 绩效 S no longer gives a 返聘 (.43's prize, bought in 培训
## now). The odds are fixed since .43: neither luck nor anything about the boss moves them, and
## since .46 the game doesn't show them (the user: 概率藏起来不要可见); the site does again from .60
## (the user: 官网写上). Since .63 (the user: 年终奖调低点，最高 666; S 一档 666，C 一档 66，A、B
## 以 66 结尾; S 5%, C 10%, B 60%, A 25%) four ratings at one lucky number each, ¥206 on average;
## .60–.62 had three at 80 / 15 / 5 (¥66–288 / ¥366–588 / ¥666–888 in 66s and 88s, ¥252 on
## average), and 86 / 9 / 5 before. The ids are the data's (Telemetry `chests`) from when these were
## funding rounds (天使轮 / A 轮 / IPO), kept so runs before and after compare; 绩效 C, new in .63,
## is the round before them all (种子轮). Since .70 (the user: 四个 boss 根据顺序 C 66, 88, 166, 188，
## B 266, 288, 366, 388，A 466, 488, 566, 588，S 666) the later the boss, the more it pays, by the
## boss's place in the map's line-up (BOSSES), not the order they fall in: on these odds about
## ¥316 / 337 / 411 / 432, ¥1496 for all four (.63–.69: ¥206 each, ¥824).
const FUNDING_ROUNDS := [
	{"id": "seed", "name": "绩效 C", "salary": [66, 88, 166, 188], "rarity": 0, "weight": 10.0},
	{"id": "angel", "name": "绩效 B", "salary": [266, 288, 366, 388], "rarity": 1, "weight": 60.0},
	{"id": "series_a", "name": "绩效 A", "salary": [466, 488, 566, 588], "rarity": 2, "weight": 25.0},
	{"id": "ipo", "name": "绩效 S", "salary": [666, 666, 666, 666], "rarity": 3, "weight": 5.0},
]
## A 返聘 brings the player back on this share of their health, untouchable for REVIVE_INVULN
## seconds, with everything within REVIVE_RADIUS pushed off and stunned (like a 站会's, no damage).
const REVIVE_HP := 0.5
const REVIVE_INVULN := 2.0
const REVIVE_RADIUS := 140.0
const REVIVE_PUSH := 260.0
const REVIVE_STUN := 1.5
## Melee feel: a beat of hit-stop when a melee weapon lands on a boss (at most every
## HITSTOP_GAP), a small shake when one swing catches a crowd of SHAKE_CROWD or more.
const HITSTOP_SECONDS := 0.04
const HITSTOP_GAP := 0.3
const HITSTOP_SPEED := 0.05
const SHAKE_CROWD := 5
## A boss going down: a longer beat of hit-stop, a ring and a shake.
const BOSS_KILL_HITSTOP := 0.08
## How long after a boss goes down its year-end bonus opens by itself (.69, the user: boss 不用掉落
## 宝箱，打完 boss 自动出动画；不用捡): long enough to see it fall before the dialog covers it.
const BOSS_CHEST_DELAY := 0.6
## Hits pushing at least this hard kick up dust behind what they hit.
const DUST_PUSH := 120.0
## Every job talks trash (Jobs "lines") when its own weapon lands a hit, at most this often.
const TAUNT_GAP := 3.0

## Set by restart() so "play again" skips the title screen; static so it survives the reload.
static var skip_title := false

## True while the game is drawn turned a quarter turn to fill an upright phone.
var screen_turned := false

var state := State.TITLE
var elapsed := 0.0
var kills := 0
## How many enemies were still up at RUN_SECONDS (-1 before then), and whether the run was won
## (cleared): for the result screen, the leaderboard and the run's data.
var left_at_end := -1
var won := false
## This run is 无尽模式 (ENDLESS_LINES), as last picked on the 出发 page.
var endless := false
## The 加班 tier last announced (0 before RUN_SECONDS).
var _overtime_shown := 0
var level := 1
var xp := 0
var queued_level_ups := 0
var current_choices: Array = []
## Whether luck added a card to the level-up on screen; a 刷新 of it (reroll_upgrade) keeps it.
var _offer_lucky := false
## Total damage dealt per weapon id, for the end-of-run ranking.
var damage_by_source := {}
## When (`elapsed`) each source first dealt damage, for its damage per second (dps_of, .46).
var damage_since := {}
## Runs this device had played before this one (Settings' runs_played as the scene loaded).
var runs_before := 0
## Whether the player has moved yet this run; the HUD shows how to until they do.
var has_moved := false
## This run's id: Telemetry's `run`, and in the save the key of a 返聘 spent or earned in it.
var run_id := "%08x" % randi()
## Whether this run has spent its 返聘: one a run at most, however many are saved up.
var revived := false
## Year-end bonuses picked up while another was open, opened once it closes: each one's lowest
## rating (an index into FUNDING_ROUNDS).
var _waiting_chests: Array[int] = []
## Year-end bonuses opened this run, numbering the 工资 they pay (their ids in the save).
var _chests_opened := 0
## 工资 this run's year-end bonuses and 红包 paid (the result screen, Telemetry).
var salary_earned := 0
## 红包 picked up this run, numbering the 工资 they pay (their ids in the save).
var red_packets := 0
## 午休 picked up this run (Telemetry).
var naps := 0
## Seconds left of the 午休 under way: enemies that turn up meanwhile are stopped for the rest.
var nap_left := 0.0

var rng := RandomNumberGenerator.new()
var player: Player
var enemies: Array[Enemy] = []
var pickups: Array[Pickup] = []
var spawner: Spawner
var upgrades: Upgrades
var city: City
var flow_field: FlowField
var telemetry: Telemetry
var perks: Perks
## The job's 大招 (.81), and what it leaves out in the world: the designer's copies, the ops'
## servers.
var ultimates: Ultimates
var clones: Array[PlayerClone] = []
var turrets: Array[ServerTurret] = []
var hud: Hud
## Boss attacks in flight (HostileShot), ticked here.
var hostile_shots: Array[HostileShot] = []

var pickup_layer: Node2D
var entity_layer: Node2D
var effect_layer: Node2D
var number_layer: Node2D

var _enemy_grid := {}
var _corpses: Array[Enemy] = []
## Whether this device has been told that stars are XP (shown once, on the first drop ever).
var _star_hint_done := false
var _next_hitstop_msec := 0
## Standing still for a 技能 going off (freeze): no hit-stop may start or end meanwhile.
var _frozen := false
## Run time (`elapsed`) before which the job's weapon keeps quiet.
var _next_taunt_at := 0.0
## Where the outsourced workers stand this frame (SquadWeapon sets it): enemies near one go for it
## instead of the player.
var decoys: Array[Vector2] = []
## What this run adds to 局外成长: landmarks checked in at, achievements earned.
var stamps: Stamps
## The parcels, meeting rooms, 加班申请 forms and desks laid about the map each run (.99).
var map_objects: MapObjects
## 加班申请 signed this run (MapObjects, .99): each makes enemies spawned from then on
## FORM_HEALTH sturdier and the year-end bonuses and 红包 FORM_REWARD richer.
var signed_forms := 0
## Whether the cards on screen are a charged desk's (MapObjects) rather than a level-up's.
var desk_offer := false
var achievements: Achievements
## The run's weather while it runs (湾区地震, 狂风…; the Spawner draws and starts it).
var map_events: MapEvents


func _ready() -> void:
	_register_input_actions()
	# A hit-stop cut short by the scene reloading would leave the game in slow motion.
	Engine.time_scale = 1.0
	TestMode.check()
	Lang.setup()
	Tilt.setup()
	Cloud.setup()
	_star_hint_done = Settings.get_value("star_hint_shown", false)
	runs_before = Settings.get_value("runs_played", 0)
	endless = Settings.get_value("endless", false)
	rng.randomize()

	# The world is built from the map, so it is settled before anything else.
	Maps.use(Maps.saved())
	stamps = Stamps.new(self)
	achievements = Achievements.new(self)
	player = Player.new()
	player.game = self
	player.setup_job(Jobs.saved())
	player.died.connect(_on_player_died)
	# Mid-block, on the lawn in front of the first row of buildings rather than on a crossing.
	player.position = City.BLOCK * Vector2(0.5, 0.45)

	city = City.new()
	city.game = self
	city.follow = player
	city.seed_value = rng.randi()
	city.z_index = -10
	# Keeps streaming blocks while paused, so the title screen shows the town behind it.
	city.process_mode = Node.PROCESS_MODE_ALWAYS
	flow_field = FlowField.new(city)

	pickup_layer = _add_layer(-5)
	entity_layer = _add_layer(0)
	entity_layer.y_sort_enabled = true
	effect_layer = _add_layer(10)
	number_layer = _add_layer(20)
	map_events = MapEvents.new()
	map_events.game = self
	add_child(map_events)
	entity_layer.add_child(player)
	add_child(city)
	var boss_pointers := BossPointers.new()
	boss_pointers.game = self
	number_layer.add_child(boss_pointers)
	var stamp_rings := StampRings.new()
	stamp_rings.game = self
	add_child(stamp_rings)
	map_objects = MapObjects.new()
	map_objects.game = self
	add_child(map_objects)

	upgrades = Upgrades.new(self)
	spawner = Spawner.new(self)
	telemetry = Telemetry.new(self)
	perks = Perks.new(self)
	ultimates = Ultimates.new(self)
	player.add_weapon(Upgrades.create_weapon(Jobs.data(player.job)["weapon"]))

	hud = Hud.new()
	hud.game = self
	add_child(hud)
	inventory_changed.emit()
	apply_orientation()
	get_tree().root.size_changed.connect(apply_orientation)

	if skip_title:
		skip_title = false
		state = State.PLAYING
		_on_run_started()
	else:
		get_tree().paused = true
		Sound.music("title")
		telemetry.on_title_shown()


func _process(delta: float) -> void:
	if state != State.PLAYING:
		return
	elapsed += delta
	if elapsed >= RUN_SECONDS:
		if left_at_end < 0:
			left_at_end = hostile_count()
		var tier := overtime_tier()
		if tier > _overtime_shown:
			_overtime_shown = tier
			var lines: Array = ENDLESS_LINES if endless else OVERTIME_LINES
			var line: String = lines[mini(tier, lines.size()) - 1]
			announce(tr(line) if tier == 1 else tr("%s · 暴躁 ×%d") % [tr(line), tier])
		# The relabelled crowd (the data scientist's 大招) doesn't count: it is on the player's side.
		# 无尽模式 has no clear: it goes on until the player goes down.
		if hostile_count() == 0 and not endless:
			_end_run(true)
			return
	nap_left = maxf(0.0, nap_left - delta)
	if not has_moved and player.velocity.length_squared() > 1.0:
		has_moved = true
	# Clearing up (past RUN_SECONDS) nothing spawns: no crowd, rings, weather or bosses. In 无尽模式
	# the crowd keeps coming, faster (Spawner.overtime_spawn_at); the rest is all planned before.
	if not clearing() or endless:
		spawner.tick(delta)
	telemetry.tick(delta)
	flow_field.update(delta, player.position)
	_rebuild_grid()
	_tick_enemies(delta)
	_tick_hostile_shots(delta)
	perks.tick(delta)
	_tick_ultimate_things(delta)
	_tick_pickups(delta)
	_check_player_contact()
	stamps.tick(delta)
	map_objects.tick(delta)
	achievements.tick(delta)


func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT:
		set_paused(true)


## Half the visible world, in logical pixels (the camera has no zoom). A turned screen shows the
## world sideways, so its width and height swap.
func view_half() -> Vector2:
	var size := get_viewport().get_visible_rect().size
	if screen_turned:
		size = Vector2(size.y, size.x)
	return size / 2.0


## Phones play in portrait by default, like the genre's mobile hits (Vampire Survivors and
## Survivor.io both default to it: one thumb steers, the phone stays upright), and the layout
## simply follows how the phone is held. A phone whose player picked landscape in Settings
## draws the game turned a quarter turn while upright, so it plays sideways even with rotation
## lock on. Computers are always landscape; a window taller than wide gets that letterboxed.
## Otherwise a longer screen sees more of the world (aspect "expand").
func apply_orientation() -> void:
	var window := get_window()
	var upright := window.size.y > window.size.x
	var handheld := Device.is_handheld()
	var turned := handheld and upright and Device.prefers_landscape()
	# An upright phone uses the tall base size whether it shows the portrait layout or the turned
	# landscape one (whose layout swaps it back).
	var scale_size := PORTRAIT_VIEW if handheld and upright else LANDSCAPE_VIEW
	var aspect := Window.CONTENT_SCALE_ASPECT_KEEP if upright and not handheld else Window.CONTENT_SCALE_ASPECT_EXPAND
	if window.content_scale_size != scale_size:
		window.content_scale_size = scale_size
	if window.content_scale_aspect != aspect:
		window.content_scale_aspect = aspect
	screen_turned = turned
	player.set_screen_turned(turned)
	Tilt.set_screen_turned(turned)
	# After the content scale change has resized the visible rect.
	hud.call_deferred("fit_screen", turned)


# --- Enemies -------------------------------------------------------------------------------

func spawn_enemy(type_name: String, at: Vector2) -> Enemy:
	# The map's own crowd in place of the regular enemies (the map's MOB_SWAPS, .36): one place, so
	# waves, rings and bosses' summons all get them.
	type_name = Maps.current.MOB_SWAPS.get(type_name, type_name)
	var enemy := Enemy.new()
	enemy.setup(type_name, Spawner.ENEMY_TYPES[type_name], spawner.hp_scale())
	enemy.game = self
	enemy.position = at if enemy.ghostly else city.resolve(at, enemy.radius)
	entity_layer.add_child(enemy)
	enemies.append(enemy)
	# Turning up during a 午休 doesn't get it out of one.
	if nap_left > 0.0:
		enemy.stun(nap_left, 1.0)
	telemetry.on_enemy_spawned(enemy)
	achievements.on_spawned(type_name)
	return enemy


## A boss's bullet (RangedAttack): `how` it lands for the result screen, `turn` for a homing one
## (radians a second), `seconds` before it runs out.
func fire_bullet(at: Vector2, velocity: Vector2, damage: float, thrower: String, how := "bullet", turn := 0.0,
		seconds := HostileShot.BULLET_SECONDS) -> void:
	var shot := HostileShot.new()
	shot.setup_bullet(at, velocity, damage, thrower, how, turn, seconds)
	effect_layer.add_child(shot)
	hostile_shots.append(shot)


## Damage to the player from anything: contact, a boss's attack. `by` is the enemy type, kept
## as what last hurt them (Telemetry's killer), and `how` the way it landed: "contact", "charge"
## (a boss rushing down its lane) or the attack's form (BossKits; the result screen's cause of
## death).
func hurt_player(amount: float, by: String, how: String = "contact") -> void:
	# 测试模式's invincibility.
	if TestMode.god:
		return
	telemetry.last_hurt_by = by
	telemetry.last_hurt_how = how
	var hp_before := player.hp
	player.take_damage(amount * overtime_damage())
	if player.hp < hp_before:
		achievements.on_hurt()


## All living enemies whose body overlaps the circle. For an attack (`attack`, the default) a
## boss's body is its hit_radius, the size it is drawn; touching the player, pushing and pulling
## go by its body (`radius`).
func query_enemies(center: Vector2, radius: float, attack := true) -> Array[Enemy]:
	var found: Array[Enemy] = []
	var reach := radius + MAX_HIT_RADIUS
	var min_cell := _cell_of(center - Vector2(reach, reach))
	var max_cell := _cell_of(center + Vector2(reach, reach))
	for cell_x in range(min_cell.x, max_cell.x + 1):
		for cell_y in range(min_cell.y, max_cell.y + 1):
			var bucket = _enemy_grid.get(Vector2i(cell_x, cell_y))
			if bucket == null:
				continue
			for enemy: Enemy in bucket:
				# The relabelled crowd (the data scientist's 大招) is on the player's side: nothing of
				# theirs hits it and it hurts nobody of theirs.
				if enemy.dead or enemy.ally_left > 0.0:
					continue
				var hit_distance := radius + (enemy.hit_radius if attack else enemy.radius)
				if enemy.position.distance_squared_to(center) <= hit_distance * hit_distance:
					found.append(enemy)
	return found


func nearest_enemy(from: Vector2, max_distance: float) -> Enemy:
	var best: Enemy = null
	var best_distance_sq := max_distance * max_distance
	for enemy in enemies:
		if enemy.dead or enemy.ally_left > 0.0:
			continue
		var distance_sq := enemy.position.distance_squared_to(from)
		if distance_sq < best_distance_sq:
			best_distance_sq = distance_sq
			best = enemy
	return best


func visible_enemies() -> Array[Enemy]:
	var visible: Array[Enemy] = []
	var half := view_half()
	for enemy in enemies:
		var offset := (enemy.position - player.position).abs()
		if not enemy.dead and enemy.ally_left <= 0.0 and offset.x < half.x and offset.y < half.y:
			visible.append(enemy)
	return visible


func random_visible_enemies(count: int) -> Array[Enemy]:
	var visible := visible_enemies()
	visible.shuffle()
	return visible.slice(0, count)


## A melee weapon just hit `hits` enemies, a boss among them if `hit_boss`.
func melee_impact(hits: int, hit_boss: bool) -> void:
	if hits >= SHAKE_CROWD:
		player.shake(0.08, 1.5)
	if hit_boss:
		hitstop(HITSTOP_SECONDS)


## Nearly freezes the game for `seconds` (at most once every HITSTOP_GAP).
func hitstop(seconds: float) -> void:
	if _frozen or Time.get_ticks_msec() < _next_hitstop_msec:
		return
	_next_hitstop_msec = Time.get_ticks_msec() + roundi(HITSTOP_GAP * 1000.0)
	Engine.time_scale = HITSTOP_SPEED
	# Counted in real time: game time hardly moves meanwhile. A scene reloaded in between drops
	# the call, and _ready puts the speed back anyway.
	get_tree().create_timer(seconds, true, false, true).timeout.connect(_end_hitstop)


func _end_hitstop() -> void:
	# A hit-stop begun just before a 技能 must not let the game go on halfway through its cut-in.
	if not _frozen:
		Engine.time_scale = 1.0


## The game standing quite still for `seconds` of real time, then `then` (0.1.1: a 技能 going off,
## SkillCutIn). The wait is paused with the tree, so the pause screen opened meanwhile holds it.
func freeze(seconds: float, then: Callable) -> void:
	_frozen = true
	Engine.time_scale = 0.0
	get_tree().create_timer(seconds, false, false, true).timeout.connect(_thaw.bind(then))


func _thaw(then: Callable) -> void:
	_frozen = false
	Engine.time_scale = 1.0
	then.call()


## `silent` skips the hit sound, for damage that ticks constantly (the Wi-Fi field) and would
## otherwise patter non-stop; kills still pop.
func damage_enemy(enemy: Enemy, amount: float, push: Vector2 = Vector2.ZERO, source: String = "", silent: bool = false) -> void:
	if enemy.dead:
		return
	# A boss bracing for its second phase can't be hurt.
	if enemy.guarded():
		return
	enemy.take_hit(amount, push)
	damage_by_source[source] = damage_by_source.get(source, 0.0) + amount
	if not damage_since.has(source):
		damage_since[source] = elapsed
	Effects.damage_number(self, enemy.position, amount)
	# No spark for the constant ticks (the Wi-Fi field, the axes), which would cover the crowd.
	if not silent:
		# On the side the blow came from.
		var contact := -push.normalized() * enemy.radius * 0.6 if push != Vector2.ZERO \
			else Vector2(randf_range(-3.0, 3.0), randf_range(-3.0, 3.0))
		Effects.spark(self, enemy.position + contact, amount >= Effects.BIG_HIT)
	if push.length() >= DUST_PUSH and enemy.knockback_resist < 0.9:
		Effects.dust(self, enemy.position, push)
	if source == Jobs.data(player.job)["weapon"]:
		_taunt()
	if enemy.hp <= 0.0:
		_kill(enemy)
	elif not silent:
		Sound.play("hit")


## A line of the job's trash talk over the player (TAUNT_GAP apart at most).
func _taunt() -> void:
	if elapsed < _next_taunt_at:
		return
	_next_taunt_at = elapsed + TAUNT_GAP
	var lines: Array = Jobs.data(player.job)["lines"]
	Effects.callout(self, player.position + Vector2(0.0, -10.0), tr(lines[randi() % lines.size()]), Art.PAPER)


## A point just outside the visible screen in the given direction from the player, or, if
## that is water, the first of the opposite and the two sideways directions that is land:
## nothing walks out of the sea.
## How far behind an enemy is moved round again: RELOCATE_DISTANCE, or past the corners of where
## enemies come in on a wide screen.
func relocate_distance() -> float:
	return maxf(RELOCATE_DISTANCE, (view_half() + Vector2(SPAWN_MARGIN, SPAWN_MARGIN)).length() + RELOCATE_PAST_SPAWN)


func offscreen_point(direction: Vector2) -> Vector2:
	var half := view_half() + Vector2(SPAWN_MARGIN, SPAWN_MARGIN)
	var first_try := Vector2.ZERO
	for heading in [direction, -direction, direction.orthogonal(), -direction.orthogonal()]:
		var scale_x := half.x / absf(heading.x) if absf(heading.x) > 0.001 else INF
		var scale_y := half.y / absf(heading.y) if absf(heading.y) > 0.001 else INF
		var point: Vector2 = player.position + heading * minf(scale_x, scale_y)
		if not city.is_water(point):
			return point
		if first_try == Vector2.ZERO:
			first_try = point
	return first_try


## Random spawn direction, biased toward where the player is walking so they run into enemies
## instead of outpacing them.
func random_direction() -> Vector2:
	if player.velocity.length_squared() > 1.0 and rng.randf() < 0.4:
		return Vector2.from_angle(player.velocity.angle() + rng.randf_range(-0.8, 0.8))
	return Vector2.from_angle(rng.randf() * TAU)


## The map's event coming on (the Spawner, at the map's MAP_EVENT time): it runs, and says so.
func start_map_event(event: Dictionary) -> void:
	map_events.start(event["id"], event["seconds"])


func announce(text: String) -> void:
	announced.emit(text)


func _kill(enemy: Enemy) -> void:
	enemy.dead = true
	kills += 1
	ultimates.on_killed(enemy)
	achievements.on_killed(enemy.type_name)
	enemies.erase(enemy)
	telemetry.on_enemy_killed(enemy)
	if enemy.is_elite:
		Sound.boss_down()
	else:
		Sound.play("kill")
	Effects.poof(self, enemy.position, enemy.color)
	Effects.death_pop(self, enemy.body_sprite(), enemy.position, enemy.is_elite)
	if enemy.is_elite:
		achievements.on_boss_killed(enemy.type_name)
		# Its last word, and whatever it left on the ground goes with it.
		var last_word: String = BossKits.KITS[enemy.type_name]["lines"].get("death", "") if BossKits.has(enemy.type_name) else ""
		if last_word != "":
			Effects.callout(self, enemy.position + Vector2(0.0, -20.0), tr(last_word), Art.PAPER, 13)
		enemy.release()
		Effects.ring(self, enemy.position, enemy.radius * 4.0, enemy.color)
		player.shake(0.25, 3.0)
		hitstop(BOSS_KILL_HITSTOP)
	var star: Pickup = null
	if enemy.xp_value > 0:
		star = _drop_xp(enemy.position, enemy.xp_value)
	perks.on_kill(enemy)
	if not _star_hint_done and star != null:
		_star_hint_done = true
		Settings.set_value("star_hint_shown", true)
		announce("捡星星升级！走近就会自动吸过来")
		# The live data had a first-time player stay at level 1 for 30 seconds: a toast at the top
		# wasn't enough to send them to the star.
		star.point_at()
	if enemy.is_elite:
		# No chest on the ground since .69: the year-end bonus opens by itself a beat later. A
		# pausable timer, so a level-up, the pause screen or 返聘 holding the game holds it too;
		# if the run ends first (the tree stays paused) it never opens.
		# Which of the map's bosses it was decides the 工资 (.70); a boss from outside the line-up
		# (测试模式, --boss) pays as the first.
		# Its slot, not its place in the map's BOSSES: since .99 any map's boss can come at a slot.
		var boss_slot := maxi(BossKits.slot_of(enemy.type_name), 0)
		get_tree().create_timer(BOSS_CHEST_DELAY, false).timeout.connect(_open_chest.bind(boss_slot))
		# No 珍珠奶茶 from a boss since .99 (the user: 奶茶放到快递里面，boss 不用了): it comes in the
		# parcels on the ground (MapObjects) instead; .48–.98 every boss dropped one.
	# Regular kills drop no 珍珠奶茶 since .48, only now and then a magnet, a 午休 or a 红包.
	else:
		if _rare_drop_due(MAGNET_DROP_CHANCE, MAGNET_FROM_LEVEL):
			_drop(Pickup.Kind.MAGNET, enemy.position + Vector2(6, 0), 1)
		if _rare_drop_due(NAP_DROP_CHANCE, NAP_FROM_LEVEL):
			_drop(Pickup.Kind.NAP, enemy.position + Vector2(-6, 0), 1)
		if _rare_drop_due(RED_PACKET_DROP_CHANCE, 1):
			_drop(Pickup.Kind.RED_PACKET, enemy.position + Vector2(0, 6), RED_PACKET_SALARY[rng.randi() % RED_PACKET_SALARY.size()])
	# Freed only once the grid no longer references it (next rebuild); until then queries skip
	# it via `dead`. Freeing now would leave a dangling entry for anything that queries before
	# the next rebuild.
	enemy.visible = false
	_corpses.append(enemy)


func _rebuild_grid() -> void:
	for corpse in _corpses:
		corpse.queue_free()
	_corpses.clear()
	_enemy_grid.clear()
	for enemy in enemies:
		var cell := _cell_of(enemy.position)
		if _enemy_grid.has(cell):
			_enemy_grid[cell].append(enemy)
		else:
			_enemy_grid[cell] = [enemy]


func _tick_enemies(delta: float) -> void:
	var target := player.position
	var relocate := relocate_distance()
	var relocate_sq := relocate * relocate
	for enemy in enemies:
		var separation := Vector2.ZERO if enemy.ghostly else _separation(enemy)
		# Ghosts drift through walls; everyone else takes the way round when one is in the way.
		var around := Vector2.ZERO
		if not enemy.ghostly:
			around = flow_field.heading(enemy.position)
			if around != Vector2.ZERO:
				enemy.detour_left = DETOUR_HOLD_SECONDS
			elif enemy.detour_left > 0.0:
				enemy.detour_left -= delta
				around = flow_field.heading(enemy.position, true)
		var heading := around if around != Vector2.ZERO else (target - enemy.position).normalized()
		if enemy.ally_left > 0.0:
			var foe := nearest_enemy(enemy.position, ALLY_SEEK)
			heading = ((foe.position if foe != null else target) - enemy.position).normalized()
		# A decoy close by draws it off the player (they stand right by the player, so no walls to
		# go round in between).
		var lure: Variant = _lure_for(enemy)
		if lure != null:
			heading = ((lure as Vector2) - enemy.position).normalized()
		enemy.tick(delta, heading, separation)
		if not enemy.ghostly:
			_keep_out_of_walls(enemy, target if lure == null else lure as Vector2, delta, around == Vector2.ZERO or lure != null)
		if enemy.position.distance_squared_to(target) > relocate_sq:
			var fresh_spot := offscreen_point(random_direction())
			enemy.position = fresh_spot if enemy.ghostly else city.resolve(fresh_spot, enemy.radius)


## The closest decoy within SquadWeapon.LURE_RADIUS of the enemy, or null; bosses ignore them.
func _lure_for(enemy: Enemy) -> Variant:
	if decoys.is_empty() or enemy.is_elite:
		return null
	var best: Variant = null
	var best_distance := SquadWeapon.LURE_RADIUS * SquadWeapon.LURE_RADIUS
	for decoy in decoys:
		var distance := decoy.distance_squared_to(enemy.position)
		if distance < best_distance:
			best_distance = distance
			best = decoy
	return best


## Pushes an enemy out of buildings and the water. One walking straight that presses against a
## wall (a trunk, a building's corner) also slides along it toward the player's side; one
## already taking the flow field's way round needs no slide, which would only fight it.
func _keep_out_of_walls(enemy: Enemy, target: Vector2, delta: float, slide: bool) -> void:
	var resolved := city.resolve(enemy.position, enemy.radius)
	var push := resolved - enemy.position
	if slide and push.length_squared() > 0.0001:
		var along := push.orthogonal().normalized()
		if along.dot(target - resolved) < 0.0:
			along = -along
		resolved = city.resolve(resolved + along * enemy.speed * delta * 0.8, enemy.radius)
	enemy.position = resolved


## Position correction that pushes overlapping enemies apart, so crowds spread into a blob
## instead of stacking on one pixel. A boss shoulders through the crowd (.76, the user: 这样能更好的
## 打到 boss): the crowd still makes way for it, but only another boss pushes it back, so it is no
## longer held behind a wall of small fry.
func _separation(enemy: Enemy) -> Vector2:
	var push := Vector2.ZERO
	var cell := _cell_of(enemy.position)
	for cell_x in range(cell.x - 1, cell.x + 2):
		for cell_y in range(cell.y - 1, cell.y + 2):
			var bucket = _enemy_grid.get(Vector2i(cell_x, cell_y))
			if bucket == null:
				continue
			for other: Enemy in bucket:
				if other == enemy or other.ghostly:
					continue
				if enemy.is_elite and not other.is_elite:
					continue
				var offset := enemy.position - other.position
				var min_distance := enemy.radius + other.radius
				var distance_sq := offset.length_squared()
				if distance_sq < min_distance * min_distance and distance_sq > 0.0001:
					var distance := sqrt(distance_sq)
					push += offset / distance * (min_distance - distance)
	return push


func _tick_hostile_shots(delta: float) -> void:
	for i in range(hostile_shots.size() - 1, -1, -1):
		var shot := hostile_shots[i]
		shot.tick(delta, self)
		if shot.done:
			shot.queue_free()
			hostile_shots.remove_at(i)


func _check_player_contact() -> void:
	var strongest: Enemy = null
	var nearest_boss: Enemy = null
	for enemy in query_enemies(player.position, Player.HURT_RADIUS, false):
		# A leaping boss is up in the air (MeleeAttack): it only lands.
		if enemy.lift > 0.0:
			continue
		if strongest == null or enemy.damage > strongest.damage:
			strongest = enemy
		if enemy.is_elite and (nearest_boss == null or enemy.position.distance_squared_to(player.position) < nearest_boss.position.distance_squared_to(player.position)):
			nearest_boss = enemy
	if strongest == null:
		return
	var hp_before := player.hp
	hurt_player(strongest.damage, strongest.type_name, "charge" if strongest.is_charging() else "contact")
	# A hit that landed with a boss touching knocks the player off it (about BOSS_KNOCKBACK / 8
	# pixels, Player.SHOVE_DECAY), clear of its body, which near the player walks slower than they do.
	if nearest_boss != null and player.hp < hp_before:
		var away := player.position - nearest_boss.position
		player.knock_back((away.normalized() if away.length_squared() > 0.01 else -player.facing) * BOSS_KNOCKBACK)


func _cell_of(point: Vector2) -> Vector2i:
	return Vector2i(floori(point.x / GRID_CELL), floori(point.y / GRID_CELL))


# --- Pickups & XP --------------------------------------------------------------------------

## The new star where the enemy died. With MAX_PICKUPS already down, the star farthest from the
## player goes and its XP comes into the new one: nothing is lost, the ones near keep coming.
func _drop_xp(at: Vector2, value: int) -> Pickup:
	if pickups.size() >= MAX_PICKUPS:
		var farthest: Pickup = null
		var farthest_sq := -1.0
		for pickup in pickups:
			if pickup.kind != Pickup.Kind.XP:
				continue
			var distance_sq := pickup.position.distance_squared_to(player.position)
			if distance_sq > farthest_sq:
				farthest_sq = distance_sq
				farthest = pickup
		if farthest != null:
			value += farthest.value
			pickups.erase(farthest)
			farthest.queue_free()
	return _drop(Pickup.Kind.XP, at, value)


## Whether a regular kill drops a rare pickup: its `chance`, from `from_level` on (no gap between
## two of a kind since .72).
func _rare_drop_due(chance: float, from_level: int) -> bool:
	return level >= from_level and rng.randf() < chance


func _drop(kind: Pickup.Kind, at: Vector2, value: int) -> Pickup:
	var pickup := Pickup.new()
	pickup.setup(kind, value)
	pickup.position = at + Vector2(rng.randf_range(-3, 3), rng.randf_range(-3, 3))
	pickup_layer.add_child(pickup)
	pickups.append(pickup)
	return pickup


func _tick_pickups(delta: float) -> void:
	for i in range(pickups.size() - 1, -1, -1):
		var pickup := pickups[i]
		if pickup.tick(delta, player):
			pickups.remove_at(i)
			_collect(pickup)
			pickup.queue_free()


func _collect(pickup: Pickup) -> void:
	match pickup.kind:
		Pickup.Kind.XP:
			Sound.xp()
			add_xp(pickup.value)
		Pickup.Kind.HEAL:
			Sound.play("heal")
			player.heal(HEAL_AMOUNT)
			announce(tr("珍珠奶茶，回血 %d！") % roundi(HEAL_AMOUNT))
		Pickup.Kind.BONUS:
			_open_chest(pickup.value)
		Pickup.Kind.MAGNET:
			Sound.play("magnet")
			# Only the stars on screen (.48, the user: 不是全图，而是全屏幕): the view is centred on
			# the player.
			var half := view_half()
			for other in pickups:
				var offset := (other.position - player.position).abs()
				if other.kind == Pickup.Kind.XP and offset.x <= half.x and offset.y <= half.y:
					other.attract()
			announce("磁铁！屏幕里的星星都飞过来了")
		Pickup.Kind.NAP:
			_take_nap()
		Pickup.Kind.RED_PACKET:
			Sound.play("payout")
			red_packets += 1
			# More for each 加班申请 signed (.99).
			var paid := roundi(pickup.value * reward_scale())
			Progress.add_salary("%s-rp-%d" % [run_id, red_packets], paid)
			salary_earned += paid
			Effects.callout(self, player.position + Vector2(0.0, -22.0), "+¥%d" % paid, Art.RED, 13)
			announce(tr("红包！工资 +¥%d") % paid)


## A 午休 (NAP_SECONDS): every enemy on the map stops where it is, bosses for the whole time too,
## and the ones that turn up before it's over (spawn_enemy).
func _take_nap() -> void:
	naps += 1
	nap_left = NAP_SECONDS
	for enemy in enemies:
		enemy.stun(NAP_SECONDS, 1.0)
		if enemy.is_elite:
			# Off to the upper right: straight above are its speech bubble and health bar.
			Effects.callout(self, enemy.position + Vector2(enemy.radius + 8.0, -enemy.radius), "Zzz", Art.BLUE, 13)
	Sound.play("standup")
	Effects.ring(self, player.position, view_half().length(), Art.BLUE)
	announce(tr("午休！所有怪定住 %d 秒") % roundi(NAP_SECONDS))


## A source's damage per second while the player had it (.46, the result's 伤害排行): its total
## over the time since it first dealt damage, so a weapon taken late isn't measured against the
## minutes before it came (at least a second, so one early hit doesn't read as a huge number).
func dps_of(source: String) -> float:
	return damage_by_source.get(source, 0.0) / maxf(elapsed - damage_since.get(source, 0.0), 1.0)


## Steeper from level 10 since .33 (was + max(0, level - 20) * 4): the user found the level-ups
## too frequent. Bots that pick up every star now reach about 39 by 10:00 instead of 49, and have
## every weapon and passive maxed at 9:00-9:40, some never (before, 7:30-8:30).
func xp_to_next() -> int:
	return xp_needed(level)


## XP from `at_level` to the next, as xp_to_next() (static so the 官网 can list the curve).
static func xp_needed(at_level: int) -> int:
	if at_level <= EARLY_LEVEL_XP.size():
		return EARLY_LEVEL_XP[at_level - 1]
	return 5 + (at_level - 1) * 6 + maxi(0, at_level - 10) * 10


func add_xp(amount: int) -> void:
	xp += amount
	while xp >= xp_to_next():
		xp -= xp_to_next()
		level += 1
		queued_level_ups += 1
	_offer_level_up()


func _offer_level_up() -> void:
	if state != State.PLAYING or queued_level_ups <= 0:
		return
	_offer_lucky = upgrades.lucky_card()
	# The level this offer is for: `level` has already counted every banked level-up.
	current_choices = upgrades.roll_choices(upgrades.choice_count(_offer_lucky), level - queued_level_ups + 1)
	# Only a card that really came out counts (a near-empty pool may not fill the extra slot).
	_offer_lucky = _offer_lucky and current_choices.size() > upgrades.choice_count()
	telemetry.on_offer(current_choices)
	if _offer_lucky:
		telemetry.on_lucky_card()
	state = State.LEVEL_UP
	get_tree().paused = true
	Sound.play("level_up")
	level_up_offered.emit(current_choices, _offer_lucky)


## Whether the level-up on screen can be redrawn (刷新, .96): a 刷新 left this run, and something to
## redraw (only 摸鱼一会儿 is left once everything is maxed, and it would come back the same).
func can_reroll() -> bool:
	# A desk's cards aren't a level-up's to redraw (like a year-end bonus's upgrade).
	if state != State.LEVEL_UP or player.rerolls <= 0 or desk_offer:
		return false
	return current_choices.any(func(choice: Dictionary) -> bool: return choice["kind"] != "heal")


## 刷新 (.96, the user: 新加刷新的能力，每局默认一次): spends one of the run's Player.rerolls and
## redraws the level-up on screen, as many cards as before (luck's extra one stays), the job's
## pair kept when it was due (Upgrades.roll_choices with `reroll`). Rarities are rolled again too.
func reroll_upgrade() -> void:
	if not can_reroll():
		return
	player.rerolls -= 1
	telemetry.on_reroll()
	var count := upgrades.choice_count(_offer_lucky)
	current_choices = upgrades.roll_choices(count, level - queued_level_ups + 1, true)
	_offer_lucky = _offer_lucky and current_choices.size() > upgrades.choice_count()
	telemetry.on_offer(current_choices)
	Sound.play("level_up")
	level_up_offered.emit(current_choices, _offer_lucky)


func choose_upgrade(index: int) -> void:
	if state != State.LEVEL_UP or index < 0 or index >= current_choices.size():
		return
	if desk_offer:
		_take_desk(current_choices[index])
		return
	upgrades.apply(current_choices[index])
	telemetry.on_pick(current_choices[index])
	queued_level_ups -= 1
	Sound.play("pick")
	state = State.PLAYING
	get_tree().paused = false
	inventory_changed.emit()
	# Several level-ups can be banked at once (big gems, chests); offer them back to back.
	_offer_level_up()


# --- Things on the map (MapObjects, .99) -------------------------------------------------

## What the 年终奖 and 红包 pay this run: up FORM_REWARD for each 加班申请 signed.
func reward_scale() -> float:
	return 1.0 + FORM_REWARD * signed_forms


## Enemy health from now on: up FORM_HEALTH for each 加班申请 signed (Spawner.hp_scale).
func form_health_scale() -> float:
	return 1.0 + FORM_HEALTH * signed_forms


## A 加班申请 signed (MapObjects): harder and better paid from now on, and said so.
func sign_form() -> void:
	signed_forms += 1
	Sound.play("alarm")
	announce(tr("加班申请 ×%d：怪 +%d%% 血，年终奖和红包 +%d%%") % [signed_forms,
		roundi(FORM_HEALTH * signed_forms * 100.0), roundi(FORM_REWARD * signed_forms * 100.0)])
	inventory_changed.emit()


## A charged desk (MapObjects): its cards on the level-up panel, the game held meanwhile. Waits
## for a free moment when a level-up, chest or anything else is on screen.
func offer_desk(golden: bool) -> void:
	if state != State.PLAYING:
		map_objects.desk_waiting.append(golden)
		return
	desk_offer = true
	current_choices = upgrades.desk_choices(golden)
	state = State.LEVEL_UP
	get_tree().paused = true
	Sound.play("level_up")
	level_up_offered.emit(current_choices, false)


## The desk card picked: added to the player; then whatever level-ups were banked meanwhile.
func _take_desk(choice: Dictionary) -> void:
	upgrades.apply(choice)
	telemetry.on_desk(choice)
	desk_offer = false
	Sound.play("pick")
	state = State.PLAYING
	get_tree().paused = false
	inventory_changed.emit()
	_offer_level_up()


## A meeting room cleared in time (MapObjects): a year-end bonus at the first boss's pay.
func open_meeting_bonus() -> void:
	_open_chest(0)


## A pickup put down by something on the map (a parcel's contents, MapObjects).
func drop(kind: Pickup.Kind, at: Vector2, value: int) -> Pickup:
	return _drop_xp(at, value) if kind == Pickup.Kind.XP else _drop(kind, at, value)


# --- Year-end bonuses (boss chests) ------------------------------------------------------

## Rolls the rating and pays its 工资 for the `boss_slot`th boss (chest_salary), saves that straight away (closing the page mid-run keeps it, as a stamp), applies its
## upgrade and pauses while the HUD opens the chest. A second one due meanwhile (two bosses down
## together, or one falling as a level-up is offered) waits its turn. Opened BOSS_CHEST_DELAY after
## a boss's kill since .69; until then the boss dropped it as a pickup (Pickup.Kind.BONUS, kept
## but no longer dropped, whose `value` comes here as the slot) and it opened when picked up.
func _open_chest(boss_slot: int = 0) -> void:
	if state != State.PLAYING:
		_waiting_chests.append(boss_slot)
		return
	var funding_round: Dictionary = FUNDING_ROUNDS[_roll_rating()]
	_chests_opened += 1
	var chest_id := "%s-%d" % [run_id, _chests_opened]
	# More for each 加班申请 signed (.99).
	var salary := roundi(chest_salary(funding_round, boss_slot) * reward_scale())
	Progress.add_salary(chest_id, salary)
	salary_earned += salary
	var item := upgrades.chest_upgrade(funding_round["rarity"])
	# What it changes, worked out before it's applied: afterwards the numbers would be the next step's.
	item["numbers"] = upgrades.numbers(item)
	upgrades.apply(item)
	telemetry.on_chest(funding_round["id"], item)
	state = State.CHEST
	get_tree().paused = true
	inventory_changed.emit()
	chest_opened.emit(funding_round, salary, item, boss_slot)


## What a rating (a FUNDING_ROUNDS entry) pays for the `boss_slot`th boss of the map (0 = 2:00's).
static func chest_salary(funding_round: Dictionary, boss_slot: int) -> int:
	var amounts: Array = funding_round["salary"]
	return amounts[clampi(boss_slot, 0, amounts.size() - 1)]


## A year-end bonus's rating, an index into FUNDING_ROUNDS: by their weights, at least `lowest_round`.
func _roll_rating(lowest_round: int = 0) -> int:
	var weights := PackedFloat32Array()
	for option: Dictionary in FUNDING_ROUNDS:
		weights.append(option["weight"])
	return maxi(rng.rand_weighted(weights), lowest_round)


## The HUD's "take it" button (and the smoke-test bot).
func close_chest() -> void:
	if state != State.CHEST:
		return
	state = State.PLAYING
	get_tree().paused = false
	if not _waiting_chests.is_empty():
		_open_chest(_waiting_chests.pop_front())
		return
	# Level-ups earned while the chest was open (its stars, a kill landing as it opened).
	_offer_level_up()


# --- Run state -----------------------------------------------------------------------------

## Picks the job on the title screen: remembered for next time, and the player rebuilt as it
## (build, look, starting weapon).
func set_job(job_id: String) -> void:
	if state != State.TITLE or job_id == player.job:
		return
	Settings.set_value("job", job_id)
	for weapon in player.weapons:
		weapon.queue_free()
	player.weapons.clear()
	player.setup_job(job_id)
	player.add_weapon(Upgrades.create_weapon(Jobs.data(job_id)["weapon"]))
	inventory_changed.emit()


## The 出发 page's 普通 / 无尽 switch: remembered for next time; nothing else changes before the run.
func set_endless(on: bool) -> void:
	if state != State.TITLE:
		return
	endless = on
	Settings.set_value("endless", on)


## The title screen's map picker: the city is built from the map, so the scene starts over on it
## (behind the title, which stays up).
## Switches to the map `map_id` (the scene is rebuilt for it); `start` goes straight into a run
## there, as the world map's 出发 does, instead of back to the title screen.
func change_map(map_id: String, start: bool = false) -> void:
	Settings.set_value("map", map_id)
	skip_title = start
	get_tree().paused = false
	get_tree().reload_current_scene()


## The result screen's 回主页 (换职业 until .46) and the pause screen's 下班: back to the title screen (to pick another
## job or map), a run still going counted as given up.
func change_job() -> void:
	_record_given_up()
	achievements.finish(false)
	telemetry.finish("restart")
	skip_title = false
	get_tree().paused = false
	get_tree().reload_current_scene()


## A run left from the pause screen (重新开始, 下班) goes into 战绩 as 下班; one that already ended
## was recorded then, and the title screen has no run to record.
func _record_given_up() -> void:
	if state == State.PLAYING or state == State.PAUSED:
		RunHistory.record(self, "quit")
		# On its board too once it lasted a minute (.96, the user: 下班也算), sent now since no result
		# screen follows; not awaited: it finishes on the Cloud node, which outlives the scene.
		if Leaderboard.record_run(self, false) and Leaderboard.online() and Leaderboard.has_name():
			Leaderboard.submit()


## Leaves the title screen.
func start_run() -> void:
	if state != State.TITLE:
		return
	state = State.PLAYING
	get_tree().paused = false
	_on_run_started()


## Zeroes the tilt to how the phone is held right now, and says so: without the hint, the first
## tilt player wonders why holding the phone at an angle doesn't send them running.
func _on_run_started() -> void:
	# Every landmark checked in at and every rank trained in earlier runs: after the job's own
	# build, before the run's data notes the player's numbers.
	Stamps.apply_all(player)
	Training.apply(player)
	# A test run (TestMode) isn't reported: it would skew the live numbers.
	if not TestMode.on:
		telemetry.start()
	elif TestMode.start_minute > 0:
		_fast_forward(TestMode.start_minute)
	Sound.music("battle")
	Tilt.calibrate()
	if Tilt.enabled():
		announce("倾斜手机就能移动，前后以现在的角度为准")


## 测试模式: the run as if played up to `minute`: the clock there, the bosses before it skipped,
## and the level a player who picks up every star would have, each level-up a random card, plus
## the skipped bosses' year-end bonus upgrades (none from .44 to .45; their 工资 isn't paid).
func _fast_forward(minute: int) -> void:
	elapsed = minute * 60.0
	var bosses := spawner.skip_to(elapsed)
	var picks := TestMode.level_at(minute) - 1
	for i in picks:
		if level < TestMode.level_at(minute):
			level += 1
		var choices := upgrades.roll_choices(upgrades.choice_count(), level)
		if not choices.is_empty():
			upgrades.apply(choices[rng.randi() % choices.size()])
	for i in bosses:
		upgrades.apply(upgrades.chest_upgrade(FUNDING_ROUNDS[_roll_rating()]["rarity"]))
	xp = 0
	player.hp = player.max_hp
	inventory_changed.emit()
	announce(tr("测试模式：从 %d:00 开始，职级已升到 %s") % [minute, Maps.rank_of(level)])


## 测试模式 (the pause screen's buttons): the run's weather now.
func test_weather() -> void:
	var map_event: Dictionary = spawner.weather
	start_map_event(map_event)
	announce(map_event["text"])


## 测试模式: straight to the next level-up.
func test_level_up() -> void:
	add_xp(xp_to_next() - xp)


func set_paused(value: bool) -> void:
	if value and state == State.PLAYING:
		state = State.PAUSED
		get_tree().paused = true
	elif not value and state == State.PAUSED:
		state = State.PLAYING
		get_tree().paused = false
		# The phone may be held differently after a break; re-zero the tilt.
		Tilt.calibrate()


func restart() -> void:
	# A run given up from the pause screen; after a death or a win it was already sent.
	_record_given_up()
	achievements.finish(false)
	telemetry.finish("restart")
	skip_title = true
	get_tree().paused = false
	get_tree().reload_current_scene()


## With a 返聘 saved and none spent this run, the player chooses (the HUD's revive dialog, paused);
## otherwise the run is over.
func _on_player_died() -> void:
	if state == State.PLAYING and not revived and Progress.revives_left() > 0:
		state = State.REVIVE
		get_tree().paused = true
		revive_offered.emit(Progress.revives_left())
		return
	_end_run(false)


## The revive dialog's 返聘: one spent from the save, the player back on REVIVE_HP of their health
## with room round them, and the run goes on.
func accept_revive() -> void:
	if state != State.REVIVE:
		return
	revived = true
	Progress.use_revive(run_id)
	telemetry.on_revive(true)
	player.revive(player.max_hp * REVIVE_HP, REVIVE_INVULN)
	Effects.ring(self, player.position, REVIVE_RADIUS, Art.GREEN)
	for enemy in query_enemies(player.position, REVIVE_RADIUS, false):
		enemy.stun(REVIVE_STUN)
		# A pushing hit for nothing: not damage_enemy, which would count it and float a 0.
		enemy.take_hit(0.0, (enemy.position - player.position).normalized() * REVIVE_PUSH)
	state = State.PLAYING
	get_tree().paused = false
	Sound.play("heal")
	announce("返聘成功，回来上班！")


## The revive dialog's 下班: the 返聘 stays saved for another run, this one is over.
func decline_revive() -> void:
	if state != State.REVIVE:
		return
	telemetry.on_revive(false)
	state = State.PLAYING
	_end_run(false)


## The enemies still against the player (the relabelled ones are on their side).
func hostile_count() -> int:
	var count := 0
	for enemy in enemies:
		if enemy.ally_left <= 0.0:
			count += 1
	return count


## The 大招's leftovers, every frame of play: the servers fire, a copy is hurt by what touches it
## like the player, and the relabelled crowd turns on the rest (Enemy.make_ally): each one walks at
## the nearest of the others, and touching one, each hurts the other by its own contact damage
## every ALLY_FIGHT_EVERY; one whose health or time runs out is gone, no kill and no star.
func _tick_ultimate_things(delta: float) -> void:
	for i in range(turrets.size() - 1, -1, -1):
		if not turrets[i].tick(delta):
			turrets.remove_at(i)
	for i in range(clones.size() - 1, -1, -1):
		if not is_instance_valid(clones[i]) or clones[i].is_queued_for_deletion():
			clones.remove_at(i)
			continue
		var clone := clones[i]
		var strongest: Enemy = null
		for enemy in query_enemies(clone.position, Player.HURT_RADIUS, false):
			if enemy.lift <= 0.0 and (strongest == null or enemy.damage > strongest.damage):
				strongest = enemy
		if strongest != null:
			clone.take_damage(strongest.damage * overtime_damage())
	for enemy in enemies.duplicate():
		if enemy.ally_left <= 0.0:
			continue
		enemy.ally_left -= delta
		enemy.ally_fight_left -= delta
		if enemy.ally_left <= 0.0 or enemy.hp <= 0.0:
			_dismiss_ally(enemy)
			continue
		if enemy.ally_fight_left > 0.0:
			continue
		var foes := query_enemies(enemy.position, enemy.radius + 4.0, false)
		if foes.is_empty():
			continue
		enemy.ally_fight_left = ALLY_FIGHT_EVERY
		var foe := foes[0]
		damage_enemy(foe, enemy.damage, (foe.position - enemy.position).normalized() * 40.0, Ultimates.SOURCE, true)
		enemy.take_hit(foe.damage, (enemy.position - foe.position).normalized() * 40.0)
		if enemy.hp <= 0.0:
			_dismiss_ally(enemy)


func _dismiss_ally(enemy: Enemy) -> void:
	enemy.dead = true
	enemy.ally_left = 0.0
	enemies.erase(enemy)
	Effects.poof(self, enemy.position, Enemy.ALLY_TINT)
	# Freed at the next grid rebuild, as a kill is (_kill): the grid may still list it till then.
	enemy.visible = false
	_corpses.append(enemy)


## Past RUN_SECONDS: nothing new comes, the enemies still up are what is left to clear (in 无尽模式
## the crowd keeps coming; the 加班 tiers are the same).
func clearing() -> bool:
	return elapsed >= RUN_SECONDS


## The 加班 tier: 0 before RUN_SECONDS, then 1, 2, 3… every OVERTIME_STEP seconds.
func overtime_tier() -> int:
	if elapsed < RUN_SECONDS:
		return 0
	return 1 + floori((elapsed - RUN_SECONDS) / OVERTIME_STEP)


## How much faster the enemies walk in this tier (1 before RUN_SECONDS).
func overtime_speed() -> float:
	var tier := overtime_tier()
	return 1.0 if tier == 0 else OVERTIME_SPEED + OVERTIME_SPEED_STEP * (tier - 1)


## How much more every hit on the player does in this tier (1 before RUN_SECONDS).
func overtime_damage() -> float:
	var tier := overtime_tier()
	return 1.0 if tier == 0 else OVERTIME_DAMAGE_START + OVERTIME_DAMAGE * (tier - 1)


## How far over its usual cap (Enemy.OVERTIME_CROWD_MAX, Enemy.BOSS_MAX_SPEED) an enemy may walk
## in this tier: nothing until OVERTIME_UNCAP_TIER.
func overtime_cap_raise() -> float:
	return OVERTIME_CAP_STEP * maxi(overtime_tier() - OVERTIME_UNCAP_TIER + 1, 0)


func _end_run(victory: bool) -> void:
	if state == State.ENDED:
		return
	state = State.ENDED
	won = victory
	# A clear, or from .96 a run that lasted a minute, goes on its map's board (Leaderboard; the
	# result screen sends it, and asks for a 昵称 first when there is none).
	Leaderboard.record_run(self, victory)
	get_tree().paused = true
	# Before the run's data goes out and the result screen is built: both list what it earned.
	achievements.finish(victory)
	telemetry.finish("win" if victory else "died")
	RunHistory.record(self, "win" if victory else "died")
	Sound.stop_music()
	Sound.play("win" if victory else "lose")
	run_ended.emit(victory)


func _add_layer(z: int) -> Node2D:
	var layer := Node2D.new()
	layer.z_index = z
	add_child(layer)
	return layer


static func _register_input_actions() -> void:
	var bindings := {
		"move_left": [KEY_A, KEY_LEFT],
		"move_right": [KEY_D, KEY_RIGHT],
		"move_up": [KEY_W, KEY_UP],
		"move_down": [KEY_S, KEY_DOWN],
	}
	var stick := {
		"move_left": [JOY_AXIS_LEFT_X, -1.0],
		"move_right": [JOY_AXIS_LEFT_X, 1.0],
		"move_up": [JOY_AXIS_LEFT_Y, -1.0],
		"move_down": [JOY_AXIS_LEFT_Y, 1.0],
	}
	for action: String in bindings:
		if InputMap.has_action(action):
			continue
		InputMap.add_action(action, 0.2)
		for keycode: Key in bindings[action]:
			var key_event := InputEventKey.new()
			# Physical keys so WASD stays in the same place on non-QWERTY layouts.
			key_event.physical_keycode = keycode
			InputMap.action_add_event(action, key_event)
		var motion := InputEventJoypadMotion.new()
		motion.axis = stick[action][0]
		motion.axis_value = stick[action][1]
		InputMap.action_add_event(action, motion)
