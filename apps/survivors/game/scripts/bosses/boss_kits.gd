class_name BossKits
extends RefCounted
## The bosses (.45, the user's design, docs/boss设计.html): four a map, at 2:00, 4:00, 6:00 and
## 8:00 (the map's BOSSES), each with one attack of one of three kinds, 近战 (melee: the boss moves
## itself, MeleeAttack), 定点 (placed: red shapes on the ground that go off, PlacedAttack) and 远程
## (ranged: bullets, RangedAttack). The first three bosses of a map are one kind each; the last,
## at 8:00, has two attacks of two kinds and takes them in turn, and from 9:00 is in its second
## phase: its attacks reach further, cover more, fire more (`phase2`, per attack). Nothing is
## random: a boss walks at the player WALK_SECONDS, attacks, walks again, always in the same order,
## and aims at where the player is when it starts. Every red shape is shown for long enough to walk
## out of it at the slowest job's speed (60), with a fifth of a second to spare.
##
## An attack's numbers are its design's; damage is before the map's multiplier (Enemy._hits).
## `lines` are its bubbles: on arrival, with every ATTACK_LINE_EVERY-th attack (per attack), at
## 9:00, on killing the player (the result screen) and on going down.

## When each of a map's four bosses comes (Spawner): 2:00, 4:00, 6:00, 8:00.
const SLOT_AT := [120.0, 240.0, 360.0, 480.0]
## The last boss's second phase.
const PHASE_TWO_AT := 540.0
## Before its second phase it stands still and can't be hurt for this long, and says so.
const PHASE_TWO_GUARD := 1.0
## Walking between attacks; counted only while it is on screen, so it never attacks from off it.
const WALK_SECONDS := 3.0
## Between attacks in 加班 (Game.OVERTIME_STEP, past 10:00).
const OVERTIME_WALK_SECONDS := 2.0
const LINE_SECONDS := 2.2
const ATTACK_LINE_EVERY := 3

## Each slot's numbers, before the map's and the minute's health multipliers (Spawner.hp_scale).
## Speed 42-44 from .76 (the user: boss 移动速度快一点，这样能更好的打到 boss; 30-32 before): near
## the player a boss walks at it, as quick as the quicker crowd, so it no longer drops behind the
## crowd, and still under the slowest job's 60.
const SLOT_STATS := [
	{"hp": 600.0, "speed": 42.0, "damage": 12.0, "xp": 30},
	{"hp": 1400.0, "speed": 42.0, "damage": 20.0, "xp": 60},
	{"hp": 2200.0, "speed": 44.0, "damage": 24.0, "xp": 90},
	{"hp": 3000.0, "speed": 42.0, "damage": 26.0, "xp": 100},
]

## How each attack's shape is dodged, said at the bottom the first time it comes up in a run
## (Hud) and in the 图鉴.
const HINTS := {
	"dash": "红带是它要冲的路线，横着躲开",
	"sweep": "红色扇形要扫过来，退出扇形",
	"leap": "红圈是它要落下的地方，走出去",
	"slam": "它会冲到你跟前，脚下的红圈填满就炸，退到圈外",
	"chain": "红圈一个接一个落在脚下，一直往前走",
	"bigcircle": "脚下的大红圈要砸下来，赶紧走出去",
	"bigsquare": "脚下的大红块要拍下来，赶紧走出去",
	"lead": "红框落在你要走到的地方，拐个弯",
	"cross": "红叉要落下来，横着或竖着走一步",
	"plus": "五个红圈摆成十字，斜着走出去",
	"checker": "红格要落下来，走到旁边的白格",
	"aimed": "红线是弹道，侧移躲开",
	"spread": "扇形弹要来了，站到两发之间或走出扇形",
	"ring": "一圈弹往外飞，钻缝躲开",
	"spiral": "它边转边甩，顺着它转的方向走",
	"homing": "追踪弹比你快，贴近时急转弯甩掉它",
}
const KIND_NAMES := {"melee": "近战", "placed": "定点", "ranged": "远程"}

