import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { eventsAPI } from '../api';

const ROUND_KEYS = ['qual', 'semi', 'final'];
const ROUND_NAMES = { qual: '資格賽', semi: '半決賽', final: '決賽' };

function MedalBadge({ rank }) {
  const cls = rank === 1
    ? 'bg-gold text-bg'
    : rank === 2
    ? 'bg-silver text-bg'
    : rank === 3
    ? 'bg-bronze text-white'
    : 'bg-s3 text-txt3';
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-mono font-bold text-xs flex-shrink-0 ${cls}`}>
      {rank}
    </div>
  );
}

export default function Ranking() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [ranking, setRanking] = useState(null);
  const [round, setRound] = useState('qual');
  const [catFilter, setCatFilter] = useState('all');
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([eventsAPI.get(id), eventsAPI.getCategories(id)]).then(([ev, cl]) => {
      setEvent(ev.data);
      setCategories(cl.data);
    });
  }, [id]);

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

  const rounds = event ? ROUND_KEYS.slice(0, event.rounds) : ['qual'];

  const filteredAthletes = ranking?.athletes.filter(a =>
    catFilter === 'all' || String(a.category_id) === catFilter
  ) || [];

  const quotas = ranking?.quotas || {};

  const byCategory = {};
  filteredAthletes.forEach(a => {
    const key = a.category_id || 'none';
    if (!byCategory[key]) byCategory[key] = [];
    byCategory[key].push(a);
  });

  if (!event) return <Layout><div className="text-txt3 font-mono py-16 text-center">載入中...</div></Layout>;

  return (
    <Layout>
      <div className="flex items-center gap-2 mb-6 text-txt3 font-mono text-xs">
        <Link to="/events" className="hover:text-txt transition-colors">比賽列表</Link>
        <span>/</span>
        <Link to={`/events/${id}`} className="hover:text-txt transition-colors">{event.name}</Link>
        <span>/</span>
        <span className="text-txt">即時排名</span>
      </div>

      {/* Stats */}
      {ranking && (
        <div className="flex gap-3 mb-5 flex-wrap">
          {[
            { v: ranking.total, l: '總選手' },
            { v: ranking.scored, l: '已計分' },
            { v: categories.length, l: '組別' },
            { v: ranking.boulders?.length || 0, l: '問題數' },
          ].map(s => (
            <div key={s.l} className="bg-s1 border border-border rounded-md px-4 py-3">
              <div className="font-condensed font-black text-3xl text-lime leading-none">{s.v}</div>
              <div className="font-mono text-[10px] tracking-widest text-txt3 mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-end mb-5">
        <div className="min-w-32">
          <label className="block font-mono text-[10px] tracking-widest uppercase text-txt3 mb-1.5">組別</label>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="all">全部組別</option>
            {categories.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
          </select>
        </div>
        <div className="min-w-32">
          <label className="block font-mono text-[10px] tracking-widest uppercase text-txt3 mb-1.5">輪次</label>
          <select value={round} onChange={e => setRound(e.target.value)}>
            {rounds.map(r => <option key={r} value={r}>{ROUND_NAMES[r]}</option>)}
          </select>
        </div>
        <button
          onClick={loadRanking}
          className="border border-border2 text-txt2 font-condensed font-bold text-xs tracking-widest uppercase px-4 py-[9px] rounded hover:border-txt2 hover:text-txt transition-colors"
        >
          ↻ 刷新
        </button>
      </div>

      {loading ? (
        <div className="text-txt3 font-mono text-center py-12">計算中...</div>
      ) : Object.keys(byCategory).length === 0 ? (
        <div className="text-txt3 font-mono text-center py-12">暫無排名資料</div>
      ) : (
        <div className="space-y-5">
          {Object.entries(byCategory).map(([catId, list]) => {
            const cat = categories.find(c => String(c.id) === catId);
            const numBoulders = ranking?.boulders?.length || 1;
            const catQuota = quotas[catId] || 0;
            return (
              <div key={catId} className="bg-s1 border border-border rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4 font-condensed font-black text-xl tracking-widest uppercase">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cat?.color || '#fff' }} />
                  <span>{cat?.name || '未分組'}</span>
                  <span className="text-xs text-txt3 font-mono font-normal">{list.length} 人</span>
                  {catQuota > 0 && <span className="text-xs text-lime/60 font-mono font-normal ml-auto">晉級 {catQuota} 人</span>}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr>
                        {['名次', '號碼', '姓名', 'TOP', 'ZONE', 'TOP次數', 'ZONE次數', '完成率'].map(h => (
                          <th key={h} className="font-mono text-[9px] tracking-widest uppercase text-txt3 py-2 px-3 text-left border-b border-border whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((a, rowIdx) => {
                        const pct = Math.round(a.tops / numBoulders * 100);
                        const showCutoff = catQuota > 0 && rowIdx === catQuota;
                        return (
                          <>
                          {showCutoff && (
                            <tr key={`cutoff-${a.id}`}>
                              <td colSpan={8} className="px-3 py-1">
                                <div className="relative">
                                  <div className="border-t border-dashed border-lime/30" />
                                  <span className="absolute left-0 -top-2.5 font-mono text-[9px] text-lime/50 tracking-widest bg-s1 pr-2">
                                    ▼ 晉級線
                                  </span>
                                </div>
                              </td>
                            </tr>
                          )}
                          <tr key={a.id} className="hover:bg-s2 transition-colors">
                            <td className="py-2.5 px-3"><MedalBadge rank={a.rank} /></td>
                            <td className="py-2.5 px-3 font-mono text-xs text-txt3">{a.bib}</td>
                            <td className="py-2.5 px-3 font-bold">{a.name}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-lime">{a.tops}T</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-cyan">{a.zones}Z</td>
                            <td className="py-2.5 px-3 font-mono text-xs text-txt3">{a.tAtt}</td>
                            <td className="py-2.5 px-3 font-mono text-xs text-txt3">{a.zAtt}</td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <div className="w-16 bg-s3 h-1 rounded-full">
                                  <div className="bg-lime h-1 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="font-mono text-[11px] text-txt3">{pct}%</span>
                              </div>
                            </td>
                          </tr>
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
