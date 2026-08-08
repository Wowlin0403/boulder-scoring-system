import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { eventsAPI } from '../api';

const ROUND_NAMES = { qual: '資格賽', semi: '複賽', final: '決賽' };
const getRounds = (n) => n === 2 ? ['qual', 'final'] : ['qual', 'semi', 'final'].slice(0, n);

function formatAction(log) {
  const parts = [];
  if (log.top) parts.push(`TOP ${log.top_attempts || 1}次`);
  if (log.zone) parts.push(`ZONE ${log.zone_attempts || 1}次`);
  if (!log.top && !log.zone) parts.push('清除成績');
  return parts.join('、');
}

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso.replace(' ', 'T') + 'Z').toLocaleString('zh-TW', { hour12: false });
}

export default function Logs() {
  const { id, catId } = useParams();
  const [event, setEvent] = useState(null);
  const [category, setCategory] = useState(null);
  const [round, setRound] = useState('');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([eventsAPI.get(id), eventsAPI.getCategories(id)]).then(([ev, cl]) => {
      setEvent(ev.data);
      setCategory(cl.data.find(c => String(c.id) === String(catId)) || null);
    });
  }, [id, catId]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await eventsAPI.getLogs(id, { category_id: catId, round: round || undefined });
      setLogs(res.data);
    } finally {
      setLoading(false);
    }
  }, [id, catId, round]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  if (!event || !category) return <Layout><div className="text-txt3 font-mono py-16 text-center">載入中...</div></Layout>;

  const availableRounds = getRounds(category.rounds);

  return (
    <Layout>
      <div className="flex items-center gap-2 mb-6 text-txt3 font-mono text-xs">
        <Link to="/events" className="hover:text-txt transition-colors">比賽列表</Link>
        <span>/</span>
        <Link to={`/events/${id}`} className="hover:text-txt transition-colors">{event.name}</Link>
        <span>/</span>
        <Link to={`/events/${id}/categories/${catId}`} className="hover:text-txt transition-colors">{category.name}</Link>
        <span>/</span>
        <span className="text-txt">操作紀錄</span>
      </div>

      <div className="flex gap-3 flex-wrap items-end mb-5">
        <div className="min-w-32">
          <label className="block font-mono text-[10px] tracking-widest uppercase text-txt3 mb-1.5">輪次</label>
          <select value={round} onChange={e => setRound(e.target.value)}>
            <option value="">全部</option>
            {availableRounds.map(r => <option key={r} value={r}>{ROUND_NAMES[r]}</option>)}
          </select>
        </div>
        <button onClick={loadLogs}
          className="border border-border2 text-txt2 font-condensed font-bold text-xs tracking-widest uppercase px-4 py-[9px] rounded hover:border-txt2 hover:text-txt transition-colors">
          ↻ 刷新
        </button>
      </div>

      {loading ? (
        <div className="text-txt3 font-mono text-center py-12">載入中...</div>
      ) : logs.length === 0 ? (
        <div className="text-txt3 font-mono text-center py-12">尚無操作紀錄</div>
      ) : (
        <div className="bg-s1 border border-border rounded-lg p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  {['時間', '操作者', '輪次', '號碼', '姓名', '路線', '動作'].map(h => (
                    <th key={h} className="font-mono text-[9px] tracking-widest uppercase text-txt3 py-2 px-3 text-left border-b border-border whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-s2 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-xs text-txt3 whitespace-nowrap">{formatTime(log.changed_at)}</td>
                    <td className="py-2.5 px-3 font-mono text-xs">{log.changed_by_name || '—'}</td>
                    <td className="py-2.5 px-3 font-mono text-xs text-txt3">{ROUND_NAMES[log.round] || log.round}</td>
                    <td className="py-2.5 px-3 font-mono text-xs text-txt3">{log.bib}</td>
                    <td className="py-2.5 px-3 font-bold">{log.athlete_name}</td>
                    <td className="py-2.5 px-3 font-mono text-xs">{log.boulder_label}</td>
                    <td className="py-2.5 px-3 font-mono text-xs">{formatAction(log)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Layout>
  );
}
