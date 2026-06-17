# College Kurchi — Backend

FastAPI + MongoDB + RAG (Groq). See [../ARCHITECTURE.md](../ARCHITECTURE.md) for the design
and [DATA_PREP.md](DATA_PREP.md) for the data ingestion pipeline.

## Run locally

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # add GROQ_API_KEY (optional)
python -m app.seed --drop       # load + chunk + embed ../data/*.json into MongoDB
uvicorn app.main:app --reload --port 8000
```

Interactive docs at `/docs`. Health at `/api/health`, readiness at `/api/readiness`.

## Run with Docker

From the repo root (`docker compose` brings up MongoDB, seeds it, then the API):

```bash
docker compose up --build                        # template fallback (no LLM key)
GROQ_API_KEY=sk-... docker compose up --build     # with the AI counselor
```

## Tests

```bash
pip install -r requirements-dev.txt
pytest                          # 60+ tests, fully in-memory (mongomock), no LLM calls
```

The suite is hermetic: it seeds an in-memory MongoDB through the real
`app.seed.run` path, never hits the network, and forces the deterministic
(template) answer path. CI runs lint + tests on every push/PR
(`.github/workflows/ci.yml`).

## Layout

```
app/
├── main.py            # FastAPI app, CORS, lifespan (builds the vector index)
├── config.py          # env settings (pydantic-settings) + prod safety guard
├── logging_config.py  # central logging setup
├── db.py              # MongoDB client, pool config, indexes
├── models.py          # Pydantic request/response schemas
├── seed.py            # ingest + normalize + CHUNK + embed  (python -m app.seed)
├── rag/               # chunking, embeddings, vector_store, query_parser, retriever, llm, counselor, index
├── services/          # colleges, recommendations, predictor, comparison
└── routers/           # meta, colleges, recommendations, predictor, comparison, counselor, auth
tests/                 # pytest suite (unit + API)
```

## Endpoints (prefix `/api`)

| Method | Path | Body / Query |
|---|---|---|
| GET  | `/health` | – (detailed status) |
| GET  | `/readiness` | – (200 ready / 503 not ready) |
| GET  | `/meta` | – |
| GET  | `/colleges` | `q, branch, district, type, university, minFee, maxFee, minAvgPackage, codes, sort, limit` |
| GET  | `/colleges/{code}` | – |
| GET  | `/cutoffs` | `branch, category, gender, district, q, limit` |
| POST | `/recommendations` | `{rank, category, gender, branch, location?, maxFee?}` |
| POST | `/predict` | `{rank, category, gender, branch, collegeCode?}` |
| POST | `/compare` | `{codes[], category?, gender?}` |
| POST | `/counselor/chat` | `{message, history?, userRank?, userCategory?, userGender?}` |
| POST | `/auth/register`, `/auth/login`, `/auth/token` · GET/PATCH `/auth/me` | JWT auth |

## RAG pipeline

`counselor.chat()` → `query_parser.parse()` (intent, rank, branch, category, gender,
location, college names) → `retriever.retrieve()` (structured DB filtering **+**
chunk-level cosine vector search aggregated back to colleges) → grounded prompt →
`llm` (Groq, with timeout + retry). Falls back to a deterministic template if no
`GROQ_API_KEY`.

**Chunking** ([app/rag/chunking.py](app/rag/chunking.py)): at seed time each college's
document is split into overlapping, sentence-aware windows
(`CHUNK_MAX_WORDS` / `CHUNK_OVERLAP_WORDS`); every chunk is embedded separately and
stored on the college doc. The vector store holds one row per chunk
(`"{code}#{i}"`) and the retriever aggregates chunk hits to their parent college
(best-chunk score) — the standard multi-vector retrieval pattern.

**Embeddings** default to a pure-NumPy **hashing** embedder (no heavy deps, so the
app and tests run anywhere). Set `EMBEDDING_BACKEND=st` (and
`pip install sentence-transformers`) for real semantic embeddings, then re-seed.
The query-time embedder is auto-selected to match whatever the data was seeded with
(stored in the `meta` document).
