import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { eventsAPI } from '../api';
import { useToast } from '../components/Toast';

const ROUND_NAMES = { qual: '資格賽', semi: '複賽', final: '決賽' };
const getRounds = (n) => n === 2 ? ['qual', 'final'] : ['qual', 'semi', 'final'].slice(0, n);

function BoulderCard({ boulder, score, onChange, onReset, attempts, onAttemptsChange }) {
  const toast = useToast();

  const top = score.top || false;
  const zone = score.zone || false;
  const canAct = attempts > 0;

  const handleTop = () => {
    if (!canAct && !top) return;
    const newTopAtt = top ? Math.min(score.top_attempts, attempts) : attempts;
    const newScore = { ...score, top: true, top_attempts: newTopAtt };
    if (!zone) {
      newScore.zone = true;
      newScore.zone_attempts = newTopAtt;
      toast('選手無 ZONE 點嘗試次數，成績將同為 TOP 嘗試次數。');
    }
    onChange(newScore);
  };

  const handleZone = () => {
    if (!canAct && !zone) return;
    const newZoneAtt = zone ? Math.min(score.zone_attempts, attempts) : attempts;
    onChange({ ...score, zone: true, zone_attempts: newZoneAtt });
  };

  const dotColor = top ? 'bg-lime' : zone ? 'bg-cyan' : 'bg-txt3';

  return (
    <div className="bg-s2 border border-border rounded-lg flex flex-col">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColor}`} />
          <span className="font-condensed font-bold text-base tracking-widest uppercase text-txt">{boulder.label}</span>
        </div>
        <button
          onClick={onReset}
          className="font-condensed font-bold text-[10px] tracking-widest uppercase text-txt3 border border-border rounded px-2 py-0.5 hover:border-txt3 hover:text-txt2 transition-colors"
        >
          重設
        </button>
      </div>

      <div className="mx-4 mb-3 border border-border rounded overflow-hidden">
        <div className={`flex items-center justify-between px-3 py-2 border-b border-border ${top ? 'bg-lime/10' : ''}`}>
          <span className={`font-condensed font-bold text-xs tracking-widest ${top ? 'text-lime' : 'text-txt3'}`}>TOP</span>
          <span className={`font-mono font-bold text-sm ${top ? 'text-lime' : 'text-txt3'}`}>
            {top ? `${score.top_attempts} 次` : '—'}
          </span>
        </div>
        <div className={`flex items-center justify-between px-3 py-2 ${zone ? 'bg-cyan/10' : ''}`}>
          <span className={`font-condensed font-bold text-xs tracking-widest ${zone ? 'text-cyan' : 'text-txt3'}`}>ZONE</span>
          <span className={`font-mono font-bold text-sm ${zone ? 'text-cyan' : 'text-txt3'}`}>
            {zone ? `${score.zone_attempts} 次` : '—'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 px-4 mb-3">
        <button
          onClick={handleTop}
          disabled={!canAct && !top}
          className={`py-3 font-condensed font-black text-sm tracking-widest uppercase rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            top ? 'bg-lime text-bg hover:bg-[#b5de25]' : 'bg-s3 text-txt2 border border-border2 hover:border-lime hover:text-lime'
          }`}
        >
          TOP
        </button>
        <button
          onClick={handleZone}
          disabled={!canAct && !zone}
          className={`py-3 font-condensed font-black text-sm tracking-widest uppercase rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            zone ? 'bg-cyan text-bg hover:bg-[#2fd4c0]' : 'bg-s3 text-txt2 border border-border2 hover:border-cyan hover:text-cyan'
          }`}
        >
          ZONE
        </button>
      </div>

      <div className="px-4 pb-4">
        <div className="font-mono text-[9px] tracking-widest uppercase text-txt3 mb-1.5">嘗試次數</div>
        <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 50px' }}>
          <input
            type="number"
            min={0}
            value={attempts}
            onChange={e => onAttemptsChange(Math.max(0, parseInt(e.target.value) || 0))}
            className="text-center font-mono font-bold text-lg py-2.5 w-full"
          />
          <button
            onClick={() => onAttemptsChange(attempts + 1)}
            className="h-[46px] bg-s3 border border-border2 text-txt text-2xl font-bold rounded hover:bg-border2 transition-colors active:scale-95 select-none"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

function UnsavedModal({ onSaveAndSwitch, onDiscardAndSwitch, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-s1 border border-border2 rounded-lg p-7 max-w-xs w-full text-center">
        <p className="text-txt text-sm leading-relaxed mb-1">有未儲存的成績</p>
        <p className="text-txt3 font-mono text-xs mb-6">切換前請選擇處理方式</p>
        <div className="flex flex-col gap-2">
          <button onClick={onSaveAndSwitch} className="py-2.5 bg-lime text-bg font-condensed font-bold text-xs tracking-widest uppercase rounded hover:bg-[#b5de25] transition-colors">
            儲存後切換
          </button>
          <button onClick={onDiscardAndSwitch} className="py-2.5 border border-red/40 text-red font-condensed font-bold text-xs tracking-widest uppercase rounded hover:bg-red hover:text-white transition-colors">
            直接切換（放棄成績）
          </button>
          <button onClick={onCancel} className="py-2.5 border border-border2 text-txt2 font-condensed font-bold text-xs tracking-widest uppercase rounded hover:border-txt2 transition-colors">
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

function ResetModal({ label, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-s1 border border-border2 rounded-lg p-7 max-w-xs w-full text-center">
        <p className="text-txt text-sm leading-relaxed mb-6">
          確認要重設選手<br />
          <span className="font-condensed font-bold text-base tracking-widest text-lime">{label}</span><br />
          的成績？
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={onConfirm} className="py-2.5 bg-lime text-bg font-condensed font-bold text-xs tracking-widest uppercase rounded hover:bg-[#b5de25] transition-colors">確認</button>
          <button onClick={onCancel} className="py-2.5 border border-border2 text-txt2 font-condensed font-bold text-xs tracking-widest uppercase rounded hover:border-txt2 transition-colors">取消</button>
        </div>
      </div>
    </div>
  );
}

export default function Scoring() {
  const { id, catId } = useParams();
  const toast = useToast();
  const [event, setEvent] = useState(null);
  const [category, setCategory] = useState(null);
  const [athletes, setAthletes] = useState([]);
  const [boulders, setBoulders] = useState([]);
  const [selectedAthlete, setSelectedAthlete] = useState('');
  const [selectedRound, setSelectedRound] = useState('qual');
  const [scores, setScores] = useState({});
  const [selectedBoulder, setSelectedBoulder] = useState('all');
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [attemptCounts, setAttemptCounts] = useState({});
  const attemptTimers = useRef({});

  const selectedAthObj = athletes.find(a => String(a.id) === selectedAthlete);
  const availableRounds = category ? getRounds(category.rounds) : ['qual'];

  useEffect(() => {
    Promise.all([eventsAPI.get(id), eventsAPI.getCategories(id)]).then(([ev, cl]) => {
      setEvent(ev.data);
      const found = cl.data.find(c => String(c.id) === String(catId));
      setCategory(found || null);
      if (found) setSelectedRound(getRounds(found.rounds)[0]);
    });
  }, [id, catId]);

  useEffect(() => {
    if (!catId) return;
    if (selectedRound === 'qual') {
      eventsAPI.getAthletes(id, { round: selectedRound }).then(res => {
        const catAthletes = res.data.filter(a => String(a.category_id) === String(catId));
        setAthletes(catAthletes);
        setSelectedAthlete(prev => catAthletes.find(a => String(a.id) === prev) ? prev : '');
      });
    } else {
      eventsAPI.getStartOrder(id, catId, selectedRound).then(res => {
        setAthletes(res.data);
        setSelectedAthlete(prev => res.data.find(a => String(a.id) === prev) ? prev : '');
      });
    }
  }, [id, catId, selectedRound]);

  useEffect(() => {
    if (!selectedRound || !catId) {
      setBoulders([]);
      return;
    }
    eventsAPI.getBoulders(id, selectedRound, catId).then(res => setBoulders(res.data));
  }, [selectedRound, id, catId]);

  useEffect(() => {
    if (!selectedAthlete || !selectedRound) return;
    eventsAPI.getScores(id, selectedRound).then(res => {
      const map = {};
      const counts = {};
      res.data
        .filter(s => s.athlete_id === +selectedAthlete)
        .forEach(s => {
          map[s.boulder_id] = { top: !!s.top, zone: !!s.zone, top_attempts: s.top_attempts, zone_attempts: s.zone_attempts };
          counts[s.boulder_id] = s.attempts || 0;
        });
      setScores(map);
      setAttemptCounts(counts);
    });
  }, [selectedAthlete, selectedRound, id]);

  const handleScoreChange = useCallback((boulderId, newScore) => {
    setScores(prev => ({ ...prev, [boulderId]: newScore }));
    setIsDirty(true);
  }, []);

  const handleAttemptsChange = useCallback((boulderId, val) => {
    setAttemptCounts(prev => ({ ...prev, [boulderId]: val }));
    clearTimeout(attemptTimers.current[boulderId]);
    attemptTimers.current[boulderId] = setTimeout(() => {
      if (!selectedAthlete) return;
      eventsAPI.saveAttempt(id, { athlete_id: +selectedAthlete, round: selectedRound, boulder_id: boulderId, attempts: val });
    }, 500);
  }, [id, selectedAthlete, selectedRound]);

  const handleResetConfirm = () => {
    if (!resetTarget) return;
    setScores(prev => { const next = { ...prev }; delete next[resetTarget.boulderId]; return next; });
    setAttemptCounts(prev => ({ ...prev, [resetTarget.boulderId]: 0 }));
    setResetTarget(null);
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!selectedAthlete) return toast('請先選擇選手', 'error');
    setSaving(true);
    try {
      const targetBoulders = selectedBoulder === 'all' ? boulders : boulders.filter(b => String(b.id) === selectedBoulder);
      const scoreArray = targetBoulders.map(b => ({
        boulder_id: b.id,
        top: scores[b.id]?.top || false,
        top_attempts: scores[b.id]?.top_attempts || 0,
        zone: scores[b.id]?.zone || false,
        zone_attempts: scores[b.id]?.zone_attempts || 0,
      }));
      await eventsAPI.saveScores(id, { athlete_id: +selectedAthlete, round: selectedRound, scores: scoreArray });
      toast('成績已儲存 ✓');
      setIsDirty(false);
    } catch {
      toast('儲存失敗', 'error');
    } finally {
      setSaving(false);
    }
  };

  const applySwitch = (sw) => {
    if (sw.type === 'athlete') {
      setSelectedAthlete(sw.value);
      setScores({});
      setAttemptCounts({});
    } else {
      setSelectedRound(sw.value);
      setScores({});
      setAttemptCounts({});
      setSelectedBoulder('all');
    }
    setIsDirty(false);
    setPendingSwitch(null);
  };

  const handleAthleteChange = (value) => {
    if (isDirty && selectedAthlete) {
      setPendingSwitch({ type: 'athlete', value });
    } else {
      setSelectedAthlete(value);
      setScores({});
      setAttemptCounts({});
      setIsDirty(false);
    }
  };

  const handleRoundChange = (value) => {
    if (isDirty && selectedAthlete) {
      setPendingSwitch({ type: 'round', value });
    } else {
      setSelectedRound(value);
      setScores({});
      setAttemptCounts({});
      setSelectedBoulder('all');
      setIsDirty(false);
    }
  };

  const handleSaveAndSwitch = async () => {
    await handleSave();
    if (pendingSwitch) applySwitch(pendingSwitch);
  };

  if (!event || !category) return <Layout><div className="text-txt3 font-mono py-16 text-center">載入中...</div></Layout>;

  return (
    <Layout>
      {pendingSwitch && (
        <UnsavedModal
          onSaveAndSwitch={handleSaveAndSwitch}
          onDiscardAndSwitch={() => applySwitch(pendingSwitch)}
          onCancel={() => setPendingSwitch(null)}
        />
      )}
      {resetTarget && (
        <ResetModal
          label={resetTarget.label}
          onConfirm={handleResetConfirm}
          onCancel={() => setResetTarget(null)}
        />
      )}

      <div className="flex items-center gap-2 mb-6 text-txt3 font-mono text-xs">
        <Link to="/events" className="hover:text-txt transition-colors">比賽列表</Link>
        <span>/</span>
        <Link to={`/events/${id}`} className="hover:text-txt transition-colors">{event.name}</Link>
        <span>/</span>
        <Link to={`/events/${id}/categories/${catId}`} className="hover:text-txt transition-colors">{category.name}</Link>
        <span>/</span>
        <span className="text-txt">裁判計分</span>
      </div>

      <div className="flex gap-3 flex-wrap items-end mb-6">
        <div className="flex-1 min-w-48">
          <label className="block font-mono text-[10px] tracking-widest uppercase text-txt3 mb-1.5">選手</label>
          <select value={selectedAthlete} onChange={e => handleAthleteChange(e.target.value)}>
            <option value="">-- 選擇選手 --</option>
            {athletes.map(a => (
              <option key={a.id} value={a.id}>
                {selectedRound !== 'qual' ? `#${a.startOrder} ` : ''}[{a.bib}] {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-32">
          <label className="block font-mono text-[10px] tracking-widest uppercase text-txt3 mb-1.5">輪次</label>
          <select value={selectedRound} onChange={e => handleRoundChange(e.target.value)}>
            {availableRounds.map(r => (
              <option key={r} value={r}>{ROUND_NAMES[r]}</option>
            ))}
          </select>
        </div>
        <div className="min-w-36">
          <label className="block font-mono text-[10px] tracking-widest uppercase text-txt3 mb-1.5">路線</label>
          <select value={selectedBoulder} onChange={e => setSelectedBoulder(e.target.value)}>
            <option value="all">顯示全部</option>
            {boulders.map(b => <option key={b.id} value={String(b.id)}>{b.label}</option>)}
          </select>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !selectedAthlete}
          className="bg-lime text-bg font-condensed font-bold text-xs tracking-widest uppercase px-5 py-[9px] rounded hover:bg-[#b5de25] transition-colors disabled:opacity-40"
        >
          {saving ? '儲存中...' : '💾 儲存成績'}
        </button>
      </div>

      {!selectedAthlete ? (
        <div className="text-txt3 font-mono text-center py-20">請先選擇選手</div>
      ) : (
        <div className="bg-s1 border border-border rounded-lg p-6">
          <div className="font-condensed font-bold text-sm tracking-widest uppercase text-lime mb-4">
            {selectedAthObj?.name} — {ROUND_NAMES[selectedRound]}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {boulders.filter(b => selectedBoulder === 'all' || String(b.id) === selectedBoulder).map(b => (
              <BoulderCard
                key={`${b.id}-${selectedAthlete}-${selectedRound}`}
                boulder={b}
                score={scores[b.id] || { top: false, zone: false, top_attempts: 0, zone_attempts: 0 }}
                onChange={newScore => handleScoreChange(b.id, newScore)}
                onReset={() => setResetTarget({ boulderId: b.id, label: b.label })}
                attempts={attemptCounts[b.id] || 0}
                onAttemptsChange={val => handleAttemptsChange(b.id, val)}
              />
            ))}
          </div>
        </div>
      )}
    </Layout>
  );
}
