require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { OAuth2Client } = require("google-auth-library");
const db = require("./db");

const app = express();
app.use(bodyParser.json({ limit: "2mb" }));

const allowedOrigins = [
  "https://online-voting-system-henna.vercel.app",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) res.header("Access-Control-Allow-Origin", origin);
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use("/images", express.static(path.join(__dirname, "../frontend/images")));
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
app.use("/uploads", express.static(UPLOAD_DIR));

const JWT_SECRET = process.env.JWT_SECRET || "SUPER_SECRET_KEY";
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "2h" });
}
function extractToken(req) {
  const header = req.headers.authorization;
  if (!header) return null;
  return header.startsWith("Bearer ") ? header.slice(7) : header;
}
function auth(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: "Missing token" });
  jwt.verify(token, JWT_SECRET, (error, decoded) => {
    if (error) return res.status(401).json({ error: "Invalid token" });
    req.userId = decoded.id;
    next();
  });
}
function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}
function isAdminEmail(email) {
  return email ? ADMIN_EMAILS.includes(email.toLowerCase()) : false;
}
async function requireAdmin(req, res, next) {
  try {
    const user = await db.get("SELECT id, is_admin FROM users WHERE id=?", [req.userId]);
    if (!user) return res.status(401).json({ error: "User not found" });
    if (!user.is_admin) return res.status(403).json({ error: "Admin access required" });
    next();
  } catch (error) {
    next(error);
  }
}
async function logAdminActivity(adminUserId, action, details = null) {
  await db.run("INSERT INTO admin_activity_logs (admin_user_id, action, details) VALUES (?,?,?)", [
    adminUserId,
    action,
    details ? JSON.stringify(details) : null
  ]);
}
function parseDateOrNull(value) {
  if (!value) return null;
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}
function toBool(v) {
  return v === true || v === "true" || v === 1 || v === "1";
}
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
function buildVoteReceipt(electionId, voteId) {
  return `EV-${String(electionId).padStart(4, "0")}-${String(voteId).padStart(8, "0")}`;
}
function normalizeDigits(value) {
  return String(value || "").replace(/\D/g, "");
}
function normalizeVoterCard(value) {
  return String(value || "").trim().toUpperCase();
}
function isUserProfileComplete(user) {
  return Boolean(
    user &&
      user.phone &&
      user.date_of_birth &&
      user.address_line1 &&
      user.city &&
      user.state_name &&
      user.postal_code &&
      user.voter_card_number &&
      user.aadhaar_number &&
      user.verification_photo
  );
}
function sanitizeUser(user) {
  if (!user) return null;
  return {
    ...user,
    profileComplete: isUserProfileComplete(user)
  };
}

async function getElectionById(id) {
  return db.get("SELECT * FROM elections WHERE id=?", [id]);
}
async function getActiveElection() {
  return db.get("SELECT * FROM elections WHERE status='active' AND is_archived=0 ORDER BY datetime(starts_at) DESC, id DESC LIMIT 1");
}
async function getElectionCandidates(electionId) {
  return db.all(
    "SELECT c.id,c.name,c.party,c.symbol,c.image,c.bio,c.manifesto_url FROM election_candidates ec JOIN candidates c ON c.id=ec.candidate_id WHERE ec.election_id=? ORDER BY c.name ASC",
    [electionId]
  );
}
async function getResultsForElection(electionId) {
  return db.all(
    "SELECT c.id,c.name,c.party,c.symbol,c.image,COUNT(v.id) AS vote_count FROM election_candidates ec JOIN candidates c ON c.id=ec.candidate_id LEFT JOIN votes v ON v.candidate_id=c.id AND v.election_id=ec.election_id WHERE ec.election_id=? GROUP BY c.id,c.name,c.party,c.symbol,c.image ORDER BY vote_count DESC,c.name ASC",
    [electionId]
  );
}
function isElectionOpen(e) {
  if (!e || e.status !== "active" || Number(e.is_archived) === 1) return false;
  const now = Date.now();
  if (e.starts_at) {
    const starts = new Date(e.starts_at).getTime();
    if (!Number.isNaN(starts) && now < starts) return false;
  }
  if (e.ends_at) {
    const ends = new Date(e.ends_at).getTime();
    if (!Number.isNaN(ends) && now > ends) return false;
  }
  return true;
}

