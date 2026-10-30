class_name Art
extends RefCounted
## Every texture the game draws, looked up by name: the hand-drawn SVGs in assets/art/, the
## soco-st buildings in assets/soco-st/, plus the fonts and the shared palette.
##
## Sizes everywhere are logical pixels of the 640x360 view. SVGs are imported at 4x their
## viewBox ([importer_defaults] in project.godot) so they stay sharp on high-DPI screens, which
## is why nothing is drawn at the texture's own size: sprite() scales art to the size asked for.

const ART_DIR := "res://assets/art/"
const BUILDING_DIR := "res://assets/soco-st/"
const FONT_DIR := "res://assets/fonts/"

## The UI follows the Sokosoko design system (modelled on soco-st.com, where the buildings come
## from): white panels on a cream ground, ink text, round controls, one warm yellow for what
## matters most. INK is also the outline colour of every drawing, so art and UI share one line.
const INK := Color("2f3542")
## Secondary text: captions, counts, hints.
const INK_MUTED := Color("666b7a")
const PAPER := Color("ffffff")
## The cream ground behind panels (overlays over the world).
const PAPER_SOFT := Color("faf7f0")
## Wells and chips inside a panel: stat chips, bar tracks, key badges.
const PAPER_SUNK := Color("f3efe6")
## Hairline card borders; LINE_STRONG for the borders of controls.
const LINE := Color("e6e0d4")
const LINE_STRONG := Color("8a909c")
## The one accent: primary buttons, the heading highlighter, the XP bar. Text on it is INK.
const BRAND := Color("f7c948")
const BRAND_DEEP := Color("e0a91b")
const BRAND_SOFT := Color("fdf1cc")
## Focus rings.
const LINK := Color("2f6fb0")
## Pastel wells behind icons, one per kind of upgrade (similar lightness, different hue).
const FILL_SKY := Color("bcdcf2")
const FILL_MINT := Color("bfe3cf")
const FILL_LILAC := Color("d9d1f2")
const FILL_PINK := Color("f6c6cf")
## Lighter tints of those for chips and card wells: weapons sky, passives mint, danger pink.
const SKY_LIGHT := Color("e5f0fb")
const MINT_LIGHT := Color("e3f4ea")
const PINK_LIGHT := Color("fde6e8")
## Text on MINT_LIGHT (the 被动 tag).
const GREEN_INK := Color("276b43")
## Bosses and danger in the UI: boss bar, countdown, warnings, the off-screen pointers.
const BOSS_RED := Color("b23344")
## The player's health.
const HP_RED := Color("d94b5c")
## Behind dialogs that pause the game (level-up, year-end bonus, pause).
const SCRIM := Color(0.11, 0.12, 0.15, 0.48)
## Card rarity, 普通 to 传说 (Upgrades.RARITIES), the game's usual white / green / blue / purple /
## orange: a card's outline, its tag's fill, and the tag's text (dark enough to read on the fill).
const RARITY_EDGE := [Color("e6e0d4"), Color("4caf6a"), Color("4a8fe8"), Color("9363e8"), Color("f08a24")]
const RARITY_FILL := [Color("f3efe6"), Color("e3f4ea"), Color("e5f0fb"), Color("efe9fd"), Color("fff0dc")]
const RARITY_INK := [Color("666b7a"), Color("276b43"), Color("2f6fb0"), Color("6a3fc9"), Color("a8560a")]

## World colours, used by the map and the effects rather than the UI.
const LAWN := Color("dcefc6")
const RED := Color("ff5d5d")
const YELLOW := Color("ffd25e")
const BLUE := Color("5b9cff")
const GREEN := Color("6cc25a")
const PINK := Color("ff8fa0")

static var _textures := {}
static var _buildings := {}
static var _fonts := {}


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


## Noto Sans SC (思源黑体) at a weight from 100 to 900: the text face, Chinese and Latin.
static func font(weight: int = 500) -> Font:
	return _font_at("NotoSansSC", weight)


## Nunito, the rounded face for headings and numbers; Chinese characters, which it doesn't
## have, come from Noto Sans SC at the same weight.
static func display_font(weight: int = 800) -> Font:
	var key := "display %d" % weight
	if not _fonts.has(key):
		var display := _font_at("Nunito", weight).duplicate() as FontVariation
		display.fallbacks = [font(weight)]
		_fonts[key] = display
	return _fonts[key]


## Both fonts are variable (tools/subset_fonts.py keeps the weight axis), so each weight is the
## one file with its wght axis set.
static func _font_at(family: String, weight: int) -> FontVariation:
	var key := "%s %d" % [family, weight]
	if not _fonts.has(key):
		var variation := FontVariation.new()
		variation.base_font = load(FONT_DIR + family + ".ttf")
		variation.variation_opentype = {TextServerManager.get_primary_interface().name_to_tag("wght"): weight}
		_fonts[key] = variation
	return _fonts[key]
