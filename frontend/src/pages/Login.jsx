import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Globe, KeyRound, Server } from 'lucide-react';
import { loginRequest } from '../api';
import { setToken } from '../auth';

const features = [
  { icon: Globe, label: 'Site Monitor', desc: 'Real-time uptime & latency tracking' },
  { icon: KeyRound, label: 'API Vault', desc: 'OTP-protected AI key management' },
  { icon: Server, label: 'Render & Vercel', desc: 'Full deployment control center' },
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await loginRequest(email, password);
      setToken(data.access_token);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed');
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
          <p className="auth-left-sub">Your unified DevOps command center. Monitor, manage, and deploy — all in one place.</p>
          <div className="auth-features">
            {features.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="auth-feature-item">
                <div className="auth-feature-icon">
                  <Icon size={16} />
                </div>
                <div>
                  <div className="auth-feature-label">{label}</div>
                  <div className="auth-feature-desc">{desc}</div>
                </div>
              </div>
            ))}
          </div>
          {/* Decorative animated blobs */}
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
          <h2 className="auth-title">Welcome back</h2>
          <p className="auth-subtitle">Sign in to your command center</p>

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
                  className="form-input" placeholder="••••••••"
                  style={{ paddingLeft: 40, paddingRight: 40 }} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
              {loading ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Sign In'}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 16 }}>
            🔒 Enterprise-grade security
          </p>

          <div className="auth-footer">
            Don't have an account? <Link to="/register">Create one</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
