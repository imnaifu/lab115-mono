class_name Lang
extends RefCounted
## Chinese / English. The Chinese written throughout the code is the source text; EN maps each
## string to English and is registered as a Translation, so Labels and Buttons switch on their
## own when the locale changes, and formatted strings go through tr() before formatting.
## (project.godot sets the fallback locale to zh, otherwise Chinese mode would fall back to
## this English table.)

const LANGUAGES := ["zh", "en"]

const EN := {
	# Title and HUD
	"硅谷幸存者": "Silicon Valley Survivors",
	"躲开 Bug、会议和 Deadline，撑过 10 分钟就能敲钟上市！": "Dodge bugs, meetings and deadlines. Survive 10 minutes to IPO!",
	"开始搬砖": "Clock In",
	"设置": "Settings",
	"电脑：WASD / 方向键移动　手机：按住屏幕拖动": "PC: WASD / arrow keys · Phone: touch and drag",
	"升级啦！ Lv %d": "Level up! Lv %d",
	"按 1 / 2 / 3 或点卡片选择": "Press 1 / 2 / 3 or tap a card",
	"新！": "NEW!",
	"休息一下": "Taking a Break",
	"武器": "Weapons",
	"能力": "Perks",
	"还没有": "None yet",
	"生命 %d / %d": "HP %d / %d",
	"伤害 +%d%%": "Damage +%d%%",
	"冷却 -%d%%": "Cooldown -%d%%",
	"移速 +%d%%": "Speed +%d%%",
	"拾取 +%d%%": "Pickup +%d%%",
	"护甲 %d　回血 %.1f/秒": "Armor %d · Regen %.1f/s",
	"继续（Esc）": "Resume (Esc)",
	"重新开始（R）": "Restart (R)",
	"敲钟上市！": "IPO Day!",
	"项目黄了…": "Startup Folded…",
	"撑过了 10 分钟，公司成功 IPO": "You survived 10 minutes and rang the bell",
	"公司没撑住……再融一轮？": "The company didn't make it… raise another round?",
	"存活": "Survived",
	"等级": "Level",
	"击杀": "Kills",
	"伤害排行": "Damage dealt",
	"再来一局（R）": "Play Again (R)",
	# Settings
	"语言": "Language",
	"陀螺仪移动": "Tilt to move",
	"开": "On",
	"关": "Off",
	"音效": "Sound",
	"音乐": "Music",
	"返回": "Back",
	"屏幕方向": "Screen",
	"竖屏": "Portrait",
	"横屏": "Landscape",
	"倾斜手机就能移动，前后以现在的角度为准": "Tilt to move! Forward-back counts from how you hold it now",
	"已按现在的角度重新校准": "Recalibrated to how you hold the phone now",
	"继续时会按那时拿手机的角度重新校准": "Resuming re-zeroes tilt to how you hold the phone",
	"左右以水平为准，前后以开局时拿手机的角度为准；玩的时候点右上角的手机按钮可以重新校准": "Left-right is measured against level, forward-back against how you held the phone at the start. Tap the phone button at the top right to recalibrate.",
	"请在弹窗里允许访问动作与方向": "Allow motion & orientation access in the prompt",
	"再点一下屏幕来授权": "Tap the screen once more to allow access",
	"没有权限：请在浏览器设置里允许动作与方向": "No permission: allow motion & orientation in the browser settings",
	"这台设备不支持": "Not supported on this device",
	# Announcements
	"珍珠奶茶，回血 30！": "Bubble tea! +30 HP",
	"拿到融资！免费升级一次": "Funded! A free level-up",
	"磁铁！全图经验飞过来了": "Magnet! All the XP flies to you",
	"捡星星升级！走近就会自动吸过来": "Grab stars to level up! Walk close and they fly to you",
	"消息轰炸！": "Notification storm!",
	"Deadline 逼近！": "A Deadline approaches!",
	"Bug 大爆发！": "Bug outbreak!",
	"首领出现：AI 大模型": "Boss: the Giant AI Model",
	"404 幽灵合围！": "404 ghosts close in!",
	"两个 Deadline 撞车了！": "Two Deadlines collide!",
	"消息轰炸 ×2！": "Notification storm ×2!",
	"最后的考验：AI 大模型 ×2": "Final test: Giant AI Model ×2",
	# Enemies
	"消息红点": "Notification",
	"未读邮件": "Unread Mail",
	"会议邀请": "Meeting Invite",
	"404 幽灵": "404 Ghost",
	"技术债": "Tech Debt",
	"宕机服务器": "Crashed Server",
	"AI 大模型": "Giant AI Model",
	# Weapons
	"回车键": "Enter Key",
	"自动敲向最近的敌人": "Fires at the nearest enemy",
	"每轮多敲一下": "One more press per burst",
	"伤害 +5": "Damage +5",
	"穿透 +2，伤害 +5": "Pierce +2, damage +5",
	"复制粘贴": "Copy & Paste",
	"朝面向的方向连发文件": "Fires files the way you face",
	"伤害 +3": "Damage +3",
	"多粘贴一份": "One more copy",
	"多粘贴一份，出手更快": "One more copy, fires faster",
	"无人机": "Drone",
	"绕身巡航，撞开路过的敌人": "Circles you, ramming enemies",
	"多一架无人机": "One more drone",
	"伤害 +4，巡航圈变大": "Damage +4, wider orbit",
	"多一架，飞得更快": "One more, flies faster",
	"云端部署": "Cloud Deploy",
	"从云上劈中屏幕里的敌人": "Strikes on-screen enemies from the cloud",
	"多劈一道": "One more strike",
	"伤害 +8": "Damage +8",
	"多劈一道，范围变大": "One more strike, bigger splash",
	"多劈两道，冷却更短": "Two more strikes, shorter cooldown",
	"机械键盘": "Mech Keyboard",
	"往上一抛，落下砸穿一切": "Tossed up, smashes through everything",
	"多抛一把": "One more toss",
	"伤害 +10": "Damage +10",
	"伤害 +10，键盘变大": "Damage +10, bigger keyboard",
	"Wi-Fi 信号": "Wi-Fi Signal",
	"持续伤害身边的敌人": "Keeps hurting enemies around you",
	"信号范围变大": "Wider signal",
	"伤害 +2，频率更高": "Damage +2, ticks faster",
	"伤害 +3，范围更大，频率更高": "Damage +3, wider, ticks faster",
	# Perks
	"冰美式": "Iced Americano",
	"所有伤害 +10%": "All damage +10%",
	"降噪耳机": "ANC Headphones",
	"受到的伤害 -1": "Damage taken -1",
	"撸铁": "Lifting",
	"最大生命 +20，并回复 20": "Max HP +20, heal 20",
	"电动滑板": "E-Scooter",
	"移动速度 +8%": "Move speed +8%",
	"双屏显示器": "Dual Monitors",
	"武器冷却 -8%": "Weapon cooldown -8%",
	"人脉名片": "Business Cards",
	"拾取范围 +30%": "Pickup range +30%",
	"工位绿植": "Desk Plant",
	"每秒回复 0.3 生命": "Regenerate 0.3 HP/s",
	"摸鱼一会儿": "Slack Off",
	"回复 30 生命": "Heal 30 HP",
}

static var _registered := false


## Registers the English table and applies the saved language, or Chinese for anyone who
## hasn't picked one: the game is made for Chinese players first.
static func setup() -> void:
	if _registered:
		return
	_registered = true
	var english := Translation.new()
	english.locale = "en"
	for source: String in EN:
		english.add_message(source, EN[source])
	TranslationServer.add_translation(english)
	var saved: String = Settings.get_value("language", "")
	apply(saved if saved in LANGUAGES else "zh")


static func current() -> String:
	return "en" if TranslationServer.get_locale().begins_with("en") else "zh"


## Switches the language without saving it (the smoke test uses this directly).
static func apply(code: String) -> void:
	TranslationServer.set_locale(code)
	# On the web this is the tab title.
	DisplayServer.window_set_title(TranslationServer.translate("硅谷幸存者"))


static func choose(code: String) -> void:
	apply(code)
	Settings.set_value("language", code)


## Big numbers the way each language groups them: 万 (10k) in Chinese, k in English.
static func short_number(amount: float) -> String:
	if current() == "zh" and amount >= 10000.0:
		return "%.1f万" % (amount / 10000.0)
	if current() == "en" and amount >= 10000.0:
		return "%.1fk" % (amount / 1000.0)
	return str(roundi(amount))
