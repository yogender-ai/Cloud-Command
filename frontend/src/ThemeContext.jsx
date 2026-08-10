import { createContext, useContext, useState, useEffect } from 'react';

/**
 * Professional theme system for Cloud Command.
 * Each palette is tuned for long ops sessions: high readability, calm accents,
 * status colors stay semantic (green/amber/red) via CSS, brand accent only for actions.
 *
 * Reasons (interview-ready):
 * - Slate Ops: neutral blue-gray = default enterprise consoles (Linear/GitHub dark)
 * - Atlantic: cool teal = infrastructure/monitoring without neon cyan
 * - Graphite: near-monochrome = maximum focus, minimal brand noise
 * - Evergreen: muted green = “healthy systems” ops aesthetic, not matrix green
 * - Indigo: deep indigo = trust + primary actions without purple party gradients
 */
const themes = {
  slate: {
    name: 'Slate Ops',
    description: 'Neutral enterprise default',
    reason: 'Blue-gray neutrals reduce eye strain; indigo accent for actions only — like GitHub/Linear dark.',
    icon: 'Slate',
    bg: '#0B0E14',
    bgSecondary: '#11161F',
    bgCard: 'rgba(17, 22, 31, 0.72)',
    bgCardHover: 'rgba(24, 30, 42, 0.85)',
    bgElevated: '#161C28',
    bgInput: 'rgba(10, 13, 20, 0.75)',
    border: 'rgba(148, 163, 184, 0.12)',
    borderHover: 'rgba(148, 163, 184, 0.22)',
    borderFocus: '#60A5FA',
    textPrimary: '#E8EDF5',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    accent: '#60A5FA',
    accentGlow: 'rgba(96, 165, 250, 0.14)',
    accentSecondary: '#93C5FD',
    gradient: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
    orbColor1: 'rgba(59, 130, 246, 0.1)',
    orbColor2: 'rgba(100, 116, 139, 0.08)',
    orbColor3: 'rgba(148, 163, 184, 0.05)',
    sidebarBg: 'rgba(11, 14, 20, 0.88)',
    particleColor: 'rgba(96, 165, 250, 0.28)',
  },
  atlantic: {
    name: 'Atlantic',
    description: 'Cool infrastructure teal',
    reason: 'Desaturated teal reads “network/infra” without bright cyan glow or gaming vibes.',
    icon: 'Ocean',
    bg: '#071014',
    bgSecondary: '#0C181E',
    bgCard: 'rgba(12, 24, 30, 0.72)',
    bgCardHover: 'rgba(18, 34, 42, 0.85)',
    bgElevated: '#12242C',
    bgInput: 'rgba(8, 16, 20, 0.75)',
    border: 'rgba(100, 160, 175, 0.14)',
    borderHover: 'rgba(100, 160, 175, 0.26)',
    borderFocus: '#5B9AAB',
    textPrimary: '#E6F1F4',
    textSecondary: '#8BAEBA',
    textMuted: '#5A7A86',
    accent: '#5B9AAB',
    accentGlow: 'rgba(91, 154, 171, 0.14)',
    accentSecondary: '#7FB3C2',
    gradient: 'linear-gradient(135deg, #3D7A8C 0%, #2F6474 100%)',
    orbColor1: 'rgba(91, 154, 171, 0.1)',
    orbColor2: 'rgba(47, 100, 116, 0.08)',
    orbColor3: 'rgba(100, 160, 175, 0.05)',
    sidebarBg: 'rgba(7, 16, 20, 0.9)',
    particleColor: 'rgba(91, 154, 171, 0.28)',
  },
  graphite: {
    name: 'Graphite',
    description: 'Minimal monochrome focus',
    reason: 'Near-monochrome UI keeps status colors (green/red) as the only color signal — ideal for triage.',
    icon: 'Graph',
    bg: '#0A0A0B',
    bgSecondary: '#121214',
    bgCard: 'rgba(20, 20, 22, 0.78)',
    bgCardHover: 'rgba(28, 28, 32, 0.9)',
    bgElevated: '#1A1A1E',
    bgInput: 'rgba(12, 12, 14, 0.8)',
    border: 'rgba(255, 255, 255, 0.08)',
    borderHover: 'rgba(255, 255, 255, 0.14)',
    borderFocus: '#A1A1AA',
    textPrimary: '#F4F4F5',
    textSecondary: '#A1A1AA',
    textMuted: '#71717A',
    accent: '#A1A1AA',
    accentGlow: 'rgba(161, 161, 170, 0.12)',
    accentSecondary: '#D4D4D8',
    gradient: 'linear-gradient(135deg, #52525B 0%, #3F3F46 100%)',
    orbColor1: 'rgba(161, 161, 170, 0.08)',
    orbColor2: 'rgba(113, 113, 122, 0.06)',
    orbColor3: 'rgba(255, 255, 255, 0.03)',
    sidebarBg: 'rgba(10, 10, 11, 0.92)',
    particleColor: 'rgba(161, 161, 170, 0.22)',
  },
  evergreen: {
    name: 'Evergreen',
    description: 'Calm ops green',
    reason: 'Muted forest green signals reliability/uptime without neon “hacker green”.',
    icon: 'Forest',
    bg: '#080C0A',
    bgSecondary: '#0E1612',
    bgCard: 'rgba(14, 22, 18, 0.75)',
    bgCardHover: 'rgba(20, 32, 26, 0.88)',
    bgElevated: '#14201A',
    bgInput: 'rgba(10, 16, 13, 0.78)',
    border: 'rgba(110, 150, 125, 0.14)',
    borderHover: 'rgba(110, 150, 125, 0.26)',
    borderFocus: '#6B9B7C',
    textPrimary: '#E8F0EB',
    textSecondary: '#9BB5A6',
    textMuted: '#6A8575',
    accent: '#6B9B7C',
    accentGlow: 'rgba(107, 155, 124, 0.14)',
    accentSecondary: '#8FB89C',
    gradient: 'linear-gradient(135deg, #4A7C59 0%, #3D6649 100%)',
    orbColor1: 'rgba(107, 155, 124, 0.1)',
    orbColor2: 'rgba(61, 102, 73, 0.08)',
    orbColor3: 'rgba(110, 150, 125, 0.05)',
    sidebarBg: 'rgba(8, 12, 10, 0.9)',
    particleColor: 'rgba(107, 155, 124, 0.26)',
  },
  indigo: {
    name: 'Indigo',
    description: 'Trust & product blue',
    reason: 'Deep indigo is the classic SaaS primary — trustworthy, not playful purple/pink.',
    icon: 'Indigo',
    bg: '#0A0B12',
    bgSecondary: '#12141F',
    bgCard: 'rgba(18, 20, 32, 0.75)',
    bgCardHover: 'rgba(26, 28, 44, 0.88)',
    bgElevated: '#181A2A',
    bgInput: 'rgba(12, 14, 22, 0.78)',
    border: 'rgba(129, 140, 248, 0.14)',
    borderHover: 'rgba(129, 140, 248, 0.26)',
    borderFocus: '#818CF8',
    textPrimary: '#EEF0FF',
    textSecondary: '#A5AECF',
    textMuted: '#6B7394',
    accent: '#818CF8',
    accentGlow: 'rgba(129, 140, 248, 0.14)',
    accentSecondary: '#A5B4FC',
    gradient: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
    orbColor1: 'rgba(99, 102, 241, 0.1)',
    orbColor2: 'rgba(79, 70, 229, 0.07)',
    orbColor3: 'rgba(165, 180, 252, 0.05)',
    sidebarBg: 'rgba(10, 11, 18, 0.9)',
    particleColor: 'rgba(129, 140, 248, 0.28)',
  },
};

