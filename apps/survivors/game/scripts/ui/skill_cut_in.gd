class_name SkillCutIn
extends Control
## A 技能 being set off (0.1.1, the user: 大招点了后，暂停一下，做一个动画特效，然后再继续): while the
## game stands still (Game.freeze) the screen dims with a white flash, and a tilted yellow band
## sweeps in from the left with the job's face, the skill's name and the job's line, holds, and
## sweeps out to the right; the skill goes off as the game moves again (Ultimates._go_off).
## Timed in real time, and stopped with the tree like the freeze, so the pause screen opened
## meanwhile holds both where they are (the HUD hides it while that is up).

## The whole of it; the freeze lasts as long.
const SECONDS := 1.0
const SLIDE_IN := 0.18
const SLIDE_OUT := 0.2
const DIM := 0.55
const FLASH := 0.8
const BAND_HEIGHT := 86.0
const TILT_DEGREES := -6.0
const FACE_SIZE := 60.0
## Pale speed lines across the band: how many, and how far apart down it.
const STREAKS := 7

var _dim := ColorRect.new()
var _flash := ColorRect.new()
## Slid across the screen, the band in it.
var _slider := Control.new()
var _band := Control.new()
var _face: Control


## Builds it over `area_size` (the HUD's root, turned or not) and plays it once, then frees itself.
func play(job: String, area_size: Vector2) -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	for cover: ColorRect in [_dim, _flash]:
		cover.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		cover.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(cover)
	_dim.color = Color(Art.INK, 0.0)
	_flash.color = Color(1, 1, 1, FLASH)
	_slider.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_slider.size = area_size
	add_child(_slider)
	_build_band(job, area_size)

	var tween := create_tween()
	# The game's clock stands at 0 meanwhile; this keeps to the real one.
	tween.set_ignore_time_scale(true)
	tween.set_pause_mode(Tween.TWEEN_PAUSE_STOP)
	var width := area_size.x * 1.3
	_slider.position.x = -width
	tween.tween_property(_dim, "color:a", DIM, SLIDE_IN)
	tween.parallel().tween_property(_flash, "color:a", 0.0, SLIDE_IN + 0.08)
	tween.parallel().tween_property(_slider, "position:x", 0.0, SLIDE_IN).set_trans(Tween.TRANS_EXPO).set_ease(Tween.EASE_OUT)
	tween.parallel().tween_property(_face, "scale", Vector2.ONE, SLIDE_IN + 0.12).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	# Holds still in the middle, drifting a touch so it doesn't look stuck.
	var hold := SECONDS - SLIDE_IN - SLIDE_OUT
	tween.tween_property(_slider, "position:x", area_size.x * 0.03, hold)
	tween.tween_property(_slider, "position:x", width, SLIDE_OUT).set_trans(Tween.TRANS_EXPO).set_ease(Tween.EASE_IN)
	tween.parallel().tween_property(_dim, "color:a", 0.0, SLIDE_OUT)
	tween.tween_callback(queue_free)


## The tilted band across the middle: yellow with ink edges and speed lines, the face and the words
## in its middle.
func _build_band(job: String, area_size: Vector2) -> void:
	var ultimate := Jobs.ultimate(job)
	# Wider than the screen, so the tilt never shows its ends.
	var overhang := area_size.y * 0.2 + 40.0
	_band.position = Vector2(-overhang, (area_size.y - BAND_HEIGHT) / 2.0)
	_band.size = Vector2(area_size.x + overhang * 2.0, BAND_HEIGHT)
	_band.pivot_offset = _band.size / 2.0
	_band.rotation_degrees = TILT_DEGREES
	_band.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_band.draw.connect(_draw_band)
	_slider.add_child(_band)

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_band.add_child(row)
	_face = UiKit.well(Jobs.data(job)["art"], FACE_SIZE, Art.PAPER, UiKit.PILL)
	_face.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_face.pivot_offset = Vector2.ONE * FACE_SIZE / 2.0
	_face.scale = Vector2.ONE * 0.4
	row.add_child(_face)
	var words := VBoxContainer.new()
	words.add_theme_constant_override("separation", 0)
	words.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	words.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(words)
	var name_label := UiKit.label(tr(ultimate["name"]), 30, "display", Art.INK)
	name_label.add_theme_constant_override("outline_size", 8)
	name_label.add_theme_color_override("font_outline_color", Art.PAPER)
	words.add_child(name_label)
	# The product manager's line is the skill's name shouted (今天必须上线！): said once is enough.
	var line := tr(ultimate["line"])
	if line.trim_suffix("！").trim_suffix("!") != tr(ultimate["name"]):
		words.add_child(UiKit.label(line, 14, "strong", Art.INK))


func _draw_band() -> void:
	var band_size := _band.size
	_band.draw_rect(Rect2(Vector2.ZERO, band_size), Art.BRAND)
	# Speed lines, staggered so they read as motion rather than stripes.
	for i in STREAKS:
		var y := band_size.y * (i + 0.5) / STREAKS
		var start := band_size.x * fmod(i * 0.37, 1.0) * 0.6
		_band.draw_line(Vector2(start, y), Vector2(start + band_size.x * 0.35, y), Color(Art.PAPER, 0.35), 2.0)
	_band.draw_rect(Rect2(0, 0, band_size.x, 4), Art.INK)
	_band.draw_rect(Rect2(0, band_size.y - 4, band_size.x, 4), Art.INK)
