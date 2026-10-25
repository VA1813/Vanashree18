// ==============================
// NEXTGENAI BACKEND
// Express + SQLite (file: nextgenai.db)
// Run:  npm install && npm start   ->  http://localhost:3000
// ==============================

const path = require("path");
const express = require("express");
const Database = require("better-sqlite3");

const PORT = process.env.PORT || 3000;
const app = express();

// ---------- DATABASE ----------
const db = new Database(path.join(__dirname, "nextgenai.db"));
db.pragma("journal_mode = WAL");

db.exec(`
    CREATE TABLE IF NOT EXISTS ideas (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        name            TEXT    NOT NULL,
        description     TEXT    NOT NULL,
        target_customer TEXT    NOT NULL,
        score           INTEGER NOT NULL,
        problem         INTEGER NOT NULL,
        market          INTEGER NOT NULL,
        uniqueness      INTEGER NOT NULL,
        competition     INTEGER NOT NULL,
        verdict         TEXT    NOT NULL,
        created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );
`);

const insertIdea = db.prepare(`
    INSERT INTO ideas
        (name, description, target_customer, score, problem, market, uniqueness, competition, verdict)
    VALUES
        (@name, @description, @target_customer, @score, @problem, @market, @uniqueness, @competition, @verdict)
`);
const listIdeas = db.prepare("SELECT * FROM ideas ORDER BY id DESC LIMIT 100");
const getIdea = db.prepare("SELECT * FROM ideas WHERE id = ?");
const deleteIdea = db.prepare("DELETE FROM ideas WHERE id = ?");

// ---------- HELPERS ----------
const pct = (v) => Number.isFinite(v) && v >= 0 && v <= 100;
const text = (v, max) => typeof v === "string" && v.trim().length > 0 && v.length <= max;

// ---------- MIDDLEWARE ----------
app.use(express.json({ limit: "20kb" }));

// ---------- API ----------
app.get("/api/health", (req, res) => {
    res.json({ ok: true });
});

app.get("/api/ideas", (req, res) => {
    res.json(listIdeas.all());
});

app.post("/api/ideas", (req, res) => {
    const b = req.body || {};

    const valid =
        text(b.name, 120) &&
        text(b.description, 2000) &&
        text(b.target_customer, 200) &&
        text(b.verdict, 60) &&
        [b.score, b.problem, b.market, b.uniqueness, b.competition].every(pct);

    if (!valid) {
        return res.status(400).json({ error: "Invalid idea data." });
    }

    const result = insertIdea.run({
        name: b.name.trim(),
        description: b.description.trim(),
        target_customer: b.target_customer.trim(),
        score: Math.round(b.score),
        problem: Math.round(b.problem),
        market: Math.round(b.market),
        uniqueness: Math.round(b.uniqueness),
        competition: Math.round(b.competition),
        verdict: b.verdict.trim()
    });

    res.status(201).json(getIdea.get(result.lastInsertRowid));
});

app.delete("/api/ideas/:id", (req, res) => {
    const info = deleteIdea.run(Number(req.params.id));
    if (info.changes === 0) {
        return res.status(404).json({ error: "Idea not found." });
    }
    res.json({ ok: true });
});

// ---------- STATIC FILES (whitelist so server.js / .db are never exposed) ----------
const send = (file) => (req, res) => res.sendFile(path.join(__dirname, file));

app.get("/", send("nextgen.html"));
app.get("/nextgen.html", send("nextgen.html"));
app.get("/index.html", send("index.html"));
app.get("/style.css", send("style.css"));
app.get("/style-classic.css", send("style-classic.css"));
app.get("/script.js", send("script.js"));

app.listen(PORT, () => {
    console.log(`NextGenAI running at http://localhost:${PORT}`);
});
