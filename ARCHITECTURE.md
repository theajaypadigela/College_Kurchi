# College Kurchi — Architecture

An AI-powered TS EAMCET college counseling platform. Students discover colleges,
analyze cutoffs, compare options, predict admission chances, and get personalized,
RAG-grounded recommendations.

## 1. System architecture

```
┌──────────────────────┐        HTTPS/JSON         ┌───────────────────────────┐
│   Frontend (React)   │  ───────────────────────► │     Backend (FastAPI)     │
│  Vite + TS + Tailwind│                            │                           │
│                      │ ◄───────────────────────  │  Routers → Services → DB  │
│  DataProvider context│                            │            │   │         │
│  (loads /meta+/colleges)                          │     RAG ◄──┘   │         │
└──────────────────────┘                            │      │         ▼         │
                                                     │      │   ┌──────────┐    │
                                                     │      │   │ MongoDB  │    │
                                                     │      │   │ colleges │    │
                                                     │      │   │ meta     │    │
                                                     │      ▼   └──────────┘    │
                                                     │  ┌─────────────────┐     │
                                                     │  │  Groq LLM (Llama)│     │
                                                     │  └─────────────────┘     │
                                                     └───────────────────────────┘
```

- **Frontend** is a SPA. A `DataProvider` loads `/api/meta` (filter options) and
  `/api/colleges` (full list, ~160 docs) once at boot, so Explorer / Details /
  Cutoffs / Shortlist / Comparison render instantly from context. The "smart"
  features (Recommendations, Predictor, Comparison summary, AI Counselor) call
  dedicated POST endpoints that run server-side logic + the LLM.
- **Backend** is layered: `routers` (HTTP) → `services` (business logic) → `db`
  (MongoDB). The `rag` package (embeddings, vector store, query parser, retriever,
  LLM) powers the AI Counselor and the comparison summary.
- **Data** lives in MongoDB. The source JSON files are only used once by the seed
  script; after seeding, MongoDB is the single source of truth (the user can delete
  the JSON files).

## 2. Database schema (MongoDB, db: `college_kurchi`)

### `colleges` (one document per college, branches embedded)
```jsonc
{
  "_id": "CBIT",                      // college code (stable id)
  "code": "CBIT",
  "name": "CHAITANYA BHARATHI INSTITUTE OF TECHNOLOGY",
  "place": "GANDIPET",
  "district": "Ranga Reddy",
  "distCode": "RR",
  "university": "OU",                 // affiliating university (was "region")
  "type": "Private",                  // Government | Private | Self-Finance | University
  "coEducation": "COED",              // COED | GIRLS
  "feePerYear": 183000,               // nullable
  "totalFees": 732000,                // nullable
  "highestPackageLpa": 41.0,          // nullable
  "averagePackageLpa": 9.9,           // nullable
  "topRecruiters": ["Microsoft", ...],// [] if unknown
  "branches": [
    { "code": "CSE", "name": "COMPUTER SCIENCE AND ENGINEERING",
      "ranks": { "OC|Boys": 2053, "OC|Girls": 2089, "BC_B|Boys": 4120, ... } }
  ],
  "document": "CBIT … Ranga Reddy … CSE OC 2053 … fee 183000 … avg 9.9 LPA …",
  "chunks": [                          // overlapping windows of `document`, each embedded
    { "text": "CBIT (code CBIT). Located in …", "index": 0, "embedding": [ ... ] },
    { "text": "… CSE OC boys 2053 … fee 183000 …", "index": 1, "embedding": [ ... ] }
  ],
  "embedding": [0.0123, -0.0456, ...] // per-college mean vector (fallback / compat)
}
```
Indexes: `code` (unique via `_id`), `district`, `type`, `university`, `branches.code`.
`document`, `chunks`, and `embedding` are projected out of all public API responses.

### `meta` (single document, `_id: "meta"`)
Derived at seed time — drives the frontend filter dropdowns:
`year`, `phase`, `categories[{value,label}]`, `genders[]`, `branches[{code,name,count}]`,
`districts[]`, `universities[]`, `collegeTypes[]`, `collegeCount`, `embeddingDim`,
`embeddingBackend`.

Rank key format is `"{CATEGORY}|{Gender}"`, e.g. `"OC|Boys"`, `"SC_1|Girls"`.

## 3. RAG workflow (AI Counselor)

