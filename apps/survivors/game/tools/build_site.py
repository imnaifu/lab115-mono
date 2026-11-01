#!/usr/bin/env python3
"""Builds the 官网 (survivors.lab115.com/, the game being at /play/) as one self-contained HTML
file: every picture inlined, no fonts or scripts from anywhere else, so the same file also works
saved and opened offline. The words and numbers come from the game itself, dumped by
tools/dump_compendium.gd, so the site can't drift from what is live:

    godot --headless --path . -s tools/dump_compendium.gd -- /tmp/compendium.json
    python3 tools/build_site.py /tmp/compendium.json assets/art out/index.html

Looks follow the game's (Sokosoko): white paper, ink text, one warm yellow, pill buttons.
"""
import base64
import html
import json
import pathlib
import sys

PLAY_URL = "https://survivors.lab115.com/play/"
# Cities on the departures board that have no map yet (Maps.COMING_SOON ids).
COMING_SOON_NAMES = {"sz": "深圳", "blr": "班加罗尔"}
TIERS = {"platinum": ("白金", "#8ec5d6"), "gold": ("黄金", "#f7c948"), "silver": ("白银", "#c9cdd4"), "bronze": ("青铜", "#d9a066")}


def esc(text) -> str:
    return html.escape(str(text))


def number(value) -> str:
    return str(int(value)) if float(value).is_integer() else f"{value:g}"


def percent(share: float) -> str:
    """0.012 -> 1.2%, 0.65 -> 65%: whole percents from 10% up, one decimal below."""
    value = share * 100
    return f"{number(round(value))}%" if value >= 10 else f"{number(round(value, 1))}%"


def span(values) -> str:
    """The jobs' numbers for one stat: 100, or 60–66 when they differ."""
    low, high = min(values), max(values)
    return number(low) if low == high else f"{number(low)}–{number(high)}"


def art(name: str, size: int = 56, label: str = "") -> str:
    return f'<img class="art" data-art="{esc(name)}" width="{size}" height="{size}" alt="{esc(label)}" loading="lazy">'


def clock(seconds: float) -> str:
    seconds = int(seconds)
    return f"{seconds // 60}:{seconds % 60:02d}"


def section(anchor: str, title: str, intro: str, body: str) -> str:
    return (f'<section id="{anchor}"><h2><span class="mark">{esc(title)}</span></h2>'
            + (f'<p class="intro">{intro}</p>' if intro else "") + body + "</section>")


def jobs_section(data: dict) -> str:
    weapons = {w["id"]: w for w in data["weapons"]}
    cards = []
    for job in data["jobs"]:
        weapon = weapons[job["weapon"]]
        kind = data["weapon_types"][weapon["type"]]
        lines = "、".join(f"「{esc(line)}」" for line in job["lines"])
        cards.append(f"""<article class="card job">
<div class="head">{art(job['art'], 64, job['name'])}<div><h3>{esc(job['name'])}</h3>
<p class="muted">{esc(job['pitch'])}</p></div></div>
<p class="stats"><span>生命 <b>{number(job['hp'])}</b></span><span>护甲 <b>{number(job['armor'])}</b></span><span>移速 <b>{number(job['speed'])}</b></span></p>
<p class="weapon">{art(weapon['art'], 28)}专属武器 <b>{esc(weapon['name'])}</b> {tag(kind)}</p>
<p class="quote">口头禅：{lines}</p></article>""")
    return section("jobs", "职业", "开局选一个职业，带着它的专属武器上班。生命都是 100；近身打的护甲多一点，打得远的跑得快一点。",
                   f'<div class="grid wide">{"".join(cards)}</div>')


def tag(kind: dict) -> str:
    return f'<span class="tag" style="background:#{kind["fill"]};color:#{kind["ink"]}">{esc(kind["name"])}</span>'


# The player's stats in the pause screen's order: the dump's key, the name, the stat passive that
# raises it (Upgrades.STAT_STEPS), the landmark bonus that does (Stamps.BONUSES; None: no landmark
# gives it), how the total of every landmark reads given the start and stamped values, and what it
# does. Every number comes from the dump; only the words are written here.
STAT_ROWS = [
    ("max_hp", "生命上限", "vitality", "max_hp", lambda start, stamped: f"+{number(stamped - start)}", "生命归零，这一局就输了。"),
    ("might", "伤害", "might", "might", lambda start, stamped: f"+{percent(stamped - start)}", "所有武器的伤害都乘上它。"),
    ("cooldown_scale", "冷却", "haste", "haste", lambda start, stamped: f"-{percent(1 - stamped / start)}",
     "所有武器的出手间隔都乘上它。武器升级不会让它打得更快，攻速只靠这一项。"),
    ("move_speed", "移速", "swiftness", "speed", lambda start, stamped: f"+{percent(stamped / start - 1)}", "每秒走多少像素。"),
    ("pickup_radius", "拾取范围", "magnet", "magnet", lambda start, stamped: f"+{percent(stamped / start - 1)}",
     "经验星星进了这个范围（像素）才会飞过来。"),
    ("armor", "护甲", "armor", None, None, "每点让每次受到的伤害 -1，但每次至少扣 1 点。"),
    ("regen", "每秒回血", "regen", "regen", lambda start, stamped: f"+{number(round(stamped - start, 2))}", "每秒自动回这么多生命。"),
    ("luck", "运气", "luck", "luck", lambda start, stamped: f"+{number(stamped - start)}",
     '升级卡和年终奖里的卡更容易出稀有的，升级时有几率多出一张卡（见<a href="#upgrades">升级</a>）。年终奖开出哪档绩效和运气无关。'),
]


