#!/usr/bin/env python3
"""
iPlug GQ – New Music Friday social pack
=======================================
Reads music-releases.json and creates, for the latest Friday drop:

  social/nmf/latest/slide-01.jpg … slide-NN.jpg   Instagram carousel (1080×1350, 4:5)
  social/nmf/latest/story.jpg                     Instagram/WhatsApp Status story (1080×1920)
  social/nmf/weekly-music-pack.md                 WhatsApp post, IG caption, Reels script,
                                                  X posts and an artist outreach message

Usage (from the repo root):
    pip install pillow
    python3 tools/nmf_social.py                  # latest drop, today's date (SAST)
    python3 tools/nmf_social.py --today 2026-11-21

It runs automatically on GitHub whenever music-releases.json changes.
"""
import argparse, datetime as dt, io, json, os, re, shutil, textwrap, urllib.request
from urllib.parse import quote
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = os.path.join(ROOT, "tools", "fonts")
LOGO = os.path.join(ROOT, "tools", "assets", "logo.png")
SITE = "https://ipluggq.com"
NMF_URL = f"{SITE}/music-friday.html"
PLACEHOLDER = "https://ik.imagekit.io/vurvay/placeholder/IMG_9774.jpg?tr=w-1000,h-1000,fo-auto"

# Brand colours (from style.css)
DARK = (14, 15, 12)
SURFACE = (25, 26, 23)
LIME = (245, 255, 88)
ORANGE = (255, 107, 74)
TEXT = (247, 247, 242)
MUTED = (166, 168, 156)

W, H = 1080, 1350
MAX_RELEASE_SLIDES = 8          # Instagram allows 10 slides: cover + 8 releases + CTA

GENRES = {
    "amapiano": "Amapiano", "afrohouse": "Afro House", "threestep": "3-Step", "deephouse": "Deep House",
    "hiphop": "Hip-hop", "gqom": "Gqom", "maskandi": "Maskandi", "gospel": "Gospel",
    "afropop": "Afro-pop", "rnb": "R&B", "kwaito": "Kwaito", "other": "Music",
}
TYPES = {"single": "Single", "ep": "EP", "album": "Album"}
HASHTAGS = {
    "amapiano": "#Amapiano", "afrohouse": "#AfroHouse", "threestep": "#3Step", "deephouse": "#DeepHouse",
    "hiphop": "#SAHipHop", "gqom": "#Gqom", "maskandi": "#Maskandi", "gospel": "#SAGospel",
    "afropop": "#AfroPop", "rnb": "#SARnB", "kwaito": "#Kwaito",
}

# ------------------------------------------------------------------ helpers
def font(kind, size, weight=700):
    path = os.path.join(FONTS, "SpaceGrotesk-Variable.ttf" if kind == "head" else "DMSans-Variable.ttf")
    f = ImageFont.truetype(path, size)
    try:
        axes = f.get_variation_axes()
        vals = []
        for a in axes:
            name = a["name"].decode() if isinstance(a["name"], bytes) else a["name"]
            if name == "Weight":
                vals.append(max(a["minimum"], min(a["maximum"], weight)))
            elif name == "Optical size":
                vals.append(max(a["minimum"], min(a["maximum"], size)))
            else:
                vals.append(a["default"])
        f.set_variation_by_axes(vals)
    except Exception:
        pass
    return f

def js_slugify(text):
    """Mirror of slugify() in music-friday.js (used for #r-… deep links)."""
    s = str(text).lower()
    s = re.sub(r"\s+", "-", s)
    s = re.sub(r"[^A-Za-z0-9_\-]+", "", s)
    s = re.sub(r"--+", "-", s)
    return s.strip("-")

def release_link(r, source):
    anchor = "r-" + js_slugify(f"{r.get('artistName','')} {r.get('title','')}")[:80]
    return f"{NMF_URL}?utm_source={source}&utm_medium=social&utm_campaign=nmf#{anchor}"

def page_link(source):
    return f"{NMF_URL}?utm_source={source}&utm_medium=social&utm_campaign=nmf"

