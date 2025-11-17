// frontend/app.js
const API_BASE = "https://ezeevote-backend.onrender.com/api";
let currentUserId = null;

function getToken(){ return localStorage.getItem("token"); }
function setToken(t){ if(t) localStorage.setItem("token", t); else localStorage.removeItem("token"); }

function showLogin(){ hideAll(); document.getElementById("login-section").style.display="block"; }
function showRegister(){ hideAll(); document.getElementById("register-section").style.display="block"; }
function hideAll(){ ["register-section","otp-section","login-section","forgot-section","reset-section","profile-section","voting-section","results-section"].forEach(id=>{ const el=document.getElementById(id); if(el) el.style.display="none"; }); }

document.getElementById("register-form").addEventListener("submit", async e=>{
  e.preventDefault();
  const name=document.getElementById("reg-name").value.trim();
  const email=document.getElementById("reg-email").value.trim();
  const password=document.getElementById("reg-password").value;
  if(!name||!email||!password) return alert("All fields required");
  try{
    const res = await fetch(`${API_BASE}/register`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({name,email,password})});
    const data = await res.json();
    alert(data.message || data.error);
    if(data.userId){
      document.getElementById("otp-email").value = email;
      hideAll();
      document.getElementById("otp-section").style.display="block";
    }
  }catch(err){
    console.error(err); alert("Network error");
  }
});

document.getElementById("otp-form").addEventListener("submit", async e=>{
  e.preventDefault();
  const email = document.getElementById("otp-email").value;
  const otp = document.getElementById("otp-code").value;
  const res = await fetch(`${API_BASE}/verify-otp`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({email,otp})});
  const data = await res.json();
  alert(data.message || data.error);
  if(data.message) showLogin();
});

document.getElementById("resend-otp").addEventListener("click", async ()=>{
  const email = document.getElementById("otp-email").value;
  if(!email) return alert("Provide email");
  const res = await fetch(`${API_BASE}/resend-otp`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({email})});
  const data = await res.json();
  alert(data.message || data.error);
});

document.getElementById("login-form").addEventListener("submit", async e=>{
  e.preventDefault();
  const email=document.getElementById("login-email").value;
  const password=document.getElementById("login-password").value;
  const res = await fetch(`${API_BASE}/login`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({email,password})});
  const data = await res.json();
  alert(data.message || data.error);
  if(data.token){
    setToken(data.token);
    currentUserId = data.userId;
    await loadProfile();
    await loadCandidates();
  }
});

document.getElementById("forgot-link").addEventListener("click", e=>{ e.preventDefault(); hideAll(); document.getElementById("forgot-section").style.display="block"; });

document.getElementById("forgot-form").addEventListener("submit", async e=>{
  e.preventDefault();
  const email=document.getElementById("forgot-email").value;
  const res = await fetch(`${API_BASE}/forgot-password`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({email})});
  const data = await res.json(); alert(data.message || data.error);
});

document.getElementById("reset-form").addEventListener("submit", async e=>{
  e.preventDefault();
  const token=document.getElementById("reset-token").value;
  const password=document.getElementById("reset-password").value;
  const res = await fetch(`${API_BASE}/reset-password`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({token,password})});
  const data = await res.json(); alert(data.message || data.error);
  if(data.message) showLogin();
});

async function loadProfile(){
  const res = await fetch(`${API_BASE}/me`, { headers:{ "Authorization": getToken() }});
  const data = await res.json();
  if(!data.user) {
    // no user — show login
    showLogin();
    return;
  }
  hideAll();
  document.getElementById("profile-section").style.display="block";
  document.getElementById("user-name").textContent = data.user.name;
  if(data.user.profile_photo){ const img = document.getElementById("profile-photo"); img.src = data.user.profile_photo; img.style.display="block"; }
}

document.getElementById("photo-form").addEventListener("submit", async e=>{
  e.preventDefault();
  const f = document.getElementById("photo-file").files[0]; if(!f) return alert("Select image");
  const fd = new FormData(); fd.append("photo", f);
  const res = await fetch(`${API_BASE}/profile/photo`, { method:"POST", headers: { "Authorization": getToken() }, body: fd });
  const data = await res.json(); alert(data.message || data.error);
  if(data.photo){ document.getElementById("profile-photo").src = data.photo; document.getElementById("profile-photo").style.display="block"; }
});

async function loadCandidates(){
  hideAll();
  document.getElementById("voting-section").style.display="block";
  const res = await fetch(`${API_BASE}/candidates`);
  const data = await res.json();
  const list = document.getElementById("candidates-list"); list.innerHTML="";
  (data.candidates || []).forEach(c=>{
    const div = document.createElement("div"); div.className="candidate-card";
    const imgSrc = `images/${c.image}`;
    div.innerHTML = `<img src="${imgSrc}" alt="${c.name}" /><h3>${c.name}</h3><p>${c.party}</p><button class="vote-btn">Vote</button>`;
    div.querySelector(".vote-btn").addEventListener("click", ()=>castVote(c.id));
    list.appendChild(div);
  });
}

async function castVote(candidateId){
  const res = await fetch(`${API_BASE}/vote`, { method:"POST", headers:{ "Content-Type":"application/json","Authorization": getToken() }, body: JSON.stringify({ candidateId })});
  const data = await res.json();
  alert(data.message || data.error);
}

function showPopup(msg){ document.getElementById("popup-message").innerText=msg; document.getElementById("popup").style.display="flex"; }
function closePopup(){ document.getElementById("popup").style.display="none"; }

async function viewResults(){
  hideAll(); document.getElementById("results-section").style.display="block";
  const res = await fetch(`${API_BASE}/results`);
  const data = await res.json();
  const names = data.results.map(r=>r.name);
  const votes = data.results.map(r=>r.vote_count);
  // chart.js
  const ctx = document.getElementById("resultsChart");
  if(window.resultsChart) window.resultsChart.destroy();
  window.resultsChart = new Chart(ctx, { type:"bar", data:{ labels:names, datasets:[{ label:"Votes", data:votes }] }, options:{ responsive:true, maintainAspectRatio:false }});
  const table = document.getElementById("results-table"); table.innerHTML = "<tr><th>Candidate</th><th>Party</th><th>Votes</th></tr>";
  data.results.forEach(r=> table.innerHTML += `<tr><td>${r.name}</td><td>${r.party}</td><td>${r.vote_count}</td></tr>`);
}

function backToVote(){ hideAll(); document.getElementById("voting-section").style.display="block"; }
function logout(){ setToken(null); currentUserId = null; showLogin(); }

// theme toggle (persist)
document.getElementById("theme-toggle").addEventListener("click", ()=>{
  document.body.classList.toggle("dark");
});

// initial
showRegister();
