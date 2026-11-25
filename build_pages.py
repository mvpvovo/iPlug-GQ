#!/usr/bin/env python3
"""
iPlug GQ – SEO page generator
=============================
Reads your existing events.csv and generates:

  events/<id>-<slug>.html   one indexable page per event (Event schema + flyer preview for WhatsApp/FB)
  this-weekend.html         "Gigs in Gqeberha this weekend" – refreshed every build
  areas/<area>.html         "Events in Motherwell / New Brighton / Summerstrand ..." landing pages
  sitemap.xml               every page above + your existing pages
  robots.txt                points Google to the sitemap
  social/weekly-pack.md     ready-to-post captions for WhatsApp, Instagram, TikTok, X

Usage (run from the root of your website repo):
    python3 build_pages.py                 # uses ./events.csv, today's date
    python3 build_pages.py --today 2026-11-25

No dependencies – plain Python 3.8+.
"""
import argparse, csv, datetime as dt, html, json, os, re, shutil
from collections import defaultdict
from urllib.parse import quote, urlparse

SITE = "https://ipluggq.com"
BRAND = "iPlug GQ"
DEFAULT_IMG = "https://ik.imagekit.io/vurvay/iPlug%20GQ%20logo1.png"
WHATSAPP = "https://wa.me/27815294035"
STATIC_PAGES = [("", "daily", "1.0"), ("stories.html", "weekly", "0.7"),
                ("music-friday.html", "weekly", "0.8"), ("submit-music.html", "monthly", "0.6")]

# Area landing pages: slug -> (display name, keywords matched against venue/location text)
AREAS = {
    "motherwell":   ("Motherwell", ["motherwell", " nu1", " nu2", "nu10", "nu29", "nu8", "ngcibane"]),
    "new-brighton": ("New Brighton", ["new brighton", "ferguson road"]),
    "zwide":        ("Zwide", ["zwide"]),
    "kwazakhele":   ("KwaZakhele", ["kwazakhele", "kwano"]),
    "wells-estate": ("Wells Estate", ["wells estate"]),
    "central":      ("Central & Richmond Hill", ["central", "richmond hill", "parliament street", "chapel street", "south end", "poppe street", "hoog street"]),
    "summerstrand": ("Summerstrand, Humewood & Beachfront", ["summerstrand", "humewood", "hobie", "beach", "happy valley"]),
    "harbour":      ("PE Harbour & Humerail", ["harbour", "humerail", "deal party"]),
    "walmer":       ("Walmer & Cape Road", ["walmer", "cape road", "hunters retreat", "westbourne", "moffett", "moffet"]),
    "kariega":      ("Kariega (Uitenhage)", ["kariega", "uitenhage"]),
    "addo":         ("Addo & Surroundings", ["addo", "kirkwood"]),
}

# ---------------------------------------------------------------- helpers
def slugify(text):
    text = text.lower().replace("&", " and ").replace("'", "")
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")[:70].strip("-")

def event_slug(e):
    """Same rule is mirrored in the JS snippet (see README) so share links match."""
    return f"{e['id']}-{slugify(e['title'] + ' ' + e['venue'])}"

def esc(s):
    return html.escape(s or "", quote=True)

def abs_url(u):
    if not u:
        return DEFAULT_IMG
    if u.startswith("http"):
        return u
    return f"{SITE}/{u.lstrip('/')}"

TIME_RE = re.compile(r"\b(\d{1,2})(?:[:h](\d{2}))\s*(am|pm)?\b|\b(\d{1,2})\s*(am|pm)\b", re.I)

def guess_start_time(desc):
    """Pull the first time mentioned in the description ('18:00', '3pm', '10:00 until late')."""
    m = TIME_RE.search(desc or "")
    if not m:
        return "18:00"
    if m.group(1):
        h, mi, ap = int(m.group(1)), int(m.group(2)), (m.group(3) or "").lower()
    else:
        h, mi, ap = int(m.group(4)), 0, m.group(5).lower()
    if ap == "pm" and h < 12: h += 12
    if ap == "am" and h == 12: h = 0
    if not (0 <= h <= 23): return "18:00"
    return f"{h:02d}:{mi:02d}"

