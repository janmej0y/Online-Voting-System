// frontend/app.js
const API_BASE = "https://ezeevote.onrender.com/api";
let currentUserId = null;

// ================================
// 🔐 TOKEN MANAGEMENT
// ================================
function getToken() {
  return localStorage.getItem("token");
}
function setToken(token) {
  if (token) localStorage.setItem("token", token);
  else localStorage.removeItem("token");
}

// ================================
// 🔄 UI HELPERS
// ================================
function hideAll() {
  [
    "login-section",
    "profile-section",
    "voting-section",
    "results-section",
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
}

function showLogin() {
  hideAll();
  document.getElementById("login-section").style.display = "block";
}

function closeLogin() {
  hideAll();
}

// ================================
// 🔐 GOOGLE LOGIN HANDLER
// Called when user clicks Google Sign-In button
// ================================
async function handleGoogleLogin(response) {
  try {
    const idToken = response.credential;

    const res = await fetch(`${API_BASE}/google-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken })
    });

    const data = await res.json();

    if (data.token) {
      setToken(data.token);
      currentUserId = data.userId;

      await loadProfile();
      await loadCandidates();
    } else {
      alert(data.error || "Google authentication failed.");
    }
  } catch (err) {
    console.error(err);
    alert("Google login error");
  }
}

// ================================
// 👤 LOAD USER PROFILE
// ================================
async function loadProfile() {
  try {
    const res = await fetch(`${API_BASE}/me`, {
      headers: { "Authorization": getToken() }
    });

    const data = await res.json();

    if (!data.user) {
      showLogin();
      return;
    }

    hideAll();

    document.getElementById("profile-section").style.display = "block";
    document.getElementById("user-name").innerText = data.user.name;

    if (data.user.profile_photo) {
      const img = document.getElementById("profile-photo");
      img.src = data.user.profile_photo;
      img.style.display = "block";
    }
  } catch (err) {
    console.error(err);
    showLogin();
  }
}

// ================================
// 📸 UPLOAD PROFILE PHOTO
// ================================
document.getElementById("photo-form").addEventListener("submit", async e => {
  e.preventDefault();

  const file = document.getElementById("photo-file").files[0];
  if (!file) return alert("Select an image.");

  const fd = new FormData();
  fd.append("photo", file);

  const res = await fetch(`${API_BASE}/profile/photo`, {
    method: "POST",
    headers: { "Authorization": getToken() },
    body: fd
  });

  const data = await res.json();
  alert(data.message || data.error);

  if (data.photo) {
    document.getElementById("profile-photo").src = data.photo;
  }
});

// ================================
// 🗳 LOAD CANDIDATES
// ================================
async function loadCandidates() {
  hideAll();
  document.getElementById("voting-section").style.display = "block";

  const res = await fetch(`${API_BASE}/candidates`);
  const data = await res.json();

  const list = document.getElementById("candidates-list");
  list.innerHTML = "";

  (data.candidates || []).forEach(c => {
    const div = document.createElement("div");
    div.className = "candidate-card";

    div.innerHTML = `
      <img src="images/${c.image}" alt="${c.name}" />
      <h3>${c.name}</h3>
      <p>${c.party}</p>
      <button class="vote-btn">Vote</button>
    `;

    div.querySelector(".vote-btn").addEventListener("click", () => castVote(c.id));

    list.appendChild(div);
  });
}

// ================================
// 🗳 CAST VOTE
// ================================
async function castVote(candidateId) {
  const res = await fetch(`${API_BASE}/vote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": getToken()
    },
    body: JSON.stringify({ candidateId })
  });

  const data = await res.json();
  alert(data.message || data.error);
}

// ================================
// 📊 VIEW RESULTS
// ================================
async function viewResults() {
  hideAll();
  document.getElementById("results-section").style.display = "block";

  const res = await fetch(`${API_BASE}/results`);
  const data = await res.json();

  // Chart.js
  const names = data.results.map(r => r.name);
  const votes = data.results.map(r => r.vote_count);

  const ctx = document.getElementById("resultsChart");

  if (window.resultsChart) window.resultsChart.destroy();

  window.resultsChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: names,
      datasets: [{
        label: "Votes",
        data: votes
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });

  const table = document.getElementById("results-table");
  table.innerHTML = "<tr><th>Candidate</th><th>Party</th><th>Votes</th></tr>";

  data.results.forEach(r => {
    table.innerHTML += `
      <tr>
        <td>${r.name}</td>
        <td>${r.party}</td>
        <td>${r.vote_count}</td>
      </tr>`;
  });
}

function backToVote() {
  hideAll();
  document.getElementById("voting-section").style.display = "block";
}

// ================================
// 🚪 LOGOUT
// ================================
function logout() {
  setToken(null);
  currentUserId = null;
  showLogin();
}

// ================================
// 🌗 THEME TOGGLE
// ================================
document.getElementById("theme-toggle").addEventListener("click", () => {
  document.body.classList.toggle("dark");
});

// ================================
// 🚀 ON PAGE LOAD
// ================================
showLogin();
