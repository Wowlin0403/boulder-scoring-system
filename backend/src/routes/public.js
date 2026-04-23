const router = require('express').Router();
const db = require('../db');
const { getAdvancedIds } = require('../utils/advancement');

const ROUND_KEYS = ['qual', 'semi', 'final'];

router.get('/events/:id', (req, res) => {
  const event = db.prepare('SELECT id, name, date, rounds FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: '賽事不存在' });
  res.json(event);
});

router.get('/events/:id/categories', (req, res) => {
  res.json(db.prepare('SELECT * FROM categories WHERE event_id = ? ORDER BY id').all(req.params.id));
});

router.get('/events/:id/ranking/:round', (req, res) => {
  const { id, round } = req.params;
  if (!ROUND_KEYS.includes(round)) return res.status(400).json({ error: '無效輪次' });

  const event = db.prepare('SELECT id, name, date, rounds FROM events WHERE id = ?').get(id);
  if (!event) return res.status(404).json({ error: '賽事不存在' });

  let athletes = db.prepare(`
    SELECT a.*, c.name as category_name, c.color as category_color
    FROM athletes a LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.event_id = ? ORDER BY a.bib
  `).all(id);

  const boulders = db.prepare('SELECT * FROM boulders WHERE event_id = ? AND round = ? ORDER BY number').all(id, round);

  const scoreMap = {};
  db.prepare('SELECT * FROM scores WHERE event_id = ? AND round = ?').all(id, round).forEach(s => {
    if (!scoreMap[s.athlete_id]) scoreMap[s.athlete_id] = {};
    scoreMap[s.athlete_id][s.boulder_id] = s;
  });

  if (round !== 'qual') {
    const advancedIds = getAdvancedIds(db, id, round);
    if (advancedIds) athletes = athletes.filter(a => advancedIds.has(a.id));
  }

  const ranked = athletes.map(a => {
    let tops = 0, zones = 0, tAtt = 0, zAtt = 0;
    const boulderScores = boulders.map(b => {
      const s = scoreMap[a.id]?.[b.id];
      if (!s) return { boulder_id: b.id, top: 0, top_attempts: 0, zone: 0, zone_attempts: 0 };
      if (s.top) { tops++; tAtt += s.top_attempts || 1; }
      if (s.zone) { zones++; zAtt += s.zone_attempts || 1; }
      return { boulder_id: b.id, top: s.top ? 1 : 0, top_attempts: s.top_attempts || 0, zone: s.zone ? 1 : 0, zone_attempts: s.zone_attempts || 0 };
    });
    return { ...a, tops, zones, tAtt, zAtt, scored: !!scoreMap[a.id], boulderScores };
  });

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

module.exports = router;
