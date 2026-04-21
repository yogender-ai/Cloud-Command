import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Check, X } from 'lucide-react';
import { useTheme } from '../ThemeContext';

export default function ThemeSwitcher() {
  const [open, setOpen] = useState(false);
  const { themeName, setThemeName, themes } = useTheme();

  return (
    <>
      <button
        className="theme-switcher-btn"
        onClick={() => setOpen(true)}
        title="Change Theme"
      >
        <Palette size={18} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              className="theme-picker-panel"
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{ type: 'spring', damping: 25, stiffness: 400 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="theme-picker-header">
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>
                    ✨ Choose Your Vibe
                  </h2>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Select a theme that matches your style
                  </p>
                </div>
                <button className="btn btn-ghost btn-icon" onClick={() => setOpen(false)}>
                  <X size={18} />
                </button>
              </div>

              <div className="theme-grid">
                {Object.entries(themes).map(([key, t]) => {
                  const isActive = key === themeName;
                  return (
                    <motion.button
                      key={key}
                      className={`theme-card ${isActive ? 'active' : ''}`}
                      onClick={() => setThemeName(key)}
                      whileHover={{ scale: 1.03, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      style={{
                        '--tc-accent': t.accent,
                        '--tc-bg': t.bg,
                        '--tc-glow': t.accentGlow,
                        '--tc-gradient': t.gradient,
                        '--tc-orb1': t.orbColor1,
                        '--tc-orb2': t.orbColor2,
                      }}
                    >
                      {/* Preview area */}
                      <div className="theme-card-preview" style={{ background: t.bg }}>
                        {/* Orb effects */}
                        <div className="theme-card-orb theme-card-orb-1" style={{ background: `radial-gradient(circle, ${t.orbColor1.replace('0.1', '0.5').replace('0.12', '0.5')}, transparent 70%)` }} />
                        <div className="theme-card-orb theme-card-orb-2" style={{ background: `radial-gradient(circle, ${t.orbColor2.replace('0.07', '0.4').replace('0.08', '0.4')}, transparent 70%)` }} />
                        {/* Mini UI preview */}
                        <div className="theme-card-mini-ui">
                          <div className="theme-mini-sidebar" style={{ background: t.sidebarBg }}>
                            <div style={{ width: 16, height: 16, borderRadius: 4, background: t.gradient, marginBottom: 8 }} />
                            <div style={{ width: '100%', height: 5, borderRadius: 2, background: t.accent, opacity: 0.5 }} />
                            <div style={{ width: '80%', height: 4, borderRadius: 2, background: t.textMuted, opacity: 0.3, marginTop: 4 }} />
                            <div style={{ width: '70%', height: 4, borderRadius: 2, background: t.textMuted, opacity: 0.2, marginTop: 4 }} />
                          </div>
                          <div className="theme-mini-content">
                            <div style={{ width: '60%', height: 6, borderRadius: 2, background: t.textPrimary, opacity: 0.6, marginBottom: 6 }} />
                            <div style={{ display: 'flex', gap: 4 }}>
                              <div style={{ flex: 1, height: 20, borderRadius: 4, background: t.bgCard, border: `1px solid ${t.border}` }} />
                              <div style={{ flex: 1, height: 20, borderRadius: 4, background: t.bgCard, border: `1px solid ${t.border}` }} />
                            </div>
                          </div>
                        </div>
                        {/* Active checkmark */}
                        {isActive && (
                          <motion.div
                            className="theme-card-check"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', damping: 15 }}
                          >
                            <Check size={14} strokeWidth={3} />
                          </motion.div>
                        )}
                      </div>
                      {/* Label */}
                      <div className="theme-card-label">
                        <span className="theme-card-icon">{t.icon}</span>
                        <span className="theme-card-name">{t.name}</span>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
