#!/usr/bin/env python3
"""Builds rednote.lab115.com's static pages from strings.py.

Every page is generated — home and privacy policy in each language, the 404
page and sitemap.xml — so a wording change goes in strings.py and a layout
change goes here; never hand-edit the HTML in public/.

    python3 site/build.py            # pages + sitemap
    python3 site/build.py --images   # also re-cut preview shots and og images
                                     # from branding/v2/out (needs cwebp, sips)
"""
import html
import json
import os
import re
import subprocess
import sys

sys.dont_write_bytecode = True  # importing strings.py must not leave __pycache__ in the repo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from strings import LANGS, S, STORE  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.join(HERE, "public")
SHOTS = os.path.join(HERE, "..", "branding", "v2", "out")
ORIGIN = "https://rednote.lab115.com"
# Cache-busting query for every static asset: nginx and Cloudflare keep images
# and CSS for a day, so bump this whenever a file keeps its name but changes.
V = "v=7"
PREVIEWS = ["01-post-download", "02-one-folder", "03-note-list", "04-csv"]

# ----------------------------------------------------------------- artwork
SVG_OPEN = '<svg viewBox="0 0 96 96" aria-hidden="true" fill="none" stroke="var(--art-line)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">'
ART = {
    "post": """<rect x="28" y="10" width="38" height="70" rx="7" fill="#fff"/>
<rect x="34" y="18" width="26" height="30" rx="3" fill="var(--well)"/>
<circle cx="53" cy="26" r="3.5" fill="var(--brand)"/>
<path d="M34 46 43 35l6 6 4-4 7 8v1H34Z" fill="var(--fill-mint)"/>
<path d="M35 57h20M35 64h13"/>
<circle cx="66" cy="70" r="13" fill="var(--brand)"/>
<path d="M66 63v13m-5-5 5 5 5-5"/>""",
    "folder": """<path d="M14 30a4 4 0 0 1 4-4h18l6 6h36a4 4 0 0 1 4 4v38a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4Z" fill="var(--brand-deep)"/>
<rect x="26" y="20" width="24" height="28" rx="3" fill="var(--fill-pink)" transform="rotate(-8 38 34)"/>
<rect x="46" y="18" width="24" height="28" rx="3" fill="var(--fill-sky)" transform="rotate(7 58 32)"/>
<path d="M12 44a4 4 0 0 1 4-4h64a4 4 0 0 1 4 4l-3 30a4 4 0 0 1-4 4H19a4 4 0 0 1-4-4Z" fill="var(--brand)"/>
<path d="M40 58h16"/>""",
    "list": """<rect x="18" y="12" width="52" height="70" rx="6" fill="#fff"/>
<rect x="24" y="19" width="13" height="15" rx="2.5" fill="var(--fill-pink)"/><path d="M43 23h20M43 30h12"/>
<rect x="24" y="40" width="13" height="15" rx="2.5" fill="var(--fill-sky)"/><path d="M43 44h20M43 51h12"/>
<rect x="24" y="61" width="13" height="15" rx="2.5" fill="var(--fill-lilac)"/><path d="M43 65h14"/>
<circle cx="70" cy="70" r="13" fill="var(--brand)"/>
<path d="M70 63v13m-5-5 5 5 5-5"/>""",
    "csv": """<rect x="12" y="18" width="64" height="56" rx="5" fill="#fff"/>
<path d="M12 23a5 5 0 0 1 5-5h54a5 5 0 0 1 5 5v9H12Z" fill="var(--fill-mint)"/>
<path d="M12 46h64M12 60h64M34 18v56M56 18v56"/>
<circle cx="74" cy="72" r="13" fill="var(--brand)"/>
<path d="M68 77v-4M74 77v-9M80 77v-6"/>""",
    # step 1: a RedNote feed in a browser window
    "browser": """<rect x="8" y="16" width="80" height="64" rx="6" fill="#fff"/>
<path d="M8 22a6 6 0 0 1 6-6h68a6 6 0 0 1 6 6v6H8Z" fill="var(--fill-sky)"/>
<circle cx="16" cy="22" r="1.5" fill="var(--art-line)" stroke="none"/><circle cx="22" cy="22" r="1.5" fill="var(--art-line)" stroke="none"/><circle cx="28" cy="22" r="1.5" fill="var(--art-line)" stroke="none"/>
<rect x="16" y="35" width="18" height="22" rx="3" fill="var(--fill-pink)"/>
<rect x="39" y="35" width="18" height="30" rx="3" fill="var(--fill-mint)"/>
<rect x="62" y="35" width="18" height="17" rx="3" fill="var(--fill-yellow)"/>
<rect x="16" y="62" width="18" height="11" rx="3" fill="var(--fill-lilac)"/>
<rect x="62" y="57" width="18" height="16" rx="3" fill="var(--fill-sky)"/>""",
    # step 2: clicking the extension's icon in the toolbar
    "click": """<rect x="8" y="18" width="80" height="26" rx="13" fill="#fff"/>
<path d="M20 31h28"/>
<rect x="58" y="22" width="18" height="18" rx="5" fill="var(--fill-pink)"/>
<circle cx="67" cy="32" r="5" fill="#d94b5c" stroke-width="2"/>
<rect x="12" y="52" width="46" height="32" rx="5" fill="#fff"/>
<path d="M18 61h14" stroke="var(--brand)" stroke-width="4"/><path d="M38 61h14M18 71h34M18 78h22"/>
<path d="M66 40v26l6-6 5 11 5-2-5-11h8Z" fill="#fff"/>""",
    # step 3: the CSV and the photos land on the computer
    "saved": """<path d="M14 16h28l12 12v48a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V20a4 4 0 0 1 4-4Z" fill="#fff"/>
<path d="M42 16v12h12M17 42h30M17 53h30M17 64h30M30 36v34"/>
<rect x="50" y="26" width="30" height="36" rx="4" fill="var(--fill-pink)" transform="rotate(9 65 44)"/>
<rect x="44" y="32" width="30" height="36" rx="4" fill="var(--fill-sky)"/>
<circle cx="66" cy="41" r="3" fill="var(--brand)"/>
<path d="M44 62 53 51l6 6 4-4 11 10v1H44Z" fill="var(--fill-mint)"/>
<circle cx="74" cy="74" r="12" fill="var(--brand)"/>
<path d="M74 67v13m-5-5 5 5 5-5"/>""",
    "lock": """<path d="M34 44V34a14 14 0 0 1 28 0v10"/>
<rect x="24" y="44" width="48" height="36" rx="7" fill="var(--brand)"/>
<circle cx="48" cy="58" r="4.5" fill="var(--art-line)" stroke="none"/><path d="M48 61v8"/>""",
    "cloudoff": """<path d="M30 70h36a13 13 0 0 0 2-26 18 18 0 0 0-34-4 15 15 0 0 0-4 30Z" fill="#fff"/>
<path d="M20 22 76 78" stroke-width="3.5"/>""",
    "shield": """<path d="M48 14 74 24v20c0 18-11 31-26 37-15-6-26-19-26-37V24Z" fill="#fff"/>
<path d="M36 47l8 8 16-17" stroke-width="3"/>""",
}


