import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { eventsAPI } from '../api';
import { useToast } from '../components/Toast';

const ROUND_NAMES = { qual: '資格賽', semi: '複賽', final: '決賽' };
const getRounds = (n) => n === 2 ? ['qual', 'final'] : ['qual', 'semi', 'final'].slice(0, n);

const ROUNDS_OPTIONS = [
  { n: 1, label: '資格賽' },
  { n: 2, label: '資格賽 + 決賽' },
  { n: 3, label: '資格賽 + 複賽 + 決賽' },
];

export default function Setup() {
  const { id, catId } = useParams();
  const toast = useToast();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [cat, setCat] = useState(null);
  const [catRounds, setCatRounds] = useState(1);
  const [activeRound, setActiveRound] = useState('qual');
  const [bouldersByRound, setBouldersByRound] = useState({});
  const [localQuota, setLocalQuota] = useState({ semi_quota: 0, final_quota: 0 });
  const [resizing, setResizing] = useState(false);

  const roundList = getRounds(catRounds);

  useEffect(() => {
    Promise.all([eventsAPI.get(id), eventsAPI.getCategories(id)]).then(([ev, cl]) => {
      setEvent(ev.data);
      const found = cl.data.find(c => String(c.id) === String(catId));
      if (!found) return;
      setCat(found);
      setCatRounds(found.rounds || 1);
      setLocalQuota({ semi_quota: found.semi_quota || 0, final_quota: found.final_quota || 0 });
    });
  }, [id, catId]);

  const loadBoulders = async (round) => {
    try {
      const res = await eventsAPI.getBoulders(id, round, catId);
      setBouldersByRound(prev => ({ ...prev, [round]: res.data }));
    } catch {}
  };

  useEffect(() => {
    if (!catId) return;
    const rounds = getRounds(catRounds);
    rounds.forEach(r => loadBoulders(r));
    if (!rounds.includes(activeRound)) setActiveRound(rounds[0] || 'qual');
  }, [catRounds, catId, id]);

  const handleRoundsChange = async (n) => {
    if (n === catRounds) return;
    try {
      const res = await eventsAPI.updateCategory(id, catId, { rounds: n });
      setCatRounds(res.data.rounds);
      setCat(res.data);
      toast('賽制已更新');
    } catch {
      toast('更新失敗', 'error');
    }
  };

  const handleResize = async (round, count) => {
    const boulders = bouldersByRound[round] || [];
    if (boulders.length === count) return;
    setResizing(true);
    try {
      const res = await eventsAPI.resizeBoulders(id, round, count, catId);
      setBouldersByRound(prev => ({ ...prev, [round]: res.data }));
      toast(`${ROUND_NAMES[round]} 路線數更新為 ${count} 題`);
    } catch (err) {
      toast(err.response?.data?.error || '更新失敗', 'error');
    } finally {
      setResizing(false);
    }
  };

  const handleLabelChange = (round, bId, label) => {
    setBouldersByRound(prev => ({
      ...prev,
      [round]: prev[round].map(b => b.id === bId ? { ...b, label } : b),
    }));
  };

  const handleSaveLabel = async (b) => {
    try {
      await eventsAPI.updateBoulder(id, b.id, { label: b.label });
      toast('已儲存');
    } catch {
      toast('儲存失敗', 'error');
    }
  };

  const handleSaveQuota = async () => {
    try {
      await eventsAPI.updateCategory(id, catId, localQuota);
      toast('晉級人數已儲存');
    } catch {
      toast('儲存失敗', 'error');
    }
  };

  const handleDelete = async () => {
    if (!confirm(`刪除「${cat.name}」？該組選手的組別將被清除，路線與成績也將一併刪除。`)) return;
    try {
      await eventsAPI.deleteCategory(id, catId);
      toast('組別已刪除');
      navigate(`/events/${id}`);
    } catch {
      toast('刪除失敗', 'error');
    }
  };

  if (!event || !cat) return <Layout><div className="text-txt3 font-mono py-16 text-center">載入中...</div></Layout>;

  const boulders = bouldersByRound[activeRound] || [];

  return (
    <Layout>
      <div className="flex items-center gap-2 mb-6 text-txt3 font-mono text-xs">
        <Link to="/events" className="hover:text-txt transition-colors">比賽列表</Link>
        <span>/</span>
        <Link to={`/events/${id}`} className="hover:text-txt transition-colors">{event.name}</Link>
        <span>/</span>
        <Link to={`/events/${id}/categories/${catId}`} className="hover:text-txt transition-colors">{cat.name}</Link>
        <span>/</span>
        <span className="text-txt">組別設定</span>
      </div>

      <div className="bg-s1 border border-border rounded-lg p-6">
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cat.color }} />
          <span className="flex-1 font-condensed font-bold text-lg tracking-widest uppercase">{cat.name}</span>
          <button
            onClick={handleDelete}
            className="border border-red/30 text-red font-condensed font-bold text-[10px] tracking-widest uppercase px-2.5 py-1 rounded hover:bg-red hover:text-white transition-colors"
          >
            刪除組別
          </button>
        </div>

        {/* Rounds selector */}
        <div className="mb-5">
          <div className="font-mono text-[10px] tracking-widest uppercase text-txt3 mb-2">賽制</div>
          <div className="flex gap-1.5 flex-wrap">
            {ROUNDS_OPTIONS.map(({ n, label }) => (
              <button
                key={n}
                onClick={() => handleRoundsChange(n)}
                className={`px-3 py-1.5 font-condensed font-bold text-xs tracking-widest uppercase rounded transition-colors ${
                  catRounds === n
                    ? 'bg-lime text-bg'
                    : 'bg-s3 text-txt3 hover:text-txt border border-border'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Round tabs + boulders */}
        <div className="mb-5">
          <div className="font-mono text-[10px] tracking-widest uppercase text-txt3 mb-2">路線設定</div>

          {roundList.length > 1 && (
            <div className="flex gap-1 mb-4 bg-s2 p-1 rounded">
              {roundList.map(r => (
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
          )}

          <div className="flex items-center gap-2 mb-4 pb-4 border-b border-border">
            <span className="font-mono text-[10px] tracking-widest uppercase text-txt3 whitespace-nowrap">路線數</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                <button
                  key={n}
                  disabled={resizing}
                  onClick={() => handleResize(activeRound, n)}
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

          <div className="space-y-2.5">
            {boulders.map((b, i) => (
              <div key={b.id} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-s3 flex items-center justify-center font-mono font-bold text-xs text-txt3 flex-shrink-0">
                  {i + 1}
                </div>
                <input
                  type="text"
                  value={b.label}
                  onChange={e => handleLabelChange(activeRound, b.id, e.target.value)}
                  onBlur={() => handleSaveLabel(b)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveLabel(b)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Quotas */}
        {catRounds >= 2 && (
          <div className="pt-4 border-t border-border">
            <div className="font-mono text-[10px] tracking-widest uppercase text-txt3 mb-2">晉級人數</div>
            <div className="flex gap-3 flex-wrap items-end">
              {roundList.includes('semi') && (
                <div>
                  <label className="block font-mono text-[9px] tracking-widest uppercase text-txt3 mb-1">晉複賽</label>
                  <input
                    type="number" min={0} className="w-20 text-sm py-1.5"
                    value={localQuota.semi_quota}
                    onChange={e => setLocalQuota(p => ({ ...p, semi_quota: Math.max(0, +e.target.value || 0) }))}
                  />
                </div>
              )}
              {roundList.includes('final') && (
                <div>
                  <label className="block font-mono text-[9px] tracking-widest uppercase text-txt3 mb-1">晉決賽</label>
                  <input
                    type="number" min={0} className="w-20 text-sm py-1.5"
                    value={localQuota.final_quota}
                    onChange={e => setLocalQuota(p => ({ ...p, final_quota: Math.max(0, +e.target.value || 0) }))}
                  />
                </div>
              )}
              <button
                onClick={handleSaveQuota}
                className="mt-4 border border-border2 text-txt2 font-condensed font-bold text-xs tracking-widest uppercase px-3 py-1.5 rounded hover:border-lime hover:text-lime transition-colors"
              >
                儲存
              </button>
              <div className="font-mono text-[9px] text-txt3 mt-4">0 = 不限制</div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
