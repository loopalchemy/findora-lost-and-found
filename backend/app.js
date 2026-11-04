const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('node:path');
const { createAuth } = require('./src/auth');
const {
  text,
  validPassword,
  validateRegistration,
  validateLogin,
  validateReport,
  validateClaim,
  validateCategory,
  positiveId,
} = require('./src/validation');
const { uploadMiddleware, saveValidatedImage, removeStoredImage } = require('./src/uploads');

const REPORT_STATUSES = ['Pending review', 'Approved', 'Rejected', 'Recovered'];
const CLAIM_STATUS_TO_UI = { pending: 'Pending review', approved: 'Approved', rejected: 'Rejected' };
const DATE_SQL = "DATE_FORMAT(i.item_date, '%Y-%m-%d')";

function configFromEnv(env = process.env) {
  const cookieSameSite = String(env.COOKIE_SAME_SITE || 'Lax').toLowerCase();
  const allowedSameSite = new Set(['lax', 'strict', 'none']);
  const cookieSecure = String(env.COOKIE_SECURE || 'false').toLowerCase() === 'true';
  if (!allowedSameSite.has(cookieSameSite)) throw new Error('COOKIE_SAME_SITE must be Lax, Strict or None.');
  if (cookieSameSite === 'none' && !cookieSecure) throw new Error('COOKIE_SECURE=true is required when COOKIE_SAME_SITE=None.');
  const origins = String(env.FRONTEND_ORIGINS || 'http://localhost:3000')
    .split(',').map((origin) => origin.trim()).filter(Boolean);
  for (const origin of origins) {
    let parsed;
    try { parsed = new URL(origin); } catch { throw new Error('FRONTEND_ORIGINS must contain valid absolute origins.'); }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) throw new Error('FRONTEND_ORIGINS entries must be exact HTTP(S) origins without paths.');
  }
  return {
    jwtSecret: env.JWT_SECRET || '',
    jwtExpiresIn: env.JWT_EXPIRES_IN || '8h',
    sessionMaxAgeMs: Number(env.SESSION_MAX_AGE_MS || 8 * 60 * 60 * 1000),
    authCookieName: env.AUTH_COOKIE_NAME || 'luf_session',
    csrfCookieName: env.CSRF_COOKIE_NAME || 'luf_csrf',
    cookieSameSite,
    cookieSecure,
    frontendOrigins: origins,
    uploadDir: path.resolve(__dirname, env.UPLOAD_DIR || 'uploads'),
  };
}

function httpError(status, message, errors) {
  const error = new Error(message);
  error.status = status;
  if (errors) error.fieldErrors = errors;
  return error;
}

function canonicalReportStatus(value) {
  return REPORT_STATUSES.includes(value) ? value : 'Unknown';
}

function canonicalClaimStatus(value) {
  return CLAIM_STATUS_TO_UI[String(value || '').toLowerCase()] || 'Unknown';
}

