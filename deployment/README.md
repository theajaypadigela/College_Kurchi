# College Kurchi — Static Deployment (no backend)

A self-contained, **backend-free** build of College Kurchi that runs entirely
in the browser and deploys free on Vercel (or any static host). The data is
read **directly from `data/`** at build time — no MongoDB, no Python API, no
server to run.

## How it works

1. **Build-time data** — `scripts/build-data.mjs` is a faithful port of the
   backend's `seed.py` normalizer. It reads the two raw files in `data/`
   (`TGEAPCET_2025_FINALPHASE_LASTRANKS.json` + `table-eapcet.json`) and writes
   `public/data/colleges.json` and `public/data/meta.json`. This runs
   automatically on `npm run dev` and `npm run build`.
2. **All logic is client-side** — the app loads those two JSON files once and
   computes everything locally. The endpoints that used to be server calls were
   ported to TypeScript with identical behavior:
   - `src/api/local.ts` — colleges/cutoffs filtering, **recommendations**,
     **admission predictor**, **comparison** (ports of the `services/*.py`).
   - `src/api/counselor.ts` — the **AI Counselor** RAG pipeline
     (parse → retrieve → answer), ported from `rag/*.py`. Semantic vector
     search is replaced with keyword + structured retrieval.
   - `src/api/auth.ts` — register/login/profile, backed by `localStorage`
     (see the caveat below).
3. The pages, components and contexts are **unchanged** from the original
   frontend — only the `src/api/` layer was swapped, so the UI is identical.

```
deployment/
├── data/                     # raw source data (copied from ../data)
├── scripts/build-data.mjs    # data/  →  public/data/*.json
├── public/data/*.json        # generated; gitignored
├── src/api/                  # local (no-backend) implementations
├── vercel.json               # SPA routing (rewrite all paths to index.html)
└── package.json
```

## Run locally

```bash
npm install
npm run dev       # http://localhost:5173 — builds data first, then serves
npm run build     # type-check + data build + production build → dist/
npm run preview   # serve the production build locally
```

## Deploy to Vercel (free)

1. Push this `deployment/` folder to a Git repo (or run `vercel` from inside it).
2. In Vercel, import the project and set:
   - **Root Directory:** `deployment` (if the repo root is the monorepo).
   - **Framework Preset:** Vite (Build `npm run build`, Output `dist`).
3. Deploy. That's it — it's a static site, so it's free on the Hobby plan.

`vercel.json` rewrites all routes to `index.html` so React Router deep links
(`/app/colleges`, etc.) work on refresh.

## AI features (AI Counselor + comparison summary)

These optionally call **Groq directly from the browser**. Behavior:

- **No key** → the features use built-in deterministic templates and the site
  works fully offline. (Vite tree-shakes the Groq code out of the bundle.)
- **Key set** → real LLM answers (`llama-3.3-70b-versatile`), with an automatic
  fallback to the templates if a request fails.

Set the key in **Vercel → Project → Settings → Environment Variables**:

| Variable | Value |
| --- | --- |
| `VITE_GROQ_API_KEY` | a free key from https://console.groq.com/keys |
| `VITE_GROQ_MODEL` | `llama-3.3-70b-versatile` (optional, this is the default) |

> ⚠️ **Security:** `VITE_` env vars are baked into the shipped JavaScript and
> are **publicly visible** — anyone can extract the key from the site and use
> your Groq quota. Only use a free, rate-limited key you're comfortable
> exposing, and rotate it if abused. For a properly private key you'd need a
> tiny serverless function (e.g. a Vercel Edge Function) to proxy the call —
> ask if you want that instead.

## Caveat: auth is local-only

With no backend, accounts are stored in the browser's `localStorage`. This is
fine for a demo, but it is **not real authentication** — accounts don't sync
across devices/browsers, and the data is readable on the device. If you need
real accounts, you'd reintroduce a backend or use a hosted auth provider.

## Updating the data

Replace the files in `data/` (keep the same filenames and shape) and rebuild —
`npm run build` regenerates `public/data/*.json` automatically.
