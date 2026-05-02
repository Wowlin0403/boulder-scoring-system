const router = require('express').Router();
const db = require('../db');
const { getAdvancedIds } = require('../utils/advancement');
const { calcScore, makeCmp, assignRanks, computeRoundRankMap } = require('../utils/ranking');

const ROUND_KEYS = ['qual', 'semi', 'final'];

function getRounds(n) {
  if (n === 2) return ['qual', 'final'];
  return ['qual', 'semi', 'final'].slice(0, n);
}

router.get('/events/:id', (req, res) => {
  const event = db.prepare('SELECT id, name, date FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: '賽事不存在' });
  res.json(event);
});

router.get('/events/:id/categories', (req, res) => {
  res.json(db.prepare('SELECT * FROM categories WHERE event_id = ? ORDER BY id').all(req.params.id));
});

router.get('/events/:id/ranking/:round', (req, res) => {
  const { id, round } = req.params;
  if (!ROUND_KEYS.includes(round)) return res.status(400).json({ error: '無效輪次' });

  if (!db.prepare('SELECT id FROM events WHERE id = ?').get(id)) return res.status(404).json({ error: '賽事不存在' });

  const catList = db.prepare('SELECT * FROM categories WHERE event_id = ?').all(id);
  const activeCats = catList.filter(c => getRounds(c.rounds).includes(round));
  const activeCatIds = new Set(activeCats.map(c => c.id));

  let athletes = db.prepare(`
    SELECT a.*, c.name as category_name, c.color as category_color
    FROM athletes a LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.event_id = ? ORDER BY a.bib
  `).all(id);

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
      if (!s) return { boulder_id: b.id, top: 0, top_attempts: 0, zone: 0, zone_attempts: 0, attempts: 0 };
      if (s.top) { tops++; tAtt += s.top_attempts || 1; }
      if (s.zone) { zones++; zAtt += s.zone_attempts || 1; }
      return { boulder_id: b.id, top: s.top ? 1 : 0, top_attempts: s.top_attempts || 0, zone: s.zone ? 1 : 0, zone_attempts: s.zone_attempts || 0, attempts: s.attempts || 0 };
    });
    byCategory[key].push({ ...a, tops, zones, tAtt, zAtt, scored: !!scoreMap[a.id], boulderScores, score: calcScore(boulderScores) });
  });

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

module.exports = router;
