import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, register } from './api';
import { KeyRound, ShieldCheck } from 'lucide-react';

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      if (isLogin) {
        const res = await login(username, password);
        localStorage.setItem('token', res.access_token);
        navigate('/');
      } else {
        await register(username, password);
        // After register, auto-login
        const res = await login(username, password);
        localStorage.setItem('token', res.access_token);
        navigate('/');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container flex items-center justify-center" style={{ minHeight: '100vh' }}>
      <div className="glass-panel animate-fade-in" style={{ padding: '40px', width: '100%', maxWidth: '400px' }}>
        <div className="flex flex-col items-center gap-4 mb-8">
          <div style={{ background: 'var(--primary-glow)', padding: '16px', borderRadius: '50%' }}>
            <ShieldCheck size={32} color="var(--primary)" />
          </div>
          <h2 className="gradient-text" style={{ fontSize: '24px' }}>Secure API Monitor</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center' }}>
            {isLogin ? 'Sign in to access your dashboard' : 'Create a secure admin account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col">
          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid var(--error)', padding: '12px', marginBottom: '20px', borderRadius: '4px', color: 'var(--error)', fontSize: '14px' }}>
              {error}
            </div>
          )}

          <div className="input-group">
            <label className="input-label">Username</label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label">Password</label>
            <input 
              type="password" 
              className="input-field" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ marginTop: '10px', width: '100%' }} disabled={loading}>
            {loading ? <div className="loader"></div> : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px', color: 'var(--text-muted)' }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button 
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: '500' }}>
            {isLogin ? 'Register now' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
