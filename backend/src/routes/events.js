const router = require('express').Router();
const db = require('../db');
const { adminOnly } = require('../middleware/auth');
const { getAdvancedIds } = require('../utils/advancement');

const ROUND_KEYS = ['qual', 'semi', 'final'];

// ── Events ──────────────────────────────────────────────────────────────────

router.get('/', (req, res) => {
  const events = db.prepare('SELECT * FROM events ORDER BY date DESC, id DESC').all();
  res.json(events);
});

router.post('/', adminOnly, (req, res) => {
  const { name, date, rounds = 1 } = req.body;
  if (!name || !date) return res.status(400).json({ error: '名稱與日期必填' });

  const result = db.prepare(
    'INSERT INTO events (name, date, rounds, created_by) VALUES (?, ?, ?, ?)'
  ).run(name, date, rounds, req.user.id);

  const eventId = result.lastInsertRowid;

  // 每個啟用的輪次預設建立 5 題
  const insertBoulder = db.prepare('INSERT INTO boulders (event_id, round, number, label) VALUES (?, ?, ?, ?)');
  ROUND_KEYS.slice(0, rounds).forEach(round => {
    for (let i = 1; i <= 5; i++) {
      insertBoulder.run(eventId, round, i, `B${i}`);
    }
  });

  // 預設兩組別
  db.prepare('INSERT INTO categories (event_id, name, color) VALUES (?, ?, ?)').run(eventId, '男子公開組', '#c8f135');
  db.prepare('INSERT INTO categories (event_id, name, color) VALUES (?, ?, ?)').run(eventId, '女子公開組', '#38e8d5');

  res.status(201).json(db.prepare('SELECT * FROM events WHERE id = ?').get(eventId));
});

router.get('/:id', (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: '賽事不存在' });
  res.json(event);
});

router.put('/:id', adminOnly, (req, res) => {
  const { name, date, rounds } = req.body;
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: '賽事不存在' });

  const newRounds = rounds ?? event.rounds;
  db.prepare('UPDATE events SET name=?, date=?, rounds=? WHERE id=?').run(
    name ?? event.name,
    date ?? event.date,
    newRounds,
    req.params.id
  );

  // 若輪次增加，補建新輪次的預設 5 題
  if (newRounds > event.rounds) {
    const insertBoulder = db.prepare('INSERT OR IGNORE INTO boulders (event_id, round, number, label) VALUES (?, ?, ?, ?)');
    ROUND_KEYS.slice(event.rounds, newRounds).forEach(round => {
      for (let i = 1; i <= 5; i++) {
        insertBoulder.run(req.params.id, round, i, `B${i}`);
      }
    });
  }

  res.json(db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id));
});

