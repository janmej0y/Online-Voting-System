let API_BASE =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000/api"
    : "https://ezeevote.onrender.com/api";
let API_ORIGIN = API_BASE.replace(/\/api$/, "");

function setApiBase(base) {
  API_BASE = base;
  API_ORIGIN = API_BASE.replace(/\/api$/, "");
}

async function resolveLocalApiBase() {
  const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  if (!isLocal) return;

  const candidates = [
    "http://localhost:5000/api",
    "http://127.0.0.1:5000/api",
    "http://localhost:5001/api",
    "http://127.0.0.1:5001/api",
    "http://localhost:5002/api",
    "http://127.0.0.1:5002/api"
  ];

  for (const base of candidates) {
    try {
      const res = await fetch(`${base}/notifications/current`, { method: "GET" });
      if (res.ok) {
        setApiBase(base);
        return;
      }
    } catch {
      // Try the next local candidate endpoint.
    }
  }
}

const state = {
  token: localStorage.getItem("token") || null,
  user: null,
  elections: [],
  currentElectionId: null,
  currentCandidates: [],
  currentResults: [],
  hasVoted: false,
  modalCandidate: null,
  countdownTimer: null,
  charts: { results: null, adminActivity: null },
  profile: {
    cameraStream: null,
    capturedPhotoBlob: null,
    capturedPhotoUrl: null
  },
  admin: {
    electionsPage: 1,
    candidatesPage: 1,
    electionsTotal: 1,
    candidatesTotal: 1,
    candidatesCache: [],
    selectedElectionIds: []
  },
  watchlist: JSON.parse(localStorage.getItem("watchlist") || "[]"),
  spotlightIndex: 0,
  storyStage: "early",
  notifications: []
};
const THEME_KEY = "ezeevote-theme";
const THEME_PRESET_KEY = "ezeevote-theme-preset";
let adminElectionSearchTimer = null;
let adminCandidateSearchTimer = null;

function qs(id) {
  return document.getElementById(id);
}

function toImage(path) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith("/")) return `${API_ORIGIN}${path}`;
  return `${API_ORIGIN}/images/${path}`;
}