function asIsoDate(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function asIsoTimestamp(value) {
  if (!value) return '';
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapReport(row, user, admin = false) {
  const ownerId = row.ownerId == null ? null : String(row.ownerId);
  const report = {
    id: String(row.id),
    type: String(row.type || '').toLowerCase(),
    title: row.title,
    category: row.category,
    description: row.description,
    location: row.location,
    date: asIsoDate(row.date),
    colour: row.colour || '',
    image: row.image || '',
    status: canonicalReportStatus(row.status),
    createdAt: asIsoTimestamp(row.createdAt),
    updatedAt: asIsoTimestamp(row.updatedAt || row.createdAt),
    isOwner: Boolean(user && ownerId === String(user.id)),
  };
  if (user && (report.isOwner || admin)) report.ownerId = ownerId;
  if (admin) report.reportedBy = row.reportedBy || '';
  return report;
}

function mapClaim(row) {
  return {
    id: String(row.id),
    reportId: String(row.reportId),
    userId: String(row.userId),
    explanation: row.explanation,
    status: canonicalClaimStatus(row.status),
    createdAt: asIsoTimestamp(row.createdAt),
    itemTitle: row.itemTitle || '',
    itemType: String(row.itemType || '').toLowerCase(),
    itemStatus: canonicalReportStatus(row.itemStatus),
    category: row.category || '',
    location: row.location || '',
    claimantName: row.claimantName || '',
    reviewedAt: row.reviewedAt ? asIsoTimestamp(row.reviewedAt) : null,
  };
}

function reportSelect() {
  return `SELECT i.item_id AS id, i.user_id AS ownerId,
      i.item_type AS type, i.item_name AS title, c.category_name AS category,
      i.description, i.location, ${DATE_SQL} AS date, i.colour,
      i.image_path AS image, i.status, i.created_at AS createdAt,
      i.created_at AS updatedAt, u.full_name AS reportedBy
    FROM items i
    INNER JOIN users u ON u.user_id = i.user_id
    INNER JOIN categories c ON c.category_id = i.category_id`;
}

function createApp({ pool, config = configFromEnv(), uploadDir = config.uploadDir } = {}) {
  if (!pool || typeof pool.execute !== 'function') throw new Error('createApp requires a MySQL-compatible pool.');
  const app = express();
  const auth = createAuth({ pool, config });
  const allowedOrigins = new Set(config.frontendOrigins);

  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
    maxAge: 600,
  }));
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use((req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.get('origin');
    if (origin && !allowedOrigins.has(origin)) {
      return res.status(403).json({ success: false, message: 'This request origin is not allowed.' });
    }
    return next();
  });
  app.use('/uploads', express.static(uploadDir, {
    dotfiles: 'deny',
    index: false,
    fallthrough: true,
    maxAge: '1d',
    setHeaders(res) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    },
  }));
  app.use('/api', auth.optionalAuth);

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler(_req, res) {
      res.status(429).json({ success: false, message: 'Too many authentication attempts. Wait a few minutes and try again.' });
    },
  });
  const { requireAuth, requireRole, requireCsrf, issueSession, clearSession } = auth;

  app.get('/', (_req, res) => res.json({ success: true, message: 'University Lost-and-Found API is running.' }));
  app.get('/api/ping', (_req, res) => res.json({ success: true, message: 'API route is working.' }));

  app.get('/api/auth/csrf', (req, res) => {
    let token = req.cookies?.[config.csrfCookieName];
    if (typeof token !== 'string' || token.length < 40) {
      const { randomBytes } = require('node:crypto');
      token = randomBytes(32).toString('base64url');
      res.cookie(config.csrfCookieName, token, {
        httpOnly: false,
        secure: config.cookieSecure,
        sameSite: config.cookieSameSite,
        path: '/',
        maxAge: config.sessionMaxAgeMs,
      });
    }
    res.json({ success: true, csrfToken: token });
  });

  app.post('/api/auth/register', authLimiter, requireCsrf, async (req, res, next) => {
    try {
      const { value, errors } = validateRegistration(req.body);
      if (Object.keys(errors).length) throw httpError(400, 'Please correct the highlighted fields.', errors);
      const [existing] = await pool.execute('SELECT user_id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [value.email]);
      if (existing.length) throw httpError(409, 'An account with this email already exists.', { email: 'Use another email or sign in.' });
      const passwordHash = await require('bcryptjs').hash(value.password, 12);
      const [result] = await pool.execute(
        'INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)',
        [value.fullName, value.email, passwordHash, 'student'],
      );
      const user = { id: String(result.insertId), name: value.fullName, email: value.email, role: 'student' };
      const csrfToken = issueSession(res, user);
      return res.status(201).json({ success: true, user, csrfToken });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') return next(httpError(409, 'An account with this email already exists.', { email: 'Use another email or sign in.' }));
      return next(error);
    }
  });

  app.post('/api/auth/login', authLimiter, requireCsrf, async (req, res, next) => {
    try {
      const { value, errors } = validateLogin(req.body);
      if (Object.keys(errors).length) throw httpError(400, 'Please enter your email and password.', errors);
      const [rows] = await pool.execute(
        'SELECT user_id AS id, full_name AS name, email, password_hash AS passwordHash, role FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
        [value.email],
      );
      const user = rows[0];
      let verified = false;
      if (user && typeof user.passwordHash === 'string' && /^\$2[aby]\$\d{2}\$/.test(user.passwordHash)) {
        verified = await require('bcryptjs').compare(value.password, user.passwordHash).catch(() => false);
      }
      if (!verified || !['student', 'staff', 'admin'].includes(user.role)) {
        throw httpError(401, 'Email or password is incorrect.');
      }
      const safeUser = { id: String(user.id), name: user.name, email: user.email, role: user.role };
      const csrfToken = issueSession(res, safeUser);
      return res.json({ success: true, user: safeUser, csrfToken });
    } catch (error) {
      return next(error);
    }
  });

  app.get('/api/auth/me', (req, res) => {
    res.json({ success: true, user: req.user || null, csrfToken: req.cookies?.[config.csrfCookieName] || null });
  });
  app.post('/api/auth/logout', requireCsrf, (_req, res) => {
    clearSession(res);
    res.json({ success: true, message: 'You have signed out.' });
  });
  app.get('/api/users/me', requireAuth, (req, res) => res.json({ success: true, user: req.user }));

  app.get('/api/db-test', requireRole('admin'), async (_req, res, next) => {
    try {
      const [rows] = await pool.query('SELECT DATABASE() AS databaseName, VERSION() AS mysqlVersion');
      return res.json({ success: true, message: 'MySQL connection successful.', database: rows[0]?.databaseName, mysqlVersion: rows[0]?.mysqlVersion });
    } catch (error) { return next(error); }
  });

  app.get('/api/categories', async (_req, res, next) => {
    try {
      const [rows] = await pool.execute('SELECT category_id AS id, category_name AS name, description FROM categories ORDER BY category_name ASC');
      return res.json({ success: true, categories: rows.map((row) => ({ ...row, id: String(row.id), description: row.description || '' })) });
    } catch (error) { return next(error); }
  });
  app.post('/api/categories', requireAuth, requireRole('admin'), requireCsrf, async (req, res, next) => {
    try {
      const { value, errors } = validateCategory(req.body);
      if (Object.keys(errors).length) throw httpError(400, 'Please correct the category details.', errors);
      const [result] = await pool.execute('INSERT INTO categories (category_name, description) VALUES (?, ?)', [value.name, value.description || null]);
      return res.status(201).json({ success: true, category: { id: String(result.insertId), name: value.name, description: value.description } });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') return next(httpError(409, 'That category already exists.', { name: 'Choose a different category name.' }));
      return next(error);
    }
  });
  app.delete('/api/categories/:id', requireAuth, requireRole('admin'), requireCsrf, async (req, res, next) => {
    try {
      const categoryId = positiveId(req.params.id);
      if (!categoryId) throw httpError(400, 'Invalid category ID.');
      const [categories] = await pool.execute('SELECT category_id FROM categories WHERE category_id = ? LIMIT 1', [categoryId]);
      if (!categories.length) throw httpError(404, 'Category not found.');
      const [references] = await pool.execute('SELECT COUNT(*) AS total FROM items WHERE category_id = ?', [categoryId]);
      if (Number(references[0]?.total || 0) > 0) throw httpError(409, 'This category is used by existing reports and cannot be removed.');
      await pool.execute('DELETE FROM categories WHERE category_id = ?', [categoryId]);
      return res.json({ success: true, message: 'Category removed.' });
    } catch (error) { return next(error); }
  });

  app.get('/api/reports/mine', requireAuth, async (req, res, next) => {
    try {
      const [rows] = await pool.execute(`${reportSelect()} WHERE i.user_id = ? ORDER BY i.created_at DESC LIMIT 500`, [Number(req.user.id)]);
      return res.json({ success: true, count: rows.length, reports: rows.map((row) => mapReport(row, req.user, req.user.role === 'admin')) });
    } catch (error) { return next(error); }
  });

  app.get('/api/reports', async (req, res, next) => {
    try {
      const admin = req.user?.role === 'admin';
      const scope = req.query.scope || '';
      if (scope && !['public', 'admin'].includes(scope)) throw httpError(400, 'Invalid report visibility scope.');
      if (scope === 'admin' && !admin) throw httpError(403, 'Administrator access is required.');
      const canViewAll = admin && scope !== 'public';
      const where = [];
      const params = [];
      if (!canViewAll) {
        where.push("i.status IN ('Approved', 'Recovered')");
      }
      if (req.query.status) {
        if (!REPORT_STATUSES.includes(req.query.status)) throw httpError(400, 'Invalid report status filter.');
        if (!canViewAll && !['Approved', 'Recovered'].includes(req.query.status)) throw httpError(400, 'This report status is not publicly searchable.');
        where.push('i.status = ?');
        params.push(req.query.status);
      }
      if (req.query.type) {
        const type = text(req.query.type, 16).toLowerCase();
        if (!['lost', 'found'].includes(type)) throw httpError(400, 'Invalid report type filter.');
        where.push('i.item_type = ?'); params.push(type);
      }
      if (req.query.category) { where.push('c.category_name = ?'); params.push(text(req.query.category, 80)); }
      if (req.query.location) { where.push('i.location LIKE ?'); params.push(`%${text(req.query.location, 120)}%`); }
      if (req.query.q) {
        const q = text(req.query.q, 100);
        where.push('(i.item_name LIKE ? OR i.description LIKE ? OR i.location LIKE ? OR c.category_name LIKE ?)');
        params.push(...Array(4).fill(`%${q}%`));
      }
      if (req.query.from) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(req.query.from)) throw httpError(400, 'Invalid start date filter.');
        where.push('i.item_date >= ?'); params.push(req.query.from);
      }
      if (req.query.to) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(req.query.to)) throw httpError(400, 'Invalid end date filter.');
        where.push('i.item_date <= ?'); params.push(req.query.to);
      }
      if (req.query.from && req.query.to && req.query.from > req.query.to) throw httpError(400, 'The start date must be on or before the end date.');
      const order = req.query.sort === 'oldest' ? 'i.item_date ASC, i.created_at ASC' : 'i.item_date DESC, i.created_at DESC';
      if (req.query.sort && !['newest', 'oldest'].includes(req.query.sort)) throw httpError(400, 'Invalid report sort order.');
      const requestedLimit = Number(req.query.limit) || 200;
      const limit = Math.min(Math.max(Number.isSafeInteger(requestedLimit) ? requestedLimit : 200, 1), 500);
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const [rows] = await pool.execute(`${reportSelect()} ${whereSql} ORDER BY ${order} LIMIT ${limit}`, params);
      return res.json({ success: true, count: rows.length, reports: rows.map((row) => mapReport(row, req.user, canViewAll)) });
    } catch (error) { return next(error); }
  });

  app.post('/api/reports', requireAuth, requireRole('student', 'staff'), requireCsrf, uploadMiddleware.single('image'), async (req, res, next) => {
    let storedImage = null;
    try {
      const { value, errors } = validateReport(req.body);
      if (Object.keys(errors).length) throw httpError(400, 'Please correct the highlighted fields.', errors);
      const [categories] = await pool.execute('SELECT category_id FROM categories WHERE category_name = ? LIMIT 1', [value.category]);
      if (!categories.length) throw httpError(400, 'Choose an available category.', { category: 'This category is no longer available.' });
      storedImage = await saveValidatedImage(req.file, uploadDir);
      const [result] = await pool.execute(
        `INSERT INTO items (user_id, category_id, item_type, item_name, description, location, item_date, colour, image_path, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending review')`,
        [Number(req.user.id), categories[0].category_id, value.type, value.title, value.description, value.location, value.date, value.colour || null, storedImage],
      );
      const [rows] = await pool.execute(`${reportSelect()} WHERE i.item_id = ? LIMIT 1`, [result.insertId]);
      return res.status(201).json({ success: true, message: 'Report submitted for review.', report: mapReport(rows[0], req.user) });
    } catch (error) {
      if (storedImage) await removeStoredImage(storedImage, uploadDir);
      if (error.code === 'ER_NO_REFERENCED_ROW_2') return next(httpError(409, 'The selected category changed. Refresh the page and try again.'));
      return next(error);
    }
  });

  app.get('/api/reports/:id', async (req, res, next) => {
    try {
      const reportId = positiveId(req.params.id);
      if (!reportId) throw httpError(400, 'Invalid report ID.');
      const [rows] = await pool.execute(`${reportSelect()} WHERE i.item_id = ? LIMIT 1`, [reportId]);
      if (!rows.length) throw httpError(404, 'Report not found.');
      const row = rows[0];
      const isOwner = req.user && String(row.ownerId) === String(req.user.id);
      const isAdmin = req.user?.role === 'admin';
      if (!['Approved', 'Recovered'].includes(row.status) && !isOwner && !isAdmin) throw httpError(404, 'Report not found.');
      return res.json({ success: true, report: mapReport(row, req.user, Boolean(isAdmin)) });
    } catch (error) { return next(error); }
  });

  app.patch('/api/reports/:id/status', requireAuth, requireRole('admin'), requireCsrf, async (req, res, next) => {
    try {
      const reportId = positiveId(req.params.id);
      const { status } = req.body || {};
      if (!reportId) throw httpError(400, 'Invalid report ID.');
      if (!REPORT_STATUSES.includes(status)) throw httpError(400, 'Invalid report status.');
      const [rows] = await pool.execute('SELECT status FROM items WHERE item_id = ? LIMIT 1', [reportId]);
      if (!rows.length) throw httpError(404, 'Report not found.');
      const current = rows[0].status;
      const transitions = { 'Pending review': ['Approved', 'Rejected'], Approved: ['Recovered'], Rejected: [], Recovered: [] };
      if (!transitions[current]?.includes(status)) throw httpError(409, `Cannot change a ${current} report to ${status}.`);
      const [result] = await pool.execute('UPDATE items SET status = ? WHERE item_id = ? AND status = ?', [status, reportId, current]);
      if (result.affectedRows !== 1) throw httpError(409, 'The report changed while you were reviewing it. Refresh and try again.');
      return res.json({ success: true, reportId: String(reportId), status });
    } catch (error) { return next(error); }
  });

  app.get('/api/claims/mine', requireAuth, requireRole('student', 'staff'), async (req, res, next) => {
    try {
      const [rows] = await pool.execute(
        `SELECT cl.claim_id AS id, cl.item_id AS reportId, cl.claimant_id AS userId,
          cl.claim_description AS explanation, cl.status, cl.created_at AS createdAt,
          i.item_name AS itemTitle, i.item_type AS itemType, i.status AS itemStatus,
          i.location, c.category_name AS category, u.full_name AS claimantName
         FROM claims cl INNER JOIN items i ON i.item_id = cl.item_id
         INNER JOIN categories c ON c.category_id = i.category_id
         INNER JOIN users u ON u.user_id = cl.claimant_id
         WHERE cl.claimant_id = ? ORDER BY cl.created_at DESC LIMIT 500`,
        [Number(req.user.id)],
      );
      return res.json({ success: true, count: rows.length, claims: rows.map(mapClaim) });
    } catch (error) { return next(error); }
  });

  app.get('/api/claims', requireAuth, requireRole('admin'), async (_req, res, next) => {
    try {
      const [rows] = await pool.execute(
        `SELECT cl.claim_id AS id, cl.item_id AS reportId, cl.claimant_id AS userId,
          cl.claim_description AS explanation, cl.status, cl.created_at AS createdAt,
          i.item_name AS itemTitle, i.item_type AS itemType, i.status AS itemStatus,
          i.location, c.category_name AS category, u.full_name AS claimantName
         FROM claims cl INNER JOIN items i ON i.item_id = cl.item_id
         INNER JOIN categories c ON c.category_id = i.category_id
         INNER JOIN users u ON u.user_id = cl.claimant_id
         ORDER BY cl.created_at DESC LIMIT 500`,
      );
      return res.json({ success: true, count: rows.length, claims: rows.map(mapClaim) });
    } catch (error) { return next(error); }
  });

  app.post('/api/claims', requireAuth, requireRole('student', 'staff'), requireCsrf, async (req, res, next) => {
    try {
      const { value, errors } = validateClaim(req.body);
      const reportId = positiveId(req.body?.reportId ?? req.body?.itemId);
      if (!reportId) errors.reportId = 'Choose a valid found-item report.';
      if (Object.keys(errors).length) throw httpError(400, 'Please correct the claim details.', errors);
      const [items] = await pool.execute('SELECT item_id, user_id, item_type, status FROM items WHERE item_id = ? LIMIT 1', [reportId]);
      if (!items.length) throw httpError(404, 'Report not found.');
      const item = items[0];
      if (String(item.user_id) === String(req.user.id)) throw httpError(403, 'You cannot claim your own report.');
      if (String(item.item_type).toLowerCase() !== 'found' || item.status !== 'Approved') throw httpError(409, 'Only approved found-item reports can be claimed.');
      const [existing] = await pool.execute('SELECT claim_id FROM claims WHERE item_id = ? AND claimant_id = ? LIMIT 1', [reportId, Number(req.user.id)]);
      if (existing.length) throw httpError(409, 'You have already submitted a claim for this item.');
      const [result] = await pool.execute(
        "INSERT INTO claims (item_id, claimant_id, claim_description, status) VALUES (?, ?, ?, 'pending')",
        [reportId, Number(req.user.id), value.explanation],
      );
      return res.status(201).json({ success: true, message: 'Claim submitted for review.', claim: { id: String(result.insertId), reportId: String(reportId), userId: String(req.user.id), explanation: value.explanation, status: 'Pending review', createdAt: new Date().toISOString() } });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') return next(httpError(409, 'You have already submitted a claim for this item.'));
      return next(error);
    }
  });

  app.patch('/api/claims/:id/status', requireAuth, requireRole('admin'), requireCsrf, async (req, res, next) => {
    try {
      const claimId = positiveId(req.params.id);
      const status = text(req.body?.status, 20).toLowerCase();
      if (!claimId) throw httpError(400, 'Invalid claim ID.');
      if (!['approved', 'rejected'].includes(status)) throw httpError(400, 'Claim status must be Approved or Rejected.');
      const [result] = await pool.execute("UPDATE claims SET status = ? WHERE claim_id = ? AND status = 'pending'", [status, claimId]);
      if (result.affectedRows !== 1) {
        const [rows] = await pool.execute('SELECT status FROM claims WHERE claim_id = ? LIMIT 1', [claimId]);
        if (!rows.length) throw httpError(404, 'Claim not found.');
        throw httpError(409, 'Only pending claims can be reviewed.');
      }
      return res.json({ success: true, claimId: String(claimId), status: status === 'approved' ? 'Approved' : 'Rejected', reportStatusChanged: false });
    } catch (error) { return next(error); }
  });

  app.get('/api/users', requireAuth, requireRole('admin'), async (_req, res, next) => {
    try {
      const [rows] = await pool.execute('SELECT user_id AS id, full_name AS name, email, role, created_at AS createdAt FROM users ORDER BY created_at DESC LIMIT 500');
      return res.json({ success: true, count: rows.length, users: rows.map((row) => ({ ...row, id: String(row.id), createdAt: asIsoTimestamp(row.createdAt) })) });
    } catch (error) { return next(error); }
  });

  app.get('/api/admin/statistics', requireAuth, requireRole('admin'), async (_req, res, next) => {
    try {
      const [reportRows] = await pool.execute(
        `SELECT COUNT(*) AS total,
          SUM(status = 'Pending review') AS pending,
          SUM(status = 'Approved') AS approved,
          SUM(status = 'Rejected') AS rejected,
          SUM(status = 'Recovered') AS recovered,
          SUM(item_type = 'lost') AS lost,
          SUM(item_type = 'found') AS found
         FROM items`,
      );
      const [claimRows] = await pool.execute(
        `SELECT COUNT(*) AS total, SUM(status = 'pending') AS pending,
          SUM(status = 'approved') AS approved, SUM(status = 'rejected') AS rejected FROM claims`,
      );
      const [categoryRows] = await pool.execute(
        `SELECT c.category_name AS label, COUNT(i.item_id) AS value
         FROM categories c LEFT JOIN items i ON i.category_id = c.category_id
         GROUP BY c.category_id, c.category_name ORDER BY value DESC, c.category_name ASC`,
      );
      const numeric = (row, key) => Number(row?.[key] || 0);
      const reports = reportRows[0] || {};
      const claims = claimRows[0] || {};
      return res.json({ success: true, statistics: {
        reports: {
          total: numeric(reports, 'total'), pending: numeric(reports, 'pending'),
          approved: numeric(reports, 'approved'), rejected: numeric(reports, 'rejected'),
          recovered: numeric(reports, 'recovered'), lost: numeric(reports, 'lost'), found: numeric(reports, 'found'),
          byCategory: categoryRows.map((row) => ({ label: row.label, value: Number(row.value || 0) })),
        },
        claims: {
          total: numeric(claims, 'total'), pending: numeric(claims, 'pending'),
          approved: numeric(claims, 'approved'), rejected: numeric(claims, 'rejected'),
        },
      } });
    } catch (error) { return next(error); }
  });

  app.use('/api', (_req, res) => res.status(404).json({ success: false, message: 'API route not found.' }));
  app.use((error, _req, res, _next) => {
    if (res.headersSent) return;
    let status = Number(error.status) || 500;
    let message = status >= 500 ? 'A server error occurred. Please try again later.' : error.message;
    if (error.code === 'LIMIT_FILE_SIZE') { status = 413; message = 'Image must be 350 KB or smaller.'; }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') { status = 400; message = 'Only one item photo may be uploaded.'; }
    if (error.code === 'ER_NO_REFERENCED_ROW_2') { status = 409; message = 'The selected record is no longer available.'; }
    if (status >= 500) console.error('API request failed:', error.code || error.name || 'unknown');
    return res.status(status).json({ success: false, message, ...(error.fieldErrors ? { errors: error.fieldErrors } : {}) });
  });
  return app;
}

module.exports = { createApp, configFromEnv, mapReport, mapClaim, REPORT_STATUSES };
