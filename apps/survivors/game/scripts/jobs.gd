class_name Jobs
extends RefCounted
## The five jobs a run can be played as. Each starts with a weapon only it can carry and has its
## own build; that is all that sets them apart (a damage bonus for the job's weapon type and the
## data scientist's uncapped weapon slots came and went in .9-.12, at the user's call).
##
## The programmer stays the plain one on purpose: it is what a first run defaults to, so new
## players learn the game on the simplest weapon.

const DEFAULT := "coder"
## Title screen order.
const ORDER := ["coder", "pm", "designer", "ops", "data_scientist"]

const JOBS := {
	"coder": {"name": "程序员", "art": "coder", "weapon": "enter",
		"hp": 100.0, "armor": 0.0, "speed": 62.0,
		"pitch": "保持距离点射，最好上手"},
	"pm": {"name": "产品经理", "art": "pm", "weapon": "prd",
		"hp": 120.0, "armor": 1.0, "speed": 59.0,
		"pitch": "冲进怪堆抡，把怪推开、定住"},
	"designer": {"name": "设计师", "art": "designer", "weapon": "poke",
		"hp": 90.0, "armor": 0.0, "speed": 71.0,
		"pitch": "数位笔朝前一路戳，越升戳得越多越密"},
	"ops": {"name": "运维", "art": "ops", "weapon": "firewall",
		"hp": 130.0, "armor": 1.0, "speed": 56.0,
		"pitch": "站得住：墙绕身转着打，召唤物替你打"},
	"data_scientist": {"name": "数据科学家", "art": "data_scientist", "weapon": "guides",
		"hp": 100.0, "armor": 0.0, "speed": 62.0,
		"pitch": "拉出横竖坐标轴，跑位把怪引到轴上"},
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

