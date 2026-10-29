class_name Jobs
extends RefCounted
## The five jobs a run can be played as. Each starts with a weapon only it can carry, is better
## with one type of weapon (专精: that type deals more and turns up more often at level-ups),
## and has its own build. The data scientist is the exception:
## no favourite type, but no cap on weapons either (多开实验, Brotato's Multitasker).
##
## The programmer stays the plain one on purpose: it is what a first run defaults to, so new
## players learn the game on the simplest weapon.

const DEFAULT := "coder"
## Title screen order.
const ORDER := ["coder", "pm", "designer", "ops", "data_scientist"]

const JOBS := {
	"coder": {"name": "程序员", "art": "coder", "weapon": "enter", "type": "shoot",
		"hp": 100.0, "armor": 0.0, "speed": 62.0,
		"pitch": "保持距离点射，最好上手"},
	"pm": {"name": "产品经理", "art": "pm", "weapon": "prd", "type": "melee",
		"hp": 120.0, "armor": 1.0, "speed": 59.0,
		"pitch": "冲进怪堆抡，把怪推开、定住"},
	"designer": {"name": "设计师", "art": "designer", "weapon": "guides", "type": "area",
		"hp": 90.0, "armor": 0.0, "speed": 71.0,
		"pitch": "拉出横竖参考线，跑位把怪引到线上"},
	"ops": {"name": "运维", "art": "ops", "weapon": "firewall", "type": "summon",
		"hp": 130.0, "armor": 1.0, "speed": 56.0,
		"pitch": "站得住：墙绕身转着打，召唤物替你打"},
	"data_scientist": {"name": "数据科学家", "art": "data_scientist", "weapon": "poke", "type": "",
		"hp": 100.0, "armor": 0.0, "speed": 62.0, "multitask": true,
		"pitch": "围着自己来回戳着埋点，什么武器都拿"},
}

## Weapon types: card tag colours (tint, text) and names.
const TYPES := {
	"shoot": {"name": "射击", "fill": Color("e5f0fb"), "ink": Color("2f6fb0")},
	"melee": {"name": "近战", "fill": Color("fde6e8"), "ink": Color("b23344")},
	"area": {"name": "区域", "fill": Color("e3f4ea"), "ink": Color("276b43")},
	"summon": {"name": "召唤", "fill": Color("efeafb"), "ink": Color("5a4a9c")},
}

## 专精: weapons of the job's type hit this much harder and are this much likelier on cards.
const SPECIALTY_DAMAGE := 1.2
const SPECIALTY_WEIGHT := 1.5
## Weapon slots for everyone but the data scientist, who can carry every weapon it can get.
const MAX_WEAPONS := 6
## 多开实验: +20% damage to start with, -5% for every weapon carried.
const MULTITASK_BONUS := 0.2
const MULTITASK_PER_WEAPON := 0.05

## The job picked last on this device (the title screen remembers it), or the programmer.
static func saved() -> String:
	var job: String = Settings.get_value("job", DEFAULT)
	return job if JOBS.has(job) else DEFAULT


static func data(job: String) -> Dictionary:
	return JOBS.get(job, JOBS[DEFAULT])


static func max_weapons(job: String) -> int:
	return 99 if data(job).get("multitask", false) else MAX_WEAPONS
