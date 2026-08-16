import { useCallback, useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { isLoggedIn } from './auth';
import Sidebar from './components/Sidebar';
import GateChrome from './components/GateChrome';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import GateHome from './pages/GateHome';
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
import { getShell, SHELL_EVENT } from './shellMode';

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

function GateLayout({ children, live }) {
  return (
    <div className="gate-app">
      <GateChrome live={live} />
      <main className="gate-main">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  const [tourOpen, setTourOpen] = useState(false);
  const [shell, setShellState] = useState(getShell);
  const [live, setLive] = useState(null);
  const onLive = useCallback((next) => setLive(next), []);

  useEffect(() => {
    const onChange = (event) => setShellState(event.detail || getShell());
    window.addEventListener(SHELL_EVENT, onChange);
    return () => window.removeEventListener(SHELL_EVENT, onChange);
  }, []);

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

        <Route path="/" element={<ProtectedRoute>{shell === 'classic' ? <AppLayout onOpenTour={openTour}><Dashboard /></AppLayout> : <GateLayout live={live}><GateHome onLive={onLive} /></GateLayout>}</ProtectedRoute>} />
        <Route path="/overview" element={<ProtectedRoute>{shell === 'classic' ? <AppLayout onOpenTour={openTour}><Dashboard /></AppLayout> : <GateLayout live={live}><Dashboard /></GateLayout>}</ProtectedRoute>} />
        <Route path="/monitors" element={<ProtectedRoute>{shell === 'classic' ? <AppLayout onOpenTour={openTour}><SiteMonitor /></AppLayout> : <GateLayout live={live}><SiteMonitor /></GateLayout>}</ProtectedRoute>} />
        <Route path="/scheduled-jobs" element={<ProtectedRoute>{shell === 'classic' ? <AppLayout onOpenTour={openTour}><ScheduledJobs /></AppLayout> : <GateLayout live={live}><ScheduledJobs /></GateLayout>}</ProtectedRoute>} />
        <Route path="/api-keys" element={<ProtectedRoute>{shell === 'classic' ? <AppLayout onOpenTour={openTour}><ApiVault /></AppLayout> : <GateLayout live={live}><ApiVault /></GateLayout>}</ProtectedRoute>} />
        <Route path="/render" element={<ProtectedRoute>{shell === 'classic' ? <AppLayout onOpenTour={openTour}><RenderHub /></AppLayout> : <GateLayout live={live}><RenderHub /></GateLayout>}</ProtectedRoute>} />
        <Route path="/vercel" element={<ProtectedRoute>{shell === 'classic' ? <AppLayout onOpenTour={openTour}><VercelHub /></AppLayout> : <GateLayout live={live}><VercelHub /></GateLayout>}</ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute>{shell === 'classic' ? <AppLayout onOpenTour={openTour}><SettingsPage onOpenTour={openTour} /></AppLayout> : <GateLayout live={live}><SettingsPage onOpenTour={openTour} /></GateLayout>}</ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
