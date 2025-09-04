const API_BASE = "/api";
let currentUserId = null;

function showLogin() {
  document.getElementById("register-section").style.display = "none";
  document.getElementById("login-section").style.display = "block";
}
function showRegister() {
  document.getElementById("login-section").style.display = "none";
  document.getElementById("register-section").style.display = "block";
}

// Register
document.getElementById("register-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("reg-name").value;
  const email = document.getElementById("reg-email").value;
  const password = document.getElementById("reg-password").value;

  const res = await fetch(`${API_BASE}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password })
  });

  const data = await res.json();
  alert(data.message || data.error);
  if (data.userId) showLogin();
});

// Login
document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  const res = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();
  alert(data.message || data.error);

  if (data.userId) {
    currentUserId = data.userId;
    loadCandidates();
  }
});

// Load candidates
async function loadCandidates() {
  document.getElementById("login-section").style.display = "none";
  document.getElementById("register-section").style.display = "none";
  document.getElementById("voting-section").style.display = "block";

  const res = await fetch(`${API_BASE}/candidates`);
  const data = await res.json();

  const list = document.getElementById("candidates-list");
  list.innerHTML = "";

  data.candidates.forEach(c => {
    const li = document.createElement("li");
    li.innerHTML = `${c.name} (${c.party}) <button onclick="castVote(${c.id})">Vote</button>`;
    list.appendChild(li);
  });
}

// Cast vote
async function castVote(candidateId) {
  const res = await fetch(`${API_BASE}/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: currentUserId, candidateId })
  });

  const data = await res.json();
  alert(data.message || data.error);
}

// Results
async function viewResults() {
  document.getElementById("voting-section").style.display = "none";
  document.getElementById("results-section").style.display = "block";

  const res = await fetch(`${API_BASE}/results`);
  const data = await res.json();

  const table = document.getElementById("results-table");
  table.innerHTML = "";

  data.results.forEach(r => {
    table.innerHTML += `<tr><td>${r.name}</td><td>${r.party}</td><td>${r.vote_count}</td></tr>`;
  });
}

function backToVote() {
  document.getElementById("results-section").style.display = "none";
  document.getElementById("voting-section").style.display = "block";
}

function logout() {
  currentUserId = null;
  document.getElementById("voting-section").style.display = "none";
  showLogin();
}
