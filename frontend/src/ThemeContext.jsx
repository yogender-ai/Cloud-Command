import { createContext, useContext, useState, useEffect } from 'react';

const themes = {
  midnight: {
    name: 'Midnight Cosmos',
    icon: '🌌',
    bg: '#030308',
    bgSecondary: '#08081a',
    bgCard: 'rgba(12, 12, 26, 0.55)',
    bgCardHover: 'rgba(18, 18, 36, 0.65)',
    bgElevated: '#111128',
    bgInput: 'rgba(8, 8, 22, 0.6)',
    border: 'rgba(99, 102, 241, 0.1)',
    borderHover: 'rgba(99, 102, 241, 0.2)',
    borderFocus: '#818cf8',
    textPrimary: '#eef0ff',
    textSecondary: '#a0a4c8',
    textMuted: '#5a5e82',
    accent: '#818cf8',
    accentGlow: 'rgba(129, 140, 248, 0.15)',
    accentSecondary: '#a78bfa',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    orbColor1: 'rgba(99, 102, 241, 0.12)',
    orbColor2: 'rgba(168, 85, 247, 0.08)',
    orbColor3: 'rgba(6, 182, 212, 0.06)',
    sidebarBg: 'rgba(6, 6, 18, 0.7)',
    particleColor: 'rgba(129, 140, 248, 0.3)',
  },
  aurora: {
    name: 'Aurora Borealis',
    icon: '🌊',
    bg: '#020a0c',
    bgSecondary: '#061218',
    bgCard: 'rgba(8, 22, 28, 0.55)',
    bgCardHover: 'rgba(12, 30, 38, 0.65)',
    bgElevated: '#0d2233',
    bgInput: 'rgba(6, 18, 24, 0.6)',
    border: 'rgba(6, 182, 212, 0.1)',
    borderHover: 'rgba(6, 182, 212, 0.2)',
    borderFocus: '#22d3ee',
    textPrimary: '#e8f8fc',
    textSecondary: '#92c5d8',
    textMuted: '#4a7a8c',
    accent: '#22d3ee',
    accentGlow: 'rgba(34, 211, 238, 0.12)',
    accentSecondary: '#06b6d4',
    gradient: 'linear-gradient(135deg, #0891b2 0%, #6366f1 50%, #a855f7 100%)',
    orbColor1: 'rgba(6, 182, 212, 0.12)',
    orbColor2: 'rgba(16, 185, 129, 0.08)',
    orbColor3: 'rgba(99, 102, 241, 0.06)',
    sidebarBg: 'rgba(4, 14, 18, 0.7)',
    particleColor: 'rgba(34, 211, 238, 0.3)',
  },
  ember: {
    name: 'Ember Noir',
    icon: '🔥',
    bg: '#0a0506',
    bgSecondary: '#140a0c',
    bgCard: 'rgba(24, 12, 14, 0.55)',
    bgCardHover: 'rgba(32, 16, 20, 0.65)',
    bgElevated: '#1e1015',
    bgInput: 'rgba(18, 8, 12, 0.6)',
    border: 'rgba(244, 63, 94, 0.1)',
    borderHover: 'rgba(244, 63, 94, 0.2)',
    borderFocus: '#fb7185',
    textPrimary: '#fff0f2',
    textSecondary: '#d4a0aa',
    textMuted: '#8a5a64',
    accent: '#fb7185',
    accentGlow: 'rgba(251, 113, 133, 0.12)',
    accentSecondary: '#f43f5e',
    gradient: 'linear-gradient(135deg, #f43f5e 0%, #ec4899 50%, #a855f7 100%)',
    orbColor1: 'rgba(244, 63, 94, 0.1)',
    orbColor2: 'rgba(236, 72, 153, 0.07)',
    orbColor3: 'rgba(245, 158, 11, 0.05)',
    sidebarBg: 'rgba(12, 6, 8, 0.7)',
    particleColor: 'rgba(251, 113, 133, 0.3)',
  },
  emerald: {
    name: 'Emerald Matrix',
    icon: '💚',
    bg: '#020a06',
    bgSecondary: '#061a10',
    bgCard: 'rgba(8, 28, 16, 0.55)',
    bgCardHover: 'rgba(12, 36, 22, 0.65)',
    bgElevated: '#0d2e18',
    bgInput: 'rgba(6, 22, 12, 0.6)',
    border: 'rgba(16, 185, 129, 0.1)',
    borderHover: 'rgba(16, 185, 129, 0.2)',
    borderFocus: '#34d399',
    textPrimary: '#e8fcf0',
    textSecondary: '#8cd4aa',
    textMuted: '#4a8c66',
    accent: '#34d399',
    accentGlow: 'rgba(52, 211, 153, 0.12)',
    accentSecondary: '#10b981',
    gradient: 'linear-gradient(135deg, #059669 0%, #10b981 50%, #06b6d4 100%)',
    orbColor1: 'rgba(16, 185, 129, 0.1)',
    orbColor2: 'rgba(6, 182, 212, 0.07)',
    orbColor3: 'rgba(52, 211, 153, 0.05)',
    sidebarBg: 'rgba(4, 14, 8, 0.7)',
    particleColor: 'rgba(52, 211, 153, 0.3)',
  },
  royale: {
    name: 'Royal Velvet',
    icon: '👑',
    bg: '#08040e',
    bgSecondary: '#120a1e',
    bgCard: 'rgba(20, 12, 32, 0.55)',
    bgCardHover: 'rgba(28, 18, 42, 0.65)',
    bgElevated: '#1c1232',
    bgInput: 'rgba(14, 8, 24, 0.6)',
    border: 'rgba(168, 85, 247, 0.1)',
    borderHover: 'rgba(168, 85, 247, 0.2)',
    borderFocus: '#c084fc',
    textPrimary: '#f4eeff',
    textSecondary: '#bca0d8',
    textMuted: '#7a5a96',
    accent: '#c084fc',
    accentGlow: 'rgba(192, 132, 252, 0.12)',
    accentSecondary: '#a855f7',
    gradient: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #ec4899 100%)',
    orbColor1: 'rgba(168, 85, 247, 0.1)',
    orbColor2: 'rgba(192, 132, 252, 0.07)',
    orbColor3: 'rgba(236, 72, 153, 0.05)',
    sidebarBg: 'rgba(10, 6, 16, 0.7)',
    particleColor: 'rgba(192, 132, 252, 0.3)',
  },
};

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [themeName, setThemeName] = useState(() => {
    return localStorage.getItem('cc-theme') || 'midnight';
  });

  const theme = themes[themeName] || themes.midnight;

  useEffect(() => {
    localStorage.setItem('cc-theme', themeName);
    const root = document.documentElement;
    // Apply CSS custom properties from theme
    root.style.setProperty('--bg-primary', theme.bg);
    root.style.setProperty('--bg-secondary', theme.bgSecondary);
    root.style.setProperty('--bg-card', theme.bgCard);
    root.style.setProperty('--bg-card-hover', theme.bgCardHover);
    root.style.setProperty('--bg-elevated', theme.bgElevated);
    root.style.setProperty('--bg-input', theme.bgInput);
    root.style.setProperty('--border', theme.border);
    root.style.setProperty('--border-hover', theme.borderHover);
    root.style.setProperty('--border-focus', theme.borderFocus);
    root.style.setProperty('--text-primary', theme.textPrimary);
    root.style.setProperty('--text-secondary', theme.textSecondary);
    root.style.setProperty('--text-muted', theme.textMuted);
    root.style.setProperty('--accent-main', theme.accent);
    root.style.setProperty('--accent-main-glow', theme.accentGlow);
    root.style.setProperty('--accent-secondary', theme.accentSecondary);
    root.style.setProperty('--gradient-main', theme.gradient);
    root.style.setProperty('--orb-color-1', theme.orbColor1);
    root.style.setProperty('--orb-color-2', theme.orbColor2);
    root.style.setProperty('--orb-color-3', theme.orbColor3);
    root.style.setProperty('--sidebar-bg', theme.sidebarBg);
    root.style.setProperty('--particle-color', theme.particleColor);
    root.setAttribute('data-theme', themeName);
  }, [themeName, theme]);

  return (
    <ThemeContext.Provider value={{ theme, themeName, setThemeName, themes }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export { themes };
