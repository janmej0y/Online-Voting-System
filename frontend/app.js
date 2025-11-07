const API_BASE = "/api";
let currentUserId = null;

/* --------------------------------------------------
   ✅ JWT TOKEN FUNCTIONS
-------------------------------------------------- */
function getToken() {
  return localStorage.getItem("token");
}

/* --------------------------------------------------
   ✅ UI Navigation
-------------------------------------------------- */
function showLogin() {
  document.getElementById("register-section").style.display = "none";
  document.getElementById("login-section").style.display = "block";
  document.getElementById("otp-section").style.display = "none";
  document.getElementById("profile-section").style.display = "none";
  document.getElementById("voting-section").style.display = "none";
  document.getElementById("results-section").style.display = "none";
}

function showRegister() {
  document.getElementById("login-section").style.display = "none";
  document.getElementById("register-section").style.display = "block";
  document.getElementById("otp-section").style.display = "none";
  document.getElementById("profile-section").style.display = "none";
  document.getElementById("voting-section").style.display = "none";
  document.getElementById("results-section").style.display = "none";
}

/* --------------------------------------------------
   ✅ REGISTRATION → OTP Step
-------------------------------------------------- */
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

  if (data.userId) {
    document.getElementById("register-section").style.display = "none";
    document.getElementById("otp-section").style.display = "block";
    document.getElementById("otp-email").value = email;
  }
});

/* --------------------------------------------------
   ✅ OTP VERIFICATION
-------------------------------------------------- */
document.getElementById("otp-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("otp-email").value;
  const otp = document.getElementById("otp-code").value;

  const res = await fetch(`${API_BASE}/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp })
  });

  const data = await res.json();
  alert(data.message || data.error);

  if (data.message) {
    document.getElementById("otp-section").style.display = "none";
    showLogin();
  }
});

/* --------------------------------------------------
   ✅ LOGIN (JWT)
-------------------------------------------------- */
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

  if (data.token) {
    localStorage.setItem("token", data.token);
    currentUserId = data.userId;
    loadProfile();
    loadCandidates();
  }
});

/* --------------------------------------------------
   ✅ LOAD PROFILE DETAILS
-------------------------------------------------- */
async function loadProfile() {
  const res = await fetch(`${API_BASE}/me`, {
    headers: { "Authorization": getToken() }
  });

  const data = await res.json();
  if (!data.user) return;

  document.getElementById("profile-section").style.display = "block";
  document.getElementById("user-name").textContent = `👤 ${data.user.name}`;

  if (data.user.profile_photo) {
    const img = document.getElementById("profile-photo");
    img.src = data.user.profile_photo;
    img.style.display = "inline-block";
  }
}

/* --------------------------------------------------
   ✅ PROFILE PHOTO UPLOAD
-------------------------------------------------- */
document.getElementById("photo-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const file = document.getElementById("photo-file").files[0];
  if (!file) return alert("Select an image!");

  const formData = new FormData();
  formData.append("photo", file);

  const res = await fetch(`${API_BASE}/profile/photo`, {
    method: "POST",
    headers: { "Authorization": getToken() },
    body: formData
  });

  const data = await res.json();
  alert(data.message || data.error);

  if (data.photo) {
    document.getElementById("profile-photo").src = data.photo;
    document.getElementById("profile-photo").style.display = "inline-block";
  }
});

/* --------------------------------------------------
   ✅ LOAD CANDIDATES (IMAGES + CARDS)
-------------------------------------------------- */
async function loadCandidates() {
  document.getElementById("login-section").style.display = "none";
  document.getElementById("register-section").style.display = "none";
  document.getElementById("otp-section").style.display = "none";

  document.getElementById("voting-section").style.display = "block";

  const res = await fetch(`${API_BASE}/candidates`);
  const data = await res.json();

  const list = document.getElementById("candidates-list");
  list.innerHTML = "";

  data.candidates.forEach((c) => {
    list.innerHTML += `
      <div class="candidate-card">
        <img src="images/${c.image}" />
        <h3>${c.name}</h3>
        <p>${c.party}</p>
        <button class="vote-btn" onclick="castVote(${c.id})">Vote</button>
      </div>
    `;
  });
}

/* --------------------------------------------------
   ✅ CAST VOTE (JWT PROTECTED)
-------------------------------------------------- */
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
  showPopup(data.message || data.error);
}

/* --------------------------------------------------
   ✅ POPUP MESSAGE
-------------------------------------------------- */
function showPopup(message) {
  document.getElementById("popup-message").textContent = message;
  document.getElementById("popup").style.display = "flex";
}

function closePopup() {
  document.getElementById("popup").style.display = "none";
}

/* --------------------------------------------------
   ✅ VIEW RESULTS (CHART + TABLE)
-------------------------------------------------- */
async function viewResults() {
  document.getElementById("voting-section").style.display = "none";
  document.getElementById("results-section").style.display = "block";

  const res = await fetch(`${API_BASE}/results`);
  const data = await res.json();

  const names = data.results.map(r => r.name);
  const votes = data.results.map(r => r.vote_count);

  new Chart(document.getElementById("resultsChart"), {
    type: "bar",
    data: {
      labels: names,
      datasets: [{
        label: "Votes",
        data: votes,
        backgroundColor: "rgba(0, 119, 255, 0.7)"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
  
  

  const table = document.getElementById("results-table");
  table.innerHTML = "";
  data.results.forEach(r => {
    table.innerHTML += `<tr><td>${r.name}</td><td>${r.party}</td><td>${r.vote_count}</td></tr>`;
  });
}

/* --------------------------------------------------
   ✅ GO BACK
-------------------------------------------------- */
function backToVote() {
  document.getElementById("results-section").style.display = "none";
  document.getElementById("voting-section").style.display = "block";
}

/* --------------------------------------------------
   ✅ LOGOUT
-------------------------------------------------- */
function logout() {
  localStorage.removeItem("token");
  currentUserId = null;
  showLogin();
}

/* --------------------------------------------------
   ✅ DARK MODE
-------------------------------------------------- */
document.getElementById("theme-toggle").onclick = () => {
  document.body.classList.toggle("dark");
};
