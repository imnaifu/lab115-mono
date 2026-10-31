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


def weapons_section(data: dict) -> str:
    jobs = {job["id"]: job["name"] for job in data["jobs"]}
    own, public = [], []
    for weapon in data["weapons"]:
        kind = data["weapon_types"][weapon["type"]]
        if weapon.get("branches"):
            branches = "".join(f'<li><b>{esc(b["name"])}</b>：{esc(b["text"])}</li>' for b in weapon["branches"].values())
            detail = f'<p>{esc(weapon["levels"][0])}</p><p class="muted">两个方向各升 4 次：</p><ul>{branches}</ul>'
            owner = f'<span class="tag plain">{esc(jobs.get(weapon["job"], ""))}专属</span>'
            own.append((weapon, kind, detail, owner))
        else:
            steps = "".join(f"<li><span class=\"lv\">Lv{i + 1}</span>{esc(text)}</li>" for i, text in enumerate(weapon["levels"]))
            public.append((weapon, kind, f"<ol>{steps}</ol>", ""))

    def cards(items):
        return "".join(f"""<article class="card">
<div class="head">{art(w['art'], 48, w['name'])}<div><h3>{esc(w['name'])}</h3><p>{tag(k)} {owner}</p></div></div>{detail}</article>"""
                       for w, k, detail, owner in items)
    return section("weapons", "武器", "全部自动攻击，你只管走位和升级时选卡。一局最多带 6 把：本职业的专属武器开局自带，另外 10 把大家都能拿，每把 5 级。武器升级只加伤害、数量、范围，攻速只看被动「双屏显示器」。",
                   f'<h3 class="sub">专属武器</h3><div class="grid">{cards(own)}</div><h3 class="sub">公共武器</h3><div class="grid">{cards(public)}</div>')


def passives_section(data: dict) -> str:
    cards = "".join(f"""<article class="card small"><div class="head">{art(p['art'], 44, p['name'])}<div><h3>{esc(p['name'])}</h3>
<p class="muted">{esc(p['text'])}{'（每级）' if p['stat'] else ''}</p></div></div></article>""" for p in data["passives"])
    return section("passives", "被动", "一局最多带 6 种被动，大多能升 5 级。升级卡有稀有度（白 / 绿 / 蓝 / 紫 / 橙），越稀有给得越多；「锦鲤」加运气，更容易出好卡。",
                   f'<div class="grid">{cards}</div>')


