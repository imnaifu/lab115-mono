class_name Tilt
extends RefCounted
## Steering by tilting the phone (web build only). Godot's web platform doesn't expose the
## motion sensors, so a small script listens to the browser's `deviceorientation` events and
## leaves the direction of gravity, in screen terms, on `window.__tilt` for us to read.
##
## Left-right is measured against true level, so however crooked the phone was when the run
## started, holding it level means not moving sideways. Forward-back is measured against how
## the phone was held when calibrate() last ran (start of a run, resuming, switching tilt on,
## the HUD's recalibrate button), averaged over CALIBRATION_SECONDS: everyone holds a phone
## at a different angle towards their face, and nobody plays with it lying flat.

## Degrees of tilt for full speed, and the dead zone around the neutral pose.
const FULL_TILT := 18.0
const DEAD_ZONE := 3.0
## The forward-back neutral is the average over this long, so the jolt of the tap that started
## the run doesn't become the neutral pose.
const CALIBRATION_SECONDS := 0.5

## Installed once per page. Rather than using the beta/gamma angles directly, which jump when a
## phone in landscape is held near upright (gamma only spans ±90°), it turns them into gravity's
## direction in device coordinates (x to the right edge, y to the top edge), which changes
## smoothly at any angle, then expresses that along the screen's right and up for the current
## orientation. x/y are smoothed to take out hand shake.
## iOS only grants motion access from inside a real tap. Godot handles a tap a frame after the
## browser delivers it, which can be too late, so a refused request is retried from the next
## touch the browser delivers directly.
const BRIDGE_JS := """
(function () {
	if (window.__tilt) return;
	var tilt = window.__tilt = {x: 0, y: 0, seen: false, state: 'off', turned: false};
	var SMOOTHING = 0.3;
	function screenAngle() {
		// The game turns itself sideways on an upright phone; the player then holds the phone
		// as if it were in landscape (top to the left), whatever the browser reports.
		if (tilt.turned) return 90;
		var angle = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
		return ((angle % 360) + 360) % 360;
	}
	window.addEventListener('deviceorientation', function (event) {
		if (event.beta === null || event.gamma === null) return;
		var beta = event.beta * Math.PI / 180;
		var gamma = event.gamma * Math.PI / 180;
		// Unit gravity in device coordinates, from the W3C Z-X'-Y'' Euler angles.
		var towardRightEdge = Math.cos(beta) * Math.sin(gamma);
		var towardTopEdge = -Math.sin(beta);
		var angle = screenAngle();
		var right, up;
		if (angle === 90) { right = -towardTopEdge; up = towardRightEdge; }
		else if (angle === 270) { right = towardTopEdge; up = -towardRightEdge; }
		else if (angle === 180) { right = -towardRightEdge; up = -towardTopEdge; }
		else { right = towardRightEdge; up = towardTopEdge; }
		if (!tilt.seen) { tilt.x = right; tilt.y = up; }
		tilt.x += (right - tilt.x) * SMOOTHING;
		tilt.y += (up - tilt.y) * SMOOTHING;
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
static var _available: Variant = null
static var _turned := false
## Forward-back angle, in degrees, that counts as standing still.
static var _neutral_pitch := 0.0
static var _calibrated := false
static var _calibration_ends_at := 0
static var _pitch_sum := 0.0
static var _pitch_samples := 0


## Only offered on phones and tablets whose browser knows device orientation.
static func available() -> bool:
	if _available == null:
		_available = OS.has_feature("web") and Device.is_handheld() \
			and bool(JavaScriptBridge.eval("'DeviceOrientationEvent' in window", true))
	return _available


## Whether the game is drawn turned sideways on an upright phone (Game.apply_orientation),
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


## Starts measuring a new forward-back neutral; direction() averages the readings it sees over
## the next CALIBRATION_SECONDS and holds still meanwhile.
static func calibrate() -> void:
	_calibrated = false
	_calibration_ends_at = Time.get_ticks_msec() + int(CALIBRATION_SECONDS * 1000.0)
	_pitch_sum = 0.0
	_pitch_samples = 0


## Steering from the current tilt: zero inside the dead zone, length 1 at FULL_TILT.
static func direction() -> Vector2:
	if not enabled() or _bridge == null or not _bridge.seen:
		return Vector2.ZERO
	# Gravity's share along the screen's right and up, as angles of tilt.
	var roll := rad_to_deg(asin(clampf(float(_bridge.x), -1.0, 1.0)))
	var pitch := rad_to_deg(asin(clampf(float(_bridge.y), -1.0, 1.0)))
	if not _calibrated:
		_pitch_sum += pitch
		_pitch_samples += 1
		if Time.get_ticks_msec() < _calibration_ends_at:
			return Vector2.ZERO
		_neutral_pitch = _pitch_sum / _pitch_samples
		_calibrated = true
	# Tipping the top edge away from you raises gravity's share towards it, which should move up
	# (the game's -y).
	var offset := Vector2(roll, -(pitch - _neutral_pitch))
	if offset.length() < DEAD_ZONE:
		return Vector2.ZERO
	return (offset / FULL_TILT).limit_length(1.0)


static func _install() -> void:
	if _bridge != null:
		return
	JavaScriptBridge.eval(BRIDGE_JS, true)
	_bridge = JavaScriptBridge.get_interface("__tilt")
	_bridge.turned = _turned