function fallbackAvatar(name) {
  const safe = String(name || "Candidate").trim();
  const initials = safe
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase();
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop stop-color='%230ea5e9'/><stop offset='1' stop-color='%2322c55e'/></linearGradient></defs><rect width='100%' height='100%' rx='24' fill='url(%23g)'/><text x='50%' y='55%' dominant-baseline='middle' text-anchor='middle' font-family='Segoe UI,Arial,sans-serif' font-size='88' fill='white'>${initials || "C"}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function candidateImage(candidate) {
  return candidate && candidate.image ? toImage(candidate.image) : fallbackAvatar(candidate ? candidate.name : "Candidate");
}

function summarizeBio(text) {
  const source = String(text || "").trim();
  if (!source) return "Detailed profile available. Click Details to learn more.";
  return source.length > 110 ? `${source.slice(0, 107)}...` : source;
}

function normalizeText(value) {
  return String(value || "").toLowerCase().trim();
}

function showToast(message) {
  const el = qs("toast");
  if (!el) return alert(message);
  el.textContent = message;
  el.style.display = "block";
  setTimeout(() => {
    el.style.display = "none";
  }, 2600);
}

function applyTheme(theme) {
  document.body.classList.toggle("light", theme === "light");
  document.body.classList.toggle("contrast", theme === "contrast");
  const btn = qs("theme-toggle");
  if (btn) btn.textContent = theme === "dark" ? "Light Theme" : "Dark Theme";
  const preset = qs("theme-preset");
  if (preset) preset.value = theme;
}

function initTheme() {
  const saved = localStorage.getItem(THEME_PRESET_KEY) || localStorage.getItem(THEME_KEY) || "dark";
  applyTheme(saved);
}

function toggleTheme() {
  const current = document.body.classList.contains("contrast")
    ? "contrast"
    : document.body.classList.contains("light")
      ? "light"
      : "dark";
  const next = current === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  localStorage.setItem(THEME_PRESET_KEY, next);
  applyTheme(next);
}

function setThemePreset(theme) {
  localStorage.setItem(THEME_PRESET_KEY, theme);
  applyTheme(theme);
}

function currentThemeMode() {
  if (document.body.classList.contains("contrast")) return "contrast";
  if (document.body.classList.contains("light")) return "light";
  return "dark";
}

async function downloadResultsCsv(electionId) {
  const res = await api(`/admin/elections/${electionId}/results.csv`, {}, true, true);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Export failed");
  }
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = `results_election_${electionId}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}
function authHeaders() {
  return state.token ? { Authorization: `Bearer ${state.token}` } : {};
}

async function api(path, options = {}, auth = false, raw = false) {
  const headers = {
    ...(raw ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {}),
    ...(auth ? authHeaders() : {})
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (raw) return res;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

async function apiMultipart(path, formData, auth = false) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    body: formData,
    headers: auth ? authHeaders() : {}
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function toDateInput(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function computeProfileProgress(user) {
  const checks = [
    user && user.phone,
    user && user.date_of_birth,
    user && user.address_line1,
    user && user.city,
    user && user.state_name,
    user && user.postal_code,
    user && user.voter_card_number,
    user && user.aadhaar_number,
    user && user.verification_photo
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

function saveWatchlist() {
  localStorage.setItem("watchlist", JSON.stringify(state.watchlist));
}

function toggleWatchlist(candidateId) {
  const id = Number(candidateId);
  const idx = state.watchlist.indexOf(id);
  if (idx >= 0) state.watchlist.splice(idx, 1);
  else state.watchlist.push(id);
  saveWatchlist();
  renderWatchlist();
}

function renderWatchlist() {
  const root = qs("watchlist-list");
  if (!root) return;
  root.innerHTML = "";
  const selected = state.currentCandidates.filter((c) => state.watchlist.includes(Number(c.id)));
  if (!selected.length) {
    root.innerHTML = '<div class="simple-item muted">No saved candidates yet.</div>';
    return;
  }
  selected.forEach((c) => {
    const node = document.createElement("div");
    node.className = "simple-item";
    node.innerHTML = `<strong>${c.name}</strong><div class="muted">${c.party} | ${c.symbol || "Civic Emblem"}</div>`;
    root.appendChild(node);
  });
}

function lifecyclePhases(election) {
  const now = Date.now();
  const starts = election && election.starts_at ? new Date(election.starts_at).getTime() : null;
  const ends = election && election.ends_at ? new Date(election.ends_at).getTime() : null;
  return [
    { key: "nomination", label: "Nomination", done: Boolean(starts && now > starts - 7 * 24 * 3600 * 1000) },
    { key: "campaign", label: "Campaign", done: Boolean(starts && now >= starts - 2 * 24 * 3600 * 1000) },
    { key: "voting", label: "Voting", done: Boolean(starts && now >= starts) && !(ends && now > ends) },
    { key: "counting", label: "Counting", done: Boolean(ends && now > ends) },
    { key: "declared", label: "Declared", done: election && election.status === "closed" }
  ];
}

function renderLifecycle(election) {
  const root = qs("lifecycle-steps");
  if (!root) return;
  root.innerHTML = "";
  lifecyclePhases(election).forEach((phase) => {
    const node = document.createElement("span");
    node.className = `phase-chip ${phase.done ? "done" : ""}`;
    node.textContent = phase.label;
    root.appendChild(node);
  });
}

function renderSpotlight() {
  const root = qs("spotlight-content");
  if (!root) return;
  if (!state.currentCandidates.length) {
    root.innerHTML = '<div class="simple-item muted">No spotlight candidates available.</div>';
    return;
  }
  state.spotlightIndex = ((state.spotlightIndex % state.currentCandidates.length) + state.currentCandidates.length) % state.currentCandidates.length;
  const c = state.currentCandidates[state.spotlightIndex];
  root.innerHTML = `
    <div class="spotlight-inner">
      <img src="${candidateImage(c)}" alt="${c.name}" />
      <div>
        <h4>${c.name}</h4>
        <p class="muted">${c.party} | Symbol: ${c.symbol || "Civic Emblem"}</p>
        <p>${summarizeBio(c.bio)}</p>
        <div class="inline">
          <button id="spotlight-details" class="btn ghost">Details</button>
          <button id="spotlight-watch" class="btn ghost">${state.watchlist.includes(Number(c.id)) ? "Unsave" : "Save"}</button>
        </div>
      </div>
    </div>
  `;
  qs("spotlight-details").addEventListener("click", () => openCandidateModal(c));
  qs("spotlight-watch").addEventListener("click", () => {
    toggleWatchlist(c.id);
    renderSpotlight();
  });
}

function populateCompareSelectors() {
  const a = qs("compare-a");
  const b = qs("compare-b");
  if (!a || !b) return;
  a.innerHTML = "";
  b.innerHTML = "";
  state.currentCandidates.forEach((c) => {
    const oa = document.createElement("option");
    oa.value = String(c.id);
    oa.textContent = c.name;
    a.appendChild(oa);
    const ob = document.createElement("option");
    ob.value = String(c.id);
    ob.textContent = c.name;
    b.appendChild(ob);
  });
  if (state.currentCandidates[1]) b.value = String(state.currentCandidates[1].id);
}

function renderComparison() {
  const aId = Number(qs("compare-a").value);
  const bId = Number(qs("compare-b").value);
  const left = state.currentCandidates.find((c) => Number(c.id) === aId);
  const right = state.currentCandidates.find((c) => Number(c.id) === bId);
  const out = qs("compare-output");
  if (!left || !right) {
    out.innerHTML = '<div class="simple-item muted">Select two candidates to compare.</div>';
    return;
  }
  out.innerHTML = `
    <div class="compare-grid">
      <article class="compare-col">
        <h4>${left.name}</h4>
        <p class="muted">${left.party} | ${left.symbol || "Civic Emblem"}</p>
        <p>${left.bio || "No bio available."}</p>
      </article>
      <article class="compare-col">
        <h4>${right.name}</h4>
        <p class="muted">${right.party} | ${right.symbol || "Civic Emblem"}</p>
        <p>${right.bio || "No bio available."}</p>
      </article>
    </div>
  `;
}

function qaForCandidates(term) {
  const q = String(term || "").trim().toLowerCase();
  const topics = [
    { key: "economy", text: "What is the plan for jobs and economic growth?" },
    { key: "education", text: "How will education quality and access be improved?" },
    { key: "health", text: "What is the healthcare strategy?" },
    { key: "infrastructure", text: "What are the core infrastructure priorities?" }
  ];
  return state.currentCandidates.map((c) => {
    const matched = topics.filter((t) => !q || t.key.includes(q) || t.text.toLowerCase().includes(q));
    return { candidate: c, questions: matched };
  }).filter((x) => x.questions.length > 0);
}

function renderQaResults(term = "") {
  const root = qs("qa-results");
  if (!root) return;
  const rows = qaForCandidates(term);
  root.innerHTML = "";
  if (!rows.length) {
    root.innerHTML = '<div class="simple-item muted">No Q&A topics matched.</div>';
    return;
  }
  rows.forEach((row) => {
    const node = document.createElement("div");
    node.className = "simple-item";
    node.innerHTML = `<strong>${row.candidate.name}</strong><div>${row.questions.map((q) => `• ${q.text}`).join("<br/>")}</div>`;
    root.appendChild(node);
  });
}

function buildNotifications() {
  const notes = [];
  if (state.user && !state.user.profileComplete) notes.push("Profile verification pending. Required only for casting vote.");
  const active = state.elections.find((e) => e.status === "active" && Number(e.is_archived) === 0);
  if (active) notes.push(`Active election: ${active.title}`);
  if (state.currentResults.length) {
    const leader = [...state.currentResults].sort((a, b) => Number(b.vote_count) - Number(a.vote_count))[0];
    if (leader) notes.push(`Current leader: ${leader.name} (${leader.vote_count} votes)`);
  }
  state.notifications = notes;
}

function renderNotificationsPanel() {
  const panel = qs("notifications-panel");
  if (!panel) return;
  buildNotifications();
  panel.innerHTML = `<h4>Notifications</h4>${
    state.notifications.length
      ? state.notifications.map((n) => `<div class="simple-item">${n}</div>`).join("")
      : '<div class="simple-item muted">No notifications right now.</div>'
  }`;
}

function toggleNotificationsPanel() {
  const panel = qs("notifications-panel");
  if (!panel) return;
  const open = panel.style.display === "block";
  if (open) {
    panel.style.display = "none";
    return;
  }
  renderNotificationsPanel();
  panel.style.display = "block";
}

function applyStoryStage(rows) {
  const stage = state.storyStage;
  const factor = stage === "early" ? 0.35 : stage === "mid" ? 0.7 : 1;
  const label = stage === "early" ? "Early Trends (35%)" : stage === "mid" ? "Mid Count (70%)" : "Final Count (100%)";
  qs("story-label").textContent = label;
  return rows.map((r) => ({ ...r, story_votes: Math.round((Number(r.vote_count) || 0) * factor) }));
}

function renderBoothMap(rows) {
  const root = qs("booth-map");
  if (!root) return;
  const pools = ["North", "South", "East", "West", "Central"];
  const total = rows.reduce((s, r) => s + (Number(r.story_votes) || 0), 0) || 1;
  root.innerHTML = pools
    .map((zone, i) => {
      const leader = rows[i % rows.length];
      const turnout = Math.min(98, Math.round((Number(leader.story_votes) / total) * 100 + 45));
      return `<div class="booth-item"><strong>${zone} Booth Cluster</strong><div class="muted">Lead: ${leader.name}</div><div class="muted">Turnout: ${turnout}%</div></div>`;
    })
    .join("");
}

function renderJourneyTimeline(history) {
  const root = qs("journey-timeline");
  if (!root || !state.user) return;
  const steps = [
    { label: "Signed In", done: true },
    { label: "Profile Verification", done: Boolean(state.user.profileComplete) },
    { label: "Cast Vote", done: Boolean(history && history.length) },
    { label: "Receipt Generated", done: Boolean(history && history.length) }
  ];
  root.innerHTML = steps
    .map((s) => `<div class="journey-step ${s.done ? "done" : ""}"><span>${s.done ? "✓" : "•"}</span>${s.label}</div>`)
    .join("");
}

function printHistoryReceipt(entry) {
  const receiptRef = entry.receipt || `EV-${entry.election_id || "0000"}-${entry.vote_id || "00000000"}`;
  const issuedAt = formatDateTime(new Date().toISOString());
  const html = `
    <html>
      <head>
        <title>EzeeVote - Voting Receipt</title>
        <meta charset="utf-8" />
        <style>
          :root {
            --brand-a: #0ea5e9;
            --brand-b: #22c55e;
            --ink: #0f172a;
            --muted: #475569;
            --line: #dbeafe;
            --paper: #f8fbff;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: "Segoe UI", Arial, sans-serif;
            background: var(--paper);
            color: var(--ink);
            padding: 22px;
          }
          .sheet {
            max-width: 820px;
            margin: 0 auto;
            border: 1px solid var(--line);
            border-radius: 16px;
            overflow: hidden;
            background: #fff;
          }
          .head {
            padding: 18px 22px;
            background: linear-gradient(120deg, rgba(14,165,233,0.18), rgba(34,197,94,0.14));
            border-bottom: 1px solid var(--line);
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 16px;
          }
          .brand {
            font-size: 1.4rem;
            font-weight: 800;
            letter-spacing: 0.02em;
          }
          .sub {
            margin-top: 4px;
            color: var(--muted);
            font-size: 0.93rem;
          }
          .badge {
            border: 1px solid rgba(14,165,233,0.35);
            background: rgba(14,165,233,0.12);
            padding: 8px 12px;
            border-radius: 999px;
            font-weight: 700;
            color: #0369a1;
            white-space: nowrap;
          }
          .body {
            padding: 20px 22px 14px;
            display: grid;
            gap: 14px;
          }
          .card {
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 14px;
            background: #fff;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px 16px;
          }
          .k {
            color: var(--muted);
            font-size: 0.83rem;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            margin-bottom: 4px;
          }
          .v {
            font-weight: 600;
          }
          .footer {
            margin: 14px 22px 20px;
            border-top: 1px dashed #cbd5e1;
            padding-top: 10px;
            color: #64748b;
            font-size: 0.86rem;
          }
          @media print {
            body {
              background: #fff;
              padding: 0;
            }
            .sheet {
              border: none;
              border-radius: 0;
            }
          }
        </style>
      </head>
      <body>
        <main class="sheet">
          <header class="head">
            <div>
              <div class="brand">EzeeVote</div>
              <div class="sub">Digital Voting Receipt • Official Acknowledgement</div>
            </div>
            <div class="badge">Receipt ID: ${receiptRef}</div>
          </header>

          <section class="body">
            <article class="card grid">
              <div>
                <div class="k">Election</div>
                <div class="v">${entry.election_title || "-"}</div>
              </div>
              <div>
                <div class="k">Candidate Selected</div>
                <div class="v">${entry.candidate_name || "-"} (${entry.candidate_party || "-"})</div>
              </div>
              <div>
                <div class="k">Vote Timestamp</div>
                <div class="v">${formatDateTime(entry.voted_at)}</div>
              </div>
              <div>
                <div class="k">Issued At</div>
                <div class="v">${issuedAt}</div>
              </div>
            </article>
            <article class="card">
              <div class="k">Verification Note</div>
              <div class="v">This receipt confirms that a vote action was recorded under your authenticated session.</div>
            </article>
          </section>

          <footer class="footer">
            Support: janmejoymahato529@gmail.com • Platform: EzeeVote Private Systems
          </footer>
        </main>
      </body>
    </html>`;
  const w = window.open("", "_blank", "width=640,height=720");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}

async function runQuickCommand() {
  const input = qs("command-input");
  const value = normalizeText(input.value);
  if (!value) return;

  try {
    if (value.includes("result")) {
      switchView("results-view");
      await loadResults();
    } else if (value.includes("profile")) {
      switchView("profile-view");
    } else if (value.includes("history")) {
      switchView("history-view");
      await loadHistory();
    } else if (value.includes("admin")) {
      switchView("admin-view");
      await loadAdminStudio();
    } else if (value.includes("dashboard")) {
      switchView("dashboard-view");
      await loadDashboard();
    } else if (value.includes("compare")) {
      switchView("dashboard-view");
      await loadDashboard();
      qs("compare-run-btn").click();
    } else {
      const electionHit = state.elections.find((e) => normalizeText(e.title).includes(value));
      if (electionHit) {
        state.currentElectionId = Number(electionHit.id);
        const switcher = qs("election-switcher");
        if (switcher) switcher.value = String(electionHit.id);
        switchView("dashboard-view");
        await loadDashboard();
        await loadResults();
        input.value = "";
        showToast(`Opened election: ${electionHit.title}`);
        if (isMobileLayout()) closeMobileMenu();
        return;
      }

      let pool = state.currentCandidates;
      if (!pool.length) {
        const data = await api("/candidates");
        pool = data.candidates || [];
      }
      const candidateHit = pool.find((c) =>
        [c.name, c.party, c.symbol, c.bio].some((field) => normalizeText(field).includes(value))
      );
      if (candidateHit) {
        switchView("dashboard-view");
        await loadDashboard();
        openCandidateModal(candidateHit);
        input.value = "";
        showToast(`Found candidate: ${candidateHit.name}`);
        if (isMobileLayout()) closeMobileMenu();
        return;
      }

      renderQaResults(value);
      switchView("dashboard-view");
      showToast("Search results updated in Candidate Q&A section.");
    }
  } catch (error) {
    showToast(error.message || "Search failed");
  }

  input.value = "";
  if (isMobileLayout()) closeMobileMenu();
}

function isMobileLayout() {
  return window.matchMedia("(max-width: 980px)").matches;
}

function openMobileMenu() {
  if (!isMobileLayout()) return;
  document.body.classList.add("menu-open");
  qs("mobile-backdrop").style.display = "block";
  qs("mobile-menu-btn").textContent = "Close";
  qs("mobile-menu-btn").setAttribute("aria-expanded", "true");
}

function closeMobileMenu() {
  document.body.classList.remove("menu-open");
  qs("mobile-backdrop").style.display = "none";
  qs("mobile-menu-btn").textContent = "Menu";
  qs("mobile-menu-btn").setAttribute("aria-expanded", "false");
}

function toggleMobileMenu() {
  if (document.body.classList.contains("menu-open")) closeMobileMenu();
  else openMobileMenu();
}

function setToken(token) {
  state.token = token || null;
  if (token) localStorage.setItem("token", token);
  else localStorage.removeItem("token");
}

function switchView(viewId) {
  ["login-view", "profile-view", "dashboard-view", "results-view", "history-view", "admin-view"].forEach((id) => {
    const el = qs(id);
    if (el) el.style.display = id === viewId ? "block" : "none";
  });
  const loginMode = viewId === "login-view";
  document.body.classList.toggle("login-hero-mode", loginMode);
  if (loginMode && isMobileLayout()) {
    qs("theme-toggle").textContent = "☾";
  } else {
    applyTheme(currentThemeMode());
  }
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === viewId);
  });
  const panel = qs("notifications-panel");
  if (panel) panel.style.display = "none";
}

function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

function toLocalDateInput(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isoFromLocal(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function isInvalidDateRange(startIso, endIso) {
  if (!startIso || !endIso) return false;
  return new Date(endIso).getTime() < new Date(startIso).getTime();
}

function renderCountdown(election) {
  const node = qs("stat-countdown");
  if (!node) return;
  if (state.countdownTimer) clearInterval(state.countdownTimer);

  const tick = () => {
    if (!election) {
      node.textContent = "-";
      return;
    }

    const now = Date.now();
    const starts = election.starts_at ? new Date(election.starts_at).getTime() : null;
    const ends = election.ends_at ? new Date(election.ends_at).getTime() : null;

    let target = null;
    let label = "";

    if (starts && now < starts) {
      target = starts;
      label = "Starts in ";
    } else if (ends && now < ends) {
      target = ends;
      label = "Ends in ";
    }

    if (!target) {
      node.textContent = "No timer";
      return;
    }

    const diff = Math.max(0, target - now);
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    node.textContent = `${label}${h}h ${m}m ${s}s`;
  };

  tick();
  state.countdownTimer = setInterval(tick, 1000);
}

function renderBroadcast(broadcast) {
  const banner = qs("broadcast-banner");
  if (!banner) return;
  if (!broadcast) {
    banner.style.display = "none";
    banner.textContent = "";
    return;
  }
  banner.style.display = "block";
  banner.textContent = `Announcement: ${broadcast.message}`;
}

async function loadBroadcast() {
  try {
    const data = await api("/notifications/current");
    renderBroadcast(data.broadcast);
  } catch {
    renderBroadcast(null);
  }
}

function updateProfileStatusUi() {
  const pill = qs("profile-status-pill");
  if (!pill || !state.user) return;
  const done = Boolean(state.user.profileComplete);
  pill.textContent = done ? "Verified" : "Pending";
  pill.style.color = done ? "#22c55e" : "#f59e0b";
  pill.style.borderColor = done ? "rgba(34,197,94,0.55)" : "rgba(245,158,11,0.6)";
  pill.style.background = done ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.15)";
}

function updateProfileProgressUi() {
  const node = qs("profile-progress");
  if (!node) return;
  const pct = computeProfileProgress(state.user);
  node.textContent = `Profile completion: ${pct}%`;
}

function setNavLockState() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.remove("locked");
  });
}

function fillProfileForm() {
  if (!state.user) return;
  qs("profile-full-name").value = state.user.name || "";
  qs("profile-phone").value = state.user.phone || "";
  qs("profile-dob").value = toDateInput(state.user.date_of_birth);
  qs("profile-gender").value = state.user.gender || "";
  qs("profile-address").value = state.user.address_line1 || "";
  qs("profile-city").value = state.user.city || "";
  qs("profile-state").value = state.user.state_name || "";
  qs("profile-postal").value = state.user.postal_code || "";
  qs("profile-voter-card").value = state.user.voter_card_number || "";
  qs("profile-aadhaar").value = state.user.aadhaar_number || "";

  const preview = qs("profile-preview");
  const note = qs("profile-photo-note");
  if (state.profile.capturedPhotoUrl) {
    preview.src = state.profile.capturedPhotoUrl;
    preview.style.display = "block";
    note.textContent = "Captured photo ready for submission.";
  } else if (state.user.verification_photo) {
    preview.src = toImage(state.user.verification_photo);
    preview.style.display = "block";
    note.textContent = "Existing verification photo found.";
  } else {
    preview.style.display = "none";
    note.textContent = "No photo captured yet.";
  }

  updateProfileStatusUi();
  updateProfileProgressUi();
  setNavLockState();
}

function stopProfileCamera() {
  if (!state.profile.cameraStream) return;
  state.profile.cameraStream.getTracks().forEach((t) => t.stop());
  state.profile.cameraStream = null;
  const video = qs("profile-camera");
  if (video) video.srcObject = null;
}

async function startProfileCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("Camera access is not supported on this browser");
  }
  stopProfileCamera();
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
  state.profile.cameraStream = stream;
  const video = qs("profile-camera");
  video.srcObject = stream;
  await video.play();
}

async function captureProfilePhoto() {
  const video = qs("profile-camera");
  const canvas = qs("profile-canvas");
  if (!video || !canvas || !video.videoWidth) throw new Error("Start camera before capture");

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  if (!blob) throw new Error("Unable to capture photo");

  if (state.profile.capturedPhotoUrl) URL.revokeObjectURL(state.profile.capturedPhotoUrl);
  state.profile.capturedPhotoBlob = blob;
  state.profile.capturedPhotoUrl = URL.createObjectURL(blob);
  fillProfileForm();
}

function clearCapturedPhoto() {
  if (state.profile.capturedPhotoUrl) URL.revokeObjectURL(state.profile.capturedPhotoUrl);
  state.profile.capturedPhotoUrl = null;
  state.profile.capturedPhotoBlob = null;
  fillProfileForm();
}

async function submitProfileVerification(ev) {
  ev.preventDefault();
  const formData = new FormData();
  formData.append("fullName", qs("profile-full-name").value.trim());
  formData.append("phone", qs("profile-phone").value.trim());
  formData.append("dateOfBirth", qs("profile-dob").value);
  formData.append("gender", qs("profile-gender").value);
  formData.append("addressLine1", qs("profile-address").value.trim());
  formData.append("city", qs("profile-city").value.trim());
  formData.append("stateName", qs("profile-state").value.trim());
  formData.append("postalCode", qs("profile-postal").value.trim());
  formData.append("voterCardNumber", qs("profile-voter-card").value.trim());
  formData.append("aadhaarNumber", qs("profile-aadhaar").value.trim());
  if (state.profile.capturedPhotoBlob) {
    formData.append("verificationPhoto", state.profile.capturedPhotoBlob, "verification.jpg");
  }

  const result = await apiMultipart("/profile/verification", formData, true);
  state.user = result.user;
  updateProfileStatusUi();
  updateProfileProgressUi();
  setNavLockState();
  showToast(result.message || "Profile verification completed");
  await loadDashboard();
  await loadResults();
  switchView("dashboard-view");
}

async function handleGoogleLogin(response) {
  try {
    const data = await api(
      "/google-login",
      {
        method: "POST",
        body: JSON.stringify({ credential: response.credential })
      },
      false
    );
    setToken(data.token);
    await initializeSession();
    showToast("Login successful");
  } catch (error) {
    showToast(error.message || "Login failed");
  }
}

function bindNavigation() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const view = btn.dataset.view;
      if (view !== "profile-view") stopProfileCamera();
      switchView(view);
      if (view === "results-view") await loadResults();
      if (view === "history-view") await loadHistory();
      if (view === "admin-view") await loadAdminStudio();
      if (view === "profile-view") fillProfileForm();
      if (isMobileLayout()) closeMobileMenu();
    });
  });
}

function logout() {
  closeMobileMenu();
  stopProfileCamera();
  clearCapturedPhoto();
  setToken(null);
  state.user = null;
  state.currentElectionId = null;
  qs("sidebar").style.display = "none";
  qs("logout-btn").style.display = "none";
  qs("admin-nav-btn").style.display = "none";
  qs("role-badge").style.display = "none";
  switchView("login-view");
}

async function initializeSession() {
  if (!state.token) {
    switchView("login-view");
    return;
  }

  const me = await api("/me", {}, true);
  state.user = me.user;

  qs("sidebar").style.display = "flex";
  qs("logout-btn").style.display = "inline-block";
  qs("role-badge").style.display = state.user.is_admin ? "inline-flex" : "none";
  qs("admin-nav-btn").style.display = state.user.is_admin ? "block" : "none";
  qs("download-results-btn").style.display = state.user.is_admin ? "inline-block" : "none";
  qs("welcome-text").textContent = `Welcome ${state.user.name}`;
  fillProfileForm();

  await loadElectionList();
  await loadDashboard();
  await loadHistory();
  if (state.user.is_admin) await loadAdminStudio();
  switchView("dashboard-view");
  if (!state.user.profileComplete) showToast("Profile Verification is pending. You can browse, but voting requires verification.");
}
async function loadElectionList() {
  const data = await api("/elections?pageSize=100");
  state.elections = Array.isArray(data.elections) ? data.elections : [];

  const select = qs("election-switcher");
  select.innerHTML = "";
  state.elections.forEach((e) => {
    const opt = document.createElement("option");
    opt.value = String(e.id);
    opt.textContent = `${e.title} (${e.status}${Number(e.is_archived) ? ", archived" : ""})`;
    select.appendChild(opt);
  });

  const active = state.elections.find((e) => e.status === "active" && Number(e.is_archived) === 0);
  state.currentElectionId = active ? active.id : (state.elections[0] ? state.elections[0].id : null);
  if (state.currentElectionId) select.value = String(state.currentElectionId);
}

async function loadDashboard() {
  if (!state.currentElectionId) {
    qs("candidates-list").innerHTML = '<p class="muted">No elections found.</p>';
    return;
  }

  const electionId = state.currentElectionId;
  const [candidateData, statusData, resultsData] = await Promise.all([
    api(`/elections/${electionId}/candidates`),
    api(`/status?electionId=${electionId}`, {}, true),
    api(`/results?electionId=${electionId}`)
  ]);

  const election = candidateData.election;
  const candidates = candidateData.candidates || [];
  const results = resultsData.results || [];
  const totalVotes = results.reduce((sum, row) => sum + (Number(row.vote_count) || 0), 0);

  state.currentCandidates = candidates;
  state.hasVoted = Boolean(statusData.hasVoted);

  qs("stat-status").textContent = `${election.status}${Number(election.is_archived) ? " (Archived)" : ""}`;
  qs("stat-total-votes").textContent = String(totalVotes);
  renderCountdown(election);
  renderLifecycle(election);

  const list = qs("candidates-list");
  list.innerHTML = "";

  if (!candidates.length) {
    list.innerHTML = '<p class="muted">No candidates assigned to this election.</p>';
    return;
  }

  candidates.forEach((candidate) => {
    const voteBlocked = state.hasVoted || !state.user.profileComplete;
    const card = document.createElement("article");
    card.className = "candidate-card";
    card.innerHTML = `
      <img src="${candidateImage(candidate)}" alt="${candidate.name}" />
      <strong>${candidate.name}</strong>
      <span class="muted">${candidate.party}</span>
      <span class="candidate-symbol">Symbol: ${candidate.symbol || "Civic Emblem"}</span>
      <p class="candidate-summary">${summarizeBio(candidate.bio)}</p>
      <div class="inline">
        <button class="btn ghost" data-action="details">Details</button>
        <button class="btn ghost" data-action="watch">${state.watchlist.includes(Number(candidate.id)) ? "Unsave" : "Save"}</button>
        <button class="btn primary" data-action="vote" ${voteBlocked ? "disabled" : ""}>
          ${state.hasVoted ? "Voted" : state.user.profileComplete ? "Vote" : "Verify Profile First"}
        </button>
      </div>
    `;

    card.querySelector("[data-action='details']").addEventListener("click", () => openCandidateModal(candidate));
    card.querySelector("[data-action='watch']").addEventListener("click", () => {
      toggleWatchlist(candidate.id);
      loadDashboard().catch(() => {});
    });
    card.querySelector("[data-action='vote']").addEventListener("click", () => castVote(candidate.id));
    list.appendChild(card);
  });
  populateCompareSelectors();
  renderComparison();
  renderQaResults("");
  renderSpotlight();
  renderWatchlist();
}

function openCandidateModal(candidate) {
  state.modalCandidate = candidate;
  qs("modal-image").src = candidateImage(candidate);
  qs("modal-name").textContent = candidate.name;
  qs("modal-party").textContent = `${candidate.party} | Symbol: ${candidate.symbol || "Civic Emblem"}`;
  qs("modal-bio").textContent = candidate.bio || "No bio available.";
  const link = qs("modal-manifesto");
  if (candidate.manifesto_url) {
    link.style.display = "inline";
    link.href = candidate.manifesto_url;
  } else {
    link.style.display = "none";
    link.href = "#";
  }
  qs("modal-vote-btn").disabled = state.hasVoted || !state.user.profileComplete;
  qs("modal-vote-btn").textContent = state.hasVoted
    ? "Already Voted"
    : state.user.profileComplete
      ? "Vote for Candidate"
      : "Complete Profile Verification";
  qs("candidate-modal").style.display = "flex";
}

function closeCandidateModal() {
  state.modalCandidate = null;
  qs("candidate-modal").style.display = "none";
}

async function castVote(candidateId) {
  if (!state.currentElectionId) return;
  if (!state.user || !state.user.profileComplete) {
    showToast("Complete Profile Verification before voting.");
    switchView("profile-view");
    return;
  }
  try {
    const data = await api(
      `/elections/${state.currentElectionId}/vote`,
      { method: "POST", body: JSON.stringify({ candidateId }) },
      true
    );
    state.hasVoted = true;
    showToast(`Vote cast. Receipt: ${data.receipt}`);
    closeCandidateModal();
    await loadDashboard();
    await loadResults();
    await loadHistory();
  } catch (error) {
    showToast(error.message || "Unable to cast vote");
  }
}

function upsertChart(key, canvasId, config) {
  if (state.charts[key]) state.charts[key].destroy();
  state.charts[key] = new Chart(qs(canvasId), config);
}

async function loadResults() {
  if (!state.currentElectionId) return;
  const resultsData = await api(`/results?electionId=${state.currentElectionId}`);

  state.currentResults = resultsData.results || [];
  const staged = applyStoryStage(state.currentResults);
  upsertChart("results", "resultsChart", {
    type: "bar",
    data: {
      labels: staged.map((r) => r.name),
      datasets: [{ label: "Votes", data: staged.map((r) => Number(r.story_votes) || 0) }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });



  const table = qs("results-table");
  table.innerHTML = "<tr><th>Candidate</th><th>Party</th><th>Symbol</th><th>Votes</th></tr>";
  staged.forEach((r) => {
    table.innerHTML += `<tr><td>${r.name}</td><td>${r.party}</td><td>${r.symbol || "Civic Emblem"}</td><td>${r.story_votes}</td></tr>`;
  });
  renderBoothMap(staged);
  renderNotificationsPanel();
}

async function loadHistory() {
  const data = await api("/me/history", {}, true);
  const list = qs("history-list");
  list.innerHTML = "";
  renderJourneyTimeline(data.history || []);
  if (!data.history || !data.history.length) {
    list.innerHTML = '<div class="history-item muted">No voting history yet.</div>';
    return;
  }

  data.history.forEach((entry) => {
    const item = document.createElement("div");
    item.className = "history-item";
    item.innerHTML = `
      <strong>${entry.election_title}</strong>
      <div class="muted">Candidate: ${entry.candidate_name} (${entry.candidate_party})</div>
      <div class="muted">Voted at: ${formatDateTime(entry.voted_at)}</div>
      <div>Receipt: <code>${entry.receipt}</code></div>
      <button class="btn ghost" data-action="print">Download Receipt</button>
    `;
    item.querySelector("[data-action='print']").addEventListener("click", () => printHistoryReceipt(entry));
    list.appendChild(item);
  });
}
async function loadAdminStudio() {
  if (!state.user || !state.user.is_admin) return;
  await Promise.all([loadAdminElections(), loadAdminCandidates(), loadAdminActivity(), loadAdminBroadcasts(), loadAdminFeedback()]);
}

async function loadAdminElections() {
  const q = qs("admin-election-search").value.trim();
  const status = qs("admin-election-status-filter").value;
  const includeArchived = qs("admin-show-archived").checked;
  const page = state.admin.electionsPage;

  const params = new URLSearchParams({ page: String(page), pageSize: "8" });
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  if (includeArchived) params.set("includeArchived", "true");

  const data = await api(`/admin/elections?${params.toString()}`, {}, true);
  const rows = data.elections || [];
  state.admin.electionsTotal = data.pagination ? data.pagination.totalPages || 1 : 1;
  qs("admin-elections-page").textContent = `${state.admin.electionsPage}/${state.admin.electionsTotal}`;

  const root = qs("admin-elections-list");
  root.innerHTML = "";

  rows.forEach((e) => {
    const node = document.createElement("div");
    node.className = "stack-item";
    node.innerHTML = `
      <div class="section-head">
        <div class="inline">
          <input type="checkbox" data-action="select-election" ${state.admin.selectedElectionIds.includes(Number(e.id)) ? "checked" : ""} />
          <strong>${e.title}</strong>
        </div>
        <span class="muted">${e.status}${Number(e.is_archived) ? " | archived" : ""}</span>
      </div>
      <div class="muted">${e.description || "No description"}</div>
      <div class="muted">Candidates: ${e.candidate_count || 0} | Votes: ${e.total_votes || 0}</div>
      <div class="inline">
        <button class="btn ghost" data-action="activate">Activate</button>
        <button class="btn ghost" data-action="close">Close</button>
        <button class="btn ghost" data-action="archive">${Number(e.is_archived) ? "Unarchive" : "Archive"}</button>
        <button class="btn ghost" data-action="duplicate">Duplicate</button>
        <button class="btn ghost" data-action="assign">Assign IDs</button>
        <button class="btn ghost" data-action="export">Export CSV</button>
      </div>
    `;

    node.querySelector("[data-action='activate']").addEventListener("click", () => updateElectionStatus(e.id, "active"));
    node.querySelector("[data-action='close']").addEventListener("click", () => updateElectionStatus(e.id, "closed"));
    node.querySelector("[data-action='archive']").addEventListener("click", () => toggleArchiveElection(e.id, !Number(e.is_archived)));
    node.querySelector("[data-action='duplicate']").addEventListener("click", () => duplicateElection(e.id, e.title));
    node.querySelector("[data-action='assign']").addEventListener("click", () => assignCandidatesByPrompt(e.id));
    node.querySelector("[data-action='export']").addEventListener("click", async () => {
      try {
        await downloadResultsCsv(e.id);
      } catch (error) {
        showToast(error.message || "Export failed");
      }
    });
    node.querySelector("[data-action='select-election']").addEventListener("change", (ev) => {
      const id = Number(e.id);
      if (ev.target.checked) {
        if (!state.admin.selectedElectionIds.includes(id)) state.admin.selectedElectionIds.push(id);
      } else {
        state.admin.selectedElectionIds = state.admin.selectedElectionIds.filter((x) => x !== id);
      }
    });

    root.appendChild(node);
  });
}

async function updateElectionStatus(electionId, status) {
  await api(`/admin/elections/${electionId}/status`, { method: "PUT", body: JSON.stringify({ status }) }, true);
  showToast("Election status updated");
  await loadElectionList();
  await loadDashboard();
  await loadResults();
  await loadAdminElections();
}

async function toggleArchiveElection(electionId, archived) {
  await api(`/admin/elections/${electionId}/archive`, { method: "PUT", body: JSON.stringify({ archived }) }, true);
  showToast(archived ? "Election archived" : "Election restored");
  await loadElectionList();
  await loadAdminElections();
}

async function bulkUpdateElections(action) {
  const ids = [...state.admin.selectedElectionIds];
  if (!ids.length) return showToast("Select at least one election");
  if (action === "close") {
    await Promise.all(ids.map((id) => api(`/admin/elections/${id}/status`, { method: "PUT", body: JSON.stringify({ status: "closed" }) }, true)));
  } else if (action === "archive") {
    await Promise.all(ids.map((id) => api(`/admin/elections/${id}/archive`, { method: "PUT", body: JSON.stringify({ archived: true }) }, true)));
  } else if (action === "unarchive") {
    await Promise.all(ids.map((id) => api(`/admin/elections/${id}/archive`, { method: "PUT", body: JSON.stringify({ archived: false }) }, true)));
  }
  state.admin.selectedElectionIds = [];
  showToast("Bulk action completed");
  await loadElectionList();
  await loadAdminElections();
}

async function duplicateElection(electionId, title) {
  const newTitle = prompt("Duplicate title", `${title} (Copy)`);
  if (!newTitle) return;
  await api(`/admin/elections/${electionId}/duplicate`, { method: "POST", body: JSON.stringify({ title: newTitle }) }, true);
  showToast("Election duplicated");
  await loadElectionList();
  await loadAdminElections();
}

async function assignCandidatesByPrompt(electionId) {
  const ids = prompt("Enter candidate IDs separated by comma (example: 1,2,5)", "");
  if (ids === null) return;
  const candidateIds = ids.split(",").map((x) => Number(x.trim())).filter((n) => Number.isInteger(n));
  await api(`/admin/elections/${electionId}/candidates`, { method: "POST", body: JSON.stringify({ candidateIds }) }, true);
  showToast("Candidates assigned");
  await loadAdminElections();
}

async function loadAdminCandidates() {
  const q = qs("admin-candidate-search").value.trim();
  const page = state.admin.candidatesPage;
  const params = new URLSearchParams({ page: String(page), pageSize: "8" });
  if (q) params.set("q", q);

  const data = await api(`/admin/candidates?${params.toString()}`, {}, true);
  const rows = data.candidates || [];
  state.admin.candidatesTotal = data.pagination ? Math.max(1, Math.ceil((data.pagination.total || 0) / (data.pagination.pageSize || 8))) : 1;
  qs("admin-candidates-page").textContent = `${state.admin.candidatesPage}/${state.admin.candidatesTotal}`;
  state.admin.candidatesCache = rows;

  const select = qs("election-candidates");
  select.innerHTML = "";
  rows.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = String(c.id);
    opt.textContent = `${c.id} - ${c.name} (${c.party})`;
    select.appendChild(opt);
  });

  const root = qs("admin-candidates-list");
  root.innerHTML = "";

  rows.forEach((c) => {
    const node = document.createElement("div");
    node.className = "stack-item";
    node.innerHTML = `
      <strong>${c.name}</strong>
      <div class="muted">${c.party}</div>
      <div class="muted">Symbol: ${c.symbol || "Civic Emblem"}</div>
      <div class="muted">${c.bio || "No bio"}</div>
      <div class="inline">
        <button class="btn ghost" data-action="edit">Edit</button>
      </div>
      <form class="form-grid" style="display:none; margin-top:8px;">
        <input name="name" value="${c.name}" required />
        <input name="party" value="${c.party}" required />
        <input name="symbol" value="${c.symbol || ""}" placeholder="Symbol" />
        <input name="image" value="${c.image || ""}" placeholder="Image" />
        <input name="manifesto" value="${c.manifesto_url || ""}" placeholder="Manifesto URL" />
        <textarea name="bio">${c.bio || ""}</textarea>
        <div class="inline">
          <button class="btn primary" type="submit">Save</button>
          <button class="btn ghost" type="button" data-action="cancel">Cancel</button>
        </div>
      </form>
    `;

    const form = node.querySelector("form");
    node.querySelector("[data-action='edit']").addEventListener("click", () => {
      form.style.display = form.style.display === "none" ? "grid" : "none";
    });
    node.querySelector("[data-action='cancel']").addEventListener("click", () => (form.style.display = "none"));

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      await api(
        `/admin/candidates/${c.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            name: form.name.value.trim(),
            party: form.party.value.trim(),
            symbol: form.symbol.value.trim() || null,
            image: form.image.value.trim() || null,
            manifestoUrl: form.manifesto.value.trim() || null,
            bio: form.bio.value.trim() || null
          })
        },
        true
      );
      showToast("Candidate updated");
      await loadAdminCandidates();
    });

    root.appendChild(node);
  });
}

