# Scryfall bulk-data integration

This fork keeps Luminary's existing `index.html` downloader unchanged while adding a searchable Oracle card index and a card-rulings index.

## Generated files

- `data/prints_index.json`: **unchanged format** for the image downloader. Map from `oracle_id` to arrays of `[id, set, YYYYMMDD, gamesBits, flagsBits, collectorNumber]`, ordered by release date then collector number.
- `data/oracle_index.json`: `cards` keyed by `oracle_id` containing Oracle rules text, mana costs, card faces, color identity, Commander legality, keywords, etc.; `by_name` maps case-folded full card or face names to Oracle IDs.
- `data/rulings_index.json`: map from `oracle_id` to rows of `[published_at, source, comment]`.
- `data/bulk_manifest.json`: compatible downloader status plus source timestamps, counts and sizes.

`oracle_index.json` and `rulings_index.json` are reference datasets; the image downloader does not yet render a card-rule search UI. They may be fetched by other code or downloaded for offline lookup. Prices in bulk data are snapshots; legality updates with the export.

## Update and verify locally

Requires Python 3.9+; no pip dependencies.

```sh
python update_bulk_data.py
python verify_indexes.py
```

For an offline test with local exports (named `oracle_cards.jsonl.gz`, `default_cards.jsonl.gz` and `rulings.jsonl.gz`):

```sh
python update_bulk_data.py --input-dir ./scryfall_data --output-dir ./data
python verify_indexes.py
```

The updater fetches the latest URLs from the official Scryfall bulk catalog and streams **gzip-compressed JSON Lines** from `jsonl_download_uri`. It never loads the full raw exports into RAM and does not commit raw exports or card image assets. Publication uses per-file atomic writes and writes the manifest last. If a download or validation fails, GitHub Actions stops without committing generated files.

## Automation

GitHub Actions workflow `.github/workflows/refresh-scryfall.yml` runs Mondays at **09:23 UTC** and exposes a **Run workflow** button on the repository's Actions page once the workflow is on the default branch. The action tests the index builder, downloads Scryfall data, verifies indexes and commits only when generated indexes change. Scheduled workflows run on the default branch; merge this feature branch before expecting the schedule to run.

For the forked GitHub Actions workflow, ensure Actions are enabled in repository Settings. GitHub may disable scheduled workflows after prolonged repository inactivity.

## Data notes

Scryfall API: https://scryfall.com/docs/api/bulk-data

Scryfall card data and images are subject to Scryfall/Wizards of the Coast terms. Credit Scryfall and the card artists where applicable.