async function getElectionSummaryRows({ includeArchived = false, status = null, q = null, page = 1, pageSize = 25 }) {
  const where = [];
  const params = [];
  if (!includeArchived) where.push("e.is_archived=0");
  if (status && ["draft", "active", "closed"].includes(status)) {
    where.push("e.status=?");
    params.push(status);
  }
  if (q && q.trim()) {
    where.push("(LOWER(e.title) LIKE ? OR LOWER(COALESCE(e.description,'')) LIKE ?)");
    params.push(`%${q.trim().toLowerCase()}%`, `%${q.trim().toLowerCase()}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const offset = (page - 1) * pageSize;
  const totalRow = await db.get(`SELECT COUNT(*) AS c FROM elections e ${whereSql}`, params);
  const rows = await db.all(
    `SELECT
      e.*,
      COALESCE(v.total_votes, 0) AS total_votes,
      COALESCE(v.turnout, 0) AS turnout,
      COALESCE(ec.candidate_count, 0) AS candidate_count
     FROM elections e
     LEFT JOIN (
       SELECT election_id, COUNT(*) AS total_votes, COUNT(DISTINCT user_id) AS turnout
       FROM votes
       GROUP BY election_id
     ) v ON v.election_id=e.id
     LEFT JOIN (
       SELECT election_id, COUNT(*) AS candidate_count
       FROM election_candidates
       GROUP BY election_id
     ) ec ON ec.election_id=e.id
     ${whereSql}
     ORDER BY datetime(e.created_at) DESC,e.id DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  return {
    rows,
    pagination: {
      page,
      pageSize,
      total: totalRow ? totalRow.c : 0,
      totalPages: Math.max(1, Math.ceil((totalRow ? totalRow.c : 0) / pageSize))
    }
  };
}

function parseCsvRows(csvText) {
  const lines = String(csvText || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  if (!lines.length) return [];
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = {
    name: header.indexOf("name"),
    party: header.indexOf("party"),
    symbol: header.indexOf("symbol"),
    image: header.indexOf("image"),
    bio: header.indexOf("bio"),
    manifesto_url: header.indexOf("manifesto_url")
  };
  const withHeader = idx.name !== -1 && idx.party !== -1;
  const dataLines = withHeader ? lines.slice(1) : lines;
  return dataLines
    .map((line) => line.split(",").map((v) => v.trim()))
    .map((cols) => ({
      name: cols[idx.name >= 0 ? idx.name : 0] || "",
      party: cols[idx.party >= 0 ? idx.party : 1] || "",
      symbol: cols[idx.symbol >= 0 ? idx.symbol : 2] || null,
      image: cols[idx.image >= 0 ? idx.image : 3] || null,
      bio: cols[idx.bio >= 0 ? idx.bio : 4] || null,
      manifesto_url: cols[idx.manifesto_url >= 0 ? idx.manifesto_url : 5] || null
    }))
    .filter((row) => row.name && row.party);
}

async function castVoteForElection({ userId, electionId, candidateId }) {
  const user = await db.get(
    `SELECT id,phone,date_of_birth,address_line1,city,state_name,postal_code,voter_card_number,aadhaar_number,verification_photo
     FROM users WHERE id=?`,
    [userId]
  );
  if (!user) return { status: 401, body: { error: "User not found" } };
  if (!isUserProfileComplete(user)) {
    return {
      status: 403,
      body: { error: "Complete profile verification before voting" }
    };
  }

  const election = await getElectionById(electionId);
  if (!election) return { status: 404, body: { error: "Election not found" } };
  if (!isElectionOpen(election)) return { status: 400, body: { error: "Election is not open for voting" } };
  const candidate = await db.get("SELECT 1 FROM election_candidates WHERE election_id=? AND candidate_id=?", [
    electionId,
    candidateId
  ]);
  if (!candidate) return { status: 400, body: { error: "Candidate not part of this election" } };

  try {
    const insert = await db.transaction(async () =>
      db.run("INSERT INTO votes (user_id,candidate_id,election_id) VALUES (?,?,?)", [userId, candidateId, electionId])
    );
    return {
      status: 200,
      body: {
        message: "Vote cast successfully",
        election: { id: election.id, title: election.title },
        voteId: insert.lastID,
        receipt: buildVoteReceipt(election.id, insert.lastID)
      }
    };
  } catch (error) {
    if (String(error.message).includes("UNIQUE constraint failed: votes.user_id, votes.election_id")) {
      return { status: 409, body: { error: "Already voted in this election" } };
    }
    throw error;
  }
}

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname || "");
    cb(null, "user_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8) + ext);
  }
});
const upload = multer({ storage });

app.get("/", (_, res) => res.send("EzeeVote backend running"));

app.post("/api/google-login", asyncHandler(async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: "No Google token" });
  const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  const googleId = payload.sub;
  const name = payload.name;
  const email = payload.email;
  const photo = payload.picture;

  let user = await db.get("SELECT * FROM users WHERE google_id=? OR email=?", [googleId, email]);
  if (!user) {
    const created = await db.run(
      "INSERT INTO users (name,email,google_id,profile_photo,is_admin) VALUES (?,?,?,?,?)",
      [name, email, googleId, photo, isAdminEmail(email) ? 1 : 0]
    );
    user = await db.get("SELECT * FROM users WHERE id=?", [created.lastID]);
  } else {
    const shouldBeAdmin = isAdminEmail(email) ? 1 : user.is_admin;
    await db.run(
      "UPDATE users SET name=?, email=?, google_id=?, profile_photo=COALESCE(?,profile_photo), is_admin=? WHERE id=?",
      [name, email, googleId, photo, shouldBeAdmin, user.id]
    );
    user = await db.get("SELECT * FROM users WHERE id=?", [user.id]);
  }

  res.json({ token: signToken({ id: user.id }), userId: user.id, isAdmin: Boolean(user.is_admin) });
}));

app.get("/api/me", auth, asyncHandler(async (req, res) => {
  const user = await db.get(
    `SELECT
      id,name,email,profile_photo,is_admin,created_at,
      phone,date_of_birth,gender,address_line1,city,state_name,postal_code,
      voter_card_number,aadhaar_number,verification_photo,profile_completed_at
     FROM users WHERE id=?`,
    [req.userId]
  );
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: sanitizeUser(user) });
}));

