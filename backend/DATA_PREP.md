# Data Preparation & Ingestion

How raw TS EAMCET data becomes the MongoDB corpus that powers the API and RAG
pipeline.

## Sources (`../data/`)

| File | Role |
|---|---|
| `TGEAPCET_2025_FINALPHASE_LASTRANKS.json` | **master**: one row per (college, branch) with per category/gender closing ranks |
| `table-eapcet.json` | per-college fees + placements (joined by `college_code`) |

Both originate from official PDFs converted by the scripts in `../scripts/`
(`convert_cutoff_pdf.py`, `convert_fees_placements_pdf.py`).

### Expected fields

Cutoff rows: `inst_code`, `institute_name`, `place`, `dist_code`, `affiliated_to`,
`college_type`, `co_education`, `branch_code`, `branch_name`, and category columns
`<prefix>_boys` / `<prefix>_girls` where prefix ∈ `oc, ews, bca, bcb, bcc, bcd, bce,
sc1, sc2, sc3, st`.

Fees rows: `college_code`, `fee_per_year`, `total_fees`, `highest_package_lpa`,
`average_package_lpa`, `top_recruiters` (comma-separated string).

## Pipeline (`python -m app.seed --drop`)

```
data/*.json
   │  normalize()      group rows by college → embed branches; clean ints/names/places;
   │                   join fees/placements; build the `meta` filter document
   ▼
college docs ──► build_document()   fact-dense, multi-section text per college
   │
   ▼
chunk_document()   overlapping sentence-aware windows  (CHUNK_MAX_WORDS / CHUNK_OVERLAP_WORDS)
   │
   ▼
embedder.embed_many()   one vector per chunk  (hashing by default; sentence-transformers optional)
   │
   ▼
MongoDB:  colleges[].chunks[{text, index, embedding}]  +  per-college mean `embedding`
          meta{ year, categories, branches, districts, ..., embeddingBackend, chunkCount }
```

### Validation & resilience

- `clean_int` — coerces `"1,234"` / floats to a positive int; blank/zero/non-numeric → `None`.
- `clean_name` / `clean_place` — collapse PDF-extraction whitespace; de-dupe a doubled
  `(AUTONOMOUS)` prefix.
- **Bad rows are skipped, not fatal.** `normalize()` wraps each row in a try/except;
  a malformed row (e.g. missing `inst_code`) is logged and skipped, and a summary
  count is emitted. One broken record never aborts the whole load.
- Writes are **idempotent**: colleges are upserted by code, so re-running `seed`
  updates in place. Use `--drop` to rebuild from scratch.

### Switching to semantic embeddings

```bash
pip install sentence-transformers
EMBEDDING_BACKEND=st python -m app.seed --drop
```

The backend + dim are recorded in `meta`; the API auto-selects a matching
query-time embedder at startup, so seeding and serving never drift.

## Tests

`tests/test_seed.py` covers the cleaning helpers, `build_document`, the
bad-row-skipping path, and the missing-fees path. `tests/conftest.py` seeds an
in-memory MongoDB through this exact pipeline for the API/integration tests.
