class_name ShareCard
extends SubViewport
## The result image the end screen makes for sharing (Wordle's result grid is the model: the
## run at a glance, made to be posted): result, time, level as a job grade, kills, what ended the
## run, the best weapon, a roast line, and a QR code back to the game (?from=share, so the data
## can count who came from one). Laid out off screen at 720x1280 and captured as an image; the
## web page shows it for long-press saving or the share sheet (export_presets.cfg's
## survivorsShare). Nothing is rewarded for sharing: WeChat bans that and can block the domain.

const SIZE := Vector2i(720, 1280)
const MARGIN := 48
## Job grade by level, the result's headline number: the live data's lost runs ended around
## level 10-13 (L4), the wins at 45-56 (L7-L8).
const GRADES := [[50, "L8"], [40, "L7"], [30, "L6"], [20, "L5"], [10, "L4"]]
const FIRST_GRADE := "L3"
## Roasts by what ended the run, then by how it went.
const KILLER_ROASTS := {
	"deadline": "死于 Deadline。经典。",
	"layoff": "被裁员通知带走，N+1 都没拿到",
	"pie_boss": "吃了老板画的饼，然后倒下了",
	"spaghetti": "被屎山代码埋了",
	"spaghetti_small": "被屎山代码埋了",
	"meeting": "开会开死了",
	"techdebt": "被技术债压垮了",
	"scope_change": "需求又变了，人没了",
	"incident": "P0 事故，背锅下岗",
}
const WIN_ROASTS := ["上市敲钟，期权终于能卖了", "活过了 10 分钟，比大多数创业公司都久", "建议把这段写进简历"]
const EARLY_ROASTS := ["试用期都没过", "入职第一天就被优化了"]
const LATE_ROASTS := ["倒在了 IPO 前夜", "就差最后几分钟，可惜"]
const MIDDLE_ROASTS := ["差一点就上市了，再融一轮？", "项目黄了，但经验还在"]


## Lays the card out for the run `game` just finished; capture() then renders it.
func build(game: Game, victory: bool, theme: Theme) -> void:
	size = SIZE
	transparent_bg = false
	render_target_update_mode = SubViewport.UPDATE_DISABLED
	var background := ColorRect.new()
	background.color = Art.PAPER_SOFT
	background.size = SIZE
	background.theme = theme
	add_child(background)
	var margin := MarginContainer.new()
	margin.size = SIZE
	for side in ["left", "right", "top", "bottom"]:
		margin.add_theme_constant_override("margin_" + side, MARGIN)
	background.add_child(margin)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 26)
	margin.add_child(column)

	column.add_child(_centered_label("硅谷幸存者", 44, "DisplayLabel"))
	var result := _centered_label("敲钟上市！" if victory else "项目黄了…", 76, "DisplayLabel")
	result.add_theme_color_override("font_color", Art.BRAND_DEEP if victory else Art.RED)
	column.add_child(result)

	var faces := HBoxContainer.new()
	faces.alignment = BoxContainer.ALIGNMENT_CENTER
	faces.add_theme_constant_override("separation", 30)
	column.add_child(faces)
	faces.add_child(_icon("coder", 150))
	var killer := game.telemetry.last_hurt_by
	if not victory and Spawner.ENEMY_TYPES.has(killer):
		faces.add_child(_label("vs", 40, "DisplayLabel"))
		faces.add_child(_icon(Spawner.ENEMY_TYPES[killer]["art"], 130))

	var chips := GridContainer.new()
	chips.columns = 2
	chips.add_theme_constant_override("h_separation", 20)
	chips.add_theme_constant_override("v_separation", 20)
	chips.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	column.add_child(chips)
	var seconds := floori(game.elapsed)
	for chip: Array in [
		["存活", "%02d:%02d" % [floori(seconds / 60.0), seconds % 60]],
		["职级", grade(game.level)],
		["击杀", str(game.kills)],
		["难度", tr(Difficulty.tier_name())],
	]:
		chips.add_child(_chip(chip[0], chip[1]))

	var ending := tr("撑满 10 分钟，敲钟上市")
	if not victory:
		ending = tr("被「%s」带走") % tr(Spawner.ENEMY_TYPES[killer]["name"]) if Spawner.ENEMY_TYPES.has(killer) else tr("倒在了工位上")
	column.add_child(_centered_label(ending, 32, "StrongLabel"))
	var best := _best_weapon(game)
	if best != "":
		var best_row := HBoxContainer.new()
		best_row.alignment = BoxContainer.ALIGNMENT_CENTER
		best_row.add_theme_constant_override("separation", 12)
		column.add_child(best_row)
		best_row.add_child(_label("最强武器", 28, "MutedLabel"))
		best_row.add_child(_icon(Upgrades.WEAPONS[best]["art"], 52))
		best_row.add_child(_label(Upgrades.WEAPONS[best]["name"], 30, "StrongLabel"))
	var roast := _centered_label(tr(_roast(game, victory, killer)), 30)
	roast.add_theme_color_override("font_color", Art.INK_MUTED)
	column.add_child(roast)

	var filler := Control.new()
	filler.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(filler)
	var footer := HBoxContainer.new()
	footer.add_theme_constant_override("separation", 28)
	footer.alignment = BoxContainer.ALIGNMENT_CENTER
	column.add_child(footer)
	var qr := _icon("qr_share", 210)
	footer.add_child(qr)
	var footer_text := VBoxContainer.new()
	footer_text.alignment = BoxContainer.ALIGNMENT_CENTER
	footer_text.add_theme_constant_override("separation", 6)
	footer.add_child(footer_text)
	footer_text.add_child(_label("扫码一起来搬砖", 34, "StrongLabel"))
	footer_text.add_child(_label("survivors.lab115.com", 26, "MutedLabel"))
	footer_text.add_child(_label("躲开 Bug、会议和 Deadline", 24, "MutedLabel"))


