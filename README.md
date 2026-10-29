# CBDRAGONS · MTG Card Repository

**The goal is a trustworthy, updatable MTG card reference and Commander deckbuilding workspace.** We want to verify what cards actually say, check their rulings and color identities, track the cards and decks David owns, record confirmed swaps, and make better deckbuilding decisions from accurate data.

This project **started as a fork of [Luminary by ianos](https://github.com/ianos93/scryfall-image-downloader/)**. Luminary's excellent browser-based image and printing explorer remains functional, but **CBDRAGONS is not primarily a proxy-making application**. The older print/visual tools are retained as optional utilities.

## Project principles

- **Correct before clever:** use current Scryfall Oracle text and verified rulings, not guessed abilities or unverified combos.
- **One source of truth:** Scryfall describes all printed cards; the user's collection data (when provided) determines which printings and quantities they own.
- **Explicit Commander history:** keep a complete decklist, commander, and confirmed IN/OUT swaps; never silently change a deck.
- **Clear feature labels:** separate working tools, generated backend data, and future capabilities.
- **No hidden backend assumptions:** state when Scryfall data was last refreshed; show errors rather than claiming an index is current.

## 15-card top-down scanner (working prototype; field testing pending)

**[Open the phone photo scanner](https://cbdragons.github.io/scryfall-image-downloader/scanner/)** · [Phone user guide](docs/SCANNER_PHONE_GUIDE.md) · [Research & engineering plan](docs/15_CARD_SCANNER_RESEARCH.md)

The `scanner/` directory contains an initial **five-column × three-row, 15-card-per-photo browser implementation**: photograph upload, adjustable corner perspective correction, 15 crops, reused-worker English OCR, verified Scryfall-name catalog candidates, 15-slot manual review, a Vincent Valentine Commander workspace, duplicate-photo checks, and local-browser collection/deck records with CSV/text/JSON export.

**Vincent Valentine deck workspace:** [source-verified commander and operating rules](decks/vincent-valentine/README.md) · [current checkpoint](decks/vincent-valentine/CHECKPOINT.md) · [new-chat starter prompt](decks/vincent-valentine/CHATGPT_PROMPT.md). The verified 99 has not been photographed or populated yet.\n\n**Status, truthfully:** scanner code and automated core tests exist; **real-phone accuracy and speed are not measured**, printings/foils are not identified automatically, and data is **not automatically synced** to ChatGPT/Google Drive. Export or import backups explicitly. The original Scryfall explorer still works independently. See the user guide for limitations, baseline tests and safe data handling.

## Current capabilities and roadmap

| Capability | Status | Explanation |
|---|---|---|
| Card name/printing lookup and card images | **Working** | Inherited Luminary explorer; click any card to open it on Scryfall. |
| Decklist text import, recent lists and image/visual export | **Working** | Browser-local lists and optional visual exports. |
| Legacy proxy PDF layout | **Working, secondary** | Kept for compatibility; not our main goal. |
| Scryfall printing index | **Working when available** | The web page reads `data/prints_index.json`. |
| Oracle text and rulings bulk-data index generators | **Implemented code** | `update_bulk_data.py` builds indexes after a successful Scryfall download. |
| Weekly/manual GitHub Actions refresh | **Configured** | Verify actual run and generated files before claiming data is populated. |
| Search Oracle text/rulings directly on the site | **Planned** | The page **does not yet** display the new indexes; open card links on Scryfall. |
| Local photographed-card inventory and Vincent deck assignment | **Prototype** | Scanner persists confirmed names in this browser and exports files; no remote sync or full deck legality audit. |
| Synergy, curve, combo and legality checks | **Planned** | These need verified rules and a validated owned/decklist data source. |

## Test the current explorer with David

1. Open the web page if hosted with GitHub Pages. Otherwise, use a local web server to serve `index.html` and `data/`.
2. Paste `Sol Ring`, `Arcane Signet`, `Lightning Bolt`, one per line, and click **Summon Cards**.
3. Confirm all three resolve. **Click a card image** to open Scryfall and check the exact Oracle rules text.
4. Repeat with **Paper Only** and **First Print** to compare printings.
5. Paste/import a Commander decklist and note missing cards, confusing results, or incorrect printings.
6. For backend validation, a repository maintainer opens **GitHub → Actions → Refresh Scryfall bulk indexes → Run workflow** and verifies the run completes. Generated files should appear in `data/` only after a successful refresh.

**Scope of this evening's test:** name resolution, printings, links to official card text, and general usability. It is **not** yet a test of in-page Oracle search or collection management.

## Getting started / refreshing data

The inherited web explorer has no build step or API key. Open `index.html` from an HTTP-hosted site (GitHub Pages or local server).

Refresh and validate Scryfall data with **Python 3.9+**:

```sh
python update_bulk_data.py
python verify_indexes.py
python -m unittest discover -s tests -v
```

The GitHub Actions workflow `.github/workflows/refresh-scryfall.yml` is configured for Mondays at **09:23 UTC** plus manual dispatch. The workflow has to run successfully before `oracle_index.json` and `rulings_index.json` can be relied upon.

See **[SCRYFALL_INTEGRATION.md](SCRYFALL_INTEGRATION.md)** for file schemas, Scryfall export format, testing and deployment details.

### Repository layout

```text
index.html                        Luminary-derived web explorer and project overview
data/prints_index.json            Compact printing lookup used by the current page
data/bulk_manifest.json           Timestamps and counts of published indexes
data/oracle_index.json            Generated Oracle rules data (after refresh)
data/rulings_index.json           Generated rulings data (after refresh)
update_bulk_data.py               Streams official gzipped Scryfall JSONL exports
verify_indexes.py                 Validates generated indexes
tests/test_scryfall_indexes.py    Offline fixture-based regression tests
.github/workflows/refresh-scryfall.yml
SCRYFALL_INTEGRATION.md           Detailed setup and schema notes
```

---

## Existing Luminary explorer reference

The remaining sections document the **inherited** image, printing and visual decklist features, preserved to keep the explorer usable while the repository evolves.

## Entering Card Names

### Typing or Pasting

Type or paste card names into the **Card Names** text area, one per line.

### Uploading a File

Drag and drop a `.txt` file onto the **Import Decklist** panel, or click it to browse. The file contents replace whatever is in the text area. Exports from Moxfield, Archidekt, MTGTop8, EDHREC, and MTG Arena all work.

### Limits

- Above **100 cards** you'll be asked to confirm before the fetch starts
- **500 cards** is a hard cap per run

---

## Supported Input Formats

Quantities, set codes, collector numbers, and special syntax are all stripped automatically — only the name (and optionally set/number) is used for lookup.

### Quantities

```
4 Lightning Bolt
4x Lightning Bolt
4X Lightning Bolt
4× Lightning Bolt
```

Quantities are remembered and used by the Visual Decklist and Proxy PDF.

### Set Codes and Collector Numbers

Set codes can appear in any bracket style, with or without a collector number, in any order:

```
Lightning Bolt
Lightning Bolt M10
Lightning Bolt (M10)
Lightning Bolt [M10]
Lightning Bolt <M10>
Lightning Bolt (M10) 93
Lightning Bolt 93 (M10)
Lightning Bolt #93 (M10)
```

> **Note:** Bare (unbracketed) set codes must be ALL-CAPS (e.g. `M10`, `BRO`, `MH3`) to avoid ambiguity with card name words. Bracketed set codes like `(m10)` are accepted in any case.

### Double-Faced Cards

Only the front face name is needed. Everything after `//` is stripped:

```
Fire // Ice
```

### Leading Punctuation

Lines may begin with `/`, `#`, `*`, `-`, or whitespace — these are stripped before parsing. Lines starting with `#` are treated as comments and skipped entirely.

### Main Deck vs Sideboard

The parser tracks which section each card belongs to. A card enters the sideboard when any of the following is seen:

- An explicit header: `Sideboard`, `Side board`, `Side`, `SB`, `S.B.`
- A bracket header: `[Sideboard]`
- The **first blank line** after at least one main-deck card — but only if the file contains no bracket headers

Headers such as `Deck`, `Main Deck`, `Commander`, and `Companion` switch back to the main deck. Category headers (`Lands`, `Creatures`, `Spells`, `Artifacts`, `About`, `Maybeboard`, …) are filtered out and never treated as card names.

### Repeated Lines

Lines requesting the same card **and** the same printing are combined, and their quantities added. `2 Lightning Bolt` followed later by `2 Lightning Bolt` gives you four copies, so decklists that split a playset across categories come out right.

The match is on name + set code + collector number, case-insensitively, so asking for genuinely different printings keeps them apart:

```
2 Lightning Bolt (M10)      -> 2 copies of the M10 printing
2 Lightning Bolt (LEA)      -> 2 copies of the LEA printing
```

A bare name and a set-qualified name count as different requests, since the app cannot know at parse time whether they resolve to the same printing. Main deck and sideboard are totalled independently.

---

## Image Resolution

Choose the resolution before clicking **Summon Cards**. The selection applies to the whole batch and determines the ZIP file extension.

| Option | Dimensions | Format | Best For |
|---|---|---|---|
| Small | 146 × 204 px | JPEG | Thumbnails, quick previews |
| Normal | 488 × 680 px | JPEG | Standard use, most deck tools |
| Large | 672 × 936 px | JPEG | High quality printing |
| PNG | 745 × 1040 px | PNG | Lossless, highest quality (default) |
| Art Crop | Varies | JPEG | Art only, no card frame |
| Border Crop | Varies | JPEG | Full card, border removed |

For proxy printing, **PNG** or **Large** are recommended — the PDF places cards at 63 × 88 mm, so lower resolutions will look soft.

---

## Fetch Options

### Paper Only

Checks the `games` field on every fetched card. If a card exists only digitally (MTGO, Arena), the closest paper printing is substituted.

- If a paper printing is found it is used instead and flagged **⚠ alt print used** in the log
- If no paper printing exists at all, the card is reported as an error

### First Print

Resolves each card to its oldest non-promo, non-digital printing — useful for original artwork and early set symbols.

- If the card is already the oldest printing it is kept as-is, with no warning
- If an older printing is found it is swapped in and flagged **⚠ alt print used**
- If the lookup fails, the originally fetched card is kept as a silent fallback
- The search is **skipped** when you explicitly specified a set code for that card, so you can always pin an exact printing

**Ties on the earliest date resolve to the base printing.** Alternate treatments — retro frame, showcase, borderless, extended art — release on the same day, in the same set, as the base card, and are not marked as promos, so release date and set code cannot tell them apart. Collector number can: Wizards numbers the base set first and places variants above it, so the lowest collector number among tied printings is taken. This affects roughly 17% of cards.

This requires a **format 3** database. If `data/prints_index.json` was generated before this change, the info panel will warn you and First Print will fall back to an arbitrary but stable choice among tied printings — re-run `update_bulk_data.py` to fix it.

### Combining Both

Paper Only and First Print can be active together, in which case the app resolves the **oldest paper printing** — for example the original Alpha/Beta/Revised print of a classic card, excluding digital-only reprints.

---

## The Fetch Process

Clicking **Summon Cards** runs up to three phases, tracked by the badges and progress bar:

1. **Card Data** — resolve every line to a Scryfall card object
2. **Options** — apply Paper Only / First Print (only shown when one is enabled)
3. **Images** — download the image for each resolved card

Requests run three at a time, spaced ~150 ms apart globally to stay inside [Scryfall's rate limit guidelines](https://scryfall.com/docs/api#rate-limits). A `429` response triggers a `Retry-After`-aware backoff; image CDN failures retry with exponential backoff (500 ms → 1 s → 2 s).

### Cancelling

While a fetch is running, the button becomes **Cancel Summoning**. Clicking it aborts all in-flight and queued requests immediately.

### Search Strategy (3-tier fallback)

For each card, in order:

1. **Exact name** — `GET /cards/named?exact=<name>` (plus `&set=` if a set code was given)
2. **Fuzzy name** — `GET /cards/named?fuzzy=<name>`, catching typos and alternate spellings
3. **Name-only fuzzy** — if a set code was given but not found, the set is dropped and the name searched alone. Flagged yellow in the log.

When both a set code and collector number are supplied (e.g. `M10 93`), the direct endpoint `GET /cards/:code/:number` is used instead and name search is skipped.

### Log Colours

| Colour | Meaning |
|---|---|
| 🔵 Blue | Card resolved as requested |
| 🟡 Yellow | The request could not be honoured exactly |
| 🔴 Red | Card could not be found |

Successful entries may carry suffixes:

| Suffix | Meaning |
|---|---|
| `✦ first print` | First Print swapped in an earlier printing |
| `✦ paper print` | Paper Only swapped in a paper printing |
| `⚠ alt print used` | The set code you gave was not found, so the card was matched by name alone |
| `💾` | Served from the local cache instead of the API |

Only `⚠ alt print used` colours the line yellow. A swap caused by an option you switched on is the feature working, so it stays blue.

---

## Output Mode 1 — Individual Cards

The default view. Successfully fetched cards appear in a grid; failures appear only in the log.

- **Hover** a card for a frosted panel showing its full name and the set code of the exact printing fetched
- **Click** (or middle-click) a card to open that printing on Scryfall in a new tab
- **Download ZIP** packages every fetched image into one archive

### File Naming

```
Lightning_Bolt_m10.jpg
Black_Lotus_lea.png
Jace_the_Mind_Sculptor_wwk.jpg
```

The extension follows the selected resolution (`.png` for PNG, `.jpg` for everything else). The archive is named `scryfall-<resolution>.zip`.

---

## Output Mode 2 — Visual Decklist

Renders the whole deck as a single image using the classic stacked/fanned layout.

- **Main deck** — 5 columns, up to 4 cards per overlapping stack
- **Sideboard** — a separate right-hand column, up to 15 cards per stack, with a rotated `SIDEBOARD` label
- Cards are sorted by type (Creature → Instant → Sorcery → Enchantment → Artifact → Planeswalker → Land), then mana value, then name
- Quantities are respected — a playset appears as four overlapping copies

### Options

- **Export Resolution** — Full, Large (75%), or Medium (50%)
- **Transparent Background** — drops the purple gradient backdrop, giving a PNG with alpha for compositing elsewhere

**Download Image** saves a PNG named `visual-decklist-<timestamp>.png`.

---

## Legacy Output Mode — Print for Proxy

Builds a print-ready PDF with cards at true physical size (63 × 88 mm).

### Settings

| Setting | Options |
|---|---|
| Page Size | A4 (210 × 297 mm, 3 × 3 = 9 per page) · A3 (297 × 420 mm, 4 × 4 = 16 per page) |
| Card Spacing | No spacing · 2 mm gap · 5 mm gap |
| Repeat by Quantity | Print each card as many times as the decklist specifies |
| Ignore Basic Lands | Skip Plains, Island, Swamp, Mountain, Forest, Wastes, and their snow-covered versions |

The grid is centred on the page, so trimming with a guillotine or corner punch is straightforward. **No spacing** gives edge-to-edge cards with shared cut lines; the gap options give each card its own margin.

### Preview

A live preview renders every page before you commit. When the job spans multiple pages, use the **‹ ›** arrows to page through them. The summary line above the preview reports the layout, total card count, page count, and spacing.

**Generate PDF** saves `proxy-<size>-<timestamp>.pdf`, with a progress bar during assembly.

PNG cards are re-encoded to high-quality JPEG when building the PDF. At 63 x 88 mm a
745 x 1040 image is already around 300 DPI, so nothing is downscaled — but PNG is stored
essentially uncompressed inside a PDF, which made large proxy sets run to hundreds of
megabytes and risk failing during assembly. The re-encode cuts that by roughly 5-10x with
no visible difference at print size. Images fetched at the JPEG resolutions are passed
through untouched rather than re-encoded.

---

## Card Database and Bulk Data

The page currently uses **`data/prints_index.json`** for fast First Print and Paper Only lookups. Each Oracle card ID maps to compatible compact printing rows: `[id, set, YYYYMMDD, gamesBits, flagsBits, collectorNumber]`. Image URLs are derived from Scryfall printing IDs.

The new updater, `update_bulk_data.py`, fetches the official Scryfall bulk-data manifest and streams **gzipped JSONL** sources for `default_cards`, `oracle_cards`, and `rulings`. It generates:

- **`prints_index.json`** — the legacy compatible printing reference.
- **`oracle_index.json`** — card names, Oracle text, card faces, color identity, and format legality.
- **`rulings_index.json`** — published rulings grouped by Oracle ID.
- **`bulk_manifest.json`** — counts, source timestamps and output sizes.

The GitHub Actions refresh workflow checks the generated output before committing it. **The new indexes are not automatically available simply because the workflow code was merged.** Inspect the most recent successful run and the `data/` folder.

The page's **Refresh Database** button only reloads the already-published printing index; **it does not fetch new exports**. At present, the browser does not query the new Oracle or rulings indexes. For canonical card text during this stage, click a card to go to Scryfall.

More information: [Scryfall integration guide](SCRYFALL_INTEGRATION.md).

---

## Recent Lists

Every fetch that returns at least one card is saved, so a list you used last week is one click away. Nothing is saved for a run that found nothing, and typing alone never saves.

The panel sits above **Image Resolution**, collapsed until you open it, and stays hidden entirely until you have something in it.

| Action | What it does |
|---|---|
| **Load** | Puts the list back in the card names field and restores the resolution and options it was fetched with. It does not re-fetch — edit first if you want to. |
| **✎** | Rename the list. Appears on hover, next to the name. Press Enter to save, Escape to cancel, or clear the field to go back to the automatic name. |
| **↓** | Download the list as a `.txt` file, named after the list and the date it was saved. |
| **×** | Remove that entry. |

Lists are named automatically from their contents — `Lightning Bolt +23 more` — until you rename one. A custom name survives re-running the list, and the automatic name keeps tracking the contents underneath, reachable as the row's tooltip.

Re-fetching a list you already have moves it to the top rather than adding a duplicate. Matching ignores casing, blank lines and trailing spaces, so a lightly edited list counts as the same list. The 20 most recent are kept.

**Clear List History** in the info panel removes them all at once. History is stored under its own key, so clearing the card cache never touches it — and the reverse is true too.

> Storage is per browser and per site. Lists saved while testing locally won't appear on your hosted copy, and clearing site data removes them. There are no accounts and nothing is uploaded.

---

## Metadata Cache

Resolved card data is cached in `localStorage` for **7 days** so repeat fetches skip the API entirely. Cached hits are marked with `💾` in the log.

Each option combination is cached separately — Standard, Paper Only, First Print, and Paper + First are distinct entries for the same card, so toggling options never returns a stale result.

Open the info modal to see a live breakdown by variant and a total count. **Clear All Cache** wipes every entry. When storage fills up, the oldest 30% of entries are evicted automatically.

Images are **not** cached; only metadata is.

---

## Interface Notes

- **ⓘ** (top right) opens the info modal: quick instructions, supported formats, changelog, cache and saved lists, and database status. It fades out as you scroll.
- **Recent Lists** sits above Image Resolution and appears once you have fetched something.
- The progress area shows a phase label, a per-phase counter, and a scrolling log.
- There is one undocumented option, unlocked by a keyboard sequence, that swaps cards for their showcase, borderless, Universes Beyond, and Secret Lair printings where available. It relies on Scryfall's `/cards/search` endpoint and so may not work on all hosting origins.

---

## Original Luminary v4 Release Notes

**New**
- Recent Lists: save, reload, rename and export your recent card lists
- Repeated lines add their quantities together instead of the later line being dropped

**Fixed**
- First Print resolved to whichever same-day printing happened to be listed first, so cards from sets with alternate treatments (MH2, WAR, and about 17% of all cards) could return a showcase, borderless or retro-frame version. It now takes the lowest collector number, which is always the base printing.
- The card database updater was broken by Scryfall's move to gzipped JSONL bulk files on 2026-07-20
- Log entries now say *why* a printing changed rather than flagging every substitution as a warning
- Swapped printings no longer link to the printing you did not receive
- A failed database load no longer poisons the rest of the session

**Changed**
- Index format 3 adds collector numbers — **re-run `update_bulk_data.py` after upgrading**
- The in-browser bulk download fallback was removed; it could not work after the JSONL migration
- Proxy PDFs re-encode PNG cards to JPEG, cutting file size 5-10x with no visible difference at print size
- Decoded card images are capped by memory budget, and oversized visual decklists scale down instead of rendering blank
- Subresource Integrity on the CDN libraries, and `connect-src` narrowed from any HTTPS host to Scryfall only
- Squarer corners throughout, and specs and counts moved to a sans face for legibility

---

## API & Attribution

This tool uses the [Scryfall REST API](https://scryfall.com/docs/api). Card data and images are © Wizards of the Coast and their respective artists. Scryfall provides card data under the [DMCA safe harbour](https://scryfall.com/docs/api#usage).

Proxies generated with this tool are for personal playtesting only. Do not sell them, and do not use them in sanctioned play.

Original Luminary by **ianos** ([upstream source](https://github.com/ianos93/scryfall-image-downloader/)); CBDRAGONS maintains the repository fork. Card data powered by [Scryfall](https://scryfall.com).