const KITS := {
	# 硅谷: 近战 → 定点 → 远程; the last 定点 + 远程.
	"deadline": {
		"attacks": [{"kind": "melee", "form": "dash", "name": "冲刺", "width": 28.0, "length": 180.0, "warn": 1.0, "damage": 15.0}],
		"lines": {"arrive": "明天上线，没得商量", "attack": ["冲刺！"], "kill": "项目延期，责任在你", "death": "…那就下个季度吧"},
	},
	"server_elite": {
		# .46: 4 circles of 35 → 3 of 30, the user found it too hard (the bots died most at 4:00).
		"attacks": [{"kind": "placed", "form": "chain", "name": "级联故障", "count": 3, "every": 0.5, "radius": 30.0, "fuse": 1.2, "damage": 15.0}],
		"lines": {"arrive": "主库挂了，全员救火", "attack": ["备库也挂了"], "kill": "P0 事故报告里有你", "death": "恢复了，复盘会明天开"},
	},
	"ai": {
		"attacks": [{"kind": "ranged", "form": "aimed", "name": "流式输出", "warn": 0.8, "count": 6, "every": 0.1, "speed": 140.0, "damage": 5.0}],
		"lines": {"arrive": "我可以替代你", "attack": ["正在生成…"], "kill": "已生成最优解", "death": "正在重新训练…"},
	},
	"pie_boss": {
		"attacks": [
			{"kind": "placed", "form": "bigcircle", "name": "画饼", "radius": 60.0, "fuse": 1.8, "damage": 20.0},
			{"kind": "ranged", "form": "ring", "name": "发期权", "warn": 0.6, "count": 16, "rings": 1, "every": 0.5, "speed": 70.0, "damage": 8.0},
		],
		"phase2": [{"radius": 80.0}, {"rings": 2}],
		"lines": {"arrive": "等公司上市，你就财务自由了", "attack": ["这个饼很大", "人人有期权"], "phase2": "期权要再等四年",
			"kill": "你不适合创业", "death": "散了吧，下一个项目见"},
	},
	# 伦敦: 定点 → 近战 → 远程; the last 近战 + 定点.
	"committee": {
		"attacks": [{"kind": "placed", "form": "lead", "name": "替你拍板", "count": 1, "every": 0.6, "ahead": 1.0, "radius": 40.0, "fuse": 1.2, "damage": 15.0}],
		"lines": {"arrive": "此事需提交委员会审议", "attack": ["已经替你决定好了"], "kill": "全票通过", "death": "本次会议休会"},
	},
	"redundancy": {
		"attacks": [{"kind": "melee", "form": "sweep", "name": "一刀切", "radius": 80.0, "angle": 100.0, "warn": 1.0, "damage": 15.0}],
		"lines": {"arrive": "Hi，约你 15 分钟聊聊", "attack": ["一刀切"], "kill": "请把工牌留在前台", "death": "这份通知发错人了"},
	},
	"gdpr": {
		"attacks": [{"kind": "ranged", "form": "spread", "name": "群发告知书", "warn": 0.6, "count": 5, "step": 15.0, "speed": 110.0, "damage": 8.0}],
		"lines": {"arrive": "你的数据要审查一下", "attack": ["请查收告知书"], "kill": "违规，罚款 4%", "death": "已依法删除"},
	},
	"scone_boss": {
		"attacks": [
			{"kind": "melee", "form": "leap", "name": "拍拍肩", "radius": 45.0, "warn": 1.3, "damage": 18.0},
			{"kind": "placed", "form": "plus", "name": "一盘司康", "radius": 28.0, "spacing": 55.0, "fuse": 1.2, "damage": 15.0},
		],
		"phase2": [{"radius": 60.0}, {"radius": 38.0, "spacing": 70.0}],
		"lines": {"arrive": "来，喝杯茶，聊聊", "attack": ["我们聊聊你的发展", "尝尝司康"], "phase2": "这不是绩效问题，是文化契合",
			"kill": "我们会想念你的", "death": "那…下周再约个茶"},
	},
	# 西雅图: 近战 → 远程 → 定点; the last 近战 + 远程.
	"monolith": {
		"attacks": [{"kind": "melee", "form": "slam", "name": "全量重启", "radius": 60.0, "warn": 1.1, "damage": 15.0}],
		"lines": {"arrive": "十年没拆过，谁敢动", "attack": ["全量重启"], "kill": "回滚失败", "death": "…终于拆成微服务了"},
	},
	"meeting_spam": {
		# .97 (the user: 连环会这个 boss 子弹太难躲了; picked 甲): turning 70 → 50° a second (a sidestep
		# shakes one off: it curves round about 97 px, not 70) and gone after 3 s, not 4. Still
		# faster than any job, so running straight on is still caught.
		# 0.3.4 (the user: 连环会这个再容易躲一点，现在子弹跟的太紧了; picked 慢一点 + 转得更慢): 85 → 72 a second, a
		# touch over the fastest job's 66, and 50 → 40° a second, so more time to see them coming and a
		# wider curve round (about 103 px).
		"attacks": [{"kind": "ranged", "form": "homing", "name": "连环邀请", "warn": 0.6, "count": 3, "every": 0.4, "speed": 72.0, "turn": 40.0, "life": 3.0, "damage": 8.0}],
		"lines": {"arrive": "下一个会马上开始", "attack": ["已向你发送邀请"], "kill": "你已被加入 37 个会议", "death": "会议已取消"},
	},
	"pip": {
		"attacks": [{"kind": "placed", "form": "cross", "name": "打叉", "width": 30.0, "length": 300.0, "fuse": 1.2, "damage": 18.0}],
		"lines": {"arrive": "我们需要谈谈你的表现", "attack": ["这里不达标"], "kill": "改进计划未通过", "death": "目标达成，计划关闭"},
	},
	"all_hands": {
		"attacks": [
			{"kind": "melee", "form": "dash", "name": "Day 1 冲刺", "width": 32.0, "length": 200.0, "warn": 1.0, "damage": 20.0},
			{"kind": "ranged", "form": "ring", "name": "全员信", "warn": 0.6, "count": 20, "rings": 1, "every": 0.5, "speed": 80.0, "damage": 8.0},
		],
		"phase2": [{"width": 48.0, "length": 280.0}, {"rings": 2}],
		"lines": {"arrive": "今天依然是 Day 1", "attack": ["Bias for Action！", "请大家查收全员信"], "phase2": "明年我们要更节俭",
			"kill": "感谢你的贡献", "death": "会后 Q&A…取消了"},
	},
	# 新加坡: 定点 → 远程 → 近战; the last 定点 + 远程.
	"forms": {
		"attacks": [{"kind": "placed", "form": "checker", "name": "填表", "cell": 40.0, "fuse": 1.2, "damage": 15.0}],
		"lines": {"arrive": "先把这几张表填一下", "attack": ["这格不能空着"], "kill": "材料不全，退回", "death": "审批通过"},
	},
	"apac_cut": {
		"attacks": [{"kind": "ranged", "form": "spread", "name": "区域合并", "warn": 0.6, "count": 7, "step": 12.0, "speed": 120.0, "damage": 8.0}],
		"lines": {"arrive": "总部决定优化亚太区", "attack": ["合并团队"], "kill": "你的岗位转回国内了", "death": "优化已完成"},
	},
	"parachute_boss": {
		"attacks": [{"kind": "melee", "form": "leap", "name": "空降", "radius": 45.0, "warn": 1.1, "damage": 18.0}],
		"lines": {"arrive": "我是总部派来的", "attack": ["空降！"], "kill": "我带了自己的团队", "death": "…我回总部了"},
	},
	"kaya_boss": {
		"attacks": [
			{"kind": "placed", "form": "bigsquare", "name": "画吐司", "half": 55.0, "fuse": 1.8, "damage": 20.0},
			{"kind": "ranged", "form": "spiral", "name": "抹咖椰", "warn": 0.6, "seconds": 2.0, "every": 0.08, "arms": 1, "speed": 90.0, "damage": 8.0},
		],
		"phase2": [{"half": 75.0}, {"arms": 2}],
		"lines": {"arrive": "明年亚太区翻倍增长", "attack": ["这片吐司很大", "每个人都有份"], "phase2": "增长目标再加一倍",
			"kill": "你缺少 ownership", "death": "先吃早饭吧"},
	},
	# 北京: 远程 → 定点 → 近战; the last 近战 + 定点.
	"juanwang": {
		"attacks": [{"kind": "ranged", "form": "spiral", "name": "内卷", "warn": 0.6, "seconds": 2.0, "every": 0.1, "arms": 1, "speed": 90.0, "damage": 6.0}],
		"lines": {"arrive": "凌晨两点我还在线", "attack": ["卷起来"], "kill": "你被卷没了", "death": "…今天先卷到这"},
	},
	"ppt": {
		"attacks": [{"kind": "placed", "form": "lead", "name": "下一页", "count": 3, "every": 0.6, "ahead": 1.0, "size": Vector2(60.0, 40.0), "fuse": 1.2, "damage": 15.0}],
		"lines": {"arrive": "请用 PPT 讲讲你的价值", "attack": ["下一页"], "kill": "抓手不够，闭环没打通", "death": "感谢聆听"},
	},
	"elimination": {
		"attacks": [{"kind": "melee", "form": "slam", "name": "圈名单", "radius": 70.0, "warn": 1.2, "damage": 18.0}],
		"lines": {"arrive": "这次要淘汰 10%", "attack": ["圈名单"], "kill": "你在线下面", "death": "本季度不淘汰了"},
	},
	"annual_party": {
		"attacks": [
			{"kind": "melee", "form": "dash", "name": "再冲一年", "width": 32.0, "length": 220.0, "warn": 1.0, "damage": 20.0},
			{"kind": "placed", "form": "chain", "name": "放鞭炮", "count": 8, "every": 0.25, "radius": 25.0, "fuse": 1.0, "damage": 10.0},
		],
		"phase2": [{"width": 50.0, "length": 300.0}, {"radius": 38.0}],
		"lines": {"arrive": "感谢大家这一年的奋斗", "attack": ["明年再冲一把", "放鞭炮！"], "phase2": "年终奖，明年发",
			"kill": "这份福报给你了", "death": "…抽奖开始吧"},
	},
}