app.post("/api/profile/verification", auth, upload.single("verificationPhoto"), asyncHandler(async (req, res) => {
  const fullName = req.body.fullName ? String(req.body.fullName).trim() : "";
  const phone = normalizeDigits(req.body.phone);
  const dateOfBirth = req.body.dateOfBirth ? String(req.body.dateOfBirth).trim() : "";
  const gender = req.body.gender ? String(req.body.gender).trim() : null;
  const addressLine1 = req.body.addressLine1 ? String(req.body.addressLine1).trim() : "";
  const city = req.body.city ? String(req.body.city).trim() : "";
  const stateName = req.body.stateName ? String(req.body.stateName).trim() : "";
  const postalCode = normalizeDigits(req.body.postalCode);
  const voterCardNumber = normalizeVoterCard(req.body.voterCardNumber);
  const aadhaarNumber = normalizeDigits(req.body.aadhaarNumber);

  if (!fullName || !phone || !dateOfBirth || !addressLine1 || !city || !stateName || !postalCode || !voterCardNumber || !aadhaarNumber) {
    return res.status(400).json({ error: "All profile fields are required" });
  }
  if (!/^\d{10}$/.test(phone)) return res.status(400).json({ error: "Phone must be 10 digits" });
  if (!/^\d{6}$/.test(postalCode)) return res.status(400).json({ error: "Postal code must be 6 digits" });
  if (!/^\d{12}$/.test(aadhaarNumber)) return res.status(400).json({ error: "Aadhaar number must be 12 digits" });
  if (!/^[A-Z]{3}[0-9]{7}$/.test(voterCardNumber)) {
    return res.status(400).json({ error: "Voter card number must be in format ABC1234567" });
  }
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return res.status(400).json({ error: "Invalid date of birth" });
  const adultCutoff = new Date();
  adultCutoff.setFullYear(adultCutoff.getFullYear() - 18);
  if (dob > adultCutoff) return res.status(400).json({ error: "User must be at least 18 years old" });

  const existing = await db.get("SELECT verification_photo FROM users WHERE id=?", [req.userId]);
  if (!existing) return res.status(404).json({ error: "User not found" });
  if (!req.file && !existing.verification_photo) {
    return res.status(400).json({ error: "Live verification photo is required" });
  }
  const verificationPhoto = req.file ? `/uploads/${req.file.filename}` : existing.verification_photo;

  try {
    await db.run(
      `UPDATE users
       SET name=?, phone=?, date_of_birth=?, gender=?, address_line1=?, city=?, state_name=?, postal_code=?,
           voter_card_number=?, aadhaar_number=?, verification_photo=?, profile_completed_at=CURRENT_TIMESTAMP
       WHERE id=?`,
      [
        fullName,
        phone,
        dob.toISOString(),
        gender,
        addressLine1,
        city,
        stateName,
        postalCode,
        voterCardNumber,
        aadhaarNumber,
        verificationPhoto,
        req.userId
      ]
    );
  } catch (error) {
    const msg = String(error.message || "");
    if (msg.includes("users.voter_card_number") || msg.includes("ux_users_voter_card_non_null")) {
      return res.status(409).json({ error: "Voter card number already exists" });
    }
    if (msg.includes("users.aadhaar_number") || msg.includes("ux_users_aadhaar_non_null")) {
      return res.status(409).json({ error: "Aadhaar number already exists" });
    }
    throw error;
  }

  const user = await db.get(
    `SELECT
      id,name,email,profile_photo,is_admin,created_at,
      phone,date_of_birth,gender,address_line1,city,state_name,postal_code,
      voter_card_number,aadhaar_number,verification_photo,profile_completed_at
     FROM users WHERE id=?`,
    [req.userId]
  );
  res.json({ message: "Profile verification completed", user: sanitizeUser(user) });
}));

app.get("/api/me/history", auth, asyncHandler(async (req, res) => {
  const rows = await db.all(
    `SELECT v.id AS vote_id,v.created_at AS voted_at,e.id AS election_id,e.title AS election_title,c.id AS candidate_id,c.name AS candidate_name,c.party AS candidate_party
     FROM votes v JOIN elections e ON e.id=v.election_id JOIN candidates c ON c.id=v.candidate_id WHERE v.user_id=? ORDER BY datetime(v.created_at) DESC,v.id DESC`,
    [req.userId]
  );
  res.json({ history: rows.map((r) => ({ ...r, receipt: buildVoteReceipt(r.election_id, r.vote_id) })) });
}));

app.post("/api/profile/photo", auth, upload.single("photo"), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const photoPath = "/uploads/" + req.file.filename;
  await db.run("UPDATE users SET profile_photo=? WHERE id=?", [photoPath, req.userId]);
  res.json({ message: "Photo updated", photo: photoPath });
}));

app.get("/api/notifications/current", asyncHandler(async (_, res) => {
  const broadcast = await db.get("SELECT id,message,created_at,updated_at FROM broadcast_messages WHERE active=1 ORDER BY datetime(updated_at) DESC,id DESC LIMIT 1");
  res.json({ broadcast: broadcast || null });
}));

