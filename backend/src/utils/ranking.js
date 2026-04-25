function getRounds(n) {
  if (n === 2) return ['qual', 'final'];
  return ['qual', 'semi', 'final'].slice(0, n);
}

// Build a score comparator; prevRankMap breaks ties when scores are equal
function makeCmp(prevRankMap) {
  return (a, b) => {
    if (b.tops !== a.tops) return b.tops - a.tops;
    if (b.zones !== a.zones) return b.zones - a.zones;
    if (a.tAtt !== b.tAtt) return a.tAtt - b.tAtt;
    if (a.zAtt !== b.zAtt) return a.zAtt - b.zAtt;
    if (prevRankMap) {
      const pa = prevRankMap[a.id] ?? null;
      const pb = prevRankMap[b.id] ?? null;
      if (pa !== null && pb !== null && pa !== pb) return pa - pb;
    }
    return 0;
  };
}

// Sort group and assign ranks: ties get the same rank, subsequent ranks skip accordingly
function assignRanks(group, cmp) {
  if (group.length === 0) return;
  group.sort(cmp);
  group[0].rank = 1;
  for (let i = 1; i < group.length; i++) {
    group[i].rank = cmp(group[i], group[i - 1]) === 0 ? group[i - 1].rank : i + 1;
  }
}

// Recursively compute { [athleteId]: rank } for a round, using prev round as tiebreaker
function computeRoundRankMap(db, eventId, catId, round, catRoundsArr) {
  const idx = catRoundsArr.indexOf(round);

  let prevRankMap = null;
  if (idx > 0) {
    prevRankMap = computeRoundRankMap(db, eventId, catId, catRoundsArr[idx - 1], catRoundsArr);
  }

  const boulders = db.prepare(
    'SELECT * FROM boulders WHERE category_id = ? AND round = ? ORDER BY number'
  ).all(catId, round);

  const athletes = db.prepare(
    'SELECT id FROM athletes WHERE event_id = ? AND category_id = ?'
  ).all(eventId, catId);

  const scoreMap = {};
  db.prepare('SELECT * FROM scores WHERE event_id = ? AND round = ?').all(eventId, round).forEach(s => {
    if (!scoreMap[s.athlete_id]) scoreMap[s.athlete_id] = {};
    scoreMap[s.athlete_id][s.boulder_id] = s;
  });

  const data = athletes.map(a => {
    let tops = 0, zones = 0, tAtt = 0, zAtt = 0;
    boulders.forEach(b => {
      const s = scoreMap[a.id]?.[b.id];
      if (!s) return;
      if (s.top) { tops++; tAtt += s.top_attempts || 1; }
      if (s.zone) { zones++; zAtt += s.zone_attempts || 1; }
    });
    return { id: a.id, tops, zones, tAtt, zAtt };
  });

  const cmp = makeCmp(prevRankMap);
  data.sort(cmp);

  const rankMap = {};
  if (data.length > 0) {
    rankMap[data[0].id] = 1;
    for (let i = 1; i < data.length; i++) {
      rankMap[data[i].id] = cmp(data[i], data[i - 1]) === 0 ? rankMap[data[i - 1].id] : i + 1;
    }
  }

  return rankMap;
}

module.exports = { getRounds, makeCmp, assignRanks, computeRoundRankMap };
