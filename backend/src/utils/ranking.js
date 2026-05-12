function getRounds(n) {
  if (n === 2) return ['qual', 'final'];
  return ['qual', 'semi', 'final'].slice(0, n);
}

function calcScore(boulderScores) {
  return boulderScores.reduce((sum, b) => {
    if (b.top) return sum + (25 - 0.1 * ((b.top_attempts || 1) - 1));
    if (b.zone) return sum + (10 - 0.1 * ((b.zone_attempts || 1) - 1));
    return sum;
  }, 0);
}

// Compare by score (desc); prevRankMap breaks exact ties
function makeCmp(prevRankMap) {
  return (a, b) => {
    if (Math.abs(b.score - a.score) > 1e-9) return b.score - a.score;
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
    const boulderScores = boulders.map(b => {
      const s = scoreMap[a.id]?.[b.id];
      if (!s) return { top: 0, top_attempts: 0, zone: 0, zone_attempts: 0 };
      return { top: s.top ? 1 : 0, top_attempts: s.top_attempts || 0, zone: s.zone ? 1 : 0, zone_attempts: s.zone_attempts || 0 };
    });
    return { id: a.id, score: calcScore(boulderScores) };
  });

  const cmp = makeCmp(prevRankMap);
  assignRanks(data, cmp);

  const rankMap = {};
  data.forEach(a => { rankMap[a.id] = a.rank; });
  return rankMap;
}

// Rank non-DNS athletes normally, then rank DNS athletes after them using prevRankMap tiebreaker
function assignRanksWithDns(group, cmp, prevRankMap) {
  const competing = group.filter(a => !a.is_dns);
  const dns = group.filter(a => a.is_dns);

  assignRanks(competing, cmp);

  const offset = competing.length;

  if (dns.length > 0) {
    const dnsCmp = (a, b) => {
      if (prevRankMap) {
        const pa = prevRankMap[a.id] ?? null;
        const pb = prevRankMap[b.id] ?? null;
        if (pa !== null && pb !== null && pa !== pb) return pa - pb;
      }
      return 0;
    };
    dns.sort(dnsCmp);
    dns[0].rank = offset + 1;
    for (let i = 1; i < dns.length; i++) {
      dns[i].rank = dnsCmp(dns[i], dns[i - 1]) === 0 ? dns[i - 1].rank : offset + i + 1;
    }
  }

  // 無論有無 DNS 都重新排序 group，確保 result 按排名順序輸出
  const sorted = [...competing, ...dns];
  for (let i = 0; i < sorted.length; i++) group[i] = sorted[i];
}

module.exports = { getRounds, calcScore, makeCmp, assignRanks, assignRanksWithDns, computeRoundRankMap };
