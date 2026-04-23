import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { eventsAPI } from '../api';
import { useToast } from '../components/Toast';

const ROUND_KEYS = ['qual', 'semi', 'final'];
const ROUND_NAMES = { qual: '資格賽', semi: '半決賽', final: '決賽' };

const COLOR_OPTIONS = [
  { value: '#c8f135', label: '萊姆' },
  { value: '#38e8d5', label: '青' },
  { value: '#f03a5f', label: '紅' },
  { value: '#a78bfa', label: '紫' },
  { value: '#f5c542', label: '金' },
  { value: '#f472b6', label: '粉' },
];

export default function Setup() {
  const { id } = useParams();
  const toast = useToast();
  const [event, setEvent] = useState(null);
  const [activeRound, setActiveRound] = useState('qual');
  const [bouldersByRound, setBouldersByRound] = useState({});
  const [categories, setCategories] = useState([]);
  const [newCat, setNewCat] = useState({ name: '', color: '#c8f135' });
  const [resizing, setResizing] = useState(false);

  const loadBoulders = async (round) => {
    const res = await eventsAPI.getBoulders(id, round);
    setBouldersByRound(prev => ({ ...prev, [round]: res.data }));
  };

  const load = async () => {
    const [ev, cl] = await Promise.all([eventsAPI.get(id), eventsAPI.getCategories(id)]);
    setEvent(ev.data);
    setCategories(cl.data);
    const rounds = ROUND_KEYS.slice(0, ev.data.rounds);
    await Promise.all(rounds.map(r => loadBoulders(r)));
  };

  useEffect(() => { load(); }, [id]);

  const handleBoulderLabelChange = (round, bId, newLabel) => {
    setBouldersByRound(prev => ({
      ...prev,
      [round]: prev[round].map(b => b.id === bId ? { ...b, label: newLabel } : b),
    }));
  };

  const saveBoulderLabel = async (b) => {
    try {
      await eventsAPI.updateBoulder(id, b.id, { label: b.label });
      toast('已儲存');
    } catch {
      toast('儲存失敗', 'error');
    }
  };

  const handleResize = async (round, newCount) => {
    setResizing(true);
    try {
      const res = await eventsAPI.resizeBoulders(id, round, newCount);
      setBouldersByRound(prev => ({ ...prev, [round]: res.data }));
      toast(`${ROUND_NAMES[round]}路線數已更新為 ${newCount} 題`);
    } catch (err) {
      toast(err.response?.data?.error || '更新失敗', 'error');
    } finally {
      setResizing(false);
    }
  };

  const handleAddCat = async (e) => {
    e.preventDefault();
    if (!newCat.name.trim()) return toast('請輸入組別名稱', 'error');
    try {
      await eventsAPI.createCategory(id, newCat);
      setNewCat({ name: '', color: '#c8f135' });
      const res = await eventsAPI.getCategories(id);
      setCategories(res.data);
      toast('組別已新增');
    } catch (err) {
      toast(err.response?.data?.error || '新增失敗', 'error');
    }
  };

  const handleSaveCatQuota = async (cat) => {
    try {
      await eventsAPI.updateCategory(id, cat.id, { semi_quota: cat.semi_quota || 0, final_quota: cat.final_quota || 0 });
      toast('晉級人數已儲存');
    } catch {
      toast('儲存失敗', 'error');
    }
  };

  const handleCatQuotaChange = (catId, field, value) => {
    setCategories(prev => prev.map(c => c.id === catId ? { ...c, [field]: Math.max(0, +value || 0) } : c));
  };

  const handleDeleteCat = async (catId) => {
    if (!confirm('刪除此組別？該組選手的組別將被清除。')) return;
    try {
      await eventsAPI.deleteCategory(id, catId);
      const res = await eventsAPI.getCategories(id);
      setCategories(res.data);
      toast('組別已刪除');
    } catch {
      toast('刪除失敗', 'error');
    }
  };

  if (!event) return <Layout><div className="text-txt3 font-mono py-16 text-center">載入中...</div></Layout>;

  const rounds = ROUND_KEYS.slice(0, event.rounds);
  const boulders = bouldersByRound[activeRound] || [];

  return (
    <Layout>
      <div className="flex items-center gap-2 mb-6 text-txt3 font-mono text-xs">
        <Link to="/events" className="hover:text-txt transition-colors">比賽列表</Link>
        <span>/</span>
        <Link to={`/events/${id}`} className="hover:text-txt transition-colors">{event.name}</Link>
        <span>/</span>
        <span className="text-txt">賽事設定</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 路線設定（per round） */}
        <div className="bg-s1 border border-border rounded-lg p-6">
          <div className="font-condensed font-bold text-sm tracking-widest uppercase text-lime mb-4">路線設定</div>

          {/* Round tabs */}
          <div className="flex gap-1 mb-5 bg-s2 p-1 rounded">
            {rounds.map(r => (
              <button
                key={r}
                onClick={() => setActiveRound(r)}
                className={`flex-1 py-1.5 font-condensed font-bold text-xs tracking-widest uppercase rounded transition-colors ${
                  activeRound === r ? 'bg-s1 text-lime' : 'text-txt3 hover:text-txt2'
                }`}
              >
                {ROUND_NAMES[r]}
              </button>
            ))}
          </div>

          {/* Boulder count control */}
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border">
            <span className="font-mono text-[10px] tracking-widest uppercase text-txt3 whitespace-nowrap">路線數</span>
            <div className="flex items-center gap-2">
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <button
                  key={n}
                  disabled={resizing}
                  onClick={() => boulders.length !== n && handleResize(activeRound, n)}
                  className={`w-7 h-7 rounded font-mono font-bold text-xs transition-colors disabled:opacity-50 ${
                    boulders.length === n
                      ? 'bg-lime text-bg'
                      : 'bg-s3 text-txt3 hover:bg-border2 hover:text-txt'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Boulder labels */}
          <div className="space-y-3">
            {boulders.map((b, i) => (
              <div key={b.id} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-s3 flex items-center justify-center font-mono font-bold text-xs text-txt3 flex-shrink-0">
                  {i + 1}
                </div>
                <input
                  type="text"
                  value={b.label}
                  onChange={e => handleBoulderLabelChange(activeRound, b.id, e.target.value)}
                  onBlur={() => saveBoulderLabel(b)}
                  onKeyDown={e => e.key === 'Enter' && saveBoulderLabel(b)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* 組別設定 */}
        <div className="bg-s1 border border-border rounded-lg p-6">
          <div className="font-condensed font-bold text-sm tracking-widest uppercase text-lime mb-4">組別設定</div>
          <div className="divide-y divide-border mb-4">
            {categories.length === 0 && <div className="text-txt3 font-mono text-xs py-2">尚無組別</div>}
            {categories.map(c => (
              <div key={c.id} className="py-3">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
                  <span className="flex-1 text-txt font-bold">{c.name}</span>
                  <button
                    onClick={() => handleDeleteCat(c.id)}
                    className="border border-red/30 text-red font-condensed font-bold text-[10px] tracking-widest uppercase px-2.5 py-1 rounded hover:bg-red hover:text-white transition-colors"
                  >
                    移除
                  </button>
                </div>
                {event.rounds >= 2 && (
                  <div className="ml-6 flex gap-3 flex-wrap items-center">
                    {event.rounds >= 2 && (
                      <div>
                        <label className="block font-mono text-[9px] tracking-widest uppercase text-txt3 mb-1">晉複賽人數</label>
                        <input
                          type="number" min={0} className="w-20 text-sm py-1.5"
                          value={c.semi_quota || 0}
                          onChange={e => handleCatQuotaChange(c.id, 'semi_quota', e.target.value)}
                        />
                      </div>
                    )}
                    {event.rounds >= 3 && (
                      <div>
                        <label className="block font-mono text-[9px] tracking-widest uppercase text-txt3 mb-1">晉決賽人數</label>
                        <input
                          type="number" min={0} className="w-20 text-sm py-1.5"
                          value={c.final_quota || 0}
                          onChange={e => handleCatQuotaChange(c.id, 'final_quota', e.target.value)}
                        />
                      </div>
                    )}
                    <button
                      onClick={() => handleSaveCatQuota(c)}
                      className="mt-4 border border-border2 text-txt2 font-condensed font-bold text-xs tracking-widest uppercase px-3 py-1.5 rounded hover:border-lime hover:text-lime transition-colors"
                    >
                      儲存
                    </button>
                    <div className="font-mono text-[9px] text-txt3 mt-4">0 = 不限制</div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <form onSubmit={handleAddCat} className="flex gap-2 flex-wrap">
            <input
              type="text"
              placeholder="新組別名稱"
              value={newCat.name}
              onChange={e => setNewCat(p => ({ ...p, name: e.target.value }))}
              className="flex-1 min-w-28"
            />
            <select value={newCat.color} onChange={e => setNewCat(p => ({ ...p, color: e.target.value }))} className="w-24">
              {COLOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button type="submit" className="bg-lime text-bg font-condensed font-bold text-xs tracking-widest uppercase px-4 py-2 rounded hover:bg-[#b5de25] transition-colors whitespace-nowrap">
              + 新增
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
