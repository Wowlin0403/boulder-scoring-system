import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { eventsAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

function isEventLocked(event) {
  if (!event) return false;
  if (event.locked === 1) return true;
  if (event.locked === 0) return false;
  if (!event.date) return false;
  const lockDate = new Date(event.date);
  lockDate.setDate(lockDate.getDate() + 7);
  return new Date() > lockDate;
}

const COLOR_OPTIONS = [
  { value: '#c8f135', label: '萊姆' },
  { value: '#38e8d5', label: '青' },
  { value: '#f03a5f', label: '紅' },
  { value: '#a78bfa', label: '紫' },
  { value: '#f5c542', label: '金' },
  { value: '#f472b6', label: '粉' },
];

const ROUNDS_OPTIONS = [
  { n: 1, label: '資格賽' },
  { n: 2, label: '資格賽 + 決賽' },
  { n: 3, label: '資格賽 + 複賽 + 決賽' },
];

export default function EventDetail() {
  const { id } = useParams();
  const { isAdmin, isOrganizer, isSuperadmin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [categories, setCategories] = useState([]);
  const [newCat, setNewCat] = useState({ name: '', color: '#c8f135', rounds: 1 });

  const load = async () => {
    const [ev, cl] = await Promise.all([eventsAPI.get(id), eventsAPI.getCategories(id)]);
    setEvent(ev.data);
    setCategories(cl.data);
  };

  const handleLockToggle = async (locked) => {
    try {
      const res = await eventsAPI.lockEvent(id, locked);
      setEvent(res.data);
      toast(locked === 1 ? '比賽已手動鎖定' : locked === 0 ? '比賽已強制解鎖' : '已恢復自動鎖定');
    } catch {
      toast('操作失敗', 'error');
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleAddCat = async (e) => {
    e.preventDefault();
    if (!newCat.name.trim()) return toast('請輸入組別名稱', 'error');
    try {
      await eventsAPI.createCategory(id, newCat);
      setNewCat({ name: '', color: '#c8f135', rounds: 1 });
      const res = await eventsAPI.getCategories(id);
      setCategories(res.data);
      toast('組別已新增');
    } catch (err) {
      toast(err.response?.data?.error || '新增失敗', 'error');
    }
  };

  const handleDeleteCat = async (catId, catName) => {
    if (!confirm(`刪除「${catName}」？該組選手的組別將被清除，路線與成績也將一併刪除。`)) return;
    try {
      await eventsAPI.deleteCategory(id, catId);
      setCategories(prev => prev.filter(c => c.id !== catId));
      toast('組別已刪除');
    } catch {
      toast('刪除失敗', 'error');
    }
  };

  if (!event) return <Layout><div className="text-txt3 font-mono py-16 text-center">載入中...</div></Layout>;

  return (
    <Layout>
      <div className="flex items-center gap-2 mb-6 text-txt3 font-mono text-xs">
        <Link to="/events" className="hover:text-txt transition-colors">比賽列表</Link>
        <span>/</span>
        <span className="text-txt">{event.name}</span>
      </div>

      <div className="font-condensed font-black text-2xl tracking-widest uppercase text-lime mb-1">{event.name}</div>
      <div className="font-mono text-xs text-txt3 mb-3">{event.date}</div>

      {(() => {
        const locked = isEventLocked(event);
        const isManual = event.locked === 0 || event.locked === 1;
        return (
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <span className={`font-mono text-xs px-2.5 py-1 rounded border ${locked ? 'border-red/40 text-red bg-red/5' : 'border-lime/30 text-lime/70 bg-lime/5'}`}>
              {locked ? '🔒 已鎖定' : '🔓 開放中'}
              {event.locked === 1 && ' (手動)'}
              {event.locked === 0 && ' (強制解鎖)'}
            </span>
            {isSuperadmin && locked && (
              <button
                onClick={() => handleLockToggle(0)}
                className="font-mono text-xs px-3 py-1 rounded border border-lime/40 text-lime hover:bg-lime/10 transition-colors"
              >
                解除鎖定
              </button>
            )}
            {isSuperadmin && !locked && (
              <button
                onClick={() => handleLockToggle(1)}
                className="font-mono text-xs px-3 py-1 rounded border border-red/30 text-red hover:bg-red/10 transition-colors"
              >
                立即鎖定
              </button>
            )}
            {isSuperadmin && isManual && (
              <button
                onClick={() => handleLockToggle(null)}
                className="font-mono text-xs px-3 py-1 rounded border border-border2 text-txt3 hover:border-txt3 transition-colors"
              >
                恢復自動
              </button>
            )}
          </div>
        );
      })()}

      {isAdmin && (
        <div className="bg-s1 border border-border rounded-lg p-6 mb-6">
          <div className="font-condensed font-bold text-sm tracking-widest uppercase text-lime mb-4">新增組別</div>
          {categories.length >= 5 ? (
            <div className="font-mono text-xs text-txt3">已達上限（最多 5 個組別）</div>
          ) : (
          <form onSubmit={handleAddCat} className="flex gap-3 flex-wrap items-end">
            <div>
              <label className="block font-mono text-[9px] tracking-widest uppercase text-txt3 mb-1">名稱</label>
              <input
                type="text"
                placeholder="組別名稱"
                value={newCat.name}
                onChange={e => setNewCat(p => ({ ...p, name: e.target.value }))}
                className="min-w-36"
              />
            </div>
            <div>
              <label className="block font-mono text-[9px] tracking-widest uppercase text-txt3 mb-1">顏色</label>
              <select value={newCat.color} onChange={e => setNewCat(p => ({ ...p, color: e.target.value }))} className="w-24">
                {COLOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-mono text-[9px] tracking-widest uppercase text-txt3 mb-1">賽制</label>
              <select value={newCat.rounds} onChange={e => setNewCat(p => ({ ...p, rounds: +e.target.value }))} className="w-44">
                {ROUNDS_OPTIONS.map(o => <option key={o.n} value={o.n}>{o.label}</option>)}
              </select>
            </div>
            <button type="submit" className="bg-lime text-bg font-condensed font-bold text-xs tracking-widest uppercase px-4 py-2 rounded hover:bg-[#b5de25] transition-colors whitespace-nowrap">
              + 新增
            </button>
          </form>
          )}
        </div>
      )}

      <div className="font-condensed font-bold text-sm tracking-widest uppercase text-txt3 mb-3">選擇組別</div>

      <div className="space-y-3 mb-6">
        {categories.length === 0 && (
          <div className="text-txt3 font-mono text-center py-12 bg-s1 border border-border rounded-lg">
            尚無組別，{isAdmin ? '請在上方新增' : '請聯繫管理員新增組別'}
          </div>
        )}
        {categories.map(c => (
          <div
            key={c.id}
            className="bg-s1 border border-border rounded-lg p-5 flex items-center gap-4 hover:border-border2 transition-colors"
          >
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
            <div className="flex-1">
              <div className="font-condensed font-bold text-lg">{c.name}</div>
              <div className="font-mono text-xs text-txt3 mt-0.5">
                {c.rounds === 1 ? '資格賽' : c.rounds === 2 ? '資格賽 + 決賽' : '資格賽 + 複賽 + 決賽'}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => navigate(`/events/${id}/categories/${c.id}`)}
                className="border border-border2 text-txt2 font-condensed font-bold text-xs tracking-widest uppercase px-4 py-2 rounded hover:border-lime hover:text-lime transition-colors"
              >
                進入
              </button>
              {isAdmin && (
                <button
                  onClick={() => handleDeleteCat(c.id, c.name)}
                  className="border border-red/30 text-red font-condensed font-bold text-xs tracking-widest uppercase px-3 py-2 rounded hover:bg-red hover:text-white transition-colors"
                >
                  刪除
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {(isOrganizer || isSuperadmin) && (
        <Link to={`/events/${id}/judge-account`}
          className="flex items-center justify-between bg-s1 border border-border rounded-lg p-5 hover:border-cyan/50 transition-colors group">
          <div>
            <div className="font-condensed font-bold text-sm tracking-widest uppercase text-cyan">裁判帳號管理</div>
            <div className="font-mono text-xs text-txt3 mt-0.5">設定裁判登入密碼與存取狀態</div>
          </div>
          <span className="text-txt3 group-hover:text-cyan transition-colors">→</span>
        </Link>
      )}
    </Layout>
  );
}