def maps_section(data: dict) -> str:
    cards = []
    for index, game_map in enumerate(data["maps"]):
        difficulty = game_map["difficulty"]
        hard = "基准难度" if difficulty["hp"] <= 1.0 else f"怪物生命 ×{number(difficulty['hp'])} · 伤害 ×{number(difficulty['damage'])}"
        event = game_map["event"]
        cards.append(f"""<article class="card map">
<h3>{esc(game_map['name'])} <span class="hours">{esc(game_map['hours'])}</span></h3>
<p class="muted">{esc(hard)} · 职级 {esc(game_map['rank_prefix'])}1、{esc(game_map['rank_prefix'])}2…</p>
<p><b>分区</b>：{esc('、'.join(game_map['districts']))}</p>
<p><b>地图事件 · {esc(event['name'])}</b>：{esc(event['text'])}<br><span class="muted">{esc(event['hint'])}</span></p>
<p><b>特邀 boss</b>：{esc(game_map['guest_boss']['name'])}　<b>最后一战</b>：{esc(game_map['finale'].replace('最后的考验：', ''))}</p>
<p><a href="#stamps-{esc(game_map['id'])}">{len(game_map['stamps'])} 个打卡点 ›</a>　<a href="#bestiary" data-tab="{index}">本地怪物 ›</a></p></article>""")
    soon = "、".join(COMING_SOON_NAMES.get(city, city) for city in data["coming_soon"])
    return section("maps", "地图", "按工时排，越卷越难：通关一张开下一张。每张地图有自己的街区、地标、怪和 boss、天气事件，5:30 还有一位特邀 boss。",
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
    tabs, panels = [], []
    for index in range(0, len(groups), 2):
        crowd, bosses = groups[index], groups[index + 1]
        name = crowd["name"].replace("小怪", "")
        tabs.append(f'<button class="tab" data-tab="{index // 2}">{esc(name)}</button>')
        mobs = "".join(_mob_card(enemy) for enemy in crowd["enemies"])
        elites = "".join(_boss_card(enemy) for enemy in bosses["enemies"])
        panels.append(f'<div class="panel" data-panel="{index // 2}"><h3 class="sub">小怪</h3><div class="grid">{mobs}</div>'
                      f'<h3 class="sub">boss</h3><div class="grid">{elites}</div></div>')
    affixes = "".join(f'<li><b>{esc(a["name"])}</b>：{esc(a["note"])}</li>' for a in data["affixes"])
    total = sum(len(group["enemies"]) for group in groups)
    return section("bestiary", "怪物图鉴", f"一共 {total} 种。小怪各地图一一对应、数值一样，只是换了本地的样子；boss 每局打乱出场顺序（强度跟着出场时间走），还会随机多会一两招、带上词条。",
                   f'<div class="tabs">{"".join(tabs)}</div>{"".join(panels)}'
                   f'<h3 class="sub">boss 词条</h3><ul class="affixes">{affixes}</ul>'
                   '<p class="muted">带词条的 boss 掉的年终奖更容易开出绩效 A、S。</p>')


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
<p class="muted">{esc(item['text'])}</p></article>""")
    return section("achievements", "成就", "", f'<div class="grid">{"".join(cards)}</div>')


def how_section(data: dict) -> str:
    rows = "".join(f'<li><span class="at">{clock(e["at"])}</span>{esc(e["text"])}</li>' for e in data["events"])
    return section("how", "怎么玩", "", f"""<div class="grid wide how">
<article class="card"><h3>一局 10 分钟</h3><ul>
<li>武器全自动攻击，你只管走位</li>
<li>打死的怪掉经验星星，走近才会吸过来</li>
<li>升级时三选一：拿武器还是拿被动</li>
<li>每分钟来一个 boss，打掉必掉「年终奖」，按绩效白给升级</li>
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
.at{font-weight:800;min-width:40px}
.how ul{padding-left:20px}
img.art{display:block;object-fit:contain;flex:none}
.card.small img.art,.card.stamp img.art{margin:0 auto 0 0}
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
    body = "".join([how_section(data), jobs_section(data), weapons_section(data), passives_section(data), maps_section(data),
                    stamps_section(data), bestiary_section(data), achievements_section(data)])
    hero_arts = "".join(art(name, 56) for name in [data["jobs"][0]["art"], "bug", "meeting", "deadline", "ai_boss", "chest", "bell"])
    page = f"""<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>大厂幸存者 · Big Tech Survivors</title>
<meta name="description" content="大厂幸存者：割草类 roguelike，躲开 Bug、会议和 Deadline，撑过 10 分钟就能敲钟上市。职业、武器、被动、地图、打卡点和怪物图鉴。">
<meta property="og:title" content="大厂幸存者 Big Tech Survivors"><meta property="og:description" content="躲开 Bug、会议和 Deadline，撑过 10 分钟就能敲钟上市。打开网页就能玩。">
<meta property="og:image" content="https://survivors.lab115.com/index.png"><meta property="og:url" content="https://survivors.lab115.com/">
<meta name="theme-color" content="#f7c948">
<style>{STYLE}</style></head><body>
<nav class="top"><div class="inner"><span class="brand">大厂幸存者</span>
<a class="link" href="#how">怎么玩</a><a class="link" href="#jobs">职业</a><a class="link" href="#weapons">武器</a><a class="link" href="#passives">被动</a><a class="link" href="#maps">地图</a><a class="link" href="#stamps">打卡点</a><a class="link" href="#bestiary">图鉴</a><a class="link" href="#achievements">成就</a>
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