app.get("/api/elections", asyncHandler(async (req, res) => {
  const includeArchived = toBool(req.query.includeArchived);
  const status = typeof req.query.status === "string" ? req.query.status : null;
  const q = typeof req.query.q === "string" ? req.query.q : null;
  const page = clamp(Number(req.query.page) || 1, 1, 99999);
  const pageSize = clamp(Number(req.query.pageSize) || 25, 1, 100);
  const result = await getElectionSummaryRows({ includeArchived, status, q, page, pageSize });
  res.json({ elections: result.rows, pagination: result.pagination });
}));

app.get("/api/elections/active", asyncHandler(async (_, res) => {
  const election = await getActiveElection();
  if (!election) return res.status(404).json({ error: "No active election" });
  const candidates = await getElectionCandidates(election.id);
  res.json({ election, candidates });
}));

app.get("/api/elections/:id/candidates", asyncHandler(async (req, res) => {
  const electionId = Number(req.params.id);
  if (!Number.isInteger(electionId)) return res.status(400).json({ error: "Invalid election id" });
  const election = await getElectionById(electionId);
  if (!election) return res.status(404).json({ error: "Election not found" });
  res.json({ election, candidates: await getElectionCandidates(electionId) });
}));

app.get("/api/candidates", asyncHandler(async (_, res) => {
  const election = await getActiveElection();
  if (election) return res.json({ election, candidates: await getElectionCandidates(election.id) });
  const candidates = await db.all("SELECT id,name,party,symbol,image,bio,manifesto_url FROM candidates ORDER BY name ASC");
  res.json({ candidates });
}));

app.get("/api/status", auth, asyncHandler(async (req, res) => {
  const electionId = req.query.electionId ? Number(req.query.electionId) : null;
  const election = electionId ? await getElectionById(electionId) : await getActiveElection();
  if (!election) return res.json({ hasVoted: false, election: null });
  const vote = await db.get("SELECT 1 FROM votes WHERE user_id=? AND election_id=?", [req.userId, election.id]);
  res.json({ hasVoted: Boolean(vote), election: { id: election.id, title: election.title } });
}));

app.post("/api/elections/:id/vote", auth, asyncHandler(async (req, res) => {
  const electionId = Number(req.params.id);
  const candidateId = Number(req.body.candidateId);
  if (!Number.isInteger(electionId)) return res.status(400).json({ error: "Invalid election id" });
  if (!Number.isInteger(candidateId)) return res.status(400).json({ error: "candidateId required" });
  const result = await castVoteForElection({ userId: req.userId, electionId, candidateId });
  res.status(result.status).json(result.body);
}));

app.post("/api/vote", auth, asyncHandler(async (req, res) => {
  const candidateId = Number(req.body.candidateId);
  if (!Number.isInteger(candidateId)) return res.status(400).json({ error: "candidateId required" });
  const election = await getActiveElection();
  if (!election) return res.status(404).json({ error: "No active election" });
  const result = await castVoteForElection({ userId: req.userId, electionId: election.id, candidateId });
  res.status(result.status).json(result.body);
}));

app.get("/api/results", asyncHandler(async (req, res) => {
  const hasElectionId = req.query.electionId !== undefined;
  const electionId = hasElectionId ? Number(req.query.electionId) : null;
  if (hasElectionId && !Number.isInteger(electionId)) return res.status(400).json({ error: "Invalid electionId" });
  const election = hasElectionId ? await getElectionById(electionId) : await getActiveElection();
  if (!election) return res.status(404).json({ error: "Election not found" });
  res.json({ election, results: await getResultsForElection(election.id) });
}));

app.get("/api/analytics/overview", asyncHandler(async (req, res) => {
  const hasElectionId = req.query.electionId !== undefined;
  const electionId = hasElectionId ? Number(req.query.electionId) : null;
  if (hasElectionId && !Number.isInteger(electionId)) return res.status(400).json({ error: "Invalid electionId" });
  const election = hasElectionId ? await getElectionById(electionId) : await getActiveElection();
  if (!election) return res.status(404).json({ error: "Election not found" });

  const [totalUsersRow, turnoutRow, timeline, partyBreakdown] = await Promise.all([
    db.get("SELECT COUNT(*) AS c FROM users"),
    db.get("SELECT COUNT(*) AS total_votes, COUNT(DISTINCT user_id) AS turnout FROM votes WHERE election_id=?", [
      election.id
    ]),
    db.all("SELECT DATE(created_at) AS day, COUNT(*) AS votes FROM votes WHERE election_id=? GROUP BY DATE(created_at) ORDER BY DATE(created_at) ASC", [election.id]),
    db.all("SELECT c.party, COUNT(v.id) AS votes FROM votes v JOIN candidates c ON c.id=v.candidate_id WHERE v.election_id=? GROUP BY c.party ORDER BY votes DESC", [election.id])
  ]);

  const totalUsers = totalUsersRow ? Number(totalUsersRow.c) : 0;
  const turnout = turnoutRow ? Number(turnoutRow.turnout) : 0;
  const turnoutRate = totalUsers > 0 ? Number(((turnout / totalUsers) * 100).toFixed(2)) : 0;

  res.json({
    election,
    metrics: { totalUsers, totalVotes: turnoutRow ? Number(turnoutRow.total_votes) : 0, turnout, turnoutRate },
    timeline,
    partyBreakdown
  });
}));

