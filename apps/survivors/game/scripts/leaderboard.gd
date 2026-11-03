class_name Leaderboard
extends RefCounted
## The clear-time leaderboards (.78, the user: 10:00 后不刷怪，直到清完所有怪才结束，然后加个排行榜，
## 列出最短通关时间; 玩家自己起昵称; 每张地图一个榜). A won run's time (Game.elapsed when the last
## enemy went down) goes on its map's board on the server (apps/survivors/nakama/modules/
## survivors.lua, through Cloud.call_rpc), shortest first, each player's best. Going on a board
## takes a 昵称 (the account's display name); a run won before there is one waits in `pending`
## until the player picks it on the result screen.

## What the server's errors mean, said to the player.
const ERRORS := {
	"length": "昵称要 2–12 个字",
	"characters": "昵称里有不能用的符号",
	"blocked": "这个昵称不能用，换一个吧",
	"no_name": "先起个昵称才能上榜",
	"invalid": "没交上去，再试一次",
	"offline": "没连上云端，稍后再试",
}

## The last won run not on its board yet: {map, ms, job, run}; empty when there is none.
static var pending := {}
## Where the last submitted run stands on its board (its player's best there), 0 before.
static var last_rank := 0
static var last_best_ms := 0


## Whether the boards can be reached at all: the cloud save is on and has signed in.
static func online() -> bool:
	var cloud := Cloud.shared()
	return cloud != null and cloud.status == Cloud.Status.SYNCED


static func has_name() -> bool:
	var cloud := Cloud.shared()
	return cloud != null and cloud.display_name != ""


## A won run, kept to submit (right away when the player has a name, Game._end_run).
static func record_win(game: Game) -> void:
	pending = {"map": Maps.current_id, "ms": roundi(game.elapsed * 1000.0), "job": game.player.job, "run": game.run_id}
	last_rank = 0
	last_best_ms = 0


## Puts `pending` on its board. The server's answer ({ok, rank, best_ms} or {error}).
static func submit() -> Dictionary:
	if pending.is_empty():
		return {"error": "invalid"}
	var answer := await Cloud.shared().call_rpc("survivors_submit", pending)
	if answer.get("ok", false):
		last_rank = int(answer.get("rank", 0))
		last_best_ms = int(answer.get("best_ms", 0))
		Telemetry.send_event("leaderboard", {"action": "submit", "map": pending["map"], "rank": last_rank})
		pending = {}
	return answer


## Sets the player's 昵称; the server checks it (length, symbols, blocked words).
static func set_name(name: String) -> Dictionary:
	var answer := await Cloud.shared().call_rpc("survivors_set_name", {"name": name.strip_edges()})
	if answer.get("ok", false):
		Cloud.shared().display_name = str(answer.get("name", ""))
	return answer


## A map's board: {records: [{rank, user, name, ms, job, me}], me: {...} or null, name}.
static func board(map_id: String) -> Dictionary:
	return await Cloud.shared().call_rpc("survivors_board", {"map": map_id})


## Reports a name on the boards (enough reports hide it as 匿名员工).
static func report(user_id: String) -> Dictionary:
	Telemetry.send_event("leaderboard", {"action": "report"})
	return await Cloud.shared().call_rpc("survivors_report", {"user": user_id})


## The error said to the player.
static func error_text(answer: Dictionary) -> String:
	return ERRORS.get(str(answer.get("error", "offline")), ERRORS["offline"])


## 11:23.4: a clear time in milliseconds.
static func time_text(milliseconds: int) -> String:
	var tenths := roundi(milliseconds / 100.0)
	return "%d:%02d.%d" % [floori(tenths / 600.0), floori(tenths / 10.0) % 60, tenths % 10]
