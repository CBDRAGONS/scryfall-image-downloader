# Vincent Valentine — Commander Workspace

**Status:** Deck inventory not yet captured. **Commander confirmed as the chosen deck project**, not as a verified physical card or a completed deck. Last updated: 2026-10-29.

## Verified commander

- **Front:** Vincent Valentine, **{2}{B}{B}**, legendary creature — Assassin, **2/2**.
- **Front rules:** Whenever a creature an opponent controls dies, put a number of +1/+1 counters on Vincent Valentine equal to that creature's power. Whenever Vincent Valentine attacks, you may transform it.
- **Back:** Galian Beast, legendary creature — Werewolf Beast, **3/2**, trample, lifelink. When it dies, return it to the battlefield tapped, front face up.
- **Color identity:** **B** (mono-black). This commander is legal in Commander according to the official Final Fantasy card reference; verify current ban/legality status before tournament- or event-specific statements.
- **Rules note:** For counters from an opponent's creature dying, use that creature's power as it last existed on the battlefield.
- **Authoritative source:** [Wizards of the Coast: FINAL FANTASY Release Notes](https://magic.wizards.com/en/news/feature/final-fantasy-release-notes) and [Scryfall search](https://scryfall.com/search?q=%21%22Vincent+Valentine%22). Exact *printing* of the user's physical commander is not yet recorded.

> Do not confuse **Vincent Valentine** (black, transforming into Galian Beast) with **Vincent, Vengeful Atoner** (red, a different card).

## Capturing the real deck

1. Open the [15-card phone scanner](../../scanner/) (or the [hosted scanner](https://cbdragons.github.io/scryfall-image-downloader/scanner/)) and photograph a 5×3 card grid.
2. Confirm every identity or mark intentionally empty slots; unknown printings stay unknown. Scan photos into **collection only** unless the physical cards belong in the Vincent deck, in which case check the Vincent deck option before saving.
3. Export a **JSON backup** after a session, and a **Vincent decklist** / collection CSV when needed.
4. **Manually reconcile** scanned names against the authoritative `decklist.csv` and `CHECKPOINT.md` in this directory. The scanner's browser-local storage does not automatically update these GitHub files or Google Drive.
5. Only after the real list is reconciled, run color-identity, card count, singleton exceptions, mana curve, ramp, draw, removal, synergy, win conditions and combo checks. Use official Oracle text, not a guess from a card photo.
6. Every approved change is a **one-for-one named IN/OUT entry** in `swaps.csv` and the full decklist is updated in the same change. Suggested cuts are not approved cuts.

## Project files and contracts

| File | Purpose |
|---|---|
| `decklist.csv` | **Authoritative list** of physically verified deck cards (currently intentionally empty). One row per card/printing where possible. |
| `swaps.csv` | Append-only record of approved IN/OUT swaps (initially empty). |
| `CHECKPOINT.md` | Current deck count, unresolved scans, and decisions. |
| [Scanner user guide](../../docs/SCANNER_PHONE_GUIDE.md) | Exact photo workflow and backup limitations. |
| [Scanner research](../../docs/15_CARD_SCANNER_RESEARCH.md) | Karpathy-inspired recognition evaluation and deferred improvements. |

## Deck operating rules

- Commander target **100 cards including commander**; the other **99** cards are still unknown. Don't fabricate them.
- Only **mono-black or colorless** cards within the commander's color identity (including rules text and both faces), unless current format rules permit otherwise. Check exact rules before recording.
- No guessed combos or rules. For each proposed swap, verify both cards' Oracle text and compare synergy, efficiency, resilience and cost.
- Do not silently duplicate cards from repeated photo sessions. A second photograph can contain the same *physical* card; compare the physical pile before adding a new owned copy.
- Capture exact set/collector number/foil only when physically verified; never infer printing from a canonical name.
- Never count cards from historical chats as inside this Vincent deck unless confirmed here.
- End sessions with an exportable checkpoint of commander, all verified cards, exact quantities, approved swaps and unresolved issues.

## Current next step

**Needs actual photo:** Upload or scan the first 15 physical cards. The repository contains no verified physical Vincent deck list yet. As photo batches are validated, update the decklist and checkpoint together.
