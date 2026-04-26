import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { eventsAPI } from '../api';
import { useToast } from '../components/Toast';

const ROUND_NAMES = { qual: '資格賽', semi: '複賽', final: '決賽' };
const getRounds = (n) => n === 2 ? ['qual', 'final'] : ['qual', 'semi', 'final'].slice(0, n);
const TYPE_NAMES = { startorder: '出場序', results: '成績' };

export default function Export() {
  const { id, catId } = useParams();
  const toast = useToast();
  const [event, setEvent] = useState(null);
  const [category, setCategory] = useState(null);
  const [round, setRound] = useState('qual');
  const [type, setType] = useState('startorder');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([eventsAPI.get(id), eventsAPI.getCategories(id)]).then(([ev, cl]) => {
      setEvent(ev.data);
      const found = cl.data.find(c => String(c.id) === String(catId));
      setCategory(found || null);
      if (found) setRound(getRounds(found.rounds)[0]);
    });
  }, [id, catId]);

  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await eventsAPI.exportCSV(id, round, catId, type);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${TYPE_NAMES[type]}_${category?.name}_${ROUND_NAMES[round]}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast('CSV 已匯出');
    } catch {
      toast('匯出失敗', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!event || !category) return <Layout><div className="text-txt3 font-mono py-16 text-center">載入中...</div></Layout>;

  const rounds = getRounds(category.rounds);

  return (
    <Layout>
      <div className="flex items-center gap-2 mb-6 text-txt3 font-mono text-xs">
        <Link to="/events" className="hover:text-txt transition-colors">比賽列表</Link>
        <span>/</span>
        <Link to={`/events/${id}`} className="hover:text-txt transition-colors">{event.name}</Link>
        <span>/</span>
        <Link to={`/events/${id}/categories/${catId}`} className="hover:text-txt transition-colors">{category.name}</Link>
        <span>/</span>
        <span className="text-txt">匯出</span>
      </div>

      <div className="bg-s1 border border-border rounded-lg p-8 max-w-md">
        <div className="font-condensed font-bold text-sm tracking-widest uppercase text-lime mb-6">匯出 CSV</div>

        <div className="mb-5">
          <label className="block font-mono text-[10px] tracking-widest uppercase text-txt3 mb-1.5">類型</label>
          <select value={type} onChange={e => setType(e.target.value)}>
            <option value="startorder">出場序</option>
            <option value="results">成績</option>
          </select>
        </div>

        <div className="mb-5">
          <label className="block font-mono text-[10px] tracking-widest uppercase text-txt3 mb-1.5">輪次</label>
          <select value={round} onChange={e => setRound(e.target.value)}>
            {rounds.map(r => <option key={r} value={r}>{ROUND_NAMES[r]}</option>)}
          </select>
        </div>

        <p className="text-txt3 font-mono text-xs mb-5">
          {type === 'startorder'
            ? '出場序：依出場順序排列，成績欄位留空。'
            : '成績：依排名排列，含完整成績與晉級標記。'
          }
          <br />
          檔案格式：UTF-8 with BOM，可直接用 Excel 開啟中文不亂碼。
        </p>

        <button
          onClick={handleExport}
          disabled={loading}
          className="border border-cyan/30 text-cyan font-condensed font-bold text-xs tracking-widest uppercase px-6 py-3 rounded hover:bg-cyan hover:text-bg transition-colors disabled:opacity-50"
        >
          {loading ? '匯出中...' : '↓ 下載 CSV'}
        </button>
      </div>
    </Layout>
  );
}
