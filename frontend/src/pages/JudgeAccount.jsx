import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { usersAPI, eventsAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

export default function JudgeAccount() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const [event, setEvent] = useState(null);
  const [judge, setJudge] = useState(null);
  const [showPw, setShowPw] = useState(false);
  const [pwModal, setPwModal] = useState(false);
  const [newPw, setNewPw] = useState('');

  const load = async () => {
    const [ev] = await Promise.all([eventsAPI.get(id)]);
    setEvent(ev.data);
    const jRes = await usersAPI.getJudge(user.id);
    setJudge(jRes.data);
  };

  useEffect(() => { load(); }, [id]);

  const handleSetPw = async (e) => {
    e.preventDefault();
    try {
      await usersAPI.setJudgePassword(user.id, newPw);
      toast('裁判密碼已更新');
      setPwModal(false);
      setNewPw('');
    } catch {
      toast('更新失敗', 'error');
    }
  };

  const handleToggleActive = async () => {
    try {
      await usersAPI.toggleJudgeActive(user.id, !judge.active);
      toast(judge.active ? '裁判帳號已停用' : '裁判帳號已啟用');
      load();
    } catch {
      toast('操作失敗', 'error');
    }
  };

  if (!event || !judge) return <Layout><div className="text-txt3 font-mono py-16 text-center">載入中...</div></Layout>;

  return (
    <Layout>
      <div className="flex items-center gap-2 mb-6 text-txt3 font-mono text-xs">
        <Link to="/events" className="hover:text-txt transition-colors">比賽列表</Link>
        <span>/</span>
        <Link to={`/events/${id}`} className="hover:text-txt transition-colors">{event.name}</Link>
        <span>/</span>
        <span className="text-txt">裁判帳號</span>
      </div>

      <div className="font-condensed font-bold text-xl tracking-widest uppercase text-lime mb-6">裁判帳號</div>

      <div className="bg-s1 border border-border rounded-lg p-7 max-w-lg">
        <div className="font-mono text-[10px] tracking-widest uppercase text-txt3 mb-4">帳號資訊</div>

        <div className="bg-cyan/5 border border-cyan/20 rounded-lg px-4 py-2.5 text-cyan font-mono text-xs mb-5">
          裁判帳號名稱固定為主辦方帳號加上 "judge"，不可更改。
        </div>

        <div className="mb-4">
          <div className="font-mono text-[10px] tracking-widest uppercase text-txt3 mb-1.5">帳號名稱</div>
          <div className="bg-bg border border-border rounded-lg px-4 py-2.5 font-mono text-sm text-lime tracking-wider">
            {judge.username}
          </div>
        </div>

        <div className="mb-6">
          <div className="font-mono text-[10px] tracking-widest uppercase text-txt3 mb-1.5">密碼</div>
          <div className="flex gap-2 items-center">
            <div className="flex-1 bg-bg border border-border rounded-lg px-4 py-2.5 font-mono text-sm text-cyan tracking-widest">
              {showPw ? (judge.password_plain ?? '（未記錄）') : '••••••••'}
            </div>
            <button onClick={() => setShowPw(v => !v)}
              className="px-3 py-2.5 bg-s2 border border-border rounded-lg text-txt3 hover:text-txt hover:border-txt3 transition-colors text-sm">
              {showPw ? '隱藏' : '顯示'}
            </button>
          </div>
        </div>

        <div className="flex gap-3 items-center">
          <button onClick={() => setPwModal(true)}
            className="font-condensed font-bold text-[11px] tracking-widest uppercase border border-cyan/30 text-cyan px-5 py-2 rounded hover:bg-cyan hover:text-bg transition-colors">
            重設密碼
          </button>
          <button
            onClick={handleToggleActive}
            className={`font-condensed font-bold text-[11px] tracking-widest uppercase border rounded px-5 py-2 transition-colors ${judge.active ? 'border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white' : 'border-cyan/30 text-cyan hover:bg-cyan hover:text-bg'}`}>
            {judge.active ? '停用帳號' : '啟用帳號'}
          </button>
          <span className={`font-mono text-[10px] uppercase px-2 py-0.5 rounded border ${judge.active ? 'border-lime/30 text-lime' : 'border-border text-txt3'}`}>
            {judge.active ? '啟用中' : '已停用'}
          </span>
        </div>
      </div>

      <div className="bg-s1 border border-border rounded-lg p-7 max-w-lg mt-4">
        <div className="font-mono text-[10px] tracking-widest uppercase text-txt3 mb-4">存取範圍</div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left font-mono text-[10px] tracking-widest uppercase text-txt3 py-2">功能</th>
              <th className="text-left font-mono text-[10px] tracking-widest uppercase text-txt3 py-2">權限</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['裁判計分', true],
              ['即時成績', true],
              ['選手管理、組別設定、匯出', false],
            ].map(([label, allowed]) => (
              <tr key={label} className="border-b border-border/50 last:border-0">
                <td className="py-3 text-sm text-txt2">{label}</td>
                <td className="py-3">
                  <span className={`font-mono text-[10px] uppercase px-2 py-0.5 rounded border ${allowed ? 'border-cyan/30 text-cyan' : 'border-border text-txt3'}`}>
                    {allowed ? '✓ 限本場比賽' : '✗ 無權限'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pwModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setPwModal(false)}>
          <div className="bg-s1 border border-border rounded-xl p-7 w-96" onClick={e => e.stopPropagation()}>
            <div className="font-condensed font-bold text-sm tracking-widest uppercase text-lime mb-5">重設裁判密碼</div>
            <form onSubmit={handleSetPw} className="space-y-4">
              <div>
                <label className="block font-mono text-[10px] tracking-widest uppercase text-txt3 mb-1.5">新密碼</label>
                <input
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  required
                  placeholder="輸入新密碼"
                  type="password"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <button type="button" onClick={() => setPwModal(false)}
                  className="font-condensed font-bold text-[11px] tracking-widest uppercase border border-border text-txt3 px-5 py-2 rounded hover:text-txt transition-colors">取消</button>
                <button type="submit"
                  className="font-condensed font-bold text-[11px] tracking-widest uppercase border border-cyan/30 text-cyan px-5 py-2 rounded hover:bg-cyan hover:text-bg transition-colors">確認更新</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