def stats_section(data: dict) -> str:
    stats, jobs = data["stats"], data["jobs"]
    passives = {p["id"]: p for p in data["passives"]}
    stamps = [stamp for game_map in data["maps"] for stamp in game_map["stamps"]]
    # What the jobs set for themselves; the rest start the same for everyone.
    by_job = {"max_hp": "hp", "armor": "armor", "move_speed": "speed"}
    cards = []
    for key, name, passive_id, stamp_kind, total, note in STAT_ROWS:
        start = stats["start"][key]
        if key in by_job:
            values = [job[by_job[key]] for job in jobs]
            opening = span(values) + ("（看职业）" if min(values) != max(values) else "（各职业一样）")
        elif key in ("might", "cooldown_scale"):
            opening = f"×{number(start)}"
        else:
            opening = number(start)
        passive = passives[passive_id]
        lines = [f'<p class="row">{art(passive["art"], 24, passive["name"])}<span><b>{esc(passive["name"])}</b>：{esc(passive["text"])}（每级）</span></p>']
        if stamp_kind:
            # Each landmark's bonus of this kind, with how many give it.
            counts = {}
            for stamp in stamps:
                if stamp["kind"] == stamp_kind:
                    counts[stamp["bonus"]] = counts.get(stamp["bonus"], 0) + 1
            given = "、".join(f"{esc(text)}（{count} 个）" for text, count in counts.items())
            lines.append(f'<p class="row"><span class="pin">打卡</span><span>{given}，全部打满 '
                         f'<b>{esc(total(start, stats["all_stamps"][key]))}</b></span></p>')
        else:
            lines.append('<p class="row"><span class="pin">打卡</span><span class="muted">没有地标加这一项</span></p>')
        cards.append(f"""<article class="card stat"><h3>{esc(name)} <span class="start">开局 {esc(opening)}</span></h3>
<p class="muted">{note}</p>{"".join(lines)}</article>""")
    cards.append(f"""<article class="card stat"><h3>受击无敌 <span class="start">{number(stats['invuln_seconds'])} 秒</span></h3>
<p class="muted">挨一下之后这么久不再扣血，被一群怪围住也不会一下掉光。不能升级。</p></article>""")
    return section("stats", "属性", "主角就这几项属性，局里按暂停能看到当前的数。开局的生命、护甲、移速看职业；之后靠被动往上加（卡越稀有加得越多，见"
                   '<a href="#upgrades">升级</a>），再加上打卡：每个地标给一点，永久生效，哪张地图打的卡在所有地图都算。',
                   f'<div class="grid wide">{"".join(cards)}</div>')


def stat_value(key: str, value) -> str:
    """A weapon stat as the cards word it (Upgrades.WEAPON_STAT_NAMES' keys)."""
    if key == "size":
        return f"×{number(round(value, 2))}"
    if key in ("cooldown", "duration"):
        return f"{number(value)} 秒"
    if key == "arc":
        return f"{number(value)}°"
    return number(round(value, 2))


def weapon_numbers(weapon: dict, names: dict) -> str:
    """A job weapon's starting numbers on one line; another weapon's per level, folded away."""
    if "base" in weapon:
        parts = " · ".join(f"{esc(name)} {stat_value(key, weapon['base'][key])}" for key, name in names.items() if key in weapon["base"])
        return f'<p class="muted">开局：{parts}</p>'
    levels = weapon["stats"]
    keys = [key for key in names if any(key in level for level in levels)]
    head = "".join(f"<th>{esc(names[key])}</th>" for key in keys)
    rows = "".join(f'<tr><td class="lv">Lv{i + 1}</td>' + "".join(f"<td>{stat_value(key, level[key]) if key in level else ''}</td>" for key in keys) + "</tr>"
                   for i, level in enumerate(levels))
    return f'<details><summary>每级数值</summary><div class="scroll"><table class="nums"><tr><th></th>{head}</tr>{rows}</table></div></details>'


def weapons_section(data: dict) -> str:
    jobs = {job["id"]: job["name"] for job in data["jobs"]}
    names = dict(data["weapon_stat_names"])
    own, public = [], []
    for weapon in data["weapons"]:
        kind = data["weapon_types"][weapon["type"]]
        if weapon.get("branches"):
            branches = "".join(f'<li><b>{esc(b["name"])}</b>：{esc(b["text"])}</li>' for b in weapon["branches"].values())
            detail = f'<p>{esc(weapon["levels"][0])}</p>{weapon_numbers(weapon, names)}<p class="muted">两个方向各升 4 次：</p><ul>{branches}</ul>'
            owner = f'<span class="tag plain">{esc(jobs.get(weapon["job"], ""))}专属</span>'
            own.append((weapon, kind, detail, owner))
        else:
            steps = "".join(f"<li><span class=\"lv\">Lv{i + 1}</span>{esc(text)}</li>" for i, text in enumerate(weapon["levels"]))
            public.append((weapon, kind, f"<ol>{steps}</ol>{weapon_numbers(weapon, names)}", ""))

    def cards(items):
        return "".join(f"""<article class="card">
<div class="head">{art(w['art'], 48, w['name'])}<div><h3>{esc(w['name'])}</h3><p>{tag(k)} {owner}</p></div></div>{detail}</article>"""
                       for w, k, detail, owner in items)
    return section("weapons", "武器", "全部自动攻击，你只管走位和升级时选卡。一局最多带 6 把：本职业的专属武器开局自带，另外 10 把大家都能拿，每把 5 级。武器升级只加伤害、数量、范围，攻速只看被动「双屏显示器」。"
                   "下面的数值是没有任何加成时的：伤害还要乘上伤害属性和这把武器的稀有度加成，间隔乘上冷却（局里升级卡上写的是乘过以后的）。",
                   f'<h3 class="sub">专属武器</h3><div class="grid">{cards(own)}</div><h3 class="sub">公共武器</h3><div class="grid">{cards(public)}</div>')


