import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { publicAPI } from '../api';

const ROUND_NAMES = { qual: '資格賽', semi: '複賽', final: '決賽' };
const getRounds = (n) => n === 2 ? ['qual', 'final'] : ['qual', 'semi', 'final'].slice(0, n);
const REFRESH_SEC = 30;
const TIMER_CIRC = 75.4;

function calcScore(boulderScores) {
  if (!boulderScores) return 0;
  return boulderScores.reduce((sum, b) => {
    if (b.top) return sum + (25 - 0.1 * (b.top_attempts - 1));
    if (b.zone) return sum + (10 - 0.1 * (b.zone_attempts - 1));
    return sum;
  }, 0);
}

function BoulderCard({ b, compact }) {
  const topped = b.top > 0;
  const zoned = b.zone > 0;
  return (
    <div className="flex flex-col" style={{
      width: compact ? 28 : 36, height: compact ? 42 : 54,
      borderRadius: 6, overflow: 'hidden', border: '1px solid #3a3a3e',
    }}>
      <div className="flex-1 flex items-center justify-center font-mono font-bold border-b" style={{
        fontSize: compact ? 10 : 11,
        background: topped ? '#c8f135' : 'transparent',
        color: topped ? '#0d0d0f' : 'transparent',
        borderBottomColor: topped ? 'rgba(200,241,53,0.5)' : '#2a2a2e',
      }}>
        {topped ? b.top_attempts : ''}
      </div>
      <div className="flex-1 flex items-center justify-center font-mono font-bold" style={{
        fontSize: compact ? 10 : 11,
        background: zoned ? 'rgba(56,232,213,0.22)' : 'transparent',
        color: zoned ? '#38e8d5' : 'transparent',
      }}>
        {zoned ? b.zone_attempts : ''}
      </div>
    </div>
  );
}

function CutoffLine({ compact }) {
  return (
    <div className={`flex items-center gap-3 ${compact ? 'px-4 py-1' : 'px-5 py-1.5'}`}>
      <div className="flex-1 border-t-2 border-[#f5c542]/70" />
      <span className="font-mono text-xs font-bold text-[#f5c542] tracking-widest">晉級線</span>
      <div className="flex-1 border-t-2 border-[#f5c542]/70" />
    </div>
  );
}

function AthleteRow({ a, boulders, compact, badge }) {
  const score = calcScore(a.boulderScores);
  const hasScore = score > 0;
  return (
    <div className={`flex items-center border-b border-border/30 last:border-b-0 hover:bg-s2/50 transition-colors ${
      compact ? 'gap-3 px-4 py-2' : 'gap-5 px-5 py-3.5'
    }`}>
      {badge ? (
        <div className={`rounded-full flex items-center justify-center font-mono font-bold flex-shrink-0 ${
          compact ? 'w-7 h-7 text-xs' : 'w-8 h-8 text-sm'
        } ${
          a.rank === 1 ? 'bg-[#f5c542] text-[#0d0d0f]' :
          a.rank === 2 ? 'bg-[#a8a8b8] text-[#0d0d0f]' :
          a.rank === 3 ? 'bg-[#c87941] text-white' :
          'bg-s3 text-txt3'
        }`}>{a.rank}</div>
      ) : (
        <div className="font-mono font-bold text-xl text-txt w-8 text-center flex-shrink-0">{a.rank}</div>
      )}
      <div className="flex-1 min-w-0">
        <div className={`font-bold text-txt whitespace-nowrap overflow-hidden text-ellipsis ${compact ? 'text-sm' : 'text-[15px]'}`}>{a.name}</div>
        <div className={`font-mono text-txt3 mt-0.5 ${compact ? 'text-[10px]' : 'text-[11px]'}`}>{a.bib}</div>
      </div>
      <div className="flex gap-1 items-end flex-shrink-0">
        {boulders.map((b, i) => {
          const bs = a.boulderScores?.[i] || { boulder_id: b.id, top: 0, top_attempts: 0, zone: 0, zone_attempts: 0 };
          return (
            <div key={b.id} className="flex flex-col items-center gap-1">
              <BoulderCard b={bs} compact={compact} />
              <span className="font-mono text-[8px] text-txt3">{i + 1}</span>
            </div>
          );
        })}
      </div>
      <div className="font-condensed font-black text-right flex-shrink-0 leading-none" style={{
        color: hasScore ? '#e8e8ec' : '#5a5a6a',
        fontSize: hasScore ? (compact ? 20 : 26) : (compact ? 13 : 16),
        width: compact ? 48 : 64,
      }}>
        {hasScore ? score.toFixed(1) : '—'}
      </div>
    </div>
  );
}

