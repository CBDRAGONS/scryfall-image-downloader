#!/usr/bin/env python3
"""Build browser-ready Scryfall indexes from the official gzip JSONL bulk exports.

Requires Python 3.9+ and no third-party packages. Raw bulk files are not committed.
The legacy prints_index.json v3 format is kept intact for Luminary.
"""
from __future__ import annotations

import argparse
from collections import defaultdict
from contextlib import closing
from datetime import datetime, timezone
import gzip
import json
import os
from pathlib import Path
import re
import tempfile
import urllib.parse
import urllib.request

API = "https://api.scryfall.com/bulk-data"
KINDS = ("default_cards", "oracle_cards", "rulings")
MINIMUMS = {"default_cards": 80000, "oracle_cards": 30000, "rulings": 10000}
HEADERS = {"User-Agent": "CBDRAGONS-Scryfall-Repository/1.0 (bulk-data indexer)",
           "Accept": "application/json, application/octet-stream"}
ORACLE_FIELDS = ("name", "mana_cost", "cmc", "type_line", "oracle_text",
                 "color_identity", "colors", "layout", "keywords", "legalities",
                 "power", "toughness", "loyalty", "defense", "produced_mana",
                 "edhrec_rank", "scryfall_uri")
FACE_FIELDS = ("name", "mana_cost", "type_line", "oracle_text", "colors",
               "power", "toughness", "loyalty", "defense")


def metadata_from_api():
    request = urllib.request.Request(API, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=45) as reply:
        document = json.load(reply)
    choices = {item.get("type"): item for item in document.get("data", [])}
    result = {}
    for kind in KINDS:
        item = choices.get(kind)
        if not item:
            raise ValueError(f"Scryfall bulk manifest has no {kind}")
        # Current bulk export format is gzipped JSONL, not the older JSON array.
        url = item.get("jsonl_download_uri")
        parsed = urllib.parse.urlparse(url or "")
        if parsed.scheme != "https" or parsed.hostname != "data.scryfall.io" or not parsed.path.endswith(".gz"):
            raise ValueError(f"Missing or unexpected gzipped JSONL URL for {kind}: {url!r}")
        result[kind] = {"source": url, "updated_at": item.get("updated_at")}
    return result


def local_metadata(directory: Path):
    result = {}
    for kind in KINDS:
        options = (directory / f"{kind}.jsonl.gz", directory / f"{kind}.jsonl")
        path = next((p for p in options if p.is_file()), None)
        if path is None:
            raise FileNotFoundError(f"Expected one of: {options}")
        result[kind] = {"source": path, "updated_at": "offline-fixture"}
    return result


def records(source):
    """Yield JSONL records, streaming instead of loading full Scryfall exports."""
    if isinstance(source, Path):
        opener = gzip.open if source.name.endswith(".gz") else open
        stream = opener(source, "rb")
    else:
        stream = urllib.request.urlopen(urllib.request.Request(source, headers=HEADERS), timeout=180)
    with closing(stream):
        if not isinstance(source, Path):
            stream = gzip.GzipFile(fileobj=stream)
        with closing(stream):
            for line_no, raw in enumerate(stream, 1):
                if not raw.strip():
                    continue
                try:
                    item = json.loads(raw)
                except json.JSONDecodeError as exc:
                    raise ValueError(f"Invalid JSONL at line {line_no} in {source}") from exc
                if not isinstance(item, dict):
                    raise ValueError(f"Non-object JSONL entry on line {line_no} in {source}")
                yield item


def collector_sort(value):
    s = str(value or "")
    match = re.match(r"^(\d+)", s)
    return (0, int(match.group(1)), s) if match else (1, 0, s)


def compact_oracle(card):
    obj = {key: card[key] for key in ORACLE_FIELDS if key in card}
    if card.get("card_faces"):
        obj["card_faces"] = [
            {key: face[key] for key in FACE_FIELDS if key in face}
            for face in card["card_faces"]
        ]
    return obj