def art(name):
    return f"{SVG_OPEN}\n{ART[name]}\n</svg>"


CHECK = '<svg class="sk-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7"/></svg>'
ARROW = '<svg class="sk-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>'
GLOBE = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z"/></svg>'
CHEVRON = '<svg class="chev" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>'
LOGO = f'<img src="/img/icon.svg?{V}" alt="" width="28" height="28">'

# Closes the language menu on an outside click or Escape. Without JS the
# <details> still opens and closes on its own button.
MENU_JS = """<script>
    document.addEventListener("click", function (e) {
      document.querySelectorAll("details.lang-menu[open]").forEach(function (d) { if (!d.contains(e.target)) d.open = false; });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      document.querySelectorAll("details.lang-menu[open]").forEach(function (d) { d.open = false; d.querySelector("summary").focus(); });
    });
  </script>"""


# ------------------------------------------------------------------ helpers
def url(code, page):
    return S[code]["path"] + ("privacy/" if page == "privacy" else "")


def alternates(page):
    links = [f'<link rel="alternate" hreflang="{S[c]["hreflang"]}" href="{ORIGIN}{url(c, page)}">' for c in LANGS]
    links.append(f'<link rel="alternate" hreflang="x-default" href="{ORIGIN}{url("en", page)}">')
    return "\n  ".join(links)