export default function PublicRanking() {
  const { id } = useParams();

  // ── Data state ──────────────────────────────────────────────────────
  const [event, setEvent] = useState(null);
  const [categories, setCategories] = useState([]);
  const [ranking, setRanking] = useState(null);
  const [round, setRound] = useState('qual');
  const [activeCat, setActiveCat] = useState(null);
  const [countdown, setCountdown] = useState(REFRESH_SEC);
  const [updatedAt, setUpdatedAt] = useState(null);

  // ── Display state ───────────────────────────────────────────────────
  const [mode, setMode] = useState('carousel');
  const [pageSize, setPageSize] = useState(8);
  const [pageSec, setPageSec] = useState(6);
  const [perCol, setPerCol] = useState(16);
  const [currentPage, setCurrentPage] = useState(0);
  const [paused, setPaused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ── Refs ────────────────────────────────────────────────────────────
  const countdownRef = useRef(null);
  const tickRef = useRef(null);
  const progressRef = useRef(0);
  const timerRingRef = useRef(null);
  const pausedRef = useRef(false);

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // ── Data fetching ───────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([publicAPI.getEvent(id), publicAPI.getCategories(id)]).then(([ev, cl]) => {
      setEvent(ev.data);
      setCategories(cl.data);
      if (cl.data.length > 0) setActiveCat(cl.data[0].id);
    });
  }, [id]);

  const handleCatChange = (newCatId) => {
    const cat = categories.find(c => c.id === newCatId);
    if (!cat) return;
    const catRounds = getRounds(cat.rounds);
    setActiveCat(newCatId);
    if (!catRounds.includes(round)) setRound(catRounds[0]);
  };

  const loadRanking = useCallback(async () => {
    try {
      const res = await publicAPI.getRanking(id, round);
      setRanking(res.data);
      setUpdatedAt(new Date());
    } catch {}
  }, [id, round]);

  useEffect(() => { loadRanking(); }, [loadRanking]);
  useEffect(() => {
    const interval = setInterval(loadRanking, REFRESH_SEC * 1000);
    return () => clearInterval(interval);
  }, [loadRanking]);
  useEffect(() => {
    setCountdown(REFRESH_SEC);
    clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => setCountdown(c => c <= 1 ? REFRESH_SEC : c - 1), 1000);
    return () => clearInterval(countdownRef.current);
  }, [updatedAt]);

  // ── Derived ─────────────────────────────────────────────────────────
  const activeCatData = categories.find(c => c.id === activeCat);
  const catRounds = activeCatData ? getRounds(activeCatData.rounds) : ['qual'];
  const boulders = (ranking?.bouldersMap || {})[activeCat] || [];
  const catAthletes = useMemo(
    () => (ranking?.athletes || []).filter(a => String(a.category_id) === String(activeCat)),
    [ranking, activeCat]
  );
  const quota = (ranking?.quotas || {})[activeCat] || 0;
  const cutoffRank = quota > 0 && catAthletes.length >= quota ? catAthletes[quota - 1].rank : null;
  const totalPages = Math.max(1, Math.ceil(catAthletes.length / pageSize));
  const safePage = Math.min(currentPage, totalPages - 1);

  // ── Reset page on category / round change ───────────────────────────
  useEffect(() => {
    setCurrentPage(0);
    progressRef.current = 0;
    if (timerRingRef.current) timerRingRef.current.style.strokeDashoffset = '0';
  }, [activeCat, round]);

  // ── Carousel ticker ─────────────────────────────────────────────────
  useEffect(() => {
    clearInterval(tickRef.current);
    if (mode !== 'carousel') return;
    const total = Math.max(1, Math.ceil(catAthletes.length / pageSize));
    if (total <= 1) return;
    tickRef.current = setInterval(() => {
      if (pausedRef.current) return;
      progressRef.current += 100 / (pageSec * 10);
      if (progressRef.current >= 100) {
        progressRef.current = 0;
        setCurrentPage(p => (p + 1) % total);
      }
      if (timerRingRef.current) {
        timerRingRef.current.style.strokeDashoffset = `${TIMER_CIRC * (progressRef.current / 100)}`;
      }
    }, 100);
    return () => clearInterval(tickRef.current);
  }, [mode, pageSize, pageSec, catAthletes.length]);

  // Update ring colour when paused toggles
  useEffect(() => {
    if (timerRingRef.current) {
      timerRingRef.current.style.stroke = paused ? '#3a3a3e' : '#f5c542';
    }
  }, [paused]);

  const goToPage = (n) => {
    const total = Math.max(1, Math.ceil(catAthletes.length / pageSize));
    setCurrentPage(((n % total) + total) % total);
    progressRef.current = 0;
    if (timerRingRef.current) timerRingRef.current.style.strokeDashoffset = '0';
  };

  // ── Render helpers ───────────────────────────────────────────────────
  const renderCarousel = () => {
    const page = catAthletes.slice(safePage * pageSize, (safePage + 1) * pageSize);
    const padCount = pageSize - page.length;
    return (
      <div>
        {page.map((a, li) => {
          const gi = safePage * pageSize + li;
          const prevA = gi > 0 ? catAthletes[gi - 1] : null;
          const showCutoff = cutoffRank !== null && a.rank > cutoffRank && (!prevA || prevA.rank <= cutoffRank);
          return (
            <div key={a.id}>
              {showCutoff && <CutoffLine />}
              <AthleteRow a={a} boulders={boulders} />
            </div>
          );
        })}
        {Array.from({ length: padCount }, (_, i) => (
          <div key={`pad-${i}`} className="flex items-center gap-5 px-5 py-3.5 border-b border-border/30" style={{ visibility: 'hidden' }}>
            <div className="w-8 flex-shrink-0" />
            <div className="flex-1"><div className="text-[15px]">—</div></div>
            <div className="w-16 flex-shrink-0" />
          </div>
        ))}
      </div>
    );
  };

  const renderColumns = () => {
    const cols = [];
    for (let i = 0; i < catAthletes.length; i += perCol) cols.push(catAthletes.slice(i, i + perCol));
    if (!cols.length) cols.push([]);
    return (
      <div className="flex border-t border-border">
        {cols.map((col, ci) => {
          const startA = catAthletes[ci * perCol];
          const endA = catAthletes[Math.min((ci + 1) * perCol, catAthletes.length) - 1];
          const label = col.length > 0
            ? (startA.rank === endA.rank ? `第 ${startA.rank} 名` : `第 ${startA.rank}–${endA.rank} 名`)
            : '';
          let cutoffDone = false;
          return (
            <div key={ci} className="flex-1 border-r border-border last:border-r-0">
              <div className="px-4 py-1.5 bg-s2 border-b border-border font-mono text-[10px] text-txt3 tracking-widest uppercase">{label}</div>
              {col.map((a, li) => {
                const gi = ci * perCol + li;
                const prevA = gi > 0 ? catAthletes[gi - 1] : null;
                const showCutoff = !cutoffDone && cutoffRank !== null && a.rank > cutoffRank && (!prevA || prevA.rank <= cutoffRank);
                if (showCutoff) cutoffDone = true;
                return (
                  <div key={a.id}>
                    {showCutoff && <CutoffLine compact />}
                    <AthleteRow a={a} boulders={boulders} compact badge />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  const fmt = d => d
    ? d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    : '--:--:--';

  const wide = mode === 'columns' ? 'max-w-screen-xl' : 'max-w-screen-md';

  if (!event) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-txt3 font-mono text-sm tracking-widest">載入中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-txt flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <div className={`${wide} mx-auto flex items-center justify-between gap-4 flex-wrap`}>
          <div>
            <div className="font-condensed font-black text-2xl md:text-3xl tracking-wider text-lime leading-none">{event.name}</div>
            <div className="font-mono text-xs text-txt3 mt-1 tracking-widest">即時排名</div>
          </div>
          <div className="flex gap-1">
            {catRounds.map(r => (
              <button key={r} onClick={() => setRound(r)}
                className={`font-condensed font-bold text-sm tracking-widest uppercase px-4 py-2 rounded transition-colors ${
                  round === r ? 'bg-lime text-bg' : 'border border-border2 text-txt2 hover:border-txt2 hover:text-txt'
                }`}
              >{ROUND_NAMES[r]}</button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="font-mono text-xs text-txt3 text-right">
              <div>更新 {fmt(updatedAt)}</div>
              <div className="text-txt3/60">{countdown}s 後刷新</div>
            </div>
            <button onClick={loadRanking} className="border border-border2 text-txt2 font-mono text-xs px-3 py-2 rounded hover:border-txt2 hover:text-txt transition-colors">↻</button>
          </div>
        </div>
      </div>

      {/* Category tabs */}
      <div className="border-b border-border px-6">
        <div className={`${wide} mx-auto flex`}>
          {categories.map(c => (
            <button key={c.id} onClick={() => handleCatChange(c.id)}
              className="font-condensed font-bold text-sm tracking-widest uppercase px-5 py-3 flex items-center gap-2 transition-colors"
              style={{
                borderBottom: `3px solid ${activeCat === c.id ? c.color : 'transparent'}`,
                color: activeCat === c.id ? '#e8e8ec' : '#5a5a6a',
                marginBottom: -1,
              }}
            >
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Ranking */}
      <div className="flex-1 px-4 py-6">
        <div className={`${wide} mx-auto`}>
          {catAthletes.length === 0 ? (
            <div className="text-txt3 font-mono text-center py-24 text-sm tracking-widest">暫無排名資料</div>
          ) : (
            <div className="bg-s1 border border-border rounded-xl overflow-hidden">
              {activeCatData && (
                <div className="px-5 py-3 flex items-center gap-2" style={{
                  background: `${activeCatData.color}15`,
                  borderBottom: `1px solid ${activeCatData.color}28`,
                }}>
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: activeCatData.color }} />
                  <span className="font-condensed font-black text-lg tracking-widest uppercase">{activeCatData.name}</span>
                  <span className="font-mono text-xs text-txt3 ml-1">{catAthletes.length} 人</span>
                  {mode === 'carousel' && totalPages > 1 && (
                    <svg width="28" height="28" viewBox="0 0 32 32" className="ml-auto flex-shrink-0" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="16" cy="16" r="12" fill="none" stroke="#3a3a3e" strokeWidth="2.5" />
                      <circle ref={timerRingRef} cx="16" cy="16" r="12" fill="none"
                        stroke="#f5c542" strokeWidth="2.5"
                        strokeDasharray={TIMER_CIRC} strokeDashoffset="0"
                        style={{ transform: 'scaleX(-1)', transformOrigin: '16px 16px' }}
                      />
                    </svg>
                  )}
                </div>
              )}
              {mode === 'carousel' ? renderCarousel() : renderColumns()}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border/30 px-6 py-3 text-center">
        <span className="font-mono text-[10px] text-txt3/40 tracking-widest">IFSC BOULDER SCORING</span>
      </div>

      {/* Bottom-right controls */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
        {settingsOpen && (
          <div className="bg-s2 border border-border2 rounded-xl p-4 text-xs text-txt2 min-w-[190px] mb-2">
            <div className="font-mono text-[10px] tracking-widest uppercase text-txt3 mb-3">顯示設定</div>
            <label className="flex items-center justify-between gap-3 mb-2">
              <span>顯示方式</span>
              <select value={mode}
                onChange={e => { setMode(e.target.value); setCurrentPage(0); progressRef.current = 0; }}
                className="bg-s3 border border-border2 text-txt rounded px-1.5 py-0.5 text-xs cursor-pointer"
              >
                <option value="carousel">輪播</option>
                <option value="columns">分頁顯示</option>
              </select>
            </label>
            <hr className="border-border my-2" />
            {mode === 'carousel' ? (
              <>
                <label className="flex items-center justify-between gap-3 mb-2">
                  <span>每頁人數</span>
                  <input type="number" min="2" max="30" value={pageSize}
                    onChange={e => { setPageSize(parseInt(e.target.value) || 8); setCurrentPage(0); }}
                    className="w-14 bg-s3 border border-border2 text-txt rounded px-1.5 py-0.5 text-xs text-center"
                  />
                </label>
                <label className="flex items-center justify-between gap-3">
                  <span>換頁秒數</span>
                  <input type="number" min="2" max="30" value={pageSec}
                    onChange={e => setPageSec(parseInt(e.target.value) || 6)}
                    className="w-14 bg-s3 border border-border2 text-txt rounded px-1.5 py-0.5 text-xs text-center"
                  />
                </label>
              </>
            ) : (
              <label className="flex items-center justify-between gap-3">
                <span>每欄人數</span>
                <input type="number" min="2" max="30" value={perCol}
                  onChange={e => setPerCol(parseInt(e.target.value) || 16)}
                  className="w-14 bg-s3 border border-border2 text-txt rounded px-1.5 py-0.5 text-xs text-center"
                />
              </label>
            )}
          </div>
        )}
        <div className="flex gap-1.5 items-center">
          {mode === 'carousel' && totalPages > 1 && (
            <>
              <button onClick={() => goToPage(safePage - 1)}
                className="w-8 h-8 flex items-center justify-center bg-s3 border border-border2 text-txt2 text-base rounded-md hover:border-txt2 hover:text-txt transition-colors">‹</button>
              <button onClick={() => setPaused(p => !p)}
                className={`h-8 px-3 flex items-center gap-1.5 font-mono text-xs rounded-md border transition-colors ${
                  paused ? 'border-lime text-lime bg-s3' : 'border-border2 text-txt2 bg-s3 hover:border-txt2 hover:text-txt'
                }`}>{paused ? '▶ 繼續' : '⏸ 暫停'}</button>
              <button onClick={() => goToPage(safePage + 1)}
                className="w-8 h-8 flex items-center justify-center bg-s3 border border-border2 text-txt2 text-base rounded-md hover:border-txt2 hover:text-txt transition-colors">›</button>
            </>
          )}
          <button onClick={() => setSettingsOpen(o => !o)}
            className="h-8 px-2.5 font-mono text-[11px] tracking-widest bg-s3 border border-border2 text-txt2 rounded-md hover:border-txt2 hover:text-txt transition-colors">
            ⚙ 調整
          </button>
        </div>
      </div>
    </div>
  );
}
