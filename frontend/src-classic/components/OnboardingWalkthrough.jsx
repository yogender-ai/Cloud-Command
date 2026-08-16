import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Rocket, Globe, KeyRound, Timer, Server, LayoutDashboard, X, ChevronRight, ChevronLeft, Check
} from 'lucide-react';

const STORAGE_KEY = 'cc_onboarding_done';
const FORCE_KEY = 'cc_onboarding_force';

export function shouldShowOnboarding() {
  try {
    if (sessionStorage.getItem(FORCE_KEY) === '1') return true;
    return localStorage.getItem(STORAGE_KEY) !== '1';
  } catch {
    return false;
  }
}

export function markOnboardingDone() {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
    sessionStorage.removeItem(FORCE_KEY);
  } catch { /* ignore */ }
}

export function requestOnboarding() {
  try {
    sessionStorage.setItem(FORCE_KEY, '1');
  } catch { /* ignore */ }
}

const STEPS = [
  {
    id: 'welcome',
    icon: Rocket,
    title: 'Welcome to Cloud Command',
    body: 'Your unified DevOps command center. This short walkthrough shows what you can do after signup — in about a minute.',
    bullets: [
      'See stack health on Overview in one glance',
      'Monitor real URLs with latency & SSL checks',
      'Store API keys, run jobs, control Render & Vercel',
    ],
    cta: null,
  },
  {
    id: 'overview',
    icon: LayoutDashboard,
    title: 'Overview = mission control',
    body: 'The home page shows sites up/down, API token usage, platform visits, and live activity from your monitors.',
    bullets: [
      'Click any stat card to jump into that area',
      'Watch “Live activity” for status changes',
      'Use the palette icon to switch themes anytime',
    ],
    cta: { label: 'Open Overview', path: '/' },
  },
  {
    id: 'monitors',
    icon: Globe,
    title: 'Site Monitor — uptime & latency',
    body: 'Add production and staging URLs. Cloud Command pings them in the background and charts latency. Click a card for SSL inspect and visitor tracking.',
    bullets: [
      'Primary action: Add Monitor',
      'Filter by category (e.g. News-Intel, Production)',
      'Open Details → Uptime / Inspect / Visitors tabs',
    ],
    cta: { label: 'Go to Site Monitor', path: '/monitors' },
  },
  {
    id: 'jobs',
    icon: Timer,
    title: 'Scheduled Jobs — HTTP cron',
    body: 'Run protected HTTP tasks on an interval (ingest, enrich, webhooks) without paying for separate workers. Hit Run anytime for an immediate execution.',
    bullets: [
      'Create a blank job or use NewsIntel presets',
      'Secret header + JSON body supported',
      'Expand “Show last response” for debugging',
    ],
    cta: { label: 'Go to Scheduled Jobs', path: '/scheduled-jobs' },
  },
  {
    id: 'vault',
    icon: KeyRound,
    title: 'API Vault — encrypted keys',
    body: 'Store provider keys with Fernet encryption. Sensitive actions (add / reveal / delete) require email OTP. Group keys for load-balancing strategies.',
    bullets: [
      'Add Key → validate provider status',
      'Usage charts track tokens & errors',
      'Create groups: round-robin / fallback / random',
    ],
    cta: { label: 'Go to API Vault', path: '/api-keys' },
  },
  {
    id: 'platforms',
    icon: Server,
    title: 'Render & Vercel hubs',
    body: 'Connect platform tokens to list services/projects, trigger deploys, suspend/resume, and inspect env vars — without leaving Cloud Command.',
    bullets: [
      'Connect Account with a scoped API token',
      'Deploy / Redeploy from service or project detail',
      'Settings: notification email, password, gateway keys',
    ],
    cta: { label: 'Open Render Hub', path: '/render' },
  },
];

export default function OnboardingWalkthrough({ open, onClose }) {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const finish = () => {
    markOnboardingDone();
    onClose?.();
  };

  const skip = () => finish();

  const next = () => {
    if (isLast) finish();
    else setStep((s) => s + 1);
  };

  const prev = () => setStep((s) => Math.max(0, s - 1));

  const goCta = () => {
    if (current.cta?.path) {
      markOnboardingDone();
      onClose?.();
      navigate(current.cta.path);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="onboard-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => { if (e.target === e.currentTarget) skip(); }}
        >
          <motion.div
            className="onboard-panel"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span className="onboard-step-badge">
                Step {step + 1} of {STEPS.length}
              </span>
              <button type="button" className="btn btn-ghost btn-icon" onClick={skip} aria-label="Close walkthrough">
                <X size={18} />
              </button>
            </div>

            <div className="onboard-progress" aria-hidden>
              {STEPS.map((_, i) => (
                <i key={i} className={i === step ? 'active' : i < step ? 'done' : ''} />
              ))}
            </div>

            <div className="onboard-icon"><Icon size={24} /></div>
            <h2>{current.title}</h2>
            <p>{current.body}</p>
            <ul className="onboard-bullets">
              {current.bullets.map((b, i) => (
                <li key={i}><span>{i + 1}</span>{b}</li>
              ))}
            </ul>

            <div className="onboard-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={skip}>
                Skip tour
              </button>
              <div className="onboard-actions-right">
                {step > 0 && (
                  <button type="button" className="btn btn-secondary" onClick={prev}>
                    <ChevronLeft size={16} /> Back
                  </button>
                )}
                {current.cta && (
                  <button type="button" className="btn btn-secondary" onClick={goCta}>
                    {current.cta.label}
                  </button>
                )}
                <button type="button" className="btn btn-primary" onClick={next}>
                  {isLast ? <><Check size={16} /> Finish</> : <>Next <ChevronRight size={16} /></>}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
