# 15-Card Top-Down MTG Scanner: Research and Engineering Decision

**Status:** Research / proposed design; scanner has **not** been implemented or benchmarked.  
**Research date:** 2026-10-29  
**Repository:** CBDRAGONS/scryfall-image-downloader  
**Scope:** One high-resolution overhead photograph, **five columns × three rows = 15 card positions**, image-to-card identity, human review of uncertainty, and export to the existing MTG collection system. No automatic live camera loop or remote synchronization in v1.

> **Decision:** Build a fixed-grid, OCR-first scanner with Scryfall-validated names and conservative uncertainty handling. Add artwork-feature matching only if real-photo testing demonstrates it reduces errors. Use Karpathy's **data-first baseline/evaluation discipline** now, and his **pretrained feature/nearest-neighbor** and **AutoResearch-style controlled experiment** ideas when warranted. **Do not train a custom model from scratch for v1.**

## 1. What exists in this repo (verified on 2026-10-29)

- `index.html` is an inherited Luminary-based browser card explorer with typed-name parsing, Scryfall card-image retrieval, print selection, and image exports. **It does not currently take photographs or perform camera/OCR recognition.**
- `update_bulk_data.py` implements Scryfall bulk export processing. Its target outputs include `data/prints_index.json`, `data/oracle_index.json`, `data/rulings_index.json`, and `data/bulk_manifest.json`.
- At inspection, the **published** `data/` directory contained `prints_index.json` and `bulk_manifest.json` only. The Oracle/rulings files should **not** be assumed populated until a successful refresh and verification. See `SCRYFALL_INTEGRATION.md`.
- Existing printing rows contain printing IDs, set codes and collector numbers. Existing downloader resolution logic and image URL conventions are reusable, but **a scanner and name/printing lookup layer still need to be developed**.
- Preserve legacy explorer behavior. Add the scanner as a separate page/module initially, rather than replacing the 145 KB existing `index.html`.

**Source:** repository [README](../README.md), [integration guide](../SCRYFALL_INTEGRATION.md), [updater](../update_bulk_data.py), and the actual [data directory](../data/).

## 2. What we mean by “Karpathy-based”

This is **not** a known packaged “Karpathy MTG scanner” or a claim that Andrej Karpathy wrote an MTG card classifier. The transferable ideas are:

1. **Inspect real data and get simple baselines first.** Karpathy's *A Recipe for Training Neural Networks* strongly recommends understanding examples, verifying labels, benchmarking a simple system, and changing one variable at a time. Our application: label real 15-card photographs, visualize all 15 perspective-corrected crops, test OCR alone, then OCR + name matching, then optionally artwork matching.
2. **Transfer learning and feature extraction.** His CS231n material recommends reusing pretrained image features rather than training from scratch when labeled task data are limited. Our possible application: embed the **artwork region**, search precomputed reference embeddings, and rerank top candidates without training a 30,000+-class network.
3. **Nearest-neighbor retrieval.** CS231n covers nearest-neighbor classification; Karpathy's image/text embedding research studied retrieval in shared feature spaces. Our application: compare an image feature vector to reference features; **do not rely on raw whole-image pixel distance**. Semantic embeddings may confuse visually similar fantasy art and **cannot reliably distinguish exact printings**.
4. **AutoResearch methodology (2026).** Karpathy's `autoresearch` keeps the evaluator and dataset fixed, makes small experimental changes, measures one objective, and keeps/discards changes based on the result. **Adapt its experimental discipline, not its LLM/GPU training code.** For scanning, use a locked evaluation harness and a scored experiment log; no autonomous background service is needed.

**Attribution limits:** CLIP is not a Karpathy model; Meta's DINOv2 is not a Karpathy model. They are examples of the *pretrained-feature approach* above, not software written by Karpathy. Karpathy's original 2014/2015 retrieval papers are conceptual precedents, not a directly deployable browser scanner.

