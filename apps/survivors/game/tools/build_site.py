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
COMING_SOON_NAMES = {"blr": "班加罗尔"}
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
<p class="weapon">大招 <b>{esc(job['ultimate']['name'])}</b>（击杀充能）：{esc(job['ultimate']['text'])}</p>
<p class="quote">口头禅：{lines}</p></article>""")
    return section("jobs", "职业", "开局选一个职业，带着它的专属武器上班。生命都是 100；近身打的护甲多一点，打得远的跑得快一点。每个职业还有一个大招，开局是空的，靠打怪充能：一只小怪 1 点、一个 boss 20 点，攒满 500 点放一次，生效期间不充（手机点右上角的按钮，电脑按空格），什么时候放自己挑；放的时候屏幕上方写着它干什么，持续的大招按钮上有倒计时。",
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
     '升级卡更容易出稀有的，升级时有几率多出一张卡（见<a href="#upgrades">升级</a>）。年终奖开出哪档绩效和运气无关。'),
]
# Each STAT_ROWS key's 培训 stat (Training.STATS ids).
TRAINING_OF = {"max_hp": "max_hp", "might": "might", "cooldown_scale": "haste", "move_speed": "speed",
               "pickup_radius": "magnet", "armor": "armor", "regen": "regen", "luck": "luck"}


def stats_section(data: dict) -> str:
    stats, jobs = data["stats"], data["jobs"]
    passives = {p["id"]: p for p in data["passives"]}
    stamps = [stamp for game_map in data["maps"] for stamp in game_map["stamps"]]
    training = {entry["id"]: entry for entry in data["training"]["stats"]}
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
        # Each landmark's bonus of this kind, with how many give it (none for some since .44).
        counts = {}
        for stamp in stamps:
            if stamp_kind and stamp["kind"] == stamp_kind:
                counts[stamp["bonus"]] = counts.get(stamp["bonus"], 0) + 1
        if counts:
            given = "、".join(f"{esc(text)}（{count} 个）" for text, count in counts.items())
            lines.append(f'<p class="row"><span class="pin">打卡</span><span>{given}，全部打满 '
                         f'<b>{esc(total(start, stats["all_stamps"][key]))}</b></span></p>')
        else:
            lines.append('<p class="row"><span class="pin">打卡</span><span class="muted">没有地标加这一项</span></p>')
        trained = training[TRAINING_OF[key]]
        lines.append(f'<p class="row"><span class="pin">培训</span><span>每级 {esc(trained["step_text"])}，'
                     f'最多 {trained["ranks"]} 级，练满 <b>{esc(trained["max_text"])}</b></span></p>')
        cards.append(f"""<article class="card stat"><h3>{esc(name)} <span class="start">开局 {esc(opening)}</span></h3>
<p class="muted">{note}</p>{"".join(lines)}</article>""")
    cards.append(f"""<article class="card stat"><h3>受击无敌 <span class="start">{number(stats['invuln_seconds'])} 秒</span></h3>
<p class="muted">挨一下之后这么久不再扣血，被一群怪围住也不会一下掉光。不能升级。</p></article>""")
    return section("stats", "属性", "主角就这几项属性，局里按暂停能看到当前的数。开局的生命、护甲、移速看职业；之后靠被动往上加（卡越稀有加得越多，见"
                   '<a href="#upgrades">升级</a>）。局外还有两样永久加成：打卡，每个地标给一项；'
                   '<a href="#training">培训</a>，用年终奖和红包发的工资练。',
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


def branch_table(levels: list, names: dict) -> str:
    """One direction of a job weapon at every level of it (Upgrades.branch_stats, the other direction
    left at 0): the numbers that change, folded away."""
    keys = [key for key in names if len({str(level.get(key)) for level in levels}) > 1]
    if not keys:
        return ""
    head = "".join(f"<th>{esc(names[key])}</th>" for key in keys)
    rows = "".join(f'<tr><td class="lv">{"开局" if i == 0 else f"+{i}"}</td>' + "".join(f"<td>{stat_value(key, level[key]) if key in level else ''}</td>" for key in keys) + "</tr>"
                   for i, level in enumerate(levels))
    return f'<details><summary>每级数值</summary><div class="scroll"><table class="nums"><tr><th></th>{head}</tr>{rows}</table></div></details>'


def weapons_section(data: dict) -> str:
    jobs = {job["id"]: job["name"] for job in data["jobs"]}
    names = dict(data["weapon_stat_names"])
    own, public = [], []
    for weapon in data["weapons"]:
        kind = data["weapon_types"][weapon["type"]]
        if weapon.get("branches"):
            branches = "".join(f'<li><b>{esc(b["name"])}</b>：{esc(b["text"])}{branch_table(weapon["branch_levels"][key], names)}</li>'
                               for key, b in weapon["branches"].items())
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


def passive_levels(passive: dict) -> str:
    """A passive at every level on one line: a stat passive's running total at 普通 rarity, a perk's
    table with what changes by level as a list."""
    shown = " / ".join(esc(total) for total in passive["levels"]) if passive["stat"] else esc(passive["table"])
    return f'<p class="levels"><span class="span">Lv1–{passive["max"]}</span>{shown}</p>'


def passives_section(data: dict) -> str:
    cards = "".join(f"""<article class="card small"><div class="head">{art(p['art'], 44, p['name'])}<div><h3>{esc(p['name'])}</h3>
