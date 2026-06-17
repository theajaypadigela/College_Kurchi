# College Kurchi — Frontend

React + TypeScript + Vite + Tailwind SPA. All data comes from the backend API
(no bundled data). See [../README.md](../README.md) for full setup.

```bash
npm install
npm run dev      # http://localhost:5173 (needs the backend on :8000)
npm run build    # type-check + production build
```

Config: `VITE_API_BASE_URL` (default `http://localhost:8000`) in `.env`.

```
src/
├── api/         # typed fetch client + endpoint functions + types
├── context/     # DataProvider — loads /meta + /colleges once, exposes helpers via useData()
├── pages/       # 8 feature pages
└── components/  # Layout / nav
```

- **Explorer, Details, Cutoffs, Shortlist, Comparison table** read from the `DataProvider` context.
- **Recommendations, Predictor, Comparison summary, AI Counselor** call dedicated POST endpoints
  (server-side logic + the Groq LLM).
