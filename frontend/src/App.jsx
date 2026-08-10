import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { isLoggedIn } from './auth';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import SiteMonitor from './pages/SiteMonitor';
import ScheduledJobs from './pages/ScheduledJobs';
import ApiVault from './pages/ApiVault';
import RenderHub from './pages/RenderHub';
import VercelHub from './pages/VercelHub';
import SettingsPage from './pages/Settings';
import AnimatedBackground from './components/AnimatedBackground';
import OnboardingWalkthrough, {
  shouldShowOnboarding,
  requestOnboarding,
} from './components/OnboardingWalkthrough';

function ProtectedRoute({ children }) {
  return isLoggedIn() ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  return isLoggedIn() ? <Navigate to="/" replace /> : children;
}

function AppLayout({ children, onOpenTour }) {
  return (
    <div className="app-layout">
      <Sidebar onOpenTour={onOpenTour} />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    if (isLoggedIn() && shouldShowOnboarding()) {
      // slight delay so first paint completes
      const t = setTimeout(() => setTourOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  // Re-check when navigating after register (token just set)
  useEffect(() => {
    const onStorage = () => {
      if (isLoggedIn() && shouldShowOnboarding()) setTourOpen(true);
    };
    window.addEventListener('cc-onboarding-check', onStorage);
    return () => window.removeEventListener('cc-onboarding-check', onStorage);
  }, []);

  const openTour = () => {
    requestOnboarding();
    setTourOpen(true);
  };

  return (
    <>
      <Toaster theme="dark" richColors position="bottom-right" />
      <AnimatedBackground />
      <OnboardingWalkthrough open={tourOpen} onClose={() => setTourOpen(false)} />
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

        <Route path="/" element={<ProtectedRoute><AppLayout onOpenTour={openTour}><Dashboard /></AppLayout></ProtectedRoute>} />
        <Route path="/monitors" element={<ProtectedRoute><AppLayout onOpenTour={openTour}><SiteMonitor /></AppLayout></ProtectedRoute>} />
        <Route path="/scheduled-jobs" element={<ProtectedRoute><AppLayout onOpenTour={openTour}><ScheduledJobs /></AppLayout></ProtectedRoute>} />
        <Route path="/api-keys" element={<ProtectedRoute><AppLayout onOpenTour={openTour}><ApiVault /></AppLayout></ProtectedRoute>} />
        <Route path="/render" element={<ProtectedRoute><AppLayout onOpenTour={openTour}><RenderHub /></AppLayout></ProtectedRoute>} />
        <Route path="/vercel" element={<ProtectedRoute><AppLayout onOpenTour={openTour}><VercelHub /></AppLayout></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><AppLayout onOpenTour={openTour}><SettingsPage onOpenTour={openTour} /></AppLayout></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
