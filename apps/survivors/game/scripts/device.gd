class_name Device
extends RefCounted
## What kind of device the web build is running on.

## Lets the smoke test try the phone-only paths (turned screen) on a desktop build.
static var force_handheld := false

static var _handheld: Variant = null


## A phone or tablet: the web build where the browser's main pointer is a finger. Asks the
## browser rather than DisplayServer.is_touchscreen_available(), which also says yes whenever
## mouse-to-touch emulation is on (project.godot turns it on so a mouse can drive the joystick).
static func is_handheld() -> bool:
	if force_handheld:
		return true
	if _handheld == null:
		_handheld = OS.has_feature("web") and bool(JavaScriptBridge.eval("matchMedia('(pointer: coarse)').matches", true))
	return _handheld
