class_name Art
extends RefCounted
## Every texture the game draws, looked up by name: the hand-drawn SVGs in assets/art/, the
## soco-st buildings in assets/soco-st/, plus the UI font and the shared palette.
##
## Sizes everywhere are logical pixels of the 640x360 view. SVGs are imported at 4x their
## viewBox ([importer_defaults] in project.godot) so they stay sharp on high-DPI screens, which
## is why nothing is drawn at the texture's own size: sprite() scales art to the size asked for.

const ART_DIR := "res://assets/art/"
const BUILDING_DIR := "res://assets/soco-st/"
const FONT_PATH := "res://assets/fonts/ZCOOLKuaiLe-Regular.ttf"

## The outline colour of every drawing; UI borders and text outlines reuse it so the HUD sits
## in the same style as the art.
const INK := Color("3a2a2e")
const PAPER := Color("fffaf0")
const LAWN := Color("dcefc6")
const RED := Color("ff5d5d")
const YELLOW := Color("ffd25e")
const BLUE := Color("5b9cff")
const GREEN := Color("6cc25a")
const PINK := Color("ff8fa0")

static var _textures := {}
static var _buildings := {}
static var _font: FontFile


static func texture(art_name: String) -> Texture2D:
	if not _textures.has(art_name):
		_textures[art_name] = load(ART_DIR + art_name + ".svg")
	return _textures[art_name]


## Scale factor that draws the art's frame `size` logical pixels tall.
static func scale_for(art_name: String, size: float) -> float:
	return size / texture(art_name).get_height()


static func sprite(art_name: String, size: float) -> Sprite2D:
	var node := Sprite2D.new()
	node.texture = texture(art_name)
	node.scale = Vector2.ONE * scale_for(art_name, size)
	return node


## A soco-st building cropped to its drawing. The source PNGs are 1080x1080 with the building
## floating in the middle, so the transparent margin is cut off once and cached.
static func building(building_name: String) -> AtlasTexture:
	if not _buildings.has(building_name):
		var source: Texture2D = load(BUILDING_DIR + building_name + ".png")
		var cropped := AtlasTexture.new()
		cropped.atlas = source
		cropped.region = Rect2(source.get_image().get_used_rect())
		_buildings[building_name] = cropped
	return _buildings[building_name]


## The star art for an XP pickup worth `xp_value`: bigger hauls get warmer colours.
static func star(xp_value: int) -> String:
	if xp_value >= 20:
		return "star_gold"
	if xp_value >= 5:
		return "star_green"
	return "star_blue"


static func font() -> FontFile:
	if _font == null:
		_font = load(FONT_PATH)
	return _font
