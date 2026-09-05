# Timezone Converter Pro

[![CI](https://github.com/kasapdev/timezone-converter-pro/actions/workflows/ci.yml/badge.svg)](https://github.com/kasapdev/timezone-converter-pro/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) ![Vanilla JS](https://img.shields.io/badge/Vanilla-JS-F7DF1E?logo=javascript&logoColor=black)

Convert a date & time across any IANA timezone and find a meeting slot everyone can make — fast, private, and fully offline.

> A premium, zero-dependency timezone workbench. Pick a date, time and source zone, add as many comparison zones as you like, and instantly see accurate local times plus a horizontal working-hours timeline — all computed from the browser's own `Intl` API, with nothing ever leaving your machine.

## Overview

Timezone Converter Pro is part of the **Web Utility Suite**. It runs entirely in the browser with no build step, no frameworks, no bundled timezone database, and no network calls — open `index.html` from disk and it works. It relies exclusively on `Intl.DateTimeFormat` and `Intl.supportedValuesOf('timeZone')`, so the timezone data (including DST rules) is always as current as the browser itself.

The core challenge this tool solves correctly: an `<input type="datetime-local">` value is timezone-naive. To know *what instant in time* the user means, the wall-clock value has to be reinterpreted as belonging to the chosen source timezone — and that requires knowing that zone's UTC offset *at that instant*, which itself depends on DST. The app resolves this with a small converging iteration against `Intl.DateTimeFormat.formatToParts`, rather than a static offset table, so it stays correct through DST transitions in every zone the browser knows about.

## Features

- **Source picker** — a date+time field plus a searchable timezone field (autocomplete over every IANA zone the browser supports), defaulting to your detected local timezone.
- **Accurate wall-clock → UTC conversion** — a DST-aware iterative algorithm (no hardcoded offsets) turns the entered local date/time + source zone into a precise UTC instant.
- **Comparison zones** — add or remove any number of target timezones as chips; your selection is remembered between visits.
- **Results grid** — every comparison zone's converted local time, date, zone abbreviation and UTC offset, recomputed live as you type.
- **Copy summary** — copy a plain-text summary of the source time and every conversion to the clipboard.
- **Meeting planner timeline** — a 24-hour horizontal strip per zone, aligned to the source zone's calendar day, highlighting each zone's configurable working hours so a shared green column reveals a good meeting window at a glance. A live "now" marker shows on the current day.
- **Configurable working hours** — set the start/end hour used to highlight the timeline (defaults to 09:00–17:00), including overnight ranges.
- **Auto-persist** — your source zone, comparison zones and working-hours preference are saved to `localStorage` and restored on return.
- **Dark & light themes**, fully responsive down to 360px (grid and timeline scroll independently, no page-wide horizontal scroll), and keyboard-driven.

## Installation

No dependencies, no build step.

```bash
git clone https://github.com/kasapdev/timezone-converter-pro.git
cd timezone-converter-pro
```

Then simply open `index.html` in any modern browser (double-click it, or `file://` it). That's it.

## Usage

1. Set the **Date & time** and **Source timezone** — or click **Now** for the current moment, or **My timezone** to use your detected local zone.
2. Add comparison zones under **Compare against** by typing a zone name (autocomplete helps) and clicking **Add**, or pressing <kbd>Enter</kbd> in the field.
3. Read the **Converted times** grid — each card shows the local time, date, zone abbreviation and UTC offset for that zone at the chosen instant. Remove a zone from its card or its chip.
4. Click **Copy summary** to copy a plain-text breakdown of all conversions.
5. Scroll down to the **Meeting planner** — adjust **Working hours** if needed, then look for a column where every row is highlighted: that's a time that works for everyone.

## Keyboard Shortcuts

| Action                          | Shortcut                         |
| -------------------------------- | --------------------------------- |
| Jump to current date & time      | <kbd>N</kbd>                       |
| Focus "Add timezone" field       | <kbd>Ctrl/⌘</kbd> + <kbd>K</kbd>   |
| Use my local timezone as source  | <kbd>Ctrl/⌘</kbd> + <kbd>L</kbd>   |
| Show shortcuts help              | <kbd>?</kbd>                       |
| Close dialog                     | <kbd>Esc</kbd>                     |

## Screenshots

> _Screenshots coming soon._

![screenshot](docs/screenshot-1.png)
![screenshot](docs/screenshot-2.png)

## Roadmap

- [ ] Shareable links that encode the source time and selected zones in the URL
- [ ] Drag-to-reorder comparison zones
- [ ] 12-hour / 24-hour display toggle
- [ ] Export the meeting planner grid as an image
- [ ] Recurring weekly meeting view across zones

## License

MIT Licensed. Part of the [Web Utility Suite](../index.html).

---

## Part of the kasapdev Tools Suite

One of 45+ zero-dependency vanilla JS tools, all free and open source — [see the full list](https://github.com/kasapdev/kasapdev).