async function loadAdminActivity() {
  const data = await api("/admin/activity?limit=30", {}, true);
  const root = qs("admin-activity");
  root.innerHTML = "";
  (data.activity || []).forEach((a) => {
    const node = document.createElement("div");
    node.className = "simple-item";
    node.innerHTML = `<strong>${a.action}</strong><div class="muted">${a.admin_name} • ${formatDateTime(a.created_at)}</div>`;
    root.appendChild(node);
  });
  const counts = {};
  (data.activity || []).forEach((a) => {
    counts[a.action] = (counts[a.action] || 0) + 1;
  });
  const labels = Object.keys(counts).slice(0, 8);
  const values = labels.map((k) => counts[k]);
  if (labels.length) {
    upsertChart("adminActivity", "adminActivityChart", {
      type: "bar",
      data: { labels, datasets: [{ label: "Events", data: values }] },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }
}

async function loadAdminFeedback() {
  if (!state.user || !state.user.is_admin) return;
  const data = await api("/admin/feedback", {}, true);
  const root = qs("admin-feedback-list");
  if (!root) return;
  root.innerHTML = "";
  (data.feedback || []).forEach((f) => {
    const node = document.createElement("div");
    node.className = "stack-item";
    node.innerHTML = `
      <strong>${f.category}</strong>
      <div>${f.message}</div>
      <div class="muted">${f.user_name || "Citizen"} • ${formatDateTime(f.created_at)} • Status: ${f.status}</div>
      <div class="inline">
        <select data-action="status">
          <option value="new" ${f.status === "new" ? "selected" : ""}>new</option>
          <option value="reviewed" ${f.status === "reviewed" ? "selected" : ""}>reviewed</option>
          <option value="closed" ${f.status === "closed" ? "selected" : ""}>closed</option>
        </select>
        <button class="btn ghost" data-action="save">Update</button>
      </div>
    `;
    node.querySelector("[data-action='save']").addEventListener("click", async () => {
      const status = node.querySelector("[data-action='status']").value;
      await api(`/admin/feedback/${f.id}`, { method: "PUT", body: JSON.stringify({ status, adminNote: "" }) }, true);
      showToast("Feedback updated");
      await loadAdminFeedback();
    });
    root.appendChild(node);
  });
}

async function loadAdminBroadcasts() {
  const data = await api("/admin/broadcasts", {}, true);
  const root = qs("broadcast-list");
  root.innerHTML = "";
  (data.broadcasts || []).forEach((b) => {
    const node = document.createElement("div");
    node.className = "simple-item";
    node.innerHTML = `<div>${b.message}</div><div class="inline"><span class="muted">${b.active ? "active" : "inactive"}</span><button class="btn ghost">Deactivate</button></div>`;
    node.querySelector("button").addEventListener("click", async () => {
      await api(`/admin/broadcasts/${b.id}`, { method: "DELETE" }, true);
      await loadAdminBroadcasts();
      await loadBroadcast();
    });
    root.appendChild(node);
  });
}
async function createCandidate(ev) {
  ev.preventDefault();
  await api(
    "/admin/candidates",
    {
      method: "POST",
      body: JSON.stringify({
        name: qs("candidate-name").value.trim(),
        party: qs("candidate-party").value.trim(),
        symbol: qs("candidate-symbol").value.trim() || null,
        image: qs("candidate-image").value.trim() || null,
        manifestoUrl: qs("candidate-manifesto").value.trim() || null,
        bio: qs("candidate-bio").value.trim() || null
      })
    },
    true
  );
  ev.target.reset();
  showToast("Candidate created");
  await loadAdminCandidates();
}

async function createElection(ev) {
  ev.preventDefault();
  const startsAt = isoFromLocal(qs("election-start").value);
  const endsAt = isoFromLocal(qs("election-end").value);
  if (isInvalidDateRange(startsAt, endsAt)) {
    showToast("End date/time cannot be earlier than start date/time.");
    return;
  }

  const candidateIds = Array.from(qs("election-candidates").selectedOptions).map((o) => Number(o.value));

  await api(
    "/admin/elections",
    {
      method: "POST",
      body: JSON.stringify({
        title: qs("election-title").value.trim(),
        description: qs("election-description").value.trim() || null,
        startsAt,
        endsAt,
        status: qs("election-status").value,
        candidateIds
      })
    },
    true
  );

  ev.target.reset();
  showToast("Election created");
  await loadElectionList();
  await loadDashboard();
  await loadAdminElections();
}

async function publishBroadcast(ev) {
  ev.preventDefault();
  const message = qs("broadcast-message").value.trim();
  if (!message) return showToast("Broadcast message is required");
  await api("/admin/broadcasts", { method: "POST", body: JSON.stringify({ message }) }, true);
  qs("broadcast-form").reset();
  showToast("Broadcast published");
  await loadBroadcast();
  await loadAdminBroadcasts();
}

async function importCsv() {
  const csvText = qs("candidate-csv").value.trim();
  if (!csvText) return showToast("Paste CSV content first");
  const data = await api("/admin/candidates/import", { method: "POST", body: JSON.stringify({ csvText }) }, true);
  showToast(`Imported ${data.inserted} candidates`);
  qs("candidate-csv").value = "";
  await loadAdminCandidates();
}

async function submitFeedback(ev) {
  ev.preventDefault();
  const category = qs("feedback-category").value;
  const message = qs("feedback-message").value.trim();
  if (!category || !message) return showToast("Feedback category and message are required");
  await api("/feedback", { method: "POST", body: JSON.stringify({ category, message }) }, true);
  qs("feedback-form").reset();
  showToast("Feedback submitted. Thank you.");
}

function bindProfileFieldFormatters() {
  ["profile-phone", "profile-postal", "profile-aadhaar"].forEach((id) => {
    const input = qs(id);
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "");
    });
  });
  const voter = qs("profile-voter-card");
  voter.addEventListener("input", () => {
    voter.value = voter.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  });
}

