const router = require('express').Router();
const db = require('../db');
const { adminOnly, superadminOnly, requireEventOwnership } = require('../middleware/auth');
const { getAdvancedIds } = require('../utils/advancement');
const { calcScore, makeCmp, assignRanks, computeRoundRankMap } = require('../utils/ranking');

const ROUND_KEYS = ['qual', 'semi', 'final'];

function getRounds(n) {
  if (n === 2) return ['qual', 'final'];
  return ['qual', 'semi', 'final'].slice(0, n);
}

function createCategoryBoulders(eventId, categoryId, rounds) {
  const insert = db.prepare('INSERT OR IGNORE INTO boulders (event_id, category_id, round, number, label) VALUES (?, ?, ?, ?, ?)');
  getRounds(rounds).forEach(round => {
    for (let i = 1; i <= 5; i++) insert.run(eventId, categoryId, round, i, `B${i}`);
  });
}

const ATHLETE_SELECT = `
  SELECT a.*, c.name as category_name, c.color as category_color, c.rounds as category_rounds
  FROM athletes a LEFT JOIN categories c ON a.category_id = c.id
`;

// ── Events ──────────────────────────────────────────────────────────────────

router.get('/', (req, res) => {
  if (req.user.role === 'organizer') {
    return res.json(db.prepare('SELECT * FROM events WHERE organizer_id = ? ORDER BY date DESC, id DESC').all(req.user.id));
  }
  if (req.user.role === 'judge') {
    const me = db.prepare('SELECT organizer_id FROM users WHERE id = ?').get(req.user.id);
    if (me?.organizer_id) {
      return res.json(db.prepare('SELECT * FROM events WHERE organizer_id = ? ORDER BY date DESC, id DESC').all(me.organizer_id));
    }
    return res.json([]);
  }
  res.json(db.prepare('SELECT * FROM events ORDER BY date DESC, id DESC').all());
});

router.post('/', superadminOnly, (req, res) => {
  const { name, date } = req.body;
  if (!name || !date) return res.status(400).json({ error: '名稱與日期必填' });

  const eventId = db.prepare('INSERT INTO events (name, date) VALUES (?, ?)').run(name, date).lastInsertRowid;

  const insertCat = db.prepare('INSERT INTO categories (event_id, name, color, rounds) VALUES (?, ?, ?, ?)');
  [{ name: '男子公開組', color: '#c8f135' }, { name: '女子公開組', color: '#38e8d5' }].forEach(c => {
    const catId = insertCat.run(eventId, c.name, c.color, 1).lastInsertRowid;
    createCategoryBoulders(eventId, catId, 1);
  });

  res.status(201).json(db.prepare('SELECT * FROM events WHERE id = ?').get(eventId));
});

router.get('/:id', (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: '賽事不存在' });
  res.json(event);
});

router.put('/:id', superadminOnly, (req, res) => {
  const { name, date } = req.body;
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: '賽事不存在' });
  db.prepare('UPDATE events SET name=?, date=? WHERE id=?').run(name ?? event.name, date ?? event.date, req.params.id);
  res.json(db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id));
});

