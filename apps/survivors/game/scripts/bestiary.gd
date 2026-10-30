class_name Bestiary
extends RefCounted
## 怪物图鉴: every enemy a run can meet, grouped as the 收藏 page shows them, each with a line
## about it. One goes in the first time it turns up in a run; kills are counted across runs. Both
## are kept in Progress ("seen", "kills_by_type", and the boss affixes met in "affixes_seen"),
## saved with the other totals when a run ends (Achievements.finish).
##
## A clone or a piece (AI 幻觉, 小屎山, a 甩锅 copy) goes with the boss it comes from, not on its own.

const GROUPS := [
	{"name": "小怪", "ids": ["ping", "bug", "mail", "meeting", "ghost", "techdebt", "server", "commuter"]},
	{"name": "硅谷 boss", "ids": ["techdebt_elite", "server_elite", "layoff", "deadline", "ai", "investor",
		"spaghetti", "scope_change", "incident", "pie_boss", "rto"]},
	{"name": "北京 boss", "ids": ["weekly_report", "midlife", "fubao", "juanwang", "baimo", "inspection", "ppt", "elimination"]},
]
## A line about each.
const NOTES := {
	"ping": "永远清不完的未读",
	"bug": "修好一个，冒出两个",
	"mail": "标题全是「紧急」",
	"meeting": "一小时的会，五分钟的内容",
	"ghost": "页面找不到，它却能穿墙找到你",
	"techdebt": "欠下的总要还，皮厚推不动",
	"server": "一倒就是一片，又慢又厚",
	"commuter": "西二旗站外排到马路上，只在北京的早高峰出现",
	"techdebt_elite": "前人留下的，谁也不敢动",
	"server_elite": "全公司的报警一起响",
	"layoff": "邮件标题：组织架构调整",
	"deadline": "永远比你想的近",
	"ai": "号称能取代你",
	"investor": "钱到位之前，什么都是空的",
	"spaghetti": "能跑就别动",
	"scope_change": "上线前一天：再改一下",
	"incident": "凌晨三点的电话",
	"pie_boss": "明年一定上市",
	"weekly_report": "这周干了啥？编也要编满一页",
	"midlife": "简历投出去就没了回音",
	"fubao": "到点不下班才是福报",
	"juanwang": "你下班时他还在，你上班时他已经在",
	"baimo": "每周都有一个新模型发布",
	"inspection": "一回头，他就站在你身后",
	"ppt": "做 PPT 的时间比干活还多",
	"rto": "周一到周五都得回工位刷卡",
	"elimination": "每次考核都得有人走",
}


static func ids() -> PackedStringArray:
	var all := PackedStringArray()
	for group: Dictionary in GROUPS:
		all.append_array(group["ids"])
	return all


static func seen(id: String) -> bool:
	return (Progress.stat("seen", []) as Array).has(id)


static func seen_count() -> int:
	var count := 0
	for id in ids():
		if seen(id):
			count += 1
	return count


static func kills(id: String) -> int:
	return (Progress.stat("kills_by_type", {}) as Dictionary).get(id, 0)


static func affix_seen(affix: String) -> bool:
	return (Progress.stat("affixes_seen", []) as Array).has(affix)


## The maps a boss turns up on: everywhere unless a map puts its own in its place.
static func maps_of(id: String) -> PackedStringArray:
	var names := PackedStringArray()
	for map_id: String in Maps.ORDER:
		var map := Maps.script_of(map_id)
		var swaps: Dictionary = map.BOSS_SWAPS
		var own: bool = swaps.values().has(id) or map.GUEST_BOSS["type"] == id
		var standard: bool = Spawner.EVENTS.any(func(event: Dictionary) -> bool: return event["type"] == id)
		if own or (standard and not swaps.has(id)):
			names.append(TranslationServer.translate(map.NAME))
	return names
