import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.login(form);
      login(res.data.token, res.data.user);
      navigate('/events');
    } catch (err) {
      setError(err.response?.data?.error || '登入失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="font-condensed font-black text-3xl tracking-widest uppercase text-lime mb-1">BOULDER SCORE SYSTEM</div>
          <div className="font-mono text-xs tracking-widest text-txt3 uppercase">Design by W.C.</div>
        </div>

        <form onSubmit={handleSubmit} className="bg-s1 border border-border rounded-lg p-8 space-y-5">
          <div>
            <label className="block font-mono text-[10px] tracking-widest uppercase text-txt3 mb-1.5">帳號</label>
            <input
              type="text"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              placeholder="username"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="block font-mono text-[10px] tracking-widest uppercase text-txt3 mb-1.5">密碼</label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="password"
              required
            />
          </div>
          {error && <p className="text-red text-sm font-mono">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-lime text-bg font-condensed font-bold text-sm tracking-widest uppercase py-3 rounded hover:bg-[#b5de25] transition-colors disabled:opacity-50"
          >
            {loading ? '登入中...' : '登入'}
          </button>
        </form>

      </div>
    </div>
  );
}