## Renders the card once and returns it. Waits for the containers to lay out first.
func capture() -> Image:
	await get_tree().process_frame
	await get_tree().process_frame
	render_target_update_mode = SubViewport.UPDATE_ONCE
	await RenderingServer.frame_post_draw
	return get_texture().get_image()


static func grade(level: int) -> String:
	for step: Array in GRADES:
		if level >= step[0]:
			return step[1]
	return FIRST_GRADE


## The weapon that dealt the most damage this run, or "".
static func _best_weapon(game: Game) -> String:
	var best := ""
	for source: String in game.damage_by_source:
		if Upgrades.WEAPONS.has(source) and (best == "" or game.damage_by_source[source] > game.damage_by_source[best]):
			best = source
	return best


static func _roast(game: Game, victory: bool, killer: String) -> String:
	var lines: Array = WIN_ROASTS
	if not victory:
		if KILLER_ROASTS.has(killer):
			return KILLER_ROASTS[killer]
		lines = EARLY_ROASTS if game.elapsed < 180.0 else LATE_ROASTS if game.elapsed >= 420.0 else MIDDLE_ROASTS
	return lines[randi() % lines.size()]


func _chip(caption: String, value: String) -> Control:
	var chip := PanelContainer.new()
	var style := StyleBoxFlat.new()
	style.bg_color = Art.PAPER
	style.border_color = Art.LINE
	style.set_border_width_all(2)
	style.set_corner_radius_all(24)
	style.content_margin_top = 10
	style.content_margin_bottom = 14
	chip.add_theme_stylebox_override("panel", style)
	chip.custom_minimum_size = Vector2(290, 0)
	var stack := VBoxContainer.new()
	stack.add_theme_constant_override("separation", 0)
	chip.add_child(stack)
	for line: Label in [_label(caption, 24, "MutedLabel"), _label(value, 52, "DisplayLabel")]:
		line.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		stack.add_child(line)
	return chip


func _label(text: String, font_size: int, variation: String = "") -> Label:
	var label := Label.new()
	label.text = text
	label.theme_type_variation = variation
	label.add_theme_font_size_override("font_size", font_size)
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	return label


## A line across the whole card, centred and wrapped.
func _centered_label(text: String, font_size: int, variation: String = "") -> Label:
	var label := _label(text, font_size, variation)
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.custom_minimum_size = Vector2(SIZE.x - MARGIN * 2, 0)
	return label


func _icon(art: String, icon_size: float) -> TextureRect:
	var icon := TextureRect.new()
	icon.texture = Art.texture(art)
	icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	icon.custom_minimum_size = Vector2(icon_size, icon_size)
	icon.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	return icon
