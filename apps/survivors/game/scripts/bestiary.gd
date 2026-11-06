class_name Bestiary
extends RefCounted
## 怪物图鉴: every enemy a run can meet, grouped as the 收藏 page shows them, each with a line
## about it. One goes in the first time it turns up in a run; kills are counted across runs. Both
## are kept in Progress ("seen", "kills_by_type"), saved with the other totals when a run ends
## (Achievements.finish).

## The crowd, the same everywhere (.41; .36-.40 each map had its own), then each map's four bosses
## (.45; until .44 eleven a map).
const GROUPS := [
	{"name": "小怪", "ids": ["ping", "small_req", "bug", "mail", "meeting", "kpi", "ghost", "techdebt", "traffic_flood", "server"]},
	{"name": "硅谷 boss", "ids": ["deadline", "server_elite", "ai", "pie_boss"]},
	{"name": "伦敦 boss", "ids": ["committee", "redundancy", "gdpr", "scone_boss"]},
	{"name": "西雅图 boss", "ids": ["monolith", "meeting_spam", "pip", "all_hands"]},
	{"name": "新加坡 boss", "ids": ["forms", "apac_cut", "parachute_boss", "kaya_boss"]},
	{"name": "北京 boss", "ids": ["juanwang", "ppt", "elimination", "annual_party"]},
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
	"parcel": "当日达，一来就是一圈，只在西雅图出现",
	"dingding": "已读未读，对面都看得见",
	"small_req": "「就改一个小需求」，改了一整周",
	"daily_report": "周报不够，还要日报",
	"group_chat": "一言不合就拉群，群比人多",
	"read_no_reply": "消息发出去，石沉大海，墙也挡不住它",
	"kpi": "数字压在身上，推都推不动",
	"traffic_flood": "大促零点，一波接一波",
	"at_here": "一条消息，全频道一起响",
	"sev3_ticket": "不急，但永远关不掉",
	"code_review": "「帮忙看一下」，一看就是两千行",
	"one_on_one": "「最近怎么样？」",
	"night_page": "凌晨三点手机一震，墙挡不住它",
	"six_pager": "开会前先默读二十分钟",
	"cloud_bill": "月底一看，比工资还高",
	"pigeon": "广场上的老住户，抢你的三明治",
	"teabag": "泡了一杯又一杯，永远喝不完",
	"visa_form": "材料交了三遍，还差一张",
	"pub_invite": "「下班喝一杯？」不去就是不合群",
	"tower_ghost": "在塔里关了几百年，墙挡不住它",
	"compliance": "每一步都要签字，推都推不动",
	"double_decker": "两层楼高的红色大块头",
	"queue_brit": "排队是信仰，一来就是一圈，只在伦敦出现",
	"mosquito": "雨季一到，满城都是",
	"gecko": "墙上趴着的老住户，一碰就跑",
	"grub_order": "「骑手已取餐」，然后迷路了",
	"align_call": "晚上十点，和总部对齐一下",
	"hungry_ghost": "七月鬼门开，墙挡不住它",
	"coe": "一张拥车证比车还贵，推都推不动",
	"durian": "地铁里禁止携带，又重又臭",
	"tissue_chope": "一包纸巾就能占座，一来就是一圈，只在新加坡出现",
	# The bosses (.45).
	"deadline": "说冲就冲，挡在路上的都被撞开",
	"server_elite": "一台挂了带着一串挂",
	"ai": "一个字一个字往外蹦",
	"pie_boss": "饼越画越大，期权撒一地",
	"committee": "你还没想好，它已经替你决定了",
	"redundancy": "英式裁员：先约你 15 分钟",
	"gdpr": "合规文件一发一大把",
	"scone_boss": "喝茶聊聊，其实是谈话",
	"monolith": "十年没拆的单体，一重启全站抖",
	"meeting_spam": "邀请一封接一封追着你",
	"pip": "直接在你身上画个叉",
	"all_hands": "台上冲业绩，台下发全员信",
	"forms": "什么都要先填表",
	"apac_cut": "一张通知覆盖整个亚太",
	"parachute_boss": "从总部空降，落地就在你头上",
	"kaya_boss": "画饼的亚太版：吐司更大，咖椰抹一地",
	"juanwang": "原地打转，越卷越多",
	"ppt": "一页接一页，页页拍在你前面",
	"elimination": "画个圈，圈里的走人",
	"annual_party": "讲完明年再冲一把，然后放鞭炮",
}


## The groups as the 图鉴 shows them (.99): the crowd, then every boss by the slot it comes at
## (2:00 / 4:00 / 6:00 / 8:00), since each run draws its boss at a slot from every map's
## (Spawner._draw_bosses) and 硅谷 alone is on offer. GROUPS (by map) still sorts them for the
## career's boss count.
static func shown_groups() -> Array:
	var groups: Array = [GROUPS[0]]
	for slot in BossKits.SLOT_AT.size():
		var ids: Array = []
		for map_id: String in Maps.ALL:
			var line_up: Array = Maps.script_of(map_id).BOSSES
			if slot < line_up.size():
				ids.append(line_up[slot])
		var at := roundi(BossKits.SLOT_AT[slot])
		groups.append({"name": "%d:%02d boss" % [at / 60, at % 60], "ids": ids})
	return groups


## The enemies of shown_groups(), what the 图鉴 counts.
static func ids() -> PackedStringArray:
	var all := PackedStringArray()
	for group: Dictionary in shown_groups():
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


## The maps an enemy turns up on: since .99 every map on offer, bosses too (drawn at their slot
## from every map's); until then a boss only on its own map's (BOSSES).
static func maps_of(_id: String) -> PackedStringArray:
	var names := PackedStringArray()
	for map_id: String in Maps.ORDER:
		names.append(TranslationServer.translate(Maps.script_of(map_id).NAME))
	return names
