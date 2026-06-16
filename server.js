require('dotenv').config({ path: './config.env' });
const express = require('express');
const session = require('express-session');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const app = express();
const DB_PATH = path.join(__dirname, 'data', 'db.json');

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'timeoff-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 } // 8 hours
}));

// ── DB helpers ──────────────────────────────────────────────────────────────
function readDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    return { users: [], requests: [] };
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// ── Email ───────────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.office365.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: { ciphers: 'SSLv3' }
});

function fmtDate(str) {
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateRange(s, e) {
  return s === e ? fmtDate(s) : `${fmtDate(s)} – ${fmtDate(e)}`;
}

async function sendEmail({ to, subject, html }) {
  if (!process.env.SMTP_USER || process.env.SMTP_USER === 'your-email@yourdomain.com') {
    console.log(`[Email skipped — SMTP not configured]\nTo: ${to}\nSubject: ${subject}`);
    return;
  }
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html
    });
    console.log(`[Email sent] ${subject} → ${to}`);
  } catch (err) {
    console.error('[Email error]', err.message);
  }
}

function emailNewRequest(manager, requester, req) {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  return sendEmail({
    to: manager.email,
    subject: `TimeOff — New request from ${requester.name}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1A1A18;">
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
          <p style="margin:20px 0 0;font-size:12px;color:#AAA;">You are receiving this because you are listed as ${requester.name}'s manager in TimeOff HR.</p>
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
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1A1A18;">
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
          <p style="margin:20px 0 0;font-size:12px;color:#AAA;">Log in to TimeOff HR to view your full request history.</p>
        </div>
      </div>`
  });
}

// ── Auth middleware ──────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

function requireManager(req, res, next) {
  const db = readDB();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user || user.role !== 'manager') return res.status(403).json({ error: 'Manager access required' });
  next();
}

// ── Auth routes ──────────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.id === username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = user.passwordHash
    ? bcrypt.compareSync(password, user.passwordHash)
    : password === user.password; // plain fallback for imported users

  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  req.session.userId = user.id;
  const { passwordHash, password: _p, ...safeUser } = user;
  res.json({ user: safeUser });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user) return res.status(401).json({ error: 'Not found' });
  const { passwordHash, password: _p, ...safeUser } = user;
  res.json({ user: safeUser });
});

// ── Users routes ──────────────────────────────────────────────────────────────
app.get('/api/users', requireAuth, (req, res) => {
  const db = readDB();
  const users = db.users.map(({ passwordHash, password, ...u }) => u);
  res.json(users);
});

// Admin: import users from uploaded JSON
app.post('/api/admin/import-users', requireManager, (req, res) => {
  const { users } = req.body;
  if (!Array.isArray(users)) return res.status(400).json({ error: 'Expected { users: [...] }' });
  const db = readDB();

  const imported = users.map(u => ({
    id: u.id || u.username,
    name: u.name,
    email: u.email || '',
    role: u.role || 'staff',
    location: u.location || '',
    managerId: u.managerId || null,
    daysTotal: parseInt(u.daysTotal || u.days_available || 25),
    daysUsed: parseInt(u.daysUsed || u.days_used || 0),
    password: u.password || '1234'
  }));

  // Merge: keep existing requests, replace users
  db.users = imported;
  writeDB(db);
  res.json({ imported: imported.length });
});

// ── Requests routes ──────────────────────────────────────────────────────────
app.get('/api/requests', requireAuth, (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user) return res.status(401).json({ error: 'Not found' });

  let reqs;
  if (user.role === 'manager') {
    // Manager sees all requests for their direct reports
    const reportIds = db.users.filter(u => u.managerId === user.id).map(u => u.id);
    reqs = db.requests.filter(r => reportIds.includes(r.userId) || r.userId === user.id);
  } else {
    reqs = db.requests.filter(r => r.userId === user.id);
  }
  res.json(reqs);
});

app.post('/api/requests', requireAuth, async (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user) return res.status(401).json({ error: 'Not found' });

  const { type, start, end, days, notes } = req.body;
  if (!type || !start || !end || !days) return res.status(400).json({ error: 'Missing fields' });

  // Check balance
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

  // Email manager
  const manager = db.users.find(u => u.id === user.managerId);
  if (manager && manager.email) {
    emailNewRequest(manager, user, newReq).catch(console.error);
  }

  res.json(newReq);
});

app.patch('/api/requests/:id', requireManager, async (req, res) => {
  const db = readDB();
  const manager = db.users.find(u => u.id === req.session.userId);
  const reqId = parseInt(req.params.id);
  const request = db.requests.find(r => r.id === reqId);

  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.status !== 'pending') return res.status(400).json({ error: 'Already reviewed' });

  // Ensure this manager owns this report
  const requester = db.users.find(u => u.id === request.userId);
  if (!requester) return res.status(404).json({ error: 'User not found' });
  if (requester.managerId !== manager.id) return res.status(403).json({ error: 'Not your report' });

  const { status } = req.body;
  if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

  request.status = status;
  request.reviewedBy = manager.id;
  request.reviewedAt = new Date().toISOString();
  writeDB(db);

  // Email requester
  if (requester.email) {
    emailDecision(requester, request, status).catch(console.error);
  }

  res.json(request);
});

// ── Serve frontend ────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
  ┌─────────────────────────────────────┐
  │   TimeOff HR is running             │
  │   http://localhost:${PORT}              │
  │                                     │
  │   Edit config.env to configure      │
  │   SMTP and other settings           │
  └─────────────────────────────────────┘
  `);
});