router.delete('/:id', adminOnly, (req, res) => {
  const event = db.prepare('SELECT id FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: '賽事不存在' });
  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Boulders（per round）────────────────────────────────────────────────────

// 取得某輪次的路線
router.get('/:id/boulders/:round', (req, res) => {
  const { id, round } = req.params;
  if (!ROUND_KEYS.includes(round)) return res.status(400).json({ error: '無效輪次' });
  const boulders = db.prepare('SELECT * FROM boulders WHERE event_id = ? AND round = ? ORDER BY number').all(id, round);
  res.json(boulders);
});

// 調整某輪次的路線數（重設該輪次所有路線）
router.put('/:id/boulders/:round/resize', adminOnly, (req, res) => {
  const { id, round } = req.params;
  const { count } = req.body;
  if (!ROUND_KEYS.includes(round)) return res.status(400).json({ error: '無效輪次' });
  if (!count || count < 1 || count > 10) return res.status(400).json({ error: '路線數需介於 1–10' });

  const existing = db.prepare('SELECT * FROM boulders WHERE event_id = ? AND round = ? ORDER BY number').all(id, round);

  // 補充新路線
  const insert = db.prepare('INSERT OR IGNORE INTO boulders (event_id, round, number, label) VALUES (?, ?, ?, ?)');
  for (let i = existing.length + 1; i <= count; i++) {
    insert.run(id, round, i, `B${i}`);
  }

  // 刪除多餘路線（同步刪掉成績）
  if (existing.length > count) {
    const toDelete = existing.slice(count).map(b => b.id);
    const ph = toDelete.map(() => '?').join(',');
    db.prepare(`DELETE FROM boulders WHERE id IN (${ph})`).run(...toDelete);
  }

  const boulders = db.prepare('SELECT * FROM boulders WHERE event_id = ? AND round = ? ORDER BY number').all(id, round);
  res.json(boulders);
});

// 更新單一路線標籤
router.put('/:id/boulders/:bId', adminOnly, (req, res) => {
  const { label } = req.body;
  if (!label) return res.status(400).json({ error: '標籤必填' });
  db.prepare('UPDATE boulders SET label = ? WHERE id = ? AND event_id = ?').run(label, req.params.bId, req.params.id);
  res.json({ ok: true });
});

// ── Categories ───────────────────────────────────────────────────────────────

router.get('/:id/categories', (req, res) => {
  res.json(db.prepare('SELECT * FROM categories WHERE event_id = ? ORDER BY id').all(req.params.id));
});

router.post('/:id/categories', adminOnly, (req, res) => {
  const { name, color = '#c8f135' } = req.body;
  if (!name) return res.status(400).json({ error: '組別名稱必填' });
  const result = db.prepare('INSERT INTO categories (event_id, name, color) VALUES (?, ?, ?)').run(req.params.id, name, color);
  res.status(201).json(db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id/categories/:catId', adminOnly, (req, res) => {
  const { semi_quota, final_quota } = req.body;
  db.prepare('UPDATE categories SET semi_quota=?, final_quota=? WHERE id=? AND event_id=?').run(
    semi_quota ?? 0, final_quota ?? 0, req.params.catId, req.params.id
  );
  res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.catId));
});

router.delete('/:id/categories/:catId', adminOnly, (req, res) => {
  db.prepare('DELETE FROM categories WHERE id = ? AND event_id = ?').run(req.params.catId, req.params.id);
  res.json({ ok: true });
});

// ── Athletes ─────────────────────────────────────────────────────────────────

router.get('/:id/athletes', (req, res) => {
  const { round } = req.query;
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: '賽事不存在' });

  let athletes = db.prepare(`
    SELECT a.*, c.name as category_name, c.color as category_color
    FROM athletes a LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.event_id = ? ORDER BY a.bib
  `).all(req.params.id);

  if (round && round !== 'qual') {
    const advancedIds = getAdvancedIds(db, req.params.id, round);
    if (advancedIds) athletes = athletes.filter(a => advancedIds.has(a.id));
  }

  res.json(athletes);
});

router.post('/:id/athletes', adminOnly, (req, res) => {
  const { name, bib, category_id } = req.body;
  if (!name || !bib) return res.status(400).json({ error: '姓名與號碼牌必填' });
  if (db.prepare('SELECT id FROM athletes WHERE event_id = ? AND bib = ?').get(req.params.id, bib)) {
    return res.status(409).json({ error: '號碼牌已存在' });
  }
  const result = db.prepare(
    'INSERT INTO athletes (event_id, category_id, name, bib) VALUES (?, ?, ?, ?)'
  ).run(req.params.id, category_id || null, name, bib);
  res.status(201).json(db.prepare(`
    SELECT a.*, c.name as category_name, c.color as category_color
    FROM athletes a LEFT JOIN categories c ON a.category_id = c.id WHERE a.id = ?
  `).get(result.lastInsertRowid));
});

router.delete('/:id/athletes/:athId', adminOnly, (req, res) => {
  db.prepare('DELETE FROM athletes WHERE id = ? AND event_id = ?').run(req.params.athId, req.params.id);
  res.json({ ok: true });
});

