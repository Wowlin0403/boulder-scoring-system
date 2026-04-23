import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';

const ROUND_KEYS = ['qual', 'semi', 'final'];
const ROUND_NAMES = { qual: '資格賽', semi: '半決賽', final: '決賽' };

export default function EventDetail() {
  const { id } = useParams();
  const { isAdmin } = useAuth();

  const navItems = [
    ...(isAdmin ? [{ to: `/events/${id}/setup`, label: '賽事設定' }] : []),
    ...(isAdmin ? [{ to: `/events/${id}/athletes`, label: '選手名單' }] : []),
    { to: `/events/${id}/scoring`, label: '裁判計分' },
    { to: `/events/${id}/ranking`, label: '即時排名' },
    ...(isAdmin ? [{ to: `/events/${id}/export`, label: '匯出成績' }] : []),
    { to: `/public/${id}/ranking`, label: '公開排名', external: true },
  ];

  return (
    <Layout>
      <div className="flex items-center gap-2 mb-6 text-txt3 font-mono text-xs">
        <Link to="/events" className="hover:text-txt transition-colors">比賽列表</Link>
        <span>/</span>
        <span className="text-txt">賽事總覽</span>
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
              <div className="text-txt3 font-mono text-xs mt-1">↗ 新分頁開啟</div>
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
              <div className="text-txt3 font-mono text-xs mt-1">→</div>
            </Link>
          )
        ))}
      </div>
    </Layout>
  );
}
