# iPlug GQ – Gqeberha Gig Guide

A static website and PWA for listing weekly nightlife, house music, and urban lifestyle events in Gqeberha (Port Elizabeth).

## Features
- Events grouped by venue
- Search events by name, venue, location, description, or category
- Filter by category, this weekend, or the next seven days
- Download calendar reminders for events
- Save events to "My Events"
- Set reminders for events
- Share events on social media
- Install as a PWA on mobile
- Offline access
- Submit events with a pre-filled WhatsApp message for review

## How to Update Events from a Spreadsheet
1. Open `iPlugGQ_Weekly_Events.xlsx` and add or update events on the **Events** tab, one event per row.
2. Keep the column headings unchanged. Choose a category from the dropdown. Dates should be entered as `YYYY-MM-DD`; leave **Event ID** blank for new events.
3. In Excel or Google Sheets, export/download the **Events** tab as a CSV file named `events.csv`, using comma-separated values. Replace the existing `events.csv` in this repository.
4. Commit and push `events.csv` to GitHub. GitHub Pages will publish the changes; the website reads this file directly.

The workbook includes all currently listed events to get started. The website validates the CSV columns, dates, URLs, categories, and IDs before displaying events. `events.json` is the original data file and is no longer used by the site.

The imported event rows are from the previous listings and their dates have passed. Add current/upcoming events before publishing; expired events are hidden by the website.

## Files
- `index.html` – Main page
- `style.css` – Styles
- `script.js` – Core functionality
- `pwa.js` – PWA features (save/reminders)
- `iPlugGQ_Weekly_Events.xlsx` – Spreadsheet template and current event list
- `events.csv` – Published event data exported from the spreadsheet
- `manifest.json` – PWA manifest
- `service-worker.js` – Service worker for offline

## Credits
Designed by Vovo MVP
