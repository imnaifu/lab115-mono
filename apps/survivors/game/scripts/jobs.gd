class_name Jobs
extends RefCounted
## The five jobs a run can be played as. Each starts with a weapon only it can carry and has its
## own build; that is all that sets them apart (a damage bonus for the job's weapon type and the
## data scientist's uncapped weapon slots came and went in .9-.12, at the user's call).
##
## The programmer stays the plain one on purpose: it is what a first run defaults to, so new
## players learn the game on the simplest weapon.
##
## `lines` is the job's trash talk, said over the player when its own weapon lands a hit
## (Game._taunt). The product manager's came first (.9), the rest followed at the user's ask.

const DEFAULT := "coder"
## Title screen order.
const ORDER := ["coder", "pm", "designer", "ops", "data_scientist"]

const JOBS := {
	"coder": {"name": "程序员", "art": "coder", "weapon": "enter",
		"hp": 100.0, "armor": 0.0, "speed": 62.0,
		"pitch": "保持距离点射，最好上手",
		"lines": ["我本地能跑", "重启试试", "LGTM", "这是 feature", "谁写的这坨", "回滚！"]},
	"pm": {"name": "产品经理", "art": "pm", "weapon": "prd",
		"hp": 120.0, "armor": 1.0, "speed": 59.0,
		"pitch": "冲进怪堆抡，把怪推开、定住",
		"lines": ["改个需求", "这个很简单", "明天能上吗", "加个按钮", "对齐一下", "用户要的", "先上线再说"]},
	"designer": {"name": "设计师", "art": "designer", "weapon": "poke",
		"hp": 90.0, "armor": 0.0, "speed": 71.0,
		"pitch": "数位笔朝前一路戳，越升戳得越多越密",
		"lines": ["再大一点", "五彩斑斓的黑", "留白懂吗", "还是第一版好", "像素没对齐", "要有呼吸感"]},
	"ops": {"name": "运维", "art": "ops", "weapon": "firewall",
		"hp": 130.0, "armor": 1.0, "speed": 56.0,
		"pitch": "站得住：墙护着身边，召唤物替你打",
		"lines": ["拒绝访问", "403", "已拉黑", "别碰生产", "限流了", "谁动了配置"]},
	"data_scientist": {"name": "数据科学家", "art": "data_scientist", "weapon": "guides",
		"hp": 100.0, "armor": 0.0, "speed": 62.0,
		"pitch": "拉出横竖坐标轴，跑位把怪引到轴上",
		"lines": ["显著了", "p < 0.05", "样本太少", "相关非因果", "过拟合了", "看大盘"]},
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