def is_free(e):
    return bool(re.search(r"free (entry|entrance|at the gate)|entry is free|entrance is free|\bfree\b", e["desc"], re.I))

def area_for(e):
    hay = f" {e['venue']} {e['location']} ".lower()
    for slug, (_, keys) in AREAS.items():
        if any(k in hay for k in keys):
            return slug
    return None

def nice_date(d):
    return d.strftime("%A, %d %B %Y").replace(" 0", " ")

def short_date(d):
    return d.strftime("%a %d %b").replace(" 0", " ")

def maps_link(e):
    if e["lat"] and e["lng"]:
        q = f"{e['lat']},{e['lng']}"
    else:
        q = f"{e['venue']}, {e['location']}, Gqeberha"
    return f"https://www.google.com/maps/search/?api=1&query={quote(q)}"

# ---------------------------------------------------------------- data
def normalize_date(value):
    """Mirror of normalizeEventDate() in script.js: YYYY-MM-DD or DD/MM/YYYY."""
    m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})$", value)
    if m:
        y, mo, d = m.groups()
    else:
        m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", value)
        if not m:
            raise ValueError(value)
        d, mo, y = m.groups()
    return dt.date(int(y), int(mo), int(d))

def js_hash_id(text):
    """Mirror of generateEventHashId() in script.js (32-bit FNV-1a over UTF-16 code units)."""
    h = 2166136261
    data = text.encode("utf-16-le")
    for i in range(0, len(data), 2):
        h ^= data[i] | (data[i + 1] << 8)
        h = (h * 16777619) & 0xFFFFFFFF
    return h

