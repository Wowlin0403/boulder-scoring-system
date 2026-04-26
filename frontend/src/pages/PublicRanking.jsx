import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { publicAPI } from '../api';

const ROUND_NAMES = { qual: '資格賽', semi: '複賽', final: '決賽' };
const getRounds = (n) => n === 2 ? ['qual', 'final'] : ['qual', 'semi', 'final'].slice(0, n);
const REFRESH_SEC = 30;
const TIMER_CIRC = 75.4;

const THEMES = [
  {
    id: 'default', label: '預設',
    swatches: { dark: ['#0a0c10','#1f2433','#4a5a6e','#7a8fa8','#c8f135'], light: ['#dde6f0','#b8c8d8','#7a8fa8','#2e3a50','#3a7000'] },
    dark:  { '--bg':'#0a0c10','--s1':'#111318','--s2':'#181c24','--s3':'#1f2433','--border':'#252d3d','--border2':'#2e3a50','--txt':'#dde6f0','--txt2':'#7a8fa8','--txt3':'#4a5a6e','--cyan':'#38e8d5','--gold':'#f5c542','--theme':'#c8f135' },
    light: { '--bg':'#dde6f0','--s1':'#cdd6e2','--s2':'#bdc6d4','--s3':'#adb6c6','--border':'#7a8fa8','--border2':'#5a6f88','--txt':'#0a0c10','--txt2':'#2e3a50','--txt3':'#4a5a6e','--cyan':'#0a7a6e','--gold':'#c48a00','--theme':'#3a7000' },
  },
  {
    id: 'dusk', label: '薄暮珊瑚',
    swatches: { dark: ['#1e1f35','#3d3e5c','#7a6e7e','#b0a0aa','#ede3df'], light: ['#ede3df','#c4a49a','#8a7d90','#404870','#1e1f35'] },
    dark:  { '--bg':'#1e1f35','--s1':'#272840','--s2':'#31324e','--s3':'#3d3e5c','--border':'#4a4b6a','--border2':'#5c5d7e','--txt':'#ede3df','--txt2':'#b0a0aa','--txt3':'#7a6e7e','--cyan':'#c4a49a','--gold':'#f5c542','--theme':'#ede3df' },
    light: { '--bg':'#ede3df','--s1':'#e0d4ce','--s2':'#d0c4be','--s3':'#c4a49a','--border':'#b09088','--border2':'#8a7d90','--txt':'#1e1f35','--txt2':'#404870','--txt3':'#6a6080','--cyan':'#6a5d70','--gold':'#b07800','--theme':'#404870' },
  },
  {
    id: 'jungle', label: '熱帶叢林',
    swatches: { dark: ['#182820','#305848','#638870','#9dc0a8','#e5f0e0'], light: ['#e5f0e0','#9dc0a8','#638870','#305848','#1a5040'] },
    dark:  { '--bg':'#182820','--s1':'#203028','--s2':'#283830','--s3':'#304038','--border':'#305848','--border2':'#406858','--txt':'#e5f0e0','--txt2':'#9dc0a8','--txt3':'#638870','--cyan':'#6ab898','--gold':'#f5c542','--theme':'#9dc0a8' },
    light: { '--bg':'#e5f0e0','--s1':'#d5e0d5','--s2':'#c0d0c8','--s3':'#9dc0a8','--border':'#638870','--border2':'#406858','--txt':'#182820','--txt2':'#305848','--txt3':'#507060','--cyan':'#2a7060','--gold':'#a07000','--theme':'#1f5040' },
  },
  {
    id: 'desert', label: '沙漠日落',
    swatches: { dark: ['#200c08','#7a2a10','#c05020','#e88840','#f5d080'], light: ['#faecc8','#e8c880','#c07030','#7a2a10','#7a2800'] },
    dark:  { '--bg':'#200c08','--s1':'#2c1408','--s2':'#382010','--s3':'#502c10','--border':'#7a2a10','--border2':'#983c20','--txt':'#f5d080','--txt2':'#e88840','--txt3':'#c05020','--cyan':'#e8a050','--gold':'#f5c542','--theme':'#e88840' },
    light: { '--bg':'#faecc8','--s1':'#f2dca8','--s2':'#e8c888','--s3':'#d89840','--border':'#b86020','--border2':'#883010','--txt':'#200c08','--txt2':'#7a2a10','--txt3':'#a04020','--cyan':'#906020','--gold':'#806000','--theme':'#7a2800' },
  },
  {
    id: 'nordic', label: '北歐冬雪',
    swatches: { dark: ['#20283c','#404e62','#8898a8','#c8cede','#f2f4f8'], light: ['#f2f4f8','#c8cede','#8898a8','#404e62','#2a4080'] },
    dark:  { '--bg':'#20283c','--s1':'#28324c','--s2':'#303c58','--s3':'#404e62','--border':'#485870','--border2':'#5a6c80','--txt':'#f2f4f8','--txt2':'#c8cede','--txt3':'#8898a8','--cyan':'#a0b8d8','--gold':'#f5c542','--theme':'#c8cede' },
    light: { '--bg':'#f2f4f8','--s1':'#e0e4ec','--s2':'#ccd4e0','--s3':'#b0b8c8','--border':'#8898a8','--border2':'#607080','--txt':'#20283c','--txt2':'#404e62','--txt3':'#5a6e80','--cyan':'#205888','--gold':'#b07800','--theme':'#2a4080' },
  },
  {
    id: 'ocean', label: '深海藍調',
    swatches: { dark: ['#041428','#083a88','#2888c8','#70c0e8','#c0e8f8'], light: ['#e0f2f8','#70c0e8','#2888c8','#083a88','#083080'] },
    dark:  { '--bg':'#041428','--s1':'#081c38','--s2':'#0c2848','--s3':'#103460','--border':'#083a88','--border2':'#1458a8','--txt':'#c0e8f8','--txt2':'#70c0e8','--txt3':'#2888c8','--cyan':'#70c0e8','--gold':'#f5c542','--theme':'#70c0e8' },
    light: { '--bg':'#e0f2f8','--s1':'#c8e4f2','--s2':'#a8d4ec','--s3':'#70c0e8','--border':'#2888c8','--border2':'#085898','--txt':'#041428','--txt2':'#083a88','--txt3':'#0f5898','--cyan':'#0050a0','--gold':'#b07800','--theme':'#083080' },
  },
  {
    id: 'maple', label: '秋楓紅葉',
    swatches: { dark: ['#381000','#803000','#c07028','#e0a050','#f8e0b0'], light: ['#faecc8','#d89840','#c07028','#803000','#601800'] },
    dark:  { '--bg':'#381000','--s1':'#481800','--s2':'#582000','--s3':'#783010','--border':'#803000','--border2':'#a04818','--txt':'#f8e0b0','--txt2':'#e0a050','--txt3':'#c07028','--cyan':'#e0a050','--gold':'#f5c542','--theme':'#e0a050' },
    light: { '--bg':'#faecc8','--s1':'#f2dca8','--s2':'#e8c888','--s3':'#d89840','--border':'#b07030','--border2':'#803010','--txt':'#381000','--txt2':'#803000','--txt3':'#a84820','--cyan':'#884020','--gold':'#805000','--theme':'#601800' },
  },
  {
    id: 'lavender', label: '薰衣草田',
    swatches: { dark: ['#180838','#402890','#8860c0','#c898e8','#ece0f8'], light: ['#ece0f8','#c898e8','#8860c0','#402890','#3018a0'] },
    dark:  { '--bg':'#180838','--s1':'#201050','--s2':'#281860','--s3':'#382878','--border':'#402890','--border2':'#5838a8','--txt':'#ece0f8','--txt2':'#c898e8','--txt3':'#8860c0','--cyan':'#c898e8','--gold':'#f5c542','--theme':'#c898e8' },
    light: { '--bg':'#ece0f8','--s1':'#dfd0f0','--s2':'#d0c0e8','--s3':'#c898e8','--border':'#8860c0','--border2':'#5838a8','--txt':'#180838','--txt2':'#402890','--txt3':'#6040a8','--cyan':'#4838a0','--gold':'#906000','--theme':'#3018a0' },
  },
  {
    id: 'rose', label: '玫瑰香橙',
    swatches: { dark: ['#400818','#901848','#d06080','#f0a090','#fad8c8'], light: ['#fce8e0','#f0a090','#d06080','#901848','#780028'] },
    dark:  { '--bg':'#400818','--s1':'#501028','--s2':'#601838','--s3':'#782048','--border':'#901848','--border2':'#b02858','--txt':'#fad8c8','--txt2':'#f0a090','--txt3':'#d06080','--cyan':'#f0a090','--gold':'#f5c542','--theme':'#f0a090' },
    light: { '--bg':'#fce8e0','--s1':'#f4d8d0','--s2':'#ecc8b8','--s3':'#f0a090','--border':'#d06080','--border2':'#901848','--txt':'#400818','--txt2':'#901848','--txt3':'#b03060','--cyan':'#a03060','--gold':'#a06000','--theme':'#780028' },
  },
  {
    id: 'obsidian', label: '黑曜閃電',
    swatches: { dark: ['#181a28','#383c58','#707888','#9aa0a8','#b090d0'], light: ['#e0e4e8','#9aa0a8','#8888c0','#58c0b0','#6040b0'] },
    dark:  { '--bg':'#181a28','--s1':'#202438','--s2':'#2c3048','--s3':'#383c58','--border':'#484870','--border2':'#606490','--txt':'#e0e4e8','--txt2':'#9aa0a8','--txt3':'#707888','--cyan':'#58c0b0','--gold':'#f5c542','--theme':'#b090d0' },
    light: { '--bg':'#e0e4e8','--s1':'#d0d4dc','--s2':'#c0c4d0','--s3':'#9aa0a8','--border':'#8888c0','--border2':'#606498','--txt':'#181a28','--txt2':'#383c58','--txt3':'#585c78','--cyan':'#388078','--gold':'#b07800','--theme':'#6040b0' },
  },
  {
    id: 'parrot', label: '熱帶鸚鵡',
    swatches: { dark: ['#181c20','#383c48','#c07888','#f090a0','#f0e060'], light: ['#fff0f4','#f0a0b0','#d07080','#702050','#d02060'] },
    dark:  { '--bg':'#181c20','--s1':'#202428','--s2':'#2c3038','--s3':'#383c48','--border':'#484c60','--border2':'#585c70','--txt':'#f8f0f0','--txt2':'#f090a0','--txt3':'#c07888','--cyan':'#90d090','--gold':'#f0e060','--theme':'#f090a0' },
    light: { '--bg':'#fff0f4','--s1':'#f8e0e8','--s2':'#f0d0d8','--s3':'#f0a0b0','--border':'#d07080','--border2':'#b05870','--txt':'#201020','--txt2':'#702050','--txt3':'#a06080','--cyan':'#308850','--gold':'#c08000','--theme':'#d02060' },
  },
];

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return `${parseInt(h.slice(0,2),16)} ${parseInt(h.slice(2,4),16)} ${parseInt(h.slice(4,6),16)}`;
}

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
      borderRadius: 6, overflow: 'hidden',
      border: '1px solid rgb(var(--border))',
    }}>
      <div className="flex-1 flex items-center justify-center font-mono font-bold border-b" style={{
        fontSize: compact ? 10 : 11,
        background: topped ? 'rgb(var(--theme))' : 'transparent',
        color: topped ? 'rgb(var(--bg))' : 'transparent',
        borderBottomColor: topped ? 'rgb(var(--theme) / 0.5)' : 'rgb(var(--border))',
      }}>
        {topped ? b.top_attempts : ''}
      </div>
      <div className="flex-1 flex items-center justify-center font-mono font-bold" style={{
        fontSize: compact ? 10 : 11,
        background: zoned ? 'rgb(var(--cyan) / 0.2)' : 'transparent',
        color: zoned ? 'rgb(var(--cyan))' : 'transparent',
      }}>
        {zoned ? b.zone_attempts : ''}
      </div>
    </div>
  );
}

