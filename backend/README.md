# College Kurchi — Backend

FastAPI + MongoDB + RAG (Groq). See [../ARCHITECTURE.md](../ARCHITECTURE.md) for the design.

## Run

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # add GROQ_API_KEY
python -m app.seed --drop       # seed MongoDB from ../data/*.json
uvicorn app.main:app --reload --port 8000
```

Interactive docs at `/docs`. Health at `/api/health`.

## Layout

```
app/
├── main.py        # FastAPI app, CORS, lifespan (builds the vector index)
├── config.py      # env settings (pydantic-settings)
├── db.py          # MongoDB client + indexes
├── models.py      # Pydantic request/response schemas
├── seed.py        # ingest + normalize + embed  (python -m app.seed)
├── rag/           # embeddings, vector_store, query_parser, retriever, llm, counselor
├── services/      # colleges, recommendations, predictor, comparison
└── routers/       # meta, colleges, recommendations, predictor, comparison, counselor
```

## Endpoints (prefix `/api`)

| Method | Path | Body / Query |
|---|---|---|
| GET  | `/health` | – |
| GET  | `/meta` | – |
| GET  | `/colleges` | `q, branch, district, type, university, minFee, maxFee, minAvgPackage, codes, sort, limit` |
| GET  | `/colleges/{code}` | – |
| GET  | `/cutoffs` | `branch, category, gender, district, q, limit` |
| POST | `/recommendations` | `{rank, category, gender, branch, location?, maxFee?}` |
| POST | `/predict` | `{rank, category, gender, branch, collegeCode?}` |
| POST | `/compare` | `{codes[], category?, gender?}` |
| POST | `/counselor/chat` | `{message, history?}` |

## RAG

`counselor.chat()` → `query_parser.parse()` (intent, rank, branch, category, gender,
location, college names) → `retriever.retrieve()` (structured DB filtering **+** cosine
vector search over college embeddings) → grounded prompt → `llm` (Groq). Falls back to a
deterministic template if no `GROQ_API_KEY`.

Embeddings default to a pure-NumPy **hashing** embedder (no heavy deps). Set
`EMBEDDING_BACKEND=st` (and `pip install sentence-transformers`) for real semantic
embeddings, then re-seed. The query-time embedder is auto-selected to match whatever the
data was seeded with (stored in the `meta` document).