<p class="muted">{esc(p['text'])}{'（每级）' if p['stat'] else ''}</p></div></div>{passive_levels(p)}</article>""" for p in data["passives"])
    return section("passives", "被动", '一局最多带 6 种被动，大多能升 5 级。升级卡有稀有度（白 / 绿 / 蓝 / 紫 / 橙），越稀有给得越多；「锦鲤」加运气，更容易出好卡（见<a href="#upgrades">升级</a>）。'
                   '加数值的被动写的是全拿普通卡时升到这一级的累计（移速、冷却、拾取范围是一级一级乘上去的）。',
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
    # The whole curve (.72, the user: 升一级要的经验全都列出来放到网站上): each level, what the next one
    # takes and the total from level 1. The steps are read off the curve, not written in.
    early_step, late_step = xp[5] - xp[4], xp[-1] - xp[-2]
    late_from = next(level for level in range(6, len(xp)) if xp[level] - xp[level - 1] == late_step)
    total = 0
    xp_rows = []
    for level, amount in enumerate(xp, start=1):
        total += amount
        xp_rows.append(f"<tr><td>L{level} → L{level + 1}</td><td>{amount}</td><td>{total:,}</td></tr>")
    xp_card = f"""<article class="card"><h3>经验和职级</h3><ul>
<li>升一级要的经验：前 4 级 {" / ".join(str(amount) for amount in xp[:4])}，之后每级多要 {early_step}，{late_from} 级以后每级多要 {late_step}（全表见下）</li>
<li>从头升到 {"、".join(f"L{level} 一共要 {amount}" for level, amount in reach.items())}</li>
<li>等级就是职级：{ranks}</li>
<li>每次升级三选一，运气好多一张；专属武器第 {job_levels} 级必出</li>
<li>不想要这几张可以<b>刷新</b>换一批（张数不变，到点必出的专属武器那两张留着）：每局默认 1 次，<a href="#training">培训</a>每级多 1 次，最多 6 次，用完这局就没了</li></ul>
<div class="scroll tall"><table class="nums"><thead><tr><th>等级</th><th>升下一级要</th><th>从 L1 累计</th></tr></thead><tbody>{"".join(xp_rows)}</tbody></table></div></article>"""

    rows = []
    for rarity in rarities:
        # A weapon's own damage and a perk with its own way of working (股票期权, 背锅侠…) both take
        # the tier's `bonus` for good (.53; until then such a perk jumped extra levels instead).
        rows.append(f"<tr><td>{rarity_tag(rarity)}</td><td>{percent(rarity['weight'] / 100)}</td><td>×{number(rarity['scale'])}</td>"
                    f"<td>+{percent(rarity['bonus'])}</td><td>+{percent(rarity['bonus'])}</td></tr>")
    rarity_card = f"""<article class="card"><h3>升级卡稀有度</h3>
<p class="muted">每张武器卡和被动卡都抽一个稀有度，等级照常 +1，越稀有这一步给得越多。</p>
<div class="scroll"><table class="nums"><tr><th></th><th>概率</th><th>数值被动</th><th>武器伤害</th><th>其他被动效果</th></tr>{"".join(rows)}</table></div>
<p class="muted">概率是运气 0 时的。「数值被动」（冰美式这种加数的）这一级加的量乘这么多，比如冰美式 +10% 变 +20%；「武器伤害」是这一把武器永久多的伤害，同一把能叠；「其他被动效果」（股票期权这种有自己玩法的）是这个被动的效果永久多这么多（背锅侠的反伤倍数、降本增效和开源项目的几率、股票期权每分钟加的伤害，站会是间隔缩短），同一个能叠。</p></article>"""

    luck = data["luck"]
    head = "".join(f"<th>{rarity_tag(rarity)}</th>" for rarity in rarities)
    card_rows = "".join(f"<tr><td><b>{number(row['luck'])}</b></td>" + "".join(f"<td>{percent(share)}</td>" for share in row["cards"]) + "</tr>" for row in luck)
    more_rows = "".join(f"<tr><td><b>{number(row['luck'])}</b></td><td>{percent(row['extra_card'])}</td></tr>" for row in luck)
    luck_card = f"""<article class="card"><h3>运气</h3>
<p class="muted">运气来自被动「锦鲤」、打卡和培训。每点让优秀及以上每一档的几率多 1%，逐档复利，越稀有的涨得越多。运气最多 {number(data['max_luck'])}，打卡、培训和锦鲤加起来超过也按 {number(data['max_luck'])} 算（拉满时优秀也不会比普通多），到了以后升级不再出锦鲤。年终奖开出哪档绩效和运气无关。</p>
<div class="scroll"><table class="nums"><tr><th>运气</th>{head}</tr>{card_rows}</table></div>
<div class="scroll"><table class="nums"><tr><th>运气</th><th>升级时多一张卡</th></tr>{more_rows}</table></div></article>"""

    return section("upgrades", "升级", '打怪捡星星升级，升级时选卡；打掉 boss 开的年终奖还白送一个升级（见<a href="#drops">掉落</a>）。',
                   f'<div class="grid wide">{xp_card}{rarity_card}{luck_card}</div>')


def salary_text(chest: dict) -> str:
    """A year-end bonus rating's 工资: since .70 one amount per boss, the 1st to the 4th (just the one
    when they're all the same, 绩效 S)."""
    amounts = chest["salary"]
    return f"¥{amounts[0]}" if min(amounts) == max(amounts) else "¥" + " / ".join(str(amount) for amount in amounts)


