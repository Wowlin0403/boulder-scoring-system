import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLE_LABEL = { superadmin: 'superadmin', organizer: 'organizer', judge: 'judge' };
const ROLE_STYLE = {
  superadmin: 'border-lime/30 text-lime',
  organizer: 'border-cyan/30 text-cyan',
  judge: 'border-purple-400/30 text-purple-400',
};

export default function Layout({ children }) {
  const { user, logout, isSuperadmin, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col">
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
