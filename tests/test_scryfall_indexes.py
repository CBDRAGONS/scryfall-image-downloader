"""Offline contract tests for the Scryfall streaming indexer."""
import gzip
import json
import tempfile
import unittest
from pathlib import Path
from update_bulk_data import local_metadata, build_indexes
from verify_indexes import verify

ORACLE = "12345678-0000-4000-8000-123456789abc"

class IndexTest(unittest.TestCase):
    def test_pipeline_and_original_downloader_format(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            inputs = root / "input"
            outputs = root / "out"
            inputs.mkdir()
            dataset = {
                "oracle_cards": [{
                    "oracle_id": ORACLE, "name": "Test Hero // Test Beast",
                    "layout": "transform", "cmc": 3, "color_identity": ["G"],
                    "legalities": {"commander": "legal"},
                    "card_faces": [
                        {"name": "Test Hero", "oracle_text": "Draw a card."},
                        {"name": "Test Beast", "oracle_text": "Trample"}
                    ]
                }],
                "default_cards": [
                    {"oracle_id": ORACLE, "id": "c", "set": "xyz", "released_at": "2025-05-02", "games": ["paper"],
                     "collector_number": "20", "digital": False, "promo": False},
                    {"oracle_id": ORACLE, "id": "b", "set": "abc", "released_at": "2024-01-01", "games": ["arena"],
                     "collector_number": "12b", "digital": True, "promo": True},
                    {"oracle_id": ORACLE, "id": "a", "set": "abc", "released_at": "2024-01-01", "games": ["paper", "mtgo"],
                     "collector_number": "2", "digital": False, "promo": False}
                ],
                "rulings": [
                    {"oracle_id": ORACLE, "published_at": "2024-01-03", "source": "wotc", "comment": "Later"},
                    {"oracle_id": ORACLE, "published_at": "2024-01-02", "source": "wotc", "comment": "Earlier"}
                ]
            }
            for kind, rows in dataset.items():
                with gzip.open(inputs / f"{kind}.jsonl.gz", "wt", encoding="utf-8") as f:
                    for row in rows:
                        f.write(json.dumps(row) + "\n")
            result = build_indexes(local_metadata(inputs), outputs, strict=False)
            verify(outputs, min_cards=1, min_prints=3, min_rulings=1)
            prints = json.loads((outputs / "prints_index.json").read_text())
            oracle = json.loads((outputs / "oracle_index.json").read_text())
            rulings = json.loads((outputs / "rulings_index.json").read_text())
            self.assertEqual([x[0] for x in prints[ORACLE]], ["a", "b", "c"])
            self.assertEqual([x[3:5] for x in prints[ORACLE]], [[3, 0], [4, 3], [1, 0]])
            self.assertEqual(oracle["by_name"]["test beast"], ORACLE)
            self.assertEqual(oracle["cards"][ORACLE]["legalities"]["commander"], "legal")
            self.assertEqual([r[2] for r in rulings[ORACLE]], ["Earlier", "Later"])
            self.assertEqual(result["format_version"], 3)

if __name__ == "__main__":
    unittest.main()