Primary sources:
- [Karpathy, A Recipe for Training Neural Networks (2019)](https://karpathy.github.io/2019/04/25/recipe/)
- [Stanford CS231n, Transfer Learning](https://cs231n.github.io/transfer-learning/)
- [Stanford CS231n, Image Classification and Nearest Neighbor](https://cs231n.github.io/classification/)
- [Karpathy & Li, Deep Visual-Semantic Alignments (CVPR 2015)](https://www.cv-foundation.org/openaccess/content_cvpr_2015/html/Karpathy_Deep_Visual-Semantic_Alignments_2015_CVPR_paper.html)
- [karpathy/autoresearch README (2026)](https://github.com/karpathy/autoresearch)

## 3. Recommended pipeline

```text
Full-resolution JPEG/HEIC upload (one photo)
  -> EXIF orientation correction and photo quality checks
  -> register four mat corners / fixed mat markers (manual first; automatic later)
  -> perspective rectify full mat, keep original pixels
  -> crop all 15 positions (row-major: 1..15)
  -> per-cell presence / blur / glare checks
  -> read top title band: OCR with optional enhancement passes
  -> compare normalized OCR to local exact Scryfall name index
  -> obtain top name candidates (not an arbitrary fuzzy guess)
  -> when uncertain: artwork-region fingerprint/feature reranking
  -> classify ACCEPT / REVIEW / RETAKE; independently track printing certainty
  -> show 15 original crops + chosen candidate + alternatives
  -> user confirms only uncertain positions; batch commit
  -> durable local session and collection CSV export
```

### Capture geometry

- Use **5 columns x 3 rows** of portrait cards. The concept poster calls this “3 x 5,” but the pictured physical orientation is five across and three down.
- Use a printed dark matte board with four visually distinctive registration marks; optionally print cell outlines. Fixed camera is preferred, but perspective calibration should also accept slight camera movement.
- Prefer a **full-resolution 12 MP+ 4:3 photograph** (not a downscaled video frame), overhead focus locked where possible, diffuse lighting, no flash glare, small consistent spaces between cards. At 4032 x 3024 pixels, theoretical grid cell widths are ~806 pixels before margins/rectification; actual OCR quality depends on crop scale, blur, and sharpness, and **must be measured**.
- For v1, permit manual corner adjustment if marks cannot be detected. Warp the mat as a quadrilateral using `cv.getPerspectiveTransform` and `cv.warpPerspective`, then cut known rectangular cells. Do not demand 15 contour detections.
- Refine card edges within each cell later only if the fixed crop causes consistent title clipping. A card moved outside its cell should be flagged for retake, not quietly reassigned.
- Never upsample a small blurred input and assume real detail was recovered.

**Reference:** [OpenCV.js geometric transformations](https://docs.opencv.org/5.0/js_tutorials/js_imgproc/js_geometric_transformations/js_geometric_transformations.html).

### Identity extraction (minimum reliable system)

- OCR **only the title band**, not the entire 15-card image. On a single card crop, compare Tesseract.js `PSM.SINGLE_LINE` and `PSM.RAW_LINE` plus unmodified/enhanced title crops. Avoid unconstrained thresholding that damages colored title text.
- Load/reuse one OCR worker initially; benchmark a 2-worker scheduler against memory, especially on phones. Don't create a fresh worker per card.
- Normalize Unicode, smart punctuation, case, whitespace, split/DFC naming conventions and OCR confusion, but **preserve the canonical exact Scryfall name for export**.
- Query a compact, versioned local name index derived from Scryfall bulk data (ideal). Existing `oracle_index.json` could be a source once present; a small `scanner_name_index.json` can avoid downloading the complete rules index for every phone session. If unavailable, use rate-limited Scryfall named lookup as a fallback.
- Fuzzy matching may generate *candidates* but does not alone authorize an automatic match. Keep top 3 with comparable scores; detect near-ties.
- If OCR is blank, return REVIEW/RETAKE or use an image candidate search. **Never create a card name from a generative model's unsupported guess.**
- Important special cases: transform/DFC faces, split/adventure/meld layouts, frames with no conventional title, foreign-language cards, tokens/art cards, and extremely similar names. Track unsupported classes explicitly.

**References:** [Tesseract.js API and region recognition](https://github.com/naptha/tesseract.js/blob/master/docs/api.md), [PSM modes](https://github.com/naptha/tesseract.js/blob/master/src/index.d.ts), [worker scheduler guidance](https://github.com/naptha/tesseract.js/blob/master/docs/workers_vs_schedulers.md).

### Image verification: add only if benchmark supports it

**Low-complexity first:** crop card artwork consistently; compare small perceptual hashes and/or ORB local features against **the limited printing candidates** obtained from title OCR. Test same-art, different-frame cases. Do not compare an uncropped card photo to an art-only thumbnail.

**Stronger fallback, conditional:** precompute embeddings of reference artwork using a small pretrained encoder (e.g., a DINOv2-small-like image encoder) and apply cosine nearest-neighbor retrieval, possibly limited to the top OCR candidates or cached subset. Assess browser model size/latency and device memory; a small backend may be easier for a full-art catalog. An image embedding is not a guaranteed exact printing identifier.

**Do not do v1:** train a new image classifier on all Magic cards, download all card image assets to every device, use a huge multimodal model on every crop, or depend on remote LLM vision for every batch. Those options add data, cost, speed, privacy, and verification burdens before there is evidence they help.

References and comparable scanners:
- [Meta DINOv2 model card: k-NN and image retrieval](https://github.com/facebookresearch/dinov2/blob/main/MODEL_CARD.md)
- [IA9000/MTG-Card-Scanner: contours, perspective and ORB](https://github.com/IA9000/MTG-Card-Scanner)
- [MerrittTaylor/MTG-Scanner: single-card Tesseract + Scryfall + collection](https://github.com/MerrittTaylor/MTG-Scanner)
- [dills122/MTG-Card-Analyzer: candidate printings and fingerprints](https://github.com/dills122/MTG-Card-Analyzer)

These are design references, **not independent accuracy benchmarks for 15-card photographs**. Dependencies, maintenance status and licenses must be checked before copying code.

## 4. Separate card name from exact physical printing

Two independent result fields:

- **Card identity**: canonical name, Scryfall `oracle_id`, candidate rank, recognition decision.
- **Printing identity**: Scryfall printing `id`, set code, collector number, language, finish, independently marked CONFIRMED / REVIEW / UNKNOWN.

A title can identify “Sol Ring” but **cannot determine a specific printing**. Later, attempt bottom text OCR (set code / collector number), set symbol recognition, image treatment comparison, and face layout checking. Older printings often lack machine-readable set/number. Foil detection from one still image is **not dependable**; leave finish unknown or request user confirmation rather than defaulting to nonfoil as a fact.

If printing is unknown, export blank set/number with an explicit needs-review flag instead of fabricating a printing or silently choosing a “default” image.

## 5. Confidence and fail-safe UX

Create a deterministic scoring policy, validated on labeled data:

- **ACCEPT (green):** strong, unambiguous name evidence; required matching checks agree; thresholds chosen to deliver measured auto-accepted precision. Store evidence fields, not merely a single confidence number.
- **REVIEW (yellow):** OCR/result disagreement, tied candidates, ambiguous full-art/alternate face, uncertain printing, or marginal image clarity. Provide 2–3 selectable Scryfall candidates and a searchable correction box.
- **RETAKE (red):** missing/overlapping card, off-mat placement, severe blur/glare, or no defensible candidate.
- **Do not silently omit positions.** Always render **15 slot records** including empty/failure status; permit a deliberately empty position in the final partial batch.
- **Do not auto-commit the batch** until user reviews any flagged positions. On commit, ensure retries/repeated clicks cannot double-add cards (batch UUID / idempotency).
- The selected canonical identity must be decoupled from a nice-looking reference picture; image match alone is not proof.

Suggested record:
```json
{
  "batch_id": "uuid", "slot": 1, "image_crop_ref": "local/session/path",
  "ocr_raw": "...", "top_candidates": [], "candidate_name": null,
  "oracle_id": null, "name_decision": "REVIEW",
  "scryfall_print_id": null, "set": null, "collector_number": null,
  "finish": null, "printing_decision": "UNKNOWN",
  "reviewed_by_user": false
}
```
(Example contract; not yet implemented.)

## 6. Deployment, Scryfall integration and export

- **v1 deployment:** standalone static scanner page hosted alongside the existing explorer (e.g. `scanner/index.html`); browser file-upload input with a mobile camera capture hint; Canvas API and optionally OpenCV.js; Tesseract.js; local data index. No app-store installation or mandatory server.
- **Offline/online behavior:** OCR can run in the browser after dependencies are loaded/cached; canonical name lookup should ideally use a versioned local index. Missing index means clearly labeled online fallback; do not claim offline mode without testing cache startup.
- **Collection:** retain batch history in browser IndexedDB until exported (or until cleared). Output CSV compatible with the project's collection conventions: exact Name, lower-case Set code, Collector number as text, Quantity, Foil / Finish only if verified, Notes with unresolved status and location. Don't silently normalize unknown foil to `normal`. The spreadsheet in the ChatGPT Project remains authoritative; CSV import/reconciliation is explicit.
- **Scryfall stewardship:** use bulk data for repeated name/printing lookups, avoid redundant per-card API requests, follow current rate limits and `429` backoff, send an identifiable User-Agent/Accept when the runtime permits it, and obey card data/image usage and attribution terms. Avoid shipping bulk image assets without checking their rights/terms.
- **Repository compatibility:** leave the existing image-downloader behavior and `prints_index.json` schema intact. Add scanner files and any optional name-index build step with separate tests.

Scryfall guidance: [API documentation](https://scryfall.com/docs/api), [rate-limit and bulk-data FAQ](https://scryfall.com/docs/faqs/i-m-having-trouble-accessing-the-scryfall-api-or-i-m-blocked-17), [bulk data](https://scryfall.com/docs/api/bulk-data).

## 7. Experiment design (Karpathy/AutoResearch-inspired)

**This is an evaluation plan; no performance results have been collected yet.**

1. Collect **at least 100 real photos × 15 positions = 1,500 slot examples** across multiple scanning sessions. Each photo's ground truth records slot, canonical name and, where physically verifiable, exact printing. Include deliberately empty/overlapped positions. Keep the raw photographs private unless explicitly shared.
2. Diverse strata: ordinary cards (20 photos), mixed frames/sets and DFCs (20), small camera shifts and uneven lighting (20), foils/glare/older frames (20), difficult/failure cases (20). Counts are **test plan targets**, not existing data.
3. Keep calibration/development and **blind holdout** subsets separated by physical cards and/or scanning sessions where practical. Never tune recognition thresholds on the final blind holdout.
4. Run **reproducible ablations** using the same photos, timestamps, model/index versions and metric definitions:
   - A0: manual mat corners + title-band OCR only;
   - A1: add local exact/fuzzy-name candidate resolution;
   - A2: add perspective/blur/glare checks;
   - A3: add art-hash/ORB reranking to ambiguous cases;
   - A4 (optional): replace/augment art score with pretrained visual embeddings.
5. One experiment changes **one component**, runs the same benchmark and records the result in a machine-readable `experiments.csv` (method, config hash, fixed test split, counts, runtime, failure classes, decision). Keep a change only if it improves the predetermined primary quality objective without violating speed/error budgets. Do not copy AutoResearch's unbounded training loop or reset changes outside a controlled branch.
6. Evaluate on **real camera photographs**. A concept illustration or reference image is not a valid validation set.

**Report these metrics separately**:
- **Slot accounting:** out of 15, number located/empty/review/retake; target *zero silent missing slots*.
- **Auto-accepted name precision:** correct accepted names / all auto-accepted names. **Initial aspirational gate ≥99.5%**, pending enough test samples and confidence intervals.
- **Auto-accept coverage:** auto-accepted positions / occupied positions, with no artificial target that causes guessing.
- **Review yield and false-confidence rate:** how many cases require confirmation, and how many wrong identities would be saved without confirmation.
- **Complete-batch success:** fraction of photos whose 15 occupied cards are all named correctly without intervention. Per-card success must be very high: even 99% independent per-card accuracy implies only about **86%** all-15-correct batches.
- **Printing accuracy:** report only among cases with actual verified printing ground truth, separately from name identification.
- **Latency:** median/p95 photo-to-review on named phone(s), desktop, and cold vs warm OCR cache. Record model/index download size and browser memory.
- **Per-stratum failures:** Foil, glare, frame style, DFC, unfamiliar names, rotated/occluded positions, non-English, etc.

**Release gate for v1:** no omitted slots, no automatic double-add on retry, reviewed edits persist and export cleanly, no fictitious set/finish, benchmark report published, and auto-accept threshold calibrated on real held-out photos. An exact numeric “15/15 every time” claim is not justified without measurements.

## 8. MVP implementation sequence (not started)

| Stage | Deliverable | Exit condition |
|---|---|---|
| 0. Baseline evidence | 5–10 representative real photos with manual ground-truth list | Crops can be inspected at readable resolution |
| 1. Geometry | Upload, EXIF correction, four-corner rectification, 15 grid crops | Every position has a visible crop/empty state |
| 2. OCR | Worker reuse, title-band OCR, raw OCR debug text | Reproducible card-name baseline |
| 3. Matching | Generated compact name index, exact/fuzzy candidate matcher | Correct names selected or review flagged |
| 4. Review/export | 15-slot review, idempotent batch save, CSV and local session | No silent omissions or wrong defaults |
| 5. Evaluation | Fixed tests, difficult-case photo suite, ablation script | Measured precision/coverage/latency |
| 6. If justified | Limited-candidate art hash/ORB, then pretrained embeddings | Demonstrated improvement on held-out data |

### Open questions to resolve from actual photos

- Do title letters remain legible at a full 15-card field of view on the intended camera and mount?
- Can marker/corner detection be reliable enough to eliminate manual calibration?
- Which real-world failures are most common: title OCR, crop alignment, blur, glare, or alternate frames?
- Does art verification materially improve accepted-name precision or mainly add latency?
- Does the user need exact print/foil identification in v1, or name-first collection capture?
- What browser/device should be the reference target for speed and memory?

## 9. Decision log

- **2026-10-29:** Research-only phase. **Proposed**, not delivered: fixed-grid OCR-first scanner; conservative 15-slot review; reuse Scryfall indexes; Karpathy-style controlled evaluation; image embeddings deferred pending evidence.
- **Repository status:** Existing downloader and data-index builder verified; camera recognition, scanner UI, accuracy dataset and benchmark **not implemented**.

---

**Non-claims:** No reported accuracy number is a measured scanner result; 99.5% is a target. No source examined establishes guaranteed 15-card image recognition or exact printing inference from a photograph. No affiliation with Andrej Karpathy, OpenCV, Scryfall or Meta is implied.
