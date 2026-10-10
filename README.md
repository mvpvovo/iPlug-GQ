# iPlug GQ – Gqeberha Gig Guide

A fast, modern static web application and PWA for weekly nightlife, house music, kasi vibes, and urban lifestyle events in Gqeberha (Port Elizabeth), South Africa.

Website: [https://ipluggq.com](https://ipluggq.com)

---

## ✨ Features & Architecture

- **Venues & Neighborhood Grouping:** Events organized by venue with quick area filtering across *PE Central, Richmond Hill, Summerstrand, PE Harbour, Deal Party, New Brighton, Zwide, Motherwell, Wells Estate, and Addo*.
- **Smart Date & Archive Modes:**
  - *This weekend* (Fri–Sun)
  - *Tonight / Today*
  - *Next 7 days*
  - *All upcoming*
  - *Past Gigs Archive* (keeps the guide lively and informative between weekly drops)
- **Ticket Detection & Free Entry Badges:** Automatic visual badges for free parties and direct links to Quicket, Howler, or Computicket presales.
- **ImageKit Dynamic Optimization:** Event poster flyers are automatically scaled, quality-compressed, and served in modern WebP format (`?tr=w-600,q-75,f-auto`), reducing data consumption by up to 80% on mobile.
- **Calendar Integrations:**
  - One-click *Add to Google Calendar*
  - Universal *.ics download* for Apple Calendar, Outlook, and mobile devices
- **PWA & Offline Access:**
  - Installable on mobile home screens (iOS & Android)
  - Stale-While-Revalidate service worker caching for offline access even inside clubs or low-signal venues
  - "My Events" save list & event reminder alerts with notification sync
- **Frictionless Event Submissions:** Pre-filled WhatsApp submission flow to [+27 81 529 4035](https://wa.me/27815294035), allowing promoters to simply attach flyers directly in chat.
- **SEO & Social Sharing:** Native Web Share API, social platform deep links (WhatsApp, X, Facebook), Open Graph cards, and dynamic Schema.org Event JSON-LD markup for Google Search event snippets.

---

## 📅 How to Update Events from a Spreadsheet

1. Open `iPlugGQ_Weekly_Events.xlsx` and add/edit rows on the **Events** tab.
2. Ensure dates are formatted as `YYYY-MM-DD`. Leave **Event ID** blank for new events (the system automatically generates persistent IDs).
3. Export or download the **Events** sheet as a standard CSV file named `events.csv`.
4. Commit and push `events.csv` to GitHub. The live site at `ipluggq.com` automatically loads and renders the updated list.

---

## 📁 Repository Structure

- `index.html` – Modern semantic markup with SEO and PWA tags
- `style.css` – Clean, responsive dark-mode styling with acid lime/sunset neon accents
- `script.js` – Core event parsing, search, multi-filter, calendar links, and schema markup
- `pwa.js` – Saved events manager, reminder scheduler, install banner, and toasts
- `service-worker.js` – Service worker with Stale-While-Revalidate & CDN caching
- `events.csv` – Published live event data
- `iPlugGQ_Weekly_Events.xlsx` – Spreadsheet template for weekly updates
- `manifest.json` – Web app manifest configuration
- `CNAME` – Custom domain configuration (`ipluggq.com`)
- `sitemap.xml` – Search engine sitemap

---

## 👤 Credits

Designed and maintained by **Vovo MVP** for the Gqeberha nightlife community.