def drops_section(data: dict) -> str:
    """What enemies drop, each with its art (its own section since .46: the user couldn't find 奶茶's
    drop rate inside 升级; 午休 and 红包 since .61). A year-end bonus says what each rating gives and,
    again from .60 (the user: 官网写上), how likely it is; .46–.59 left that out (年终奖的概率藏起来不要可见)."""
    drops, rarities = data["drops"], data["rarities"]
    revive = drops["revive"]

    def card(art_name: str, title: str, body: str) -> str:
        return f"""<article class="card"><div class="head">{art(art_name, 48, title)}<div><h3>{esc(title)}</h3>
<p class="muted">{body}</p></div></div></article>"""

    small = [
        card("star_blue", "经验星星", f"每只怪都掉，走近才会吸过来，攒够就升级。地上超过 {drops['max_pickups']} 个时，新掉的经验并进已有的星星。"),
        card("boba", "珍珠奶茶", f"只在地上的快递里开出来，boss 和普通怪都不掉。捡到回 {number(drops['heal_amount'])} 生命。"),
        card("magnet", "磁铁", f"升到 {drops['magnet_from_level']} 级以后，普通怪有 {percent(drops['magnet_chance'])} 的几率掉。捡到时屏幕里的星星一起飞过来（屏幕外的不算）。"),
        card("nap", "午休", f"升到 {drops['nap_from_level']} 级以后，普通怪有 {percent(drops['nap_chance'])} 的几率掉。捡到时全图的怪原地定住 {number(drops['nap_seconds'])} 秒，boss 也一样，这期间新来的怪也定住；定住的怪贴身照样扣血，boss 已经落地的圈照样会炸。"),
        card("red_packet", "红包", f"从开局起，普通怪有 {percent(drops['red_packet_chance'])} 的几率掉。捡到发工资 "
             + "、".join(f"¥{amount}" for amount in drops["red_packet_salary"]) + " 里随机一个，当场存进存档，和年终奖的工资一样在<a href=\"#training\">培训</a>里花。"),
    ]
    # Every rating: its odds, its 工资 (one amount since .63; before, the range of the amounts it
    # picked from, the whole list made the table too wide for its card) and its upgrade's colour.
    chest_total = sum(chest["weight"] for chest in drops["chests"])
    ratings = "".join(
        f"<tr><td><b>{esc(chest['name'])}</b></td><td>{percent(chest['weight'] / chest_total)}</td><td>{salary_text(chest)}</td>"
        f"<td>{esc(rarities[chest['rarity']]['colour'])} {rarity_tag(rarities[chest['rarity']])}</td></tr>"
        for chest in drops["chests"])
    chest_card = f"""<article class="card"><div class="head">{art("chest", 48, "年终奖")}<div><h3>年终奖</h3>
<p class="muted">打掉 boss 就发：不掉在地上、不用捡，boss 倒下后自动开箱，开出一档绩效：按绩效发工资，同时白送一个局内升级。</p></div></div>
<div class="scroll"><table class="nums"><tr><th>绩效</th><th>概率</th><th>工资（第 1 / 2 / 3 / 4 个 boss）</th><th>送的升级</th></tr>{ratings}</table></div>
<p class="muted">送的升级当场生效：从身上已有、还没满级的武器和被动里随机挑一个，升一级，稀有度按绩效定；身上的都满了才出新的。工资看绩效，也看是第几个 boss（按出场顺序 2:00 / 4:00 / 6:00 / 8:00，不按打死的先后），越后面的发得越多，都是 66、88 结尾的吉利数，存进存档，在<a href="#training">培训</a>里花。开出哪档绩效和运气无关。</p></article>"""
    rehire_card = card("rehire", "返聘", f"不是掉的，在<a href=\"#training\">培训</a>里买，¥{data['training']['revive_price']} 一个，存进存档，攒多少个都行。被裁（生命归零）时弹窗问你用不用："
                       f"用就回到 {percent(revive['hp'])} 生命、{number(revive['invuln'])} 秒无敌，身边的怪被震开；不用就下班，返聘留着。每局最多用一个。")
    return section("drops", "掉落", "打怪会掉东西，走近就捡；打掉 boss 自动开年终奖。地上还有快递、会议室这些，见<a href=\"#objects\">地图上的东西</a>。",
                   f'<div class="grid">{"".join(small)}</div><div class="grid wide">{chest_card}{rehire_card}</div>')


def objects_section(data: dict) -> str:
    """The things laid about the map at random each run (.99, MapObjects), with their numbers."""
    objects = data["map_objects"]
    loot_names = {"red_packet": "红包", "heal": "珍珠奶茶", "magnet": "磁铁", "nap": "午休", "xp": "一把经验"}
    loot_total = sum(entry[1] for entry in objects["parcel_loot"])
    loot = "、".join(f"{loot_names[entry[0]]} {percent(entry[1] / loot_total)}" for entry in objects["parcel_loot"])

    def card(art_name: str, title: str, body: str) -> str:
        return f"""<article class="card"><div class="head">{art(art_name, 48, title)}<div><h3>{esc(title)}</h3>
<p class="muted">{body}</p></div></div></article>"""

    cards = [
        card("parcel", "快递", f"地上一直有 {objects['parcels']} 个，碰一下就开，一定有东西：{loot}。"
             f"经验是 {objects['parcel_xp']} 点，每过一分钟多 {objects['parcel_xp_per_minute']} 点。开掉一个，{number(objects['parcel_respawn'])} 秒后在别处补一个。"),
        card("meeting_room", "紧急会议室", f"每局 {objects['rooms']} 间。站进圈里就开会：四周围上来 {objects['room_elites']} 个金色精英（当时的小怪，生命 ×{number(objects['room_elite_health'])}），"
             f"{number(objects['room_seconds'])} 秒内全打掉就开一个年终奖（按第 1 个 boss 的工资，也送一个升级）；没打完，精英留下，什么都不给。"),
        card("paper", "加班申请", f"每局 {objects['forms']} 张。站进圈里 {number(objects['form_sign'])} 秒签字，签了不能撤："
             f"之后来的怪生命 +{percent(objects['form_health'])}，这局的年终奖和红包 +{percent(objects['form_reward'])}；每签一张再叠一次。"),
        card("monitors", "工位", f"每局 {objects['desks']} 个，{percent(objects['golden_desk_chance'])} 的局再多一个金色的。在圈里累计站满 {number(objects['desk_charge'])} 秒（出圈会往回退），"
             f"三选一拿一项属性：伤害、冷却、生命、护甲、移速、拾取、运气、回血里随机三项，数值是同名被动一级的 {percent(objects['desk_share'])}，稀有度照升级卡的规则抽，不占被动格；"
             f"金色工位三张都是史诗或传说（传说 {percent(objects['golden_desk_legendary'])}）。"),
    ]
    return section("objects", "地图上的东西", "每局随机放在地图上，位置每局不同。左上角的小地图用圆点标出来：自己墨色、打卡点黄色、boss 红色、快递棕色、会议室蓝色（开会中闪红）、加班申请紫色、工位绿色（金色工位金色）；小怪不画。",
                   f'<div class="grid">{"".join(cards)}</div>')


