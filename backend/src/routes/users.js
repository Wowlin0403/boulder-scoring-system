const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { adminOnly } = require('../middleware/auth');

router.use(adminOnly);

router.get('/', (req, res) => {
  const users = db.prepare('SELECT id, username, role, created_at FROM users ORDER BY id').all();
  res.json(users);
});

router.post('/', (req, res) => {
  const { username, password, role = 'judge' } = req.body;
  if (!username || !password) return res.status(400).json({ error: '帳號與密碼必填' });
  if (!['admin', 'judge'].includes(role)) return res.status(400).json({ error: '無效角色' });

  try {
    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username, hash, role);
    res.status(201).json({ id: result.lastInsertRowid, username, role });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: '帳號已存在' });
    throw e;
  }
});

router.delete('/:id', (req, res) => {
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: '使用者不存在' });
  if (String(user.id) === String(req.user.id)) return res.status(400).json({ error: '無法刪除自己的帳號' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