def plain(text):
    """HTML snippet → plain text for JSON-LD."""
    return html.unescape(re.sub(r"<[^>]+>", "", text))


def icons(with_touch=True):
    out = [f'<link rel="icon" href="/img/icon.svg?{V}" type="image/svg+xml">',
           f'<link rel="icon" href="/favicon.png?{V}" type="image/png" sizes="32x32">']
    if with_touch:
        out.append(f'<link rel="apple-touch-icon" href="/img/icon128.png?{V}">')
    return "\n  ".join(out)


CSS = f'<link rel="stylesheet" href="/sokosoko.css?{V}">\n  <link rel="stylesheet" href="/style.css?{V}">'


def lang_menu(code, page):
    t = S[code]
    items = "".join(
        f'<li><a href="{url(c, page)}" hreflang="{S[c]["hreflang"]}" lang="{S[c]["hreflang"]}"'
        f'{" aria-current=" + chr(34) + "page" + chr(34) if c == code else ""}>{S[c]["label"]}</a></li>'
        for c in LANGS)
    return f'''<details class="lang-menu">
        <summary aria-label="{t["lang_label"]}: {t["label"]}">{GLOBE}<span>{t["label"]}</span>{CHEVRON}</summary>
        <ul>{items}</ul>
      </details>'''


def header(code, page):
    t = S[code]
    prefix = "" if page == "home" else t["path"]
    nav = "".join(f'<li><a href="{prefix}{href}">{label}</a></li>' for href, label in t["nav"])
    return f'''<header class="sk-header">
    <a class="sk-logo" href="{t["path"]}">{LOGO}{t["brand"]}</a>
    <nav aria-label="{t["nav_label"]}"><ul class="sk-nav">{nav}</ul></nav>
    <div class="hdr-actions">
      {lang_menu(code, page)}
      <a class="sk-btn sk-btn--primary sk-btn--sm" href="{STORE}" rel="noopener">{t["add"]}</a>
    </div>
  </header>'''


def footer(code, page):
    t = S[code]
    prefix = "" if page == "home" else t["path"]
    p_title, (f1, f2, f3) = t["foot_product"]
    h_title, (faq, privacy, mail) = t["foot_help"]
    # the footer grid holds four columns, so "Made by LAB115" sits under the blurb
    _, m_href, m_label = t["foot_more"]
    langs = "".join(f'<li><a href="{url(c, page)}" hreflang="{S[c]["hreflang"]}" lang="{S[c]["hreflang"]}">{S[c]["label"]}</a></li>' for c in LANGS)
    return f'''<footer class="sk-footer">
    <div class="sk-footer__cols">
      <div><a class="sk-logo" href="{t["path"]}">{LOGO}{t["brand"]}</a><p class="foot-desc">{t["foot_desc"]}</p><p class="foot-made"><a href="{m_href}">{m_label}</a></p></div>
      <div><h4>{p_title}</h4><ul><li><a href="{prefix}#features">{f1}</a></li><li><a href="{prefix}#preview">{f2}</a></li><li><a href="{prefix}#how">{f3}</a></li></ul></div>
      <div><h4>{h_title}</h4><ul><li><a href="{prefix}#faq">{faq}</a></li><li><a href="{url(code, "privacy")}">{privacy}</a></li><li><a href="mailto:help@lab115.com">{mail}</a></li></ul></div>
      <div><h4>{t["lang_label"]}</h4><ul>{langs}</ul></div>
    </div>
    <div class="sk-footer__base"><span>{t["disclaimer"]}</span><span>© 2026 LAB115</span></div>
  </footer>'''


def heading(title, kicker, hid):
    return f'<div class="sk-h2-wrap"><h2 class="sk-h2" id="{hid}">{title}</h2><span class="sk-h2-sub" aria-hidden="true">{kicker}</span></div>'