def training_section(data: dict) -> str:
    training = data["training"]
    chests = data["drops"]["chests"]
    salaries = "，".join(salary_text(chest) for chest in chests)
    rating_letters = " / ".join(chest["name"].replace("绩效 ", "") for chest in chests)
    rows = "".join(
        f"<tr><td>{art(entry['art'], 24, entry['name'])}<b>{esc(entry['name'])}</b></td><td>{esc(entry['step_text'])}</td>"
        f"<td>{entry['ranks']}</td><td>{' / '.join(f'¥{price}' for price in entry['prices'])}</td><td>{esc(entry['max_text'])}</td></tr>"
        for entry in training["stats"])
    card = f"""<article class="card"><h3>能练什么</h3>
<div class="scroll"><table class="nums"><tr><th>属性</th><th>每级</th><th>级数</th><th>每级价格</th><th>练满</th></tr>{rows}</table></div>
<p class="muted">每升一级比上一级多第 1 级价格的一半（第 1 / 2 / 3 / 4 / 5 级是第 1 级的 1 / 1.5 / 2 / 2.5 / 3 倍），练别的项不会让它变贵。全部练满一共 ¥{training['full_cost']:,}。</p></article>"""
    how = f"""<article class="card"><h3>工资和退款</h3><ul>
<li>工资主要从年终奖来，拿到<a href="#achievements">成就</a>也按档发一笔：绩效 {rating_letters} 分别发 {salaries}（第 1 / 2 / 3 / 4 个 boss，越后面的越多，都是 66、88 结尾的吉利数），boss 打得越多挣得越多；普通怪偶尔掉<b>红包</b>，一个 ¥{min(data["drops"]["red_packet_salary"])}–{max(data["drops"]["red_packet_salary"])}（见<a href="#drops">掉落</a>）</li>
<li>工资存进存档，一局结束也不清零，在首页的「培训」里花</li>
<li>练的等级每局开局都带着，和打卡的加成叠加</li>
<li>「刷新」不是属性：每级让每局多刷新 1 次升级卡（默认 1 次，练满 6 次，见<a href="#upgrades">升级</a>）</li>
<li>「全部退款」把练等级花掉的工资全部退回，可以重新分配</li>
<li>这里还卖<b>返聘</b>：¥{training['revive_price']} 一个，被裁时可以选择回来（见<a href="#drops">掉落</a>），用掉就没了，退款不退</li></ul></article>"""
    return section("training", "培训", "参考吸血鬼幸存者的局外商店：年终奖和红包发的工资攒下来，用来永久升级基础属性。",
                   f'<div class="grid wide">{card}{how}</div>')


