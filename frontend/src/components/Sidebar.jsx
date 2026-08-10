import { NavLink, useLocation } from 'react-router-dom';
import { useState } from 'react';
import {
  LayoutDashboard, Globe, KeyRound, Server, Triangle,
  Settings, PanelLeftClose, PanelLeft, Menu, X, Timer, LogOut, Compass
} from 'lucide-react';
import ThemeSwitcher from './ThemeSwitcher';
import { removeToken } from '../auth';

const navItems = [
  { label: 'Overview', to: '/', icon: LayoutDashboard, section: 'command' },
  { label: 'Site Monitor', to: '/monitors', icon: Globe, section: 'command' },
  { label: 'Scheduled Jobs', to: '/scheduled-jobs', icon: Timer, section: 'command' },
  { label: 'API Vault', to: '/api-keys', icon: KeyRound, section: 'command' },
  { label: 'Render', to: '/render', icon: Server, section: 'platforms' },
  { label: 'Vercel', to: '/vercel', icon: Triangle, section: 'platforms' },
  { label: 'Settings', to: '/settings', icon: Settings, section: 'system' },
];

export default function Sidebar({ onOpenTour }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const sections = {
    command: 'Command Center',
    platforms: 'Platforms',
    system: 'System',
  };

  let lastSection = null;

  const handleLogout = () => {
    removeToken();
    window.location.assign('/login');
  };

  return (
    <>
      <button
        className="mobile-menu-btn"
        aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {mobileOpen && (
        <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} aria-hidden />
      )}

      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 13, color: '#fff' }}>&gt;_</span>
          </div>
          {(!collapsed || mobileOpen) && (
            <div className="sidebar-brand-text">
              <h1>Cloud Command</h1>
              <p>DevOps Center</p>
            </div>
          )}
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const showSection = item.section !== lastSection;
            lastSection = item.section;
            const Icon = item.icon;
            const isActive = item.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.to);

            return (
              <div key={item.to}>
                {showSection && (!collapsed || mobileOpen) && (
                  <div className="sidebar-section-label">{sections[item.section]}</div>
                )}
                <NavLink
                  to={item.to}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setMobileOpen(false)}
                  title={collapsed && !mobileOpen ? item.label : undefined}
                >
                  <span className="nav-item-icon"><Icon size={18} /></span>
                  {(!collapsed || mobileOpen) && <span>{item.label}</span>}
                </NavLink>
              </div>
            );
          })}
        </nav>

        {/* Single clean toolbar — no full-width “Collapse” pill */}
        <div className={`sidebar-toolbar ${collapsed && !mobileOpen ? 'is-collapsed' : ''}`}>
          <button
            type="button"
            className="sidebar-tool-btn"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed && !mobileOpen ? <PanelLeft size={17} /> : <PanelLeftClose size={17} />}
          </button>

          {(!collapsed || mobileOpen) && (
            <>
              {onOpenTour && (
                <button type="button" className="sidebar-tool-btn" title="Product tour" onClick={onOpenTour}>
                  <Compass size={16} />
                </button>
              )}
              <ThemeSwitcher />
              <button type="button" className="sidebar-tool-btn" title="Sign out" onClick={handleLogout}>
                <LogOut size={16} />
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
