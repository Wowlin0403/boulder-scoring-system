import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usersAPI } from '../api';
import { useToast } from './Toast';

const ROLE_LABEL = { superadmin: 'superadmin', organizer: 'organizer', judge: 'judge' };
const ROLE_STYLE = {
  superadmin: 'border-lime/30 text-lime',
  organizer: 'border-cyan/30 text-cyan',
  judge: 'border-purple-400/30 text-purple-400',
};

function ChangePwModal({ onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.next !== form.confirm) return toast('新密碼兩次輸入不一致', 'error');
    if (form.next.length < 6) return toast('新密碼至少 6 個字元', 'error');
    setLoading(true);
    try {
      await usersAPI.changeMyPassword(form.current, form.next);
      toast('密碼已更新');
      onClose();
    } catch (err) {
      toast(err.response?.data?.error || '更新失敗', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-s1 border border-border rounded-xl p-7 w-[380px]" onClick={e => e.stopPropagation()}>
        <div className="font-condensed font-bold text-sm tracking-widest uppercase text-lime mb-5">修改密碼</div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-mono text-[10px] tracking-widest uppercase text-txt3 mb-1.5">目前密碼</label>
            <input type="password" required value={form.current} onChange={e => setForm(f => ({ ...f, current: e.target.value }))} placeholder="輸入目前密碼" />
          </div>
          <div>
            <label className="block font-mono text-[10px] tracking-widest uppercase text-txt3 mb-1.5">新密碼</label>
            <input type="password" required value={form.next} onChange={e => setForm(f => ({ ...f, next: e.target.value }))} placeholder="至少 6 個字元" />
          </div>
          <div>
            <label className="block font-mono text-[10px] tracking-widest uppercase text-txt3 mb-1.5">確認新密碼</label>
            <input type="password" required value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} placeholder="再輸入一次新密碼" />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <button type="button" onClick={onClose}
              className="font-condensed font-bold text-[11px] tracking-widest uppercase border border-border text-txt3 px-5 py-2 rounded hover:border-txt3 hover:text-txt transition-colors">
              取消
            </button>
            <button type="submit" disabled={loading}
              className="font-condensed font-bold text-[11px] tracking-widest uppercase border border-lime/30 text-lime px-5 py-2 rounded hover:bg-lime hover:text-bg transition-colors disabled:opacity-40">
              {loading ? '更新中...' : '確認更新'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Layout({ children }) {
  const { user, logout, isSuperadmin, isJudge } = useAuth();
  const navigate = useNavigate();
  const [pwModal, setPwModal] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col">
      {pwModal && <ChangePwModal onClose={() => setPwModal(false)} />}
      <header className="bg-s1 border-b border-border px-7 h-14 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <Link to="/events" className="font-condensed font-black text-xl tracking-widest uppercase text-lime">
            BOULDER SCORE SYSTEM <sub className="text-[10px] tracking-widest text-txt3 font-mono font-normal align-middle ml-2">Design by W.C.</sub>
          </Link>
          {isSuperadmin && (
            <Link to="/admin/accounts"
              className="font-condensed font-bold text-xs tracking-widest uppercase border border-lime/30 text-lime px-3 py-1 rounded hover:bg-lime hover:text-bg transition-colors">
              帳號管理
            </Link>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs text-txt3">{user?.username}</span>
          <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded border ${ROLE_STYLE[user?.role] ?? 'border-border text-txt3'}`}>
            {ROLE_LABEL[user?.role] ?? user?.role}
          </span>
          {!isJudge && (
            <button onClick={() => setPwModal(true)}
              className="font-condensed font-bold text-xs tracking-widest uppercase text-txt3 hover:text-txt transition-colors">
              改密碼
            </button>
          )}
          <button onClick={handleLogout}
            className="font-condensed font-bold text-xs tracking-widest uppercase text-txt3 hover:text-txt transition-colors">
            登出
          </button>
        </div>
      </header>
      <main className="flex-1 p-7 max-w-[1280px] w-full mx-auto">
        {children}
      </main>
    </div>
  );
}
