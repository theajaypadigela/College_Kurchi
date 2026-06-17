# College Kurchi 🪑

An AI-powered **TS EAMCET** college counseling platform. Students discover colleges,
analyze cutoffs, compare options, predict admission chances, and get personalized,
**RAG-grounded** recommendations — all backed by the official 2025 final-phase data.

- **Frontend:** React + TypeScript + Vite + Tailwind
- **Backend:** Python + FastAPI
- **Database:** MongoDB
- **AI:** Retrieval-Augmented Generation — local embeddings + in-app vector search + Groq (Llama) LLM

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full system design, DB schema, RAG workflow, and API reference.

```
college kurchi/
├── frontend/    # React SPA (talks to the API)
├── backend/     # FastAPI + MongoDB + RAG
├── data/        # source JSON (only used by the seed script)
├── scripts/     # PDF → JSON converters
└── ARCHITECTURE.md
```

## Features

| # | Feature | How it works |
|---|---------|--------------|
| 1 | **AI College Counselor** | Natural-language Q&A. RAG: parse → retrieve (structured + vector) → grounded answer via Groq. Shows sources. |
| 2 | **Recommendations** | Dream / Moderate / Safe buckets for rank + category + gender + branch (+ location & budget). |
| 3 | **Comparison** | Side-by-side table + an AI-generated summary of the key differences. |
| 4 | **Explorer** | Search + filter by branch, district, type, fee, package. |
| 5 | **College Details** | Branch-wise cutoffs (all categories/genders), fees, placements, recruiters. |
| 6 | **Admission Predictor** | Probability + HIGH/MEDIUM/LOW + safe alternatives. |
| 7 | **Shortlist** | Save & compare favorites (localStorage). |

## Prerequisites

- **Node.js** 18+ and **Python** 3.9+
- **MongoDB** running locally (or an Atlas URI)
- A **Groq API key** (free at [console.groq.com](https://console.groq.com)) — optional; the app
  falls back to a deterministic, still-grounded responder without it.

## Quick start

### 1. MongoDB
If you don't already run MongoDB as a service, start it with a project-local data dir:
```bash
mkdir -p backend/.mongo-data
mongod --dbpath backend/.mongo-data --port 27017
```
(or `brew services start mongodb-community`, or set `MONGODB_URI` to Atlas.)

### 2. Backend
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env        # then add your GROQ_API_KEY
python -m app.seed --drop   # load data/*.json into MongoDB (one time)

uvicorn app.main:app --reload --port 8000
```
- API docs: http://localhost:8000/docs
- Health:   http://localhost:8000/api/health

### 3. Frontend
```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```
The frontend reads `VITE_API_BASE_URL` (default `http://localhost:8000`).

## Deleting the JSON files

After `python -m app.seed` succeeds, **MongoDB is the source of truth** — the running app
never reads the JSON files again. You can delete `data/*.json` safely.

> Keep them only if you might want to re-seed a fresh database later (the seed script reads them).
> Once deleted, your data lives in MongoDB (`college_kurchi` db, `colleges` + `meta` collections).

## Configuration (`backend/.env`)

| Var | Default | Notes |
|-----|---------|-------|
| `GROQ_API_KEY` | – | Groq key (`gsk_…`). Empty → template fallback. |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Any Groq chat model. |
| `MONGODB_URI` | `mongodb://localhost:27017` | Local or Atlas. |
| `DB_NAME` | `college_kurchi` | |
| `EMBEDDING_BACKEND` | `hashing` | `hashing` (no deps) or `st` (sentence-transformers). |
| `EMBEDDING_DIM` | `512` | Hashing vector size. |
| `CORS_ORIGINS` | `localhost:5173,…` | Comma-separated. |

### Upgrading to semantic embeddings (optional)
```bash
pip install sentence-transformers      # in backend/.venv
# set EMBEDDING_BACKEND=st in .env, then re-run:
python -m app.seed --drop
```

## Data note

The dataset is **TS EAMCET 2025 final phase** (160 colleges, 940 branch rows): a single
counseling year, no seat counts, with affiliating university + rich categories
(OC, EWS, BC-A…E, SC-1/2/3, ST × Boys/Girls) and fees/placements for 120 colleges.