// Map legacy theme keys so old localStorage values still resolve
const LEGACY_MAP = {
  midnight: 'indigo',
  aurora: 'atlantic',
  ember: 'slate',
  emerald: 'evergreen',
  royale: 'indigo',
};

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [themeName, setThemeName] = useState(() => {
    const saved = localStorage.getItem('cc-theme') || 'slate';
    if (themes[saved]) return saved;
    return LEGACY_MAP[saved] || 'slate';
  });

  const theme = themes[themeName] || themes.slate;

  useEffect(() => {
    localStorage.setItem('cc-theme', themeName);
    const root = document.documentElement;
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

    root.style.setProperty('--accent-indigo', theme.accent);
    root.style.setProperty('--accent-indigo-glow', theme.accentGlow);
    root.style.setProperty('--accent-purple', theme.accentSecondary);
    root.style.setProperty('--accent-purple-glow', theme.accentGlow);
    root.style.setProperty('--gradient-primary', theme.gradient);
    root.style.setProperty('--cursor-color', theme.particleColor);
    root.style.setProperty('--shadow-glow-indigo', `0 0 24px ${theme.accentGlow}`);

    root.style.setProperty('--orb-color-1', theme.orbColor1);
    root.style.setProperty('--orb-color-2', theme.orbColor2);
    root.style.setProperty('--orb-color-3', theme.orbColor3);
    root.style.setProperty('--sidebar-bg', theme.sidebarBg);
    root.style.setProperty('--particle-color', theme.particleColor);
    root.style.setProperty('--mesh-1', theme.orbColor1);
    root.style.setProperty('--mesh-2', theme.orbColor2);
    root.style.setProperty('--mesh-3', theme.orbColor3);
    root.style.setProperty('--mesh-4', theme.accentGlow);

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
