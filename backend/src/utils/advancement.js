const { calcScore } = require('./ranking');

function getRounds(n) {
  if (n === 2) return ['qual', 'final'];
  return ['qual', 'semi', 'final'].slice(0, n);
}

function getAdvancedIds(db, eventId, toRound) {
  if (toRound === 'qual') return null;

  const categories = db.prepare('SELECT * FROM categories WHERE event_id = ?').all(eventId);
  const quotaField = toRound === 'semi' ? 'semi_quota' : 'final_quota';

  const athletes = db.prepare('SELECT id, category_id FROM athletes WHERE event_id = ?').all(eventId);

  // Pre-compute semi advancement for final round (applied per-category only if category has semi)
  let semiAdvancedIds = null;
  if (toRound !== 'semi') {
    semiAdvancedIds = getAdvancedIds(db, eventId, 'semi');
  }

  const allScores = {};
  db.prepare('SELECT * FROM scores WHERE event_id = ?').all(eventId).forEach(s => {
    const key = `${s.athlete_id}|${s.round}`;
    if (!allScores[key]) allScores[key] = {};
    allScores[key][s.boulder_id] = s;
  });

  const byCategory = {};
  athletes.forEach(a => {
    const key = a.category_id || 'none';
    if (!byCategory[key]) byCategory[key] = [];
    byCategory[key].push(a);
  });

  const advancedIds = new Set();

  Object.entries(byCategory).forEach(([catKey, group]) => {
    if (catKey === 'none') return;
    const catId = parseInt(catKey);
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;

    const catRounds = getRounds(cat.rounds);
    const toIdx = catRounds.indexOf(toRound);
    if (toIdx <= 0) return;

    // For final: filter by semi advancement only if this category actually has a semi round
    let catGroup = group;
    if (semiAdvancedIds !== null && catRounds.includes('semi')) {
      catGroup = group.filter(a => semiAdvancedIds.has(a.id));
    }

    const fromRound = catRounds[toIdx - 1];
    const quota = cat[quotaField] || 0;
    const boulders = db.prepare('SELECT * FROM boulders WHERE category_id = ? AND round = ? ORDER BY number').all(catId, fromRound);

    const ranked = catGroup.map(a => {
      const scores = allScores[`${a.id}|${fromRound}`] || {};
      const boulderScores = boulders.map(b => {
        const s = scores[b.id];
        if (!s) return { top: 0, top_attempts: 0, zone: 0, zone_attempts: 0 };
        return { top: s.top ? 1 : 0, top_attempts: s.top_attempts || 0, zone: s.zone ? 1 : 0, zone_attempts: s.zone_attempts || 0 };
      });
      return { id: a.id, score: calcScore(boulderScores) };
    });

    ranked.sort((a, b) => b.score - a.score);

    if (!quota || ranked.length <= quota) {
      ranked.forEach(a => advancedIds.add(a.id));
      return;
    }

    const cutoffScore = ranked[quota - 1].score;
    for (const a of ranked) {
      if (a.score >= cutoffScore) advancedIds.add(a.id);
      else break;
    }
  });

  return advancedIds;
}

module.exports = { getAdvancedIds };