# -------------------------------------------------------------------- pages
def home_head(code):
    t = S[code]
    app = {
        "@type": "SoftwareApplication",
        "@id": f"{ORIGIN}{t['path']}#app",
        "name": plain(t["app_name"]),
        "alternateName": t["app_alt"],
        "url": f"{ORIGIN}{t['path']}",
        "applicationCategory": "BrowserApplication",
        "operatingSystem": "Chrome",
        "description": t["app_description"],
        "image": f"{ORIGIN}/img/icon128.png",
        "inLanguage": t["hreflang"],
        "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
        "installUrl": STORE,
        "sameAs": [STORE],
        "publisher": {"@type": "Organization", "name": "LAB115", "url": "https://lab115.com"},
    }
    faq = {
        "@type": "FAQPage",
        "mainEntity": [{"@type": "Question", "name": plain(q), "acceptedAnswer": {"@type": "Answer", "text": plain(a)}} for q, a in t["faqs"]],
    }
    ld = json.dumps({"@context": "https://schema.org", "@graph": [app, faq]}, ensure_ascii=False, indent=2)
    return f'''<!doctype html>
<!--
  {t["head_comment"]} Generated by site/build.py from site/strings.py: edit
  those and rebuild, never this file.
-->
<html lang="{t["hreflang"]}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{t["title"]}</title>
  <meta name="description" content="{t["description"]}">
  <link rel="canonical" href="{ORIGIN}{t["path"]}">
  {alternates("home")}
  {icons()}
  <meta name="theme-color" content="#ffffff">

  <meta property="og:type" content="website">
  <meta property="og:site_name" content="{t["og_site_name"]}">
  <meta property="og:title" content="{t["og_title"]}">
  <meta property="og:description" content="{t["og_description"]}">
  <meta property="og:url" content="{ORIGIN}{t["path"]}">
  <meta property="og:image" content="{ORIGIN}/img/og-{code}.jpg?{V}">
  <meta property="og:image:width" content="1400">
  <meta property="og:image:height" content="560">
  <meta property="og:locale" content="{t["og_locale"]}">
  <meta name="twitter:card" content="summary_large_image">

  {CSS}

  <script type="application/ld+json">
{ld}
  </script>
</head>
'''


