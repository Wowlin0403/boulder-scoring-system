import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { eventsAPI } from '../api';

const ROUND_NAMES = { qual: '資格賽', semi: '複賽', final: '決賽' };
const getRounds = (n) => n === 2 ? ['qual', 'final'] : ['qual', 'semi', 'final'].slice(0, n);

function calcScore(boulderScores) {
  if (!boulderScores) return 0;
  return boulderScores.reduce((sum, b) => {
    if (b.top) return sum + (25 - 0.1 * (b.top_attempts - 1));
    if (b.zone) return sum + (10 - 0.1 * (b.zone_attempts - 1));
    return sum;
  }, 0);
}

function BoulderCard({ b }) {
  const topped = b.top > 0;
  const zoned = b.zone > 0;
  return (
    <div className="flex flex-col" style={{ width: 28, height: 42, borderRadius: 5, overflow: 'hidden', border: '1px solid #3a3a3e' }}>
      <div className="flex-1 flex items-center justify-center font-mono font-bold text-[10px] border-b" style={{
        background: topped ? '#c8f135' : 'transparent',
        color: topped ? '#0d0d0f' : 'transparent',
        borderBottomColor: topped ? 'rgba(200,241,53,0.5)' : '#2a2a2e',
      }}>
        {topped ? b.top_attempts : ''}
      </div>
      <div className="flex-1 flex items-center justify-center font-mono font-bold text-[10px]" style={{
        background: zoned ? 'rgba(56,232,213,0.22)' : 'transparent',
        color: zoned ? '#38e8d5' : 'transparent',
      }}>
        {zoned ? b.zone_attempts : ''}
      </div>
    </div>
  );
}

