// frontend/app.js
const API_BASE = "https://ezeevote.onrender.com/api"; // <-- make sure this is your render URL + /api
let currentUserId = null;

// simple helper for token
function getToken() { return localStorage.getItem("token"); }
function setToken(t) { if (t) localStorage.setItem("token", t); else localStorage.removeItem("token"); }

// UI helpers
function showLogin(){ hideAll(); document.getElementById("login-section").style.display="block"; }
function showRegister(){ hideAll(); document.getElementById("register-section").style.display="block"; }
function showOtp(){ hideAll(); document.getElementById("otp-section").style.display="block"; }
function showVoting(){ hideAll(); document.getElementById("voting-section").style.display="block"; }
function showResults(){ hideAll(); document.getElementById("results-section").style.display="block"; }
function showProfile(){ hideAll(); document.getElementById("profile-section").style.display="block"; }
function showForgot(){ hideAll(); document.getElementById("forgot-section").style.display="block"; }
function hideAll(){
  ["register-section","login-section","otp-section","voting-section","results-section","profile-section","forgot-section"].forEach(id=>{
    const el=document.getElementById(id); if(el) el.style.display="none";
  });
}

// Popup
function showPopup(msg){ document.getElementById("popup-message").innerText=msg; document.getElementById("popup").style.display="flex"; }
function closePopup(){ document.getElementById("popup").style.display="none"; }

// Register -> sends OTP (backend returns userId). request returns quickly because email is sent asynchronously server-side
document.getElementById("register-form").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const name=document.getElementById("reg-name").value.trim();
  const email=document.getElementById("reg-email").value.trim();
  const password=document.getElementById("reg-password").value;
  if(!name||!email||!password) return showPopup("All fields required");
  const res = await fetch(`${API_BASE}/register`, {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({name,email,password})
  });
  const data = await res.json();
  if (data.userId) {
    document.getElementById("otp-email").value = email;
    showOtp();
  }
  showPopup(data.message || data.error || "OK");
});

// Resend OTP
document.getElementById("resend-otp").addEventListener("click", async (e)=>{
  e.preventDefault();
  const email = document.getElementById("otp-email").value;
  if(!email) return showPopup("Enter email first");
  const res = await fetch(`${API_BASE}/resend-otp`, {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({email})
  });
  const data = await res.json();
  showPopup(data.message || data.error);
});

// Verify OTP
document.getElementById("otp-form").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const email=document.getElementById("otp-email").value;
  const otp=document.getElementById("otp-code").value;
  if(!email||!otp) return showPopup("Email & OTP required");
  const res = await fetch(`${API_BASE}/verify-otp`, {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({email, otp})
  });
  const data = await res.json();
  showPopup(data.message || data.error);
  if (data.message) showLogin();
});

// Login
document.getElementById("login-form").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const email=document.getElementById("login-email").value;
  const password=document.getElementById("login-password").value;
  const res = await fetch(`${API_BASE}/login`, {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({email,password})
  });
  const data = await res.json();
  showPopup(data.message || data.error);
  if (data.token) {
    setToken(data.token);
    currentUserId = data.userId;
    loadProfile();
    loadCandidates();
    showVoting();
  }
});

// Forgot password
document.getElementById("forgot-link").addEventListener("click",(e)=>{ e.preventDefault(); showForgot(); });
document.getElementById("forgot-form").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const email = document.getElementById("forgot-email").value;
  const res = await fetch(`${API_BASE}/forgot-password`, {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({email})
  });
  const data = await res.json();
  showPopup(data.message || data.error);
});

// Load profile
async function loadProfile(){
  const res = await fetch(`${API_BASE}/me`, { headers: {"Authorization": getToken() } });
  const data = await res.json();
  if (!data.user) return;
  document.getElementById("user-name").innerText = data.user.name || "";
  document.getElementById("profile-name").innerText = data.user.name || "";
  if (data.user.profile_photo) {
    document.getElementById("profile-photo").src = data.user.profile_photo;
    document.getElementById("profile-photo").style.display = "inline-block";
    document.getElementById("profile-photo-large").src = data.user.profile_photo;
    document.getElementById("profile-photo-large").style.display = "block";
  } else {
    document.getElementById("profile-photo").style.display = "none";
  }
}

// Photo upload
document.getElementById("photo-form").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const file = document.getElementById("photo-file").files[0];
  if(!file) return showPopup("Select an image");
  const fd = new FormData(); fd.append("photo", file);
  const res = await fetch(`${API_BASE}/profile/photo`, {
    method:"POST", headers: {"Authorization": getToken()}, body: fd
  });
  const data = await res.json();
  showPopup(data.message || data.error);
  if (data.photo) {
    document.getElementById("profile-photo").src = data.photo;
    document.getElementById("profile-photo-large").src = data.photo;
  }
});

// Load candidates
async function loadCandidates(){
  const res = await fetch(`${API_BASE}/candidates`);
  const data = await res.json();
  const list = document.getElementById("candidates-list");
  list.innerHTML = "";
  (data.candidates || []).forEach(c=>{
    const div = document.createElement("div");
    div.className = "candidate-card";
    div.innerHTML = `
      <img src="images/${c.image}" alt="${c.name}" />
      <h3>${c.name}</h3>
      <p class="muted">${c.party}</p>
      <button class="btn vote-btn" onclick="castVote(${c.id})">Vote</button>
    `;
    list.appendChild(div);
  });
}

// Cast vote
async function castVote(candidateId){
  const res = await fetch(`${API_BASE}/vote`, {
    method:"POST", headers: {"Content-Type":"application/json", "Authorization": getToken()},
    body: JSON.stringify({candidateId})
  });
  const data = await res.json();
  showPopup(data.message || data.error);
}

// View Results (Chart)
async function viewResults(){
  const res = await fetch(`${API_BASE}/results`);
  const data = await res.json();
  const names = data.results.map(r=>r.name);
  const votes = data.results.map(r=>r.vote_count);
  const ctx = document.getElementById("resultsChart").getContext("2d");
  if (window._resultsChart) window._resultsChart.destroy();
  window._resultsChart = new Chart(ctx, {
    type: "bar",
    data: { labels: names, datasets: [{ label: "Votes", data: votes }] },
    options: { responsive: true, maintainAspectRatio: false, scales:{ y:{ beginAtZero:true } } }
  });
  const table = document.getElementById("results-table"); table.innerHTML="";
  data.results.forEach(r => table.innerHTML += `<tr><td>${r.name}</td><td>${r.party}</td><td>${r.vote_count}</td></tr>`);
  showResults();
}

function backToVote(){ showVoting(); }
function logout(){ setToken(null); currentUserId=null; showLogin(); }

// theme toggle
document.getElementById("theme-toggle").addEventListener("click", ()=>{
  document.body.classList.toggle("dark");
});

// init: show register or login if token exists
(function init(){
  if (getToken()) {
    loadProfile().catch(()=>{}); loadCandidates().catch(()=>{});
    showVoting();
  } else {
    showRegister();
  }
})();
