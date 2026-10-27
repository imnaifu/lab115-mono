extends SceneTree
## Renders assets/splash.png (the boot splash, which the web export also shows while loading)
## from the SVG cast: the programmer in the middle, a few of the enemies gathering around.
##
##   godot --headless --path . -s tools/render_splash.gd

const SIZE := Vector2i(600, 340)
## [art, frame height in px, feet position]
const CAST := [
	["palm", 150, Vector2(70, 250)], ["palm", 130, Vector2(540, 240)],
	["meeting", 70, Vector2(130, 300)], ["mail", 66, Vector2(470, 300)],
	["ghost404", 70, Vector2(200, 210)], ["ping", 58, Vector2(410, 200)],
	["bug", 66, Vector2(220, 320)], ["techdebt", 70, Vector2(390, 325)],
	["coder", 120, Vector2(300, 300)],
]


func _initialize() -> void:
	var canvas := Image.create(SIZE.x, SIZE.y, false, Image.FORMAT_RGBA8)
	canvas.fill(Color(0, 0, 0, 0))
	for member: Array in CAST:
		var svg := FileAccess.get_file_as_string("res://assets/art/%s.svg" % member[0])
		var probe := Image.new()
		probe.load_svg_from_string(svg, 1.0)
		var image := Image.new()
		image.load_svg_from_string(svg, float(member[1]) / probe.get_height())
		image.convert(Image.FORMAT_RGBA8)
		var feet: Vector2 = member[2]
		var corner := Vector2i(feet) - Vector2i(image.get_width() / 2, image.get_height())
		canvas.blend_rect(image, Rect2i(Vector2i.ZERO, image.get_size()), corner)
	canvas.save_png("res://assets/splash.png")
	print("wrote assets/splash.png")
	quit()
