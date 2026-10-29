# Photo Scanner: Phone-to-Collection Guide (MVP)

**Implemented:** 2026-10-29. **Status:** feature-complete first browser prototype; automated pure-JavaScript checks pass, but **not yet validated on actual 15-card phone photographs**. Accuracy and mobile speed are unmeasured.

## Open it

- Hosted GitHub Pages (when deployment finishes): **https://cbdragons.github.io/scryfall-image-downloader/scanner/**
- Source: [scanner/](../scanner/)
- Original Scryfall card explorer: [../index.html](../index.html)

The scanner is a separate, lightweight static page, so the inherited downloader is unchanged. No app install or GitHub login is required for scanning. Loading Scryfall's name list and the OCR engine does require internet access.

## Phone capture recipe

1. Put **15 cards in 5 columns × 3 rows**, all portrait, fronts up. Leave similar small gaps between every card.
2. Take a **landscape, high-resolution** photograph directly overhead (prefer the phone's main camera), with diffuse light, no motion blur or shiny glare. Try ordinary nonfoil cards first.
3. Open the scanner in Safari or Chrome on the phone, tap **Choose / take photo**, and select the image. On some phones this launches the rear camera; the exact chooser depends on the OS/browser.
4. Drag the **four gold handles** to the *outside corners of the entire card array* (not the table edge). The 5×3 overlay should cover all titles and borders. Adjust the spacing slider if cards are cropped too tightly.
5. Press **Crop 15 cards**. Inspect the 15 portrait thumbnails. If a title is cut off, adjust the handles and crop again.
6. Press **Read 15 titles with OCR**. The browser downloads a Tesseract worker and the official Scryfall card-name catalog (which the browser may cache). A slow phone may take a while.
7. **Review all yellow positions**: click a matching candidate, or type a canonical Scryfall card name and tap **Confirm name**. If a position genuinely contains no card, select **Empty slot**.
8. Leave **Also add to my Vincent Valentine deck** unchecked if these are merely owned cards. Check it only if the scanned physical cards belong in that deck. Hit **Save confirmed batch**.
9. Download **collection CSV** and **JSON backup**. Import the CSV into your *master* collection only after reconciling printings and previous inventory; the scanner does **not** silently change ChatGPT or Google Drive files.

### What is actually persisted?

- Saved batches, scan timestamps, names, duplicate quantities, and collection-vs-deck assignment are stored in **that browser's localStorage**.
- A SHA-256 of the uploaded file (or a local fallback hash) prevents committing the *exact same photo bytes* twice. A recropped/re-exported picture of the same physical cards is **not** reliably deduplicated; inspect before saving.
- The photographs themselves are **not** kept in the inventory database or uploaded to our own server. OCR and cropping run locally; Scryfall catalog and Tesseract dependencies are fetched online.
- Browser history is **not cross-device synced**. Phone and desktop have different local inventories. Back up JSON and import it on a new device. Clearing site data or browsing privately can erase local batches.
- CSV is **not a direct Google Sheets update** and must be imported/reconciled manually. We are not claiming an API integration with ChatGPT, Drive, or Google Sheets yet.

### Deck semantics

- Workspace defaults to **Vincent Valentine**. It is a label/reserved commander for decklist export, *not* a claim that its physical copy was scanned.
- Saved collection counts and Vincent deck counts are distinct.
- **Download Vincent decklist** produces a text draft with the planned commander and only batches explicitly marked for the deck. Card color-identity legality, Commander singleton restrictions, count to 99, and format legality are **not automatically audited**.
- The app does not create or modify a deck's authoritative inventory in ChatGPT. Bring the export into the ChatGPT Project to audit and merge it.

### Identity vs printing

- Current implementation reads **English card titles only**, checks against Scryfall's card-name catalog, and presents up to three fuzzy suggestions when needed.
- Exact textual hits with high OCR confidence can be labeled ACCEPT; uncertain names remain REVIEW. A user must deliberately save the batch.
- A canonical Scryfall name **is not an exact physical printing**. The export intentionally leaves set code, collector number, foil/finish, condition and language blank until verified; do not turn blanks into presumed facts.
- No artwork embedding/ORB print recognition or automatic set-symbol detection has been implemented. That work is still a benchmark-driven research option.

## Developer details

- `scanner/index.html`: phone-first UI.
- `scanner/scanner.css`: responsive layout.
- `scanner/scanner.js`: image decoding, drag-corner overlay, image pixel remapping, title-band OCR, Scryfall catalog lookup, 15-slot review, local persistence, CSV/text/JSON export.
- `scanner/core.mjs`: pure normalized-name matching, trigram shortlist, Levenshtein reranking, projective geometry, 15-slot validation and export helpers.
- `scanner/tests/scanner.test.mjs`: Node tests for name matching, geometry, acceptance rules, CSV escaping and deck/collection aggregation.
- `.github/workflows/photo-scanner-checks.yml`: Node syntax and unit tests.

From repository root:

```bash
node --test scanner/tests/*.test.mjs
node --check scanner/scanner.js
python -m http.server 8000
# Open http://localhost:8000/scanner/
```

Don't open the HTML using a `file://` URL; it imports a JavaScript module and needs an HTTP host.

### Reuse of existing code/data

The existing repository's Scryfall/image downloader remains intact. The scanner shares the **Scryfall data source**, but uses `/catalog/card-names` for a compact name list because `oracle_index.json` is not currently published in `data/`. It does **not** reuse the older explorer's image-download UI. For rule text, set/printing metadata and card art, use the explorer or Scryfall directly.

### Tesseract and device limitations

- Uses `tesseract.js@5.1.1` CDN script and one reused English worker (rather than 15 worker instances). Network and language-model downloads can fail; app shows a failure and supports reviewing/correcting names with the Scryfall catalog.
- The card title is cropped from the top of each rectified image. Atypical card layouts, full-art frames, flipped photos, foreign text and cards with unreadable titles will require review.
- Current rectangle warp uses a JS perspective map with nearest-neighbor pixel sampling. If field testing reveals poor title OCR or slow performance, compare bilinear interpolation and image-processing alternatives with the fixed evaluation set.
- A large 48-MP original is reduced to at most a 4,800 px long side and 20 million source pixels to limit phone memory use. Keep the original file for a retake.
- Actual iOS Safari/Android Chrome operation, camera chooser, OCR confidence and 15-card throughput must be validated with real photos. This release is a **working code prototype, not a finished calibrated scanner**.

## Acceptance checklist for real photographs

- [ ] 15 positions remain in row-major order and show readable titles.
- [ ] Manually adjusting four corners corrects skew without losing cards.
- [ ] OCR completes and any missing or ambiguous titles can be corrected.
- [ ] Verified name matching works for ordinary, foil, older-border, and DFC cards (or flags them).
- [ ] Saving a batch and reloading the *same browser* preserves data.
- [ ] Saving the identical photo bytes again is blocked.
- [ ] Two separate photographs of the same card increase quantity only when intentionally saved.
- [ ] Deck opt-in remains separate from collection counts.
- [ ] CSV opens correctly in Excel/Google Sheets; blank printing/finish fields stay blank.
- [ ] JSON export and restore work without duplication.
- [ ] Browser memory and recognition time on the intended phone are acceptable.

See [15-card scanner research](15_CARD_SCANNER_RESEARCH.md) for the **Karpathy-inspired** evaluation and optional pretrained-image-embedding roadmap.

## Known limitations / next steps

1. Gather at least 5 real example photographs and score each of the 15 positions.
2. Measure OCR accuracy, accepted-result precision, total review count and median phone runtime.
3. Correct cropping/OCR failure modes before adding speculative art recognition.
4. Add a *verified* remote collection sync only with explicit authentication and conflict resolution. Do not put a long-lived secret or GitHub personal token in public browser JavaScript.
5. Only then consider automatic printing recognition or embedding retrieval.