def passives_section(data: dict) -> str:
    cards = "".join(f"""<article class="card small"><div class="head">{art(p['art'], 44, p['name'])}<div><h3>{esc(p['name'])}</h3>
<p class="muted">{esc(p['text'])}{'（每级）' if p['stat'] else ''}</p></div></div></article>""" for p in data["passives"])
    return section("passives", "被动", '一局最多带 6 种被动，大多能升 5 级。升级卡有稀有度（白 / 绿 / 蓝 / 紫 / 橙），越稀有给得越多；「锦鲤」加运气，更容易出好卡（见<a href="#upgrades">升级</a>）。',
                   f'<div class="grid">{cards}</div>')


def rarity_tag(rarity: dict) -> str:
    return f'<span class="tag" style="background:#{rarity["fill"]};color:#{rarity["ink"]};box-shadow:inset 0 0 0 2px #{rarity["edge"]}">{esc(rarity["name"])}</span>'


def upgrades_section(data: dict) -> str:
    rarities, xp = data["rarities"], data["xp"]
    # XP to reach a level from level 1: everything needed on the way.
    reach = {level: sum(xp[:level - 1]) for level in (10, 20, 30, 40) if level - 1 <= len(xp)}
    prefixes = {}
    for game_map in data["maps"]:
        prefixes.setdefault(game_map["rank_prefix"], []).append(game_map["name"])
    ranks = "；".join(f"{esc('、'.join(names))} {esc(prefix)}1、{esc(prefix)}2…" for prefix, names in prefixes.items())
    job_levels = " / ".join(str(level) for level in data["job_weapon_levels"])
    xp_card = f"""<article class="card"><h3>经验和职级</h3><ul>
<li>升一级要的经验：{" / ".join(str(amount) for amount in xp[:8])}…，越往后越多（10 级以后涨得更快）</li>
<li>从头升到 {"、".join(f"L{level} 一共要 {amount}" for level, amount in reach.items())}</li>
<li>等级就是职级：{ranks}</li>
<li>每次升级三选一，运气好多一张；专属武器第 {job_levels} 级必出</li></ul></article>"""

    rows = []
    for rarity in rarities:
        # A perk with its own way of working (股票期权, 背锅侠…) only rolls the tiers that add levels.
        table_perk = f"多升 {rarity['extra_levels']} 级" if rarity["extra_levels"] else ("照常 +1 级" if rarity is rarities[0] else "不出")
        rows.append(f"<tr><td>{rarity_tag(rarity)}</td><td>{percent(rarity['weight'] / 100)}</td><td>×{number(rarity['scale'])}</td>"
                    f"<td>+{percent(rarity['weapon_bonus'])}</td><td>{table_perk}</td></tr>")
    rarity_card = f"""<article class="card"><h3>升级卡稀有度</h3>
<p class="muted">每张武器卡和被动卡都抽一个稀有度，等级照常 +1，越稀有这一步给得越多。</p>
<div class="scroll"><table class="nums"><tr><th></th><th>概率</th><th>数值被动</th><th>武器伤害</th><th>其他被动</th></tr>{"".join(rows)}</table></div>
<p class="muted">概率是运气 0 时的。「数值被动」（冰美式这种加数的）这一级加的量乘这么多，比如冰美式 +10% 变 +20%；「武器伤害」是这一把武器永久多的伤害，同一把能叠；「其他被动」（股票期权这种有自己玩法的）按等级生效，只出普通、史诗、传说。</p></article>"""

    luck = data["luck"]
    head = "".join(f"<th>{rarity_tag(rarity)}</th>" for rarity in rarities)
    card_rows = "".join(f"<tr><td><b>{number(row['luck'])}</b></td>" + "".join(f"<td>{percent(share)}</td>" for share in row["cards"]) + "</tr>" for row in luck)
    more_rows = "".join(f"<tr><td><b>{number(row['luck'])}</b></td><td>{percent(row['extra_card'])}</td></tr>" for row in luck)
    luck_card = f"""<article class="card"><h3>运气</h3>
<p class="muted">运气来自被动「锦鲤」和打卡。每点让优秀及以上每一档的几率多 1%，逐档复利，越稀有的涨得越多；年终奖里的卡也一样。年终奖开出哪档绩效和运气无关。</p>
<div class="scroll"><table class="nums"><tr><th>运气</th>{head}</tr>{card_rows}</table></div>
<div class="scroll"><table class="nums"><tr><th>运气</th><th>升级时多一张卡</th></tr>{more_rows}</table></div></article>"""

    drops = data["drops"]
    chests = drops["chests"]
    revive = drops["revive"]
    total_weight = sum(chest["weight"] for chest in chests)
    # 绩效 S gives a 返聘 (a revive kept across runs) rather than upgrades.
    chest_lines = "".join(f"<li><b>{esc(chest['name'])}</b>：{percent(chest['weight'] / total_weight)}，"
                          + ("一次<b>返聘</b>，不给升级" if chest.get("revive") else f"白给 {chest['items']} 样升级") + "</li>"
                          for chest in chests)
    drops_card = f"""<article class="card"><h3>掉落</h3><ul>
<li><b>经验星星</b>：每只怪都掉，走近才会吸过来；地上超过 {drops['max_pickups']} 个时，新的经验并进已有的星星</li>
<li><b>珍珠奶茶</b>：普通怪 {percent(drops['heal_chance'])} 掉，boss 必掉，回 {number(drops['heal_amount'])} 生命</li>
<li><b>磁铁</b>：{drops['magnet_from_level']} 级以后普通怪 {percent(drops['magnet_chance'])} 掉，全图的星星一起飞过来</li>
<li><b>年终奖</b>：每个 boss 必掉的红色宝箱</li></ul>
<h3>年终奖开出什么</h3><ul>{chest_lines}</ul>
<p class="muted">几率每个年终奖都一样，和运气、boss 词条都无关；只有 Deadline 按时打掉保底绩效 A。白给的是身上已有的武器和被动随机升一级，每样也抽稀有度。</p>
<h3>返聘</h3>
<p>存进存档，攒多少个都行。被裁（生命归零）时弹窗问你用不用：用就回到 {percent(revive['hp'])} 生命、{number(revive['invuln'])} 秒无敌，身边的怪被震开；不用就下班，返聘留着。每局最多用一个。</p></article>"""
    return section("upgrades", "升级", "打怪捡星星升级，升级时选卡；boss 掉的年终奖再白给几样。", f'<div class="grid wide">{xp_card}{rarity_card}{luck_card}{drops_card}</div>')