def difficulty_section(data: dict) -> str:
    pacing = data["pacing"]
    minute_rows = "".join(f"<tr><td>{minute['minute']}:00</td><td>{number(round(minute['rate'], 1))}</td><td>×{number(round(minute['hp'], 2))}</td></tr>"
                          for minute in pacing["minutes"])
    # The map's own health multiplier (硅谷 ×1.25 since .99) on top of the minute's in the table.
    map_hp = data["maps"][0]["difficulty"]["hp"]
    map_hp_note = f"；表里是每分钟的倍率，地图本身还要再 ×{number(map_hp)}" if map_hp != 1.0 else ""
    curve_card = f"""<article class="card"><h3>怪越来越多、越来越抗打</h3>
<div class="scroll"><table class="nums"><tr><th>时间</th><th>每秒刷怪</th><th>怪物生命</th></tr>{minute_rows}</table></div>
<p class="muted">怪物生命每分钟 +{percent(pacing['hp_per_minute'])}，boss 也一样{map_hp_note}。场上到了 {pacing['max_alive']} 只就先停刷。</p></article>"""

    start, wave_rows = 0.0, []
    for wave in pacing["waves"]:
        total = sum(mob["weight"] for mob in wave["mix"])
        mobs = "".join(f'<span class="mob">{art(mob["art"], 24, mob["name"])}{esc(mob["name"])} {percent(mob["weight"] / total)}</span>' for mob in wave["mix"])
        wave_rows.append(f'<li><span class="at">{clock(start)}–{clock(wave["until"])}</span><span>{mobs}</span></li>')
        start = wave["until"]
    rings = "、".join(f"{clock(event['at'])} {esc(event['text'].rstrip('！'))}" for event in data["events"] if event["kind"] == "ring")
    waves_card = f"""<article class="card"><h3>什么时候出什么小怪</h3><ol class="timeline">{"".join(wave_rows)}</ol>
<p class="muted">另外还有包围圈：{rings}。</p></article>"""

    slot_rows = "".join(f"<tr><td>{clock(slot['at'])}{' 最后一战' if index == len(pacing['boss_slots']) - 1 else ''}</td><td>{number(round(slot['hp_then'] * map_hp))}</td>"
                        f"<td>{number(slot['damage'])}</td><td>{slot['xp']}</td></tr>" for index, slot in enumerate(pacing["boss_slots"]))
    bosses_card = f"""<article class="card"><h3>boss 排期</h3>
<p class="muted">一局 4 个 boss，2:00、4:00、6:00、8:00 各来一个，每个时间点从 5 个 boss 里随机抽一个：同一时间点的生命、速度、伤害一样，招式不同（见<a href="#bestiary">怪物图鉴</a>）。
boss 朝你走 {number(pacing['walk_seconds'])} 秒（在屏幕里才算），出一招，再走，一直循环。攻击只有三类：近战（它自己冲、扫、跳、砸）、定点（地上出红色区域，到时间炸）、远程（发子弹）。
前三个各是一类；最后一战两类两招轮流出，{clock(pacing['phase_two_at'])} 进二阶段：近战更宽更远、定点范围更大、远程更密。没打死的 boss 不会走，下一个照样到点来，场上最多同时 4 个。</p>
<div class="scroll"><table class="nums"><tr><th>时间</th><th>出场生命</th><th>伤害</th><th>经验</th></tr>{slot_rows}</table></div>
<p class="muted">出场生命已经乘上那一刻的生命倍率和地图的倍率。伤害是碰到它的伤害，招式的伤害见<a href="#bestiary">怪物图鉴</a>。</p></article>"""
    return section("difficulty", "难度", "一局越往后越难：怪越刷越多、越来越抗打，每两分钟来一个 boss。",
                   f'<div class="grid wide">{curve_card}{waves_card}{bosses_card}</div>')


def map_plan(game_map: dict) -> str:
    """The map seen from above (.77, the user: 改完后加到网站上): its square of land, every block in
    its district's ground colour with the roads between, the freeways and the railway, where a run
    starts and the five check-in spots with the time each opens. Drawn in world pixels."""
    layout = game_map["layout"]
    left, top, width, height = layout["bounds"]
    right, bottom = left + width, top + height
    block_w, block_h = layout["block"]
    road = 20.0
    shapes = [f'<rect x="{left}" y="{top}" width="{width}" height="{height}" fill="#e3e5e9"/>']
    for block in layout["blocks"]:
        # A block's lawn inside its roads, cut at the map's edge.
        x0 = max(block["x"] * block_w + road, left)
        y0 = max(block["y"] * block_h + road, top)
        x1 = min((block["x"] + 1) * block_w - road, right)
        y1 = min((block["y"] + 1) * block_h - road, bottom)
        if x1 > x0 and y1 > y0:
            shapes.append(f'<rect x="{x0:g}" y="{y0:g}" width="{x1 - x0:g}" height="{y1 - y0:g}" fill="{block["ground"]}"/>')
    for freeway in layout["freeways"]:
        x = freeway["column"] * block_w
        y0 = max(freeway["from_row"] * block_h, top)
        shapes.append(f'<line x1="{x}" y1="{y0:g}" x2="{x}" y2="{bottom}" stroke="#a3a9b4" stroke-width="56"/>'
                      f'<line x1="{x}" y1="{y0:g}" x2="{x}" y2="{bottom}" stroke="#f7c948" stroke-width="8"/>')
    railway = layout["railway"]
    rail_x = railway["column"] * block_w + 44
    rail_top = max(railway["from_row"] * block_h, top)
    rail_bottom = min((railway["to_row"] + 1) * block_h, bottom)
    shapes.append(f'<line x1="{rail_x}" y1="{rail_top:g}" x2="{rail_x}" y2="{rail_bottom:g}" stroke="#8a5a3c" stroke-width="20" stroke-dasharray="44 22"/>')
    start_x, start_y = layout["start"]
    shapes.append(f'<circle cx="{start_x}" cy="{start_y}" r="58" fill="#f7c948" stroke="#2f3542" stroke-width="14"/>')
    shapes.append(f'<rect x="{left}" y="{top}" width="{width}" height="{height}" fill="none" stroke="#2f3542" stroke-width="40"/>')
    svg = (f'<svg viewBox="{left:g} {top:g} {width:g} {height:g}" aria-hidden="true">' + "".join(shapes) + "</svg>")
    pins = []
    for stamp in game_map["stamps"]:
        column, row = stamp["block"]
        x = ((column + 0.5) * block_w - left) / width * 100
        y = ((row + 0.5) * block_h - top) / height * 100
        pins.append(f'<span class="pin" style="left:{x:.1f}%;top:{y:.1f}%" title="{esc(stamp["name"])}">'
                    f'{art(stamp["art"], 30, stamp["name"])}<b>{clock(stamp["opens"])}</b></span>')
    return (f'<div class="plan">{svg}{"".join(pins)}</div>'
            '<p class="muted plan-key">黄点是出生点；灰色宽路是高速，棕色虚线是铁轨；图标是 5 个打卡点和开门时间。</p>')


