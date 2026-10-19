import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { getSetting, setSetting } from '../services/settingsService';

export interface ThemeColors {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent: string;
  background: string;
  surface: string;
  card: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderLight: string;
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  danger: string;
  dangerLight: string;
  inputBg: string;
}

export const lightColors: ThemeColors = {
  primary: '#0284c7',
  primaryDark: '#0369a1',
  primaryLight: '#e0f2fe',
  accent: '#0ea5e9',
  background: '#f8fafc',
  surface: '#ffffff',
  card: '#ffffff',
  text: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  success: '#10b981',
  successLight: '#d1fae5',
  warning: '#f59e0b',
  warningLight: '#fef3c7',
  danger: '#ef4444',
  dangerLight: '#fee2e2',
  inputBg: '#f1f5f9',
};

export const darkColors: ThemeColors = {
  primary: '#38bdf8',
  primaryDark: '#0284c7',
  primaryLight: '#0c4a6e',
  accent: '#38bdf8',
  background: '#0f172a',
  surface: '#1e293b',
  card: '#1e293b',
  text: '#f8fafc',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  border: '#334155',
  borderLight: '#1e293b',
  success: '#34d399',
  successLight: '#064e3b',
  warning: '#fbbf24',
  warningLight: '#78350f',
  danger: '#f87171',
  dangerLight: '#450a0a',
  inputBg: '#334155',
};

interface ThemeContextType {
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => Promise<void>;
  setThemeMode: (mode: 'light' | 'dark') => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: false,
  colors: lightColors,
  toggleTheme: async () => {},
  setThemeMode: async () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [isDark, setIsDark] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const savedTheme = await getSetting('theme');
        if (!mounted) return;
        if (savedTheme === 'dark') {
          setIsDark(true);
        } else if (savedTheme === 'light') {
          setIsDark(false);
        } else {
          // Default to light as specified in PRD
          setIsDark(false);
        }
      } catch {
        // Fallback to light
        if (mounted) setIsDark(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const toggleTheme = async () => {
    const nextVal = !isDark;
    setIsDark(nextVal);
    await setSetting('theme', nextVal ? 'dark' : 'light');
  };

  const setThemeMode = async (mode: 'light' | 'dark') => {
    const nextVal = mode === 'dark';
    setIsDark(nextVal);
    await setSetting('theme', mode);
  };

  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ isDark, colors, toggleTheme, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