# Boss moves by the names the design uses (Enemy.ABILITIES ids); the extras a boss may draw.
MOVE_NAMES = {"charge": "冲锋", "quake": "宕机冲击", "summon": "召唤", "blink": "闪现", "lob": "扔饼", "volley": "弹幕"}


def chances(first: float, second: float, thing: str) -> str:
    """How many extra moves or affixes a tier draws: 多 1 个, 50% 再多 1 个."""
    if first <= 0:
        return "不加" + thing.replace("个", "")
    text = f"多 1 {thing}" if first >= 1 else f"{percent(first)} 多 1 {thing}"
    return text + (f"，{percent(second)} 再多 1 {thing}" if second > 0 else "")


def difficulty_section(data: dict) -> str:
    pacing = data["pacing"]
    minute_rows = "".join(f"<tr><td>{minute['minute']}:00</td><td>{number(round(minute['rate'], 1))}</td><td>×{number(round(minute['hp'], 2))}</td></tr>"
                          for minute in pacing["minutes"])
    curve_card = f"""<article class="card"><h3>怪越来越多、越来越抗打</h3>
<div class="scroll"><table class="nums"><tr><th>时间</th><th>每秒刷怪</th><th>怪物生命</th></tr>{minute_rows}</table></div>
<p class="muted">怪物生命每分钟 +{percent(pacing['hp_per_minute'])}，boss 也一样。场上到了 {pacing['max_alive']} 只（手机 {pacing['max_alive_mobile']} 只）就先停刷。</p></article>"""

    start, wave_rows = 0.0, []
    for wave in pacing["waves"]:
        total = sum(mob["weight"] for mob in wave["mix"])
        mobs = "".join(f'<span class="mob">{art(mob["art"], 24, mob["name"])}{esc(mob["name"])} {percent(mob["weight"] / total)}</span>' for mob in wave["mix"])
        wave_rows.append(f'<li><span class="at">{clock(start)}–{clock(wave["until"])}</span><span>{mobs}</span></li>')
        start = wave["until"]
    rings = "、".join(f"{clock(event['at'])} {esc(event['text'].rstrip('！'))}" for event in data["events"] if event["kind"] == "ring")
    waves_card = f"""<article class="card"><h3>什么时候出什么小怪</h3><ol class="timeline">{"".join(wave_rows)}</ol>
<p class="muted">另外还有包围圈：{rings}。</p></article>"""

    slot_rows = "".join(f"<tr><td>{clock(slot['at'])}</td><td><span class=\"who\">{art(slot['art'], 24, slot['name'])}{esc(slot['name'])}</span></td><td>{number(round(slot['hp_then']))}</td>"
                        f"<td>{number(slot['damage'])}</td><td>{slot['xp']}</td></tr>" for slot in pacing["boss_slots"])
    tiers = pacing["boss_tiers"]
    tier_names = [f"{clock(tier[0])}–{clock(tier[-1])}" for tier in tiers] + [f"{clock(pacing['finale_at'])} 最后一战"]
    roll_rows = "".join(f"<li><b>{esc(name)}</b>：{chances(roll['extra'][0], roll['extra'][1], '招')}；{chances(roll['affix'][0], roll['affix'][1], '个词条')}。"
                        f"<span class=\"muted\">加的招从{esc('、'.join(MOVE_NAMES.get(move, move) for move in roll['moves']))}里抽</span></li>"
                        for name, roll in zip(tier_names, pacing["rolls"]))
    bosses_card = f"""<article class="card"><h3>boss 排期</h3>
<p class="muted">每分钟来一个 boss。这是写在代码里的排期；每局在同一档（{"、".join(tier_names[:-1])}）里打乱顺序，强度跟着位置走：
不管哪个 boss 排到这一格，生命、伤害、经验都用这一格的数。出场时间前后浮动最多 {number(pacing['jitter'])} 秒，最后一战不动。场上已经有 {pacing['max_bosses_out']} 个 boss 时，下一个等有 boss 倒下才来。</p>
<div class="scroll"><table class="nums"><tr><th>时间</th><th>boss</th><th>出场生命</th><th>伤害</th><th>经验</th></tr>{slot_rows}</table></div>
<p class="muted">出场生命已经乘上那一刻的生命倍率，是硅谷的数；别的地图再乘上<a href="#maps">地图</a>的倍率。</p>
<h3>随机加招和词条</h3>
<ul>{roll_rows}</ul>
<p class="muted">第一个 boss 什么都不加，它是新手遇到的第一个 boss；最后一战里一起来的那只 AI 大模型也不加。词条是什么见<a href="#bestiary">怪物图鉴</a>最下面。</p></article>"""
    return section("difficulty", "难度", "一局越往后越难：怪越刷越多、越来越抗打，每分钟来一个 boss。下面是硅谷的数，别的地图按地图卡上的倍率再乘。",
                   f'<div class="grid wide">{curve_card}{waves_card}{bosses_card}</div>')


