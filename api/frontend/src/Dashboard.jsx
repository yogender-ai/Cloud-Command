import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getKeys, addKey, deleteKey, checkKey, getUsageSummary } from './api';
import { Plus, LogOut, Key, CheckCircle, XCircle, AlertCircle, RefreshCw, Trash2, Shield, Activity, BarChart3, Zap } from 'lucide-react';
import UsageCharts from './UsageCharts';

const PROVIDERS = ['OpenAI', 'Anthropic', 'HuggingFace', 'Gemini', 'DeepSeek', 'Other'];

const Dashboard = () => {
  const [keys, setKeys] = useState([]);
  const [usageSummary, setUsageSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newKey, setNewKey] = useState({ name: '', provider: 'OpenAI', key_value: '' });
  const [adding, setAdding] = useState(false);
  
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      setLoading(true);
      const [keysData, summaryData] = await Promise.all([
        getKeys(),
        getUsageSummary()
      ]);
      setKeys(keysData);
      setUsageSummary(summaryData);
    } catch (err) {
      setError('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const handleAddKey = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      await addKey(newKey);
      setIsModalOpen(false);
      setNewKey({ name: '', provider: 'OpenAI', key_value: '' });
      fetchData();
    } catch (err) {
      alert(err.message || 'Failed to add key');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this key?')) return;
    try {
      await deleteKey(id);
      fetchData();
    } catch (err) {
      alert('Failed to delete key');
    }
  };

  const handleCheck = async (id) => {
    try {
      await checkKey(id);
      fetchData(); // refresh list and charts
    } catch (err) {
      alert('Failed to check key');
    }
  };
  
  const handleCheckAll = async () => {
    const promises = keys.map(k => checkKey(k.id).catch(() => null));
    await Promise.all(promises);
    fetchData();
  };

  const getStatusBadge = (status) => {
    const s = status.toLowerCase();
    if (s.includes('active')) return <span className="badge badge-active flex items-center gap-1"><CheckCircle size={12}/> Active</span>;
    if (s.includes('invalid')) return <span className="badge badge-invalid flex items-center gap-1"><XCircle size={12}/> Invalid</span>;
    if (s.includes('suspend') || s.includes('rate') || s.includes('balance')) return <span className="badge badge-suspended flex items-center gap-1"><AlertCircle size={12}/> {status}</span>;
    return <span className="badge badge-unknown">{status}</span>;
  };

  return (
    <div className="container" style={{ padding: '40px 24px' }}>
      <header className="flex justify-between items-center" style={{ marginBottom: '48px' }}>
        <div className="flex items-center gap-4">
          <div style={{ background: 'var(--primary-glow)', padding: '12px', borderRadius: '12px' }}>
            <Shield size={28} color="var(--primary)" />
          </div>
          <div>
            <h1 className="gradient-text">API Vault</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Securely monitor and validate your AI keys.</p>
          </div>
        </div>
        <div className="flex gap-4">
          <button className="btn btn-secondary" onClick={handleCheckAll} title="Refresh All Statuses">
            <RefreshCw size={18} /> Refresh All
          </button>
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={18} /> Add Key
          </button>
          <button className="btn btn-secondary" onClick={handleLogout} style={{ padding: '12px', borderColor: 'var(--border-color)', color: 'var(--error)' }}>
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {loading && !keys.length ? (
        <div className="flex justify-center items-center" style={{ minHeight: '300px' }}>
          <div className="loader"></div>
        </div>
      ) : error ? (
        <div style={{ color: 'var(--error)', textAlign: 'center' }}>{error}</div>
      ) : (
        <>
          {/* Statistics Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px', marginBottom: '40px' }}>
            <div className="card flex items-center gap-4" style={{ padding: '20px' }}>
              <div style={{ background: 'rgba(59,130,246,0.1)', padding: '12px', borderRadius: '10px' }}>
                <Key size={20} color="#3b82f6" />
              </div>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Total Keys</p>
                <h2 style={{ fontSize: '24px', margin: 0 }}>{usageSummary?.total_keys || 0}</h2>
              </div>
            </div>
            <div className="card flex items-center gap-4" style={{ padding: '20px' }}>
              <div style={{ background: 'rgba(16,185,129,0.1)', padding: '12px', borderRadius: '10px' }}>
                <Activity size={20} color="#10b981" />
              </div>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Active Now</p>
                <h2 style={{ fontSize: '24px', margin: 0 }}>{usageSummary?.active_keys || 0}</h2>
              </div>
            </div>
            <div className="card flex items-center gap-4" style={{ padding: '20px' }}>
              <div style={{ background: 'rgba(139,92,246,0.1)', padding: '12px', borderRadius: '10px' }}>
                <Zap size={20} color="#8b5cf6" />
              </div>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Tokens Used Today</p>
                <h2 style={{ fontSize: '24px', margin: 0 }}>{(usageSummary?.tokens_today || 0).toLocaleString()}</h2>
              </div>
            </div>
          </div>

          {/* Usage Chart */}
          {usageSummary?.usage_history && (
            <UsageCharts data={usageSummary.usage_history} />
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
            {keys.length === 0 ? (
              <div className="glass-panel items-center justify-center flex-col flex" style={{ padding: '60px', gridColumn: '1 / -1', border: '1px dashed var(--border-hover)' }}>
                <Key size={48} color="var(--text-muted)" style={{ marginBottom: '16px' }} />
                <h3 style={{ marginBottom: '8px' }}>No API Keys Found</h3>
                <p style={{ color: 'var(--text-secondary)' }}>Click 'Add Key' to start monitoring.</p>
              </div>
            ) : keys.map(key => (
              <div key={key.id} className="card animate-fade-in flex flex-col" style={{ padding: '24px' }}>
                <div className="flex justify-between items-start" style={{ marginBottom: '20px' }}>
                  <div>
                    <h3 style={{ fontSize: '18px', marginBottom: '4px' }}>{key.name}</h3>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {key.provider}
                    </div>
                  </div>
                  {getStatusBadge(key.status)}
                </div>
                
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', fontFamily: 'monospace', color: 'var(--text-secondary)', marginBottom: '24px', flexGrow: 1, display: 'flex', alignItems: 'center' }}>
                  <Key size={14} style={{ marginRight: '8px', opacity: 0.5 }} />
                  {key.masked_key}
                </div>
                
                <div className="flex justify-between items-center mt-auto" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: 'auto' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Checked: {new Date(key.last_checked).toLocaleString()}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleCheck(key.id)} className="btn" style={{ padding: '8px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)' }} title="Check Validity">
                      <RefreshCw size={16} />
                    </button>
                    <button onClick={() => handleDelete(key.id)} className="btn" style={{ padding: '8px', background: 'rgba(239,68,68,0.1)', color: 'var(--error)' }} title="Delete Key">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '24px' }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '450px', padding: '32px' }}>
            <h2 className="gradient-text" style={{ marginBottom: '24px' }}>Add Security Key</h2>
            <form onSubmit={handleAddKey}>
              <div className="input-group">
                <label className="input-label">Key Name (e.g. Prod Work)</label>
                <input required value={newKey.name} onChange={(e) => setNewKey({...newKey, name: e.target.value})} className="input-field" placeholder="My awesome key" />
              </div>
              <div className="input-group">
                <label className="input-label">Provider</label>
                <select 
                  className="input-field" 
                  value={newKey.provider} 
                  onChange={(e) => setNewKey({...newKey, provider: e.target.value})}
                  style={{ appearance: 'none', background: '#1a1a24' }} 
                >
                  {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">API Key Secret</label>
                <input required type="password" value={newKey.key_value} onChange={(e) => setNewKey({...newKey, key_value: e.target.value})} className="input-field" placeholder="sk-..." />
              </div>
              
              <div className="flex gap-4" style={{ marginTop: '32px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={adding}>
                  {adding ? <div className="loader"></div> : 'Save Key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
