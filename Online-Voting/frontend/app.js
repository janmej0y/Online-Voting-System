
const $ = (s) => document.querySelector(s);
const api = {
  async register(form) {
    const data = Object.fromEntries(new FormData(form));
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  async login(form) {
    const data = Object.fromEntries(new FormData(form));
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  async me() {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const res = await fetch('/api/me', { headers: { 'Authorization': 'Bearer ' + token } });
    if (!res.ok) return null;
    return res.json();
  },
  async status() {
    const token = localStorage.getItem('token');
    if (!token) return { hasVoted: false };
    const res = await fetch('/api/status', { headers: { 'Authorization': 'Bearer ' + token } });
    return res.json();
  },
  async candidates() {
    const res = await fetch('/api/candidates');
    return res.json();
  },
  async vote(candidateId) {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ candidateId })
    });
    return res.json();
  },
  async results() {
    const res = await fetch('/api/results');
    return res.json();
  }
};

function setAuthUI(user) {
  const loggedIn = !!user;
  $('#btnLogout').classList.toggle('hidden', !loggedIn);
  $('#btnShowLogin').classList.toggle('hidden', loggedIn);
  $('#btnShowRegister').classList.toggle('hidden', loggedIn);
  $('#ctaLogin').classList.toggle('hidden', loggedIn);
  $('#ctaRegister').classList.toggle('hidden', loggedIn);
  $('#metricStatus').textContent = loggedIn ? 'Logged in' : 'Guest';
  $('#userName').textContent = loggedIn ? `Welcome, ${user.name}` : '';
}

async function refreshMetrics() {
  const [cands, res] = await Promise.all([api.candidates(), api.results()]);
  $('#metricCandidates').textContent = cands.length;
  const totalVotes = res.reduce((a, r) => a + Number(r.votes || 0), 0);
  $('#metricVotes').textContent = totalVotes;
}

async function renderCandidates() {
  const [cands, status] = await Promise.all([api.candidates(), api.status()]);
  const grid = $('#candidatesGrid');
  grid.innerHTML = '';
  cands.forEach(c => {
    const card = document.createElement('div');
    card.className = 'glass rounded-2xl border border-white/10 p-4 flex flex-col';
    card.innerHTML = `
      <img src="${c.avatar_url}" alt="${c.name}" class="w-full h-40 object-cover rounded-xl mb-3">
      <h4 class="text-xl font-bold">${c.name}</h4>
      <p class="text-white/70 mb-4">${c.party || ''}</p>
      <button data-id="${c.id}" class="btnVote mt-auto px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 transition">Vote</button>
    `;
    const btn = card.querySelector('.btnVote');
    if (status.hasVoted) {
      btn.disabled = true;
      btn.textContent = status.candidateId === c.id ? 'You voted here' : 'Voting closed';
      btn.classList.add('opacity-60', 'cursor-not-allowed');
    } else if (!localStorage.getItem('token')) {
      btn.disabled = true;
      btn.textContent = 'Login to vote';
      btn.classList.add('opacity-60', 'cursor-not-allowed');
    } else {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        const out = await api.vote(c.id);
        if (out.success) {
          $('#voteMsg').textContent = 'Vote recorded!';
          await renderCandidates();
          await renderResults();
          await refreshMetrics();
        } else {
          $('#voteMsg').textContent = out.error || 'Failed to vote.';
          btn.disabled = false;
        }
      });
    }
    grid.appendChild(card);
  });
}

async function renderResults() {
  const data = await api.results();
  const wrap = $('#results');
  wrap.innerHTML = '';
  data.forEach((row, i) => {
    const div = document.createElement('div');
    div.className = 'glass rounded-2xl border border-white/10 p-4';
    div.innerHTML = `
      <div class="flex items-center gap-3">
        <img src="${row.avatar_url}" class="w-12 h-12 rounded-xl object-cover"/>
        <div>
          <p class="font-bold">${row.name}</p>
          <p class="text-white/70 text-sm">${row.party || ''}</p>
        </div>
        <div class="ml-auto text-2xl font-extrabold">${row.votes}</div>
      </div>
      <div class="mt-3 w-full h-2 rounded-full bg-white/10 overflow-hidden">
        <div class="h-2 bg-gradient-to-r from-violet-500 via-cyan-400 to-emerald-400" style="width:${data[0].votes ? Math.min(100, (row.votes / data[0].votes) * 100) : 0}%"></div>
      </div>
    `;
    wrap.appendChild(div);
  });
}

async function bootstrap() {
  $('#year').textContent = new Date().getFullYear();

  // Buttons
  $('#btnShowRegister').onclick = () => window.scrollTo({ top: document.querySelector('#formRegister').getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
  $('#btnShowLogin').onclick = () => window.scrollTo({ top: document.querySelector('#formLogin').getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
  $('#ctaRegister').onclick = () => document.querySelector('#btnShowRegister').onclick();
  $('#ctaLogin').onclick = () => document.querySelector('#btnShowLogin').onclick();
  $('#btnLogout').onclick = () => { localStorage.removeItem('token'); setAuthUI(null); renderCandidates(); };

  // Register
  $('#formRegister').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#registerMsg').textContent = 'Creating account...';
    const out = await api.register(e.target);
    if (out.success) {
      $('#registerMsg').textContent = 'Account created. Please login.';
      e.target.reset();
    } else {
      $('#registerMsg').textContent = out.error || 'Registration failed.';
    }
  });

  // Login
  $('#formLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#loginMsg').textContent = 'Checking credentials...';
    const out = await api.login(e.target);
    if (out.token) {
      localStorage.setItem('token', out.token);
      const me = await api.me();
      setAuthUI(me);
      $('#loginMsg').textContent = 'Logged in.';
      await renderCandidates();
    } else {
      $('#loginMsg').textContent = out.error || 'Login failed.';
    }
  });

  // Initialize UI
  const me = await api.me();
  setAuthUI(me);
  await refreshMetrics();
  await renderCandidates();
  await renderResults();
}

bootstrap();
