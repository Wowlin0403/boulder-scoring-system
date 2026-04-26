const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '請輸入帳號與密碼' });

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: '帳號或密碼錯誤' });

  if (!user.active)
    return res.status(403).json({ error: '帳號已停用，請聯絡管理員' });

  const payload = { id: user.id, username: user.username, role: user.role };
  if (user.organizer_id) payload.organizer_id = user.organizer_id;

  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, user: payload });
});

module.exports = router;