```
(seed time)  document per college ──► chunk into overlapping windows ──► embed each chunk
             (chunking strategy: CHUNK_MAX_WORDS / CHUNK_OVERLAP_WORDS, sentence-aware)

user message
   │
   ▼
query_parser ──► { intent, rank?, branch?, category?, gender?, location?, collegeNames[], maxFee? }
   │
   ▼
retriever ──┬─ structured retrieval: Mongo filter (branch offered, rank vs closing,
            │   district, fee) → ranked candidate colleges
            └─ semantic retrieval: embed(query) → cosine over CHUNK vectors → aggregate
            │   best-chunk score per college → top-K colleges
   │  (merge + dedupe + cap)
   ▼
context builder ──► compact, factual bullet list of the retrieved colleges
   │                (code, branch closing ranks for the asked category, fees, packages)
   ▼
Groq LLM (Llama)  ──► grounded answer. System prompt: "Answer ONLY from the provided
   │                   context. Cite college codes. If not in context, say so."
   ▼
response: { answer, sources:[codes], parsed }   (fallback: deterministic template if no key)
```

Hallucination control: the LLM is instructed to use only the retrieved context, the
context is built from authoritative DB fields, and `sources` lets the UI show what was used.

## 4. API endpoints (prefix `/api`)

| Method | Path | Purpose |
|---|---|---|
| GET  | `/health` | detailed status (db/llm/index/env) |
| GET  | `/readiness` | readiness probe — 200 ready / 503 not ready (K8s / load balancer) |
| GET  | `/meta` | filter options (categories, genders, branches, districts, universities, types, year) |
| GET  | `/colleges` | list; query: `q, branch, district, type, university, minFee, maxFee, minAvgPackage, codes, sort, limit` |
| GET  | `/colleges/{code}` | single college detail |
| GET  | `/cutoffs` | flattened (college,branch) rows; query: `branch, category, gender, district, q, limit` |
| POST | `/recommendations` | body `{rank, category, gender, branch, location?, maxFee?}` → `{dream[],moderate[],safe[]}` |
| POST | `/predict` | body `{rank, category, gender, branch, collegeCode?}` → `{probability, classification, cutoffRank, safeAlternatives[]}` |
| POST | `/compare` | body `{codes[], category?, gender?}` → `{colleges[], aiSummary}` |
| POST | `/counselor/chat` | body `{message, history?}` → `{answer, sources[], parsed}` (RAG) |

## 5. Folder structure

```
college kurchi/
├── ARCHITECTURE.md           # this file
├── README.md                 # run instructions (root)
├── frontend/                 # React + TS + Vite + Tailwind (was college-kurchi/)
│   └── src/
│       ├── api/              # client.ts, types.ts, index.ts (typed fetch wrappers)
│       ├── context/          # DataProvider (loads meta + colleges once)
│       ├── pages/            # 8 feature pages (consume the API)
│       └── components/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app, CORS, lifespan (build vector index)
│   │   ├── config.py         # pydantic-settings (env) + prod safety guard
│   │   ├── logging_config.py # central logging setup
│   │   ├── db.py             # Mongo client, pool config, indexes
│   │   ├── models.py         # Pydantic request/response schemas
│   │   ├── seed.py           # ingest data/*.json → chunk + embed → Mongo  [python -m app.seed]
│   │   ├── rag/              # chunking, embeddings, vector_store, query_parser, retriever, llm, counselor, index
│   │   ├── services/         # colleges, recommendations, predictor, comparison
│   │   └── routers/          # meta, colleges, recommendations, predictor, comparison, counselor, auth
│   ├── tests/                # pytest suite (unit + API, mongomock)
│   ├── Dockerfile
│   ├── requirements.txt / requirements-dev.txt
│   ├── DATA_PREP.md          # data ingestion pipeline
│   ├── .env.example
│   └── README.md
├── docker-compose.yml        # mongo + seed + api
├── .github/workflows/ci.yml  # lint + tests on push/PR
├── data/                     # source JSON + PDFs (delete after seeding)
└── scripts/                  # convert_*.py (PDF → source JSON)
```

## 6. Tech + config

- Frontend: React 19, TypeScript, Vite, Tailwind, React Router. `VITE_API_BASE_URL` (default `http://localhost:8000`).
- Backend: FastAPI, Uvicorn, Pydantic v2, PyMongo, Groq SDK, NumPy.
- Chunking: sentence-aware overlapping windows (`CHUNK_MAX_WORDS` / `CHUNK_OVERLAP_WORDS`), embedded per chunk.
- Embeddings: hashing (pure NumPy, default, free) or `sentence-transformers` (`EMBEDDING_BACKEND=st`).
- LLM: Groq `llama-3.3-70b-versatile` (`GROQ_MODEL`); request timeout + retry; graceful template fallback if `GROQ_API_KEY` is unset.
- Auth: JWT (HS256); `JWT_SECRET` from env, refused-if-default in `ENVIRONMENT=production`.
- Observability: stdlib `logging` (levels/timestamps); `/health` + `/readiness` probes.
- MongoDB: `MONGODB_URI` (default local), pool sizing via `MONGO_MAX_POOL_SIZE`. Vector search is in-app cosine (Atlas `$vectorSearch` optional).
- Tests/CI: `pytest` (mongomock, hermetic) run by GitHub Actions with `ruff` lint.
```