router.delete('/:id', superadminOnly, (req, res) => {
  if (!db.prepare('SELECT id FROM events WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: '賽事不存在' });
  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Boulders（per category per round）────────────────────────────────────────

router.get('/:id/boulders/:round', (req, res) => {
  const { id, round } = req.params;
  const { category_id } = req.query;
  if (!ROUND_KEYS.includes(round)) return res.status(400).json({ error: '無效輪次' });
  if (!category_id) return res.status(400).json({ error: '需提供 category_id' });
  res.json(db.prepare('SELECT * FROM boulders WHERE category_id = ? AND round = ? ORDER BY number').all(category_id, round));
});

router.put('/:id/boulders/:round/resize', adminOnly, requireEventOwnership, (req, res) => {
  const { id, round } = req.params;
  const { count, category_id } = req.body;
  if (!ROUND_KEYS.includes(round)) return res.status(400).json({ error: '無效輪次' });
  if (!count || count < 1 || count > 10) return res.status(400).json({ error: '路線數需介於 1–10' });
  if (!category_id) return res.status(400).json({ error: '需提供 category_id' });

  const existing = db.prepare('SELECT * FROM boulders WHERE category_id = ? AND round = ? ORDER BY number').all(category_id, round);

  const insert = db.prepare('INSERT OR IGNORE INTO boulders (event_id, category_id, round, number, label) VALUES (?, ?, ?, ?, ?)');
  for (let i = existing.length + 1; i <= count; i++) insert.run(id, category_id, round, i, `B${i}`);

  if (existing.length > count) {
    const toDelete = existing.slice(count).map(b => b.id);
    db.prepare(`DELETE FROM boulders WHERE id IN (${toDelete.map(() => '?').join(',')})`).run(...toDelete);
  }

  res.json(db.prepare('SELECT * FROM boulders WHERE category_id = ? AND round = ? ORDER BY number').all(category_id, round));
});

router.put('/:id/boulders/:bId', adminOnly, requireEventOwnership, (req, res) => {
  const { label } = req.body;
  if (!label) return res.status(400).json({ error: '標籤必填' });
  db.prepare('UPDATE boulders SET label = ? WHERE id = ? AND event_id = ?').run(label, req.params.bId, req.params.id);
  res.json({ ok: true });
});

// ── Categories ───────────────────────────────────────────────────────────────

router.get('/:id/categories', (req, res) => {
  res.json(db.prepare('SELECT * FROM categories WHERE event_id = ? ORDER BY id').all(req.params.id));
});

router.post('/:id/categories', adminOnly, requireEventOwnership, (req, res) => {
  const { name, color = '#c8f135', rounds = 1 } = req.body;
  if (!name) return res.status(400).json({ error: '組別名稱必填' });
  const catId = db.prepare('INSERT INTO categories (event_id, name, color, rounds) VALUES (?, ?, ?, ?)').run(req.params.id, name, color, rounds).lastInsertRowid;
  createCategoryBoulders(req.params.id, catId, rounds);
  res.status(201).json(db.prepare('SELECT * FROM categories WHERE id = ?').get(catId));
});

router.put('/:id/categories/:catId', adminOnly, requireEventOwnership, (req, res) => {
  const { semi_quota, final_quota, rounds } = req.body;
  const cat = db.prepare('SELECT * FROM categories WHERE id = ? AND event_id = ?').get(req.params.catId, req.params.id);
  if (!cat) return res.status(404).json({ error: '組別不存在' });

  const newRounds = rounds ?? cat.rounds;
  db.prepare('UPDATE categories SET semi_quota=?, final_quota=?, rounds=? WHERE id=? AND event_id=?').run(
    semi_quota ?? cat.semi_quota ?? 0,
    final_quota ?? cat.final_quota ?? 0,
    newRounds,
    req.params.catId,
    req.params.id
  );

  if (newRounds > cat.rounds) {
    const added = getRounds(newRounds).filter(r => !getRounds(cat.rounds).includes(r));
    const insert = db.prepare('INSERT OR IGNORE INTO boulders (event_id, category_id, round, number, label) VALUES (?, ?, ?, ?, ?)');
    added.forEach(r => { for (let i = 1; i <= 5; i++) insert.run(req.params.id, req.params.catId, r, i, `B${i}`); });
  } else if (newRounds < cat.rounds) {
    const removed = getRounds(cat.rounds).filter(r => !getRounds(newRounds).includes(r));
    removed.forEach(r => db.prepare('DELETE FROM boulders WHERE category_id = ? AND round = ?').run(req.params.catId, r));
  }

  res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.catId));
});

router.delete('/:id/categories/:catId', adminOnly, requireEventOwnership, (req, res) => {
  db.prepare('DELETE FROM categories WHERE id = ? AND event_id = ?').run(req.params.catId, req.params.id);
  res.json({ ok: true });
});

// ── Athletes ─────────────────────────────────────────────────────────────────

router.get('/:id/athletes', (req, res) => {
  const { round } = req.query;
  if (!db.prepare('SELECT id FROM events WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: '賽事不存在' });

  let athletes = db.prepare(`${ATHLETE_SELECT} WHERE a.event_id = ? ORDER BY a.bib`).all(req.params.id);

  if (round && round !== 'qual') {
    const advancedIds = getAdvancedIds(db, req.params.id, round);
    if (advancedIds) athletes = athletes.filter(a => advancedIds.has(a.id));
  }

  res.json(athletes);
});

router.post('/:id/athletes', adminOnly, requireEventOwnership, (req, res) => {
  const { name, bib, category_id } = req.body;
  if (!name || !bib) return res.status(400).json({ error: '姓名與號碼牌必填' });
  if (db.prepare('SELECT id FROM athletes WHERE event_id = ? AND bib = ?').get(req.params.id, bib)) {
    return res.status(409).json({ error: '號碼牌已存在' });
  }
  const athId = db.prepare('INSERT INTO athletes (event_id, category_id, name, bib) VALUES (?, ?, ?, ?)').run(req.params.id, category_id || null, name, bib).lastInsertRowid;
  res.status(201).json(db.prepare(`${ATHLETE_SELECT} WHERE a.id = ?`).get(athId));
});

router.delete('/:id/athletes', adminOnly, requireEventOwnership, (req, res) => {
  db.prepare('DELETE FROM athletes WHERE event_id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.delete('/:id/athletes/:athId', adminOnly, requireEventOwnership, (req, res) => {
  db.prepare('DELETE FROM athletes WHERE id = ? AND event_id = ?').run(req.params.athId, req.params.id);
  res.json({ ok: true });
});

router.post('/:id/athletes/bulk', adminOnly, requireEventOwnership, (req, res) => {
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

router.put('/:id/scores/attempt', (req, res) => {
  const { athlete_id, round, boulder_id, attempts } = req.body;
  if (!athlete_id || !round || !boulder_id || attempts === undefined) return res.status(400).json({ error: '資料格式錯誤' });
  db.prepare(`
    INSERT INTO scores (athlete_id, event_id, round, boulder_id, attempts, updated_at, updated_by)
    VALUES (?, ?, ?, ?, ?, datetime('now'), ?)
    ON CONFLICT(athlete_id, round, boulder_id) DO UPDATE SET
      attempts=excluded.attempts, updated_at=excluded.updated_at
  `).run(athlete_id, req.params.id, round, boulder_id, attempts, req.user.id);
  res.json({ ok: true });
});

// ── Ranking ──────────────────────────────────────────────────────────────────

router.get('/:id/ranking/:round', (req, res) => {
  const { id, round } = req.params;
  if (!ROUND_KEYS.includes(round)) return res.status(400).json({ error: '無效輪次' });

  const catList = db.prepare('SELECT * FROM categories WHERE event_id = ?').all(id);
  const activeCats = catList.filter(c => getRounds(c.rounds).includes(round));
  const activeCatIds = new Set(activeCats.map(c => c.id));

  let athletes = db.prepare(`${ATHLETE_SELECT} WHERE a.event_id = ? ORDER BY a.bib`).all(id);

  if (round !== 'qual') {
    const advancedIds = getAdvancedIds(db, id, round);
    if (advancedIds) athletes = athletes.filter(a => advancedIds.has(a.id));
  }

  athletes = athletes.filter(a => a.category_id && activeCatIds.has(a.category_id));

  const bouldersMap = {};
  activeCats.forEach(c => {
    bouldersMap[c.id] = db.prepare('SELECT * FROM boulders WHERE category_id = ? AND round = ? ORDER BY number').all(c.id, round);
  });

  const scoreMap = {};
  db.prepare('SELECT * FROM scores WHERE event_id = ? AND round = ?').all(id, round).forEach(s => {
    if (!scoreMap[s.athlete_id]) scoreMap[s.athlete_id] = {};
    scoreMap[s.athlete_id][s.boulder_id] = s;
  });

  const byCategory = {};
  athletes.forEach(a => {
    const key = a.category_id;
    if (!byCategory[key]) byCategory[key] = [];
    const boulders = bouldersMap[a.category_id] || [];
    let tops = 0, zones = 0, tAtt = 0, zAtt = 0;
    const boulderScores = boulders.map(b => {
      const s = scoreMap[a.id]?.[b.id];
      if (!s) return { boulder_id: b.id, top: 0, top_attempts: 0, zone: 0, zone_attempts: 0 };
      if (s.top) { tops++; tAtt += s.top_attempts || 1; }
      if (s.zone) { zones++; zAtt += s.zone_attempts || 1; }
      return { boulder_id: b.id, top: s.top ? 1 : 0, top_attempts: s.top_attempts || 0, zone: s.zone ? 1 : 0, zone_attempts: s.zone_attempts || 0 };
    });
    byCategory[key].push({ ...a, tops, zones, tAtt, zAtt, scored: !!scoreMap[a.id], boulderScores, score: calcScore(boulderScores) });
  });

  // Build prev-round rank maps per category for tiebreaking
  const prevRankMaps = {};
  activeCats.forEach(cat => {
    const catRoundsArr = getRounds(cat.rounds);
    const idx = catRoundsArr.indexOf(round);
    if (idx > 0) {
      prevRankMaps[cat.id] = computeRoundRankMap(db, id, cat.id, catRoundsArr[idx - 1], catRoundsArr);
    }
  });

  const result = [];
  Object.entries(byCategory).forEach(([catId, group]) => {
    const cmp = makeCmp(prevRankMaps[catId] || null);
    assignRanks(group, cmp);
    group.forEach(a => result.push(a));
  });

  const quotas = {};
  const quotaField = round === 'qual' ? 'semi_quota' : round === 'semi' ? 'final_quota' : null;
  if (quotaField) catList.forEach(c => { quotas[c.id] = c[quotaField] || 0; });

  res.json({ athletes: result, bouldersMap, total: athletes.length, scored: athletes.filter(a => scoreMap[a.id]).length, quotas });
});

// ── CSV Export ───────────────────────────────────────────────────────────────

router.get('/:id/export/:round', adminOnly, requireEventOwnership, (req, res) => {
  const { id, round } = req.params;
  const { category_id, type = 'results' } = req.query;
  const ROUND_NAMES = { qual: '資格賽', semi: '複賽', final: '決賽' };
  if (!ROUND_KEYS.includes(round)) return res.status(400).json({ error: '無效輪次' });

  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
  if (!event) return res.status(404).json({ error: '賽事不存在' });

  const catList = db.prepare('SELECT * FROM categories WHERE event_id = ?').all(id);
  const roundCats = catList.filter(c => getRounds(c.rounds).includes(round));
  const activeCats = category_id ? roundCats.filter(c => String(c.id) === String(category_id)) : roundCats;
  const activeCatIds = new Set(activeCats.map(c => c.id));

  const allAthletes = db.prepare(`
    SELECT a.*, c.name as category_name FROM athletes a
    LEFT JOIN categories c ON a.category_id = c.id WHERE a.event_id = ? ORDER BY a.bib
  `).all(id).filter(a => a.category_id && activeCatIds.has(a.category_id));

  const bouldersMap = {};
  activeCats.forEach(c => {
    bouldersMap[c.id] = db.prepare('SELECT * FROM boulders WHERE category_id = ? AND round = ? ORDER BY number').all(c.id, round);
  });

  const scoreMap = {};
  db.prepare('SELECT * FROM scores WHERE event_id = ? AND round = ?').all(id, round).forEach(s => {
    if (!scoreMap[s.athlete_id]) scoreMap[s.athlete_id] = {};
    scoreMap[s.athlete_id][s.boulder_id] = s;
  });

  const rows = [];

  activeCats.forEach((cat, catIdx) => {
    const boulders = bouldersMap[cat.id] || [];
    const catRoundsArr = getRounds(cat.rounds);
    const roundIdx = catRoundsArr.indexOf(round);

    let catAthletes = allAthletes.filter(a => a.category_id === cat.id);
    if (round !== 'qual') {
      const advancedIds = getAdvancedIds(db, id, round);
      if (advancedIds) catAthletes = catAthletes.filter(a => advancedIds.has(a.id));
    }

    // Build start order
    let athletesWithOrder;
    if (round === 'qual' || roundIdx <= 0) {
      athletesWithOrder = catAthletes.map((a, i) => ({ ...a, startOrder: i + 1 }));
    } else {
      const prevRound = catRoundsArr[roundIdx - 1];
      const prevRM = computeRoundRankMap(db, id, cat.id, prevRound, catRoundsArr);
      const sorted = [...catAthletes].sort((a, b) => {
        const ra = prevRM[a.id] ?? 9999, rb = prevRM[b.id] ?? 9999;
        if (ra !== rb) return rb - ra;
        return String(a.bib).localeCompare(String(b.bib));
      });
      athletesWithOrder = sorted.map((a, i) => ({ ...a, startOrder: i + 1 }));
    }

    // Score and rank
    const prevRankMap = roundIdx > 0 ? computeRoundRankMap(db, id, cat.id, catRoundsArr[roundIdx - 1], catRoundsArr) : null;
    const cmp = makeCmp(prevRankMap);

    const scoredAthletes = athletesWithOrder.map(a => {
      const boulderScores = boulders.map(b => {
        const s = scoreMap[a.id]?.[b.id];
        if (!s) return { top: 0, top_attempts: 0, zone: 0, zone_attempts: 0 };
        return { top: s.top ? 1 : 0, top_attempts: s.top_attempts || 0, zone: s.zone ? 1 : 0, zone_attempts: s.zone_attempts || 0 };
      });
      let tops = 0, zones = 0, tAtt = 0, zAtt = 0;
      boulderScores.forEach(b => {
        if (b.top) { tops++; tAtt += b.top_attempts || 1; }
        if (b.zone) { zones++; zAtt += b.zone_attempts || 1; }
      });
      return { ...a, boulderScores, score: calcScore(boulderScores), tops, zones, tAtt, zAtt };
    });

    assignRanks(scoredAthletes, cmp);

    // Determine who advances to next round
    let advancingIds = new Set();
    const nextRoundIdx = roundIdx + 1;
    if (nextRoundIdx < catRoundsArr.length) {
      const nextAdvanced = getAdvancedIds(db, id, catRoundsArr[nextRoundIdx]);
      if (nextAdvanced) advancingIds = nextAdvanced;
    }

    // Event header rows (only for first category)
    if (catIdx === 0) {
      rows.push([event.name]);
      rows.push([event.date]);
    }

    const isStartOrder = type === 'startorder';

    // Category / round header
    rows.push([cat.name, ROUND_NAMES[round], isStartOrder ? '出場序' : '成績']);

    // Double column headers
    const header1 = ['出場序', ...(isStartOrder ? [] : ['晉級', '排名']), '背號', '姓名'];
    const header2 = ['', ...(isStartOrder ? [] : ['', '']), '', ''];
    boulders.forEach(b => { header1.push(`B${b.number}`, ''); header2.push('Top', 'Zone'); });
    header1.push('成績', '', '', '');
    header2.push('結果', '總Top次', '總Zone次', '分數');
    rows.push(header1);
    rows.push(header2);

    const dataRows = isStartOrder
      ? [...scoredAthletes].sort((a, b) => a.startOrder - b.startOrder)
      : [...scoredAthletes].sort((a, b) => a.rank - b.rank || a.startOrder - b.startOrder);

    dataRows.forEach(a => {
      const row = [a.startOrder, ...(isStartOrder ? [] : [advancingIds.has(a.id) ? 'V' : '', a.rank]), a.bib, a.name];
      boulders.forEach((_, i) => {
        const bs = isStartOrder ? null : a.boulderScores[i];
        row.push(bs?.top ? (bs.top_attempts || 1) : '');
        row.push(bs?.zone ? (bs.zone_attempts || 1) : '');
      });
      if (isStartOrder) {
        row.push('', '', '', '');
      } else {
        row.push(`${a.tops}T${a.zones}Z`, a.tAtt, a.zAtt, a.score.toFixed(1));
      }
      rows.push(row);
    });

    rows.push([]);
  });

  const csv = rows.map(r => r.map(v => `"${String(v ?? '')}"`).join(',')).join('\n');
  const typeLabel = type === 'startorder' ? '出場序' : '成績';
  const filename = `${typeLabel}_${ROUND_NAMES[round]}_${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  res.send('﻿' + csv);
});

// ── Start Order ──────────────────────────────────────────────────────────────

router.get('/:id/categories/:catId/startorder/:round', (req, res) => {
  const { id, catId, round } = req.params;
  if (!ROUND_KEYS.includes(round)) return res.status(400).json({ error: '無效輪次' });

  const category = db.prepare('SELECT * FROM categories WHERE id = ? AND event_id = ?').get(catId, id);
  if (!category) return res.status(404).json({ error: '組別不存在' });

  const catRoundsArr = getRounds(category.rounds);
  const roundIdx = catRoundsArr.indexOf(round);

  let athletes = db.prepare('SELECT * FROM athletes WHERE event_id = ? AND category_id = ? ORDER BY bib').all(id, catId);

  if (round !== 'qual') {
    const advancedIds = getAdvancedIds(db, id, round);
    if (advancedIds) athletes = athletes.filter(a => advancedIds.has(a.id));
  }

  if (round === 'qual' || roundIdx <= 0) {
    return res.json(athletes.map((a, i) => ({ ...a, startOrder: i + 1, prevRank: null })));
  }

  const prevRound = catRoundsArr[roundIdx - 1];
  const prevRankMap = computeRoundRankMap(db, id, catId, prevRound, catRoundsArr);

  athletes.sort((a, b) => {
    const ra = prevRankMap[a.id] ?? 9999;
    const rb = prevRankMap[b.id] ?? 9999;
    if (ra !== rb) return rb - ra;
    return String(a.bib).localeCompare(String(b.bib));
  });

  res.json(athletes.map((a, i) => ({ ...a, startOrder: i + 1, prevRank: prevRankMap[a.id] ?? null })));
});

module.exports = router;