def friday_of(date_str):
    d = dt.date.fromisoformat(date_str[:10])
    wd = d.weekday()  # Mon=0 … Fri=4
    return d - dt.timedelta(days=(wd - 4) % 7)

def is_throwback(r):
    try:
        rel = dt.date.fromisoformat(r["releaseDate"][:10])
        pub = dt.date.fromisoformat((r.get("publishDate") or r["releaseDate"])[:10])
        return (pub - rel).days > 365
    except Exception:
        return False

def is_ec(r):
    return bool(re.search(r"eastern\s*cape", r.get("province") or "", re.I))

def nice_date(d):
    return d.strftime("%d %B %Y").lstrip("0")

def fetch_image(url):
    for u in [url, PLACEHOLDER]:
        if not u:
            continue
        try:
            big = u.replace("600x600bb", "1000x1000bb")
            req = urllib.request.Request(big, headers={"User-Agent": "iPlugGQ-NMF/1.0"})
            with urllib.request.urlopen(req, timeout=25) as resp:
                return Image.open(io.BytesIO(resp.read())).convert("RGB")
        except Exception:
            continue
    img = Image.new("RGB", (1000, 1000), SURFACE)
    return img

def rounded(img, radius):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, img.size[0] - 1, img.size[1] - 1], radius, fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out

def paste_with_shadow(base, img, xy, radius=28, blur=40, offset=18, opacity=170):
    x, y = xy
    shadow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        [x, y + offset, x + img.size[0], y + img.size[1] + offset], radius, fill=(0, 0, 0, opacity))
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(shadow)
    base.alpha_composite(rounded(img, radius), (x, y))

def text_w(draw, txt, f):
    return draw.textlength(txt, font=f)

def fit_lines(draw, txt, kind, max_w, max_lines, start, minimum, weight=700):
    """Largest font size where txt wraps into ≤ max_lines lines of ≤ max_w px."""
    for size in range(start, minimum - 1, -2):
        f = font(kind, size, weight)
        words, lines, cur = txt.split(), [], ""
        for w_ in words:
            trial = (cur + " " + w_).strip()
            if text_w(draw, trial, f) <= max_w:
                cur = trial
            else:
                if cur:
                    lines.append(cur)
                cur = w_
        if cur:
            lines.append(cur)
        if len(lines) <= max_lines and all(text_w(draw, l, f) <= max_w for l in lines):
            return f, lines
    f = font(kind, minimum, weight)
    # hard truncate
    lines = textwrap.wrap(txt, width=max(8, int(max_w / (minimum * 0.55))))[:max_lines]
    if lines:
        while text_w(draw, lines[-1] + "…", f) > max_w and len(lines[-1]) > 3:
            lines[-1] = lines[-1][:-1]
        lines[-1] = lines[-1].rstrip() + "…"
    return f, lines

def shape(img, method, *args, **kw):
    """Draw a (possibly semi-transparent) shape by compositing a layer, so alpha blends properly."""
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    getattr(ImageDraw.Draw(layer), method)(*args, **kw)
    img.alpha_composite(layer)

def pill(img, xy, label, f, bg, fg, pad_x=22, pad_y=12):
    draw = ImageDraw.Draw(img)
    x, y = xy
    tw = text_w(draw, label, f)
    bbox = f.getbbox(label)
    th = bbox[3] - bbox[1]
    h = th + pad_y * 2
    shape(img, "rounded_rectangle", [x, y, x + tw + pad_x * 2, y + h], h // 2, fill=bg)
    ImageDraw.Draw(img).text((x + pad_x, y + pad_y - bbox[1]), label, font=f, fill=fg)
    return x + tw + pad_x * 2

def play_icon(draw, cx, cy, r, bg=LIME, fg=DARK):
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=bg)
    s = r * 0.42
    draw.polygon([(cx - s * 0.7, cy - s), (cx - s * 0.7, cy + s), (cx + s, cy)], fill=fg)

