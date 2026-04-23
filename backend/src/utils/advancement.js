function getAdvancedIds(db, eventId, toRound) {
  if (toRound === 'qual') return null;

  const fromRound = toRound === 'semi' ? 'qual' : 'semi';
  const quotaField = toRound === 'semi' ? 'semi_quota' : 'final_quota';

  const categories = db.prepare('SELECT * FROM categories WHERE event_id = ?').all(eventId);
  const catQuotas = {};
  categories.forEach(c => { catQuotas[c.id] = c[quotaField] || 0; });

  if (Object.values(catQuotas).every(q => q === 0)) return null;

  const athletes = db.prepare('SELECT id, category_id FROM athletes WHERE event_id = ?').all(eventId);
  const boulders = db.prepare('SELECT id FROM boulders WHERE event_id = ? AND round = ?').all(eventId, fromRound);

  const scoreMap = {};
  db.prepare('SELECT * FROM scores WHERE event_id = ? AND round = ?').all(eventId, fromRound).forEach(s => {
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
    return { id: a.id, category_id: a.category_id, tops, zones, tAtt, zAtt };
  });

  const cmp = (a, b) => {
    if (b.tops !== a.tops) return b.tops - a.tops;
    if (b.zones !== a.zones) return b.zones - a.zones;
    if (a.tAtt !== b.tAtt) return a.tAtt - b.tAtt;
    return a.zAtt - b.zAtt;
  };

  const byCategory = {};
  ranked.forEach(a => {
    const key = a.category_id || 'none';
    if (!byCategory[key]) byCategory[key] = [];
    byCategory[key].push(a);
  });

  const advancedIds = new Set();
  Object.entries(byCategory).forEach(([catKey, group]) => {
    const quota = catKey === 'none' ? 0 : (catQuotas[parseInt(catKey)] || 0);
    group.sort(cmp);
    if (!quota) {
      group.forEach(a => advancedIds.add(a.id));
      return;
    }
    if (group.length <= quota) {
      group.forEach(a => advancedIds.add(a.id));
      return;
    }
    const cutoff = group[quota - 1];
    const cutoffKey = `${cutoff.tops}|${cutoff.zones}|${cutoff.tAtt}|${cutoff.zAtt}`;
    for (let i = 0; i < group.length; i++) {
      const a = group[i];
      const key = `${a.tops}|${a.zones}|${a.tAtt}|${a.zAtt}`;
      if (i < quota || key === cutoffKey) advancedIds.add(a.id);
      else break;
    }
  });

  return advancedIds;
}

module.exports = { getAdvancedIds };
