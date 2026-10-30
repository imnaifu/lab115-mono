class_name TestMode
extends RefCounted
## 测试模式 (.34, the user's ask: an easier way to feel how hard a stretch of a run is than playing
## up to it or reading bot numbers). On with ?debug=1 in the page's address, or --debug on the
## command line. The title screen then picks a minute to start the run at and invincibility; the
## pause screen brings the map's weather, its guest boss, the next boss or a level-up at once.
## Nothing a test run does is kept: progress isn't saved (Progress._save) and the run isn't
## reported (Game._on_run_started skips Telemetry), so the live numbers stay real players'.

## Starting minutes on offer, and the level a player who picks up every star has reached at each
## minute (bots on .33's curve), which a run started late is levelled up to with random cards.
const START_MINUTES := [0, 3, 5, 7, 9]
const LEVEL_AT_MINUTE := [1, 4, 8, 11, 15, 19, 23, 27, 31, 35]
## Upgrades a boss's year-end bonus gave on average (绩效 B / A / S: 1 / 3 / 5 at 75 / 20 / 5%).
const CHEST_UPGRADES := 1.6

static var on := false
static var start_minute := 0
static var god := false
static var _checked := false


## Reads the switch once per page load.
static func check() -> void:
	if _checked:
		return
	_checked = true
	if OS.get_cmdline_user_args().has("--debug"):
		on = true
	elif OS.has_feature("web"):
		var query: Variant = JavaScriptBridge.eval("location.search", true)
		on = query is String and (query as String).contains("debug=1")


## The level reached by `minute` (0-9), for a run started there.
static func level_at(minute: int) -> int:
	return LEVEL_AT_MINUTE[clampi(minute, 0, LEVEL_AT_MINUTE.size() - 1)]