def load_events(path):
    """Parses events.csv with exactly the same rules as parseEventsCsv() in script.js,
    so event IDs (and therefore page URLs) always match what the site uses."""
    out, used = [], set()
    with open(path, encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            g = lambda k: (r.get(k) or "").strip()
            title, raw_date, venue = g("Event Name"), g("Date"), g("Venue")
            if not title or not raw_date or not venue:
                continue
            try:
                d = normalize_date(raw_date)
            except ValueError:
                continue
            raw_id = g("Event ID")
            eid = int(raw_id) if raw_id.isdigit() else 0
            if not eid or eid in used:
                eid = js_hash_id(f"{title}-{d.isoformat()}-{venue}")
                while eid in used:
                    eid += 1
            used.add(eid)
            e = {
                "id": str(eid),
                "title": title,
                "date": d,
                "venue": venue,
                "location": g("Venue Location") or "Gqeberha",
                "flyer": abs_url(g("Flyer Image URL")),
                "desc": g("Event Description"),
                "category": g("Category") or "Other",
                "lat": g("Latitude"),
                "lng": g("Longitude"),
                "ticket": ticket_url(g("Ticket URL"), g("Event Description")),
            }
            e["slug"] = event_slug(e)
            e["url"] = f"{SITE}/events/{e['slug']}.html"
            e["time"] = guess_start_time(e["desc"])
            e["area"] = area_for(e)
            e["free"] = is_free(e)
            out.append(e)
    out.sort(key=lambda x: (x["date"], x["time"]))
    return out

# ---------------------------------------------------------------- templates
CSS = """
:root{--p:#f5ff58;--s:#ff6b4a;--bg:#0e0f0c;--sf:#191a17;--card:#20211d;--t:#f7f7f2;--m:#a6a89c;--l:rgba(255,255,255,.1)}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--t);font-family:'DM Sans',system-ui,sans-serif;line-height:1.6}
a{color:var(--p)}.wrap{max-width:960px;margin:0 auto;padding:20px}
header.top{display:flex;justify-content:space-between;align-items:center;padding:14px 20px;border-bottom:1px solid var(--l)}
header.top a.logo{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:1.3rem;color:var(--t);text-decoration:none}
header.top a.logo span{color:var(--p)}
.crumbs{font-size:.85rem;color:var(--m);margin:8px 0 18px}.crumbs a{color:var(--m)}
h1,h2,h3{font-family:'Space Grotesk',sans-serif;line-height:1.15}h1{font-size:clamp(1.8rem,5vw,2.8rem);margin:.2em 0}
.ev{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:28px}
@media(max-width:720px){.ev{grid-template-columns:1fr}}
.ev img{width:100%;border-radius:16px;border:1px solid var(--l)}
.chip{display:inline-block;padding:3px 10px;border-radius:99px;background:var(--sf);border:1px solid var(--l);font-size:.8rem;margin:0 6px 6px 0}
.chip.free{background:var(--p);color:#111;font-weight:700}
.meta{background:var(--sf);border:1px solid var(--l);border-radius:12px;padding:14px 16px;margin:16px 0}
.meta div{margin:4px 0}.btns{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0}
.btn{display:inline-block;padding:11px 18px;border-radius:99px;font-weight:700;text-decoration:none;border:1px solid var(--l);color:var(--t);background:var(--card)}
.btn.pri{background:var(--p);color:#111;border:none}.btn.wa{background:#25D366;color:#062;border:none}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}
.card{background:var(--card);border:1px solid var(--l);border-radius:14px;overflow:hidden;text-decoration:none;color:var(--t);display:block}
.card img{width:100%;aspect-ratio:4/5;object-fit:cover;display:block}.card .b{padding:10px 12px}
.card .d{color:var(--p);font-size:.8rem;font-weight:700;text-transform:uppercase}.card h3{font-size:1rem;margin:4px 0}
.card .v{color:var(--m);font-size:.85rem}.cta{background:var(--sf);border:1px dashed var(--p);border-radius:14px;padding:18px;margin:30px 0}
footer{color:var(--m);font-size:.85rem;border-top:1px solid var(--l);margin-top:40px;padding:20px;text-align:center}
.areas a{margin-right:10px;white-space:nowrap}
"""

def page(title, desc, canonical, body, og_image=DEFAULT_IMG, jsonld=None, og_type="website", robots="index,follow"):
    ld = ""
    if jsonld:
        ld = f'<script type="application/ld+json">{json.dumps(jsonld, ensure_ascii=False)}</script>'
    return f"""<!DOCTYPE html>
<html lang="en-ZA">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<meta name="robots" content="{robots}">
<link rel="canonical" href="{canonical}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:image" content="{esc(og_image)}">
<meta property="og:url" content="{canonical}">
<meta property="og:type" content="{og_type}">
<meta property="og:site_name" content="{BRAND}">
<meta property="og:locale" content="en_ZA">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(title)}">
<meta name="twitter:description" content="{esc(desc)}">
<meta name="twitter:image" content="{esc(og_image)}">
<meta name="theme-color" content="#0e0f0c">
<link rel="icon" href="{DEFAULT_IMG}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet">
<style>{CSS}</style>
{ld}
<script async src="https://www.googletagmanager.com/gtag/js?id=G-L2BY77G88S"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments)}}gtag('js',new Date());gtag('config','G-L2BY77G88S');</script>
</head>
<body>
<header class="top"><a class="logo" href="{SITE}/">iPlug <span>GQ</span></a>
<nav><a href="{SITE}/this-weekend.html">This weekend</a> · <a href="{SITE}/#submit">List an event</a></nav></header>
<main class="wrap">{body}</main>
<footer>{BRAND} · Gqeberha's gig guide · New gigs every Wednesday ·
<a href="{WHATSAPP}">WhatsApp us</a> · <a href="https://www.instagram.com/ipluggq">Instagram</a> · <a href="https://www.tiktok.com/@iplug.gq">TikTok</a></footer>
</body></html>"""

def card(e):
    return f"""<a class="card" href="{SITE}/events/{e['slug']}.html">
<img loading="lazy" src="{esc(e['flyer'])}" alt="{esc(e['title'])} flyer">
<div class="b"><div class="d">{short_date(e['date'])} · {e['time']}</div><h3>{esc(e['title'])}</h3>
<div class="v">{esc(e['venue'])}</div></div></a>"""

def area_links():
    return '<p class="areas">Browse by area: ' + " ".join(
        f'<a href="{SITE}/areas/{s}.html">{esc(n)}</a>' for s, (n, _) in AREAS.items()) + "</p>"

def event_jsonld(e):
    start = f"{e['date'].isoformat()}T{e['time']}:00+02:00"
    ld = {
        "@context": "https://schema.org",
        "@type": "Event",
        "name": e["title"],
        "startDate": start,
        "eventStatus": "https://schema.org/EventScheduled",
        "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
        "url": e["url"],
        "image": [e["flyer"]],
        "description": e["desc"] or f"{e['title']} at {e['venue']}, Gqeberha.",
        "location": {
            "@type": "Place",
            "name": e["venue"] or "Gqeberha",
            "address": {
                "@type": "PostalAddress",
                "streetAddress": e["location"],
                "addressLocality": "Gqeberha",
                "addressRegion": "Eastern Cape",
                "addressCountry": "ZA",
            },
        },
        # Google wants the organiser to be the promoter/venue, not the listing site.
        "organizer": {"@type": "Organization", "name": e["venue"] or BRAND},
    }
    if e["lat"] and e["lng"]:
        ld["location"]["geo"] = {"@type": "GeoCoordinates", "latitude": e["lat"], "longitude": e["lng"]}
    if e.get("ticket") and not e["free"]:
        m = re.search(r"R\s?(\d{2,5})", e["desc"])
        ld["offers"] = {"@type": "Offer", "url": e["ticket"], "priceCurrency": "ZAR",
                        "availability": "https://schema.org/InStock",
                        "seller": {"@type": "Organization", "name": ticket_provider(e["ticket"])}}
        if m:
            ld["offers"]["price"] = m.group(1)
    elif e["free"]:
        ld["isAccessibleForFree"] = True
        ld["offers"] = {"@type": "Offer", "price": "0", "priceCurrency": "ZAR",
                        "availability": "https://schema.org/InStock", "url": e["url"]}
    else:
        m = re.search(r"R\s?(\d{2,5})", e["desc"])
        if m:
            ld["offers"] = {"@type": "Offer", "price": m.group(1), "priceCurrency": "ZAR",
                            "availability": "https://schema.org/InStock", "url": e["url"]}
    return ld

TICKET_RE = re.compile(r"(https?://[^\s]+(?:quicket|qkt\.io|howler|computicket|webtickets|ticketpro|itickets|ticket)[^\s]*)", re.I)

def ticket_url(col, desc):
    """Mirror of script.js: the Ticket URL column wins, else a ticket link found in the description."""
    col = (col or "").strip()
    if re.match(r"^https?://", col, re.I):
        return col
    m = TICKET_RE.search(desc or "")
    return m.group(1) if m else ""

def ticket_provider(url):
    host = re.sub(r"^www\.", "", urlparse(url).netloc.lower())
    for h, name in (("quicket.co.za", "Quicket"), ("qkt.io", "Quicket"), ("howler.co.za", "Howler"),
                    ("computicket.com", "Computicket"), ("webtickets.co.za", "Webtickets"),
                    ("ticketpro.co.za", "TicketPro"), ("itickets.co.za", "iTickets")):
        if host == h or host.endswith("." + h):
            return name
    return host

def render_event(e, all_events, today):
    past = e["date"] < today
    area_name = AREAS[e["area"]][0] if e["area"] else "Gqeberha"
    title = f"{e['title']} – {e['venue']} | {short_date(e['date'])} | {BRAND}"
    desc = (f"{e['title']} at {e['venue']}, {area_name} on {nice_date(e['date'])}. "
            + (e["desc"][:110] + "…" if len(e["desc"]) > 110 else e["desc"]))
    share_text = f"🔥 {e['title']} – {short_date(e['date'])} @ {e['venue']}. Details on iPlug GQ 👉 {e['url']}"
    related = [x for x in all_events if x["id"] != e["id"] and x["date"] >= today
               and (x["area"] == e["area"] or x["date"] == e["date"])][:4]
    chips = f'<span class="chip">{esc(e["category"])}</span><span class="chip">{esc(area_name)}</span>'
    if e["free"]:
        chips += '<span class="chip free">Free entry</span>'
    if past:
        chips += '<span class="chip">Past event</span>'
    ticket_btn = ""
    if e.get("ticket") and not past:
        prov = ticket_provider(e["ticket"])
        ticket_btn = (f'<a class="btn pri" href="{esc(e["ticket"])}" target="_blank" rel="noopener" '
                      f'onclick="window.gtag&&gtag(\'event\',\'ticket_click\',{{event_title:{esc(json.dumps(e["title"]))},ticket_provider:{esc(json.dumps(prov))},ticket_mode:\'event_page\'}})">'
                      f'🎟️ Get Tickets</a>\n      ')
    body = f"""
<div class="crumbs"><a href="{SITE}/">Home</a> › <a href="{SITE}/{'areas/' + e['area'] + '.html' if e['area'] else 'this-weekend.html'}">{esc(area_name)}</a> › {esc(e['title'])}</div>
<article class="ev">
  <div><img src="{esc(e['flyer'])}" alt="{esc(e['title'])} flyer – {esc(e['venue'])}, Gqeberha"></div>
  <div>
    {chips}
    <h1>{esc(e['title'])}</h1>
    <div class="meta">
      <div>📅 <strong>{nice_date(e['date'])}</strong> · from {e['time']}</div>
      <div>📍 <strong>{esc(e['venue'])}</strong>, {esc(e['location'])}</div>
    </div>
    <p>{esc(e['desc'])}</p>
    <div class="btns">
      {ticket_btn}<a class="btn{'' if ticket_btn else ' pri'}" href="{maps_link(e)}" target="_blank" rel="noopener">Get directions</a>
      <a class="btn wa" href="https://wa.me/?text={quote(share_text)}" target="_blank" rel="noopener">Share on WhatsApp</a>
      <a class="btn" href="{SITE}/#events">All gigs in GQ</a>
    </div>
    <p style="color:var(--m);font-size:.85rem">Details are supplied by the organiser. Confirm with the venue before you go.</p>
  </div>
</article>
{('<h2>More gigs you might like</h2><div class="grid">' + ''.join(card(x) for x in related) + '</div>') if related else ''}
<div class="cta"><strong>Hosting an event in Gqeberha?</strong> List it on iPlug GQ for free so the city can find it.
<a href="{SITE}/#submit">Submit your event →</a></div>
{area_links()}
"""
    # Past events stay online (they still earn links), but drop out of the sitemap.
    return page(title, desc, e["url"], body, og_image=e["flyer"], jsonld=event_jsonld(e), og_type="article")

def weekend_range(today):
    # Thursday → Sunday window ("the weekend" in GQ nightlife terms). On Mon–Wed show the coming one.
    wd = today.weekday()  # Mon=0
    start = today if wd >= 3 else today + dt.timedelta(days=3 - wd)
    end = start + dt.timedelta(days=6 - start.weekday())
    return start, end

def render_weekend(events, today):
    start, end = weekend_range(today)
    wk = [e for e in events if start <= e["date"] <= end]
    nxt = [e for e in events if e["date"] > end][:8]
    label = f"{start.strftime('%d %b').lstrip('0')} – {end.strftime('%d %b %Y').lstrip('0')}"
    title = f"What's on in Gqeberha this weekend ({label}) | Gigs, Parties & Events | {BRAND}"
    desc = (f"{len(wk)} gigs, parties and day groove events in Gqeberha (PE) this weekend, {label}. "
            "Amapiano, house, kasi vibes, comedy and more. Updated every Wednesday.")
    by_day = defaultdict(list)
    for e in wk:
        by_day[e["date"]].append(e)
    sections = "".join(
        f"<h2>{nice_date(d)}</h2><div class='grid'>{''.join(card(e) for e in by_day[d])}</div>"
        for d in sorted(by_day)) or "<p>New listings drop every Wednesday. Check back soon.</p>"
    free_n = sum(1 for e in wk if e["free"])
    body = f"""
<div class="crumbs"><a href="{SITE}/">Home</a> › This weekend</div>
<h1>What's on in Gqeberha this weekend</h1>
<p><strong>{label}</strong> · {len(wk)} events · {free_n} with free entry. Updated every Wednesday by iPlug GQ.
Find amapiano, house, gqom and R&amp;B nights, kasi vibes and day grooves across PE, Motherwell, New Brighton, Zwide, KwaZakhele and Summerstrand.</p>
{sections}
{('<h2>Coming up next</h2><div class="grid">' + ''.join(card(e) for e in nxt) + '</div>') if nxt else ''}
<div class="cta">📲 <strong>Get the weekly drop on WhatsApp</strong>. Every Wednesday we send the week's best gigs straight to your phone.
<a href="{WHATSAPP}">Join here →</a></div>
{area_links()}
"""
    ld = {"@context": "https://schema.org", "@type": "ItemList", "name": f"Gqeberha events this weekend ({label})",
          "itemListElement": [{"@type": "ListItem", "position": i + 1, "url": e["url"]} for i, e in enumerate(wk)]}
    return page(title, desc, f"{SITE}/this-weekend.html", body, jsonld=ld), wk, (start, end)

def render_area(slug, events, today):
    name = AREAS[slug][0]
    up = [e for e in events if e["area"] == slug and e["date"] >= today]
    past = [e for e in events if e["area"] == slug and e["date"] < today][-8:][::-1]
    title = f"Events in {name}, Gqeberha – Upcoming Gigs & Parties | {BRAND}"
    desc = (f"Upcoming events, parties and gigs in {name}, Gqeberha. {len(up)} upcoming listings, "
            "including lounges, taverns, clubs and day grooves. Updated weekly.")
    body = f"""
<div class="crumbs"><a href="{SITE}/">Home</a> › Areas › {esc(name)}</div>
<h1>Events in {esc(name)}</h1>
<p>The latest gigs, parties and day grooves in {esc(name)}, Gqeberha, from local lounges and taverns to headline shows. New events are added every Wednesday.</p>
<h2>Upcoming</h2>
{('<div class="grid">' + ''.join(card(e) for e in up) + '</div>') if up else '<p>No upcoming listings yet. <a href="' + SITE + '/#submit">Add the first one</a>.</p>'}
{('<h2>Recent events</h2><div class="grid">' + ''.join(card(e) for e in past) + '</div>') if past else ''}
<div class="cta"><strong>Run a venue in {esc(name)}?</strong> Get your weekly events listed for free on iPlug GQ. <a href="{WHATSAPP}">WhatsApp us →</a></div>
{area_links()}
"""
    return page(title, desc, f"{SITE}/areas/{slug}.html", body), len(up)

def render_sitemap(events, today, area_counts):
    urls = [(f"{SITE}/{p}", today.isoformat(), f, pr) for p, f, pr in STATIC_PAGES]
    urls.append((f"{SITE}/this-weekend.html", today.isoformat(), "daily", "0.9"))
    for slug, n in area_counts.items():
        urls.append((f"{SITE}/areas/{slug}.html", today.isoformat(), "weekly", "0.7" if n else "0.4"))
    for e in events:
        if e["date"] >= today - dt.timedelta(days=30):   # recent + upcoming only
            urls.append((e["url"], today.isoformat(), "weekly", "0.8" if e["date"] >= today else "0.3"))
    body = "\n".join(f"  <url><loc>{u}</loc><lastmod>{m}</lastmod><changefreq>{c}</changefreq><priority>{p}</priority></url>"
                     for u, m, c, p in urls)
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{body}\n</urlset>\n', len(urls)

def render_social(wk, rng, events, today):
    start, end = rng
    label = f"{start.strftime('%d').lstrip('0')}–{end.strftime('%d %b').lstrip('0')}"
    lines = []
    lines.append(f"# iPlug GQ – Weekly social pack ({label})\n")
    lines.append("Generated from events.csv. Copy, paste and post. Tag the venue and promoter in every post, because their reposts bring you new followers.\n")
    # WhatsApp
    lines.append("## 1. WhatsApp Channel / Status broadcast (post Wednesday 12:00)\n```")
    lines.append(f"🔌 *iPlug GQ Weekly Drop*: {label}\nGqeberha is outside 🌴🔥\n")
    for e in wk:
        lines.append(f"📅 *{short_date(e['date'])}*: {e['title']}\n📍 {e['venue']}{'  🆓 FREE' if e['free'] else ''}{'  🎟️ Tickets online' if e.get('ticket') and not e['free'] else ''}\n🔗 {e['url']}\n")
    lines.append(f"See all {len(wk)} gigs 👉 {SITE}/this-weekend.html\nForward this to your squad 🙌🏾\n```\n")
    # Instagram carousel
    lines.append("## 2. Instagram carousel (post Wednesday 18:00)\n")
    lines.append("Slide 1: cover graphic \"THIS WEEKEND IN GQ\" plus the date. Slides 2–10: one flyer per slide (start with the free events and the Sponsored pick).\n```")
    lines.append(f"This weekend in GQ 🔌 {label}\n\n{len(wk)} gigs, {sum(e['free'] for e in wk)} free entry. Swipe and tag who you're pulling up with 👀\n")
    for e in wk[:9]:
        lines.append(f"▪️ {short_date(e['date'])}: {e['title']} @ {e['venue']}")
    lines.append(f"\nFull guide + directions: link in bio (ipluggq.com/this-weekend)\n")
    lines.append("#Gqeberha #PortElizabeth #GQ #NelsonMandelaBay #PEnightlife #Amapiano #GqeberhaEvents #iPlugGQ #KasiVibes #EasternCape\n```\n")
    # TikTok
    lines.append("## 3. TikTok / Reels script (15–30 s)\n```")
    lines.append("HOOK (0–2s, text on screen): \"POV: you live in GQ and have no plans this weekend 😩\"")
    lines.append("BEAT DROP → quick cuts of 4–6 flyers (1.5s each) with a text overlay of day + venue")
    for e in wk[:6]:
        lines.append(f"  • {short_date(e['date'])} | {e['title']} | {e['venue']}")
    lines.append("END CARD: \"All the gigs → ipluggq.com 🔌 Follow for the weekly drop\"")
    lines.append("Sound: whatever amapiano track is trending this week. Caption: \"Which one are you pulling up to? 👇🏾\"\n```\n")
    # X / Facebook
    lines.append("## 4. X / Facebook groups (one post per event, Thu–Sat)\n```")
    for e in wk:
        tag = " Free entry 🆓" if e["free"] else ""
        lines.append(f"{e['title']} 📍 {e['venue']} · {short_date(e['date'])}.{tag} {e['url']} #Gqeberha #iPlugGQ")
    lines.append("```\n")
    # Outreach
    venues = sorted({e["venue"] for e in wk if e["venue"]})
    lines.append("## 5. Venue / promoter outreach (send Thursday)\n")
    lines.append("Send this WhatsApp to each venue below. It gives them a free link to share, and when they share it your traffic grows.\n```")
    lines.append("Hi 👋🏾 iPlug GQ here. Your event is live on Gqeberha's gig guide 🔥\n<EVENT LINK>\n"
                 "Feel free to share it on your status and pages, because the page includes directions and a WhatsApp share button. "
                 "We list future events for free. Just send us the flyer every week 🙌🏾")
    lines.append("```\nVenues this week: " + ", ".join(venues) + "\n")

    # 6. Ticket-selling pitch: for paid events that don't have a ticket link on iPlug GQ yet
    paid_no_link = [e for e in wk if not e["free"] and not e.get("ticket")]
    with_link = [e for e in wk if e.get("ticket") and not e["free"]]
    lines.append("## 6. Sell tickets with iPlug GQ (promoter network)\n")
    if with_link:
        lines.append("Events with a **Get Tickets** button this week: " + ", ".join(f"{e['title']} ({ticket_provider(e['ticket'])})" for e in with_link) + "\n")
    lines.append("Send this to organisers who sell on Quicket. Once they add you, paste your unique promoter link into the *Ticket URL* column.\n```")
    lines.append("Hi 👋🏾 iPlug GQ here. Your event is listed free on Gqeberha's gig guide 🔥\n"
                 "Want us to sell tickets for you too? Add *iPlug GQ* to your Quicket promoter network (10% per ticket). "
                 "We'll put a Get Tickets button on your listing and push it on our WhatsApp, IG and TikTok. "
                 "You only pay on tickets we actually sell 🎟️🙌🏾")
    lines.append("```")
    if paid_no_link:
        lines.append("Events not marked free and without a ticket link yet: " + ", ".join(f"{e['title']} @ {e['venue']}" for e in paid_no_link[:12]) + "\n")
    return "\n".join(lines)

# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", default="events.csv")
    ap.add_argument("--out", default=".")
    ap.add_argument("--today", default=None)
    a = ap.parse_args()
    today = dt.date.fromisoformat(a.today) if a.today else dt.date.today()
    events = load_events(a.csv)
    out = a.out
    ev_dir = os.path.join(out, "events")
    if os.path.isdir(ev_dir):
        shutil.rmtree(ev_dir)
    os.makedirs(ev_dir)
    os.makedirs(os.path.join(out, "areas"), exist_ok=True)
    os.makedirs(os.path.join(out, "social"), exist_ok=True)

    for e in events:
        with open(os.path.join(ev_dir, e["slug"] + ".html"), "w", encoding="utf-8") as f:
            f.write(render_event(e, events, today))

    wk_html, wk, rng = render_weekend(events, today)
    with open(os.path.join(out, "this-weekend.html"), "w", encoding="utf-8") as f:
        f.write(wk_html)

    area_counts = {}
    for slug in AREAS:
        h, n = render_area(slug, events, today)
        area_counts[slug] = n
        with open(os.path.join(out, "areas", slug + ".html"), "w", encoding="utf-8") as f:
            f.write(h)

    sm, n_urls = render_sitemap(events, today, area_counts)
    with open(os.path.join(out, "sitemap.xml"), "w", encoding="utf-8") as f:
        f.write(sm)
    with open(os.path.join(out, "robots.txt"), "w", encoding="utf-8") as f:
        f.write(f"User-agent: *\nAllow: /\n\nSitemap: {SITE}/sitemap.xml\n")
    with open(os.path.join(out, "social", "weekly-pack.md"), "w", encoding="utf-8") as f:
        f.write(render_social(wk, rng, events, today))

    unmapped = [e for e in events if not e["area"] and e["date"] >= today]
    print(f"✔ {len(events)} event pages · this-weekend.html ({len(wk)} events) · {len(AREAS)} area pages · "
          f"sitemap ({n_urls} URLs) · robots.txt · social/weekly-pack.md")
    if unmapped:
        print("ℹ Upcoming events with no area match (add a keyword to AREAS):",
              "; ".join(f"{e['title']} [{e['location']}]" for e in unmapped))

if __name__ == "__main__":
    main()