def build_indexes(sources, output_dir: Path, strict=True):
    """Return metadata for the generated files; never writes partial JSON files."""
    output_dir.mkdir(parents=True, exist_ok=True)
    oracle = {}
    by_name = {}
    prints = defaultdict(list)
    rulings = defaultdict(list)
    counters = {}

    for kind in KINDS:
        count = 0
        for card in records(sources[kind]["source"]):
            count += 1
            oracle_id = card.get("oracle_id")
            if not oracle_id:
                continue
            if kind == "default_cards":
                if not all(card.get(key) for key in ("id", "set", "released_at")):
                    continue
                date = card["released_at"].replace("-", "")
                if len(date) != 8 or not date.isdigit():
                    continue
                games = card.get("games") or []
                bits = (1 if "paper" in games else 0) | (2 if "mtgo" in games else 0) | (4 if "arena" in games else 0)
                flags = (1 if card.get("digital") else 0) | (2 if card.get("promo") else 0)
                # Original downloader contract: [id, set, YYYYMMDD, gamesBits, flagsBits, collectorNumber].
                prints[oracle_id].append([
                    card["id"], card["set"], date, bits, flags,
                    str(card.get("collector_number", ""))
                ])
            elif kind == "oracle_cards":
                oracle[oracle_id] = compact_oracle(card)
                names = [card.get("name", "")]
                names.extend(face.get("name", "") for face in card.get("card_faces", []))
                for name in names:
                    if name:
                        by_name[name.casefold()] = oracle_id
            else:
                if card.get("comment"):
                    rulings[oracle_id].append([
                        card.get("published_at", ""), card.get("source", ""),
                        card["comment"]
                    ])
        counters[kind] = count
        if strict and count < MINIMUMS[kind]:
            raise ValueError(f"Suspiciously small {kind} export: {count} records")
        print(f"Read {kind}: {count:,} records", flush=True)

    if not prints or not oracle or not rulings:
        raise ValueError("An index is empty: refusing to publish")
    # Match existing downloader order and preserve same-day collector number tie-breaking.
    for entries in prints.values():
        entries.sort(key=lambda row: (row[2], collector_sort(row[5]), row[0]))
    for entries in rulings.values():
        entries.sort(key=lambda row: (row[0], row[1], row[2]))

    index_files = {
        "prints_index.json": dict(sorted(prints.items())),
        "oracle_index.json": {
            "cards": dict(sorted(oracle.items())),
            "by_name": dict(sorted(by_name.items()))
        },
        "rulings_index.json": dict(sorted(rulings.items())),
    }
    now = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    manifest = {
        "local_updated_at": now,
        "scryfall_updated_at": sources["default_cards"]["updated_at"],
        "oracle_count": len(prints),
        "total_entries": sum(len(x) for x in prints.values()),
        "file_size_mb": 0,
        "format_version": 3,
        "indexes": {},
    }
    for filename, value in index_files.items():
        payload = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        if filename == "prints_index.json":
            manifest["file_size_mb"] = round(len(payload) / (1024 * 1024), 1)
        name = filename.removesuffix("_index.json")
        kind = {"prints": "default_cards", "oracle": "oracle_cards",
                "rulings": "rulings"}[name]
        manifest["indexes"][kind] = {
            "filename": filename, "source_updated_at": sources[kind]["updated_at"],
            "source_records": counters[kind], "size_bytes": len(payload),
            "indexed_keys": len(value["cards"] if filename == "oracle_index.json" else value),
        }
        atomic_write(output_dir / filename, payload)
        print(f"Wrote {filename}: {len(payload):,} bytes", flush=True)

    # Written last so the browser sees a consistent refresh status.
    atomic_write(output_dir / "bulk_manifest.json",
                 (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8"))
    return manifest


def atomic_write(path: Path, data: bytes):
    fd, tmp = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as out:
            out.write(data)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", type=Path, help="Read local .jsonl[.gz] files rather than downloading")
    parser.add_argument("--output-dir", type=Path, default=Path(__file__).parent / "data")
    parser.add_argument("--allow-small", action="store_true", help="Only for tiny offline test fixtures")
    args = parser.parse_args()
    sources = local_metadata(args.input_dir) if args.input_dir else metadata_from_api()
    manifest = build_indexes(sources, args.output_dir, strict=not args.allow_small)
    print(f"Complete: {manifest['oracle_count']:,} Oracle IDs in printing index.")


if __name__ == "__main__":
    main()