def maps_section(data: dict) -> str:
    cards = []
    for index, game_map in enumerate(data["maps"]):
        difficulty = game_map["difficulty"]
        hard = "基准难度" if difficulty["hp"] <= 1.0 else f"怪物生命 ×{number(difficulty['hp'])} · 伤害 ×{number(difficulty['damage'])} · 刷怪 ×{number(difficulty['spawn'])}"
        event = game_map["event"]
        cards.append(f"""<article class="card map">
<h3>{esc(game_map['name'])} <span class="hours">{esc(game_map['hours'])}</span></h3>
<p class="muted">{esc(hard)} · 职级 {esc(game_map['rank_prefix'])}1、{esc(game_map['rank_prefix'])}2…</p>
<p><b>分区</b>：{esc('、'.join(game_map['districts']))}</p>
<p><b>地图事件 · {esc(event['name'])}</b>：{esc(event['text'])}<br><span class="muted">{esc(event['hint'])}</span></p>
<p><b>特邀 boss</b>：{esc(game_map['guest_boss']['name'])}　<b>最后一战</b>：{esc(game_map['finale'].replace('最后的考验：', ''))}</p>
<p><a href="#stamps-{esc(game_map['id'])}">{len(game_map['stamps'])} 个打卡点 ›</a>　<a href="#bestiary" data-tab="{index}">本地怪物 ›</a></p></article>""")
    soon = "、".join(COMING_SOON_NAMES.get(city, city) for city in data["coming_soon"])
    return section("maps", "地图", "按工时排，越卷越难：通关一张开下一张。每张地图有自己的街区、地标、boss、天气事件，5:30 还有一位特邀 boss。"
                   "路上的车和火车（地铁）不扣血，只会把人和怪推到路边；火车来之前铁轨会先闪。",
                   f'<div class="grid wide">{"".join(cards)}</div><p class="muted soon">还在装修：{esc(soon)}</p>')


def stamps_section(data: dict) -> str:
    blocks = []
    for game_map in data["maps"]:
        cards = "".join(f"""<article class="card stamp">{art(s['art'], 72, s['name'])}<h4>{esc(s['name'])}</h4>
<p class="muted">{esc(s['note'])}</p><p class="bonus">{esc(s['bonus'])}</p></article>""" for s in game_map["stamps"])
        blocks.append(f'<h3 class="sub" id="stamps-{esc(game_map["id"])}">{esc(game_map["name"])}</h3><div class="grid stamps">{cards}</div>')
    return section("stamps", "打卡点", "走到地标跟前站满 1 秒就算打卡。每个地标给一点永久加成，这一局和以后每一局都带着，哪张地图打的卡在所有地图都生效。",
                   "".join(blocks))


def bestiary_section(data: dict) -> str:
    # One tab a map: its crowd and its bosses (the bestiary's groups come in pairs).
    groups = data["enemy_groups"]
    crowd, boss_groups = groups[0], groups[1:]
    mobs = "".join(_mob_card(enemy) for enemy in crowd["enemies"])
    tabs, panels = [], []
    for index, bosses in enumerate(boss_groups):
        name = bosses["name"].replace(" boss", "")
        tabs.append(f'<button class="tab" data-tab="{index}">{esc(name)}</button>')
        elites = "".join(_boss_card(enemy) for enemy in bosses["enemies"])
        panels.append(f'<div class="panel" data-panel="{index}"><div class="grid">{elites}</div></div>')
    affixes = "".join(f'<li><b>{esc(a["name"])}</b>：{esc(a["note"])}</li>' for a in data["affixes"])
    total = sum(len(group["enemies"]) for group in groups)
    return section("bestiary", "怪物图鉴", f"一共 {total} 种。小怪每张地图都一样；boss 是每张地图自己的，每局打乱出场顺序（强度跟着出场时间走），还会随机多会一两招、带上词条。",
                   f'<h3 class="sub">小怪</h3><div class="grid">{mobs}</div><h3 class="sub">boss</h3><div class="tabs">{"".join(tabs)}</div>{"".join(panels)}'
                   f'<h3 class="sub">boss 词条</h3><ul class="affixes">{affixes}</ul>')


