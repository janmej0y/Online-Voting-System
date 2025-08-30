
# PulseVote — Online Voting System

A simple, secure online voting system with **registration**, **login**, **one-vote-per-user** enforcement, and **live results**. Built with **Node.js + Express + SQLite** and a clean **Tailwind (CDN)** frontend.

## Features
- New user desk (registration). Unique email prevents re-registering.
- Login with JWT auth (stored client-side).
- List of candidates with photos and parties.
- Cast exactly one vote per account (enforced in DB).
- Live results aggregation.
- Vibrant, professional UI.

## Tech
- Backend: Node.js, Express, SQLite3, bcryptjs, jsonwebtoken
- Frontend: HTML + Tailwind (CDN) + vanilla JS
- Database: SQLite (file-based) for easy setup. For production scale, use **PostgreSQL**; see notes below.

## Quick Start

1. **Install Node.js** (v18+ recommended).

2. Open a terminal in `backend/` and install packages:
   ```bash
   cd backend
   npm install
   ```

3. (Optional) set a stronger JWT secret:
   ```bash
   export JWT_SECRET="super-strong-secret"
   ```
   On Windows (Powershell):
   ```powershell
   setx JWT_SECRET "super-strong-secret"
   ```

4. **Run the server** (serves the frontend too):
   ```bash
   npm start
   ```

5. Visit **http://localhost:3000** in your browser.

## Where to put your GitHub & LinkedIn links
Open `frontend/index.html` and replace the placeholders:
```html
<a id="githubLink" href="YOUR_GITHUB_URL" ...>GitHub</a>
<a id="linkedinLink" href="YOUR_LINKEDIN_URL" ...>LinkedIn</a>
```

## How it works

### Database schema
- `users` (id, name, email UNIQUE, password_hash, created_at)
- `candidates` (id, name, party, avatar_url) — auto-seeded with 3 sample candidates
- `votes` (id, user_id UNIQUE, candidate_id, created_at)

The `user_id UNIQUE` in `votes` guarantees **one vote per user** at the database level.

### API endpoints
- `POST /api/register` – create account; blocks duplicate emails
- `POST /api/login` – returns JWT token
- `GET /api/me` – current user profile (requires Bearer token)
- `GET /api/status` – has the user voted? (requires token)
- `GET /api/candidates` – list candidates
- `POST /api/vote` – cast vote (requires token); prevents duplicates
- `GET /api/results` – aggregated votes per candidate

### Switching to PostgreSQL (recommended for production)
SQLite is perfect for development and single-machine deployments. If you expect **concurrent writes at scale** or need **cloud hosting**, move to **PostgreSQL**. Minimal changes:
- Replace `sqlite3` dependency with `pg` (node-postgres).
- Update `db.js` to create a `Pool` and run the same SQL with PostgreSQL syntax (almost identical here).
- Ensure unique constraints and foreign keys are preserved.
- Use a managed Postgres service (e.g., Railway, Supabase, Render) and set `DATABASE_URL` env var.

### Security notes
- Passwords are hashed with **bcrypt** (10 rounds). Never store plain text passwords.
- JWT expires in 7 days; store it in `localStorage` for this demo (consider using HttpOnly cookies for higher security).
- Use HTTPS in production and set a strong `JWT_SECRET`.
- Add rate limiting and validation libraries if exposing publicly.

## Folder structure
```
online-voting/
├── backend/
│   ├── package.json
│   ├── server.js
│   └── db.js
└── frontend/
    ├── index.html
    ├── app.js
    └── styles.css
```

---

Built on 2025-08-30.