export default function Ranking() {
  const { id, catId } = useParams();
  const [event, setEvent] = useState(null);
  const [category, setCategory] = useState(null);
  const [ranking, setRanking] = useState(null);
  const [round, setRound] = useState('qual');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([eventsAPI.get(id), eventsAPI.getCategories(id)]).then(([ev, cl]) => {
      setEvent(ev.data);
      const found = cl.data.find(c => String(c.id) === String(catId));
      setCategory(found || null);
      if (found) setRound(getRounds(found.rounds)[0]);
    });
  }, [id, catId]);

  const loadRanking = useCallback(async () => {
    setLoading(true);
    try {
      const res = await eventsAPI.getRanking(id, round);
      setRanking(res.data);
    } finally {
      setLoading(false);
    }
  }, [id, round]);

  useEffect(() => { loadRanking(); }, [loadRanking]);

  if (!event || !category) return <Layout><div className="text-txt3 font-mono py-16 text-center">載入中...</div></Layout>;

  const availableRounds = getRounds(category.rounds);
  const bouldersMap = ranking?.bouldersMap || {};
  const catBoulders = bouldersMap[catId] || [];
  const athletes = (ranking?.athletes || []).filter(a => String(a.category_id) === String(catId));
  const quota = (ranking?.quotas || {})[catId] || 0;
  const cutoffRank = quota > 0 && athletes.length >= quota ? athletes[quota - 1].rank : null;

  return (
    <Layout>
      <div className="flex items-center gap-2 mb-6 text-txt3 font-mono text-xs">
        <Link to="/events" className="hover:text-txt transition-colors">比賽列表</Link>
        <span>/</span>
        <Link to={`/events/${id}`} className="hover:text-txt transition-colors">{event.name}</Link>
        <span>/</span>
        <Link to={`/events/${id}/categories/${catId}`} className="hover:text-txt transition-colors">{category.name}</Link>
        <span>/</span>
        <span className="text-txt">即時排名</span>
      </div>

      {ranking && (
        <div className="flex gap-3 mb-5 flex-wrap">
          {[
            { v: athletes.length, l: '選手數' },
            { v: athletes.filter(a => a.tops > 0 || a.zones > 0).length, l: '已計分' },
          ].map(s => (
            <div key={s.l} className="bg-s1 border border-border rounded-md px-4 py-3">
              <div className="font-condensed font-black text-3xl text-lime leading-none">{s.v}</div>
              <div className="font-mono text-[10px] tracking-widest text-txt3 mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 flex-wrap items-end mb-5">
        <div className="min-w-32">
          <label className="block font-mono text-[10px] tracking-widest uppercase text-txt3 mb-1.5">輪次</label>
          <select value={round} onChange={e => setRound(e.target.value)}>
            {availableRounds.map(r => <option key={r} value={r}>{ROUND_NAMES[r]}</option>)}
          </select>
        </div>
        <button onClick={loadRanking}
          className="border border-border2 text-txt2 font-condensed font-bold text-xs tracking-widest uppercase px-4 py-[9px] rounded hover:border-txt2 hover:text-txt transition-colors">
          ↻ 刷新
        </button>
      </div>

      {loading ? (
        <div className="text-txt3 font-mono text-center py-12">計算中...</div>
      ) : athletes.length === 0 ? (
        <div className="text-txt3 font-mono text-center py-12">暫無排名資料</div>
      ) : (
        <div className="bg-s1 border border-border rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4 font-condensed font-black text-xl tracking-widest uppercase">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: category.color }} />
            <span>{category.name}</span>
            <span className="text-xs text-txt3 font-mono font-normal">{athletes.length} 人</span>
            <span className="text-xs text-txt3/60 font-mono font-normal">{catBoulders.length} 題</span>
            {quota > 0 && <span className="text-xs text-lime/60 font-mono font-normal ml-auto">晉級 {quota} 人</span>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  {['名次', '號碼', '姓名', '實際表現', 'TOP', 'ZONE', 'TOP次數', '分數'].map(h => (
                    <th key={h} className="font-mono text-[9px] tracking-widest uppercase text-txt3 py-2 px-3 text-left border-b border-border whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  return athletes.map((a, rowIdx) => {
                    const score = calcScore(a.boulderScores);
                    const hasScore = score > 0;
                    const showCutoff = cutoffRank !== null && a.rank > cutoffRank && (rowIdx === 0 || athletes[rowIdx - 1].rank <= cutoffRank);
                    return (
                      <>
                        {showCutoff && (
                          <tr key={`cutoff-${a.id}`}>
                            <td colSpan={8} className="px-3 py-2">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 border-t-2 border-[#f5c542]/70" />
                                <span className="font-mono text-xs font-bold text-[#f5c542] tracking-widest">晉級線</span>
                                <div className="flex-1 border-t-2 border-[#f5c542]/70" />
                              </div>
                            </td>
                          </tr>
                        )}
                        <tr key={a.id} className="hover:bg-s2 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-sm">{a.rank}</td>
                          <td className="py-2.5 px-3 font-mono text-xs text-txt3">{a.bib}</td>
                          <td className="py-2.5 px-3 font-bold">{a.name}</td>
                          <td className="py-2.5 px-3">
                            <div className="flex gap-1 items-end">
                              {catBoulders.map((b, i) => {
                                const bs = a.boulderScores?.[i] || { boulder_id: b.id, top: 0, top_attempts: 0, zone: 0, zone_attempts: 0 };
                                return (
                                  <div key={b.id} className="flex flex-col items-center gap-1">
                                    <BoulderCard b={bs} />
                                    <span className="font-mono text-[8px] text-txt3">{i + 1}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-lime">{a.tops}T</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-cyan">{a.zones}Z</td>
                          <td className="py-2.5 px-3 font-mono text-xs text-txt3">{a.tAtt}</td>
                          <td className="py-2.5 px-3 font-mono font-bold" style={{ color: hasScore ? '#e8e8ec' : '#5a5a6a' }}>
                            {hasScore ? score.toFixed(1) : '—'}
                          </td>
                        </tr>
                      </>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Layout>
  );
}
