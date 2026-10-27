extends SceneTree
## Renders the app icons the web export's PWA manifest points at (assets/icons/icon_*.png):
## the programmer on the lawn colour, kept inside the middle 70% so launchers that crop icons
## to a circle or squircle don't clip them.
##
##   godot --headless --path . -s tools/render_icons.gd

const SIZES := [144, 180, 512]
const LAWN := Color("dcefc6")
const FILL := 0.7


func _initialize() -> void:
	var svg := FileAccess.get_file_as_string("res://assets/art/coder.svg")
	var probe := Image.new()
	probe.load_svg_from_string(svg, 1.0)
	for size: int in SIZES:
		var canvas := Image.create(size, size, false, Image.FORMAT_RGBA8)
		canvas.fill(LAWN)
		var art := Image.new()
		art.load_svg_from_string(svg, size * FILL / probe.get_height())
		art.convert(Image.FORMAT_RGBA8)
		var corner := (Vector2i(size, size) - art.get_size()) / 2
		canvas.blend_rect(art, Rect2i(Vector2i.ZERO, art.get_size()), corner)
		var path := "res://assets/icons/icon_%d.png" % size
		canvas.save_png(path)
		print("wrote ", path)
	quit()
