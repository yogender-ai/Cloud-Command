import { NavLink, useLocation } from 'react-router-dom';
import { useState } from 'react';
import {
  LayoutDashboard, Globe, KeyRound, Server, Triangle,
  Settings, ChevronLeft, ChevronRight, Menu, X
} from 'lucide-react';
import ThemeSwitcher from './ThemeSwitcher';

const navItems = [
  { label: 'Overview', to: '/', icon: LayoutDashboard, section: 'command' },
  { label: 'Site Monitor', to: '/monitors', icon: Globe, section: 'command' },
  { label: 'API Vault', to: '/api-keys', icon: KeyRound, section: 'command' },
  { label: 'Render', to: '/render', icon: Server, section: 'platforms' },
  { label: 'Vercel', to: '/vercel', icon: Triangle, section: 'platforms' },
  { label: 'Settings', to: '/settings', icon: Settings, section: 'system' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const sections = {
    command: 'Command Center',
    platforms: 'Platforms',
    system: 'System',
  };

  let lastSection = null;

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="mobile-menu-btn"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <text x="1" y="15" fontSize="14" fontWeight="900" fontFamily="monospace" fill="#fff">&gt;_</text>
            </svg>
          </div>
          {!collapsed && (
            <div className="sidebar-brand-text">
              <h1>Cloud Command</h1>
              <p>DevOps Center</p>
            </div>
          )}
        </div>

        {/* Navigation */}
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
                {showSection && !collapsed && (
                  <div className="sidebar-section-label">{sections[item.section]}</div>
                )}
                <NavLink
                  to={item.to}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="nav-item-icon"><Icon size={18} /></span>
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              </div>
            );
          })}
        </nav>

        {/* Footer: Theme Switcher + Collapse */}
        <div className="sidebar-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderTop: '1px solid var(--border)' }}>
          <button className="sidebar-collapse-btn" style={{ flex: 1, marginRight: collapsed ? 0 : 8 }} onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /> <span>Collapse</span></>}
          </button>
          {!collapsed && <ThemeSwitcher />}
        </div>
      </aside>
    </>
  );
}
