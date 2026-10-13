#!/usr/bin/env python3
"""Builds the notification app site from templates/ and texts/<lang>.json.

Usage: python3 build.py [output dir]
Default output: ./public_html (or the HASHH_OUT environment variable). The site is published at https://ha-shh.com/.
Pages: /<lang>/, /<lang>/features/, /<lang>/privacy/, /<lang>/faq/ for every language,
plus a language-detecting root page, a redirect for the old /privacy/ URL and sitemap.xml.
"""
import html
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("HASHH_OUT", os.path.join(HERE, "public_html"))
BASE = "https://ha-shh.com/"
ALL_LANGS = ["en", "tr", "ar", "de", "es", "fr", "hi", "id", "pt", "ru"]
# Only languages whose text file exists are built (and linked).
LANGS = [c for c in ALL_LANGS if os.path.exists(os.path.join(HERE, "texts", c + ".json"))]
PAGES = {"home": "", "features": "features/", "privacy": "privacy/", "faq": "faq/", "updates": "updates/"}
EMAIL = "hey@ha-shh.com"

ICONS = {
    "bolt": '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    "down": '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    "block": '<circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/>',
    "cal": '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    "cycle": '<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3"/><path d="M18 3v4h-4M6 21v-4h4"/>',
    "box": '<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4"/>',
    "finger": '<path d="M12 11c0 3-1 6-3 8M8 6.5A6 6 0 0 1 18 11c0 2-.3 4-1 6M6 10a6 6 0 0 0 0 1c0 2-.6 3.6-1.5 5M12 15c0 2-.5 4-1.5 5.5M15 13c0 3-.6 5.5-2 8"/>',
    "dial": '<circle cx="12" cy="12" r="9"/><path d="M12 3v9l6 3"/>',
    "sliders": '<path d="M4 6h10M4 12h16M4 18h7"/><circle cx="17" cy="6" r="2"/><circle cx="14" cy="18" r="2"/>',
    "shield": '<path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z"/><path d="m9 12 2 2 4-4"/>',
    "mail": '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    "eye": '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    "layers": '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
    "list": '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
    "car": '<path d="M5 16V11l2-5h10l2 5v5M3 16h18v3H3zM7 19v2M17 19v2"/>',
    "palette": '<circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1.2"/><circle cx="12" cy="7.5" r="1.2"/><circle cx="16" cy="10" r="1.2"/><path d="M12 21a3 3 0 0 1 0-6h2"/>',
    "bell": '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    "star": '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.5 2.9 1-6.1L3.1 9.5l6.1-.9z"/>',
}


def icon(name, gold=False):
    return ('<div class="ico%s"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">%s</svg></div>') % (" gold" if gold else "", ICONS[name])


def lookup(ctx, key):
    cur = ctx
    for part in key.split("."):
        if isinstance(cur, dict) and part in cur:
            cur = cur[part]
        else:
            raise KeyError(key)
    return cur


EACH = re.compile(r"\{\{#each ([\w.]+)\}\}(.*?)\{\{/each\}\}", re.S)
IF = re.compile(r"\{\{#if ([\w.]+)\}\}(.*?)\{\{/if\}\}", re.S)
VAR = re.compile(r"\{\{([\w.]+)\}\}")


def render(tpl, ctx):
    """Tiny template engine: {{key.path}}, {{#each list}}...{{/each}} (item keys as {{.x}}), {{#if key}}...{{/if}}.
    Text values may contain inline HTML (translations are trusted files from this folder)."""
    def each(m):
        items = lookup(ctx, m.group(1))
        out = []
        for i, item in enumerate(items):
            body = m.group(2)
            body = re.sub(r"\{\{#if \.(\w+)\}\}(.*?)\{\{/if\}\}", lambda mm: mm.group(2) if item.get(mm.group(1)) else "", body, flags=re.S)
            body = re.sub(r"\{\{\.(\w+)\}\}", lambda mm: str(item[mm.group(1)]), body)
            body = body.replace("{{@index}}", str(i))
            out.append(body)
        return "".join(out)

    tpl = EACH.sub(each, tpl)
    tpl = IF.sub(lambda m: m.group(2) if lookup(ctx, m.group(1)) else "", tpl)
    return VAR.sub(lambda m: str(lookup(ctx, m.group(1))), tpl)


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def write(rel, text):
    path = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def fill(value, t):
    """Replace {brand} and {email} inside translated strings."""
    if isinstance(value, str):
        return value.replace("{brand}", t["common"]["brand"]).replace("{email}", EMAIL)
    if isinstance(value, list):
        return [fill(v, t) for v in value]
    if isinstance(value, dict):
        return {k: fill(v, t) for k, v in value.items()}
    return value


