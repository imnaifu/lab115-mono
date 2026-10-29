class_name Ultimate
extends RefCounted
## The job's ultimate (Jobs.ULTS): charged by kills, used with the button in the corner (space on
## a computer). One at a time; using it empties the charge.

## Kills that fill the charge: about once a minute in a full run (the bot's runs kill ~2200;
## at 120 it went off every half minute and 数据清洗 alone dealt a third of all damage).
const CHARGE_KILLS := 200
## git revert: back to where the player was this long ago, clearing boss shots this close.
const REVERT_SECONDS := 3.0
const REVERT_CLEAR_RADIUS := 120.0
## 拉个会: everything on screen stunned this long (bosses half, as with any stun).
const FREEZE_SECONDS := 2.5
## Cmd+Z: damage taken in the last this many seconds is given back.
const UNDO_SECONDS := 5.0
## 重启: this long untouchable, then this share of max health back.
const REBOOT_INVULN := 1.0
const REBOOT_HEAL := 0.4

var _game: Game
var _kills := 0


func _init(game: Game) -> void:
	_game = game


func id() -> String:
	return Jobs.data(_game.player.job)["ult"]


## 0 to 1.
func charge() -> float:
	return minf(1.0, float(_kills) / CHARGE_KILLS)


func is_ready() -> bool:
	return _kills >= CHARGE_KILLS


func on_kill() -> void:
	_kills += 1


## Uses it if charged. Whether it went off.
func use() -> bool:
	if not is_ready() or _game.state != Game.State.PLAYING:
		return false
	_kills = 0
	var player := _game.player
	var ult: Dictionary = Jobs.ULTS[id()]
	match id():
		"revert":
			var before: Array = player.state_ago(REVERT_SECONDS)
			Effects.ring(_game, player.position, 24.0, Art.BLUE)
			player.position = before[0]
			player.hp = maxf(player.hp, before[1])
			player.queue_redraw()
			for shot in _game.hostile_shots:
				var point = shot.blockable_point()
				if point != null and (point as Vector2).distance_to(player.position) <= REVERT_CLEAR_RADIUS:
					shot.block(_game)
		"freeze":
			for enemy in _game.visible_enemies():
				enemy.stun(FREEZE_SECONDS)
		"undo":
			player.heal(player.hurt_within(UNDO_SECONDS))
			player.forget_hurt()
		"reboot":
			player.make_invulnerable(REBOOT_INVULN)
			player.heal(player.max_hp * REBOOT_HEAL)
		"clean":
			for enemy in _game.visible_enemies():
				if not enemy.is_elite:
					# Doubled so an investor's aura (half damage) can't save one.
					_game.damage_enemy(enemy, (enemy.hp + 1.0) * 2.0, Vector2.ZERO, "clean", true)
	Effects.ring(_game, player.position, 60.0, Art.BRAND)
	player.shake(0.2, 3.0)
	Sound.play("ultimate")
	_game.announce(tr("%s！") % tr(ult["name"]))
	_game.telemetry.on_ult()
	return true
