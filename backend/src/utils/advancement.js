function getRounds(n) {
  if (n === 2) return ['qual', 'final'];
  return ['qual', 'semi', 'final'].slice(0, n);
}

const cmp = (a, b) => {
  if (b.tops !== a.tops) return b.tops - a.tops;
  if (b.zones !== a.zones) return b.zones - a.zones;
  if (a.tAtt !== b.tAtt) return a.tAtt - b.tAtt;
  return a.zAtt - b.zAtt;
};

function getAdvancedIds(db, eventId, toRound) {
  if (toRound === 'qual') return null;

  const categories = db.prepare('SELECT * FROM categories WHERE event_id = ?').all(eventId);
  const quotaField = toRound === 'semi' ? 'semi_quota' : 'final_quota';

  const athletes = db.prepare('SELECT id, category_id FROM athletes WHERE event_id = ?').all(eventId);

  // Index all scores for this event by athlete+round
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
    if (toIdx <= 0) return; // this category doesn't include toRound

    const fromRound = catRounds[toIdx - 1];
    const quota = cat[quotaField] || 0;
    const boulders = db.prepare('SELECT id FROM boulders WHERE category_id = ? AND round = ?').all(catId, fromRound);

    const ranked = group.map(a => {
      const scores = allScores[`${a.id}|${fromRound}`] || {};
      let tops = 0, zones = 0, tAtt = 0, zAtt = 0;
      boulders.forEach(b => {
        const s = scores[b.id];
        if (!s) return;
        if (s.top) { tops++; tAtt += s.top_attempts || 1; }
        if (s.zone) { zones++; zAtt += s.zone_attempts || 1; }
      });
      return { id: a.id, tops, zones, tAtt, zAtt };
    });

    ranked.sort(cmp);

    if (!quota || ranked.length <= quota) {
      ranked.forEach(a => advancedIds.add(a.id));
      return;
    }

    const cutoff = ranked[quota - 1];
    const cutoffKey = `${cutoff.tops}|${cutoff.zones}|${cutoff.tAtt}|${cutoff.zAtt}`;
    for (let i = 0; i < ranked.length; i++) {
      const a = ranked[i];
      const key = `${a.tops}|${a.zones}|${a.tAtt}|${a.zAtt}`;
      if (i < quota || key === cutoffKey) advancedIds.add(a.id);
      else break;
    }
  });

  return advancedIds;
}

module.exports = { getAdvancedIds };
