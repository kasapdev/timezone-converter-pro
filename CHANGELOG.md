# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.0.1] - 2026-09-06

### Fixed

- **"Now" button used the browser's local wall-clock time instead of the selected source timezone's wall-clock time.** When the "Source timezone" was set to a zone different from the visitor's own detected timezone, clicking **Now** (or pressing <kbd>N</kbd>) filled in the date/time field with the *browser's local* hour/minute and then interpreted those digits as if they were in the source zone — computing the wrong UTC instant, off by the difference between the two zones' UTC offsets. `jumpToNow()` now derives the date/time from `Date.now()` re-expressed in the currently selected source zone (via the existing `partsInZone` helper), so "Now" always reflects the true current instant regardless of which source zone is selected.
