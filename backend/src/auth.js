const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomBytes, timingSafeEqual } = require('node:crypto');

function cookieOptions(config, httpOnly) {
  return {
    httpOnly,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    path: '/',
    maxAge: config.sessionMaxAgeMs,
  };
}

function safeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || !left || !right) return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function createAuth({ pool, config }) {
  if (!config.jwtSecret || config.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters.');
  }

  const clearSession = (res) => {
    const options = { ...cookieOptions(config, true), maxAge: 0 };
    res.clearCookie(config.authCookieName, options);
    res.clearCookie(config.csrfCookieName, { ...cookieOptions(config, false), maxAge: 0 });
  };

  const issueSession = (res, user) => {
    const token = jwt.sign({ sub: String(user.id) }, config.jwtSecret, {
      algorithm: 'HS256',
      expiresIn: config.jwtExpiresIn,
    });
    const csrfToken = randomBytes(32).toString('base64url');
    res.cookie(config.authCookieName, token, cookieOptions(config, true));
    res.cookie(config.csrfCookieName, csrfToken, cookieOptions(config, false));
    return csrfToken;
  };

  const optionalAuth = async (req, res, next) => {
    req.user = null;
    const token = req.cookies?.[config.authCookieName];
    if (!token) return next();

    try {
      const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
      const userId = Number(payload.sub);
      if (!Number.isSafeInteger(userId) || userId <= 0) {
        clearSession(res);
        return next();
      }
      const [rows] = await pool.execute(
        'SELECT user_id AS id, full_name AS name, email, role FROM users WHERE user_id = ? LIMIT 1',
        [userId],
      );
      if (rows.length === 1) {
        const user = rows[0];
        if (['student', 'staff', 'admin'].includes(user.role)) req.user = { ...user, id: String(user.id) };
        else clearSession(res);
      } else {
        clearSession(res);
      }
    } catch {
      clearSession(res);
    }
    return next();
  };

  const requireAuth = (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Please sign in to continue.' });
    return next();
  };

  const requireRole = (...roles) => (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Please sign in to continue.' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ success: false, message: 'You are not authorized to perform this action.' });
    return next();
  };

  const requireCsrf = (req, res, next) => {
    const cookieToken = req.cookies?.[config.csrfCookieName];
    const headerToken = req.get('x-csrf-token');
    if (!safeEqual(cookieToken, headerToken)) {
      return res.status(403).json({ success: false, message: 'Your session security token is missing or expired. Refresh and try again.' });
    }
    return next();
  };

  return { optionalAuth, requireAuth, requireRole, requireCsrf, issueSession, clearSession };
}

module.exports = { createAuth, safeEqual };
