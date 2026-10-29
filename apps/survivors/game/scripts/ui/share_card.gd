class_name ShareCard
extends SubViewport
## The result image the end screen makes for sharing (Wordle's result grid is the model: the
## run at a glance, made to be posted): result, time, level as a job grade, the job played, kills,
## the best weapon, what ended the run, a roast line, and a QR code back to the game (?from=share, so the
## data can count who came from one). Drawn after the design canvas's 战绩图 board at twice its
## 360x640, laid out off screen and captured as an image; the web page shows it for long-press
## saving or the share sheet (export_presets.cfg's survivorsShare). Nothing is rewarded for
## sharing: WeChat bans that and can block the domain.

const SIZE := Vector2i(720, 1280)
## The design board is 360x640; everything below is its sizes doubled.
const SCALE := 2
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
	"server_elite": "主库一宕，人也跟着宕了",
	"ai_clone": "输给了 AI 的幻觉",
}
const WIN_ROASTS := ["上市敲钟，期权终于能卖了", "活过了 10 分钟，比大多数创业公司都久", "建议把这段写进简历"]
const EARLY_ROASTS := ["试用期都没过", "入职第一天就被优化了"]
const LATE_ROASTS := ["倒在了 IPO 前夜", "就差最后几分钟，可惜"]
const MIDDLE_ROASTS := ["差一点就上市了，再融一轮？", "项目黄了，但经验还在"]
## Shared from the pause screen, mid-run.
const ONGOING_ROASTS := ["还在搬砖，你能撑多久？", "人还在，项目也还在", "先截个图，万一待会儿没了"]


## Lays the card out for the run `game` just finished, or with `ongoing` for the run so far (the
## pause screen's 分享); capture() then renders it.
func build(game: Game, victory: bool, theme: Theme, ongoing: bool = false) -> void:
	size = SIZE
	transparent_bg = false
	render_target_update_mode = SubViewport.UPDATE_DISABLED
	# A yellow frame round a white card with the heavy ink outline.
	var background := ColorRect.new()
	background.color = Art.BRAND
	background.size = SIZE
	background.theme = theme
	add_child(background)
	var frame := MarginContainer.new()
	frame.size = SIZE
	for side in ["left", "right", "top", "bottom"]:
		frame.add_theme_constant_override("margin_" + side, 18 * SCALE)
	background.add_child(frame)
	var card := UiKit.panel(UiKit.box(Art.PAPER, Art.INK, 3 * SCALE, 20 * SCALE, Vector4(18, 20, 18, 16) * SCALE))
	frame.add_child(card)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 0)
	card.add_child(column)

	# Unlike the screens' Latin kickers, the card's names the game in the player's language:
	# nothing else on the image does, and in Chinese 硅谷幸存者 is the name people know it by.
	column.add_child(UiKit.kicker(tr("硅谷幸存者").to_upper(), Art.INK_MUTED, 11 * SCALE))
	column.add_child(UiKit.gap(8 * SCALE))
	var headline := HBoxContainer.new()
	headline.alignment = BoxContainer.ALIGNMENT_CENTER
	headline.add_theme_constant_override("separation", 8 * SCALE)
	column.add_child(headline)
	# The bell is the IPO's; a run that folded goes without.
	if victory and not ongoing:
		headline.add_child(UiKit.icon("bell", 40 * SCALE))
	var headline_text := "还在搬砖…" if ongoing else "敲钟上市！" if victory else "项目黄了…"
	headline.add_child(UiKit.label(headline_text, 32 * SCALE, "heavy"))

	column.add_child(UiKit.gap(10 * SCALE))
	var seconds := floori(game.elapsed)
	column.add_child(_centered(UiKit.label("%02d:%02d" % [floori(seconds / 60.0), seconds % 60], 64 * SCALE, "display")))
	var left := maxi(0, roundi(Game.RUN_SECONDS) - seconds)
	var sub := tr("撑满 10 分钟") if victory and not ongoing else tr("离上市还差 %s") % ("%02d:%02d" % [floori(left / 60.0), left % 60])
	column.add_child(_centered(UiKit.label(sub, 13 * SCALE, "muted")))

	column.add_child(UiKit.gap(12 * SCALE))
	var grade_pill := UiKit.panel(UiKit.box(Art.INK, Color.TRANSPARENT, 0, UiKit.PILL, Vector4(16, 6, 16, 6) * SCALE))
	grade_pill.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	var grade_row := HBoxContainer.new()
	grade_row.add_theme_constant_override("separation", 8 * SCALE)
	grade_pill.add_child(grade_row)
	# The job goes with the grade: 产品经理 职级 L5 (the facts row below has no room for a third).
	grade_row.add_child(_middle(UiKit.label(Jobs.data(game.player.job)["name"], 13 * SCALE, "heavy", Art.PAPER)))
	grade_row.add_child(_middle(UiKit.label("职级", 13 * SCALE, "body", Art.PAPER)))
	grade_row.add_child(_middle(UiKit.label(grade(game.level), 20 * SCALE, "display", Art.BRAND)))
	grade_row.add_child(_middle(UiKit.label("Lv %d" % game.level, 12 * SCALE, "display", Art.FILL_LILAC)))
	column.add_child(grade_pill)

	column.add_child(UiKit.gap(16 * SCALE))
	var facts := HBoxContainer.new()
	facts.add_theme_constant_override("separation", 8 * SCALE)
	column.add_child(facts)
	facts.add_child(_fact("击杀", UiKit.label(str(game.kills), 20 * SCALE, "display")))
	var best := _best_weapon(game)
	if best != "":
		var best_row := HBoxContainer.new()
		best_row.add_theme_constant_override("separation", 6 * SCALE)
		best_row.add_child(_middle(UiKit.label(Upgrades.weapon_name(best, game.upgrades.is_evolved(best)), 15 * SCALE, "heavy")))
		best_row.add_child(_middle(UiKit.label("%d%%" % roundi(100.0 * game.damage_by_source[best] / _total_damage(game)), 13 * SCALE, "display", Art.INK_MUTED)))
		facts.add_child(_fact("最强武器", best_row))
	var killer := game.telemetry.last_hurt_by
	if Spawner.ENEMY_TYPES.has(killer) and not ongoing:
		column.add_child(UiKit.gap(8 * SCALE))
		column.add_child(_culprit(Spawner.ENEMY_TYPES[killer], victory))

	column.add_child(UiKit.gap(14 * SCALE))
	var roast := UiKit.panel(UiKit.box(Art.BRAND_SOFT, Color.TRANSPARENT, 0, 12 * SCALE, Vector4(14, 10, 14, 10) * SCALE))
	var roast_text: String = ONGOING_ROASTS[randi() % ONGOING_ROASTS.size()] if ongoing else _roast(game, victory, killer)
	var roast_line := UiKit.label(tr("「%s」") % tr(roast_text), 14 * SCALE, "heavy")
	roast_line.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	roast_line.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	roast.add_child(roast_line)
	column.add_child(roast)

	column.add_child(UiKit.filler())
	var rule := ColorRect.new()
	rule.color = Art.LINE
	rule.custom_minimum_size = Vector2(0, 2 * SCALE)
	column.add_child(rule)
	column.add_child(UiKit.gap(12 * SCALE))
	var footer := HBoxContainer.new()
	footer.add_theme_constant_override("separation", 12 * SCALE)
	column.add_child(footer)
	var qr_frame := UiKit.panel(UiKit.box(Art.PAPER, Art.INK, 2 * SCALE, 8 * SCALE, Vector4(4, 4, 4, 4) * SCALE))
	qr_frame.add_child(UiKit.icon("qr_share", 92 * SCALE))
	footer.add_child(qr_frame)
	var footer_text := VBoxContainer.new()
	footer_text.alignment = BoxContainer.ALIGNMENT_CENTER
	footer_text.add_theme_constant_override("separation", 2 * SCALE)
	footer_text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	footer.add_child(footer_text)
	footer_text.add_child(UiKit.label("扫码一起搬砖", 15 * SCALE, "heavy"))
	var address := UiKit.label("survivors.lab115.com", 12 * SCALE, "display", Art.INK_MUTED)
	address.auto_translate_mode = Node.AUTO_TRANSLATE_MODE_DISABLED
	footer_text.add_child(address)
	# Wraps: in English the line ran wider than the room next to the QR code and pushed the whole
	# card past the image's right edge.
	var tagline := UiKit.label("躲开 Bug、会议和 Deadline", 11 * SCALE, "muted")
	tagline.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	footer_text.add_child(tagline)


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


