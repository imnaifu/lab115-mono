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
	"按数字键或点卡片选择": "Press a number key or tap a card",
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
	"生成战绩图": "Result Image",
	"推荐": "TOP PICK",
	"下一个 boss %s": "Next boss %s",
	"按住屏幕任意位置拖动，就能移动": "Touch anywhere and drag to move",
	"用 WASD 或方向键移动": "Move with WASD or the arrow keys",
	# Difficulty
	"实习生": "Intern",
	"正式员工": "Full-timer",
	"怪更脆、打人更轻，boss 最多同时 2 个": "Softer enemies, lighter hits, at most 2 bosses at once",
	"标准难度": "The standard game",
	"怪血 +50%、打人更痛，boss 招式更勤": "Enemy HP +50%, harder hits, bosses use moves more often",
	"难度": "Difficulty",
	# Funding bag
	"融资开奖！": "Funding Round!",
	"天使轮": "Angel",
	"A 轮": "Series A",
	"收下": "Take It",
	# Card numbers
	"伤害": "Damage",
	"数量": "Count",
	"穿透": "Pierce",
	"范围": "Area",
	"速度": "Speed",
	"大小": "Size",
	"间隔": "Every",
	"护甲": "Armor",
	"生命上限": "Max HP",
	"移速": "Speed",
	"冷却": "Cooldown",
	"拾取": "Pickup",
	"回血": "Regen",
	"每分钟伤害": "Damage per minute",
	"反伤": "Blast",
	"爆炸几率": "Blast chance",
	"炮台几率": "Turret chance",
	"站会间隔": "Every",
	"午休回血": "Nap heal",
	"选项": "Choices",
	"%s 秒": "%ss",
	"%s/秒": "%s/s",
	# End-of-run advice
	"太轻松？在下面换成「%s」试试": "Too easy? Try %s below",
	"觉得难？在下面换成「%s」试试": "Too hard? Try %s below",
	"换难度会马上重开一局": "Changing it starts a new run right away",
	"只有 %d 把武器？前期先拿武器卡，清怪快经验才多": "Only %d weapons? Take weapon cards early: faster kills, more XP",
	"被 %d 个 boss 围住了：边走边打，别停在原地": "Surrounded by %d bosses: keep moving while you fight",
	"boss 出招前会画出范围，看到就往旁边躲": "Bosses mark their moves before they hit: step aside when you see one",
	"多走动，去捡星星升级": "Keep moving and grab stars to level up",
	"试试多拿撸铁或降噪耳机，更抗揍": "Try more Lifting or ANC Headphones to take more hits",
	# Result image
	"长按图片保存，或发给朋友": "Press and hold the image to save or send it",
	"右键图片可以另存为": "Right-click the image to save it",
	"分享": "Share",
	"保存图片": "Save Image",
	"关闭": "Close",
	"职级": "Grade",
	"撑满 10 分钟，敲钟上市": "Lasted 10 minutes and rang the IPO bell",
	"被「%s」带走": "Taken out by %s",
	"倒在了工位上": "Collapsed at the desk",
	"最强武器": "Best weapon",
	"扫码一起来搬砖": "Scan to clock in",
	"躲开 Bug、会议和 Deadline": "Dodge bugs, meetings and deadlines",
	"死于 Deadline。经典。": "Killed by a Deadline. Classic.",
	"被裁员通知带走，N+1 都没拿到": "Laid off, and not even a severance package",
	"吃了老板画的饼，然后倒下了": "Ate the boss's empty promises, then fell over",
	"被屎山代码埋了": "Buried under spaghetti code",
	"开会开死了": "Meetinged to death",
	"被技术债压垮了": "Crushed by tech debt",
	"需求又变了，人没了": "The scope changed again, and so did the headcount",
	"P0 事故，背锅下岗": "P0 incident: took the blame, lost the job",
	"上市敲钟，期权终于能卖了": "IPO day: the options can finally be sold",
	"活过了 10 分钟，比大多数创业公司都久": "Lasted 10 minutes, longer than most startups",
	"建议把这段写进简历": "Put this on the résumé",
	"试用期都没过": "Didn't make it through probation",
	"入职第一天就被优化了": "Optimized away on day one",
	"倒在了 IPO 前夜": "Fell on the eve of the IPO",
	"就差最后几分钟，可惜": "So close to the end",
	"差一点就上市了，再融一轮？": "Almost made it. Raise another round?",
	"项目黄了，但经验还在": "The startup folded, but the experience stays",
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
	"磁铁！全图经验飞过来了": "Magnet! All the XP flies to you",
	"捡星星升级！走近就会自动吸过来": "Grab stars to level up! Walk close and they fly to you",
	"消息轰炸！": "Notification storm!",
	"Deadline 逼近！": "A Deadline approaches!",
	"Bug 大爆发！": "Bug outbreak!",
	"首领出现：AI 大模型": "Boss: the Giant AI Model",
	"404 幽灵合围！": "404 ghosts close in!",
	"消息轰炸 ×2！": "Notification storm ×2!",
	"精英怪：祖传技术债！": "Elite: Legacy Tech Debt!",
	"精英怪：主库宕机！": "Elite: Prod DB Down!",
	"首领出现：裁员通知": "Boss: the Layoff Notice",
	"首领出现：投资人": "Boss: the Investor",
	"首领出现：屎山代码": "Boss: Spaghetti Code",
	"需求变更！": "Scope change!",
	"P0 线上事故！": "P0 incident!",
	"最后的考验：老板画饼 + AI 大模型": "Final test: Empty Promises + the Giant AI Model",
	# Districts (the minimap's caption)
	"硅谷": "Silicon Valley",
	"旧金山": "San Francisco",
	"圣何塞": "San Jose",
	"山区": "The Hills",
	"海湾": "The Bay",
	"海滩": "The Beach",
	# Enemies
	"消息红点": "Notification",
	"未读邮件": "Unread Mail",
	"会议邀请": "Meeting Invite",
	"404 幽灵": "404 Ghost",
	"技术债": "Tech Debt",
	"宕机服务器": "Crashed Server",
	"AI 大模型": "Giant AI Model",
	"祖传技术债": "Legacy Tech Debt",
	"主库宕机": "Prod DB Down",
	"裁员通知": "Layoff Notice",
	"投资人": "The Investor",
	"屎山代码": "Spaghetti Code",
	"小屎山": "Spaghetti Chunk",
	"需求变更": "Scope Change",
	"P0 线上事故": "P0 Incident",
	"老板画饼": "Empty Promises",
	# Weapons
	"回车键": "Enter Key",
	"自动敲向最近的敌人": "Fires at the nearest enemy",
	"每轮多敲一下": "One more press per burst",
	"伤害 +6": "Damage +6",
	"穿透 +2，伤害 +6": "Pierce +2, damage +6",
	"复制粘贴": "Copy & Paste",
	"朝面向的方向连发文件，能穿过敌人": "Fires files the way you face, through enemies",
	"伤害 +4": "Damage +4",
	"多粘贴一份": "One more copy",
	"多粘贴一份，出手更快，穿透 +1": "One more copy, fires faster, pierce +1",
	"无人机": "Drone",
	"飞出去追着附近的敌人撞": "Flies off and rams nearby enemies",
	"多一架无人机": "One more drone",
	"伤害 +4，飞得更快": "Damage +4, flies faster",
	"多一架，伤害 +4，飞得更快": "One more, damage +4, flies faster",
	"云端部署": "Cloud Deploy",
	"从云上劈中屏幕里的敌人": "Strikes on-screen enemies from the cloud",
	"多劈一道": "One more strike",
	"伤害 +6，冷却更短": "Damage +6, shorter cooldown",
	"多劈一道，范围变大": "One more strike, bigger splash",
	"多劈一道，伤害 +6，冷却更短": "One more strike, damage +6, shorter cooldown",
	"机械键盘": "Mech Keyboard",
	"往上一抛，落下砸穿一切": "Tossed up, smashes through everything",
	"多抛一把": "One more toss",
	"伤害 +10": "Damage +10",
	"伤害 +10，键盘变大": "Damage +10, bigger keyboard",
	"Wi-Fi 信号": "Wi-Fi Signal",
	"持续伤害身边的敌人": "Keeps hurting enemies around you",
	"信号范围变大": "Wider signal",
	"伤害 +3，频率更高": "Damage +3, ticks faster",
	"伤害 +4，范围更大，频率更高": "Damage +4, wider, ticks faster",
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
	"股票期权": "Stock Options",
	"每撑过 1 分钟，伤害再 +2%（越早拿越赚）": "Every minute survived, +2% damage (the earlier, the more it vests)",
	"背锅侠": "Scapegoat",
	"挨打时把锅甩出去，炸伤身边的怪": "When hit, pass the blame: blasts enemies around you",
	"降本增效": "Cost Cutting",
	"打死的怪有几率爆炸，还能连环炸": "Killed enemies may explode, and set off a chain",
	"开源项目": "Open Source",
	"打死怪有几率留下小炮台，自动打怪 8 秒": "Kills may leave a mini turret that fires for 8s",
	"站会": "Stand-up",
	"每隔一阵开站会，震开并定住身边的怪": "Every so often, a stand-up knocks back and stuns enemies near you",
	"午休": "Nap Time",
	"站着不动 1 秒后，快速回血": "Stand still for 1s to heal fast",
	"猎头电话": "Headhunter Call",
	"升级时多 1 个选项": "One more choice at each level-up",
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