def maps_section(data: dict) -> str:
    cards = []
    for game_map in data["maps"]:
        difficulty = game_map["difficulty"]
        hard = "基准难度" if difficulty["hp"] <= 1.0 else f"怪物生命 ×{number(difficulty['hp'])} · 伤害 ×{number(difficulty['damage'])} · 刷怪 ×{number(difficulty['spawn'])}"
        event = game_map["event"]
        # The weather is drawn per run from every map's since .99 (Spawner._draw_weather).
        weathers = "".join(f"<li><b>{esc(weather['name'])}</b>：{esc(weather['detail'])}</li>" for weather in data["weathers"])
        cards.append(f"""<article class="card map">
<h3>{esc(game_map['name'])} <span class="stars" title="难度 {game_map['stars']} 星">{"★" * game_map['stars']}<span class="off">{"★" * (game_map['max_stars'] - game_map['stars'])}</span></span></h3>
{map_plan(game_map)}
<p class="muted">{esc(hard)} · 职级 {esc(game_map['rank_prefix'])}1、{esc(game_map['rank_prefix'])}2…</p>
<p><b>分区</b>：{esc('、'.join(game_map['districts']))}</p>
<p><b>天气</b>（{clock(event['at'])} 起，持续 {number(event['seconds'])} 秒，每局从 {len(data['weathers'])} 种里随机抽一种）：</p><ul>{weathers}</ul>
<p><b>boss</b>：2:00、4:00、6:00、8:00 各从 5 个里随机抽一个，见<a href="#bestiary">怪物图鉴</a></p>
<p><a href="#stamps-{esc(game_map['id'])}">{len(game_map['stamps'])} 个打卡点 ›</a>　<a href="#bestiary">怪物 ›</a></p></article>""")
    # Only 硅谷 is on offer since .99 (Maps.ORDER), so the text speaks of the one map and the
    # 还在装修 line goes when nothing is coming (Maps.COMING_SOON empty).
    soon = "、".join(COMING_SOON_NAMES.get(city, city) for city in data["coming_soon"])
    soon_line = f'<p class="muted soon">还在装修：{esc(soon)}</p>' if soon else ""
    return section("maps", "地图", "现在只有硅谷一张地图：一块空旷的方形地，四边是栅栏，哪里都能走；"
                   "地上只有 5 个打卡点：中间是 Goggle 总部，四个角是湾区地标。5:00 来一次天气，天气和 4 个 boss 每局随机抽；地上还随机放着<a href=\"#objects\">快递、会议室这些</a>。"
                   "路上的车和火车不扣血，只会把人和怪推到路边；火车来之前铁轨会先闪。",
                   f'<div class="grid wide">{"".join(cards)}</div>{soon_line}')