def home_body(code):
    t = S[code]
    tags = "".join(f'<span class="sk-tag">{x}</span>' for x in t["hero_tags"])
    feats = "".join(
        f'<article class="art-card"><div class="sk-card__well" style="background:var(--{bg})">{art(a)}</div><h3>{h}</h3><p>{p}</p></article>'
        for a, bg, h, p in t["feats"])
    tabs, panels = "", ""
    for i, ((key, tab, alt, h, p, pts), shot) in enumerate(zip(t["pv"], PREVIEWS)):
        tabs += f'<button class="sk-tab" role="tab" id="tab-{key}" aria-controls="pv-{key}" aria-selected="{"true" if i == 0 else "false"}">{tab}</button>'
        points = "".join(f'<li><span class="pt-ic">{CHECK}</span>{x}</li>' for x in pts)
        loading = "" if i == 0 else ' loading="lazy"'
        panels += f'''<div class="pv-panel" role="tabpanel" id="pv-{key}" aria-labelledby="tab-{key}">
          <div class="pv-shot"><img src="/img/{code}-{shot}.webp?{V}" width="712" height="745"{loading} alt="{alt}"></div>
          <div class="pv-copy"><h3>{h}</h3><p>{p}</p><ul class="points">{points}</ul>
            <a class="sk-btn sk-btn--primary" href="{STORE}" rel="noopener">{t["add"]}</a></div>
        </div>'''
    steps = "".join(
        f'<li class="art-card"><div class="sk-card__well" style="background:var(--{bg})">{art(a)}</div><span class="step-no">{i + 1}</span><h3>{h}</h3><p>{p}</p></li>'
        for i, (a, bg, h, p) in enumerate(t["steps"]))
    privs = "".join(
        f'<li><span class="sk-cat__disc" style="background:var(--{bg})">{art(a)}</span><h3>{h}</h3><p>{p}</p></li>'
        for a, bg, h, p in t["privs"])
    faqs = "".join(f'<details><summary>{q}</summary><p>{a}</p></details>' for q, a in t["faqs"])
    return f'''<body>
  {header(code, "home")}

  <main>
    <section class="sk-hero" aria-labelledby="hero-title">
      <span class="sk-hero__blob" style="width:220px;height:220px;background:var(--fill-sky);left:-60px;top:-40px"></span>
      <span class="sk-hero__blob" style="width:140px;height:140px;background:var(--fill-pink);right:80px;bottom:-50px"></span>
      <span class="sk-hero__blob" style="width:90px;height:90px;background:var(--fill-mint);right:-20px;top:40px"></span>
      <h1 class="sk-hero__title" id="hero-title">{t["hero_title"]}</h1>
      <p class="sk-hero__sub">{t["hero_sub"]}</p>
      <div class="cta">
        <a class="sk-btn sk-btn--primary" href="{STORE}" rel="noopener">{t["add"]}</a>
        <a class="sk-btn sk-btn--secondary" href="#how">{t["hero_how"]}</a>
      </div>
      <div class="sk-tags">{tags}</div>
    </section>

    <section class="sk-section" id="features" aria-labelledby="features-title">
      <div class="sk-container">
        {heading(t["feat_h"], "FEATURES", "features-title")}
        <div class="card-grid card-grid--4">{feats}</div>
      </div>
    </section>

    <section class="sk-section sk-section--soft" id="preview" aria-labelledby="preview-title">
      <div class="sk-container">
        {heading(t["pv_h"], "PREVIEW", "preview-title")}
        <div class="pv" data-tabs>
          <div class="sk-tabs pv-tabs" role="tablist" aria-label="{t["pv_label"]}">{tabs}</div>
          {panels}
        </div>
      </div>
    </section>

    <section class="sk-section" id="how" aria-labelledby="how-title">
      <div class="sk-container">
        {heading(t["how_h"], "HOW IT WORKS", "how-title")}
        <ol class="card-grid card-grid--3">{steps}</ol>
      </div>
    </section>

    <section class="sk-section sk-section--soft" aria-labelledby="privacy-title">
      <div class="sk-container">
        {heading(t["priv_h"], "PRIVACY", "privacy-title")}
        <ul class="priv">{privs}</ul>
        <p class="more"><a class="sk-btn sk-btn--ghost" href="{url(code, "privacy")}">{t["priv_more"]} {ARROW}</a></p>
      </div>
    </section>

    <section class="sk-section" id="faq" aria-labelledby="faq-title">
      <div class="sk-container">
        {heading(t["faq_h"], "FAQ", "faq-title")}
        <div class="faq">{faqs}</div>
      </div>
    </section>

    <section class="sk-section sk-section--soft closing" aria-labelledby="closing-title">
      <div class="sk-container">
        <img src="/img/icon.svg?{V}" alt="" width="72" height="72">
        <div class="sk-h2-wrap"><h2 class="sk-h2" id="closing-title">{t["close_h"]}</h2></div>
        <p>{t["close_p"]}</p>
        <a class="sk-btn sk-btn--primary" href="{STORE}" rel="noopener">{t["add"]}</a>
      </div>
    </section>
  </main>

  {footer(code, "home")}
  <script>
    // Preview tabs: without JS every panel simply stacks; with it, one shows at a time.
    document.documentElement.classList.add("js");
    document.querySelectorAll("[data-tabs]").forEach(function (root) {{
      var tabs = Array.prototype.slice.call(root.querySelectorAll("[role=tab]"));
      function show(tab) {{
        tabs.forEach(function (t) {{
          var on = t === tab;
          t.setAttribute("aria-selected", on);
          t.tabIndex = on ? 0 : -1;
          document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
        }});
      }}
      tabs.forEach(function (t, i) {{
        t.addEventListener("click", function () {{ show(t); }});
        t.addEventListener("keydown", function (e) {{
          var step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
          if (!step) return;
          var next = tabs[(i + step + tabs.length) % tabs.length];
          show(next); next.focus();
        }});
      }});
      show(tabs[0]);
    }});
  </script>
  {MENU_JS}
</body>
</html>
'''