app.post("/api/feedback", auth, asyncHandler(async (req, res) => {
  const category = req.body.category ? String(req.body.category).trim() : "";
  const message = req.body.message ? String(req.body.message).trim() : "";
  if (!category) return res.status(400).json({ error: "category is required" });
  if (!message) return res.status(400).json({ error: "message is required" });

  const inserted = await db.run(
    "INSERT INTO public_feedback (user_id,category,message,status,updated_at) VALUES (?,?,?,'new',CURRENT_TIMESTAMP)",
    [req.userId, category, message]
  );
  res.status(201).json({
    feedback: await db.get(
      "SELECT id,user_id,category,message,status,admin_note,created_at,updated_at FROM public_feedback WHERE id=?",
      [inserted.lastID]
    )
  });
}));

app.get("/api/admin/elections", auth, requireAdmin, asyncHandler(async (req, res) => {
  const includeArchived = toBool(req.query.includeArchived);
  const status = typeof req.query.status === "string" ? req.query.status : null;
  const q = typeof req.query.q === "string" ? req.query.q : null;
  const page = clamp(Number(req.query.page) || 1, 1, 99999);
  const pageSize = clamp(Number(req.query.pageSize) || 25, 1, 100);
  const result = await getElectionSummaryRows({ includeArchived, status, q, page, pageSize });
  res.json({ elections: result.rows, pagination: result.pagination });
}));

app.post("/api/admin/elections", auth, requireAdmin, asyncHandler(async (req, res) => {
  const { title, description = null, startsAt = null, endsAt = null, status = "draft" } = req.body;
  const candidateIds = Array.isArray(req.body.candidateIds) ? req.body.candidateIds : [];
  if (!title || typeof title !== "string") return res.status(400).json({ error: "title is required" });
  if (!["draft", "active", "closed"].includes(status)) return res.status(400).json({ error: "Invalid status" });

  const normalizedStart = startsAt ? parseDateOrNull(startsAt) : null;
  const normalizedEnd = endsAt ? parseDateOrNull(endsAt) : null;
  if (startsAt && !normalizedStart) return res.status(400).json({ error: "Invalid startsAt" });
  if (endsAt && !normalizedEnd) return res.status(400).json({ error: "Invalid endsAt" });

  const electionId = await db.transaction(async () => {
    if (status === "active") {
      await db.run("UPDATE elections SET status='closed', updated_at=CURRENT_TIMESTAMP WHERE status='active' AND is_archived=0");
    }
    const created = await db.run(
      "INSERT INTO elections (title,description,status,starts_at,ends_at,is_archived) VALUES (?,?,?,?,?,0)",
      [title.trim(), description, status, normalizedStart, normalizedEnd]
    );
    for (const rawId of candidateIds) {
      const candidateId = Number(rawId);
      if (!Number.isInteger(candidateId)) continue;
      await db.run("INSERT OR IGNORE INTO election_candidates (election_id,candidate_id) SELECT ?,id FROM candidates WHERE id=?", [created.lastID, candidateId]);
    }
    return created.lastID;
  });

  await logAdminActivity(req.userId, "election.created", { electionId, title: title.trim() });
  res.status(201).json({ election: await getElectionById(electionId) });
}));

app.post("/api/admin/elections/:id/duplicate", auth, requireAdmin, asyncHandler(async (req, res) => {
  const electionId = Number(req.params.id);
  if (!Number.isInteger(electionId)) return res.status(400).json({ error: "Invalid election id" });
  const original = await getElectionById(electionId);
  if (!original) return res.status(404).json({ error: "Election not found" });

  const title = req.body.title && String(req.body.title).trim() ? String(req.body.title).trim() : `${original.title} (Copy)`;
  const activate = toBool(req.body.activate);

  const newElectionId = await db.transaction(async () => {
    if (activate) {
      await db.run("UPDATE elections SET status='closed', updated_at=CURRENT_TIMESTAMP WHERE status='active' AND is_archived=0");
    }
    const inserted = await db.run(
      "INSERT INTO elections (title,description,status,starts_at,ends_at,is_archived) VALUES (?,?,?,?,?,0)",
      [title, original.description, activate ? "active" : "draft", original.starts_at, original.ends_at]
    );
    await db.run("INSERT INTO election_candidates (election_id,candidate_id) SELECT ?,candidate_id FROM election_candidates WHERE election_id=?", [inserted.lastID, electionId]);
    return inserted.lastID;
  });

  await logAdminActivity(req.userId, "election.duplicated", { sourceElectionId: electionId, newElectionId, activate });
  res.status(201).json({ election: await getElectionById(newElectionId) });
}));

