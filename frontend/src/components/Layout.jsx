import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-s1 border-b border-border px-7 h-14 flex items-center justify-between sticky top-0 z-50">
        <Link to="/events" className="font-condensed font-black text-xl tracking-widest uppercase text-lime">
          BLOC <sub className="text-[10px] tracking-widest text-txt3 font-mono font-normal align-middle ml-2">IFSC SCORING</sub>
        </Link>
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs text-txt3">{user?.username}</span>
          <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded border ${isAdmin ? 'border-lime/30 text-lime' : 'border-cyan/30 text-cyan'}`}>
            {isAdmin ? 'admin' : 'judge'}
          </span>
          <button
            onClick={handleLogout}
            className="font-condensed font-bold text-xs tracking-widest uppercase text-txt3 hover:text-txt transition-colors"
          >
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
