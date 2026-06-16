require('dotenv').config({ path: './config.env' });
const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const { Resend } = require('resend');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');


// ── Holiday-aware working day calculator ─────────────────────────────────────
const HOLIDAYS_2026 = {
  PT: ['2026-01-01','2026-04-03','2026-04-05','2026-04-25','2026-05-01','2026-06-04','2026-06-10','2026-08-15','2026-10-05','2026-11-01','2026-12-01','2026-12-08','2026-12-25'],
  PT_PORTALEGRE: ['2026-06-13','2026-06-29'],
  PT_PORTO: ['2026-06-24'],
  ES: ['2026-01-01','2026-01-06','2026-04-03','2026-05-01','2026-08-15','2026-10-12','2026-11-01','2026-12-06','2026-12-07','2026-12-08','2026-12-25'],
  ES_MADRID: ['2026-03-19','2026-04-02','2026-05-02','2026-05-15','2026-11-09','2026-12-07'],
  ES_CATALUNYA: ['2026-04-06','2026-06-24','2026-09-11','2026-09-24','2026-12-26'],
  IT: ['2026-01-01','2026-01-06','2026-04-05','2026-04-06','2026-04-25','2026-05-01','2026-06-02','2026-08-15','2026-11-01','2026-12-08','2026-12-25','2026-12-26'],
  IT_FRIULI: ['2026-11-03'],
  US_NC: ['2026-01-01','2026-01-19','2026-02-16','2026-04-03','2026-05-25','2026-06-19','2026-07-03','2026-09-07','2026-10-12','2026-11-11','2026-11-26','2026-11-27','2026-12-24','2026-12-25'],
  JP: ['2026-01-01','2026-01-12','2026-02-11','2026-02-23','2026-03-20','2026-04-29','2026-05-03','2026-05-04','2026-05-05','2026-05-06','2026-07-20','2026-08-11','2026-09-21','2026-09-22','2026-09-23','2026-10-12','2026-11-03','2026-11-23'],
};

function getHolidayKeys(user) {
  const loc = (user.location || '').toLowerCase();
  const state = (user.state || '').toLowerCase();
  const keys = [];
  if (loc === 'portugal') { keys.push('PT'); if (state.includes('portalegre')) keys.push('PT_PORTALEGRE'); if (state.includes('porto')) keys.push('PT_PORTO'); }
  else if (loc === 'spain') { keys.push('ES'); if (state.includes('madrid')) keys.push('ES_MADRID'); if (state.includes('catalu')) keys.push('ES_CATALUNYA'); }
  else if (loc === 'italy') { keys.push('IT'); if (state.includes('friuli')) keys.push('IT_FRIULI'); }
  else if (loc === 'us') { keys.push('US_NC'); }
  else if (loc === 'japan') { keys.push('JP'); }
  return keys;
}

function getUserHolidaySet(user) {
  const set = new Set();
  getHolidayKeys(user).forEach(k => (HOLIDAYS_2026[k] || []).forEach(d => set.add(d)));
  return set;
}

function calcWorkingDaysForUser(start, end, user) {
  const holidays = getUserHolidaySet(user);
  let s = new Date(start + 'T00:00:00'), e = new Date(end + 'T00:00:00'), count = 0;
  while (s <= e) {
    const dow = s.getDay(), ds = s.toISOString().slice(0, 10);
    if (dow !== 0 && dow !== 6 && !holidays.has(ds)) count++;
    s.setDate(s.getDate() + 1);
  }
  return count;
}

const app = express();
const DB_PATH = path.join(__dirname, 'data', 'db.json');
const SESSIONS_PATH = path.join(__dirname, 'data', 'sessions');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'), { etag: false, maxAge: 0 }));
// Trust Railway's proxy so cookies work correctly over HTTPS
app.set('trust proxy', 1);

app.use(session({
  store: new FileStore({ path: SESSIONS_PATH, retries: 1, ttl: 28800, reapInterval: -1, logFn: function(){} }),
  secret: process.env.SESSION_SECRET || 'timeoff-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 8 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    httpOnly: true
  }
}));

// ── DB ───────────────────────────────────────────────────────────────────────
function readDB() {
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
  catch { return { users: [], requests: [] }; }
}
function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// ── Email ────────────────────────────────────────────────────────────────────
let resend = null; // initialized lazily when API key is available

