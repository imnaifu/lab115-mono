class_name Training
extends RefCounted
## 培训 (.44, the user's call after Vampire Survivors' PowerUp shop): the 工资 that year-end bonuses
## pay (Game.FUNDING_ROUNDS `salary`, saved by Progress.add_salary) buys ranks of the base stats,
## for good, on every run and map, on top of the landmarks' (Stamps). Like Vampire Survivors, rank
## n of a stat costs its `price` times n, and 全部退款 gives every bit back to spend again. Unlike
## it, buying one stat no longer makes the others dearer since .71 (the user: 每级涨价……去掉;
## .44–.70 every rank bought anywhere added 10% to every price, so the last ranks cost ¥50,000–
## 68,400 and everything about ¥401,700). A 返聘 (REVIVE_PRICE) is sold here too.
##
## The save only ever grows (see Progress), so what was bought isn't kept as ranks and a balance:
## each purchase and each refund is an event of its own (Progress.add_training_event), and the
## ranks and what's been spent are worked out by playing them back in time order. Two devices'
## events then merge as a union and still add up: a refund on one undoes the purchases before it
## on both. A rank bought twice offline past the top is ignored, costing nothing.

## Ordered as the 培训 page lists them. `step` per rank; `ranks` the most; `price` of rank 1.
## All of it costs ¥139,500 since .75: about 90 runs with all four bosses down (¥1,496 of year-end
## bonuses on average since .70, and about ¥60 of 红包). ¥130,000 in .71–.74.
const STATS := [
	{"id": "max_hp", "name": "生命上限", "art": "dumbbell", "step": 10.0, "ranks": 5, "price": 1500},
	{"id": "might", "name": "伤害", "art": "coffee", "step": 0.03, "ranks": 5, "price": 1000},
	{"id": "haste", "name": "冷却", "art": "monitors", "step": 0.03, "ranks": 4, "price": 3000},
	{"id": "speed", "name": "移速", "art": "scooter", "step": 0.05, "ranks": 2, "price": 2500},
	{"id": "magnet", "name": "拾取范围", "art": "card", "step": 0.2, "ranks": 2, "price": 1500},
	{"id": "armor", "name": "护甲", "art": "headphones", "step": 0.5, "ranks": 3, "price": 2000},
	{"id": "regen", "name": "每秒回血", "art": "plant", "step": 0.1, "ranks": 3, "price": 5000},
	{"id": "luck", "name": "运气", "art": "koi", "step": 10.0, "ranks": 3, "price": 3000},
]
## .75 (the user: 加一下培训的数值，都凑个整吧, then 移速 +5、拾取 +20; 冷却 -3%、护甲 2000、回血改最多三级
## 价格 5000、移动速度和生命加点钱、冷却改 3000): a rank gives 生命 +10, 伤害 +3%, 冷却 -3%, 移速 +5%,
## 拾取 +20%, 护甲 +0.5, 回血 +0.1, 运气 +10 (were +6, +3%, -2%, +3%, +15%, +0.6, +0.06, +6), and the
## first ranks cost 生命 ¥1,500 (1,000), 冷却 ¥3,000 (4,000), 移速 ¥2,500 (1,500), 护甲 ¥2,000 (3,000),
## 回血 ¥5,000 (1,000) with three ranks rather than five; the rest as they were. By the balance formula
## the value per ¥ now sits within about 2× across the stats the formula has (冷却 was 10× off).
## A 4th or 5th 回血 bought before .75 no longer counts (state() skips buys past the top), and what it
## cost goes back to the balance with it.
## .53 (the user: 局外的成长调低一点；保留等级，砍每一级的增长；培训的所有东西价格 ×10): every step is
## 60% of what it was (生命 +10, 伤害 +5%, 冷却 -2.5%, 移速 +5%, 拾取 +25%, 护甲 +1, 回血 +0.1,
## 运气 +10 a rank before) and every price ten times, 返聘 too. Ranks already bought stay bought
## (the save keeps what each cost, state()), only worth less. .71 (the user: 冷却数值加到每级 -2%,
## 冷却降价到 4000): 冷却 -1.5% → -2% a rank and ¥4,500 → ¥4,000; it was the worst buy for its price
## by the balance formula (DESIGN.md 2.8), about a ninth of 伤害's.
## A 返聘 (a revive, Game.accept_revive) costs this, every time, untaxed (the user's price, .44; it
## was 绩效 S's prize in .43). Unlike a rank it is used up, so 全部退款 doesn't give it back.
const REVIVE_PRICE := 18880
## How a stat's total reads, given its amount (as Stamps.BONUSES).
const TEXTS := {
	"max_hp": "最大生命 +%s", "might": "伤害 +%s%%", "haste": "冷却 -%s%%", "speed": "移速 +%s%%",
	"magnet": "拾取范围 +%s%%", "armor": "护甲 +%s", "regen": "每秒回血 +%s", "luck": "运气 +%s",
}
## Stats whose amount is a plain number rather than a fraction shown as a percent.
const PLAIN := ["max_hp", "armor", "regen", "luck"]


