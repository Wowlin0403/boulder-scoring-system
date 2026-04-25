import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { eventsAPI } from '../api';
import { useAuth } from '../context/AuthContext';

export default function CategoryDetail() {
  const { id, catId } = useParams();
  const { isAdmin } = useAuth();
  const [event, setEvent] = useState(null);
  const [category, setCategory] = useState(null);

  useEffect(() => {
    Promise.all([eventsAPI.get(id), eventsAPI.getCategories(id)]).then(([ev, cl]) => {
      setEvent(ev.data);
      setCategory(cl.data.find(c => String(c.id) === String(catId)) || null);
    });
  }, [id, catId]);

  if (!event || !category) return <Layout><div className="text-txt3 font-mono py-16 text-center">載入中...</div></Layout>;

  const navItems = [
    ...(isAdmin ? [{ to: `/events/${id}/categories/${catId}/setup`, label: '組別設定', desc: '路線與賽制設定' }] : []),
    ...(isAdmin ? [{ to: `/events/${id}/categories/${catId}/athletes`, label: '選手名單', desc: '管理報名選手' }] : []),
    { to: `/events/${id}/categories/${catId}/scoring`, label: '裁判計分', desc: '即時輸入成績' },
    { to: `/events/${id}/categories/${catId}/ranking`, label: '即時排名', desc: '查看目前排名' },
    ...(isAdmin ? [{ to: `/events/${id}/categories/${catId}/export`, label: '匯出成績', desc: '下載 CSV' }] : []),
    { to: `/public/${id}/ranking`, label: '公開排名', desc: '觀眾顯示頁面', external: true },
  ];

  return (
    <Layout>
      <div className="flex items-center gap-2 mb-6 text-txt3 font-mono text-xs">
        <Link to="/events" className="hover:text-txt transition-colors">比賽列表</Link>
        <span>/</span>
        <Link to={`/events/${id}`} className="hover:text-txt transition-colors">{event.name}</Link>
        <span>/</span>
        <span className="text-txt">{category.name}</span>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: category.color }} />
        <div className="font-condensed font-black text-2xl tracking-widest uppercase" style={{ color: category.color }}>
          {category.name}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {navItems.map(item => (
          item.external ? (
            <a
              key={item.to}
              href={item.to}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-s1 border border-border hover:border-cyan rounded-lg p-6 transition-colors group"
            >
              <div className="font-condensed font-bold text-xl tracking-widest uppercase text-txt group-hover:text-cyan transition-colors">
                {item.label}
              </div>
              <div className="text-txt3 font-mono text-xs mt-1">{item.desc} ↗</div>
            </a>
          ) : (
            <Link
              key={item.to}
              to={item.to}
              className="bg-s1 border border-border hover:border-lime rounded-lg p-6 transition-colors group"
            >
              <div className="font-condensed font-bold text-xl tracking-widest uppercase text-txt group-hover:text-lime transition-colors">
                {item.label}
              </div>
              <div className="text-txt3 font-mono text-xs mt-1">{item.desc}</div>
            </Link>
          )
        ))}
      </div>
    </Layout>
  );
}