def _mob_card(enemy: dict) -> str:
    instead = f'<p class="muted">对应硅谷的「{esc(enemy["stands_for"])}」</p>' if enemy["stands_for"] else ""
    trait = " · 穿墙" if enemy["ghostly"] else ""
    return f"""<article class="card small">{art(enemy['art'], 56, enemy['name'])}<h4>{esc(enemy['name'])}</h4>
<p>{esc(enemy['note'])}</p><p class="stats"><span>生命 <b>{number(enemy['hp'])}</b></span><span>速度 <b>{number(enemy['speed'])}</b></span><span>伤害 <b>{number(enemy['damage'])}</b></span></p>
<p class="muted">经验 {enemy['xp']}{trait}</p>{instead}</article>"""


def _boss_card(enemy: dict) -> str:
    moves = "".join(f'<p class="move">{esc(m["hint"])}</p>' for m in enemy["moves"] if m["hint"]) or '<p class="move">没有招式，只是血厚</p>'
    instead = f'<p class="muted">对应硅谷的「{esc(enemy["stands_for"])}」</p>' if enemy["stands_for"] else ""
    where = f'<p class="muted">出没：{esc("、".join(enemy["maps"]))}</p>' if enemy["maps"] else ""
    return f"""<article class="card small boss">{art(enemy['art'], 64, enemy['name'])}<h4>{esc(enemy['name'])}</h4>
<p>{esc(enemy['note'])}</p>{moves}{instead}{where}</article>"""


def achievements_section(data: dict) -> str:
    cards = []
    for item in data["achievements"]:
        if item.get("hidden"):
            continue
        tier, color = TIERS.get(item["tier"], ("", "#ddd"))
        cards.append(f"""<article class="card small">{art(item['art'], 44, item['name'])}<h4>{esc(item['name'])} <span class="tier" style="background:{color}">{esc(tier)}</span></h4>
<p class="muted">{esc(item['text'])}</p><p class="rate">{esc(item['rate'])}</p></article>""")
    shown = [item for item in data["achievements"] if not item.get("hidden")]
    counts = " · ".join(f"{name} {sum(1 for item in shown if item['tier'] == tier_id)} 个" for tier_id, (name, _) in TIERS.items())
    return section("achievements", "成就", f"一共 {len(shown)} 个，按难度分档：{counts}。只是徽章，不给加成。达成率是游戏里显示的数。",
                   f'<div class="grid">{"".join(cards)}</div>')


def faq_section(data: dict) -> str:
    # The save and the cloud save as DESIGN.md 2.10 / 2.11 describe them.
    items = [
        ("要注册吗？", "不用。打开就能玩，也不用登录。"),
        ("进度存在哪？", "存在这个浏览器里，同时自动传一份到云端。打卡和成就一拿到就存，中途关掉页面也不丢；图鉴和累计数据在一局结束时存。"),
        ("换手机、换浏览器怎么办？", "在游戏里的「设置 → 云存档」拿到 12 位存档码，在新设备上输入，两边的进度会合并在一起。"),
        ("清了浏览器数据，或者微信把存储清了，进度会丢吗？", "本机那份会丢，云端那份还在，但要输入存档码才能找回来。所以最好先在「设置 → 云存档」里把存档码记下来。"),
        ("不想要云存档了？", "「设置 → 云存档」里可以删除云存档，存档码当场作废，本机的进度保留。"),
        ("分享战绩有奖励吗？", "没有。结算页能生成战绩图，转发不给任何奖励。"),
    ]
    rows = "".join(f"<details><summary>{esc(question)}</summary><p>{esc(answer)}</p></details>" for question, answer in items)
    return section("faq", "问答", "", f'<div class="faq">{rows}</div>')


def how_section(data: dict) -> str:
    rows = "".join(f'<li><span class="at">{clock(e["at"])}</span>{esc(e["text"])}</li>' for e in data["events"])
    return section("how", "怎么玩", "", f"""<div class="grid wide how">
<article class="card"><h3>一局 10 分钟</h3><ul>
<li>武器全自动攻击，你只管走位</li>
<li>打死的怪掉经验星星，走近才会吸过来</li>
<li>升级时三选一：拿武器还是拿被动</li>
<li>每分钟来一个 boss，打掉必掉「年终奖」，按绩效白给升级；难得开出绩效 S 给一次「返聘」，被裁时可以选择回来</li>
<li>撑满 10:00 就能敲钟上市</li></ul>
<h3>操作</h3><ul><li>手机：按住屏幕任意处拖动（可选陀螺仪）</li><li>电脑：WASD 或方向键</li></ul></article>
<article class="card"><h3>一局的节奏</h3><p class="muted">boss 每局打乱、前后浮动 10 秒，这是写在代码里的排期：</p><ol class="timeline">{rows}</ol></article>
</div>""")