static func stat(id: String) -> Dictionary:
	for entry: Dictionary in STATS:
		if entry["id"] == id:
			return entry
	return {}


## The events played back: each stat's rank, and the 工资 spent: on ranks since the last refund,
## plus every 返聘 ever bought.
static func state() -> Dictionary:
	var events := Progress.training_events()
	# In time order, ties by id, so every device plays them back the same way.
	var keys := events.keys()
	keys.sort_custom(func(a: String, b: String) -> bool:
		var event_a: Array = events[a]
		var event_b: Array = events[b]
		return event_a[0] < event_b[0] or (event_a[0] == event_b[0] and a < b))
	var ranks := {}
	var spent := 0
	# 返聘 bought: spent for good, a refund doesn't touch it.
	var spent_on_revives := 0
	for key: String in keys:
		var event: Array = events[key]
		match event[1]:
			"buy":
				var stat_id: String = event[2]
				if ranks.get(stat_id, 0) < int(stat(stat_id).get("ranks", 0)):
					ranks[stat_id] = ranks.get(stat_id, 0) + 1
					spent += int(event[3])
			"refund":
				ranks.clear()
				spent = 0
			"revive":
				spent_on_revives += int(event[3])
	return {"ranks": ranks, "spent": spent + spent_on_revives}


## 工资 there to spend. Below 0 only if two devices spent the same money offline.
static func balance() -> int:
	return Progress.salary_total() - int(state()["spent"])


static func rank(id: String) -> int:
	return int((state()["ranks"] as Dictionary).get(id, 0))


static func total_ranks() -> int:
	var total := 0
	for count: int in (state()["ranks"] as Dictionary).values():
		total += count
	return total


## What the next rank of `id` costs now.
static func price(id: String) -> int:
	return price_at(id, rank(id) + 1)


## The price of rank `level` of `id`: its first rank's price times the rank (static for the 官网).
static func price_at(id: String, level: int) -> int:
	return int(stat(id)["price"]) * level


static func maxed(id: String) -> bool:
	return rank(id) >= int(stat(id)["ranks"])


## Buys the next rank of `id` if there's 工资 enough; whether it did.
static func buy(id: String) -> bool:
	if maxed(id):
		return false
	var cost := price(id)
	if cost > balance():
		return false
	Progress.add_training_event(["buy", id, cost])
	return true


## Buys a 返聘 for REVIVE_PRICE if there's 工资 enough, into the save's stock (Progress.add_revive,
## keyed by the purchase's id); whether it did.
static func buy_revive() -> bool:
	if REVIVE_PRICE > balance():
		return false
	Progress.add_revive("bought-" + Progress.add_training_event(["revive", "", REVIVE_PRICE]))
	return true


## 全部退款: every rank undone, every bit of 工资 spent on them back (not what bought 返聘).
static func refund_all() -> void:
	if total_ranks() > 0:
		Progress.add_training_event(["refund", "", 0])


## Every rank trained, on a player starting a run (after the landmarks' bonuses, as Stamps).
static func apply(player: Player) -> void:
	var ranks: Dictionary = state()["ranks"]
	for id: String in ranks:
		var amount: float = float(stat(id)["step"]) * int(ranks[id])
		match id:
			"max_hp":
				player.max_hp += amount
				player.hp += amount
			"might":
				player.might += amount
			"haste":
				player.cooldown_scale *= 1.0 - amount
			"speed":
				player.move_speed *= 1.0 + amount
			"magnet":
				player.pickup_radius *= 1.0 + amount
			"armor":
				player.armor += amount
			"regen":
				player.regen += amount
			"luck":
				player.luck += amount


## `id` at `ranks` ranks with its name, as the 官网 shows it: 伤害 +15%.
static func amount_text(id: String, ranks: int) -> String:
	return TranslationServer.translate(TEXTS[id]) % _number(id, ranks)


## `id` at `ranks` ranks without its name, as the 培训 page's rows show it under the name: +15%.
static func amount_value(id: String, ranks: int) -> String:
	return ("-" if id == "haste" else "+") + _number(id, ranks) + ("" if id in PLAIN else "%")


static func _number(id: String, ranks: int) -> String:
	var amount: float = float(stat(id)["step"]) * ranks
	var shown: String = str(snappedf(amount, 0.01)) if id in PLAIN else str(snappedf(amount * 100.0, 0.1))
	return shown.trim_suffix(".0")


## The ranks for the run's data: max_hp:2,might:3 (only those trained).
static func summary() -> String:
	var ranks: Dictionary = state()["ranks"]
	var parts := PackedStringArray()
	for entry: Dictionary in STATS:
		if ranks.has(entry["id"]):
			parts.append("%s:%d" % [entry["id"], ranks[entry["id"]]])
	return ",".join(parts)