function fmtDate(str) {
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateRange(s, e) { return s === e ? fmtDate(s) : `${fmtDate(s)} – ${fmtDate(e)}`; }

async function sendEmail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[Email skipped — RESEND_API_KEY not set]\nTo: ${to}\nSubject: ${subject}`);
    return;
  }
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  const recipient = process.env.TEST_EMAIL_TO || to;
  const finalSubject = (process.env.TEST_EMAIL_TO ? '[TEST] ' : '') + subject;
  try {
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'TimeOff HR <onboarding@resend.dev>',
      to: recipient,
      subject: finalSubject,
      html
    });
    if (error) { console.error('[Email error]', JSON.stringify(error)); return; }
    console.log(`[Email sent] ${finalSubject} → ${recipient}`);
  } catch (err) { console.error('[Email error]', err.message); }
}

function emailNewRequest(manager, requester, req) {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  return sendEmail({
    to: manager.email,
    subject: `TimeOff — New request from ${requester.name}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1A1A18;">
      <div style="background:#E8500A;padding:20px 24px;border-radius:8px 8px 0 0;">
        <h2 style="color:#fff;margin:0;font-size:18px;">📅 New vacation request</h2>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #E0DFDB;border-top:none;border-radius:0 0 8px 8px;">
        <p style="margin:0 0 16px;"><strong>${requester.name}</strong> has submitted a time-off request that needs your approval.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:8px 0;color:#888;width:140px;">Type</td><td style="padding:8px 0;font-weight:600;">${req.type}</td></tr>
          <tr><td style="padding:8px 0;color:#888;">Dates</td><td style="padding:8px 0;font-weight:600;">${fmtDateRange(req.start, req.end)}</td></tr>
          <tr><td style="padding:8px 0;color:#888;">Working days</td><td style="padding:8px 0;font-weight:600;">${req.days}</td></tr>
          <tr><td style="padding:8px 0;color:#888;">Notes</td><td style="padding:8px 0;">${req.notes || '—'}</td></tr>
        </table>
        <div style="margin-top:24px;">
          <a href="${appUrl}" style="display:inline-block;background:#E8500A;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">Review in TimeOff →</a>
        </div>
      </div>
    </div>`
  });
}

function emailDecision(requester, req, status) {
  const approved = status === 'approved';
  const color = approved ? '#1C6E3A' : '#943A3A';
  const bg = approved ? '#E6F5ED' : '#FCEAEA';
  const icon = approved ? '✅' : '❌';
  return sendEmail({
    to: requester.email,
    subject: `TimeOff — Your request has been ${status}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1A1A18;">
      <div style="background:#E8500A;padding:20px 24px;border-radius:8px 8px 0 0;">
        <h2 style="color:#fff;margin:0;font-size:18px;">${icon} Request ${status}</h2>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #E0DFDB;border-top:none;border-radius:0 0 8px 8px;">
        <div style="background:${bg};border-radius:6px;padding:12px 16px;margin-bottom:20px;">
          <p style="margin:0;color:${color};font-weight:600;">Your time-off request has been <strong>${status}</strong>.</p>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:8px 0;color:#888;width:140px;">Type</td><td style="padding:8px 0;font-weight:600;">${req.type}</td></tr>
          <tr><td style="padding:8px 0;color:#888;">Dates</td><td style="padding:8px 0;font-weight:600;">${fmtDateRange(req.start, req.end)}</td></tr>
          <tr><td style="padding:8px 0;color:#888;">Working days</td><td style="padding:8px 0;font-weight:600;">${req.days}</td></tr>
        </table>
      </div>
    </div>`
  });
}

// ── Auth middleware ───────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  next();
}
function requireManagerOrAdmin(req, res, next) {
  const db = readDB();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user || (user.role !== 'manager' && user.role !== 'admin')) {
    return res.status(403).json({ error: 'Manager access required' });
  }
  next();
}

// Helper: get all direct reports for a user (recursively for admin)
function getReportIds(db, userId, role) {
  if (role === 'admin') {
    // Admin sees everyone
    return db.users.filter(u => u.id !== userId).map(u => u.id);
  }
  // Manager sees direct reports only
  return db.users.filter(u => u.managerId === userId).map(u => u.id);
}

// ── Auth routes ───────────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.id === username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const valid = user.passwordHash
    ? bcrypt.compareSync(password, user.passwordHash)
    : password === user.password;
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
  req.session.userId = user.id;
  const { passwordHash, password: _p, ...safeUser } = user;
  res.json({ user: safeUser });
});

app.post('/api/logout', (req, res) => { req.session.destroy(); res.json({ ok: true }); });

app.get('/api/me', requireAuth, (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user) return res.status(401).json({ error: 'Not found' });
  const { passwordHash, password: _p, ...safeUser } = user;
  res.json({ user: safeUser });
});

// ── Users ─────────────────────────────────────────────────────────────────────
app.get('/api/users', requireAuth, (req, res) => {
  const db = readDB();
  res.json(db.users.map(({ passwordHash, password, ...u }) => u));
});

app.post('/api/admin/import-users', requireManagerOrAdmin, (req, res) => {
  const { users } = req.body;
  if (!Array.isArray(users)) return res.status(400).json({ error: 'Expected { users: [...] }' });
  const db = readDB();
  db.users = users.map(u => ({
    id: u.id || u.username,
    name: u.name,
    email: u.email || '',
    role: u.role || 'staff',
    location: u.location || '',
    state: u.state || '',
    managerId: u.managerId || null,
    daysTotal: parseInt(u.daysTotal || u.days_available || 25),
    daysUsed: parseInt(u.daysUsed || u.days_used || 0),
    password: u.password || '1234'
  }));
  writeDB(db);
  res.json({ imported: db.users.length });
});

// ── Requests ──────────────────────────────────────────────────────────────────
app.get('/api/requests', requireAuth, (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user) return res.status(401).json({ error: 'Not found' });

  let reqs;
  if (user.role === 'admin' || user.role === 'manager') {
    const reportIds = getReportIds(db, user.id, user.role);
    // Include own requests too (for manager/staff hybrid roles)
    const ids = user.role === 'admin' ? reportIds : [...reportIds, user.id];
    // Exclude rejected from calendar/logs — only return pending and approved
    reqs = db.requests.filter(r => ids.includes(r.userId) && r.status !== 'rejected');
  } else {
    // Staff: only their own non-rejected requests
    reqs = db.requests.filter(r => r.userId === user.id && r.status !== 'rejected');
  }
  res.json(reqs);
});

// Staff also needs to see their own rejected ones for "My requests" history
app.get('/api/requests/mine', requireAuth, (req, res) => {
  const db = readDB();
  reqs = db.requests.filter(r => r.userId === req.session.userId);
  res.json(reqs);
});

app.post('/api/requests', requireAuth, async (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user) return res.status(401).json({ error: 'Not found' });
  if (user.role === 'admin') return res.status(403).json({ error: 'Admin accounts cannot submit requests' });

  const { type, start, end, notes } = req.body;
  let { days } = req.body;
  if (!type || !start || !end) return res.status(400).json({ error: 'Missing fields' });
  // Always recalculate server-side to prevent manipulation
  days = calcWorkingDaysForUser(start, end, user);
  if (days <= 0) return res.status(400).json({ error: 'No working days in selected range (check weekends and public holidays)' });

  const myReqs = db.requests.filter(r => r.userId === user.id && r.status === 'approved');
  const usedApproved = myReqs.reduce((s, r) => s + r.days, 0);
  const remaining = user.daysTotal - (user.daysUsed + usedApproved);
  if (days > remaining) return res.status(400).json({ error: `Only ${remaining} days remaining` });

  const newReq = {
    id: Date.now(),
    userId: user.id,
    type, start, end,
    days: parseInt(days),
    notes: notes || '',
    status: 'pending',
    reviewedBy: null,
    createdAt: new Date().toISOString()
  };
  db.requests.push(newReq);
  writeDB(db);

  // Email direct manager only
  const manager = db.users.find(u => u.id === user.managerId);
  if (manager && manager.email) emailNewRequest(manager, user, newReq).catch(console.error);

  res.json(newReq);
});

app.patch('/api/requests/:id', requireManagerOrAdmin, async (req, res) => {
  const db = readDB();
  const reviewer = db.users.find(u => u.id === req.session.userId);
  const reqId = parseInt(req.params.id);
  const request = db.requests.find(r => r.id === reqId);
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.status !== 'pending') return res.status(400).json({ error: 'Already reviewed' });

  const requester = db.users.find(u => u.id === request.userId);
  if (!requester) return res.status(404).json({ error: 'User not found' });

  // Admin can approve anyone; manager can only approve their own direct reports
  if (reviewer.role === 'manager' && requester.managerId !== reviewer.id) {
    return res.status(403).json({ error: 'Not your direct report' });
  }

  const { status } = req.body;
  if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

  request.status = status;
  request.reviewedBy = reviewer.id;
  request.reviewedAt = new Date().toISOString();
  writeDB(db);

  // Email requester
  if (requester.email) emailDecision(requester, request, status).catch(console.error);

  res.json(request);
});

// ── Serve frontend ────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
  ┌─────────────────────────────────────┐
  │   TimeOff HR — Selenis              │
  │   http://localhost:${PORT}              │
  └─────────────────────────────────────┘
  `);
});