STYLE = """
:root{--ink:#2f3542;--muted:#666b7a;--paper:#fff;--soft:#faf7f0;--sunk:#f3efe6;--line:#e6e0d4;--brand:#f7c948;--brand-deep:#e0a91b;--brand-soft:#fdf1cc;--link:#2f6fb0}
*{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:64px}
body{margin:0;background:var(--soft);color:var(--ink);font:15px/1.6 -apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Noto Sans SC","Microsoft YaHei",sans-serif}
a{color:var(--link);text-decoration:none}a:hover{text-decoration:underline}
nav.top{position:sticky;top:0;z-index:5;background:rgba(255,255,255,.94);border-bottom:2px solid var(--ink);backdrop-filter:blur(6px)}
nav.top .inner{max-width:1080px;margin:0 auto;padding:10px 16px;display:flex;gap:6px;align-items:center;overflow-x:auto;white-space:nowrap;scrollbar-width:none}
nav.top .brand{font-weight:900;margin-right:8px}
nav.top a.link{color:var(--ink);padding:4px 10px;border-radius:999px;font-size:14px}
nav.top a.link:hover{background:var(--sunk);text-decoration:none}
nav.top a.play{margin-left:auto;background:var(--brand);border:2px solid var(--ink);border-radius:999px;padding:4px 14px;font-weight:800;color:var(--ink)}
main{max-width:1080px;margin:0 auto;padding:0 16px 48px}
header.hero{text-align:center;padding:48px 0 32px}
header.hero h1{font-size:44px;line-height:1.15;margin:16px 0 4px;font-weight:900;letter-spacing:1px}
header.hero .en{font-weight:800;color:var(--muted);letter-spacing:3px;font-size:13px}
header.hero p.tagline{font-size:18px;margin:16px auto 24px;max-width:560px}
.hero-art{display:flex;justify-content:center;gap:10px;flex-wrap:wrap}
.btn{display:inline-block;border:2px solid var(--ink);border-radius:999px;padding:12px 30px;font-weight:900;font-size:18px;color:var(--ink);background:var(--paper)}
.btn.primary{background:var(--brand);box-shadow:0 4px 0 var(--ink)}
.btn.primary:hover{text-decoration:none;transform:translateY(1px);box-shadow:0 3px 0 var(--ink)}
.btn:hover{text-decoration:none}
.hero .version{display:block;margin-top:14px;color:var(--muted);font-size:12px}
section{padding:28px 0 8px}
h2{font-size:28px;margin:0 0 6px;font-weight:900}
h2 .mark{background:linear-gradient(transparent 60%,var(--brand) 60%);padding:0 4px}
h3.sub{font-size:18px;margin:22px 0 10px}
p.intro{color:var(--muted);margin:0 0 14px;max-width:760px}
.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(200px,1fr))}
.grid.wide{grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
.grid.how{grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}
.grid.stamps{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
.card{background:var(--paper);border:2px solid var(--line);border-radius:16px;padding:14px;min-width:0}
.card h3{margin:0;font-size:17px}.card h4{margin:6px 0 2px;font-size:15px}
.card p{margin:6px 0}.card ul,.card ol{margin:6px 0;padding-left:20px}.card li{margin:2px 0}
.card.small{padding:12px}
.card .head{display:flex;gap:12px;align-items:center}
.card.stamp,.card.small{text-align:left}
.card.boss{border-color:#f2b8b8;background:#fffafa}
.muted{color:var(--muted);font-size:13px}
.stats{display:flex;gap:12px;flex-wrap:wrap;font-size:13px;color:var(--muted)}.stats b{color:var(--ink);font-size:15px}
.weapon{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.quote{font-size:13px;color:var(--muted)}
.tag{display:inline-block;font-size:12px;font-weight:700;padding:1px 8px;border-radius:999px}
.tag.plain{background:var(--sunk);color:var(--ink)}
.tier{display:inline-block;font-size:11px;font-weight:800;padding:0 7px;border-radius:999px;color:var(--ink);vertical-align:2px}
.lv{display:inline-block;width:34px;font-size:12px;font-weight:800;color:var(--muted)}
ol li .lv{margin-left:-4px}
.card ol{list-style:none;padding-left:0}
.bonus{display:inline-block;background:var(--brand-soft);border-radius:999px;padding:1px 10px;font-weight:800;font-size:13px}
.move{background:#fff0f0;border-radius:10px;padding:4px 8px;font-size:13px}
.hours{display:inline-block;background:var(--ink);color:#fff;border-radius:999px;padding:0 10px;font-size:13px;vertical-align:3px}
.soon{margin-top:10px}
.tabs{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 4px}
.tab{font:inherit;font-weight:800;border:2px solid var(--ink);background:var(--paper);border-radius:999px;padding:4px 16px;cursor:pointer;color:var(--ink)}
.tab[aria-selected=true]{background:var(--brand)}
.panel[hidden]{display:none}
.affixes{background:var(--paper);border:2px solid var(--line);border-radius:16px;padding:12px 12px 12px 32px}
.timeline{list-style:none;padding:0}.timeline li{display:flex;gap:10px;border-bottom:1px dashed var(--line);padding:4px 0}
.at{font-weight:800;min-width:40px;white-space:nowrap;flex:none}
.how ul{padding-left:20px}
img.art{display:block;object-fit:contain;flex:none}
.card.small img.art,.card.stamp img.art{margin:0 auto 0 0}
.card.stat h3{display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap}
.start{font-size:13px;font-weight:800;background:var(--brand-soft);border-radius:999px;padding:1px 10px}
.row{display:flex;gap:8px;align-items:flex-start;font-size:14px}
.pin{flex:none;font-size:12px;font-weight:800;background:var(--sunk);border-radius:999px;padding:1px 8px;margin-top:2px}
.scroll{overflow-x:auto;margin:8px 0}
table.nums{border-collapse:collapse;font-size:13px;width:100%}
table.nums th,table.nums td{padding:4px 6px;text-align:left;border-bottom:1px solid var(--line);white-space:nowrap}
table.nums th{color:var(--muted);font-weight:700}.who{display:inline-flex;gap:6px;align-items:center}
details summary{cursor:pointer;font-weight:700;font-size:13px;margin-top:6px}
.mob{display:inline-flex;gap:4px;align-items:center;margin:0 10px 2px 0}
.rate{font-size:12px;color:var(--muted);margin:2px 0 0}
.faq details{background:var(--paper);border:2px solid var(--line);border-radius:16px;padding:10px 14px;margin-bottom:8px}
.faq details summary{font-size:15px}
.faq details p{margin:8px 0 0}
footer{text-align:center;color:var(--muted);font-size:12px;padding:24px 16px 40px}
@media (max-width:560px){header.hero h1{font-size:34px}h2{font-size:24px}.grid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}.grid.wide{grid-template-columns:1fr}}
"""