def stamps_section(data: dict) -> str:
    blocks = []
    for game_map in data["maps"]:
        cards = "".join(f"""<article class="card stamp">{art(s['art'], 72, s['name'])}<h4>{esc(s['name'])}</h4>
<p class="muted">{clock(s['opens'])} 开门 · {esc(s['note'])}</p><p class="bonus">{esc(s['bonus'])}</p></article>""" for s in game_map["stamps"])
        blocks.append(f'<h3 class="sub" id="stamps-{esc(game_map["id"])}">{esc(game_map["name"])}</h3><div class="grid stamps">{cards}</div>')
    return section("stamps", "打卡点", "地图上 5 个打卡点（中间是大厂总部，四角是城市地标），一局里按 1:00、3:00、5:00、7:00、9:00 依次开门（中间的先开，再从西北角顺时针），开门后地上出现一个黄圈，在圈里累计站满 10 秒就算打卡；出了圈进度会往回退，退得和涨得一样快，回来接着涨。每个地标给一点永久加成，这一局和以后每一局都带着；打过的地标不再有圈。",
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
        panels.append(f'<div class="panel" data-panel="{index}"><div class="grid wide">{elites}</div></div>')
    total = sum(len(group["enemies"]) for group in groups)
    speeds = [job["speed"] for job in data["jobs"]]
    return section("bestiary", "怪物图鉴", f"一共 {total} 种。boss 一局 4 个，2:00、4:00、6:00、8:00 各从 5 个里随机抽一个，招式固定。"
                   f"boss 的伤害还要减去你的护甲；距离是游戏里的像素，人物每秒走 {number(min(speeds))}–{number(max(speeds))}。",
                   f'<h3 class="sub">小怪</h3><div class="grid">{mobs}</div><h3 class="sub">boss</h3><div class="tabs">{"".join(tabs)}</div>{"".join(panels)}')


def _mob_card(enemy: dict) -> str:
    trait = " · 穿墙" if enemy["ghostly"] else ""
    return f"""<article class="card small">{art(enemy['art'], 56, enemy['name'])}<h4>{esc(enemy['name'])}</h4>
<p>{esc(enemy['note'])}</p><p class="stats"><span>生命 <b>{number(enemy['hp'])}</b></span><span>速度 <b>{number(enemy['speed'])}</b></span><span>伤害 <b>{number(enemy['damage'])}</b></span></p>
<p class="muted">经验 {enemy['xp']}{trait}</p></article>"""


def _boss_card(enemy: dict) -> str:
    """A boss in full (.50, the user wanted the site's design more detailed: how many circles an
    attack drops): its strength on its own map, each attack in numbers with how to dodge it, what
    its second phase changes, and everything it says."""
    moves = enemy["moves"]
    rhythm = (f"走 {number(enemy['walk_seconds'])} 秒出一招，一直循环" if len(moves) == 1
              else f"{len(moves)} 招轮流出（{' → '.join(esc(m['name']) for m in moves)} → …），每招之间走 {number(enemy['walk_seconds'])} 秒")
    move_html = "".join(
        f'<div class="move"><p><b>{esc(m["name"])}</b> <span class="kind">{esc(m["kind"])}</span></p>'
        f'<p>{esc(m["detail"])}</p><p class="muted">躲：{esc(m["hint"])}</p>'
        + (f'<p class="phase">{clock(enemy["phase_two_at"])} 二阶段：{esc(m["phase2"])}</p>' if m.get("phase2") else "")
        + "</div>" for m in moves)
    lines = enemy["lines"]
    said = [("出场", lines.get("arrive", "")), ("出招", " / ".join(lines.get("attack", []))),
            (f"{clock(enemy['phase_two_at'])} 二阶段", lines.get("phase2", "")), ("打死你", lines.get("kill", "")), ("被打死", lines.get("death", ""))]
    said_html = "".join(f"<li><span class=\"said\">{esc(when)}</span>「{esc(words)}」</li>" for when, words in said if words)
    where = f'{clock(enemy["at"])} 出场 · {esc("、".join(enemy["maps"]))}' if enemy["maps"] else ""
    return f"""<article class="card boss"><div class="head">{art(enemy['art'], 64, enemy['name'])}<div><h3>{esc(enemy['name'])}</h3>
<p class="muted">{where}</p></div></div><p>{esc(enemy['note'])}</p>
<p class="stats"><span>出场生命 <b>{number(round(enemy['hp_then']))}</b></span><span>碰到 <b>{number(round(enemy['contact'], 1))}</b></span><span>速度 <b>{number(enemy['speed'])}</b></span><span>经验 <b>{enemy['xp']}</b></span></p>
<p class="muted">{rhythm}。</p>{move_html}
<details><summary>台词</summary><ul class="said">{said_html}</ul></details></article>"""


def achievements_section(data: dict) -> str:
    cards = []
    for item in data["achievements"]:
        if item.get("hidden"):
            continue
        tier, color = TIERS.get(item["tier"], ("", "#ddd"))
        cards.append(f"""<article class="card small">{art(item['art'], 44, item['name'])}<h4>{esc(item['name'])} <span class="tier" style="background:{color}">{esc(tier)}</span></h4>
<p class="muted">{esc(item['text'])}</p><p class="rate">奖金 ¥{item['prize']:,} · {esc(item['rate'])}</p></article>""")
    shown = [item for item in data["achievements"] if not item.get("hidden")]
    counts = " · ".join(f"{name} {sum(1 for item in shown if item['tier'] == tier_id)} 个" for tier_id, (name, _) in TIERS.items())
    # Each tier's prize, as the cards say (Achievements.TIERS `prize`, .96).
    prizes = {}
    for item in shown:
        prizes.setdefault(item["tier"], item["prize"])
    prize_text = " / ".join(f"{name} ¥{prizes[tier_id]:,}" for tier_id, (name, _) in TIERS.items() if tier_id in prizes)
    total = sum(item["prize"] for item in shown)
    return section("achievements", "成就", f"一共 {len(shown)} 个，按难度分档：{counts}。不给属性加成，拿到时按档发一笔工资（{prize_text}，全部 ¥{total:,}），在<a href=\"#training\">培训</a>里花。达成率是游戏里显示的数。",
                   f'<div class="grid">{"".join(cards)}</div>')


def faq_section(data: dict) -> str:
    # The save and the cloud save as DESIGN.md 2.10 / 2.11 describe them.
    items = [
        ("要注册吗？", "不用。打开就能玩，也不用登录。"),
        ("进度存在哪？", "存在这个浏览器里，同时自动传一份到云端。打卡、成就、工资、培训和返聘一有变化就存，中途关掉页面也不丢；图鉴和累计数据在一局结束时存。"),
        ("换手机、换浏览器怎么办？", "在游戏里的「个人 → 云存档」拿到 12 位存档码，在新设备上输入，两边的进度会合并在一起。"),
        ("清了浏览器数据，或者微信把存储清了，进度会丢吗？", "本机那份会丢，云端那份还在，但要输入存档码才能找回来。所以最好先在「个人 → 云存档」里把存档码记下来。"),
        ("不想要云存档了？", "「个人 → 云存档」里可以删除云存档，存档码当场作废，本机的进度保留。"),
        ("分享战绩有奖励吗？", "没有。结算页能生成战绩图，转发不给任何奖励。"),
    ]
    rows = "".join(f"<details><summary>{esc(question)}</summary><p>{esc(answer)}</p></details>" for question, answer in items)
    return section("faq", "问答", "", f'<div class="faq">{rows}</div>')


def how_section(data: dict) -> str:
    rows = "".join(f'<li><span class="at">{clock(e["at"])}</span>{esc(e["text"])}</li>' for e in data["events"])
    # 10:00 isn't one of the spawner's events: it is when they stop (.78).
    rows += f'<li><span class="at">{clock(data["run_seconds"])}</span>下班：不再来新怪，清完场就上市</li>'
    return section("how", "怎么玩", "", f"""<div class="grid wide how">
<article class="card"><h3>一局 10 分钟</h3><ul>
<li>武器全自动攻击，你只管走位</li>
<li>打死的怪掉经验星星，走近才会吸过来</li>
<li>升级时三选一：拿武器还是拿被动</li>
<li>每两分钟来一个 boss，一局 4 个、每局随机抽，打掉自动开「年终奖」，按绩效发工资、白送一个局内升级，工资攒着在「培训」里永久升级属性，也能买「返聘」，被裁时可以选择回来</li>
<li>10:00 下班：不再来新怪，清完场上剩下的就敲钟上市（清场时倒下也算失败）；之后进入「加班」，怪走得更快，每 30 秒更暴躁、打人更疼，越拖越危险；从开局到清完的用时上排行榜；没通关的局撑过 1 分钟也上榜，按撑了多久排在所有通关的后面</li></ul>
<h3>操作</h3><ul><li>手机：按住屏幕任意处拖动（可选陀螺仪）</li><li>电脑：WASD 或方向键</li></ul></article>
<article class="card"><h3>一局的节奏</h3><p class="muted">每局都一样（5:00 的天气和每个 boss 是谁每局随机）：</p><ol class="timeline">{rows}</ol></article>
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
.plan{position:relative;margin:10px 0 4px;border-radius:10px;overflow:hidden}.plan svg{display:block;width:100%;height:auto}
.plan .pin{position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;pointer-events:auto}
.plan .pin img{width:30px;height:30px;background:var(--paper);border:2px solid var(--ink);border-radius:50%;padding:2px}
.plan .pin b{font-size:11px;line-height:1;margin-top:2px;background:var(--paper);border-radius:4px;padding:1px 3px}
.plan-key{font-size:12px;margin:2px 0 8px}
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
.move{background:#fff0f0;border-radius:10px;padding:6px 10px;font-size:13px;margin:8px 0}.move p{margin:2px 0}
.move .kind{font-size:11px;font-weight:800;background:#fff;border:1px solid #f2b8b8;border-radius:999px;padding:0 7px;margin-left:4px}
.move .phase{color:#b23344;font-weight:700}
ul.said{margin:6px 0 0;padding-left:0;list-style:none;font-size:13px}ul.said li{margin:2px 0}span.said{display:inline-block;min-width:64px;color:var(--muted);font-weight:700}
.levels{font-size:13px;margin:6px 0 0}.levels .span{white-space:nowrap;font-size:12px;font-weight:800;color:var(--muted);margin-right:6px}ol.perk{padding-left:0;list-style:none;font-size:13px;margin:6px 0 0}ol.perk li{margin:3px 0}
.stars{color:var(--brand-deep);font-size:18px;letter-spacing:1px;vertical-align:1px}.stars .off{color:var(--line)}
.soon{margin-top:10px}
.tabs{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 4px}
.tab{font:inherit;font-weight:800;border:2px solid var(--ink);background:var(--paper);border-radius:999px;padding:4px 16px;cursor:pointer;color:var(--ink)}
.tab[aria-selected=true]{background:var(--brand)}
.panel[hidden]{display:none}
.timeline{list-style:none;padding:0}.timeline li{display:flex;gap:10px;border-bottom:1px dashed var(--line);padding:4px 0}
.at{font-weight:800;min-width:40px;white-space:nowrap;flex:none}
.how ul{padding-left:20px}
img.art{display:block;object-fit:contain;flex:none}
.card.small img.art,.card.stamp img.art{margin:0 auto 0 0}
.card.stat h3{display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap}
.start{font-size:13px;font-weight:800;background:var(--brand-soft);border-radius:999px;padding:1px 10px}
.row{display:flex;gap:8px;align-items:flex-start;font-size:14px}
.pin{flex:none;font-size:12px;font-weight:800;background:var(--sunk);border-radius:999px;padding:1px 8px;margin-top:2px}
.scroll{overflow-x:auto;margin:8px 0}.scroll.tall{max-height:320px;overflow-y:auto}.scroll.tall thead th{position:sticky;top:0;background:var(--paper)}
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
                    upgrades_section(data), drops_section(data), objects_section(data), training_section(data), maps_section(data), difficulty_section(data), stamps_section(data), bestiary_section(data),
                    achievements_section(data), faq_section(data)])
    hero_arts = "".join(art(name, 56) for name in [data["jobs"][0]["art"], "bug", "meeting", "deadline", "ai_boss", "chest", "bell"])
    page = f"""<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>大厂幸存者 · Big Tech Survivors</title>
<meta name="description" content="大厂幸存者：割草类 roguelike，躲开 Bug、会议和 Deadline，撑过 10 分钟、清完场就能敲钟上市。职业、属性、武器、被动、升级、掉落、培训、地图、难度、打卡点和怪物图鉴。">
<meta property="og:title" content="大厂幸存者 Big Tech Survivors"><meta property="og:description" content="躲开 Bug、会议和 Deadline，撑过 10 分钟、清完场就能敲钟上市。打开网页就能玩。">
<meta property="og:image" content="https://survivors.lab115.com/index.png"><meta property="og:url" content="https://survivors.lab115.com/">
<meta name="theme-color" content="#f7c948">
<style>{STYLE}</style></head><body>
<nav class="top"><div class="inner"><span class="brand">大厂幸存者</span>
<a class="link" href="#how">怎么玩</a><a class="link" href="#jobs">职业</a><a class="link" href="#stats">属性</a><a class="link" href="#weapons">武器</a><a class="link" href="#passives">被动</a><a class="link" href="#upgrades">升级</a><a class="link" href="#drops">掉落</a><a class="link" href="#objects">地图上的东西</a><a class="link" href="#training">培训</a><a class="link" href="#maps">地图</a><a class="link" href="#difficulty">难度</a><a class="link" href="#stamps">打卡点</a><a class="link" href="#bestiary">图鉴</a><a class="link" href="#achievements">成就</a><a class="link" href="#faq">问答</a>
<a class="play" href="{PLAY_URL}">开始玩</a></div></nav>
<main><header class="hero"><div class="hero-art">{hero_arts}</div>
<h1>大厂幸存者</h1><div class="en">BIG TECH SURVIVORS</div>
<p class="tagline">躲开 Bug、会议和 Deadline，撑过 10 分钟、清完场就能敲钟上市。<br>打开网页就能玩，手机单手、电脑键盘都行。</p>
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