def logo_badge(size):
    try:
        lg = Image.open(LOGO).convert("RGB").resize((size, size), Image.LANCZOS)
        return rounded(lg, size // 5)
    except Exception:
        return None

def base_canvas(h=H):
    img = Image.new("RGBA", (W, h), DARK + (255,))
    # subtle lime glow top-right
    glow = Image.new("RGBA", (W, h), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([W - 520, -380, W + 380, 420], fill=LIME + (34,))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(120)))
    return img

def header(img, label_right):
    d = ImageDraw.Draw(img)
    lb = logo_badge(84)
    if lb:
        img.alpha_composite(lb, (64, 56))
    d.text((166, 66), "iPlug GQ", font=font("head", 34), fill=TEXT)
    d.text((166, 106), "NEW MUSIC FRIDAY", font=font("body", 22, 700), fill=LIME)
    f = font("body", 24, 600)
    d.text((W - 64 - text_w(d, label_right, f), 86), label_right, font=f, fill=MUTED)

def footer(img, left, right=None, h=H):
    shape(img, "line", [64, h - 118, W - 64, h - 118], fill=(255, 255, 255, 34), width=2)
    d = ImageDraw.Draw(img)
    play_icon(d, 92, h - 66, 24)
    d.text((132, h - 84), left, font=font("body", 30, 700), fill=TEXT)
    if right:
        f = font("body", 26, 600)
        d.text((W - 64 - text_w(d, right, f), h - 80), right, font=f, fill=MUTED)

# ------------------------------------------------------------------ slides
def slide_cover(rel, week, covers, total):
    img = base_canvas()
    d = ImageDraw.Draw(img)
    header(img, nice_date(week).upper())
    d.text((64, 200), "NEW MUSIC", font=font("head", 128), fill=TEXT)
    d.text((64, 322), "FRIDAY.", font=font("head", 128), fill=LIME)
    n = len(rel)
    d.text((68, 470), f"{n} fresh drop{'s' if n != 1 else ''} from Mzansi this week",
           font=font("body", 38, 600), fill=TEXT)
    ec = sum(1 for r in rel if is_ec(r))
    if not ec:
        sub = "Swipe to discover  →"
    elif ec == n:
        sub = "All from the Eastern Cape  ·  Swipe  →"
    else:
        sub = f"Including {ec} from the Eastern Cape  ·  Swipe  →"
    d.text((68, 524), sub, font=font("body", 30, 500), fill=MUTED)

    # cover-art mosaic (up to 6)
    arts = covers[:6]
    cols = 3 if len(arts) >= 3 else max(1, len(arts))
    rows = 2 if len(arts) > 3 else 1
    gap, top = 22, 610
    size = int((W - 128 - gap * (cols - 1)) / cols)
    size = min(size, int((H - 150 - top - gap * (rows - 1)) / rows))
    total_w = cols * size + (cols - 1) * gap
    x0 = (W - total_w) // 2
    for i, a in enumerate(arts):
        r_, c_ = divmod(i, cols)
        if r_ >= rows:
            break
        tile = ImageOps.fit(a, (size, size), Image.LANCZOS)
        paste_with_shadow(img, tile, (x0 + c_ * (size + gap), top + r_ * (size + gap)), radius=22, blur=24, offset=10)
    footer(img, "Hear previews at ipluggq.com", f"1/{total}")
    return img