SCRIPT = """
document.querySelectorAll('img[data-art]').forEach(function (img) { var src = ART[img.dataset.art]; if (src) img.src = src; });
var tabs = document.querySelectorAll('.tab'), panels = document.querySelectorAll('.panel');
function show(index) {
  tabs.forEach(function (tab) { tab.setAttribute('aria-selected', tab.dataset.tab == index); });
  panels.forEach(function (panel) { panel.hidden = panel.dataset.panel != index; });
}
tabs.forEach(function (tab) { tab.addEventListener('click', function () { show(tab.dataset.tab); }); });
document.querySelectorAll('a[data-tab]').forEach(function (link) { link.addEventListener('click', function () { show(link.dataset.tab); }); });
show(0);
"""


def build(data: dict, art_dir: pathlib.Path) -> str:
    body = "".join([how_section(data), jobs_section(data), stats_section(data), weapons_section(data), passives_section(data),
                    upgrades_section(data), maps_section(data), difficulty_section(data), stamps_section(data), bestiary_section(data),
                    achievements_section(data), faq_section(data)])
    hero_arts = "".join(art(name, 56) for name in [data["jobs"][0]["art"], "bug", "meeting", "deadline", "ai_boss", "chest", "bell"])
    page = f"""<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>大厂幸存者 · Big Tech Survivors</title>
<meta name="description" content="大厂幸存者：割草类 roguelike，躲开 Bug、会议和 Deadline，撑过 10 分钟就能敲钟上市。职业、属性、武器、被动、升级、地图、难度、打卡点和怪物图鉴。">
<meta property="og:title" content="大厂幸存者 Big Tech Survivors"><meta property="og:description" content="躲开 Bug、会议和 Deadline，撑过 10 分钟就能敲钟上市。打开网页就能玩。">
<meta property="og:image" content="https://survivors.lab115.com/index.png"><meta property="og:url" content="https://survivors.lab115.com/">
<meta name="theme-color" content="#f7c948">
<style>{STYLE}</style></head><body>
<nav class="top"><div class="inner"><span class="brand">大厂幸存者</span>
<a class="link" href="#how">怎么玩</a><a class="link" href="#jobs">职业</a><a class="link" href="#stats">属性</a><a class="link" href="#weapons">武器</a><a class="link" href="#passives">被动</a><a class="link" href="#upgrades">升级</a><a class="link" href="#maps">地图</a><a class="link" href="#difficulty">难度</a><a class="link" href="#stamps">打卡点</a><a class="link" href="#bestiary">图鉴</a><a class="link" href="#achievements">成就</a><a class="link" href="#faq">问答</a>
<a class="play" href="{PLAY_URL}">开始玩</a></div></nav>
<main><header class="hero"><div class="hero-art">{hero_arts}</div>
<h1>大厂幸存者</h1><div class="en">BIG TECH SURVIVORS</div>
<p class="tagline">躲开 Bug、会议和 Deadline，撑过 10 分钟就能敲钟上市。<br>打开网页就能玩，手机单手、电脑键盘都行。</p>
<a class="btn primary" href="{PLAY_URL}">开始搬砖</a>
<span class="version">版本 {esc(data['version'])} · 本页内容由游戏数据生成</span></header>
{body}</main>
<footer>大厂幸存者 · 所有公司名、招牌都是自己画的谐音梗，与真实公司无关 · <a href="{PLAY_URL}">survivors.lab115.com/play</a></footer>
<script>var ART = {json.dumps(_arts(data, body + hero_arts, art_dir), ensure_ascii=False)};{SCRIPT}</script>
</body></html>"""
    return page


def _arts(data: dict, page: str, art_dir: pathlib.Path) -> dict:
    """Every art the page names, as a data URI."""
    import re
    names = sorted(set(re.findall(r'data-art="([^"]+)"', page)))
    arts = {}
    for name in names:
        path = art_dir / f"{html.unescape(name)}.svg"
        if path.exists():
            arts[html.unescape(name)] = "data:image/svg+xml;base64," + base64.b64encode(path.read_bytes()).decode()
    return arts


def main() -> None:
    if len(sys.argv) != 4:
        sys.exit("usage: build_site.py <compendium.json> <art dir> <out.html>")
    data = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
    out = pathlib.Path(sys.argv[3])
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(build(data, pathlib.Path(sys.argv[2])), encoding="utf-8")
    print(f"wrote {out} ({out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
