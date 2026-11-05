class_name Jobs
extends RefCounted
## The five jobs a run can be played as. Each starts with a weapon only it can carry and has its
## own build; that is all that sets them apart (a damage bonus for the job's weapon type and the
## data scientist's uncapped weapon slots came and went in .9-.12, at the user's call).
##
## The programmer stays the plain one on purpose: it is what a first run defaults to, so new
## players learn the game on the simplest weapon.
##
## The build follows one rule (.39, the user's call): every job starts with 100 health, the
## close-range ones (激光笔, 抽样) get armor 2 and speed 60, the far-reaching ones (回车键, 网格线)
## armor 0 and speed 66 (.41: the designer and the data scientist swapped weapons back, the user
## wanting the designer to be the ranged one; .14 had swapped them the other way), and the ops, whose walls guard round them but fly out to hit, half of
## each: armor 1, speed 63 (.40). Luck starts at 0 for everyone.
##
## `lines` is the job's trash talk, said over the player when its own weapon lands a hit
## (Game._taunt). The product manager's came first (.9), the rest followed at the user's ask.

const DEFAULT := "coder"
## Title screen order.
const ORDER := ["coder", "pm", "designer", "ops", "data_scientist"]

const JOBS := {
	"coder": {"name": "程序员", "art": "coder", "weapon": "enter",
		"hp": 100.0, "armor": 0.0, "speed": 66.0,
		"pitch": "保持距离点射，最好上手",
		"lines": ["我本地能跑", "重启试试", "LGTM", "这是 feature", "谁写的这坨", "回滚！"]},
	"pm": {"name": "产品经理", "art": "pm", "weapon": "prd",
		"hp": 100.0, "armor": 2.0, "speed": 60.0,
		"pitch": "冲进怪堆扫，一下打一片",
		"lines": ["改个需求", "这个很简单", "明天能上吗", "加个按钮", "对齐一下", "用户要的", "先上线再说", "大家看这页"]},
	"designer": {"name": "设计师", "art": "designer", "weapon": "guides",
		"hp": 100.0, "armor": 0.0, "speed": 66.0,
		"pitch": "拉出网格线，跑位把怪引到线上",
		"lines": ["再大一点", "五彩斑斓的黑", "留白懂吗", "还是第一版好", "像素没对齐", "要有呼吸感"]},
	"ops": {"name": "运维", "art": "ops", "weapon": "firewall",
		"hp": 100.0, "armor": 1.0, "speed": 63.0,
		"pitch": "站得住：墙护着身边，召唤物替你打",
		"lines": ["拒绝访问", "403", "已拉黑", "别碰生产", "限流了", "谁动了配置"]},
	"data_scientist": {"name": "数据科学家", "art": "data_scientist", "weapon": "poke",
		"hp": 100.0, "armor": 2.0, "speed": 60.0,
		"pitch": "贴着怪一针针扎，专挑离你最近的抽样",
		# 便利抽样 (convenience sampling) owns up to the weapon always taking the nearest one.
		"lines": ["显著了", "p < 0.05", "样本太少", "相关非因果", "过拟合了", "看大盘", "便利抽样"]},
}

## Each job's 大招 (.81, the user's design: 一个主动，一局放一次; the numbers are ours): its name,
## the line shouted as it goes off, and what it does, for the button, the job card and the site.
## Since .93 (the user: 每个职业的技能都给个教学或者提示啥的吧，或者加一下无敌和无敌的倒计时，现在的实现
## 太粗糙了，没有人知道发生了什么) also `brief`, what it does in a line short enough for the banner
## as it goes off, the job card and the first-boss hint; and `timer`, the word over the countdown
## while it lasts (none for the programmer's, over at once).
## Ultimates does the work.
const ULTIMATES := {
	"coder": {"name": "全量发布", "line": "Shift+Enter！", "brief": "朝 12 个钟点方向各射一个回车键，穿透所有怪", "timer": "", "text": "朝 12 个钟点方向各射出一个回车键，伤害和回车键一样，穿透所有怪"},
	"pm": {"name": "今天必须上线", "line": "今天必须上线！", "brief": "5 秒无敌，移速 +50%", "timer": "无敌", "text": "5 秒内不受伤害，移速 +50%"},
	"designer": {"name": "复制图层", "line": "Ctrl+J", "brief": "分身带着你的全部武器，最多 5 秒", "timer": "分身", "text": "出现一个带着你全部武器和属性的分身，会自己躲怪，会受伤，最多 5 秒"},
	"ops": {"name": "扩容", "line": "扩容！", "brief": "服务器朝附近的怪开炮 10 秒", "timer": "服务器", "text": "放下一台服务器，10 秒里朝附近的怪开炮，伤害和防火墙一样，怪不会打它"},
	"data_scientist": {"name": "改标签", "line": "重新标注！", "brief": "身边最多 10 只小怪变成自己人，最多 20 秒", "timer": "自己人", "text": "身边最多 10 只小怪变成自己人，去打别的怪，伤害不变，死了就没了，最多 20 秒"},
}

## Weapon types: card tag colours (tint, text) and names.
const TYPES := {
	"shoot": {"name": "射击", "fill": Color("e5f0fb"), "ink": Color("2f6fb0")},
	"melee": {"name": "近战", "fill": Color("fde6e8"), "ink": Color("b23344")},
	"area": {"name": "区域", "fill": Color("e3f4ea"), "ink": Color("276b43")},
	"summon": {"name": "召唤", "fill": Color("efeafb"), "ink": Color("5a4a9c")},
}

## Weapon slots, the same for every job.
const MAX_WEAPONS := 6

## The job picked last on this device (the title screen remembers it), or the programmer.
static func saved() -> String:
	var job: String = Settings.get_value("job", DEFAULT)
	return job if JOBS.has(job) else DEFAULT


static func data(job: String) -> Dictionary:
	return JOBS.get(job, JOBS[DEFAULT])


static func ultimate(job: String) -> Dictionary:
	return ULTIMATES.get(job, ULTIMATES[DEFAULT])