app.put("/api/admin/elections/:id/archive", auth, requireAdmin, asyncHandler(async (req, res) => {
  const electionId = Number(req.params.id);
  if (!Number.isInteger(electionId)) return res.status(400).json({ error: "Invalid election id" });
  const election = await getElectionById(electionId);
  if (!election) return res.status(404).json({ error: "Election not found" });
  const archived = toBool(req.body.archived);

  await db.transaction(async () => {
    if (archived && election.status === "active") {
      await db.run("UPDATE elections SET status='closed', updated_at=CURRENT_TIMESTAMP WHERE id=?", [electionId]);
    }
    await db.run("UPDATE elections SET is_archived=?, updated_at=CURRENT_TIMESTAMP WHERE id=?", [archived ? 1 : 0, electionId]);
  });

  await logAdminActivity(req.userId, archived ? "election.archived" : "election.unarchived", { electionId });
  res.json({ election: await getElectionById(electionId) });
}));

app.put("/api/admin/elections/:id", auth, requireAdmin, asyncHandler(async (req, res) => {
  const electionId = Number(req.params.id);
  if (!Number.isInteger(electionId)) return res.status(400).json({ error: "Invalid election id" });
  const existing = await getElectionById(electionId);
  if (!existing) return res.status(404).json({ error: "Election not found" });

  const updates = [];
  const params = [];
  if (typeof req.body.title === "string" && req.body.title.trim()) { updates.push("title=?"); params.push(req.body.title.trim()); }
  if (req.body.description !== undefined) { updates.push("description=?"); params.push(req.body.description); }
  if (req.body.startsAt !== undefined) {
    const startsAt = req.body.startsAt ? parseDateOrNull(req.body.startsAt) : null;
    if (req.body.startsAt && !startsAt) return res.status(400).json({ error: "Invalid startsAt" });
    updates.push("starts_at=?"); params.push(startsAt);
  }
  if (req.body.endsAt !== undefined) {
    const endsAt = req.body.endsAt ? parseDateOrNull(req.body.endsAt) : null;
    if (req.body.endsAt && !endsAt) return res.status(400).json({ error: "Invalid endsAt" });
    updates.push("ends_at=?"); params.push(endsAt);
  }
  if (req.body.status !== undefined) {
    if (!["draft", "active", "closed"].includes(req.body.status)) return res.status(400).json({ error: "Invalid status" });
    if (req.body.status === "active") {
      await db.run("UPDATE elections SET status='closed', updated_at=CURRENT_TIMESTAMP WHERE status='active' AND id!=? AND is_archived=0", [electionId]);
    }
    updates.push("status=?"); params.push(req.body.status);
  }
  if (!updates.length) return res.status(400).json({ error: "No valid fields to update" });

  params.push(electionId);
  await db.run(`UPDATE elections SET ${updates.join(",")}, updated_at=CURRENT_TIMESTAMP WHERE id=?`, params);
  await logAdminActivity(req.userId, "election.updated", { electionId });
  res.json({ election: await getElectionById(electionId) });
}));

app.put("/api/admin/elections/:id/status", auth, requireAdmin, asyncHandler(async (req, res) => {
  const electionId = Number(req.params.id);
  const { status } = req.body;
  if (!Number.isInteger(electionId)) return res.status(400).json({ error: "Invalid election id" });
  if (!["draft", "active", "closed"].includes(status)) return res.status(400).json({ error: "Invalid status" });
  const election = await getElectionById(electionId);
  if (!election) return res.status(404).json({ error: "Election not found" });

  await db.transaction(async () => {
    if (status === "active") {
      await db.run("UPDATE elections SET status='closed', updated_at=CURRENT_TIMESTAMP WHERE status='active' AND id!=? AND is_archived=0", [electionId]);
    }
    await db.run("UPDATE elections SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?", [status, electionId]);
  });

  await logAdminActivity(req.userId, "election.status_changed", { electionId, status });
  res.json({ election: await getElectionById(electionId) });
}));

app.get("/api/admin/elections/:id/candidates", auth, requireAdmin, asyncHandler(async (req, res) => {
  const electionId = Number(req.params.id);
  if (!Number.isInteger(electionId)) return res.status(400).json({ error: "Invalid election id" });
  const election = await getElectionById(electionId);
  if (!election) return res.status(404).json({ error: "Election not found" });
  res.json({ election, candidates: await getElectionCandidates(electionId) });
}));

app.post("/api/admin/elections/:id/candidates", auth, requireAdmin, asyncHandler(async (req, res) => {
  const electionId = Number(req.params.id);
  const { candidateIds } = req.body;
  if (!Number.isInteger(electionId)) return res.status(400).json({ error: "Invalid election id" });
  if (!Array.isArray(candidateIds)) return res.status(400).json({ error: "candidateIds array required" });
  const election = await getElectionById(electionId);
  if (!election) return res.status(404).json({ error: "Election not found" });

  await db.transaction(async () => {
    await db.run("DELETE FROM election_candidates WHERE election_id=?", [electionId]);
    for (const rawId of candidateIds) {
      const candidateId = Number(rawId);
      if (!Number.isInteger(candidateId)) continue;
      await db.run("INSERT OR IGNORE INTO election_candidates (election_id,candidate_id) SELECT ?,id FROM candidates WHERE id=?", [electionId, candidateId]);
    }
  });

  await logAdminActivity(req.userId, "election.candidates_assigned", { electionId, candidateCount: candidateIds.length });
  res.json({ election, candidates: await getElectionCandidates(electionId) });
}));

