import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastContainer } from './components/Toast';
import Login from './pages/Login';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import Setup from './pages/Setup';
import Athletes from './pages/Athletes';
import Scoring from './pages/Scoring';
import Ranking from './pages/Ranking';
import Export from './pages/Export';
import PublicRanking from './pages/PublicRanking';

function PrivateRoute({ children, adminOnly = false }) {
  const { user, isAdmin } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/events" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ToastContainer />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/events" element={<PrivateRoute><Events /></PrivateRoute>} />
          <Route path="/events/:id" element={<PrivateRoute><EventDetail /></PrivateRoute>} />
          <Route path="/events/:id/setup" element={<PrivateRoute adminOnly><Setup /></PrivateRoute>} />
          <Route path="/events/:id/athletes" element={<PrivateRoute adminOnly><Athletes /></PrivateRoute>} />
          <Route path="/events/:id/scoring" element={<PrivateRoute><Scoring /></PrivateRoute>} />
          <Route path="/events/:id/ranking" element={<PrivateRoute><Ranking /></PrivateRoute>} />
          <Route path="/events/:id/export" element={<PrivateRoute adminOnly><Export /></PrivateRoute>} />
          <Route path="/public/:id/ranking" element={<PublicRanking />} />
          <Route path="*" element={<Navigate to="/events" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