static func _total_damage(game: Game) -> float:
	var total := 0.0
	for amount: float in game.damage_by_source.values():
		total += amount
	return maxf(total, 1.0)


static func _roast(game: Game, victory: bool, killer: String) -> String:
	var lines: Array = WIN_ROASTS
	if not victory:
		if KILLER_ROASTS.has(killer):
			return KILLER_ROASTS[killer]
		lines = EARLY_ROASTS if game.elapsed < 180.0 else LATE_ROASTS if game.elapsed >= 420.0 else MIDDLE_ROASTS
	return lines[randi() % lines.size()]


## A fact on cream: a small caption over its value.
func _fact(caption: String, value: Control) -> Control:
	var cell := UiKit.panel(UiKit.box(Art.PAPER_SOFT, Color.TRANSPARENT, 0, 12 * SCALE, Vector4(10, 8, 10, 10) * SCALE))
	cell.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var stack := VBoxContainer.new()
	stack.add_theme_constant_override("separation", 2 * SCALE)
	cell.add_child(stack)
	stack.add_child(UiKit.label(caption, 11 * SCALE, "muted"))
	stack.add_child(value)
	return cell


## Who ended the run (or, after a win, came closest), with its face on a pink disc.
func _culprit(data: Dictionary, victory: bool) -> Control:
	var cell := UiKit.panel(UiKit.box(Art.PAPER_SOFT, Color.TRANSPARENT, 0, 12 * SCALE, Vector4(10, 10, 10, 10) * SCALE))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10 * SCALE)
	cell.add_child(row)
	var face := UiKit.panel(UiKit.box(Art.PINK_LIGHT, Art.BOSS_RED, 2 * SCALE, UiKit.PILL))
	face.custom_minimum_size = Vector2.ONE * 36 * SCALE
	face.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var centre := CenterContainer.new()
	face.add_child(centre)
	centre.add_child(UiKit.icon(data["art"], 24 * SCALE))
	row.add_child(face)
	var text := VBoxContainer.new()
	text.add_theme_constant_override("separation", 0)
	text.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_child(text)
	text.add_child(UiKit.label("差点送走我的" if victory else "凶手", 11 * SCALE, "muted"))
	text.add_child(UiKit.label(data["name"], 15 * SCALE, "heavy"))
	return cell


func _centered(line: Label) -> Label:
	line.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	return line


func _middle(line: Label) -> Label:
	line.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	line.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	return line
