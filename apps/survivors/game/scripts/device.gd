class_name Device
extends RefCounted
## What kind of device the web build is running on.

## Lets the smoke test try the phone-only paths (turned screen) on a desktop build.
static var force_handheld := false

static var _handheld: Variant = null
## localStorage key the loading page reads before the game starts (export_presets.cfg's
## html/head_include): the saved settings live in IndexedDB, which it can't reach in time.
const ORIENTATION_KEY := "survivors-orientation"


## A phone or tablet: the web build where the browser's main pointer is a finger. Asks the
## browser rather than DisplayServer.is_touchscreen_available(), which also says yes whenever
## mouse-to-touch emulation is on (project.godot turns it on so a mouse can drive the joystick).
static func is_handheld() -> bool:
	if force_handheld:
		return true
	if _handheld == null:
		_handheld = OS.has_feature("web") and bool(JavaScriptBridge.eval("matchMedia('(pointer: coarse)').matches", true))
	return _handheld


## Whether the player chose landscape on a phone (Settings "orientation"), mirrored for the
## loading page so it shows turned the same way the game will.
static func prefers_landscape() -> bool:
	var wants_landscape: bool = Settings.get_value("orientation", "portrait") == "landscape"
	if OS.has_feature("web"):
		JavaScriptBridge.eval("try { localStorage.setItem('%s', '%s'); } catch (error) {}" % [ORIENTATION_KEY, "landscape" if wants_landscape else "portrait"], true)
	return wants_landscape
