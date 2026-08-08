import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { eventsAPI } from '../api';
import { useToast } from '../components/Toast';

const ROUND_NAMES = { qual: '資格賽', semi: '複賽', final: '決賽' };
const getRounds = (n) => n === 2 ? ['qual', 'final'] : ['qual', 'semi', 'final'].slice(0, n);

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso.replace(' ', 'T') + 'Z').toLocaleString('zh-TW', { hour12: false });
}

export default function Settlement() {
  const { id, catId } = useParams();
  const toast = useToast();
  const [event, setEvent] = useState(null);
  const [category, setCategory] = useState(null);
  const [ranking, setRanking] = useState(null);
  const [round, setRound] = useState('qual');
  const [loading, setLoading] = useState(false);
  const [settlement, setSettlement] = useState({ settled: false, settledAt: null, settledBy: null });
  const [overrideDrafts, setOverrideDrafts] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([eventsAPI.get(id), eventsAPI.getCategories(id)]).then(([ev, cl]) => {
      setEvent(ev.data);
      const found = cl.data.find(c => String(c.id) === String(catId));
      setCategory(found || null);
      if (found) setRound(getRounds(found.rounds)[0]);
    });
  }, [id, catId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rankRes, settleRes] = await Promise.all([
        eventsAPI.getRanking(id, round),
        eventsAPI.getSettlement(id, catId, round),
      ]);
      setRanking(rankRes.data);
      setSettlement(settleRes.data);
      setOverrideDrafts({});
    } finally {
      setLoading(false);
    }
  }, [id, catId, round]);

  useEffect(() => { loadAll(); }, [loadAll]);

  if (!event || !category) return <Layout><div className="text-txt3 font-mono py-16 text-center">載入中...</div></Layout>;

  const athletes = (ranking?.athletes || []).filter(a => String(a.category_id) === String(catId));
  const availableRounds = getRounds(category.rounds);
  const locked = settlement.settled;
  const quota = (ranking?.quotas || {})[catId] || 0;
  const advancingIds = new Set(ranking?.advancingIds || []);
  const guaranteedIds = new Set(ranking?.guaranteedIds || []);
  const cutoffRank = quota > 0 && athletes.length >= quota ? athletes[quota - 1].rank : null;

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await eventsAPI.confirmSettlement(id, catId, round);
      toast('本輪已標記為結算 ✓');
      await loadAll();
    } catch {
      toast('結算失敗', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleReopen = async () => {
    setBusy(true);
    try {
      await eventsAPI.reopenSettlement(id, catId, round);
      toast('已取消結算，可重新編輯');
      await loadAll();
    } catch {
      toast('操作失敗', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleOverrideSave = async (athleteId, raw) => {
    const rank = raw === '' || raw == null ? null : parseInt(raw);
    try {
      await eventsAPI.overrideRank(id, round, { athlete_id: athleteId, rank });
      toast('名次已更新 ✓');
      await loadAll();
    } catch {
      toast('更新失敗', 'error');
    }
  };

  const handleGuaranteeToggle = async (athleteId, guaranteed) => {
    try {
      await eventsAPI.guaranteeAdvancement(id, round, { athlete_id: athleteId, guaranteed });
      toast(guaranteed ? '已設定保障晉級 ✓' : '已取消保障晉級');
      await loadAll();
    } catch {
      toast('更新失敗', 'error');
    }
  };

  return (
    <Layout>
      <div className="flex items-center gap-2 mb-6 text-txt3 font-mono text-xs">
        <Link to="/events" className="hover:text-txt transition-colors">比賽列表</Link>
        <span>/</span>
        <Link to={`/events/${id}`} className="hover:text-txt transition-colors">{event.name}</Link>
        <span>/</span>
        <Link to={`/events/${id}/categories/${catId}`} className="hover:text-txt transition-colors">{category.name}</Link>
        <span>/</span>
        <span className="text-txt">輪次結算</span>
      </div>

      <div className={`mb-6 border rounded-lg px-5 py-3 flex items-center justify-between gap-3 flex-wrap ${locked ? 'bg-lime/5 border-lime/30' : 'bg-s1 border-border'}`}>
        <div>
          <div className={`font-condensed font-bold text-sm tracking-wide ${locked ? 'text-lime' : 'text-txt2'}`}>
            {locked ? `本輪已結算` : '本輪尚未結算'}
          </div>
          {locked && (
            <div className="font-mono text-xs text-txt3 mt-0.5">
              {settlement.settledBy} · {formatTime(settlement.settledAt)}
            </div>
          )}
        </div>
        {locked ? (
          <button onClick={handleReopen} disabled={busy} className="border border-red/40 text-red font-condensed font-bold text-xs tracking-widest uppercase px-4 py-2 rounded hover:bg-red/10 transition-colors disabled:opacity-40">
            取消結算
          </button>
        ) : (
          <button onClick={handleConfirm} disabled={busy} className="bg-lime text-bg font-condensed font-bold text-xs tracking-widest uppercase px-4 py-2 rounded hover:bg-[#b5de25] transition-colors disabled:opacity-40">
            確認結算
          </button>
        )}
      </div>

      <div className="flex gap-3 flex-wrap items-end mb-5">
        <div className="min-w-32">
          <label className="block font-mono text-[10px] tracking-widest uppercase text-txt3 mb-1.5">輪次</label>
          <select value={round} onChange={e => setRound(e.target.value)}>
            {availableRounds.map(r => <option key={r} value={r}>{ROUND_NAMES[r]}</option>)}
          </select>
        </div>
        <button onClick={loadAll}
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  {[...(quota > 0 ? ['晉級'] : []), '名次', '號碼', '姓名', 'TOP', 'ZONE', '分數', '覆蓋名次', ...(quota > 0 ? ['保障晉級'] : [])].map(h => (
                    <th key={h} className="font-mono text-[9px] tracking-widest uppercase text-txt3 py-2 px-3 text-left border-b border-border whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {athletes.map(a => {
                  const isDns = !!a.is_dns;
                  const draft = overrideDrafts[a.id] ?? '';
                  const isAdvancing = advancingIds.has(a.id);
                  const isGuaranteed = guaranteedIds.has(a.id);
                  const naturallyQualifies = !isDns && cutoffRank !== null && a.rank <= cutoffRank;
                  let advanceLabel = '';
                  if (isDns) advanceLabel = 'DNS';
                  else if (isAdvancing && !naturallyQualifies) advanceLabel = '⚑保障';
                  else if (isAdvancing) advanceLabel = '✓';

                  return (
                    <tr key={a.id} className="hover:bg-s2 transition-colors">
                      {quota > 0 && (
                        <td className={`py-2.5 px-3 font-mono font-bold text-xs ${advanceLabel === '⚑保障' ? 'text-[#f5c542]' : advanceLabel === '✓' ? 'text-lime' : 'text-txt3'}`}>
                          {advanceLabel}
                        </td>
                      )}
                      <td className="py-2.5 px-3 font-mono font-bold text-sm">{isDns ? 'DNS' : a.rank}</td>
                      <td className="py-2.5 px-3 font-mono text-xs text-txt3">{a.bib}</td>
                      <td className="py-2.5 px-3 font-bold">{a.name}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-lime">{isDns ? '—' : `${a.tops}T`}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-cyan">{isDns ? '—' : `${a.zones}Z`}</td>
                      <td className="py-2.5 px-3 font-mono font-bold">{isDns ? '—' : a.score.toFixed(1)}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number" min={1} placeholder={String(a.rank)}
                            className="w-16 text-center font-mono text-xs py-1"
                            value={draft}
                            disabled={locked}
                            onChange={e => setOverrideDrafts(prev => ({ ...prev, [a.id]: e.target.value }))}
                          />
                          <button
                            onClick={() => handleOverrideSave(a.id, draft)}
                            disabled={locked || draft === ''}
                            className="font-mono text-[10px] uppercase text-lime border border-lime/40 rounded px-2 py-1 hover:bg-lime/10 transition-colors disabled:opacity-30"
                          >
                            套用
                          </button>
                          <button
                            onClick={() => handleOverrideSave(a.id, null)}
                            disabled={locked}
                            className="font-mono text-[10px] uppercase text-txt3 border border-border2 rounded px-2 py-1 hover:border-txt2 transition-colors disabled:opacity-30"
                          >
                            清除
                          </button>
                        </div>
                      </td>
                      {quota > 0 && (
                        <td className="py-2.5 px-3">
                          <button
                            onClick={() => handleGuaranteeToggle(a.id, !isGuaranteed)}
                            disabled={locked || isDns}
                            className={`font-mono text-[10px] uppercase rounded px-3 py-1.5 transition-colors disabled:opacity-30 ${
                              isGuaranteed
                                ? 'bg-[#f5c542]/15 text-[#f5c542] border border-[#f5c542]/50 hover:bg-[#f5c542]/25'
                                : 'text-txt2 border border-border2 hover:border-[#f5c542] hover:text-[#f5c542]'
                            }`}
                          >
                            {isGuaranteed ? '取消保障' : '設為保障'}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Layout>
  );
}
