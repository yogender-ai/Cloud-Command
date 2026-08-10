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
        title="Appearance"
        aria-label="Change appearance"
      >
        <Palette size={16} />
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
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              transition={{ type: 'spring', damping: 28, stiffness: 360 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="theme-picker-header">
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, letterSpacing: '-0.02em' }}>
                    Appearance
                  </h2>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.45 }}>
                    Professional palettes tuned for long ops sessions. Status colors stay green / amber / red.
                  </p>
                </div>
                <button className="btn btn-ghost btn-icon" onClick={() => setOpen(false)} aria-label="Close">
                  <X size={18} />
                </button>
              </div>

              <div className="theme-grid theme-grid-pro">
                {Object.entries(themes).map(([key, t]) => {
                  const isActive = key === themeName;
                  return (
                    <motion.button
                      key={key}
                      type="button"
                      className={`theme-card theme-card-pro ${isActive ? 'active' : ''}`}
                      onClick={() => setThemeName(key)}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <div className="theme-card-preview" style={{ background: t.bg }}>
                        <div
                          className="theme-card-orb theme-card-orb-1"
                          style={{ background: `radial-gradient(circle, ${t.accent}55, transparent 70%)` }}
                        />
                        <div className="theme-card-mini-ui">
                          <div className="theme-mini-sidebar" style={{ background: t.sidebarBg, borderColor: t.border }}>
                            <div style={{ width: 14, height: 14, borderRadius: 4, background: t.gradient, marginBottom: 8 }} />
                            <div style={{ width: '100%', height: 4, borderRadius: 2, background: t.accent, opacity: 0.55 }} />
                            <div style={{ width: '75%', height: 3, borderRadius: 2, background: t.textMuted, opacity: 0.35, marginTop: 5 }} />
                            <div style={{ width: '60%', height: 3, borderRadius: 2, background: t.textMuted, opacity: 0.25, marginTop: 4 }} />
                          </div>
                          <div className="theme-mini-content">
                            <div style={{ width: '55%', height: 5, borderRadius: 2, background: t.textPrimary, opacity: 0.55, marginBottom: 8 }} />
                            <div style={{ display: 'flex', gap: 5 }}>
                              <div style={{ flex: 1, height: 22, borderRadius: 5, background: t.bgCard, border: `1px solid ${t.border}` }} />
                              <div style={{ flex: 1, height: 22, borderRadius: 5, background: t.bgCard, border: `1px solid ${t.border}` }} />
                            </div>
                            <div
                              style={{
                                marginTop: 6,
                                height: 6,
                                borderRadius: 3,
                                background: t.gradient,
                                opacity: 0.85,
                                width: '40%',
                              }}
                            />
                          </div>
                        </div>
                        {isActive && (
                          <div className="theme-card-check">
                            <Check size={13} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                      <div className="theme-card-meta-pro">
                        <div className="theme-card-name">{t.name}</div>
                        <div className="theme-card-desc">{t.description}</div>
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
