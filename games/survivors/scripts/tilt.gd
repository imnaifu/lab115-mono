class_name Tilt
extends RefCounted
## Steering by tilting the phone (web build only). Godot's web platform doesn't expose the
## motion sensors, so a small script listens to the browser's `deviceorientation` events,
## turns them into screen-relative tilt angles and leaves them on `window.__tilt` for us to read.
##
## The neutral pose is whatever angle the phone is held at when calibrate() runs (start of a
## run, resuming, switching tilt on), since nobody plays with the phone lying flat.

## Degrees of tilt for full speed, and the dead zone around the neutral pose.
const FULL_TILT := 18.0
const DEAD_ZONE := 3.0

## Installed once per page. Rotates the device's beta (front-back) and gamma (left-right)
## angles by the screen orientation so x/y always mean screen right/down.
## iOS only grants motion access from inside a real tap. Godot handles a tap a frame after the
## browser delivers it, which can be too late, so a refused request is retried from the next
## touch the browser delivers directly.
const BRIDGE_JS := """
(function () {
	if (window.__tilt) return;
	var tilt = window.__tilt = {x: 0, y: 0, seen: false, state: 'off', turned: false};
	function screenAngle() {
		// The game turns itself sideways on an upright phone; the player then holds the phone
		// as if it were in landscape (top to the left), whatever the browser reports.
		if (tilt.turned) return 90;
		var angle = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
		return ((angle % 360) + 360) % 360;
	}
	window.addEventListener('deviceorientation', function (event) {
		if (event.beta === null || event.gamma === null) return;
		var angle = screenAngle();
		if (angle === 90) { tilt.x = event.beta; tilt.y = -event.gamma; }
		else if (angle === 270) { tilt.x = -event.beta; tilt.y = event.gamma; }
		else if (angle === 180) { tilt.x = -event.gamma; tilt.y = -event.beta; }
		else { tilt.x = event.gamma; tilt.y = event.beta; }
		tilt.seen = true;
	});
	tilt.request = function () {
		var Orientation = window.DeviceOrientationEvent;
		if (!Orientation) { tilt.state = 'unsupported'; return; }
		if (typeof Orientation.requestPermission !== 'function') { tilt.state = 'granted'; return; }
		tilt.state = 'asking';
		Orientation.requestPermission().then(function (answer) {
			tilt.state = answer === 'granted' ? 'granted' : 'denied';
		}).catch(function () { tilt.state = 'retry'; });
	};
	document.addEventListener('touchend', function () {
		if (tilt.state === 'retry') tilt.request();
	}, true);
})();
"""

static var _bridge: JavaScriptObject
static var _neutral := Vector2.ZERO
static var _calibrated := false
static var _available: Variant = null
static var _turned := false


## Only offered on phones and tablets whose browser knows device orientation.
static func available() -> bool:
	if _available == null:
		_available = OS.has_feature("web") and Device.is_handheld() \
			and bool(JavaScriptBridge.eval("'DeviceOrientationEvent' in window", true))
	return _available


## Whether the game is drawn turned sideways on an upright phone (Game._apply_orientation),
## so tilt is read as if the phone were held in landscape.
static func set_screen_turned(turned: bool) -> void:
	_turned = turned
	if _bridge != null:
		_bridge.turned = turned


static func enabled() -> bool:
	return available() and Settings.get_value("tilt", false)


## Restores the saved choice after a page load. Android needs no permission and is done; iOS
## refuses a request made outside a tap, which lands in the retry path and is picked up on the
## player's first touch.
static func setup() -> void:
	if enabled():
		_install()
		_bridge.request()


static func set_enabled(on: bool) -> void:
	Settings.set_value("tilt", on)
	if on:
		_install()
		_bridge.request()
		calibrate()


## off / asking / retry / granted / denied / unsupported, for the settings screen.
static func state() -> String:
	if _bridge == null:
		return "off"
	return str(_bridge.state)


## Takes the current pose as neutral. Before the first sensor reading arrives this marks the
## pose as unknown, and direction() calibrates on the first reading instead.
static func calibrate() -> void:
	_calibrated = _bridge != null and _bridge.seen
	if _calibrated:
		_neutral = Vector2(_bridge.x, _bridge.y)


## Steering from the current tilt: zero inside the dead zone, length 1 at FULL_TILT.
static func direction() -> Vector2:
	if not enabled() or _bridge == null or not _bridge.seen:
		return Vector2.ZERO
	if not _calibrated:
		calibrate()
	var offset := Vector2(_bridge.x, _bridge.y) - _neutral
	if offset.length() < DEAD_ZONE:
		return Vector2.ZERO
	return (offset / FULL_TILT).limit_length(1.0)


static func _install() -> void:
	if _bridge != null:
		return
	JavaScriptBridge.eval(BRIDGE_JS, true)
	_bridge = JavaScriptBridge.get_interface("__tilt")
	_bridge.turned = _turned
