# Bucharest Lead Finder

A lightweight local workflow for finding and qualifying businesses around Bucharest, with a focus on Calea Victoriei and nearby premium areas.

## What it does

- Opens repeatable Google Maps and web search packs for high-fit business categories.
- Captures businesses you discover into a local lead queue.
- Scores each lead based on website and conversion opportunities.
- Tracks lead stage from research through outreach.
- Exports the filtered queue as CSV for a CRM, spreadsheet, or outreach tool.

## Use it

Open `index.html` in a browser.

Suggested flow:

1. Open a search pack such as `Calea Victoriei hospitality`.
2. Inspect businesses for weak or missing websites, missing booking/order flows, and good demand signals.
3. Add the business in `Capture Lead`.
4. Sort by score and work the highest-scoring leads first.
5. Export CSV when you want to move leads into another system.

## Lead scoring

The current scoring weights are intentionally simple:

- No website: 32
- Outdated website: 26
- Weak mobile UX: 20
- No booking/order flow: 18
- Active social media: 12
- Good reviews: 12
- Contact captured: 8
- Source URL captured: 6

This favors businesses with clear web-build upside and enough activity to justify outreach.

## Outreach angle

The `Copy pitch` button creates a short audit-style message. The strongest first offer is usually a narrow one:

- one-page website
- mobile refresh
- menu or service page
- booking/contact conversion path
- local SEO cleanup
- event or campaign landing page

Avoid a generic "we build websites" message. Tie the pitch to the exact gap you observed.
