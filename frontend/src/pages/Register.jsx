import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Globe, KeyRound, Server } from 'lucide-react';
import { registerRequest } from '../api';
import { setToken } from '../auth';

const features = [
  { icon: Globe, label: 'Site Monitor', desc: 'Real-time uptime & latency tracking' },
  { icon: KeyRound, label: 'API Vault', desc: 'OTP-protected AI key management' },
  { icon: Server, label: 'Render & Vercel', desc: 'Full deployment control center' },
];

function PasswordStrength({ password }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const colors = ['', '#ef4444', '#f59e0b', '#10b981', '#6366f1'];
  const labels = ['', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  if (!password) return null;
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= score ? colors[score] : 'var(--border)', transition: 'background 0.3s' }} />
        ))}
      </div>
      <p style={{ fontSize: 11, color: colors[score] || 'var(--text-muted)' }}>{labels[score]}</p>
    </div>
  );
}

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      const data = await registerRequest(email, password);
      setToken(data.access_token);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-split">
      {/* Left Panel */}
      <div className="auth-left">
        <div className="auth-left-glow" />
        <div className="auth-left-content">
          <div className="auth-left-logo">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <text x="2" y="21" fontSize="20" fontWeight="900" fontFamily="monospace" fill="#fff">&gt;_</text>
            </svg>
          </div>
          <h1 className="auth-left-title">Cloud Command</h1>
          <p className="auth-left-sub">Join thousands of developers who trust Cloud Command to monitor their infrastructure.</p>
          <div className="auth-features">
            {features.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="auth-feature-item">
                <div className="auth-feature-icon"><Icon size={16} /></div>
                <div>
                  <div className="auth-feature-label">{label}</div>
                  <div className="auth-feature-desc">{desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="auth-blob auth-blob-1" />
          <div className="auth-blob auth-blob-2" />
        </div>
      </div>

      {/* Right Panel */}
      <div className="auth-right">
        <div className="auth-form-card animate-fade-in">
          <div className="auth-form-logo">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <text x="1" y="15" fontSize="14" fontWeight="900" fontFamily="monospace" fill="#fff">&gt;_</text>
            </svg>
          </div>
          <h2 className="auth-title">Create account</h2>
          <p className="auth-subtitle">Set up your DevOps command center</p>

          {error && <div className="auth-error">{error}</div>}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="form-input" placeholder="you@example.com" style={{ paddingLeft: 40 }} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input type={showPass ? 'text' : 'password'} required value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input" placeholder="Min 8 characters"
                  style={{ paddingLeft: 40, paddingRight: 40 }} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <PasswordStrength password={password} />
            </div>

            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input type="password" required value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="form-input" placeholder="Repeat password"
                  style={{ paddingLeft: 40, borderColor: confirm && password !== confirm ? 'var(--accent-rose)' : '' }} />
              </div>
              {confirm && password !== confirm && (
                <p style={{ fontSize: 12, color: 'var(--accent-rose)', marginTop: 4 }}>Passwords don't match</p>
              )}
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
              {loading ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Create Account'}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 16 }}>
            🔒 Enterprise-grade security
          </p>

          <div className="auth-footer">
            Already have an account? <Link to="/login">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
