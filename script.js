// ==============================
// NEXTGENAI FRONTEND
// - Idea analysis (prototype heuristic scoring)
// - Saves ideas to the database via /api/ideas
//   (falls back to localStorage if the server is not running)
// ==============================

const API = "/api/ideas";
const LOCAL_KEY = "nextgenai_ideas";
const TASKS_KEY = "nextgenai_tasks";

let dbMode = "local"; // "server" | "local"


// ==============================
// HELPERS
// ==============================

const $ = (id) => document.getElementById(id);

function showSection(sectionId) {
    const section = $(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: "smooth" });
    }
}

function escapeHTML(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

function hashString(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = (h * 31 + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
}

let toastTimer;
function toast(message) {
    const el = $("toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
}

function animateNumber(el, to, duration = 900) {
    const from = parseInt(el.textContent, 10) || 0;
    const start = performance.now();

    function step(now) {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(from + (to - from) * eased);
        if (t < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
}

function formatDate(value) {
    // Server returns "YYYY-MM-DD HH:MM:SS" (UTC); local fallback stores ISO
    const iso = value.includes("T") ? value : value.replace(" ", "T") + "Z";
    const d = new Date(iso);
    if (isNaN(d)) return "";
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function scoreClass(score) {
    if (score >= 65) return "";
    if (score >= 50) return "mid";
    return "low";
}


// ==============================
// PROTOTYPE ANALYSIS ENGINE
// Simple heuristic scoring for demo purposes.
// Replace analyzeIdea() with a real AI/API call later.
// ==============================

const PROBLEM_WORDS = ["problem", "struggle", "difficult", "hard", "waste", "expensive", "costly", "slow", "manual", "lack", "pain", "time", "stress", "confus", "unsafe", "miss"];
const MARKET_WORDS = ["students", "business", "businesses", "startups", "customers", "users", "people", "families", "farmers", "patients", "teachers", "shops", "companies", "everyone", "market"];
const UNIQUE_WORDS = ["ai", "smart", "personalized", "automated", "predict", "real-time", "unique", "first", "new", "innovative", "platform", "app", "data"];

function countHits(text, words) {
    const lower = text.toLowerCase();
    return words.filter((w) => lower.includes(w)).length;
}

function analyzeIdea(name, description, customer) {
    const full = `${name} ${description} ${customer}`;
    const wordCount = description.split(/\s+/).filter(Boolean).length;
    const jitter = (seed, range) => (hashString(name + seed) % (range * 2 + 1)) - range;

    const problem = clamp(
        52 + countHits(description, PROBLEM_WORDS) * 6 + Math.min(wordCount, 40) * 0.4 + jitter("p", 4),
        35, 96
    );

    const market = clamp(
        50 + countHits(full, MARKET_WORDS) * 6 + (customer.split(/\s+/).length >= 2 ? 8 : 0) + jitter("m", 5),
        35, 95
    );

    const uniqueness = clamp(
        48 + countHits(full, UNIQUE_WORDS) * 5 + Math.min(new Set(description.toLowerCase().split(/\s+/)).size, 40) * 0.3 + jitter("u", 6),
        35, 95
    );

    const competition = clamp(
        55 + Math.min(wordCount, 50) * 0.3 + jitter("c", 10),
        35, 92
    );

    const score = Math.round(
        problem * 0.3 + market * 0.25 + uniqueness * 0.25 + competition * 0.2
    );

    return {
        score,
        problem: Math.round(problem),
        market: Math.round(market),
        uniqueness: Math.round(uniqueness),
        competition: Math.round(competition),
        verdict: verdictFor(score)
    };
}

function verdictFor(score) {
    if (score >= 80) return "Strong Idea";
    if (score >= 65) return "Promising Idea";
    if (score >= 50) return "Needs Refinement";
    return "High Risk";
}

const VERDICT_TEXT = {
    "Strong Idea": "Excellent signals across the board. Move fast on customer interviews and plan a lean MVP.",
    "Promising Idea": "Your idea shows good potential. Customer validation should be completed before MVP development.",
    "Needs Refinement": "There is something here, but the problem or audience needs to be sharper before you build.",
    "High Risk": "Too many open questions right now. Revisit the problem and target customer before investing time."
};

function recommendationFor(r) {
    const weakest = ["problem", "market", "uniqueness", "competition"]
        .sort((a, b) => r[a] - r[b])[0];

    const map = {
        problem: [
            "Prove the problem is real and painful.",
            "Talk to at least 5 people who face this problem and ask how they solve it today and what it costs them."
        ],
        market: [
            "Define and size your target market.",
            "Narrow down exactly who your first customers are and estimate how many of them you can realistically reach."
        ],
        uniqueness: [
            "Sharpen what makes your idea different.",
            "List what existing solutions do, then write one sentence on why people would switch to yours."
        ],
        competition: [
            "Study your competitors closely.",
            "Identify 3 existing alternatives, compare their strengths and weaknesses, and find the gap you can own."
        ]
    };

    return map[weakest];
}


// ==============================
// RENDER RESULT TO DASHBOARD
// ==============================

function setBar(key, value) {
    const val = $(`m-${key}-val`);
    const bar = $(`m-${key}-bar`);
    if (val) val.textContent = value + "%";
    if (bar) bar.style.width = value + "%";
}

function renderResult(idea) {
    // idea: { name, target_customer, score, problem, market, uniqueness, competition, verdict }

    $("analysisMessage").innerHTML =
        `Analysis for <strong>${escapeHTML(idea.name)}</strong>
         targeting <strong>${escapeHTML(idea.target_customer)}</strong>.`;

    animateNumber($("overallScore"), idea.score);

    $("verdictText").textContent = idea.verdict;
    $("verdictDesc").textContent = VERDICT_TEXT[idea.verdict] || VERDICT_TEXT["Promising Idea"];

    const status = $("scoreStatus");
    status.classList.remove("mid", "low");
    const cls = scoreClass(idea.score);
    if (cls) status.classList.add(cls);

    $("confidence").textContent = (85 + (hashString(idea.name) % 11)) + "%";

    setBar("problem", idea.problem);
    setBar("market", idea.market);
    setBar("uniqueness", idea.uniqueness);
    setBar("competition", idea.competition);

    const [title, text] = recommendationFor(idea);
    $("recTitle").textContent = title;
    $("recText").textContent = text;

    // Hero card mirrors the latest analysis
    const ring = document.querySelector(".score-ring");
    if (ring) ring.style.setProperty("--score", idea.score);

    const heroScore = document.querySelector(".score-inner strong");
    if (heroScore) animateNumber(heroScore, idea.score);

    const heroVerdict = document.querySelector(".score-text h3");
    if (heroVerdict) heroVerdict.textContent = idea.verdict;

    const miniValues = document.querySelectorAll(".mini-stat");
    [idea.market, idea.problem, idea.uniqueness].forEach((v, i) => {
        const card = miniValues[i];
        if (!card) return;
        const strong = card.querySelector("strong");
        strong.firstChild.nodeValue = (v / 10).toFixed(1).replace(".0", "");
        card.querySelector(".mini-bar i").style.width = v + "%";
    });
}


// ==============================
// STORAGE LAYER (server DB + localStorage fallback)
// ==============================

async function checkServer() {
    try {
        const res = await fetch("/api/health", { cache: "no-store" });
        if (!res.ok) throw new Error("bad status");
        const data = await res.json();
        dbMode = data.ok ? "server" : "local";
    } catch (err) {
        dbMode = "local";
    }

    const badge = $("dbBadge");
    const label = $("dbBadgeText");
    badge.classList.remove("online", "offline");

    if (dbMode === "server") {
        badge.classList.add("online");
        label.textContent = "Connected to SQLite database";
    } else {
        badge.classList.add("offline");
        label.textContent = "Offline mode — saved in this browser only";
    }
}

function readLocal() {
    try {
        return JSON.parse(localStorage.getItem(LOCAL_KEY)) || [];
    } catch (err) {
        return [];
    }
}

function writeLocal(list) {
    try {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
    } catch (err) {
        /* storage unavailable — ignore */
    }
}

async function loadIdeas() {
    if (dbMode === "server") {
        try {
            const res = await fetch(API);
            if (!res.ok) throw new Error("load failed");
            return await res.json();
        } catch (err) {
            dbMode = "local";
        }
    }
    return readLocal();
}

async function saveIdea(payload) {
    if (dbMode === "server") {
        try {
            const res = await fetch(API, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error("save failed");
            return await res.json();
        } catch (err) {
            dbMode = "local";
            toast("Server unreachable — saved locally instead");
        }
    }

    const record = {
        ...payload,
        id: Date.now(),
        created_at: new Date().toISOString()
    };
    const list = readLocal();
    list.unshift(record);
    writeLocal(list.slice(0, 100));
    return record;
}

async function removeIdea(id) {
    if (dbMode === "server") {
        try {
            const res = await fetch(`${API}/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("delete failed");
            return;
        } catch (err) {
            dbMode = "local";
        }
    }
    writeLocal(readLocal().filter((i) => String(i.id) !== String(id)));
}


// ==============================
// SAVED IDEAS UI
// ==============================

let currentIdeas = [];

async function refreshHistory() {
    currentIdeas = await loadIdeas();
    renderHistory(currentIdeas);
}

function renderHistory(ideas) {
    const grid = $("historyGrid");

    $("statCount").textContent = ideas.length;

    if (ideas.length === 0) {
        $("statAvg").textContent = "–";
        $("statBest").textContent = "–";
        grid.innerHTML =
            `<div class="empty-state">
                No ideas saved yet. Run an analysis above and it will appear here.
            </div>`;
        return;
    }

    const scores = ideas.map((i) => i.score);
    $("statAvg").textContent = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    $("statBest").textContent = Math.max(...scores);

    grid.innerHTML = ideas.map((idea) => `
        <article class="history-card" data-id="${idea.id}">
            <div class="history-top">
                <h4>${escapeHTML(idea.name)}</h4>
                <span class="history-score ${scoreClass(idea.score)}">${idea.score}</span>
            </div>
            <p>${escapeHTML(idea.description)}</p>
            <div class="history-meta">
                <span>${escapeHTML(idea.target_customer)} · ${formatDate(idea.created_at)}</span>
                <span class="history-actions">
                    <button type="button" data-action="view">View</button>
                    <button type="button" class="del" data-action="delete">Delete</button>
                </span>
            </div>
        </article>
    `).join("");
}

$("historyGrid").addEventListener("click", async (event) => {
    const btn = event.target.closest("button[data-action]");
    if (!btn) return;

    const card = btn.closest(".history-card");
    const id = card.dataset.id;
    const idea = currentIdeas.find((i) => String(i.id) === id);

    if (btn.dataset.action === "view" && idea) {
        renderResult(idea);
        showSection("dashboard");
    }

    if (btn.dataset.action === "delete") {
        await removeIdea(id);
        await refreshHistory();
        toast("Idea deleted");
    }
});


// ==============================
// IDEA FORM
// ==============================

$("ideaForm").addEventListener("submit", async function (event) {
    event.preventDefault();

    const name = $("ideaName").value.trim();
    const description = $("ideaDescription").value.trim();
    const customer = $("targetCustomer").value.trim();

    const status = $("formStatus");
    status.className = "form-status";

    if (!name || !description || !customer) {
        status.textContent = "Please complete all fields.";
        status.classList.add("error");
        return;
    }

    if (description.split(/\s+/).length < 5) {
        status.textContent = "Add a bit more detail — at least a full sentence.";
        status.classList.add("error");
        return;
    }

    const btn = $("analyzeBtn");
    const label = btn.querySelector("span");
    btn.disabled = true;
    label.textContent = "Analyzing…";
    status.textContent = "";

    // Short delay so the "analysis" feels intentional
    await new Promise((r) => setTimeout(r, 900));

    const result = analyzeIdea(name, description, customer);

    const saved = await saveIdea({
        name,
        description,
        target_customer: customer,
        ...result
    });

    renderResult(saved);
    await refreshHistory();

    btn.disabled = false;
    label.textContent = "Run AI Analysis";
    status.textContent =
        dbMode === "server" ? "Saved to database ✓" : "Saved in this browser ✓";
    status.classList.add("ok");

    $("ideaForm").reset();
    showSection("dashboard");
    toast(`${saved.verdict} — score ${saved.score}/100`);
});


// ==============================
// CHECKLIST (persists in browser)
// ==============================

const checkboxes = document.querySelectorAll('.task-card input[type="checkbox"]');

function updateProgress() {
    const done = [...checkboxes].filter((c) => c.checked).length;
    const pct = Math.round(25 + (done / checkboxes.length) * 75);

    $("progressPct").textContent = pct + "%";
    $("progressPct2").textContent = pct + "%";
    $("progressBar").style.width = pct + "%";
    $("progressText").textContent =
        `${done} of ${checkboxes.length} tasks done · Week 1 complete`;
}

function saveTasks() {
    try {
        localStorage.setItem(
            TASKS_KEY,
            JSON.stringify([...checkboxes].map((c) => c.checked))
        );
    } catch (err) { /* ignore */ }
}

(function restoreTasks() {
    let saved = [];
    try {
        saved = JSON.parse(localStorage.getItem(TASKS_KEY)) || [];
    } catch (err) { /* ignore */ }

    checkboxes.forEach((c, i) => {
        c.checked = !!saved[i];
        c.parentElement.classList.toggle("done", c.checked);
    });
    updateProgress();
})();

checkboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", function () {
        this.parentElement.classList.toggle("done", this.checked);
        updateProgress();
        saveTasks();
    });
});


// ==============================
// VISUAL POLISH
// ==============================

// Reveal on scroll
(function setupReveal() {
    const targets = document.querySelectorAll(
        ".section-heading, .feature-card, .glass-panel, .analysis-preview, " +
        ".recommendation, .roadmap-item, .history-toolbar, .cta-section"
    );

    if (!("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("visible");
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12 });

    targets.forEach((el, i) => {
        el.classList.add("reveal");
        el.style.transitionDelay = (i % 4) * 70 + "ms";
        observer.observe(el);
    });
})();

// Cursor glow on feature cards
document.querySelectorAll(".feature-card").forEach((card) => {
    card.addEventListener("mousemove", (e) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty("--mx", e.clientX - rect.left + "px");
        card.style.setProperty("--my", e.clientY - rect.top + "px");
    });
});


// ==============================
// PAGE LOAD
// ==============================

document.addEventListener("DOMContentLoaded", async function () {
    await checkServer();
    await refreshHistory();
});