def decorate(t):
    """Attach icons to list items (icons live here, not in translations)."""
    h = t["home"]
    for item, ic in zip(h["actions"], ["bolt", "clock", "down", "block"]):
        item["icon"] = icon(ic, ic == "down")
    for item, ic in zip(h["highlights"], ["cal", "cycle", "box", "finger", "dial", "sliders"]):
        item["icon"] = icon(ic, ic == "box")
    for item, var in zip(h["modes"], ["normal", "focus", "sleep", "sports"]):
        item["var"] = var
    group_icons = [["bolt", "down", "shield", "star", "bell"],
                   ["layers", "list", "cal", "dial", "cycle", "sliders", "clock", "shield"],
                   ["eye", "layers", "sliders", "car", "down", "star", "list", "dial", "eye", "bell", "cycle", "layers"],
                   ["box", "finger", "eye", "palette", "mail", "layers", "star", "down"]]
    for group, icons in zip(t["features"]["groups"], group_icons):
        for item, ic in zip(group["items"], icons):
            item["icon"] = icon(ic, ic in ("box", "down"))
        group["items_html"] = "".join(
            '<div class="card rv">%s<h3>%s%s</h3><p>%s</p></div>'
            % (item["icon"], item["t"], ' <span class="tag-new">%s</span>' % item["new"] if item.get("new") else "", item["p"])
            for item in group["items"])


DATE_FMT = {"de": "{d}. {m} {y}", "es": "{d} de {m} de {y}", "pt": "{d} de {m} de {y}"}
LOWER_MONTHS = ("es", "pt", "fr", "ru")
RU_GENITIVE = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"]


def fmt_date(iso, code, months):
    y, m, d = (int(x) for x in iso.split("-"))
    name = RU_GENITIVE[m - 1] if code == "ru" else months[m - 1]
    if code in LOWER_MONTHS:
        name = name.lower()
    return DATE_FMT.get(code, "{d} {m} {y}").format(d=d, m=name, y=y)


NEWS_IMG_DIR = os.path.join(HERE, "static", "assets", "news")


def news_picture(img, root, cls=""):
    """A screenshot that follows the theme: <name>-light.* on light themes, <name>-dark.* on dark ones.
    Files live in static/assets/news/. If only one variant exists it is used for both; if none, nothing is shown."""
    found = {}
    for variant in ("light", "dark"):
        for ext in ("webp", "png", "jpg"):
            if os.path.exists(os.path.join(NEWS_IMG_DIR, "%s-%s.%s" % (img["src"], variant, ext))):
                found[variant] = "%s-%s.%s" % (img["src"], variant, ext)
                break
    if not found:
        print("warning: missing news image " + img["src"])
        return ""
    light = found.get("light") or found["dark"]
    dark = found.get("dark") or light
    alt = html.escape(img["alt"], quote=True)
    if light == dark:
        return '<img class="shot %s" src="%sassets/news/%s" alt="%s" loading="lazy">' % (cls, root, light, alt)
    return ('<img class="shot on-light %s" src="%sassets/news/%s" alt="%s" loading="lazy">'
            '<img class="shot on-dark %s" src="%sassets/news/%s" alt="%s" loading="lazy">'
            % (cls, root, light, alt, cls, root, dark, alt))


def news_blocks(t, code, root):
    """Full updates list for the updates page, and the 3 latest as cards for the home page."""
    full, cards = [], []
    for item in sorted(t["news"], key=lambda n: n["date"], reverse=True):
        when = fmt_date(item["date"], code, t["meta"]["months"])
        lis = "".join("<li>%s</li>" % x for x in item["items"])
        imgs = item.get("images", [])
        gallery = "".join('<figure>%s<figcaption>%s</figcaption></figure>' % (news_picture(i, root), i["alt"])
                          for i in imgs if news_picture(i, root))
        gallery = '<div class="shots">%s</div>' % gallery if gallery else ""
        full.append('<article class="news card" id="u-%s"><time datetime="%s">%s</time><h2>%s</h2>%s<ul>%s</ul></article>'
                    % (item["date"], item["date"], when, item["h"], gallery, lis))
        if len(cards) < 3:
            thumb = news_picture(imgs[0], root, "thumb") if imgs else ""
            cards.append('<a class="card news-card rv" href="updates/#u-%s">%s<time datetime="%s">%s</time><b>%s</b></a>'
                         % (item["date"], thumb, item["date"], when, item["h"]))
    return "".join(full), "".join(cards)