app.get("/api/admin/elections/:id/results.csv", auth, requireAdmin, asyncHandler(async (req, res) => {
  const electionId = Number(req.params.id);
  if (!Number.isInteger(electionId)) return res.status(400).json({ error: "Invalid election id" });
  const election = await getElectionById(electionId);
  if (!election) return res.status(404).json({ error: "Election not found" });
  const rows = await getResultsForElection(electionId);
  const body = rows.map((r) => [r.name, r.party, r.symbol || "", r.vote_count].map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=results_election_${electionId}.csv`);
  res.send(`Candidate,Party,Symbol,Votes\n${body}`);
}));

app.get("/api/admin/candidates", auth, requireAdmin, asyncHandler(async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
  const page = clamp(Number(req.query.page) || 1, 1, 99999);
  const pageSize = clamp(Number(req.query.pageSize) || 25, 1, 100);
  const offset = (page - 1) * pageSize;
  const where = q ? "WHERE LOWER(name) LIKE ? OR LOWER(party) LIKE ?" : "";
  const params = q ? [`%${q}%`, `%${q}%`] : [];
  const totalRow = await db.get(`SELECT COUNT(*) AS c FROM candidates ${where}`, params);
  const candidates = await db.all(
    `SELECT id,name,party,symbol,image,bio,manifesto_url,created_at FROM candidates ${where} ORDER BY name ASC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  res.json({ candidates, pagination: { page, pageSize, total: totalRow ? totalRow.c : 0 } });
}));

app.post("/api/admin/candidates", auth, requireAdmin, asyncHandler(async (req, res) => {
  const { name, party, symbol = null, image = null, bio = null, manifestoUrl = null } = req.body;
  if (!name || !party) return res.status(400).json({ error: "name and party are required" });
  const created = await db.run("INSERT INTO candidates (name,party,symbol,image,bio,manifesto_url) VALUES (?,?,?,?,?,?)", [
    name.trim(),
    party.trim(),
    symbol,
    image,
    bio,
    manifestoUrl
  ]);
  await logAdminActivity(req.userId, "candidate.created", { candidateId: created.lastID, name: name.trim() });
  const candidate = await db.get("SELECT id,name,party,symbol,image,bio,manifesto_url,created_at FROM candidates WHERE id=?", [created.lastID]);
  res.status(201).json({ candidate });
}));

app.post("/api/admin/candidates/import", auth, requireAdmin, asyncHandler(async (req, res) => {
  const rows = parseCsvRows(req.body.csvText);
  if (!rows.length) return res.status(400).json({ error: "No valid candidate rows found in CSV" });
  let inserted = 0;
  await db.transaction(async () => {
    for (const row of rows) {
      await db.run("INSERT INTO candidates (name,party,symbol,image,bio,manifesto_url) VALUES (?,?,?,?,?,?)", [row.name, row.party, row.symbol, row.image, row.bio, row.manifesto_url]);
      inserted += 1;
    }
  });
  await logAdminActivity(req.userId, "candidate.imported", { inserted });
  res.status(201).json({ inserted });
}));

app.put("/api/admin/candidates/:id", auth, requireAdmin, asyncHandler(async (req, res) => {
  const candidateId = Number(req.params.id);
  if (!Number.isInteger(candidateId)) return res.status(400).json({ error: "Invalid candidate id" });
  const exists = await db.get("SELECT id FROM candidates WHERE id=?", [candidateId]);
  if (!exists) return res.status(404).json({ error: "Candidate not found" });

  const updates = [];
  const params = [];
  if (typeof req.body.name === "string" && req.body.name.trim()) { updates.push("name=?"); params.push(req.body.name.trim()); }
  if (typeof req.body.party === "string" && req.body.party.trim()) { updates.push("party=?"); params.push(req.body.party.trim()); }
  if (req.body.symbol !== undefined) { updates.push("symbol=?"); params.push(req.body.symbol); }
  if (req.body.image !== undefined) { updates.push("image=?"); params.push(req.body.image); }
  if (req.body.bio !== undefined) { updates.push("bio=?"); params.push(req.body.bio); }
  if (req.body.manifestoUrl !== undefined) { updates.push("manifesto_url=?"); params.push(req.body.manifestoUrl); }
  if (!updates.length) return res.status(400).json({ error: "No valid fields to update" });

  params.push(candidateId);
  await db.run(`UPDATE candidates SET ${updates.join(",")} WHERE id=?`, params);
  await logAdminActivity(req.userId, "candidate.updated", { candidateId });
  res.json({ candidate: await db.get("SELECT id,name,party,symbol,image,bio,manifesto_url,created_at FROM candidates WHERE id=?", [candidateId]) });
}));

app.get("/api/admin/activity", auth, requireAdmin, asyncHandler(async (req, res) => {
  const limit = clamp(Number(req.query.limit) || 50, 1, 200);
  const logs = await db.all(
    `SELECT l.id,l.action,l.details,l.created_at,u.id AS admin_id,u.name AS admin_name,u.email AS admin_email
     FROM admin_activity_logs l JOIN users u ON u.id=l.admin_user_id ORDER BY datetime(l.created_at) DESC,l.id DESC LIMIT ?`,
    [limit]
  );
  res.json({ activity: logs.map((entry) => ({ ...entry, details: entry.details ? JSON.parse(entry.details) : null })) });
}));

app.get("/api/admin/broadcasts", auth, requireAdmin, asyncHandler(async (_, res) => {
  const broadcasts = await db.all(
    `SELECT b.id,b.message,b.active,b.created_at,b.updated_at,u.name AS created_by_name
     FROM broadcast_messages b LEFT JOIN users u ON u.id=b.created_by ORDER BY datetime(b.updated_at) DESC,b.id DESC LIMIT 30`
  );
  res.json({ broadcasts });
}));

app.get("/api/admin/feedback", auth, requireAdmin, asyncHandler(async (req, res) => {
  const status = req.query.status ? String(req.query.status).trim() : "";
  const params = [];
  const where = status && ["new", "reviewed", "closed"].includes(status) ? "WHERE f.status=?" : "";
  if (where) params.push(status);

  const feedback = await db.all(
    `SELECT
      f.id,f.category,f.message,f.status,f.admin_note,f.created_at,f.updated_at,
      u.id AS user_id,u.name AS user_name,u.email AS user_email
     FROM public_feedback f
     LEFT JOIN users u ON u.id=f.user_id
     ${where}
     ORDER BY datetime(f.created_at) DESC,f.id DESC
     LIMIT 200`,
    params
  );
  res.json({ feedback });
}));

app.put("/api/admin/feedback/:id", auth, requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid feedback id" });
  const status = req.body.status ? String(req.body.status).trim() : "";
  const adminNote = req.body.adminNote !== undefined ? String(req.body.adminNote) : null;
  if (!["new", "reviewed", "closed"].includes(status)) return res.status(400).json({ error: "Invalid status" });

  const existing = await db.get("SELECT id FROM public_feedback WHERE id=?", [id]);
  if (!existing) return res.status(404).json({ error: "Feedback not found" });

  await db.run("UPDATE public_feedback SET status=?, admin_note=?, updated_at=CURRENT_TIMESTAMP WHERE id=?", [
    status,
    adminNote,
    id
  ]);
  await logAdminActivity(req.userId, "feedback.updated", { feedbackId: id, status });

  res.json({
    feedback: await db.get(
      "SELECT id,user_id,category,message,status,admin_note,created_at,updated_at FROM public_feedback WHERE id=?",
      [id]
    )
  });
}));

