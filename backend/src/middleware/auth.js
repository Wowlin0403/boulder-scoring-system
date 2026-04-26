const jwt = require('jsonwebtoken');
const db = require('../db');

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: '未登入' });
  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token 無效' });
  }
}

function superadminOnly(req, res, next) {
  if (req.user?.role !== 'superadmin') return res.status(403).json({ error: '需要超級管理員權限' });
  next();
}

function adminOnly(req, res, next) {
  if (!['superadmin', 'organizer'].includes(req.user?.role))
    return res.status(403).json({ error: '需要管理員權限' });
  next();
}

function requireEventOwnership(req, res, next) {
  if (req.user.role === 'superadmin') return next();
  if (req.user.role === 'organizer') {
    const event = db.prepare('SELECT organizer_id FROM events WHERE id = ?').get(req.params.id);
    if (!event) return res.status(404).json({ error: '賽事不存在' });
    if (event.organizer_id !== req.user.id) return res.status(403).json({ error: '無權限' });
    return next();
  }
  return res.status(403).json({ error: '需要管理員權限' });
}

module.exports = { authMiddleware, adminOnly, superadminOnly, requireEventOwnership };