static func has(type_id: String) -> bool:
	return KITS.has(type_id)


## The attack objects for a boss, in the order it takes them.
static func create_attacks(type_id: String, enemy: Enemy) -> Array[BossAttack]:
	var attacks: Array[BossAttack] = []
	for config: Dictionary in KITS[type_id]["attacks"]:
		var attack: BossAttack
		match config["kind"]:
			"melee":
				attack = MeleeAttack.new()
			"placed":
				attack = PlacedAttack.new()
			_:
				attack = RangedAttack.new()
		attack.enemy = enemy
		attack.config = config.duplicate()
		attacks.append(attack)
	return attacks


## Which slot (0–3) a boss comes in on its map, or -1.
static func slot_of(type_id: String) -> int:
	# Every map's, hidden or not: since .99 any map's boss can come to 硅谷 at its slot.
	for map_id: String in Maps.ALL:
		var index: int = (Maps.script_of(map_id).BOSSES as Array).find(type_id)
		if index >= 0:
			return index
	return -1


## What a boss does, for the 图鉴 and the site: each attack's kind, name and how to dodge it.
static func describe(type_id: String) -> Array:
	var described := []
	for config: Dictionary in KITS[type_id]["attacks"]:
		described.append({"kind": KIND_NAMES[config["kind"]], "name": config["name"], "form": config["form"], "hint": HINTS[config["form"]]})
	return described
