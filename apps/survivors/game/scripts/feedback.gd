class_name Feedback
extends RefCounted
## 提意见 (.94, the user picked R4 of the money plan: 游戏内「提意见」入口, to hear from the first
## players the channels bring). A few lines a player types, from 设置 or the result screen, go to
## the server (survivors_feedback in apps/survivors/nakama/modules/survivors.lua, through
## Cloud.call_rpc) with what the game knows about where they were; only the console reads them.
## Telemetry gets a `feedback` event for each open and send, never the text.

## The server's limits (FEEDBACK_MIN / FEEDBACK_MAX / FEEDBACK_PER_DAY there), said the same here.
const MIN_LENGTH := 2
const MAX_LENGTH := 500

## What the server's errors mean, said to the player.
const ERRORS := {
	"length": "写 2–500 个字吧",
	"too_many": "今天已经收到你 5 条了，明天再来吧",
	"offline": "没连上云端，稍后再试",
}


## Whether a message can get through now: the cloud save has signed in. Checked before the
## field opens, so nobody types a paragraph that then can't be sent.
static func online() -> bool:
	var cloud := Cloud.shared()
	return cloud != null and cloud.status == Cloud.Status.SYNCED


## Sends a message; the server's answer ({ok} or {error}). `where` is the entry it came from
## (settings / end).
static func send(text: String, where: String) -> Dictionary:
	var screen := DisplayServer.window_get_size()
	var about := {
		"version": Telemetry.VERSION,
		"lang": Lang.current(),
		"device": "phone" if Device.is_handheld() else "desktop",
		"screen": "%dx%d" % [screen.x, screen.y],
		"map": Maps.current_id,
		"job": Jobs.saved(),
		"runs": Settings.get_value("runs_played", 0),
	}
	var trimmed := text.strip_edges()
	var answer := await Cloud.shared().call_rpc("survivors_feedback", {"text": trimmed, "where": where, "context": about})
	var event := {"action": "sent" if answer.get("ok", false) else "failed", "where": where, "length": trimmed.length()}
	if not answer.get("ok", false):
		event["error"] = str(answer.get("error", "offline"))
	Telemetry.send_event("feedback", event)
	return answer


## The error said to the player.
static func error_text(answer: Dictionary) -> String:
	return ERRORS.get(str(answer.get("error", "offline")), ERRORS["offline"])
