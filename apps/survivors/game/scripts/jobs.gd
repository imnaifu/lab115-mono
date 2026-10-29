class_name Jobs
extends RefCounted
## The five jobs a run can be played as. Each starts with a weapon only it can carry, is better
## with one type of weapon (专精: that type deals more and turns up more often at level-ups),
## and has its own build and an ultimate charged by kills. The data scientist is the exception:
## no favourite type, but no cap on weapons either (多开实验, Brotato's Multitasker).
##
## The programmer stays the plain one on purpose: it is what a first run defaults to, so new
## players learn the game on the simplest weapon.

const DEFAULT := "coder"
## Title screen order.
const ORDER := ["coder", "pm", "designer", "ops", "data_scientist"]

const JOBS := {
	"coder": {"name": "程序员", "art": "coder", "weapon": "enter", "type": "shoot",
		"hp": 100.0, "armor": 0.0, "speed": 62.0, "ult": "revert",
		"pitch": "保持距离点射，最好上手"},
	"pm": {"name": "产品经理", "art": "pm", "weapon": "prd", "type": "melee",
		"hp": 120.0, "armor": 1.0, "speed": 59.0, "ult": "freeze",
		"pitch": "冲进怪堆抡，把怪推开、定住"},
	"designer": {"name": "设计师", "art": "designer", "weapon": "pen", "type": "area",
		"hp": 90.0, "armor": 0.0, "speed": 71.0, "ult": "undo",
		"pitch": "一直跑，拉着怪踩自己画的线"},
	"ops": {"name": "运维", "art": "ops", "weapon": "firewall", "type": "summon",
		"hp": 130.0, "armor": 1.0, "speed": 56.0, "ult": "reboot",
		"pitch": "站得住：墙挡子弹，召唤物替你打"},
	"data_scientist": {"name": "数据科学家", "art": "data_scientist", "weapon": "screensaver", "type": "",
		"hp": 100.0, "armor": 0.0, "speed": 62.0, "ult": "clean", "multitask": true,
		"pitch": "屏保满屏乱弹，什么武器都拿"},
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

## Ultimates: name, what it does, the icon on its button and the kills that charge it.
const ULTS := {
	"revert": {"name": "git revert", "text": "回到 3 秒前的位置和血量，清掉身边的弹幕", "art": "ult_revert"},
	"freeze": {"name": "拉个会", "text": "屏幕里所有怪定住 2.5 秒", "art": "ult_freeze"},
	"undo": {"name": "Cmd+Z", "text": "撤销最近 5 秒受到的伤害", "art": "ult_undo"},
	"reboot": {"name": "重启", "text": "1 秒无敌，然后回复 40% 生命", "art": "ult_reboot"},
	"clean": {"name": "数据清洗", "text": "清掉屏幕里所有小怪（照常掉经验）", "art": "ult_clean"},
}


## The job picked last on this device (the title screen remembers it), or the programmer.
static func saved() -> String:
	var job: String = Settings.get_value("job", DEFAULT)
	return job if JOBS.has(job) else DEFAULT


static func data(job: String) -> Dictionary:
	return JOBS.get(job, JOBS[DEFAULT])


static func max_weapons(job: String) -> int:
	return 99 if data(job).get("multitask", false) else MAX_WEAPONS