router.post('/:id/athletes/bulk', adminOnly, (req, res) => {
  const { athletes } = req.body;
  if (!Array.isArray(athletes) || athletes.length === 0) return res.status(400).json({ error: '資料格式錯誤' });

  const imported = [], skipped = [];
  const checkBib = db.prepare('SELECT id FROM athletes WHERE event_id = ? AND bib = ?');
  const insert = db.prepare('INSERT INTO athletes (event_id, category_id, name, bib) VALUES (?, ?, ?, ?)');

  db.transaction(() => {
    for (const a of athletes) {
      if (checkBib.get(req.params.id, a.bib)) {
        skipped.push({ ...a, reason: '號碼牌已存在' });
      } else {
        insert.run(req.params.id, a.category_id || null, a.name, a.bib);
        imported.push(a);
      }
    }
  })();

  res.json({ imported, skipped });
});

// ── Scores ───────────────────────────────────────────────────────────────────

router.get('/:id/scores/:round', (req, res) => {
  const { id, round } = req.params;
  if (!ROUND_KEYS.includes(round)) return res.status(400).json({ error: '無效輪次' });
  res.json(db.prepare(`
    SELECT s.*, a.name as athlete_name, a.bib, b.label as boulder_label, b.number as boulder_number
    FROM scores s
    JOIN athletes a ON s.athlete_id = a.id
    JOIN boulders b ON s.boulder_id = b.id
    WHERE s.event_id = ? AND s.round = ?
  `).all(id, round));
});

router.post('/:id/scores', (req, res) => {
  const { athlete_id, round, scores } = req.body;
  if (!athlete_id || !round || !Array.isArray(scores)) return res.status(400).json({ error: '資料格式錯誤' });
  if (!ROUND_KEYS.includes(round)) return res.status(400).json({ error: '無效輪次' });

  const upsert = db.prepare(`
    INSERT INTO scores (athlete_id, event_id, round, boulder_id, top, top_attempts, zone, zone_attempts, updated_at, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
    ON CONFLICT(athlete_id, round, boulder_id) DO UPDATE SET
      top=excluded.top, top_attempts=excluded.top_attempts,
      zone=excluded.zone, zone_attempts=excluded.zone_attempts,
      updated_at=excluded.updated_at, updated_by=excluded.updated_by
  `);

  db.transaction(items => {
    for (const s of items) {
      upsert.run(athlete_id, req.params.id, round, s.boulder_id, s.top ? 1 : 0, s.top_attempts || 0, s.zone ? 1 : 0, s.zone_attempts || 0, req.user.id);
    }
  })(scores);

  res.json({ ok: true });
});

// ── Ranking ──────────────────────────────────────────────────────────────────

