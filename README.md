# NextGenAI

AI-powered business idea validation — frontend + SQLite database.

## Run it

```bash
npm install
npm start
```

Open http://localhost:3000 (serves `nextgen.html`).
file:///C:/Users/vanas/Downloads/nextgen.html#features

## Files

| File | Purpose |
|---|---|
| `nextgen.html` | Main page (new design) |
| `style.css` | Styles for `nextgen.html` |
| `script.js` | Analysis logic, dashboard updates, saved-ideas UI |
| `server.js` | Express API + SQLite database (`nextgenai.db`, created automatically) |
| `index.html` + `style-classic.css` | Your original light version, kept as-is |

## Database

Table `ideas`: id, name, description, target_customer, score, problem, market,
uniqueness, competition, verdict, created_at.

| Method | Route | Does |
|---|---|---|
| GET | `/api/ideas` | List saved ideas (latest 100) |
| POST | `/api/ideas` | Save an analyzed idea |
| DELETE | `/api/ideas/:id` | Delete an idea |
| GET | `/api/health` | Used by the page to detect the server |

If you open `nextgen.html` directly (without the server), the page still works and
saves ideas in the browser's localStorage instead.

## Next steps

`analyzeIdea()` in `script.js` is a simple keyword/length heuristic used for the
prototype. Replace it with a real AI call (e.g. a `/api/analyze` route on the server
that calls an LLM) when you're ready.