def slide_release(r, art, idx, total):
    img = base_canvas()
    # blurred art backdrop
    bg = ImageOps.fit(art, (W, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(60))
    bg = Image.blend(bg, Image.new("RGB", (W, H), DARK), 0.72).convert("RGBA")
    img.alpha_composite(bg)
    d = ImageDraw.Draw(img)
    header(img, (TYPES.get(r.get("releaseType"), "Single")).upper())

    size = 700
    tile = ImageOps.fit(art, (size, size), Image.LANCZOS)
    paste_with_shadow(img, tile, ((W - size) // 2, 180), radius=30)

    y = 920
    x = 64
    pf = font("body", 24, 800)
    if r.get("featured"):
        x = pill(img, (x, y), "EDITOR'S PICK", pf, LIME, DARK) + 12
    x = pill(img, (x, y), GENRES.get(r.get("genre"), "Music").upper(), pf, (255, 255, 255, 46), TEXT) + 12
    if is_ec(r):
        pill(img, (x, y), "EASTERN CAPE", pf, ORANGE, (255, 255, 255))
    d = ImageDraw.Draw(img)

    tf, tlines = fit_lines(d, r.get("title", ""), "head", W - 128, 2, 76, 46)
    ty = y + 66
    for line in tlines:
        d.text((64, ty), line, font=tf, fill=TEXT)
        ty += int(tf.size * 1.08)
    artist = r.get("artistName", "")
    if r.get("featuredArtists"):
        artist += f"  ft. {r['featuredArtists']}"
    af, alines = fit_lines(d, artist, "body", W - 128, 1, 40, 28, 600)
    d.text((64, ty + 6), alines[0] if alines else "", font=af, fill=LIME)

    meta = [nice_date(dt.date.fromisoformat(r["releaseDate"][:10])) if r.get("releaseDate") else ""]
    if r.get("recordLabel"):
        meta.append(r["recordLabel"])
    mf, mlines = fit_lines(d, "  ·  ".join(m for m in meta if m), "body", W - 128, 1, 26, 22, 500)
    d.text((64, ty + 62), mlines[0] if mlines else "", font=mf, fill=MUTED)

    footer(img, "Tap to preview on ipluggq.com", f"{idx}/{total}")
    return img

def slide_cta(total):
    img = base_canvas()
    d = ImageDraw.Draw(img)
    header(img, "")
    lb = logo_badge(260)
    if lb:
        paste_with_shadow(img, lb.convert("RGB"), ((W - 260) // 2, 200), radius=52)
    def center(txt, y, f, fill):
        d.text(((W - text_w(d, txt, f)) / 2, y), txt, font=f, fill=fill)
    center("Hear 30-second previews", 520, font("head", 66), TEXT)
    center("of every track.", 596, font("head", 66), LIME)
    center("Link in bio  ·  ipluggq.com/music-friday", 700, font("body", 34, 600), TEXT)

    # artist box
    shape(img, "rounded_rectangle", [96, 800, W - 96, 1080], 34, fill=SURFACE + (255,), outline=(255, 255, 255, 40), width=2)
    d = ImageDraw.Draw(img)
    center("ARTISTS, DJs & LABELS", 836, font("body", 26, 800), ORANGE)
    center("Get your new music featured", 884, font("head", 48), TEXT)
    center("Free to submit, reviewed every week", 950, font("body", 30, 500), MUTED)
    center("ipluggq.com/submit-music", 1000, font("body", 32, 700), LIME)

    center("Follow @ipluggq for every Friday drop", H - 200, font("body", 32, 700), TEXT)
    footer(img, "New drops every Friday", f"{total}/{total}")
    return img

def story(rel, week, covers):
    h = 1920
    img = base_canvas(h)
    d = ImageDraw.Draw(img)
    header(img, nice_date(week).upper())
    d.text((64, 230), "NEW MUSIC", font=font("head", 130), fill=TEXT)
    d.text((64, 354), "FRIDAY.", font=font("head", 130), fill=LIME)
    y, thumb, step = 540, 160, 180
    for r, a in list(zip(rel, covers))[:6]:
        tile = ImageOps.fit(a, (thumb, thumb), Image.LANCZOS)
        paste_with_shadow(img, tile, (64, y), radius=18, blur=16, offset=6)
        tf, tl = fit_lines(d, r.get("title", ""), "head", W - 320, 1, 44, 30)
        d.text((252, y + 26), tl[0] if tl else "", font=tf, fill=TEXT)
        af, al = fit_lines(d, r.get("artistName", ""), "body", W - 320, 1, 32, 24, 600)
        d.text((252, y + 86), al[0] if al else "", font=af, fill=ORANGE if is_ec(r) else LIME)
        y += step
    # leave room above the footer for an Instagram link sticker
    d.text((64, max(y + 30, h - 270)), "Tap the link to preview every track", font=font("body", 36, 700), fill=TEXT)
    footer(img, "ipluggq.com/music-friday", None, h)
    return img

# ------------------------------------------------------------------ text pack
def build_pack(rel, week, all_week):
    label = nice_date(week)
    n = len(rel)
    ec = [r for r in all_week if is_ec(r)]
    lines = [f"# iPlug GQ: New Music Friday pack ({label})\n",
             f"Generated from music-releases.json. **{len(all_week)} new release(s)** this week, {len(ec)} from the Eastern Cape.\n",
             "**Images:** `social/nmf/latest/`. `slide-01.jpg` … are the Instagram carousel (post them in order). "
             "`story.jpg` is for your Instagram story and WhatsApp Status.\n",
             "Tip: tag every artist in the carousel and send them the outreach message (section 6). "
             "When they repost, their fans find you.\n"]

    # WhatsApp
    lines.append("## 1. WhatsApp Channel / broadcast (Friday 09:00)\n```")
    lines.append(f"🎧 *NEW MUSIC FRIDAY*: {label}")
    lines.append(f"{len(all_week)} fresh drop{'s' if len(all_week) != 1 else ''} from Mzansi 🔥\n")
    for r in all_week:
        badges = []
        if r.get("featured"): badges.append("⭐ PICK")
        if is_ec(r): badges.append("📍 EC")
        b = f"  ({' · '.join(badges)})" if badges else ""
        lines.append(f"▶️ *{r['title']}*: {r['artistName']}{b}")
        lines.append(f"   {GENRES.get(r.get('genre'), 'Music')} · {TYPES.get(r.get('releaseType'), 'Single')}")
        lines.append(f"   {release_link(r, 'whatsapp')}\n")
    lines.append(f"Preview every track in 30 seconds 👉 {page_link('whatsapp')}")
    lines.append("Which one's on repeat this weekend? Reply 👇🏾")
    lines.append("```\n")

    # Instagram caption
    tags = sorted({HASHTAGS[r['genre']] for r in all_week if r.get("genre") in HASHTAGS})
    lines.append("## 2. Instagram carousel caption (Friday 12:00)\n```")
    lines.append(f"NEW MUSIC FRIDAY 🎧 {label}\n")
    lines.append(f"{len(all_week)} new drop{'s' if len(all_week) != 1 else ''} you need in your rotation this weekend. Swipe 👉🏾\n")
    for i, r in enumerate(rel, start=2):
        ecmark = " 📍EC" if is_ec(r) else ""
        lines.append(f"{i}. {r['title']}: {r['artistName']}{ecmark}")
    if len(all_week) > len(rel):
        lines.append(f"…plus {len(all_week) - len(rel)} more on the site")
    lines.append("\n▶️ Preview every track in 30 seconds: link in bio")
    lines.append("🎤 Artists: submit your music free on ipluggq.com/submit-music\n")
    lines.append("Drop a 🔥 on your favourite and tag who needs to hear it.\n")
    lines.append(" ".join(["#NewMusicFriday", "#NMF", "#SAMusic", "#Mzansi", "#Gqeberha", "#EasternCape", "#iPlugGQ"] + tags))
    lines.append("```")
    lines.append("**Tag these artists on the slides:** " + ", ".join(r["artistName"] for r in rel) + "\n")

    # Reels / TikTok
    lines.append("## 3. Reels / TikTok script (15–30 s)\n```")
    lines.append('HOOK (0–2s, text): "New music Friday in Mzansi. Which one wins? 👀"')
    lines.append("Use the 30-second preview from the site as the sound for each clip (screen-record ipluggq.com/music-friday while it plays),")
    lines.append("or film yourself reacting to each one. 3–4 s per track:")
    for r in rel[:5]:
        lines.append(f"  • {r['title']}: {r['artistName']}  [text overlay: {GENRES.get(r.get('genre'), 'Music')}]")
    lines.append('END CARD: "Preview them all → ipluggq.com 🔌 Follow for every Friday drop"')
    lines.append('CAPTION: "Rate this week\'s drops 1–10 👇🏾 #NewMusicFriday #Amapiano #SAMusic #iPlugGQ"')
    lines.append("```\n")

    # Story stickers
    lines.append("## 4. Instagram story / WhatsApp Status (post story.jpg)\n")
    lines.append("- Add a **link sticker** → `" + page_link("instagram_story") + "`")
    if len(rel) >= 2:
        lines.append(f"- Add a **poll sticker**: \"{rel[0]['title']}\" vs \"{rel[1]['title']}\"")
    lines.append("- Second story: a **slider sticker** 🔥 on the Editor's Pick\n")

    # X
    lines.append("## 5. X / Facebook (one per track, Fri–Sun)\n```")
    for r in all_week:
        lines.append(f"🎧 {r['title']}: {r['artistName']}. New this Friday on iPlug GQ. Preview it 👉 {release_link(r, 'x')} #NewMusicFriday #SAMusic")
    lines.append("```\n")

    # Outreach
    lines.append("## 6. Artist / label outreach (send Friday)\n")
    lines.append("Send to each artist (DM or WhatsApp). Attach their slide from `social/nmf/latest/`.\n```")
    lines.append("Hi 👋🏾 iPlug GQ here. Your new release *<TITLE>* is featured on this week's New Music Friday 🔥")
    lines.append("<LINK>")
    lines.append("Fans can preview it and stream it straight from the page. We've attached your slide. "
                 "Feel free to post it and tag @ipluggq 🙌🏾 Next drop? Submit it free on ipluggq.com/submit-music")
    lines.append("```")
    for r in all_week:
        lines.append(f"- **{r['artistName']}**: *{r['title']}* → {release_link(r, 'artist_share')}")
    lines.append("")
    return "\n".join(lines)

# ------------------------------------------------------------------ main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--today", default=None)
    ap.add_argument("--file", default=os.path.join(ROOT, "music-releases.json"))
    ap.add_argument("--out", default=os.path.join(ROOT, "social", "nmf"))
    a = ap.parse_args()
    today = dt.date.fromisoformat(a.today) if a.today else (dt.datetime.utcnow() + dt.timedelta(hours=2)).date()

    data = json.load(open(a.file, encoding="utf-8"))
    live = [r for r in data if r.get("status") == "published"
            and (r.get("publishDate") or r.get("releaseDate") or "9999") <= today.isoformat()
            and not is_throwback(r)]
    if not live:
        print("No published releases yet. Nothing to generate.")
        return
    week = max(friday_of(r.get("publishDate") or r["releaseDate"]) for r in live)
    all_week = [r for r in live if friday_of(r.get("publishDate") or r["releaseDate"]) == week]
    # Order: Editor's picks → Eastern Cape → newest
    all_week.sort(key=lambda r: r.get("releaseDate", ""), reverse=True)
    all_week.sort(key=lambda r: (not r.get("featured"), not is_ec(r)))
    rel = all_week[:MAX_RELEASE_SLIDES]

    out_dir = os.path.join(a.out, "latest")
    if os.path.isdir(out_dir):
        shutil.rmtree(out_dir)
    os.makedirs(out_dir)

    print(f"Week of Friday {week}: {len(all_week)} releases, {len(rel)} on the carousel")
    arts = [fetch_image(r.get("coverArt")) for r in rel]

    total = len(rel) + 2
    slides = [slide_cover(rel, week, arts, total)]
    slides += [slide_release(r, art, i, total) for i, (r, art) in enumerate(zip(rel, arts), start=2)]
    slides.append(slide_cta(total))
    for i, s in enumerate(slides, start=1):
        s.convert("RGB").save(os.path.join(out_dir, f"slide-{i:02d}.jpg"), quality=90, optimize=True, progressive=True)
    story(rel, week, arts).convert("RGB").save(os.path.join(out_dir, "story.jpg"), quality=90, optimize=True)

    with open(os.path.join(a.out, "weekly-music-pack.md"), "w", encoding="utf-8") as f:
        f.write(build_pack(rel, week, all_week))
    print(f"✔ {total} carousel slides + story.jpg in social/nmf/latest/ · social/nmf/weekly-music-pack.md")

if __name__ == "__main__":
    main()
