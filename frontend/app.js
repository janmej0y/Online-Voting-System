/* frontend/app.js */
const API_BASE = "https://ezeevote.onrender.com";
let currentUserId = null;

function getToken() {
  return localStorage.getItem("token");
}
function setToken(t) {
  if (t) localStorage.setItem("token", t);
  else localStorage.removeItem("token");
}

function hideAll() {
  [
    "profile-section",
    "voting-section",
    "results-section"
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
}

function showProfile() {
  hideAll();
  document.getElementById("profile-section").style.display = "block";
}

function showVoting() {
  hideAll();
  document.getElementById("voting-section").style.display = "block";
}

/* ------------------------------
   GOOGLE LOGIN HANDLER
--------------------------------*/
async function handleGoogleLogin(response) {
  try {
    const res = await fetch(`${API_BASE}/google-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: response.credential })
    });

    const data = await res.json();
    console.log("Login response:", data);

    if (data.token) {
      setToken(data.token);
      currentUserId = data.userId;
      await loadProfile();
      await loadCandidates();
    } else {
      alert(data.error || "Login failed");
    }
  } catch (err) {
    console.error(err);
    alert("Login error");
  }
}

/* ------------------------------
   LOAD PROFILE
--------------------------------*/
async function loadProfile() {
  const res = await fetch(`${API_BASE}/me`, {
    headers: { Authorization: getToken() }
  });
  const data = await res.json();

  if (!data.user) return;

  hideAll();
  document.getElementById("profile-section").style.display = "block";
  document.getElementById("user-name").textContent = data.user.name;
  if (data.user.profile_photo) {
    document.getElementById("profile-photo").src = data.user.profile_photo;
    document.getElementById("profile-photo").style.display = "block";
  }
}

/* ------------------------------
   CANDIDATES
--------------------------------*/
async function loadCandidates() {
  hideAll();
  document.getElementById("voting-section").style.display = "block";

  const res = await fetch(`${API_BASE}/candidates`);
  const data = await res.json();

  const list = document.getElementById("candidates-list");
  list.innerHTML = "";

  (data.candidates || []).forEach((c) => {
    const div = document.createElement("div");
    div.className = "candidate-card";

    div.innerHTML = `
      <img src="images/${c.image}" />
      <h3>${c.name}</h3>
      <p>${c.party}</p>
      <button class="vote-btn">Vote</button>
    `;

    div.querySelector(".vote-btn").addEventListener("click", () => {
      castVote(c.id);
    });

    list.appendChild(div);
  });
}

async function castVote(candidateId) {
  const res = await fetch(`${API_BASE}/vote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getToken()
    },
    body: JSON.stringify({ candidateId })
  });

  const data = await res.json();
  alert(data.message || data.error);
}

/* ------------------------------
   RESULTS
--------------------------------*/
async function viewResults() {
  hideAll();
  document.getElementById("results-section").style.display = "block";

  const res = await fetch(`${API_BASE}/results`);
  const data = await res.json();

  const names = data.results.map((r) => r.name);
  const votes = data.results.map((r) => r.vote_count);

  if (window.resultsChart) window.resultsChart.destroy();

  window.resultsChart = new Chart(
    document.getElementById("resultsChart"),
    {
      type: "bar",
      data: {
        labels: names,
        datasets: [{ label: "Votes", data: votes }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    }
  );

  const table = document.getElementById("results-table");
  table.innerHTML =
    "<tr><th>Candidate</th><th>Party</th><th>Votes</th></tr>";

  data.results.forEach((r) => {
    table.innerHTML += `
      <tr>
        <td>${r.name}</td>
        <td>${r.party}</td>
        <td>${r.vote_count}</td>
      </tr>
    `;
  });
}

function logout() {
  setToken(null);
  currentUserId = null;
  alert("Logged out");
  location.reload();
}

/* THEME TOGGLE */
document.getElementById("theme-toggle").addEventListener("click", () => {
  document.body.classList.toggle("dark");
});

/* GOOGLE BUTTON INIT */
window.onload = function () {
  google.accounts.id.initialize({
    client_id:
      "1013871678334-aiatsb0d3k5kqqsk0m7ub8d76040qmec.apps.googleusercontent.com",
    callback: handleGoogleLogin
  });

  google.accounts.id.renderButton(
    document.getElementById("google-btn"),
    { theme: "outline", size: "large", width: "280" }
  );
};