function CutoffLine({ compact }) {
  return (
    <div className={`flex items-center gap-3 ${compact ? 'px-4 py-1' : 'px-5 py-1.5'}`}>
      <div className="flex-1 border-t-2" style={{ borderColor: 'rgb(var(--gold) / 0.7)' }} />
      <span className="font-mono text-xs font-bold tracking-widest" style={{ color: 'rgb(var(--gold))' }}>晉級線</span>
      <div className="flex-1 border-t-2" style={{ borderColor: 'rgb(var(--gold) / 0.7)' }} />
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
        } bg-s3 text-txt3`}>{a.rank}</div>
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
        color: hasScore ? 'rgb(var(--txt))' : 'rgb(var(--txt3))',
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

  // ── Theme state ─────────────────────────────────────────────────────
  const [selectedThemeId, setSelectedThemeId] = useState('default');
  const [isDark, setIsDark] = useState(true);
  const [themeOpen, setThemeOpen] = useState(false);

  // ── Refs ────────────────────────────────────────────────────────────
  const countdownRef = useRef(null);
  const tickRef = useRef(null);
  const progressRef = useRef(0);
  const timerRingRef = useRef(null);
  const pausedRef = useRef(false);
  const themeRef = useRef(null);
  const themeBtnRef = useRef(null);

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // ── Click-outside for theme panel ───────────────────────────────────
  useEffect(() => {
    if (!themeOpen) return;
    const handler = (e) => {
      if (
        themeRef.current && !themeRef.current.contains(e.target) &&
        themeBtnRef.current && !themeBtnRef.current.contains(e.target)
      ) setThemeOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [themeOpen]);

  // ── Apply theme to document root (synchronous, before paint) ────────
  useLayoutEffect(() => {
    const t = THEMES.find(t => t.id === selectedThemeId) || THEMES[0];
    const vars = isDark ? t.dark : t.light;
    Object.entries(vars).forEach(([k, v]) => {
      document.documentElement.style.setProperty(k, hexToRgb(v));
    });
    return () => {
      Object.keys(vars).forEach(k => document.documentElement.style.removeProperty(k));
    };
  }, [selectedThemeId, isDark]);

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

  useEffect(() => {
    if (timerRingRef.current) {
      timerRingRef.current.style.stroke = paused ? 'rgb(var(--border2))' : 'rgb(var(--gold))';
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
    const pageStart = safePage * pageSize;
    const page = catAthletes.slice(pageStart, pageStart + pageSize);
    const padCount = pageSize - page.length;
    const pageEnd = pageStart + page.length;

    // 晉級線剛好落在本頁末尾時（quota === pageEnd），在 placeholder 前顯示，下一頁起始不再重複
    const showCutoffAtEnd = cutoffRank !== null && quota < catAthletes.length && quota === pageEnd;

    return (
      <div>
        {page.map((a, li) => {
          const gi = pageStart + li;
          const prevA = gi > 0 ? catAthletes[gi - 1] : null;
          // 若晉級線已在上一頁末尾顯示，本頁首位不重複
          const skipBoundary = gi === quota && gi === pageStart;
          const showCutoff = !skipBoundary && cutoffRank !== null && a.rank > cutoffRank && (!prevA || prevA.rank <= cutoffRank);
          return (
            <div key={a.id}>
              {showCutoff && <CutoffLine />}
              <AthleteRow a={a} boulders={boulders} />
            </div>
          );
        })}
        {showCutoffAtEnd && <CutoffLine />}
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
  const isCustomTheme = selectedThemeId !== 'default' || !isDark;

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
                color: activeCat === c.id ? 'rgb(var(--txt))' : 'rgb(var(--txt3))',
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
                      <circle cx="16" cy="16" r="12" fill="none" style={{ stroke: 'rgb(var(--border))' }} strokeWidth="2.5" />
                      <circle ref={timerRingRef} cx="16" cy="16" r="12" fill="none"
                        strokeWidth="2.5"
                        strokeDasharray={TIMER_CIRC} strokeDashoffset="0"
                        style={{ stroke: 'rgb(var(--gold))', transform: 'scaleX(-1)', transformOrigin: '16px 16px' }}
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
        {themeOpen && (
          <div ref={themeRef} className="bg-s2 border border-border2 rounded-xl p-4 text-xs text-txt2 w-[280px] mb-2">
            <div className="font-mono text-[10px] tracking-widest uppercase text-txt3 mb-3">選擇主題</div>
            <div className="grid grid-cols-2 gap-1.5 mb-3">
              {THEMES.map(t => {
                const active = selectedThemeId === t.id;
                const sw = isDark ? t.swatches.dark : t.swatches.light;
                return (
                  <button key={t.id} onClick={() => setSelectedThemeId(t.id)}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-colors text-left ${
                      active ? 'border-lime/50 bg-lime/10 text-lime' : 'border-transparent text-txt2 hover:border-border2 hover:bg-s3'
                    }`}>
                    <div className="flex gap-0.5 flex-shrink-0">
                      {sw.map((c, i) => (
                        <span key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                      ))}
                    </div>
                    <span className="font-mono text-[10px] truncate">{t.label}</span>
                  </button>
                );
              })}
            </div>
            <hr className="border-border mb-3" />
            <button onClick={() => setIsDark(d => !d)}
              className="w-full py-1.5 font-mono text-[11px] tracking-widest border border-border2 text-txt2 rounded hover:border-txt2 hover:text-txt transition-colors">
              {isDark ? '☀ 切換淺色' : '🌙 切換深色'}
            </button>
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
          <button onClick={() => { setSettingsOpen(o => !o); setThemeOpen(false); }}
            className="h-8 px-2.5 font-mono text-[11px] tracking-widest bg-s3 border border-border2 text-txt2 rounded-md hover:border-txt2 hover:text-txt transition-colors">
            ⚙ 調整
          </button>
          <button ref={themeBtnRef} onClick={(e) => { e.stopPropagation(); setThemeOpen(o => !o); setSettingsOpen(false); }}
            className={`h-8 px-2.5 font-mono text-[11px] tracking-widest bg-s3 border rounded-md transition-colors ${
              isCustomTheme ? 'border-lime text-lime' : 'border-border2 text-txt2 hover:border-txt2 hover:text-txt'
            }`}>
            ◐ 主題
          </button>
        </div>
      </div>
    </div>
  );
}