router.get('/:id/ranking/:round', (req, res) => {
  const { id, round } = req.params;
  if (!ROUND_KEYS.includes(round)) return res.status(400).json({ error: '無效輪次' });

  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(id);

  let athletes = db.prepare(`
    SELECT a.*, c.name as category_name, c.color as category_color
    FROM athletes a LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.event_id = ? ORDER BY a.bib
  `).all(id);

  if (round !== 'qual') {
    const advancedIds = getAdvancedIds(db, id, round);
    if (advancedIds) athletes = athletes.filter(a => advancedIds.has(a.id));
  }

  const boulders = db.prepare('SELECT * FROM boulders WHERE event_id = ? AND round = ? ORDER BY number').all(id, round);

  const scoreMap = {};
  db.prepare('SELECT * FROM scores WHERE event_id = ? AND round = ?').all(id, round).forEach(s => {
    if (!scoreMap[s.athlete_id]) scoreMap[s.athlete_id] = {};
    scoreMap[s.athlete_id][s.boulder_id] = s;
  });

  const ranked = athletes.map(a => {
    let tops = 0, zones = 0, tAtt = 0, zAtt = 0;
    boulders.forEach(b => {
      const s = scoreMap[a.id]?.[b.id];
      if (!s) return;
      if (s.top) { tops++; tAtt += s.top_attempts || 1; }
      if (s.zone) { zones++; zAtt += s.zone_attempts || 1; }
    });
    return { ...a, tops, zones, tAtt, zAtt, scored: !!scoreMap[a.id] };
  });

  // IFSC 排名：以組別分組後各自排序
  const byCategory = {};
  ranked.forEach(a => {
    const key = a.category_id || 'none';
    if (!byCategory[key]) byCategory[key] = [];
    byCategory[key].push(a);
  });

  const cmp = (a, b) => {
    if (b.tops !== a.tops) return b.tops - a.tops;
    if (b.zones !== a.zones) return b.zones - a.zones;
    if (a.tAtt !== b.tAtt) return a.tAtt - b.tAtt;
    return a.zAtt - b.zAtt;
  };

  const result = [];
  Object.values(byCategory).forEach(group => {
    group.sort(cmp).forEach((a, i) => result.push({ ...a, rank: i + 1 }));
  });

  const catList = db.prepare('SELECT * FROM categories WHERE event_id = ?').all(id);
  const quotas = {};
  const quotaField = round === 'qual' ? 'semi_quota' : round === 'semi' ? 'final_quota' : null;
  if (quotaField) catList.forEach(c => { quotas[c.id] = c[quotaField] || 0; });
  res.json({ athletes: result, boulders, total: athletes.length, scored: athletes.filter(a => scoreMap[a.id]).length, quotas });
});

// ── CSV Export ───────────────────────────────────────────────────────────────

router.get('/:id/export/:round', adminOnly, (req, res) => {
  const { id, round } = req.params;
  const ROUND_NAMES = { qual: '資格賽', semi: '半決賽', final: '決賽' };
  if (!ROUND_KEYS.includes(round)) return res.status(400).json({ error: '無效輪次' });

  const athletes = db.prepare(`
    SELECT a.*, c.name as category_name FROM athletes a
    LEFT JOIN categories c ON a.category_id = c.id WHERE a.event_id = ? ORDER BY a.bib
  `).all(id);

  const boulders = db.prepare('SELECT * FROM boulders WHERE event_id = ? AND round = ? ORDER BY number').all(id, round);
  const scoreMap = {};
  db.prepare('SELECT * FROM scores WHERE event_id = ? AND round = ?').all(id, round).forEach(s => {
    if (!scoreMap[s.athlete_id]) scoreMap[s.athlete_id] = {};
    scoreMap[s.athlete_id][s.boulder_id] = s;
  });

  const byCategory = {};
  athletes.forEach(a => {
    let tops = 0, zones = 0, tAtt = 0, zAtt = 0;
    boulders.forEach(b => {
      const s = scoreMap[a.id]?.[b.id];
      if (!s) return;
      if (s.top) { tops++; tAtt += s.top_attempts || 1; }
      if (s.zone) { zones++; zAtt += s.zone_attempts || 1; }
    });
    const key = a.category_id || 'none';
    if (!byCategory[key]) byCategory[key] = [];
    byCategory[key].push({ ...a, tops, zones, tAtt, zAtt });
  });

  const cmp = (a, b) => {
    if (b.tops !== a.tops) return b.tops - a.tops;
    if (b.zones !== a.zones) return b.zones - a.zones;
    if (a.tAtt !== b.tAtt) return a.tAtt - b.tAtt;
    return a.zAtt - b.zAtt;
  };

  const rows = [['名次', '號碼牌', '姓名', '組別', 'TOP數', 'ZONE數', 'TOP嘗試次數', 'ZONE嘗試次數']];
  Object.values(byCategory).forEach(group => {
    group.sort(cmp).forEach((a, i) => {
      rows.push([i + 1, a.bib, a.name, a.category_name || '', a.tops, a.zones, a.tAtt, a.zAtt]);
    });
  });

  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const filename = `成績_${ROUND_NAMES[round]}_${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  res.send('﻿' + csv);
});

module.exports = router;
