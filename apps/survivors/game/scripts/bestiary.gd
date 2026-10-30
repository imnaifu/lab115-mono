class_name Bestiary
extends RefCounted
## 怪物图鉴: every enemy a run can meet, grouped as the 收藏 page shows them, each with a line
## about it. One goes in the first time it turns up in a run; kills are counted across runs. Both
## are kept in Progress ("seen", "kills_by_type", and the boss affixes met in "affixes_seen"),
## saved with the other totals when a run ends (Achievements.finish).
##
## A clone or a piece (AI 幻觉, 小屎山 / 小中台 / 微服务, a 甩锅 copy) goes with the boss it comes from,
## not on its own.

## By map from .36, when each map got its own crowd and the three bosses they all shared.
const GROUPS := [
	{"name": "硅谷小怪", "ids": ["ping", "bug", "mail", "meeting", "ghost", "techdebt", "server"]},
	{"name": "硅谷 boss", "ids": ["techdebt_elite", "server_elite", "layoff", "deadline", "ai", "investor",
		"spaghetti", "scope_change", "incident", "pie_boss", "rto"]},
	{"name": "西雅图小怪", "ids": ["at_here", "sev3_ticket", "code_review", "one_on_one", "night_page", "six_pager", "cloud_bill", "parcel"]},
	{"name": "西雅图 boss", "ids": ["day1", "us_east_1", "pip", "prime_day", "copilot", "bar_raiser",
		"monolith", "reorg", "meeting_spam", "all_hands", "frugality"]},
	{"name": "伦敦小怪", "ids": ["pigeon", "teabag", "visa_form", "pub_invite", "tower_ghost", "compliance", "double_decker", "queue_brit"]},
	{"name": "伦敦 boss", "ids": ["tea_time", "signal_failure", "redundancy", "pub_time", "cookie_popup", "gdpr",
		"committee", "timezone_call", "eu_fine", "scone_boss", "cctv"]},
	{"name": "新加坡小怪", "ids": ["mosquito", "gecko", "grub_order", "align_call", "hungry_ghost", "coe", "durian", "tissue_chope"]},
	{"name": "新加坡 boss", "ids": ["rent", "thunderstorm", "apac_cut", "ep_expiry", "going_overseas", "family_office",
		"forms", "parachute_boss", "fine_notice", "kaya_boss", "fine_officer"]},
	{"name": "北京小怪", "ids": ["dingding", "small_req", "daily_report", "group_chat", "read_no_reply", "kpi", "traffic_flood", "commuter"]},
	{"name": "北京 boss", "ids": ["weekly_report", "sale_618", "midlife", "fubao", "baimo", "juanwang",
		"zhongtai", "inspection", "ppt", "annual_party", "elimination"]},
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
	"day1": "永远是第一天，所以永远不能下班",
	"pip": "六十天，要么改进，要么走人",
	"prime_day": "大促前一晚，全组通宵",
	"bar_raiser": "专门来把面试的标准再拔高一点",
	"copilot": "帮你写了一半，另一半你来修",
	"reorg": "一觉醒来，汇报线又换了",
	"meeting_spam": "一个会还没开完，下一个已经在响",
	"frugality": "门板当桌子，连地上的星星都不放过",
	"dingding": "已读未读，对面都看得见",
	"small_req": "「就改一个小需求」，改了一整周",
	"daily_report": "周报不够，还要日报",
	"group_chat": "一言不合就拉群，群比人多",
	"read_no_reply": "消息发出去，石沉大海，墙也挡不住它",
	"kpi": "数字压在身上，推都推不动",
	"traffic_flood": "大促零点，一波接一波",
	"sale_618": "全年最大的一次促销，服务器先扛不住",
	"zhongtai": "什么都往里塞，拆开全是小中台",
	"annual_party": "年会上一讲就是一小时，明年一定上市",
	"at_here": "一条消息，全频道一起响",
	"sev3_ticket": "不急，但永远关不掉",
	"code_review": "「帮忙看一下」，一看就是两千行",
	"one_on_one": "「最近怎么样？」",
	"night_page": "凌晨三点手机一震，墙挡不住它",
	"six_pager": "开会前先默读二十分钟",
	"cloud_bill": "月底一看，比工资还高",
	"us_east_1": "一个区挂了，半个互联网跟着挂",
	"monolith": "十年的代码都在一个仓库里，拆开全是微服务",
	"all_hands": "全员大会，人人都要听领导画饼",
	"pigeon": "广场上的老住户，抢你的三明治",
	"teabag": "泡了一杯又一杯，永远喝不完",
	"visa_form": "材料交了三遍，还差一张",
	"pub_invite": "「下班喝一杯？」不去就是不合群",
	"tower_ghost": "在塔里关了几百年，墙挡不住它",
	"compliance": "每一步都要签字，推都推不动",
	"double_decker": "两层楼高的红色大块头",
	"queue_brit": "排队是信仰，一来就是一圈，只在伦敦出现",
	"tea_time": "天塌下来，也要先喝完下午茶",
	"signal_failure": "「由于信号故障，本线暂停运营」",
	"redundancy": "信封上写着：你的岗位已冗余",
	"pub_time": "周五下午五点，谁也拦不住",
	"gdpr": "数据保护到位，它身边的怪也被保护了",
	"cookie_popup": "关掉一个，又弹出一个",
	"timezone_call": "早上跟东京开，晚上跟旧金山开",
	"eu_fine": "罚单按全球营收的 4% 开",
	"committee": "开会决定成立一个小组，拆开全是小委员会",
	"scone_boss": "边递司康边说：明年一定涨薪",
	"cctv": "全城都是摄像头，在镜头里别站着不动",
	"mosquito": "雨季一到，满城都是",
	"gecko": "墙上趴着的老住户，一碰就跑",
	"grub_order": "「骑手已取餐」，然后迷路了",
	"align_call": "晚上十点，和总部对齐一下",
	"hungry_ghost": "七月鬼门开，墙挡不住它",
	"coe": "一张拥车证比车还贵，推都推不动",
	"durian": "地铁里禁止携带，又重又臭",
	"tissue_chope": "一包纸巾就能占座，一来就是一圈，只在新加坡出现",
	"rent": "合同到期，又涨了两成",
	"thunderstorm": "下午四点准时来，一阵就停",
	"apac_cut": "亚太区「优化」，一刀切一片",
	"ep_expiry": "准证到期之前，赶紧把活干完",
	"going_overseas": "又一家公司出海来了",
	"family_office": "钱比项目多，身边的人都被护着",
	"forms": "办一件事要填一摞表，拆开全是小表格",
	"parachute_boss": "从总部空降，一落地就闪到你面前",
	"fine_notice": "嚼口香糖罚，乱扔垃圾罚，什么都罚",
	"kaya_boss": "边递咖椰吐司边说：明年就给你升职",
	"fine_officer": "红灯亮了就站住，动一下就罚款",
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