app.post("/api/admin/broadcasts", auth, requireAdmin, asyncHandler(async (req, res) => {
  const message = req.body.message ? String(req.body.message).trim() : "";
  if (!message) return res.status(400).json({ error: "message is required" });
  const deactivatePrevious = req.body.deactivatePrevious !== false;

  const inserted = await db.transaction(async () => {
    if (deactivatePrevious) await db.run("UPDATE broadcast_messages SET active=0, updated_at=CURRENT_TIMESTAMP WHERE active=1");
    return db.run("INSERT INTO broadcast_messages (message,active,created_by,updated_at) VALUES (?,1,?,CURRENT_TIMESTAMP)", [message, req.userId]);
  });

  await logAdminActivity(req.userId, "broadcast.created", { broadcastId: inserted.lastID });
  res.status(201).json({ broadcast: await db.get("SELECT id,message,active,created_at,updated_at FROM broadcast_messages WHERE id=?", [inserted.lastID]) });
}));

app.delete("/api/admin/broadcasts/:id", auth, requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid broadcast id" });
  const existing = await db.get("SELECT id FROM broadcast_messages WHERE id=?", [id]);
  if (!existing) return res.status(404).json({ error: "Broadcast not found" });
  await db.run("UPDATE broadcast_messages SET active=0, updated_at=CURRENT_TIMESTAMP WHERE id=?", [id]);
  await logAdminActivity(req.userId, "broadcast.deactivated", { broadcastId: id });
  res.json({ message: "Broadcast deactivated" });
}));

app.use((error, _, res, __) => {
  console.error("Unhandled error:", error);
  res.status(500).json({ error: "Internal server error" });
});

async function startServer() {
  await db.ready;
  const configuredPort = process.env.PORT ? Number(process.env.PORT) : null;
  if (configuredPort !== null && !Number.isInteger(configuredPort)) {
    throw new Error(`Invalid PORT value: ${process.env.PORT}`);
  }

  const preferredPort = configuredPort || 5000;
  const fallbackPorts = configuredPort ? [] : [5001, 5002, 5003, 5004, 5005];

  const listen = (port) =>
    new Promise((resolve, reject) => {
      const server = app.listen(port, () => resolve({ server, port }));
      server.once("error", reject);
    });

  try {
    const { port } = await listen(preferredPort);
    console.log(`Server running on port ${port}`);
    return;
  } catch (error) {
    if (error.code !== "EADDRINUSE" || configuredPort) throw error;
    console.warn(`Port ${preferredPort} is busy. Trying fallback ports...`);
  }

  for (const port of fallbackPorts) {
    try {
      const { port: activePort } = await listen(port);
      console.log(`Server running on port ${activePort}`);
      return;
    } catch (error) {
      if (error.code !== "EADDRINUSE") throw error;
    }
  }

  throw new Error(`Could not start server: ports ${[preferredPort, ...fallbackPorts].join(", ")} are already in use`);
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
