const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { superadminOnly } = require('../middleware/auth');

// ── Superadmin: 主辦方帳號管理 ───────────────────────────────────────────────

router.get('/', superadminOnly, (req, res) => {
  const organizers = db.prepare(
    "SELECT id, username, active, created_at FROM users WHERE role = 'organizer' ORDER BY id"
  ).all();
  const result = organizers.map(org => {
    const events = db.prepare('SELECT id, name FROM events WHERE organizer_id = ? ORDER BY date DESC').all(org.id);
    const judge = db.prepare("SELECT id, username, active FROM users WHERE role = 'judge' AND organizer_id = ?").get(org.id);
    return { ...org, events, judge };
  });
  res.json(result);
});

router.post('/', superadminOnly, (req, res) => {
  const { username, password, event_ids = [] } = req.body;
  if (!username || !password) return res.status(400).json({ error: '帳號與密碼必填' });

  try {
    let orgId;
    db.transaction(() => {
      const hash = bcrypt.hashSync(password, 10);
      orgId = db.prepare('INSERT INTO users (username, password_hash, role, active) VALUES (?, ?, ?, 1)')
        .run(username, hash, 'organizer').lastInsertRowid;

      const judgeDefaultPw = `${username}1234`;
      const judgeHash = bcrypt.hashSync(judgeDefaultPw, 10);
      db.prepare('INSERT INTO users (username, password_hash, password_plain, role, active, organizer_id) VALUES (?, ?, ?, ?, 1, ?)')
        .run(`${username}judge`, judgeHash, judgeDefaultPw, 'judge', orgId);

      event_ids.forEach(eid => {
        db.prepare('UPDATE events SET organizer_id = ? WHERE id = ?').run(orgId, eid);
      });
    })();

    const org = db.prepare('SELECT id, username, active, created_at FROM users WHERE id = ?').get(orgId);
    const events = db.prepare('SELECT id, name FROM events WHERE organizer_id = ?').all(orgId);
    const judge = db.prepare("SELECT id, username, active FROM users WHERE role = 'judge' AND organizer_id = ?").get(orgId);
    res.status(201).json({ ...org, events, judge });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: '帳號已存在' });
    throw e;
  }
});

// ── 自己改密碼（所有角色） ────────────────────────────────────────────────────

router.put('/self/change-password', (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: '請填寫目前密碼與新密碼' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(currentPassword, user.password_hash))
    return res.status(401).json({ error: '目前密碼錯誤' });

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(newPassword, 10), req.user.id);
  res.json({ ok: true });
});

// 更新負責比賽
router.put('/:id/events', superadminOnly, (req, res) => {
  const org = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'organizer'").get(req.params.id);
  if (!org) return res.status(404).json({ error: '主辦方不存在' });

  const { event_ids = [] } = req.body;
  db.transaction(() => {
    db.prepare('UPDATE events SET organizer_id = NULL WHERE organizer_id = ?').run(req.params.id);
    event_ids.forEach(eid => {
      db.prepare('UPDATE events SET organizer_id = ? WHERE id = ?').run(req.params.id, eid);
    });
  })();
  res.json({ ok: true });
});

// 重設主辦方密碼
router.put('/:id/password', superadminOnly, (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: '密碼必填' });
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: '使用者不存在' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), req.params.id);
  res.json({ ok: true });
});

// 啟用/停用主辦方（同步裁判帳號）
router.put('/:id/active', superadminOnly, (req, res) => {
  const org = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'organizer'").get(req.params.id);
  if (!org) return res.status(404).json({ error: '主辦方不存在' });
  const val = req.body.active ? 1 : 0;
  db.prepare('UPDATE users SET active = ? WHERE id = ?').run(val, req.params.id);
  db.prepare("UPDATE users SET active = ? WHERE organizer_id = ? AND role = 'judge'").run(val, req.params.id);
  res.json({ ok: true });
});

// 刪除主辦方（含裁判帳號）
router.delete('/:id', superadminOnly, (req, res) => {
  const org = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'organizer'").get(req.params.id);
  if (!org) return res.status(404).json({ error: '主辦方不存在' });
  db.transaction(() => {
    db.prepare('UPDATE events SET organizer_id = NULL WHERE organizer_id = ?').run(req.params.id);
    db.prepare("DELETE FROM users WHERE organizer_id = ? AND role = 'judge'").run(req.params.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  })();
  res.json({ ok: true });
});

// ── Organizer: 裁判帳號管理 ──────────────────────────────────────────────────

router.get('/:id/judge', (req, res) => {
  const orgId = parseInt(req.params.id);
  if (req.user.role === 'organizer' && req.user.id !== orgId)
    return res.status(403).json({ error: '無權限' });

  const judge = db.prepare("SELECT id, username, active, password_plain FROM users WHERE role = 'judge' AND organizer_id = ?").get(orgId);
  if (!judge) return res.status(404).json({ error: '裁判帳號不存在' });
  res.json(judge);
});

router.put('/:id/judge/password', (req, res) => {
  const orgId = parseInt(req.params.id);
  if (req.user.role === 'organizer' && req.user.id !== orgId)
    return res.status(403).json({ error: '無權限' });
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: '密碼必填' });
  const judge = db.prepare("SELECT id FROM users WHERE role = 'judge' AND organizer_id = ?").get(orgId);
  if (!judge) return res.status(404).json({ error: '裁判帳號不存在' });
  db.prepare('UPDATE users SET password_hash = ?, password_plain = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), password, judge.id);
  res.json({ ok: true });
});

router.put('/:id/judge/active', (req, res) => {
  const orgId = parseInt(req.params.id);
  if (req.user.role === 'organizer' && req.user.id !== orgId)
    return res.status(403).json({ error: '無權限' });
  const judge = db.prepare("SELECT id FROM users WHERE role = 'judge' AND organizer_id = ?").get(orgId);
  if (!judge) return res.status(404).json({ error: '裁判帳號不存在' });
  db.prepare('UPDATE users SET active = ? WHERE id = ?').run(req.body.active ? 1 : 0, judge.id);
  res.json({ ok: true });
});

module.exports = router;