def lang_menu(texts, page, here):
    links = []
    for code in LANGS:
        cur = ' aria-current="true"' if code == here else ""
        links.append('<a href="{{root}}%s/%s" hreflang="%s" lang="%s"%s>%s</a>'
                     % (code, PAGES[page], code, code, cur, html.escape(texts[code]["meta"]["name"])))
    return "".join(links)


def alternates(page):
    rows = ['<link rel="alternate" hreflang="%s" href="%s%s/%s">' % (c, BASE, c, PAGES[page]) for c in LANGS]
    rows.append('<link rel="alternate" hreflang="x-default" href="%s%s">'
                % (BASE, "" if page == "home" else "en/" + PAGES[page]))
    return "\n".join(rows)


def asset_version():
    import hashlib
    h = hashlib.sha1()
    for name in ("site.css", "site.js"):
        with open(os.path.join(HERE, "static", "assets", name), "rb") as f:
            h.update(f.read())
    return h.hexdigest()[:8]


def main():
    global ASSET_VER
    import shutil
    import subprocess
    # Refuse to build if any text file fails the checks (keys, placeholders, safe HTML only).
    if subprocess.run([sys.executable, "-I", os.path.join(HERE, "check_texts.py")], stdout=subprocess.DEVNULL).returncode:
        sys.exit("check_texts.py failed; run it to see the problems")
    # Static files (assets, .htaccess, robots.txt, llms.txt) are copied as they are.
    shutil.copytree(os.path.join(HERE, "static"), OUT, dirs_exist_ok=True)
    ASSET_VER = asset_version()
    texts = {}
    for code in LANGS:
        t = json.load(open(os.path.join(HERE, "texts", code + ".json"), encoding="utf-8"))
        t = fill(t, t)
        decorate(t)
        texts[code] = t
    shell = read(os.path.join(HERE, "templates", "shell.html"))
    bodies = {p: read(os.path.join(HERE, "templates", p + ".html")) for p in PAGES}

    for code in LANGS:
        t = texts[code]
        for page, slug in PAGES.items():
            root = "../" if page == "home" else "../../"
            ctx = dict(t)
            ctx.update({
                "ver": ASSET_VER, "root": root, "theme_list": t["common"]["themes"], "page": t[page], "lang": code, "url": BASE + code + "/" + slug,
                "alternates": alternates(page), "email": EMAIL,
                "sim_json": json.dumps(t["sim"], ensure_ascii=False) if page == "home" else "",
                "home_href": root + code + "/", "lang_current": t["meta"]["name"],
                "nav_cur_features": ' aria-current="page"' if page == "features" else "",
                "nav_cur_privacy": ' aria-current="page"' if page == "privacy" else "",
                "nav_cur_faq": ' aria-current="page"' if page == "faq" else "",
                "nav_cur_updates": ' aria-current="page"' if page == "updates" else "",
                "demo_href": "#demo" if page == "home" else root + code + "/#demo",
            })
            ctx["news_html"], ctx["news_box_html"] = news_blocks(t, code, root)
            ctx["body"] = render(bodies[page], ctx)
            ctx["lang_menu"] = render(lang_menu(texts, page, code), ctx)
            write(os.path.join(code, slug, "index.html"), render(shell, ctx))

    # Root: send visitors to their language (English if none matches).
    names = "".join('<li><a href="%s/" hreflang="%s" lang="%s">%s</a></li>'
                    % (c, c, c, html.escape(texts[c]["meta"]["name"])) for c in LANGS)
    write("index.html", render(read(os.path.join(HERE, "templates", "root.html")),
                               {"langs_js": json.dumps(LANGS), "names": names, "alternates": alternates("home")}))
    # Old English privacy URL.
    write(os.path.join("privacy", "index.html"),
          '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Privacy policy</title>'
          '<link rel="canonical" href="%sen/privacy/"><meta http-equiv="refresh" content="0; url=../en/privacy/">'
          '<meta name="robots" content="noindex"></head><body><p><a href="../en/privacy/">Privacy policy</a></p></body></html>\n' % BASE)
    # Sitemap with language alternates.
    urls = []
    for page, slug in PAGES.items():
        alts = "".join('<xhtml:link rel="alternate" hreflang="%s" href="%s%s/%s"/>' % (c, BASE, c, slug) for c in LANGS)
        for c in LANGS:
            urls.append("<url><loc>%s%s/%s</loc>%s</url>" % (BASE, c, slug, alts))
    write("sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
          'xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' + "\n".join(urls) + "\n</urlset>\n")
    print("built %d languages x %d pages into %s" % (len(LANGS), len(PAGES), OUT))


if __name__ == "__main__":
    main()
