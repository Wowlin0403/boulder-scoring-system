import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { eventsAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

export default function Events() {
  const [events, setEvents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', date: new Date().toISOString().slice(0, 10) });
  const [loading, setLoading] = useState(true);
  const { isAdmin, isSuperadmin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const load = async () => {
    try {
      const res = await eventsAPI.list();
      setEvents(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await eventsAPI.create(form);
      toast('比賽已建立');
      navigate(`/events/${res.data.id}`);
    } catch (err) {
      toast(err.response?.data?.error || '建立失敗', 'error');
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`確定刪除「${name}」？此操作無法復原。`)) return;
    try {
      await eventsAPI.delete(id);
      toast('比賽已刪除');
      load();
    } catch {
      toast('刪除失敗', 'error');
    }
  };

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-condensed font-black text-2xl tracking-widest uppercase text-lime">比賽列表</h1>
        {isSuperadmin && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-lime text-bg font-condensed font-bold text-xs tracking-widest uppercase px-4 py-2 rounded hover:bg-[#b5de25] transition-colors"
          >
            + 新建比賽
          </button>
        )}
      </div>

      {showForm && isSuperadmin && (
        <form onSubmit={handleCreate} className="bg-s1 border border-border rounded-lg p-6 mb-6">
          <div className="font-condensed font-bold text-sm tracking-widest uppercase text-lime mb-4">新建比賽</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-[10px] tracking-widest uppercase text-txt3 mb-1.5">賽事名稱</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. 2025 抱石公開賽" />
            </div>
            <div>
              <label className="block font-mono text-[10px] tracking-widest uppercase text-txt3 mb-1.5">日期</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button type="submit" className="bg-lime text-bg font-condensed font-bold text-xs tracking-widest uppercase px-5 py-2 rounded hover:bg-[#b5de25] transition-colors">建立</button>
            <button type="button" onClick={() => setShowForm(false)} className="border border-border2 text-txt2 font-condensed font-bold text-xs tracking-widest uppercase px-5 py-2 rounded hover:border-txt2 transition-colors">取消</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-txt3 text-center py-16 font-mono">載入中...</div>
      ) : events.length === 0 ? (
        <div className="text-txt3 text-center py-16 font-mono">尚無比賽，請建立第一場</div>
      ) : (
        <div className="space-y-3">
          {events.map(ev => (
            <div key={ev.id} className="bg-s1 border border-border rounded-lg p-5 flex items-center justify-between hover:border-border2 transition-colors">
              <div>
                <div className="font-condensed font-bold text-lg text-txt">{ev.name}</div>
                <div className="font-mono text-xs text-txt3 mt-1">{ev.date}</div>
              </div>
              <div className="flex gap-2">
                <Link
                  to={`/events/${ev.id}`}
                  className="border border-border2 text-txt2 font-condensed font-bold text-xs tracking-widest uppercase px-4 py-2 rounded hover:border-txt2 hover:text-txt transition-colors"
                >
                  進入
                </Link>
                {isSuperadmin && (
                  <button
                    onClick={() => handleDelete(ev.id, ev.name)}
                    className="border border-red/30 text-red font-condensed font-bold text-xs tracking-widest uppercase px-4 py-2 rounded hover:bg-red hover:text-white transition-colors"
                  >
                    刪除
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
