const { calcScore, getRankOverrides, applyRankOverrides } = require('./ranking');

function getRounds(n) {
  if (n === 2) return ['qual', 'final'];
  return ['qual', 'semi', 'final'].slice(0, n);
}

function getGuaranteedIds(db, eventId, round) {
  const rows = db.prepare('SELECT athlete_id FROM guaranteed_advancements WHERE event_id = ? AND round = ?').all(eventId, round);
  return new Set(rows.map(r => r.athlete_id));
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

  const dnsMap = {};
  db.prepare('SELECT athlete_id, round FROM dns_records WHERE event_id = ?').all(eventId).forEach(r => {
    if (!dnsMap[r.round]) dnsMap[r.round] = new Set();
    dnsMap[r.round].add(r.athlete_id);
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

    const fromRound = catRounds[toIdx - 1];

    // For final: filter by semi advancement only if this category actually has a semi round
    let catGroup = group;
    if (semiAdvancedIds !== null && catRounds.includes('semi')) {
      catGroup = group.filter(a => semiAdvancedIds.has(a.id));
    }

    // Exclude athletes who are DNS in fromRound
    const fromRoundDns = dnsMap[fromRound] || new Set();
    catGroup = catGroup.filter(a => !fromRoundDns.has(a.id));
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
    ranked.forEach((a, i) => {
      a.rank = (i > 0 && Math.abs(ranked[i - 1].score - a.score) < 1e-9) ? ranked[i - 1].rank : i + 1;
    });
    applyRankOverrides(ranked, getRankOverrides(db, eventId, fromRound));

    if (!quota || ranked.length <= quota) {
      ranked.forEach(a => advancedIds.add(a.id));
      return;
    }

    const cutoffRank = ranked[quota - 1].rank;
    let qualifying = ranked.filter(a => a.rank <= cutoffRank);

    // Guaranteed advancement: swap a flagged athlete into the qualifying set by
    // bumping the worst-ranked non-guaranteed qualifier. DNS'd athletes were
    // already excluded from `catGroup`/`ranked` above, so they can never be
    // pulled in here even if flagged.
    const guaranteedSet = getGuaranteedIds(db, eventId, fromRound);
    const qualifyingIds = new Set(qualifying.map(a => a.id));
    const guaranteedNotIn = ranked.filter(a => guaranteedSet.has(a.id) && !qualifyingIds.has(a.id));

    if (guaranteedNotIn.length > 0) {
      const removable = qualifying.filter(a => !guaranteedSet.has(a.id)).sort((a, b) => b.rank - a.rank);
      const removeIds = new Set(removable.slice(0, guaranteedNotIn.length).map(a => a.id));
      qualifying = qualifying.filter(a => !removeIds.has(a.id)).concat(guaranteedNotIn);
    }

    qualifying.forEach(a => advancedIds.add(a.id));
  });

  return advancedIds;
}

module.exports = { getAdvancedIds, getGuaranteedIds };
