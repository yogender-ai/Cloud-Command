import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { isLoggedIn } from './auth';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import SiteMonitor from './pages/SiteMonitor';
import ApiVault from './pages/ApiVault';
import RenderHub from './pages/RenderHub';
import VercelHub from './pages/VercelHub';
import SettingsPage from './pages/Settings';
import AnimatedBackground from './components/AnimatedBackground';

function ProtectedRoute({ children }) {
  return isLoggedIn() ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  return isLoggedIn() ? <Navigate to="/" replace /> : children;
}

function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <>
      <Toaster theme="dark" richColors position="bottom-right" />
      <AnimatedBackground />
      <Routes>
        {/* Public */}
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

        {/* Protected with sidebar layout */}
        <Route path="/" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
        <Route path="/monitors" element={<ProtectedRoute><AppLayout><SiteMonitor /></AppLayout></ProtectedRoute>} />
        <Route path="/api-keys" element={<ProtectedRoute><AppLayout><ApiVault /></AppLayout></ProtectedRoute>} />
        <Route path="/render" element={<ProtectedRoute><AppLayout><RenderHub /></AppLayout></ProtectedRoute>} />
        <Route path="/vercel" element={<ProtectedRoute><AppLayout><VercelHub /></AppLayout></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><AppLayout><SettingsPage /></AppLayout></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
