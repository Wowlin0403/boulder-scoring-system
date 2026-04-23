import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { publicAPI } from '../api';

const ROUND_KEYS = ['qual', 'semi', 'final'];
const ROUND_NAMES = { qual: '資格賽', semi: '半決賽', final: '決賽' };
const REFRESH_SEC = 30;

function calcScore(boulderScores) {
  if (!boulderScores) return 0;
  return boulderScores.reduce((sum, b) => {
    if (b.top) return sum + (25 - 0.1 * (b.top_attempts - 1));
    if (b.zone) return sum + (10 - 0.1 * (b.zone_attempts - 1));
    return sum;
  }, 0);
}

function BoulderCard({ b }) {
  const topped = b.top > 0;
  const zoned = b.zone > 0;
  return (
    <div className="flex flex-col" style={{ width: 36, height: 54, borderRadius: 6, overflow: 'hidden', border: '1px solid #3a3a3e' }}>
      <div
        className="flex-1 flex items-center justify-center font-mono font-bold text-xs border-b"
        style={{
          background: topped ? '#c8f135' : 'transparent',
          color: topped ? '#0d0d0f' : 'transparent',
          borderBottomColor: topped ? 'rgba(200,241,53,0.5)' : '#2a2a2e',
        }}
      >
        {topped ? b.top_attempts : ''}
      </div>
      <div
        className="flex-1 flex items-center justify-center font-mono font-bold text-xs"
        style={{
          background: zoned ? 'rgba(56,232,213,0.22)' : 'transparent',
          color: zoned ? '#38e8d5' : 'transparent',
        }}
      >
        {zoned ? b.zone_attempts : ''}
      </div>
    </div>
  );
}

function AthleteRow({ a, boulders }) {
  const score = calcScore(a.boulderScores);
  const hasScore = score > 0;
  return (
    <div className="flex items-center gap-5 px-5 py-3.5 border-b border-border/50 last:border-b-0 hover:bg-s2/50 transition-colors">
      {/* Rank */}
      <div className="font-mono font-bold text-xl text-txt w-8 text-center flex-shrink-0">{a.rank}</div>

      {/* Identity */}
      <div className="flex-1 min-w-0">
        <div className="font-bold text-[15px] text-txt whitespace-nowrap overflow-hidden text-ellipsis">{a.name}</div>
        <div className="font-mono text-[11px] text-txt3 mt-0.5">{a.bib}</div>
      </div>

      {/* Boulder cards */}
      <div className="flex gap-1.5 items-end flex-shrink-0">
        {boulders.map((b, i) => {
          const bs = a.boulderScores?.[i] || { boulder_id: b.id, top: 0, top_attempts: 0, zone: 0, zone_attempts: 0 };
          return (
            <div key={b.id} className="flex flex-col items-center gap-1">
              <BoulderCard b={bs} />
              <span className="font-mono text-[9px] text-txt3">{i + 1}</span>
            </div>
          );
        })}
      </div>

      {/* Score */}
      <div
        className="font-condensed font-black text-[26px] w-16 text-right flex-shrink-0 leading-none"
        style={{ color: hasScore ? '#e8e8ec' : '#5a5a6a', fontSize: hasScore ? 26 : 16 }}
      >
        {hasScore ? score.toFixed(1) : '—'}
      </div>
    </div>
  );
}

export default function PublicRanking() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [categories, setCategories] = useState([]);
  const [ranking, setRanking] = useState(null);
  const [round, setRound] = useState('qual');
  const [activeCat, setActiveCat] = useState(null);
  const [countdown, setCountdown] = useState(REFRESH_SEC);
  const [updatedAt, setUpdatedAt] = useState(null);
  const countdownRef = useRef(null);

  useEffect(() => {
    Promise.all([publicAPI.getEvent(id), publicAPI.getCategories(id)]).then(([ev, cl]) => {
      setEvent(ev.data);
      setCategories(cl.data);
      if (cl.data.length > 0) setActiveCat(cl.data[0].id);
      setRound('qual');
    });
  }, [id]);

  const loadRanking = useCallback(async () => {
    try {
      const res = await publicAPI.getRanking(id, round);
      setRanking(res.data);
      setUpdatedAt(new Date());
    } catch {}
  }, [id, round]);

  // 初次載入 + round 切換時觸發
  useEffect(() => { loadRanking(); }, [loadRanking]);

  // 自動刷新：每 REFRESH_SEC 秒呼叫一次
  useEffect(() => {
    const interval = setInterval(loadRanking, REFRESH_SEC * 1000);
    return () => clearInterval(interval);
  }, [loadRanking]);

  // 倒數顯示：每次 updatedAt 更新後重設
  useEffect(() => {
    setCountdown(REFRESH_SEC);
    clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown(c => (c <= 1 ? REFRESH_SEC : c - 1));
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, [updatedAt]);

  if (!event) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-txt3 font-mono text-sm tracking-widest">載入中...</div>
      </div>
    );
  }

  const rounds = ROUND_KEYS.slice(0, event.rounds);
  const boulders = ranking?.boulders || [];
  const catAthletes = (ranking?.athletes || []).filter(a => String(a.category_id) === String(activeCat));
  const activeCatData = categories.find(c => c.id === activeCat);

  const fmt = d => d ? d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '--:--:--';

  return (
    <div className="min-h-screen bg-bg text-txt flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <div className="max-w-screen-md mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="font-condensed font-black text-2xl md:text-3xl tracking-wider text-lime leading-none">{event.name}</div>
            <div className="font-mono text-xs text-txt3 mt-1 tracking-widest">即時排名</div>
          </div>
          <div className="flex gap-1">
            {rounds.map(r => (
              <button
                key={r}
                onClick={() => setRound(r)}
                className={`font-condensed font-bold text-sm tracking-widest uppercase px-4 py-2 rounded transition-colors ${
                  round === r ? 'bg-lime text-bg' : 'border border-border2 text-txt2 hover:border-txt2 hover:text-txt'
                }`}
              >
                {ROUND_NAMES[r]}
              </button>
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
        <div className="max-w-screen-md mx-auto flex">
          {categories.map(c => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
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
        <div className="max-w-screen-md mx-auto">
          {catAthletes.length === 0 ? (
            <div className="text-txt3 font-mono text-center py-24 text-sm tracking-widest">暫無排名資料</div>
          ) : (
            <div className="bg-s1 border border-border rounded-xl overflow-hidden">
              {activeCatData && (
                <div
                  className="px-5 py-3 flex items-center gap-2"
                  style={{ background: `${activeCatData.color}15`, borderBottom: `1px solid ${activeCatData.color}28` }}
                >
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: activeCatData.color }} />
                  <span className="font-condensed font-black text-lg tracking-widest uppercase">{activeCatData.name}</span>
                  <span className="font-mono text-xs text-txt3 ml-1">{catAthletes.length} 人</span>
                </div>
              )}
              {catAthletes.map(a => (
                <AthleteRow key={a.id} a={a} boulders={boulders} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border/30 px-6 py-3 text-center">
        <span className="font-mono text-[10px] text-txt3/40 tracking-widest">IFSC BOULDER SCORING</span>
      </div>
    </div>
  );
}
