#!/usr/bin/env python3
"""Validate the published indexes and the legacy downloader contract."""
import json
from pathlib import Path

def verify(folder=Path("data"), min_cards=30000, min_prints=80000, min_rulings=10000):
    manifest = json.loads((folder / "bulk_manifest.json").read_text())
    prints = json.loads((folder / "prints_index.json").read_text())
    oracle = json.loads((folder / "oracle_index.json").read_text())
    rulings = json.loads((folder / "rulings_index.json").read_text())
    cards, names = oracle["cards"], oracle["by_name"]
    assert len(cards) >= min_cards, "too few Oracle cards"
    assert sum(map(len, prints.values())) >= min_prints, "too few printings"
    assert sum(map(len, rulings.values())) >= min_rulings, "too few cards with rulings"
    assert manifest["format_version"] == 3
    assert manifest["oracle_count"] == len(prints)
    assert manifest["total_entries"] == sum(map(len, prints.values()))
    for oracle_id, entries in prints.items():
        assert entries
        for entry in entries:
            assert len(entry) == 6, (oracle_id, entry)
            assert len(entry[2]) == 8 and entry[2].isdigit(), (oracle_id, entry)
    for name, oracle_id in names.items():
        assert name and oracle_id in cards
    print(f"Verified: {len(cards):,} Oracle cards; {manifest['total_entries']:,} printings; {len(rulings):,} ruling groups")

if __name__ == "__main__":
    verify()
