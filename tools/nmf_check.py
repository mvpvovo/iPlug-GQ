#!/usr/bin/env python3
"""
New Music Friday checker (run before publishing each Friday)
============================================================
For every release in music-releases.json it looks the track up in Apple's public
iTunes catalogue (free, no API key) and:

  • adds a 30-second `previewUrl`, which powers the ▶ play buttons on the page
  • fills in a missing Apple Music link and cover art (searches by artist + title)
  • WARNS when the real release date doesn't match the date you entered,
    so old songs don't get published as "new this Friday"

Usage (from the repo root):
    python3 tools/nmf_check.py               # check + add previews, report problems
    python3 tools/nmf_check.py --fix-dates   # also correct releaseDate to Apple's date
"""
import argparse, json, re, sys, time, urllib.parse, urllib.request

FILE = "music-releases.json"
LOOKUP = "https://itunes.apple.com/lookup?id={id}&country=za"
SEARCH = "https://itunes.apple.com/search?term={q}&country=za&entity=song&limit=5"

def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "iPlugGQ-NMF/1.0"}), timeout=20) as r:
        return json.load(r)

def norm(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())

def find_track(r):
    m = re.search(r"[?&]i=(\d+)", (r.get("links") or {}).get("apple", ""))
    if m:
        res = get(LOOKUP.format(id=m.group(1)))
        if res.get("resultCount"):
            return res["results"][0]
    # Fallback: search by artist + title
    q = urllib.parse.quote(f"{r.get('artistName','')} {r.get('title','')}")
    for t in get(SEARCH.format(q=q)).get("results", []):
        if norm(r.get("title"))[:12] in norm(t.get("trackName")) and norm(t.get("artistName"))[:6] in norm(r.get("artistName")):
            return t
    return None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fix-dates", action="store_true")
    ap.add_argument("--file", default=FILE)
    a = ap.parse_args()
    data = json.load(open(a.file, encoding="utf-8"))
    problems = 0
    for r in data:
        label = f"{r.get('artistName')} – {r.get('title')}"
        try:
            t = find_track(r)
        except Exception as e:
            print(f"  ?  {label}: lookup failed ({e})"); continue
        time.sleep(0.4)  # be polite to the API
        if not t:
            print(f"  ?  {label}: not found on Apple Music (add a preview manually or skip)"); continue
        if t.get("previewUrl"):
            r["previewUrl"] = t["previewUrl"]
        links = r.setdefault("links", {})
        if not links.get("apple") and t.get("trackViewUrl"):
            links["apple"] = t["trackViewUrl"].split("&uo=")[0]
        if not r.get("coverArt") and t.get("artworkUrl100"):
            r["coverArt"] = t["artworkUrl100"].replace("100x100bb", "600x600bb")
        real = (t.get("releaseDate") or "")[:10]
        if real and real != r.get("releaseDate"):
            problems += 1
            print(f"  ⚠  {label}: listed {r.get('releaseDate')} but Apple says {real}")
            if a.fix_dates:
                r["releaseDate"] = real
                r["publishDate"] = real
                if r.get("description", "").startswith("New 2026 release"):
                    r["description"] = r["description"].replace("New 2026 release", f"Released {real[:4]}", 1)
        else:
            print(f"  ✔  {label}")
    json.dump(data, open(a.file, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    open(a.file, "a", encoding="utf-8").write("\n")
    print(f"\n{len(data)} releases checked · {problems} date problem(s)"
          + (" fixed" if a.fix_dates and problems else ""))
    sys.exit(0)

if __name__ == "__main__":
    main()
