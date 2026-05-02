import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { eventsAPI } from '../api';
import { useToast } from '../components/Toast';

function parseCSV(text, categories) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  return lines.slice(1).map((line, i) => {
    const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim());
    const [name = '', bib = '', categoryName = ''] = cols;
    const cat = categories.find(c => c.name === categoryName.trim());
    const rawBib = bib.trim();
    const formattedBib = /^\d+$/.test(rawBib) ? rawBib.padStart(3, '0') : rawBib;
    const errors = [];
    if (!name) errors.push('姓名空白');
    if (!rawBib) errors.push('號碼牌空白');
    if (categoryName && !cat) errors.push(`找不到組別「${categoryName}」`);
    return { rowNum: i + 2, name: name.trim(), bib: formattedBib, categoryName: categoryName.trim(), category_id: cat?.id || null, errors };
  }).filter(r => r.name || r.bib);
}

function downloadTemplate(catName) {
  const csv = `﻿姓名,號碼牌,組別\n陳威廷,M001,${catName}\n張雅婷,F001,${catName}\n`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  a.download = '選手名單範本.csv';
  a.click();
}

export default function Athletes() {
  const { id, catId } = useParams();
  const toast = useToast();
  const fileRef = useRef();
  const [event, setEvent] = useState(null);
  const [category, setCategory] = useState(null);
  const [athletes, setAthletes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ name: '', bib: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', bib: '' });
  const [importPreview, setImportPreview] = useState(null);
  const [importing, setImporting] = useState(false);

  const load = async () => {
    const [ev, al, cl] = await Promise.all([
      eventsAPI.get(id),
      eventsAPI.getAthletes(id),
      eventsAPI.getCategories(id),
    ]);
    setEvent(ev.data);
    setCategories(cl.data);
    const found = cl.data.find(c => String(c.id) === String(catId));
    setCategory(found || null);
    setAthletes(al.data.filter(a => String(a.category_id) === String(catId)));
  };

  useEffect(() => { load(); }, [id, catId]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.bib.trim()) return toast('請填寫姓名與號碼牌', 'error');
    try {
      await eventsAPI.createAthlete(id, { ...form, category_id: +catId });
      setForm({ name: '', bib: '' });
      await load();
      toast(`${form.name} 已新增`);
    } catch (err) {
      toast(err.response?.data?.error || '新增失敗', 'error');
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm(`確認要清除「${category?.name}」的全部選手資料？此操作無法復原。`)) return;
    try {
      await eventsAPI.deleteAllAthletes(id);
      await load();
      toast('已清除該組別全部選手');
    } catch {
      toast('清除失敗', 'error');
    }
  };

  const handleEditStart = (a) => {
    setEditingId(a.id);
    setEditForm({ name: a.name, bib: a.bib });
  };

  const handleEditSave = async (athId) => {
    if (!editForm.name.trim() || !editForm.bib.trim()) return toast('請填寫姓名與號碼牌', 'error');
    try {
      await eventsAPI.updateAthlete(id, athId, editForm);
      setEditingId(null);
      await load();
      toast('已更新');
    } catch (err) {
      toast(err.response?.data?.error || '更新失敗', 'error');
    }
  };

  const handleDelete = async (athId, name) => {
    if (!confirm(`確定移除選手「${name}」？`)) return;
    try {
      await eventsAPI.deleteAthlete(id, athId);
      await load();
      toast('已移除');
    } catch {
      toast('移除失敗', 'error');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target.result, categories);
      setImportPreview(rows);
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!importPreview) return;
    const validRows = importPreview.filter(r => r.errors.length === 0);
    if (validRows.length === 0) return toast('沒有可匯入的有效資料', 'error');
    setImporting(true);
    try {
      const res = await eventsAPI.bulkImportAthletes(id, validRows.map(r => ({
        name: r.name,
        bib: r.bib,
        category_id: r.category_id || +catId,
      })));
      await load();
      setImportPreview(null);
      const { imported, skipped } = res.data;
      if (skipped.length > 0) {
        toast(`匯入 ${imported.length} 筆，${skipped.length} 筆號碼牌重複已跳過`);
      } else {
        toast(`成功匯入 ${imported.length} 位選手 ✓`);
      }
    } catch {
      toast('匯入失敗', 'error');
    } finally {
      setImporting(false);
    }
  };

  const validCount = importPreview?.filter(r => r.errors.length === 0).length ?? 0;
  const errorCount = importPreview?.filter(r => r.errors.length > 0).length ?? 0;

  if (!event || !category) return <Layout><div className="text-txt3 font-mono py-16 text-center">載入中...</div></Layout>;

  return (
    <Layout>
      <div className="flex items-center gap-2 mb-6 text-txt3 font-mono text-xs">
        <Link to="/events" className="hover:text-txt transition-colors">比賽列表</Link>
        <span>/</span>
        <Link to={`/events/${id}`} className="hover:text-txt transition-colors">{event.name}</Link>
        <span>/</span>
        <Link to={`/events/${id}/categories/${catId}`} className="hover:text-txt transition-colors">{category.name}</Link>
        <span>/</span>
        <span className="text-txt">選手名單</span>
      </div>

      {/* 單筆新增 */}
      <div className="bg-s1 border border-border rounded-lg p-6 mb-5">
        <div className="font-condensed font-bold text-sm tracking-widest uppercase text-lime mb-4">新增選手</div>
        <form onSubmit={handleAdd} className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-32">
            <label className="block font-mono text-[10px] tracking-widest uppercase text-txt3 mb-1.5">姓名</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="選手全名" />
          </div>
          <div className="flex-1 min-w-24">
            <label className="block font-mono text-[10px] tracking-widest uppercase text-txt3 mb-1.5">號碼牌</label>
            <input type="text" value={form.bib} onChange={e => setForm(f => ({ ...f, bib: e.target.value }))} placeholder="A001" />
          </div>
          <div className="flex items-end">
            <button type="submit" className="bg-lime text-bg font-condensed font-bold text-xs tracking-widest uppercase px-5 py-[9px] rounded hover:bg-[#b5de25] transition-colors whitespace-nowrap">
              新增
            </button>
          </div>
        </form>
      </div>

      {/* 批次匯入 */}
      <div className="bg-s1 border border-border rounded-lg p-6 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div className="font-condensed font-bold text-sm tracking-widest uppercase text-lime">批次匯入 CSV</div>
          <button
            onClick={() => downloadTemplate(category.name)}
            className="border border-border2 text-txt2 font-condensed font-bold text-xs tracking-widest uppercase px-4 py-1.5 rounded hover:border-txt2 hover:text-txt transition-colors"
          >
            ↓ 下載範本
          </button>
        </div>

        <input ref={fileRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />

        {!importPreview ? (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full border-2 border-dashed border-border2 text-txt3 font-condensed font-bold text-xs tracking-widest uppercase py-6 rounded hover:border-txt3 hover:text-txt2 transition-colors"
          >
            點擊選擇 CSV 檔案
          </button>
        ) : (
          <>
            <div className="flex gap-3 mb-4 text-xs font-mono">
              <span className="text-lime">✓ {validCount} 筆可匯入</span>
              {errorCount > 0 && <span className="text-red">✗ {errorCount} 筆有錯誤</span>}
            </div>

            <div className="overflow-x-auto mb-4 max-h-72 overflow-y-auto border border-border rounded">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 bg-s2">
                  <tr>
                    {['列', '姓名', '號碼牌', '組別', '狀態'].map(h => (
                      <th key={h} className="font-mono text-[9px] tracking-widest uppercase text-txt3 py-2 px-3 text-left border-b border-border">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {importPreview.map(r => (
                    <tr key={r.rowNum} className={r.errors.length > 0 ? 'bg-red/5' : ''}>
                      <td className="py-2 px-3 font-mono text-xs text-txt3">{r.rowNum}</td>
                      <td className="py-2 px-3">{r.name || <span className="text-red">空白</span>}</td>
                      <td className="py-2 px-3 font-mono text-xs">{r.bib || <span className="text-red">空白</span>}</td>
                      <td className="py-2 px-3">
                        {r.category_id ? (
                          <span className="text-txt">{r.categoryName}</span>
                        ) : r.categoryName ? (
                          <span className="text-red">{r.categoryName}</span>
                        ) : (
                          <span className="text-txt3">{category.name}</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        {r.errors.length === 0
                          ? <span className="text-lime font-mono text-xs">✓</span>
                          : <span className="text-red font-mono text-xs">{r.errors.join('、')}</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleImport}
                disabled={importing || validCount === 0}
                className="bg-lime text-bg font-condensed font-bold text-xs tracking-widest uppercase px-5 py-2 rounded hover:bg-[#b5de25] transition-colors disabled:opacity-40"
              >
                {importing ? '匯入中...' : `確認匯入（${validCount} 筆）`}
              </button>
              <button
                onClick={() => setImportPreview(null)}
                className="border border-border2 text-txt2 font-condensed font-bold text-xs tracking-widest uppercase px-5 py-2 rounded hover:border-txt2 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="border border-border2 text-txt2 font-condensed font-bold text-xs tracking-widest uppercase px-5 py-2 rounded hover:border-txt2 transition-colors"
              >
                重新選擇
              </button>
            </div>
          </>
        )}
      </div>

      {/* 選手名單 */}
      <div className="bg-s1 border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="font-condensed font-bold text-sm tracking-widest uppercase text-lime">
            選手名單 <span className="text-txt3 font-mono text-xs font-normal ml-2">{athletes.length} 人</span>
          </div>
          <button
            onClick={handleDeleteAll}
            className="border border-red/30 text-red font-condensed font-bold text-xs tracking-widest uppercase px-3 py-[7px] rounded hover:bg-red hover:text-white transition-colors"
          >
            全部清除
          </button>
        </div>

        {athletes.length === 0 ? (
          <div className="text-txt3 font-mono text-center py-12">尚無選手</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  {['號碼', '姓名', ''].map(h => (
                    <th key={h} className="font-mono text-[9px] tracking-widest uppercase text-txt3 py-2 px-3 text-left border-b border-border">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {athletes.map(a => (
                  <tr key={a.id} className="hover:bg-s2 transition-colors">
                    {editingId === a.id ? (
                      <>
                        <td className="py-1.5 px-3">
                          <input
                            type="text"
                            value={editForm.bib}
                            onChange={e => setEditForm(f => ({ ...f, bib: e.target.value }))}
                            className="font-mono text-xs w-20 py-1 px-2"
                          />
                        </td>
                        <td className="py-1.5 px-3">
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                            className="text-sm w-full py-1 px-2"
                            autoFocus
                          />
                        </td>
                        <td className="py-1.5 px-3 text-right">
                          <div className="flex gap-1.5 justify-end">
                            <button
                              onClick={() => handleEditSave(a.id)}
                              className="bg-lime text-bg font-condensed font-bold text-[10px] tracking-widest uppercase px-2.5 py-1 rounded hover:bg-[#b5de25] transition-colors"
                            >
                              儲存
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="border border-border2 text-txt2 font-condensed font-bold text-[10px] tracking-widest uppercase px-2.5 py-1 rounded hover:border-txt2 transition-colors"
                            >
                              取消
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2.5 px-3 font-mono text-xs text-txt3">{a.bib}</td>
                        <td className="py-2.5 px-3 font-bold text-txt">{a.name}</td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex gap-1.5 justify-end">
                            <button
                              onClick={() => handleEditStart(a)}
                              className="border border-border2 text-txt2 font-condensed font-bold text-[10px] tracking-widest uppercase px-2.5 py-1 rounded hover:border-txt2 hover:text-txt transition-colors"
                            >
                              編輯
                            </button>
                            <button
                              onClick={() => handleDelete(a.id, a.name)}
                              className="border border-red/30 text-red font-condensed font-bold text-[10px] tracking-widest uppercase px-2.5 py-1 rounded hover:bg-red hover:text-white transition-colors"
                            >
                              移除
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