def privacy_page(code):
    t = S[code]
    return f'''<!doctype html>
<!--
  Privacy policy ({t["label"]}). This is the privacy URL given to the Chrome Web
  Store, so every line must match what src/ actually does. Generated by
  site/build.py from site/strings.py: edit those and rebuild, never this file.
-->
<html lang="{t["hreflang"]}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{t["privacy_title"]}</title>
  <meta name="description" content="{t["privacy_description"]}">
  <link rel="canonical" href="{ORIGIN}{url(code, "privacy")}">
  {alternates("privacy")}
  {icons(with_touch=False)}
  <meta name="theme-color" content="#ffffff">
  {CSS}
</head>
<body>
  {header(code, "privacy")}

  <main class="sk-container">
    <article class="prose">
      {t["privacy"]}
    </article>
  </main>

  {footer(code, "privacy")}
  {MENU_JS}
</body>
</html>
'''


def notfound_page():
    # One 404 for every language: say it in each and link each home page.
    titles = " · ".join(
        S[c]["notfound"] if c == "en" else f'<span lang="{S[c]["hreflang"]}">{S[c]["notfound"]}</span>' for c in LANGS[:2])
    links = " · ".join(f'<a href="{S[c]["path"]}" hreflang="{S[c]["hreflang"]}" lang="{S[c]["hreflang"]}">{S[c]["label"]}</a>' for c in LANGS)
    return f'''<!doctype html>
<!-- Generated by site/build.py: edit there and rebuild, never this file. -->
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Page not found - RedNote Exporter</title>
  <meta name="robots" content="noindex">
  <link rel="icon" href="/img/icon.svg?{V}" type="image/svg+xml">
  {CSS}
</head>
<body>
  <main class="notfound">
    <div class="sk-empty">
      <div class="sk-empty__art">{art("browser")}</div>
      <h1 class="sk-empty__title">{titles}</h1>
      <p class="sk-empty__text">{links}</p>
    </div>
  </main>
</body>
</html>
'''


def sitemap():
    entries = ""
    for page in ("home", "privacy"):
        alts = "".join(f'\n    <xhtml:link rel="alternate" hreflang="{S[c]["hreflang"]}" href="{ORIGIN}{url(c, page)}"/>' for c in LANGS)
        alts += f'\n    <xhtml:link rel="alternate" hreflang="x-default" href="{ORIGIN}{url("en", page)}"/>'
        for code in LANGS:
            entries += f'\n  <url>\n    <loc>{ORIGIN}{url(code, page)}</loc>{alts}\n  </url>'
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated by site/build.py: every page, each listed with all its language versions. English is the default (root). -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">{entries}
</urlset>
'''


def write(rel, text):
    path = os.path.join(PUB, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def build_images():
    # Preview shots: the popup half of each store screenshot. og image: the
    # store's marquee tile, as JPEG.
    for code in LANGS:
        src = os.path.join(SHOTS, S[code]["shots"])
        for shot in PREVIEWS:
            subprocess.run(["cwebp", "-quiet", "-q", "85", "-m", "6", "-crop", "548", "40", "712", "745",
                            os.path.join(src, f"{shot}.png"), "-o", os.path.join(PUB, "img", f"{code}-{shot}.webp")], check=True)
        subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "85", os.path.join(src, "marquee-1400x560.png"),
                        "--out", os.path.join(PUB, "img", f"og-{code}.jpg")], check=True, stdout=subprocess.DEVNULL)


def main():
    if "--images" in sys.argv:
        build_images()
    for code in LANGS:
        prefix = S[code]["path"].strip("/")
        write(os.path.join(prefix, "index.html"), home_head(code) + home_body(code))
        write(os.path.join(prefix, "privacy", "index.html"), privacy_page(code))
    write("404.html", notfound_page())
    write("sitemap.xml", sitemap())
    print(f"built {len(LANGS) * 2} pages + 404 + sitemap")


if __name__ == "__main__":
    main()
