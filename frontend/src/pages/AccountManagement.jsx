import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { usersAPI, eventsAPI } from '../api';
import { useToast } from '../components/Toast';

export default function AccountManagement() {
  const toast = useToast();
  const [organizers, setOrganizers] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [modal, setModal] = useState(null);
  const [modalEvents, setModalEvents] = useState([]);

  const load = async () => {
    const [ul, el] = await Promise.all([usersAPI.list(), eventsAPI.list()]);
    setOrganizers(ul.data);
    setAllEvents(el.data);
  };

  useEffect(() => { load(); }, []);

  const openModal = (type, data = null) => {
    setModalEvents(data?.events?.map(e => e.id) ?? []);
    setModal({ type, data });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await usersAPI.create({ username: fd.get('username'), password: fd.get('password'), event_ids: modalEvents });
      toast('主辦方帳號已建立');
      setModal(null);
      load();
    } catch (err) {
      toast(err.response?.data?.error || '建立失敗', 'error');
    }
  };

  const handleResetPw = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await usersAPI.resetPassword(modal.data.id, fd.get('password'));
      toast('密碼已更新');
      setModal(null);
    } catch {
      toast('更新失敗', 'error');
    }
  };

  const handleUpdateEvents = async (e) => {
    e.preventDefault();
    try {
      await usersAPI.updateEvents(modal.data.id, modalEvents);
      toast('比賽指派已更新');
      setModal(null);
      load();
    } catch {
      toast('更新失敗', 'error');
    }
  };

  const handleToggleActive = async (org) => {
    try {
      await usersAPI.toggleActive(org.id, !org.active);
      toast(org.active ? '帳號已停用' : '帳號已啟用');
      load();
    } catch {
      toast('操作失敗', 'error');
    }
  };

  const handleDelete = async (org) => {
    if (!confirm(`確定刪除主辦方「${org.username}」？此操作將同時刪除裁判帳號，且無法復原。`)) return;
    try {
      await usersAPI.delete(org.id);
      toast('已刪除');
      load();
    } catch {
      toast('刪除失敗', 'error');
    }
  };

  return (
    <Layout>
      <div className="flex items-center gap-2 mb-6 text-txt3 font-mono text-xs">
        <Link to="/events" className="hover:text-txt transition-colors">比賽列表</Link>
        <span>/</span>
        <span className="text-txt">帳號管理</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="font-condensed font-bold text-xl tracking-widest uppercase text-lime">主辦方帳號</div>
        <button
          className="border border-lime/30 text-lime font-condensed font-bold text-xs tracking-widest uppercase px-5 py-2 rounded hover:bg-lime hover:text-bg transition-colors"
          onClick={() => openModal('create')}>
          ＋ 新增主辦方
        </button>
      </div>

      <div className="bg-s1 border border-border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left font-mono text-[10px] tracking-widest uppercase text-txt3 px-5 py-3">帳號</th>
              <th className="text-left font-mono text-[10px] tracking-widest uppercase text-txt3 px-5 py-3">負責比賽</th>
              <th className="text-left font-mono text-[10px] tracking-widest uppercase text-txt3 px-5 py-3">狀態</th>
              <th className="text-left font-mono text-[10px] tracking-widest uppercase text-txt3 px-5 py-3">裁判帳號狀態</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {organizers.length === 0 && (
              <tr><td colSpan={5} className="text-center text-txt3 font-mono text-xs py-10">尚無主辦方帳號</td></tr>
            )}
            {organizers.map(org => (
              <tr key={org.id} className="border-b border-border/50 last:border-0 hover:bg-s2/30">
                <td className="px-5 py-4">
                  <div className="font-mono text-sm text-lime">{org.username}</div>
                  <div className="text-txt3 font-mono text-[10px] mt-0.5">{org.created_at?.slice(0, 10)}</div>
                </td>
                <td className="px-5 py-4">
                  {org.events?.length > 0
                    ? <div className="flex flex-wrap gap-1">
                        {org.events.map(ev => (
                          <span key={ev.id} className="text-[11px] text-txt2 bg-s2 border border-border rounded px-2 py-0.5">{ev.name}</span>
                        ))}
                      </div>
                    : <span className="text-txt3 text-xs">（尚未指派）</span>
                  }
                </td>
                <td className="px-5 py-4">
                  <span className={`font-mono text-[10px] uppercase px-2 py-0.5 rounded border ${org.active ? 'border-lime/30 text-lime' : 'border-border text-txt3'}`}>
                    {org.active ? '啟用' : '停用'}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <div className="font-mono text-xs text-txt2">{org.judge?.username ?? '—'}</div>
                  {org.judge && (
                    <div className={`text-[10px] font-mono mt-0.5 ${org.judge.active ? 'text-cyan' : 'text-txt3'}`}>
                      {org.judge.active ? '啟用' : '停用'}
                    </div>
                  )}
                </td>
                <td className="px-5 py-4">
                  <div className="flex gap-2 justify-end">
                    <button className="text-txt3 hover:text-txt font-condensed font-bold text-[11px] tracking-widest uppercase border border-border rounded px-3 py-1.5 hover:border-txt3 transition-colors"
                      onClick={() => openModal('editEvents', org)}>指派比賽</button>
                    <button className="text-txt3 hover:text-txt font-condensed font-bold text-[11px] tracking-widest uppercase border border-border rounded px-3 py-1.5 hover:border-txt3 transition-colors"
                      onClick={() => openModal('resetPw', org)}>重設密碼</button>
                    <button
                      className={`font-condensed font-bold text-[11px] tracking-widest uppercase border rounded px-3 py-1.5 transition-colors ${org.active ? 'border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white' : 'border-cyan/30 text-cyan hover:bg-cyan hover:text-bg'}`}
                      onClick={() => handleToggleActive(org)}>
                      {org.active ? '停用' : '啟用'}
                    </button>
                    <button className="text-red-400 hover:text-red-300 font-condensed font-bold text-[11px] tracking-widest uppercase border border-red-500/20 rounded px-3 py-1.5 hover:border-red-400 transition-colors"
                      onClick={() => handleDelete(org)}>刪除</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal: 新增主辦方 */}
      {modal?.type === 'create' && (
        <Modal title="新增主辦方帳號" onClose={() => setModal(null)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <Field label="帳號名稱">
              <DarkInput name="username" required placeholder="e.g. taichung2026" />
            </Field>
            <Field label="初始密碼">
              <DarkInput name="password" type="password" required placeholder="輸入密碼" />
            </Field>
            <Field label="指派比賽">
              <EventPicker events={allEvents} selected={modalEvents} onChange={setModalEvents} />
            </Field>
            <InfoBox>裁判帳號將自動建立為「帳號 + judge」，密碼為「主辦方帳號 + 1234」。</InfoBox>
            <ModalFooter onClose={() => setModal(null)} submitLabel="建立帳號" />
          </form>
        </Modal>
      )}

      {/* Modal: 重設密碼 */}
      {modal?.type === 'resetPw' && (
        <Modal title={`重設密碼 — ${modal.data.username}`} onClose={() => setModal(null)}>
          <form onSubmit={handleResetPw} className="space-y-4">
            <Field label="新密碼">
              <DarkInput name="password" type="password" required placeholder="輸入新密碼" />
            </Field>
            <p className="text-txt3 font-mono text-[11px]">裁判帳號密碼不會隨之變更</p>
            <ModalFooter onClose={() => setModal(null)} submitLabel="確認更新" />
          </form>
        </Modal>
      )}

      {/* Modal: 編輯比賽 */}
      {modal?.type === 'editEvents' && (
        <Modal title={`指派比賽 — ${modal.data.username}`} onClose={() => setModal(null)}>
          <form onSubmit={handleUpdateEvents} className="space-y-4">
            <Field label="指派比賽">
              <EventPicker events={allEvents} selected={modalEvents} onChange={setModalEvents} />
            </Field>
            <ModalFooter onClose={() => setModal(null)} submitLabel="儲存" />
          </form>
        </Modal>
      )}
    </Layout>
  );
}

function DarkInput({ name, type = 'text', required, placeholder }) {
  return (
    <input name={name} type={type} required={required} placeholder={placeholder} />
  );
}

function EventPicker({ events, selected, onChange }) {
  const selectedEvents = events.filter(ev => selected.includes(ev.id));
  const available = events.filter(ev => !selected.includes(ev.id));

  const handleAdd = (e) => {
    const id = parseInt(e.target.value);
    if (!id) return;
    onChange([...selected, id]);
    e.target.value = '';
  };

  const handleRemove = (id) => onChange(selected.filter(s => s !== id));

  return (
    <div className="space-y-2">
      <select onChange={handleAdd}>
        <option value="">選擇比賽...</option>
        {available.map(ev => (
          <option key={ev.id} value={ev.id}>{ev.name}</option>
        ))}
      </select>
      <div className="font-mono text-[10px] tracking-widest uppercase text-txt3 mt-3 mb-1">目前已指派比賽</div>
      {selectedEvents.length === 0
        ? <p className="font-mono text-xs text-txt3/50 py-1">尚未指派</p>
        : <div className="space-y-1.5">
            {selectedEvents.map(ev => (
              <div key={ev.id} className="flex items-center justify-between bg-bg border border-border rounded-lg px-3 py-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-txt">{ev.name}</span>
                  <span className="font-mono text-[11px] text-txt3">{ev.date}</span>
                </div>
                <button type="button" onClick={() => handleRemove(ev.id)}
                  className="text-txt3 hover:text-red-400 transition-colors text-base leading-none px-1">×</button>
              </div>
            ))}
          </div>
      }
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-s1 border border-border rounded-xl p-7 w-[480px] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="font-condensed font-bold text-sm tracking-widest uppercase text-lime mb-5">{title}</div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block font-mono text-[10px] tracking-widest uppercase text-txt3 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function InfoBox({ children }) {
  return (
    <div className="bg-cyan/10 border border-cyan/20 rounded-lg px-4 py-2.5 text-cyan font-mono text-xs leading-relaxed">{children}</div>
  );
}

function ModalFooter({ onClose, submitLabel }) {
  return (
    <div className="flex justify-end gap-2 pt-4 border-t border-border">
      <button type="button" onClick={onClose}
        className="font-condensed font-bold text-[11px] tracking-widest uppercase border border-border text-txt3 px-5 py-2 rounded hover:border-txt3 hover:text-txt transition-colors">
        取消
      </button>
      <button type="submit"
        className="font-condensed font-bold text-[11px] tracking-widest uppercase border border-lime/30 text-lime px-5 py-2 rounded hover:bg-lime hover:text-bg transition-colors">
        {submitLabel}
      </button>
    </div>
  );
}
