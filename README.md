# EzeeVote Online Voting System 🗳️

A modern online voting platform with secure sign-in, profile verification, election lifecycle management, and an admin control studio.

## 🚀 Why This Project
EzeeVote is designed to make digital elections easier to run and easier to trust.

It includes:
- Citizen voting flow with one-vote-per-election enforcement
- Admin tools to create/manage elections and candidates
- Live results dashboards, CSV export, and activity logs
- Profile verification (KYC-style) before voting

## ✨ Core Features
- 🔐 Google Sign-In authentication (JWT-based session)
- 🧾 Profile verification with live photo capture and identity details
- 🗳️ Election lifecycle support: `draft`, `active`, `closed`, `archived`
- 👥 Candidate management (single create, edit, and CSV bulk import)
- 📢 Broadcast announcements for all users
- 📊 Real-time results, charts, and CSV export
- 🧠 Candidate compare + spotlight + watchlist UX
- 📝 Public feedback module and admin feedback queue
- 🧷 Vote receipts and user voting history timeline
- 🛡️ Admin activity logging for traceability

## 🧱 Tech Stack
- Frontend: HTML, CSS, Vanilla JavaScript, Chart.js, Google Identity Services
- Backend: Node.js, Express, JWT, Multer, Google Auth Library
- Database: SQLite (`backend/voting.db`) with migration system

## 📁 Project Structure
```text
Online-Voting-System/
|- frontend/
|  |- index.html
|  |- app.js
|  |- styles.css
|  `- images/
|- backend/
|  |- server.js
|  |- db.js
|  |- scripts/migrate.js
|  |- migrations/
|  `- voting.db
|- .env.example
`- README.md
```

## ⚙️ Environment Variables
Create `backend/.env` (or copy from `.env.example`) with:

```env
JWT_SECRET=your_generated_secret
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
ADMIN_EMAILS=admin1@example.com,admin2@example.com
PORT=5000
```

Notes:
- `ADMIN_EMAILS` controls who gets admin access after Google login.
- If `PORT=5000` is busy, backend auto-tries `5001` to `5005`.

## 🛠️ Local Setup
1. Install dependencies for backend:
```bash
cd backend
npm install
```

2. Run migrations (safe to run again):
```bash
npm run migrate
```

3. Start backend server:
```bash
npm start
```

4. Run frontend:
- Open `frontend/index.html` using VS Code Live Server (recommended: `http://localhost:5500`).
- The frontend auto-detects local API ports (`5000`, `5001`, `5002`).

## ▶️ NPM Scripts (Backend)
- `npm start` -> Run server
- `npm run dev` -> Run with nodemon
- `npm run migrate` -> Apply pending migrations

## 🔄 Main User Flow
1. User signs in with Google
2. User completes profile verification
3. Active election and candidates are loaded
4. User votes once per election
5. User can view history and receipt

## 🧑‍💼 Admin Capabilities
- Create/update/archive elections
- Duplicate existing elections
- Assign candidates to elections
- Create/edit/import candidates from CSV
- View election and platform analytics
- Publish/deactivate broadcast banners
- Review/update feedback status
- Export election results as CSV

## 🔌 API Snapshot
Public/User:
- `POST /api/google-login`
- `GET /api/me`
- `POST /api/profile/verification`
- `GET /api/elections`
- `GET /api/elections/active`
- `POST /api/elections/:id/vote`
- `GET /api/results`
- `POST /api/feedback`

Admin:
- `POST /api/admin/elections`
- `PUT /api/admin/elections/:id/status`
- `POST /api/admin/candidates`
- `POST /api/admin/candidates/import`
- `GET /api/admin/elections/:id/results.csv`
- `GET /api/admin/activity`
- `POST /api/admin/broadcasts`

## 🔒 Security Notes
- JWT authentication with expiry
- One vote per user per election enforced in DB constraints
- Admin route protection via `is_admin`
- Identity details + verification photo required before voting
- Prefer strong `JWT_SECRET` and HTTPS in production

## 🗺️ Roadmap
- [x] Google authentication
- [x] Election lifecycle + admin management
- [x] Candidate import/export tooling
- [x] Profile verification before voting
- [x] Feedback + broadcast system
- [ ] OTP / MFA support
- [ ] Email or SMS election notifications
- [ ] Full audit report download (PDF)
- [ ] Role granularity (super-admin, moderator)
- [ ] Automated tests and CI pipeline
- [ ] Dockerized one-command deployment

## 🤝 Contributing
1. Fork the repository
2. Create a feature branch
3. Commit with clear messages
4. Open a pull request with a short demo and test notes

## 📄 License
No license file is currently configured. Add one before public distribution.
