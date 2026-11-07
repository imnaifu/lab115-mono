class_name Leaderboard
extends RefCounted
## The clear-time leaderboards (.78, the user: 10:00 后不刷怪，直到清完所有怪才结束，然后加个排行榜，
## 列出最短通关时间; 玩家自己起昵称; 每张地图一个榜). A won run's time (Game.elapsed when the last
## enemy went down) goes on its map's board on the server (apps/survivors/nakama/modules/
## survivors.lua, through Cloud.call_rpc), shortest first, each player's best. Going on a board
## takes a 昵称 (the account's display name); a run won before there is one waits in `pending`
## until the player picks it on the result screen.
## From .96 (the user: 排行榜也拿出来，没完成也记入榜，只要超过 1min 都算; 下班也算) a run that wasn't
## won goes on too once it lasted MIN_SECONDS, under every clear, the longest first (the server
## keeps both on one board, see survivors.lua): one that died at the result screen, one given up
## from the pause screen (重新开始, 下班) right away when there's a 昵称, and not otherwise (there is
## no result screen to ask for one).
## 无尽模式 (Game.endless, 0.2.0) has boards of its own (the server's endless_<map>): every run that
## lasted MIN_SECONDS, ranked by how long, the longest first, each player's best; a record there is
## `cleared` when it lasted Game.RUN_SECONDS. The usual boards never see an endless run.

## How long a run not won must last to go on a board (.96).
const MIN_SECONDS := 60.0

## What the server's errors mean, said to the player.
const ERRORS := {
	"length": "昵称要 2–12 个字",
	"characters": "昵称里有不能用的符号",
	"blocked": "这个昵称不能用，换一个吧",
	"no_name": "先起个昵称才能上榜",
	"taken": "已经有人叫这个了，换一个吧",
	"has_name": "已经起过昵称了，起了就不能改",
	"invalid": "没交上去，再试一次",
	"offline": "没连上云端，稍后再试",
}

## The last run not on its board yet: {map, ms, job, run, cleared, mode}; empty when there is none.
static var pending := {}
## Where the last submitted run stands on its board (its player's best there), 0 before.
static var last_rank := 0
static var last_best_ms := 0
static var last_best_cleared := true


## Whether the boards can be reached at all: the cloud save is on and has signed in.
static func online() -> bool:
	var cloud := Cloud.shared()
	return cloud != null and cloud.status == Cloud.Status.SYNCED


static func has_name() -> bool:
	var cloud := Cloud.shared()
	return cloud != null and cloud.display_name != ""


## A run that ended, kept to submit when it counts (won, or lasted MIN_SECONDS; Game._end_run,
## Game._record_given_up); whether it does.
static func record_run(game: Game, cleared: bool) -> bool:
	last_rank = 0
	last_best_ms = 0
	if not cleared and game.elapsed < MIN_SECONDS:
		pending = {}
		return false
	pending = {"map": Maps.current_id, "ms": roundi(game.elapsed * 1000.0), "job": game.player.job,
		"run": game.run_id, "cleared": cleared}
	# Only an endless run says its mode: a server before 0.2.0 took no `mode` and ranks it as usual.
	if game.endless:
		pending["mode"] = "endless"
	return true


## Puts `pending` on its board. The server's answer ({ok, rank, best_ms} or {error}).
static func submit() -> Dictionary:
	if pending.is_empty():
		return {"error": "invalid"}
	var answer := await Cloud.shared().call_rpc("survivors_submit", pending)
	if answer.get("ok", false):
		last_rank = int(answer.get("rank", 0))
		last_best_ms = int(answer.get("best_ms", 0))
		last_best_cleared = answer.get("best_cleared", true)
		Telemetry.send_event("leaderboard", {"action": "submit", "map": pending["map"], "rank": last_rank, "mode": pending.get("mode", "normal")})
		pending = {}
	return answer


## Whether `name` would do as this player's 昵称 ({ok} or {error}: length, characters, blocked,
## taken), asked as they type it (.97). Nothing is kept.
static func check_name(name: String) -> Dictionary:
	return await Cloud.shared().call_rpc("survivors_name_check", {"name": name.strip_edges()})


## Sets the player's 昵称, once (.97: a second time is has_name); the server checks it (length,
## symbols, blocked words, and no one else has it, ignoring case and spaces).
static func set_name(name: String) -> Dictionary:
	var answer := await Cloud.shared().call_rpc("survivors_set_name", {"name": name.strip_edges()})
	if answer.get("ok", false):
		Cloud.shared().display_name = str(answer.get("name", ""))
	return answer


## A map's board (its 无尽模式 one when `endless`): {records: [{rank, user, name, ms, cleared, job,
## me}], me: {...} or null, name}.
static func board(map_id: String, endless: bool = false) -> Dictionary:
	var asked := {"map": map_id}
	if endless:
		asked["mode"] = "endless"
	return await Cloud.shared().call_rpc("survivors_board", asked)


## The error said to the player.
static func error_text(answer: Dictionary) -> String:
	return ERRORS.get(str(answer.get("error", "offline")), ERRORS["offline"])


## A record as a board shows it: a clear's time (11:23.4), or how long a run not won lasted
## (撑到 7:42).
static func record_text(milliseconds: int, cleared: bool) -> String:
	if cleared:
		return time_text(milliseconds)
	var seconds := floori(milliseconds / 1000.0)
	return TranslationServer.translate("撑到 %s") % ("%d:%02d" % [floori(seconds / 60.0), seconds % 60])


## 11:23.4: a clear time in milliseconds.
static func time_text(milliseconds: int) -> String:
	var tenths := roundi(milliseconds / 100.0)
	return "%d:%02d.%d" % [floori(tenths / 600.0), floori(tenths / 10.0) % 60, tenths % 10]