function bindEvents() {
  bindNavigation();
  bindProfileFieldFormatters();

  qs("logout-btn").addEventListener("click", logout);
  qs("mobile-menu-btn").addEventListener("click", toggleMobileMenu);
  qs("mobile-backdrop").addEventListener("click", closeMobileMenu);
  qs("theme-toggle").addEventListener("click", toggleTheme);
  qs("theme-preset").addEventListener("change", (e) => setThemePreset(e.target.value));
  qs("notifications-btn").addEventListener("click", toggleNotificationsPanel);
  qs("command-go").addEventListener("click", runQuickCommand);
  qs("command-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") runQuickCommand();
  });
  qs("login-get-started").addEventListener("click", () => {
    qs("login-signin-card").scrollIntoView({ behavior: "smooth", block: "center" });
  });
  qs("login-learn-more").addEventListener("click", () => {
    const panel = qs("login-more-panel");
    const open = panel.style.display !== "none";
    panel.style.display = open ? "none" : "grid";
  });
  qs("candidate-modal-close").addEventListener("click", closeCandidateModal);
  qs("candidate-modal").addEventListener("click", (e) => {
    if (e.target.id === "candidate-modal") closeCandidateModal();
  });
  qs("modal-vote-btn").addEventListener("click", () => {
    if (state.modalCandidate) castVote(state.modalCandidate.id);
  });

  qs("election-switcher").addEventListener("change", async (e) => {
    state.currentElectionId = Number(e.target.value);
    await loadDashboard();
    await loadResults();
    await loadHistory();
  });

  qs("refresh-dashboard-btn").addEventListener("click", async () => {
    await loadElectionList();
    await loadDashboard();
    showToast("Dashboard refreshed");
  });

  qs("download-results-btn").addEventListener("click", () => {
    if (!state.currentElectionId) return;
    downloadResultsCsv(state.currentElectionId).catch((error) => {
      showToast(error.message || "Export failed");
    });
  });
  qs("story-stage").addEventListener("change", async (e) => {
    state.storyStage = e.target.value;
    await loadResults();
  });
  qs("spotlight-prev").addEventListener("click", () => {
    state.spotlightIndex -= 1;
    renderSpotlight();
  });
  qs("spotlight-next").addEventListener("click", () => {
    state.spotlightIndex += 1;
    renderSpotlight();
  });
  qs("compare-run-btn").addEventListener("click", renderComparison);
  qs("compare-a").addEventListener("change", renderComparison);
  qs("compare-b").addEventListener("change", renderComparison);
  qs("qa-search-btn").addEventListener("click", () => renderQaResults(qs("qa-search").value));
  qs("qa-search").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      renderQaResults(qs("qa-search").value);
    }
  });
  qs("feedback-form").addEventListener("submit", async (ev) => {
    try {
      await submitFeedback(ev);
    } catch (error) {
      showToast(error.message || "Unable to submit feedback");
    }
  });
  qs("start-camera-btn").addEventListener("click", async () => {
    try {
      await startProfileCamera();
      showToast("Camera started");
    } catch (error) {
      showToast(error.message || "Unable to access camera");
    }
  });
  qs("capture-photo-btn").addEventListener("click", async () => {
    try {
      await captureProfilePhoto();
      showToast("Photo captured");
    } catch (error) {
      showToast(error.message || "Capture failed");
    }
  });
  qs("retake-photo-btn").addEventListener("click", () => {
    clearCapturedPhoto();
    showToast("Photo cleared. Capture again.");
  });
  qs("profile-form").addEventListener("submit", async (ev) => {
    try {
      await submitProfileVerification(ev);
    } catch (error) {
      showToast(error.message || "Profile verification failed");
    }
  });

  qs("candidate-create-form").addEventListener("submit", createCandidate);
  qs("election-create-form").addEventListener("submit", createElection);
  qs("broadcast-form").addEventListener("submit", publishBroadcast);
  qs("import-csv-btn").addEventListener("click", importCsv);
  qs("admin-feedback-refresh").addEventListener("click", loadAdminFeedback);

  qs("admin-election-filter-btn").addEventListener("click", async () => {
    state.admin.electionsPage = 1;
    await loadAdminElections();
  });
  qs("admin-election-search").addEventListener("input", () => {
    state.admin.electionsPage = 1;
    clearTimeout(adminElectionSearchTimer);
    adminElectionSearchTimer = setTimeout(() => {
      loadAdminElections().catch(() => {});
    }, 260);
  });
  qs("admin-election-search").addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    state.admin.electionsPage = 1;
    await loadAdminElections();
  });
  qs("admin-bulk-close").addEventListener("click", () => bulkUpdateElections("close"));
  qs("admin-bulk-archive").addEventListener("click", () => bulkUpdateElections("archive"));
  qs("admin-bulk-unarchive").addEventListener("click", () => bulkUpdateElections("unarchive"));
  qs("admin-candidate-filter-btn").addEventListener("click", async () => {
    state.admin.candidatesPage = 1;
    await loadAdminCandidates();
  });
  qs("admin-candidate-search").addEventListener("input", () => {
    state.admin.candidatesPage = 1;
    clearTimeout(adminCandidateSearchTimer);
    adminCandidateSearchTimer = setTimeout(() => {
      loadAdminCandidates().catch(() => {});
    }, 260);
  });
  qs("admin-candidate-search").addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    state.admin.candidatesPage = 1;
    await loadAdminCandidates();
  });

  qs("admin-elections-prev").addEventListener("click", async () => {
    state.admin.electionsPage = Math.max(1, state.admin.electionsPage - 1);
    await loadAdminElections();
  });
  qs("admin-elections-next").addEventListener("click", async () => {
    state.admin.electionsPage = Math.min(state.admin.electionsTotal, state.admin.electionsPage + 1);
    await loadAdminElections();
  });
  qs("admin-candidates-prev").addEventListener("click", async () => {
    state.admin.candidatesPage = Math.max(1, state.admin.candidatesPage - 1);
    await loadAdminCandidates();
  });
  qs("admin-candidates-next").addEventListener("click", async () => {
    state.admin.candidatesPage = Math.min(state.admin.candidatesTotal, state.admin.candidatesPage + 1);
    await loadAdminCandidates();
  });

  window.addEventListener("resize", () => {
    if (!isMobileLayout()) closeMobileMenu();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMobileMenu();
  });
}

window.addEventListener("load", async () => {
  initTheme();
  await resolveLocalApiBase();
  bindEvents();
  await loadBroadcast();

  if (qs("google-btn") && window.google && google.accounts && google.accounts.id) {
    google.accounts.id.initialize({
      client_id: "1013871678334-aiatsb0d3k5kqqsk0m7ub8d76040qmec.apps.googleusercontent.com",
      callback: handleGoogleLogin
    });
    google.accounts.id.renderButton(qs("google-btn"), { theme: "outline", size: "large", width: "280" });
  }

  try {
    await initializeSession();
  } catch (error) {
    console.error(error);
    showToast("Session init failed. Please login again.");
    logout();
  }
});

window.addEventListener("beforeunload", () => {
  stopProfileCamera();
});








